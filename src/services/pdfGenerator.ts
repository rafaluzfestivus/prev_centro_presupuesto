import { generateProposalPPTX, ProposalDataPPTX } from './pptxGenerator'

export interface ProposalItem {
    name: string;
    width: number;
    height: number;
    area: number;
    price: number;
    price_rule?: string;
}

export interface ProposalData {
    clientName: string;
    city: string;
    items: ProposalItem[];
    total: number;
    mockup: string;
    imageUrl?: string;
    whatsapp?: string;
}

/** Generate PPTX then convert to PDF via /api/pptx-to-pdf (Google Drive). */
export const generateProposalBlob = async (data: ProposalData): Promise<Blob> => {
    // 1. Generate the PPTX
    const pptxBlob = await generateProposalPPTX(data as ProposalDataPPTX)
    if (!pptxBlob) throw new Error('Falha ao gerar o arquivo PPTX')

    // 2. Send to conversion API
    const res = await fetch('/api/pptx-to-pdf', {
        method: 'POST',
        body: pptxBlob,
        headers: { 'Content-Type': 'application/octet-stream' },
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || 'Conversion failed')
    }

    return await res.blob()
}

/** Generate PDF and trigger browser download. */
export const generateProposalPDF = async (data: ProposalData): Promise<void> => {
    const blob = await generateProposalBlob(data)

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safe = (data.clientName || 'cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase()
    a.download = `Preventiva_Presupuesto_${safe}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
