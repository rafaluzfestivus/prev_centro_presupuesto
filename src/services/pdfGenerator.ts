import jsPDF from 'jspdf';
import { CONTACT } from '@/lib/constants';

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
}

// App color palette
const NAVY   = '#1e293b'
const ACCENT = '#EAB308'
const WHITE  = '#FFFFFF'
const LIGHT  = '#94a3b8'

function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return [r, g, b]
}

function buildDoc(): jsPDF {
    return new jsPDF({ orientation: 'landscape', unit: 'mm', format: [297, 167] })
}

function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, hex: string) {
    const [r, g, b] = hexToRgb(hex)
    doc.setFillColor(r, g, b)
    doc.rect(x, y, w, h, 'F')
}

function setColor(doc: jsPDF, hex: string) {
    const [r, g, b] = hexToRgb(hex)
    doc.setTextColor(r, g, b)
}

function buildPDF(data: ProposalData): jsPDF {
    const doc = buildDoc()
    const W = 297, H = 167

    // ─── PAGE 1: Cover ───────────────────────────────────────────────────────
    fillRect(doc, 0, 0, W, H, NAVY)

    // Accent left stripe
    fillRect(doc, 0, 0, 6, H, ACCENT)

    // Logo text (city-specific)
    setColor(doc, ACCENT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const brandName = data.city?.toLowerCase().includes('este') ? 'PREVENTIVA ESTE' : 'PREVENTIVA CENTRO'
    doc.text(brandName, 18, 28)

    // Divider
    const [ar, ag, ab] = hexToRgb(ACCENT)
    doc.setDrawColor(ar, ag, ab)
    doc.setLineWidth(0.4)
    doc.line(18, 31, 120, 31)

    // Tag
    setColor(doc, LIGHT)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Presupuesto Técnico de Instalación de Redes de Seguridad', 18, 38)

    // Client name
    setColor(doc, WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(32)
    const nameLines = doc.splitTextToSize(data.clientName || '—', 180) as string[]
    doc.text(nameLines, 18, 68)

    // City + date
    setColor(doc, ACCENT)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text(`${data.city || 'Madrid'}  ·  ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`, 18, 90)

    // Contact footer
    setColor(doc, LIGHT)
    doc.setFontSize(8)
    doc.text(`${CONTACT.EMAIL}  ·  ${CONTACT.MOBILE}  ·  ${CONTACT.PHONE}`, 18, H - 10)

    // ─── PAGE 2: Mediciones + Mockup ─────────────────────────────────────────
    doc.addPage([W, H])

    // Left half: white
    fillRect(doc, 0, 0, W / 2, H, WHITE)
    // Right half: navy
    fillRect(doc, W / 2, 0, W / 2, H, NAVY)

    // Left header bar
    fillRect(doc, 0, 0, W / 2, 14, NAVY)
    setColor(doc, ACCENT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('MEDICIONES CONFIRMADAS', 10, 9.5)

    // Items list
    let y = 24
    data.items.forEach((item, i) => {
        if (y > H - 12) return
        setColor(doc, NAVY)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(`${i + 1}. ${item.name}`, 10, y)

        setColor(doc, LIGHT.replace('#', '') === LIGHT ? LIGHT : LIGHT)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        setColor(doc, '#475569')
        doc.text(`${Number(item.width).toFixed(2)}m × ${Number(item.height).toFixed(2)}m = ${Number(item.area).toFixed(2)} m²`, 14, y + 5)
        y += 14
    })

    // Right header bar
    fillRect(doc, W / 2, 0, W / 2, 14, '#0f172a')
    setColor(doc, ACCENT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('PLANO DE LA INSTALACIÓN', W / 2 + 8, 9.5)

    // Mockup
    setColor(doc, ACCENT)
    doc.setFont('courier', 'normal')
    doc.setFontSize(6.5)
    const mockupLines = doc.splitTextToSize(data.mockup || '(sin mockup)', W / 2 - 16) as string[]
    doc.text(mockupLines.slice(0, 28), W / 2 + 8, 20)

    // ─── PAGE 3: Presupuesto ─────────────────────────────────────────────────
    doc.addPage([W, H])
    fillRect(doc, 0, 0, W, H, NAVY)
    fillRect(doc, 0, 0, 6, H, ACCENT)

    // Header
    setColor(doc, ACCENT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('DETALLE DEL PRESUPUESTO', 18, 18)
    doc.setDrawColor(ar, ag, ab)
    doc.setLineWidth(0.3)
    doc.line(18, 21, W - 18, 21)

    // Items table
    y = 30
    data.items.forEach((item) => {
        if (y > H - 35) return
        setColor(doc, WHITE)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(item.name, 18, y)

        setColor(doc, LIGHT)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(`${Number(item.width).toFixed(2)}×${Number(item.height).toFixed(2)}m · ${Number(item.area).toFixed(2)}m²`, 18, y + 5)

        setColor(doc, ACCENT)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(`€ ${Number(item.price).toFixed(2)}`, W - 30, y, { align: 'right' })
        y += 14
    })

    // Total box
    fillRect(doc, 16, H - 42, W - 32, 26, '#0f172a')
    setColor(doc, LIGHT)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('INVERSIÓN TOTAL + IVA', 26, H - 30)
    setColor(doc, ACCENT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text(`€ ${data.total.toFixed(2)}`, W - 26, H - 25, { align: 'right' })

    // Footer
    setColor(doc, LIGHT)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`${CONTACT.EMAIL}  ·  ${CONTACT.MOBILE}  ·  ${CONTACT.PHONE}`, 18, H - 6)

    return doc
}

export const generateProposalPDF = async (data: ProposalData): Promise<void> => {
    const doc = buildPDF(data)
    const safeName = (data.clientName || 'cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase()
    doc.save(`Preventiva_Presupuesto_${safeName}.pdf`)
}

export const generateProposalBlob = async (data: ProposalData): Promise<Blob | null> => {
    try {
        const doc = buildPDF(data)
        return doc.output('blob')
    } catch (err) {
        console.error('Error generating PDF blob:', err)
        return null
    }
}
