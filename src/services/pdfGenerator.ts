import { generateDirectPDF } from './pdfDirectGenerator'

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

/** Generate PDF blob directly (no PPTX intermediate). */
export const generateProposalBlob = async (data: ProposalData): Promise<Blob> => {
    return generateDirectPDF(data)
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
