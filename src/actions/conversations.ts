'use server'

import { createClient } from '@/lib/supabase/server'
import { sendTextMessage } from '@/lib/evolution'

export interface ConversationContact {
    clientId: string
    name: string
    phone: string
    lastMessage: string
    lastMessageAt: string
    lastDirection: 'inbound' | 'outbound'
    unread: number
}

export interface Message {
    id: string
    message: string
    direction: 'inbound' | 'outbound'
    status: string
    createdAt: string
    mediaUrl: string | null
    mediaType: string | null
    pushName: string | null
}

/** Lista de contatos com a última mensagem (painel esquerdo) */
export async function getContactsWithLastMessageAction(): Promise<{ success: boolean; data?: ConversationContact[]; error?: string }> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('conversations')
        .select(`
            id, message, direction, created_at, phone,
            clients ( id, name, whatsapp )
        `)
        .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    // Agrupar por cliente e pegar só a última mensagem
    const map = new Map<string, ConversationContact>()
    for (const row of (data ?? [])) {
        const client = row.clients as { id: string; name: string; whatsapp: string } | null
        const clientId = client?.id ?? row.phone ?? 'unknown'
        if (map.has(clientId)) continue // já tem a última (está ordenado desc)

        map.set(clientId, {
            clientId,
            name: (client?.name ?? row.phone) ?? '?',
            phone: (client?.whatsapp ?? row.phone) ?? '',
            lastMessage: row.message ?? '',
            lastMessageAt: row.created_at,
            lastDirection: row.direction as 'inbound' | 'outbound',
            unread: 0,
        })
    }

    // Contar não lidos (inbound sem status 'read')
    const { data: unreadData } = await supabase
        .from('conversations')
        .select('client_id, phone')
        .eq('direction', 'inbound')
        .neq('status', 'read')

    for (const row of (unreadData ?? [])) {
        const key = row.client_id ?? row.phone
        if (key && map.has(key)) {
            const contact = map.get(key)!
            contact.unread += 1
        }
    }

    return { success: true, data: Array.from(map.values()) }
}

/** Mensagens de um cliente específico */
export async function getClientMessagesAction(clientId: string): Promise<{ success: boolean; data?: Message[]; error?: string }> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('conversations')
        .select('id, message, direction, status, created_at, media_url, media_type, push_name')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true })

    if (error) return { success: false, error: error.message }

    // Marcar como lidas
    await supabase
        .from('conversations')
        .update({ status: 'read' })
        .eq('client_id', clientId)
        .eq('direction', 'inbound')
        .neq('status', 'read')

    const messages: Message[] = (data ?? []).map(m => ({
        id: m.id,
        message: m.message ?? '',
        direction: m.direction as 'inbound' | 'outbound',
        status: m.status ?? 'received',
        createdAt: m.created_at,
        mediaUrl: m.media_url ?? null,
        mediaType: m.media_type ?? null,
        pushName: m.push_name ?? null,
    }))

    return { success: true, data: messages }
}

/** Envia mensagem para o cliente via Evolution API e salva no banco */
export async function sendMessageAction(clientId: string, phone: string, text: string): Promise<{ success: boolean; error?: string }> {
    if (!text.trim()) return { success: false, error: 'Mensagem vazia' }

    const supabase = await createClient()

    try {
        const { messageId } = await sendTextMessage(phone, text)

        await supabase.from('conversations').insert({
            client_id:     clientId,
            message:       text,
            direction:     'outbound',
            status:        'sent',
            wa_message_id: messageId,
            phone,
        })

        return { success: true }
    } catch (err) {
        console.error('[sendMessageAction]', err)
        const msg = err instanceof Error ? err.message : 'Erro ao enviar mensagem'
        return { success: false, error: msg }
    }
}
