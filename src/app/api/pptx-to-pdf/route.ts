import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

/** Build a signed JWT and exchange it for a Google OAuth2 access token. */
async function getGoogleAccessToken(): Promise<string> {
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured')

    const sa = JSON.parse(json)
    const now = Math.floor(Date.now() / 1000)

    const b64url = (obj: object) =>
        btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

    const signingInput = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
        iss:   sa.client_email,
        scope: 'https://www.googleapis.com/auth/drive',
        aud:   'https://oauth2.googleapis.com/token',
        exp:   now + 3600,
        iat:   now,
    })}`

    const pem = (sa.private_key as string).replace(/\\n/g, '\n')
    const pemBody = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\n/g, '')
    const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8', keyBytes.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign'],
    )
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${signingInput}.${sigB64}`,
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) throw new Error(`Google token error: ${JSON.stringify(tokenData)}`)
    return tokenData.access_token
}

export async function POST(request: NextRequest) {
    try {
        const pptxBuffer = await request.arrayBuffer()
        const token = await getGoogleAccessToken()

        // 1. Upload PPTX — Google Drive converts to Slides format automatically
        const boundary = 'pptx_boundary_x7k2'
        const meta = JSON.stringify({
            name: 'presupuesto.pptx',
            mimeType: 'application/vnd.google-apps.presentation',
        })
        const enc = new TextEncoder()
        const parts = [
            enc.encode(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n`),
            enc.encode(`--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n`),
            new Uint8Array(pptxBuffer),
            enc.encode(`\r\n--${boundary}--`),
        ]
        const body = new Uint8Array(parts.reduce((acc, p) => acc + p.length, 0))
        let offset = 0
        for (const p of parts) { body.set(p, offset); offset += p.length }

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body,
        })
        if (!uploadRes.ok) throw new Error(`Drive upload failed: ${await uploadRes.text()}`)
        const { id: fileId } = await uploadRes.json()

        try {
            // 2. Export the Google Slides file as PDF
            const exportRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`,
                { headers: { Authorization: `Bearer ${token}` } },
            )
            if (!exportRes.ok) throw new Error(`Drive export failed: ${await exportRes.text()}`)

            const pdf = await exportRes.arrayBuffer()
            return new Response(pdf, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'attachment; filename="presupuesto.pdf"',
                },
            })
        } finally {
            // 3. Delete temporary file from Drive
            fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {})
        }
    } catch (err: any) {
        console.error('[pptx-to-pdf]', err)
        return NextResponse.json({ error: err.message || 'Conversion error' }, { status: 500 })
    }
}
