/**
 * Appends a row to the Fechamentos Google Sheet when a sale is closed.
 *
 * Requires env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  — service account email
 *   GOOGLE_SERVICE_ACCOUNT_KEY    — private key (PEM), with \n literals or real newlines
 *
 * The service account must have Editor access to the spreadsheet.
 */

const SPREADSHEET_ID = '1ZbxC3OxwacQJ5OnJdOuRs6ecIZiO2zHi7GZoA_yRunc'
const SHEET_NAME = 'Página1'  // adjust if the tab has a different name
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'

// ── JWT helpers (no external deps) ───────────────────────────────────────────

function base64url(data: ArrayBuffer): string {
    return Buffer.from(data)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
}

async function signJwt(header: object, payload: object, pemKey: string): Promise<string> {
    const enc = (obj: object) => base64url(Buffer.from(JSON.stringify(obj)))
    const message = `${enc(header)}.${enc(payload)}`

    // Clean PEM key — env vars often store \n as literal backslash-n
    const pem = pemKey.replace(/\\n/g, '\n')
    const pemBody = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
    const keyBytes = Buffer.from(pemBody, 'base64')

    const key = await crypto.subtle.importKey(
        'pkcs8',
        keyBytes,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
    )
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, Buffer.from(message))
    return `${message}.${base64url(sig)}`
}

async function getAccessToken(): Promise<string> {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const key   = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

    if (!email || !key) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_KEY não configurados')
    }

    const now = Math.floor(Date.now() / 1000)
    const jwt = await signJwt(
        { alg: 'RS256', typ: 'JWT' },
        { iss: email, scope: SCOPES, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
        key,
    )

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Erro ao obter token Google: ${body}`)
    }

    const json = await res.json() as { access_token: string }
    return json.access_token
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ClosedSaleRow {
    date: Date       // installation date/time
    clientName: string
    valorCobrado: number  // base amount (without IVA)
    totalM2: number
}

export async function appendFechamentoRow(sale: ClosedSaleRow): Promise<void> {
    const token = await getAccessToken()

    const d = sale.date
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

    const instaladores = parseFloat((sale.totalM2 * 6).toFixed(2))
    const iva          = parseFloat((sale.valorCobrado * 0.21).toFixed(2))
    const saldo        = parseFloat((sale.valorCobrado - instaladores).toFixed(2))
    const valorConIva  = parseFloat((sale.valorCobrado + iva).toFixed(2))

    const row = [dateStr, timeStr, sale.clientName, sale.valorCobrado, sale.totalM2, instaladores, iva, saldo, valorConIva]

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Erro ao escrever no Google Sheets: ${body}`)
    }
}
