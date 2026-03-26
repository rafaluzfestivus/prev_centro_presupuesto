import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Evolution API sends webhooks for every event.
 * We only care about "messages.upsert" with fromMe=false (incoming messages).
 *
 * Configure in Evolution API:
 *   Webhook URL: https://seuapp.com/api/webhooks/whatsapp
 *   Events: messages.upsert
 */
export async function POST(req: NextRequest) {
    // Criado dentro da função para evitar erro no build (env vars só existem em runtime)
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    try {
        const body = await req.json()

        // Evolution API v2 usa MESSAGES_UPSERT — aceita ambos os formatos por segurança
        const eventName: string = (body.event ?? '').toUpperCase().replace('.', '_')
        if (eventName !== 'MESSAGES_UPSERT') {
            return NextResponse.json({ ok: true })
        }

        // body.data pode ser um único objeto ou um array de mensagens
        const rawData = body.data
        if (!rawData) return NextResponse.json({ ok: true })
        const msgs = Array.isArray(rawData) ? rawData : [rawData]

        for (const msg of msgs) {
            // Extract phone (remove @s.whatsapp.net ou @g.us)
            const remoteJid: string = msg.key?.remoteJid ?? ''
            const phone = remoteJid.split('@')[0]
            const isFromMe: boolean = msg.key?.fromMe === true

            // Skip group messages
            if (remoteJid.endsWith('@g.us')) continue
            if (!phone) continue

            const waMessageId: string = msg.key?.id ?? ''
            const pushName: string    = msg.pushName ?? ''
            const text: string        =
                msg.message?.conversation ??
                msg.message?.extendedTextMessage?.text ??
                msg.message?.imageMessage?.caption ??
                msg.message?.documentMessage?.caption ??
                ''

            const mediaUrl: string | null  = msg.message?.imageMessage?.url ?? msg.message?.documentMessage?.url ?? null
            const mediaType: string | null = msg.message?.imageMessage ? 'image' : msg.message?.documentMessage ? 'document' : null

            // Ignore empty messages
            if (!text && !mediaUrl) continue

            // Avoid duplicates
            if (waMessageId) {
                const { data: dup } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('wa_message_id', waMessageId)
                    .maybeSingle()
                if (dup?.id) continue
            }

            // Find or create client by phone number
            let clientId: string | null = null

            const { data: existing } = await supabase
                .from('clients')
                .select('id')
                .or(`whatsapp.eq.${phone},whatsapp.eq.+${phone},whatsapp.eq.${phone.replace(/^34/, '')}`)
                .limit(1)
                .maybeSingle()

            if (existing?.id) {
                clientId = existing.id
            } else {
                // Create new client from WhatsApp contact
                const { data: newClient } = await supabase
                    .from('clients')
                    .insert({
                        name: pushName || phone,
                        whatsapp: phone,
                        source: 'whatsapp',
                        status: 'new',
                    })
                    .select('id')
                    .single()
                clientId = newClient?.id ?? null
            }

            // Save message — fromMe = outbound (mensagens do Rafael)
            await supabase.from('conversations').insert({
                client_id:     clientId,
                message:       text,
                direction:     isFromMe ? 'outbound' : 'inbound',
                status:        isFromMe ? 'sent' : 'received',
                wa_message_id: waMessageId,
                phone,
                media_url:     mediaUrl,
                media_type:    mediaType,
                push_name:     pushName,
            })
        }

        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('[WhatsApp Webhook]', err)
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
}

// Evolution API sometimes sends GET to verify the webhook URL
export async function GET() {
    return NextResponse.json({ status: 'ok', service: 'Preventiva WhatsApp Webhook' })
}
