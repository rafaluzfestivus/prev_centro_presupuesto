import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(request: NextRequest) {
    const apiKey = process.env.CLOUDCONVERT_API_KEY
    if (!apiKey) {
        return NextResponse.json({ error: 'CLOUDCONVERT_API_KEY not configured' }, { status: 503 })
    }

    const pptxBuffer = await request.arrayBuffer()

    try {
        // 1. Create conversion job
        const jobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tasks: {
                    'upload-file': { operation: 'import/upload' },
                    'convert-file': {
                        operation: 'convert',
                        input: 'upload-file',
                        input_format: 'pptx',
                        output_format: 'pdf',
                    },
                    'export-file': {
                        operation: 'export/url',
                        input: 'convert-file',
                    },
                },
            }),
        })

        if (!jobRes.ok) {
            const err = await jobRes.text()
            throw new Error(`CloudConvert job creation failed: ${err}`)
        }

        const job = await jobRes.json()
        const jobId = job.data.id
        const uploadTask = job.data.tasks.find((t: any) => t.name === 'upload-file')

        // 2. Upload the PPTX file
        const form = new FormData()
        Object.entries(uploadTask.result.form.parameters as Record<string, string>).forEach(
            ([k, v]) => form.append(k, v)
        )
        form.append('file', new Blob([pptxBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }), 'presentation.pptx')

        const uploadRes = await fetch(uploadTask.result.form.url, { method: 'POST', body: form })
        if (!uploadRes.ok) throw new Error('Upload to CloudConvert failed')

        // 3. Poll until job is finished (max 55s)
        let pdfUrl: string | null = null
        for (let i = 0; i < 50; i++) {
            await new Promise(r => setTimeout(r, 1100))

            const statusRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            })
            const status = await statusRes.json()

            if (status.data.status === 'finished') {
                const exportTask = status.data.tasks.find((t: any) => t.name === 'export-file')
                pdfUrl = exportTask?.result?.files?.[0]?.url ?? null
                break
            }
            if (status.data.status === 'error') {
                throw new Error('CloudConvert conversion failed')
            }
        }

        if (!pdfUrl) throw new Error('Conversion timed out')

        // 4. Download PDF and return it
        const pdfRes = await fetch(pdfUrl)
        const pdfBytes = await pdfRes.arrayBuffer()

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
