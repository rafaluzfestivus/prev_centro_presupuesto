import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/evolution'

const BASE_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
const API_KEY  = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'preventiva'

const headers = { 'Content-Type': 'application/json', apikey: API_KEY }

/**
 * Importa o histórico de mensagens do WhatsApp via Evolution API.
 * Chama GET /api/wa/import para disparar a importação.
 */
export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    try {
        // 1. Busca todos os chats da instância
        const chatsRes = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, { headers })
        if (!chatsRes.ok) {
            return NextResponse.json({ ok: false, error: `Evolution API: ${chatsRes.status}` }, { status: 500 })
        }
        const chats: { id: string; name?: string }[] = await chatsRes.json()

        let totalImported = 0
        let totalSkipped  = 0

        for (const chat of chats) {
            // Ignora grupos (@g.us)
            if (!chat.id || chat.id.includes('@g.us')) continue

            const phone = chat.id.split('@')[0]

            // 2. Busca mensagens do chat (últimas 50)
            const msgsRes = await fetch(`${BASE_URL}/chat/fetchMessages/${INSTANCE}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ number: chat.id, count: 50 }),
            })
            if (!msgsRes.ok) continue

            const msgs: {
                key: { id: string; fromMe: boolean }
                message?: { conversation?: string; extendedTextMessage?: { text: string } }
                messageTimestamp: number
                pushName?: string
            }[] = await msgsRes.json()

            if (!Array.isArray(msgs) || msgs.length === 0) continue

            // 3. Encontra ou cria o cliente
            const normalizedPhone = normalizePhone(phone)
            let clientId: string | null = null

            const { data: existing } = await supabase
                .from('clients')
                .select('id')
                .or(`whatsapp.eq.${phone},whatsapp.eq.${normalizedPhone}`)
                .limit(1)
                .single()

            if (existing?.id) {
                clientId = existing.id
            } else {
                const { data: newClient } = await supabase
                    .from('clients')
                    .insert({
                        name: chat.name || phone,
                        whatsapp: phone,
                        source: 'whatsapp',
                        status: 'new',
                    })
                    .select('id')
                    .single()
                clientId = newClient?.id ?? null
            }

            // 4. Insere mensagens que ainda não existem
            for (const msg of msgs) {
                const waId = msg.key?.id
                if (!waId) continue

                // Verifica se já existe no banco
                const { data: dup } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('wa_message_id', waId)
                    .limit(1)
                    .single()

                if (dup?.id) { totalSkipped++; continue }

                const text =
                    msg.message?.conversation ??
                    msg.message?.extendedTextMessage?.text ??
                    ''

                if (!text) continue

                const createdAt = new Date(msg.messageTimestamp * 1000).toISOString()

                await supabase.from('conversations').insert({
                    client_id:     clientId,
                    message:       text,
                    direction:     msg.key.fromMe ? 'outbound' : 'inbound',
                    status:        msg.key.fromMe ? 'sent' : 'received',
                    wa_message_id: waId,
                    phone,
                    push_name:     msg.pushName ?? null,
                    created_at:    createdAt,
                })
                totalImported++
            }
        }

        return NextResponse.json({
            ok: true,
            imported: totalImported,
            skipped: totalSkipped,
            chats: chats.filter(c => !c.id?.includes('@g.us')).length,
        })

    } catch (err) {
        console.error('[WA Import]', err)
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
}
