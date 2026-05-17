import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

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
        console.error('[pptx-to-pdf]', err)
        return NextResponse.json({ error: err.message || 'Conversion error' }, { status: 500 })
    }
}
