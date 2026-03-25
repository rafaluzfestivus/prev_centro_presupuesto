/**
 * Evolution API client
 * Docs: https://doc.evolution-api.com
 *
 * Required env vars:
 *   EVOLUTION_API_URL      = https://evolution.seuservidor.com
 *   EVOLUTION_API_KEY      = sua-api-key-global
 *   EVOLUTION_INSTANCE     = preventiva  (nome da instância)
 */

const BASE_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
const API_KEY  = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'preventiva'

function headers() {
    return {
        'Content-Type': 'application/json',
        apikey: API_KEY,
    }
}

/** Normaliza número para formato Evolution API (só dígitos, com DDI) */
export function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    // Se começa com 34 (Espanha) ou 55 (Brasil), já está certo
    if (digits.startsWith('34') || digits.startsWith('55')) return digits
    // Default: assume Espanha (34)
    return `34${digits}`
}

export async function sendTextMessage(phone: string, text: string): Promise<{ messageId: string }> {
    const number = normalizePhone(phone)
    const url = `${BASE_URL}/message/sendText/${INSTANCE}`

    const res = await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ number, text }),
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Evolution API error ${res.status}: ${body}`)
    }

    const data = await res.json()
    // Evolution API retorna { key: { id: '...' }, ... }
    return { messageId: data?.key?.id ?? data?.id ?? '' }
}

export async function getInstanceStatus(): Promise<{ connected: boolean; qrcode?: string }> {
    try {
        const res = await fetch(`${BASE_URL}/instance/connectionState/${INSTANCE}`, {
            headers: headers(),
        })
        if (!res.ok) return { connected: false }
        const data = await res.json()
        const state = data?.instance?.state ?? data?.state ?? ''
        return { connected: state === 'open' }
    } catch {
        return { connected: false }
    }
}

export async function getQRCode(): Promise<{ qrcode: string | null }> {
    try {
        const res = await fetch(`${BASE_URL}/instance/connect/${INSTANCE}`, {
            headers: headers(),
        })
        if (!res.ok) return { qrcode: null }
        const data = await res.json()
        return { qrcode: data?.qrcode?.base64 ?? data?.base64 ?? null }
    } catch {
        return { qrcode: null }
    }
}
