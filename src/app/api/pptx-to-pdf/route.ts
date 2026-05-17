import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const runtime = 'nodejs'

async function getGoogleAccessToken(): Promise<string> {
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado')

    let sa: any
    try {
        sa = JSON.parse(json)
    } catch {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON é JSON inválido')
    }

    if (!sa.client_email) throw new Error('Service account sem campo client_email')
    if (!sa.private_key)  throw new Error('Service account sem campo private_key')

    const now = Math.floor(Date.now() / 1000)

    const b64url = (obj: object) =>
        Buffer.from(JSON.stringify(obj)).toString('base64url')

    const header  = b64url({ alg: 'RS256', typ: 'JWT' })
    const payload = b64url({
        iss:   sa.client_email,
        scope: 'https://www.googleapis.com/auth/drive',
        aud:   'https://oauth2.googleapis.com/token',
        exp:   now + 3600,
        iat:   now,
    })
    const signingInput = `${header}.${payload}`

    // Normalise PEM — handle both literal \n and real newlines
    const pem = (sa.private_key as string).replace(/\\n/g, '\n').trim()
    const pemBody = pem
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s+/g, '')

    const keyBytes = Buffer.from(pemBody, 'base64')

    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        keyBytes,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
    )

    const sigBytes = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        Buffer.from(signingInput),
    )
    const sigB64url = Buffer.from(sigBytes).toString('base64url')

    const jwt = `${signingInput}.${sigB64url}`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
        throw new Error(`Google OAuth falhou: ${JSON.stringify(tokenData)}`)
    }
    return tokenData.access_token
}

export async function POST(request: NextRequest) {
    try {
        const pptxBuffer = await request.arrayBuffer()
        console.log('[pptx-to-pdf] PPTX recebido, tamanho:', pptxBuffer.byteLength, 'bytes')

        let token: string
        try {
            token = await getGoogleAccessToken()
            console.log('[pptx-to-pdf] Token Google obtido com sucesso')
        } catch (e: any) {
            console.error('[pptx-to-pdf] Falha ao obter token:', e.message)
            return NextResponse.json({ error: `Auth falhou: ${e.message}` }, { status: 500 })
        }

        // 1. Upload PPTX → Google Drive (converte para Slides automaticamente)
        const boundary = 'pptxboundary'
        const meta = JSON.stringify({
            name: 'presupuesto.pptx',
            mimeType: 'application/vnd.google-apps.presentation',
        })

        const enc = new TextEncoder()
        const sep = `--${boundary}\r\n`
        const end = `\r\n--${boundary}--`

        const part1 = enc.encode(`${sep}Content-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`)
        const part2 = enc.encode(`${sep}Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n`)
        const part3 = new Uint8Array(pptxBuffer)
        const part4 = enc.encode(end)

        const totalLen = part1.length + part2.length + part3.length + part4.length
        const body = new Uint8Array(totalLen)
        let offset = 0
        for (const p of [part1, part2, part3, part4]) {
            body.set(p, offset)
            offset += p.length
        }

        const uploadRes = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`,
                },
                body,
            },
        )

        if (!uploadRes.ok) {
            const errText = await uploadRes.text()
            console.error('[pptx-to-pdf] Upload Drive falhou:', uploadRes.status, errText)
            return NextResponse.json(
                { error: `Upload Drive falhou (${uploadRes.status}): ${errText}` },
                { status: 500 },
            )
        }

        const uploadData = await uploadRes.json()
        const fileId = uploadData.id
        console.log('[pptx-to-pdf] Ficheiro enviado para Drive, id:', fileId)

        try {
            // 2. Exportar como PDF
            const exportRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`,
                { headers: { Authorization: `Bearer ${token}` } },
            )

            if (!exportRes.ok) {
                const errText = await exportRes.text()
                console.error('[pptx-to-pdf] Export PDF falhou:', exportRes.status, errText)
                return NextResponse.json(
                    { error: `Export PDF falhou (${exportRes.status}): ${errText}` },
                    { status: 500 },
                )
            }

            const pdf = await exportRes.arrayBuffer()
            console.log('[pptx-to-pdf] PDF gerado com sucesso, tamanho:', pdf.byteLength, 'bytes')

            return new Response(pdf, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'attachment; filename="presupuesto.pdf"',
                },
            })
        } finally {
            // 3. Apagar ficheiro temporário do Drive
            fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {})
        }
export async function POST(request: NextRequest) {
    const secret = process.env.CONVERTAPI_SECRET
    if (!secret) {
        return NextResponse.json({ error: 'CONVERTAPI_SECRET not configured' }, { status: 503 })
    }

    try {
        const pptxBuffer = await request.arrayBuffer()

        const form = new FormData()
        form.append('File', new Blob([pptxBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }), 'presentation.pptx')

        const res = await fetch(`https://v2.convertapi.com/convert/pptx/to/pdf?Secret=${secret}`, {
            method: 'POST',
            body: form,
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({ Message: res.statusText }))
            throw new Error(err.Message || err.message || `ConvertAPI error ${res.status}`)
        }

        const result = await res.json()
        const fileData: string | undefined = result.Files?.[0]?.FileData
        if (!fileData) throw new Error('No PDF returned by ConvertAPI')

        const pdfBytes = Uint8Array.from(atob(fileData), c => c.charCodeAt(0))

        return new Response(pdfBytes, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="presupuesto.pdf"',
            },
        })
    } catch (err: any) {
        console.error('[pptx-to-pdf] Erro inesperado:', err)
        return NextResponse.json({ error: err.message || 'Erro na conversão' }, { status: 500 })
    }
}
