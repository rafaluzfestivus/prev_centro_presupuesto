import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/evolution'

export const maxDuration = 60 // Vercel: até 60s para planos Pro, 10s para hobby

const BASE_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
const API_KEY  = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'preventiva'

const evoHeaders = { 'Content-Type': 'application/json', apikey: API_KEY }

function resolveCompanyId(instance: string): number {
    const centro = process.env.EVOLUTION_INSTANCE_CENTRO
    const este   = process.env.EVOLUTION_INSTANCE_ESTE
    if (centro && instance === centro) return 1
    if (este   && instance === este)   return 2
    return 1
}

export async function GET(req: NextRequest) {
    // Verifica env vars
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY não configurado na Vercel' }, { status: 500 })
    }
    if (!BASE_URL || !API_KEY) {
        return NextResponse.json({ ok: false, error: 'EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados na Vercel' }, { status: 500 })
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Parâmetros opcionais
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30'), 100)
    const debug = url.searchParams.get('debug') === '1'

    try {
        // 1. Busca lista de chats (Evolution API v2 usa POST)
        const chatsRes = await fetch(`${BASE_URL}/chat/findChats/${INSTANCE}`, {
            method: 'POST',
            headers: evoHeaders,
            body: JSON.stringify({}),
        })
        if (!chatsRes.ok) {
            const txt = await chatsRes.text()
            return NextResponse.json({ ok: false, error: `Evolution API (findChats) ${chatsRes.status}: ${txt.slice(0, 200)}` }, { status: 500 })
        }

        const allChats = await chatsRes.json() as { id: string; name?: string }[]
        if (!Array.isArray(allChats)) {
            return NextResponse.json({ ok: false, error: 'Evolution API retornou formato inesperado em findChats' }, { status: 500 })
        }

        // Filtra grupos e limita quantidade
        const chats = allChats
            .filter(c => c.id && !c.id.includes('@g.us'))
            .slice(0, limit)

        let totalImported = 0
        let totalSkipped  = 0

        for (const chat of chats) {
            const phone = chat.id.split('@')[0]

            // 2. Busca mensagens do chat
            let msgs: {
                key: { id: string; fromMe: boolean; remoteJid: string }
                message?: { conversation?: string; extendedTextMessage?: { text: string } }
                messageTimestamp: number
                pushName?: string
            }[] = []

            try {
                // Evolution API v2: endpoint é findMessages com where em dot notation
                const msgsRes = await fetch(`${BASE_URL}/chat/findMessages/${INSTANCE}`, {
                    method: 'POST',
                    headers: evoHeaders,
                    body: JSON.stringify({
                        where: { key: { remoteJid: chat.id } },
                        limit: 50,
                    }),
                })
                if (msgsRes.ok) {
                    const json = await msgsRes.json()
                    // Debug: retorna estrutura do primeiro chat
                    if (debug && chats.indexOf(chat) === 0) {
                        return NextResponse.json({ debug: true, chatId: chat.id, raw: json })
                    }
                    // Evolution API v2 retorna { messages: { records: [...], total, pages } }
                    if (Array.isArray(json)) msgs = json
                    else if (Array.isArray(json?.messages?.records)) msgs = json.messages.records
                    else if (Array.isArray(json?.messages)) msgs = json.messages
                    else if (Array.isArray(json?.records)) msgs = json.records
                }
            } catch {
                continue
            }

            if (!msgs.length) continue

            // 3. Encontra ou cria cliente
            const normalizedPhone = normalizePhone(phone)
            let clientId: string | null = null

            const { data: existing } = await supabase
                .from('clients')
                .select('id')
                .or(`whatsapp.eq.${phone},whatsapp.eq.${normalizedPhone}`)
                .limit(1)
                .maybeSingle()

            if (existing?.id) {
                clientId = existing.id
            } else {
                const { data: newClient } = await supabase
                    .from('clients')
                    .insert({ name: chat.name || phone, whatsapp: phone, source: 'whatsapp', status: 'new', company_id: resolveCompanyId(INSTANCE) })
                    .select('id')
                    .single()
                clientId = newClient?.id ?? null
            }

            // 4. Insere mensagens sem duplicar
            for (const msg of msgs) {
                const waId = msg.key?.id
                if (!waId) continue

                const { data: dup } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('wa_message_id', waId)
                    .maybeSingle()

                if (dup?.id) { totalSkipped++; continue }

                const text =
                    msg.message?.conversation ??
                    msg.message?.extendedTextMessage?.text ??
                    ''

                if (!text) continue

                const isFromMe = msg.key.fromMe === true
                await supabase.from('conversations').insert({
                    client_id:     clientId,
                    message:       text,
                    direction:     isFromMe ? 'outbound' : 'inbound',
                    status:        isFromMe ? 'sent' : 'received',
                    wa_message_id: waId,
                    phone,
                    push_name:     msg.pushName ?? null,
                    created_at:    new Date(msg.messageTimestamp * 1000).toISOString(),
                })
                totalImported++
            }
        }

        return NextResponse.json({
            ok: true,
            imported: totalImported,
            skipped: totalSkipped,
            chats: chats.length,
            hint: totalImported === 0 ? 'Use ?debug=1 para ver a estrutura da resposta da Evolution API' : undefined,
        })

    } catch (err) {
        console.error('[WA Import]', err)
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
}
