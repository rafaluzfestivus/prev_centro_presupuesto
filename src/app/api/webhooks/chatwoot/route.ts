import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/evolution'

// Map Chatwoot account_id → company_id
function resolveCompanyId(accountId: number): number {
    const centroId = parseInt(process.env.CHATWOOT_ACCOUNT_CENTRO ?? '1')
    const esteId   = parseInt(process.env.CHATWOOT_ACCOUNT_ESTE   ?? '2')
    if (accountId === centroId) return 1
    if (accountId === esteId)   return 2
    return 1
}

export async function POST(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    try {
        const body = await req.json()
        const event: string = body.event ?? ''

        // Only process message and conversation events
        if (!['message_created', 'conversation_created', 'conversation_status_changed'].includes(event)) {
            return NextResponse.json({ ok: true })
        }

        const accountId: number = body.account?.id ?? body.account_id ?? 1
        const companyId = resolveCompanyId(accountId)

        const data = body.data ?? {}

        // Extract phone from conversation meta or sender
        const sender = data.meta?.sender ?? data.sender ?? {}
        const rawPhone: string =
            sender.phone_number ??
            data.meta?.sender?.phone_number ??
            ''

        if (!rawPhone && event !== 'conversation_status_changed') {
            return NextResponse.json({ ok: true })
        }

        const phone = rawPhone.replace(/\D/g, '')
        const normalizedPhone = normalizePhone(phone)
        const senderName: string = sender.name ?? sender.identifier ?? phone

        // Find or create client
        let clientId: string | null = null

        if (phone) {
            const { data: existing } = await supabase
                .from('clients')
                .select('id')
                .or(`whatsapp.eq.${phone},whatsapp.eq.${normalizedPhone},whatsapp.eq.+${phone},whatsapp.eq.${phone.replace(/^34/, '')}`)
                .eq('company_id', companyId)
                .limit(1)
                .maybeSingle()

            if (existing?.id) {
                clientId = existing.id
            } else {
                const { data: newClient } = await supabase
                    .from('clients')
                    .insert({
                        name: senderName || phone,
                        whatsapp: phone,
                        source: 'whatsapp',
                        status: 'new',
                        company_id: companyId,
                    })
                    .select('id')
                    .single()
                clientId = newClient?.id ?? null
            }
        }

        // For message_created: save the message
        if (event === 'message_created' && clientId) {
            const content: string = data.content ?? ''
            const messageId: string = String(data.id ?? '')
            const isOutbound: boolean = data.message_type === 1 // 1=outbound in Chatwoot

            if (!content) return NextResponse.json({ ok: true })

            // Check for duplicate
            if (messageId) {
                const { data: dup } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('wa_message_id', `chatwoot_${messageId}`)
                    .maybeSingle()
                if (dup?.id) return NextResponse.json({ ok: true })
            }

            await supabase.from('conversations').insert({
                client_id:     clientId,
                message:       content,
                direction:     isOutbound ? 'outbound' : 'inbound',
                status:        isOutbound ? 'sent' : 'received',
                wa_message_id: messageId ? `chatwoot_${messageId}` : null,
                phone,
                push_name:     senderName || null,
            })
        }

        // For conversation_created: update client status to 'new' if needed
        if (event === 'conversation_created' && clientId) {
            await supabase
                .from('clients')
                .update({ status: 'new' })
                .eq('id', clientId)
                .eq('status', 'new') // only if already new (no-op otherwise)
        }

        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error('[Chatwoot Webhook]', err)
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
}

// Chatwoot verifies webhook URLs with GET
export async function GET() {
    return NextResponse.json({ status: 'ok', service: 'Preventiva Chatwoot Webhook' })
}
