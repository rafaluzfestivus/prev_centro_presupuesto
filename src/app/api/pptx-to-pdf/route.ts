import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
    const secret = process.env.CONVERTAPI_SECRET
    if (!secret) {
        return NextResponse.json({ error: 'CONVERTAPI_SECRET não configurado' }, { status: 503 })
    }

    try {
        const pptxBuffer = await request.arrayBuffer()
        console.log('[pptx-to-pdf] PPTX recebido, tamanho:', pptxBuffer.byteLength, 'bytes')

        const form = new FormData()
        form.append(
            'File',
            new Blob([pptxBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            }),
            'presentation.pptx',
        )

        const res = await fetch(
            `https://v2.convertapi.com/convert/pptx/to/pdf?Secret=${secret}`,
            { method: 'POST', body: form },
        )

        if (!res.ok) {
            const err = await res.json().catch(() => ({ Message: res.statusText }))
            const msg = err.Message || err.message || `ConvertAPI error ${res.status}`
            console.error('[pptx-to-pdf] ConvertAPI falhou:', msg)
            return NextResponse.json({ error: msg }, { status: 500 })
        }

        const result = await res.json()
        const fileData: string | undefined = result.Files?.[0]?.FileData
        if (!fileData) throw new Error('ConvertAPI não devolveu PDF')

        const pdfBytes = Uint8Array.from(atob(fileData), c => c.charCodeAt(0))
        console.log('[pptx-to-pdf] PDF gerado, tamanho:', pdfBytes.length, 'bytes')

        return new Response(pdfBytes, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="presupuesto.pdf"',
            },
        })
    } catch (err: any) {
        console.error('[pptx-to-pdf] Erro:', err)
        return NextResponse.json({ error: err.message || 'Erro na conversão' }, { status: 500 })
    }
}
