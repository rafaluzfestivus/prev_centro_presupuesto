import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Map Evolution API instance names → company_id
// Configure EVOLUTION_INSTANCE_CENTRO and EVOLUTION_INSTANCE_ESTE in Vercel env vars
function resolveCompanyId(instance: string): number {
    const centro = process.env.EVOLUTION_INSTANCE_CENTRO
    const este   = process.env.EVOLUTION_INSTANCE_ESTE
    if (centro && instance === centro) return 1
    if (este   && instance === este)   return 2
    return 1 // default: Centro
}

export async function POST(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    try {
        const body = await req.json()

        const eventName: string = (body.event ?? '').toUpperCase().replace('.', '_')
        if (eventName !== 'MESSAGES_UPSERT') {
            return NextResponse.json({ ok: true })
        }

        const companyId = resolveCompanyId(body.instance ?? '')

        const rawData = body.data
        if (!rawData) return NextResponse.json({ ok: true })
        const msgs = Array.isArray(rawData) ? rawData : [rawData]

        for (const msg of msgs) {
            const remoteJid: string = msg.key?.remoteJid ?? ''
            const phone = remoteJid.split('@')[0]
            const isFromMe: boolean = msg.key?.fromMe === true

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

            if (!text && !mediaUrl) continue

            if (waMessageId) {
                const { data: dup } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('wa_message_id', waMessageId)
                    .maybeSingle()
                if (dup?.id) continue
            }

            let clientId: string | null = null

            const { data: existing } = await supabase
                .from('clients')
                .select('id')
                .eq('company_id', companyId)
                .or(`whatsapp.eq.${phone},whatsapp.eq.+${phone},whatsapp.eq.${phone.replace(/^34/, '')}`)
                .limit(1)
                .maybeSingle()

            if (existing?.id) {
                clientId = existing.id
            } else {
                const { data: newClient } = await supabase
                    .from('clients')
                    .insert({
                        name: pushName || phone,
                        whatsapp: phone,
                        source: 'whatsapp',
                        status: 'new',
                        company_id: companyId,
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
