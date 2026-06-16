import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const runtime = 'nodejs'

async function convertWithConvertAPI(pptxBuffer: ArrayBuffer, token: string): Promise<Uint8Array> {
    const form = new FormData()
    form.append(
        'File',
        new Blob([pptxBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }),
        'presentation.pptx',
    )
    const res = await fetch(
        'https://v2.convertapi.com/convert/pptx/to/pdf',
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
        },
    )
    if (!res.ok) {
        const err = await res.json().catch(() => ({ Message: res.statusText }))
        throw new Error(err.Message || err.message || `ConvertAPI error ${res.status}`)
    }
    const result = await res.json()
    const fileData: string | undefined = result.Files?.[0]?.FileData
    if (!fileData) throw new Error('ConvertAPI não devolveu PDF')
    return Uint8Array.from(atob(fileData), c => c.charCodeAt(0))
}

async function getGoogleToken(): Promise<string> {
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado')
    const sa = JSON.parse(json)
    const now = Math.floor(Date.now() / 1000)
    const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url')
    const header  = b64url({ alg: 'RS256', typ: 'JWT' })
    const payload = b64url({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })
    const signingInput = `${header}.${payload}`
    const pem = (sa.private_key as string).replace(/\\n/g, '\n').trim()
    const pemBody = pem.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s+/g, '')
    const cryptoKey = await crypto.subtle.importKey('pkcs8', Buffer.from(pemBody, 'base64'), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
    const sigBytes = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, Buffer.from(signingInput))
    const jwt = `${signingInput}.${Buffer.from(sigBytes).toString('base64url')}`
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) throw new Error(`Google auth falhou: ${JSON.stringify(tokenData)}`)
    return tokenData.access_token
}

async function convertWithGoogleDrive(pptxBuffer: ArrayBuffer): Promise<Uint8Array> {
    const token = await getGoogleToken()
    const boundary = 'pptxboundary'
    const meta = JSON.stringify({ name: 'presupuesto_temp.pptx', mimeType: 'application/vnd.google-apps.presentation' })
    const enc = new TextEncoder()
    const parts = [
        enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
        enc.encode(`--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n`),
        new Uint8Array(pptxBuffer),
        enc.encode(`\r\n--${boundary}--`),
    ]
    const totalLen = parts.reduce((s, p) => s + p.length, 0)
    const body = new Uint8Array(totalLen)
    let off = 0; for (const p of parts) { body.set(p, off); off += p.length }

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
    })
    if (!uploadRes.ok) throw new Error(`Google Drive upload falhou: ${uploadRes.status}`)
    const { id: fileId } = await uploadRes.json()

    try {
        const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!exportRes.ok) {
            const errText = await exportRes.text()
            throw new Error(`Google Drive export falhou: ${exportRes.status} ${errText.slice(0, 200)}`)
        }
        return new Uint8Array(await exportRes.arrayBuffer())
    } finally {
        fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
}

export async function POST(request: NextRequest) {
    try {
        const pptxBuffer = await request.arrayBuffer()
        console.log('[pptx-to-pdf] PPTX recebido, tamanho:', pptxBuffer.byteLength, 'bytes')

        // Primary: ConvertAPI (LibreOffice, faithful conversion)
        const convertApiSecret = process.env.CONVERTAPI_SECRET
        if (convertApiSecret) {
            try {
                const pdfBytes = await convertWithConvertAPI(pptxBuffer, convertApiSecret)
                console.log('[pptx-to-pdf] PDF via ConvertAPI, tamanho:', pdfBytes.length, 'bytes')
                return new Response(Buffer.from(pdfBytes), {
                    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="presupuesto.pdf"' },
                })
            } catch (e: any) {
                console.error('[pptx-to-pdf] ConvertAPI falhou, tentando Google Drive:', e.message)
            }
        }

        // Fallback: Google Drive API
        try {
            const pdfBytes = await convertWithGoogleDrive(pptxBuffer)
            console.log('[pptx-to-pdf] PDF via Google Drive, tamanho:', pdfBytes.length, 'bytes')
            return new Response(Buffer.from(pdfBytes), {
                headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="presupuesto.pdf"' },
            })
        } catch (e: any) {
            console.error('[pptx-to-pdf] Google Drive falhou:', e.message)
            const noCreds = !convertApiSecret && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON
            return NextResponse.json({
                error: 'PDF_NOT_CONFIGURED',
                message: noCreds
                    ? 'Para generar PDF añade la variable CONVERTAPI_SECRET en Vercel (Settings → Environment Variables). Registro gratuito en convertapi.com.'
                    : `Error en la conversión: ${e.message}`,
            }, { status: 503 })
        }
    } catch (err: any) {
        console.error('[pptx-to-pdf] Erro:', err)
        return NextResponse.json({ error: err.message || 'Erro na conversão' }, { status: 500 })
    }
}
