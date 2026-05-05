import jsPDF from 'jspdf';
import JSZip from 'jszip';
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

// ── PPTX colors ───────────────────────────────────────────────────────────────
const WINE      = '#4D2A36'   // main background (from PPTX bg)
const WINE_MID  = '#6B3A4A'   // right-panel / secondary
const WINE_DARK = '#3D1F2B'   // darkest panel
const YELLOW    = '#EAB308'   // accent gold
const WHITE     = '#FFFFFF'
const WHITE_SOFT = '#F3F4F6'
const LIGHT     = '#c9a0ae'   // muted wine-tinted text

function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return [r, g, b]
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

function setDraw(doc: jsPDF, hex: string) {
    const [r, g, b] = hexToRgb(hex)
    doc.setDrawColor(r, g, b)
}

// ── Extract logo from PPTX template ──────────────────────────────────────────
async function loadLogoBase64(): Promise<string | null> {
    try {
        const res = await fetch('/assets/presupuesto_preventiva.pptx')
        if (!res.ok) return null
        const buf = await res.arrayBuffer()
        const zip = await JSZip.loadAsync(buf)
        const logoFile = zip.file('ppt/media/image1.png')
        if (!logoFile) return null
        const b64 = await logoFile.async('base64')
        return `data:image/png;base64,${b64}`
    } catch {
        return null
    }
}

// ── PDF builder ───────────────────────────────────────────────────────────────
async function buildPDF(data: ProposalData): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [297, 167] })
    const W = 297, H = 167
    const MID = W / 2   // 148.5

    const logoB64 = await loadLogoBase64()
    const brandName = data.city?.toLowerCase().includes('este') ? 'PREVENTIVA ESTE' : 'PREVENTIVA CENTRO'

    // ── PAGE 1: Cover ─────────────────────────────────────────────────────────
    fillRect(doc, 0, 0, W, H, WINE)

    // Yellow top strip
    fillRect(doc, 0, 0, W, 3, YELLOW)

    // Right panel (darker)
    fillRect(doc, MID, 3, MID, H - 3, WINE_MID)

    // ── Left side content ──
    const LX = 14  // left margin

    // Logo image
    if (logoB64) {
        const logoH = 32, logoW = 44
        const logoX = MID / 2 - logoW / 2  // centered on left half
        doc.addImage(logoB64, 'PNG', logoX, 12, logoW, logoH)
    } else {
        // Fallback text logo
        setColor(doc, YELLOW)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(brandName, LX, 30)
        setColor(doc, WHITE_SOFT)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text('REDES DE PROTECCIÓN', LX, 36)
    }

    // "Tu hogar, protegido."
    setColor(doc, WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('Tu hogar, protegido.', LX, 62)

    // Subtext
    setColor(doc, WHITE_SOFT)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text('Hemos preparado esta propuesta', LX, 72)
    doc.text('especialmente para ti.', LX, 78)

    // Client name
    setColor(doc, YELLOW)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    const nameLines = doc.splitTextToSize(data.clientName || '—', MID - LX - 8) as string[]
    doc.text(nameLines, LX, 100)

    // "Propuesta Personalizada" button
    const btnY = 128, btnH = 11, btnW = 70
    const [yr, yg, yb] = hexToRgb(YELLOW)
    doc.setFillColor(yr, yg, yb)
    doc.roundedRect(LX, btnY, btnW, btnH, 3, 3, 'F')
    setColor(doc, WINE_DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Propuesta Personalizada', LX + btnW / 2, btnY + 7.2, { align: 'center' })

    // ── Right side content ──
    const RX = MID + 10

    setColor(doc, WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Redes de Protección', RX, 60)
    doc.text('para tu Hogar', RX, 74)

    // Decorative grid on right side
    setDraw(doc, WINE_DARK)
    doc.setLineWidth(0.3)
    for (let gx = MID + 5; gx < W - 5; gx += 16) {
        doc.line(gx, 8, gx, H - 5)
    }
    for (let gy = 8; gy < H - 5; gy += 20) {
        doc.line(MID + 5, gy, W - 5, gy)
    }

    // ── PAGE 2: Measurements + Mockup ─────────────────────────────────────────
    doc.addPage([W, H])

    // Left = wine
    fillRect(doc, 0, 0, MID, H, WINE)
    // Right = wine_dark
    fillRect(doc, MID, 0, MID, H, WINE_DARK)

    // Yellow top strip
    fillRect(doc, 0, 0, W, 3, YELLOW)

    // Left header
    fillRect(doc, 0, 3, MID, 14, WINE_DARK)
    setColor(doc, YELLOW)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('MEDICIONES CONFIRMADAS', 10, 13)

    // Items list
    let y = 26
    data.items.forEach((item, i) => {
        if (y > H - 12) return
        setColor(doc, WHITE)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(`${i + 1}. ${item.name}`, 10, y)
        setColor(doc, LIGHT)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(`${Number(item.width).toFixed(2)}m × ${Number(item.height).toFixed(2)}m = ${Number(item.area).toFixed(2)} m²`, 14, y + 5)
        y += 14
    })

    // Right header
    fillRect(doc, MID, 3, MID, 14, '#2a1218')
    setColor(doc, YELLOW)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('PLANO DE LA INSTALACIÓN', MID + 8, 13)

    // Mockup
    setColor(doc, YELLOW)
    doc.setFont('courier', 'normal')
    doc.setFontSize(6.5)
    const mockupLines = doc.splitTextToSize(data.mockup || '(sin mockup)', MID - 16) as string[]
    doc.text(mockupLines.slice(0, 28), MID + 8, 22)

    // ── PAGE 3: Budget detail ─────────────────────────────────────────────────
    doc.addPage([W, H])
    fillRect(doc, 0, 0, W, H, WINE)
    fillRect(doc, 0, 0, W, 3, YELLOW)

    setColor(doc, YELLOW)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('DETALLE DEL PRESUPUESTO', 18, 18)
    setDraw(doc, YELLOW)
    doc.setLineWidth(0.3)
    doc.line(18, 21, W - 18, 21)

    y = 30
    data.items.forEach((item) => {
        if (y > H - 38) return
        setColor(doc, WHITE)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(item.name, 18, y)
        setColor(doc, LIGHT)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(`${Number(item.width).toFixed(2)}×${Number(item.height).toFixed(2)}m · ${Number(item.area).toFixed(2)}m²`, 18, y + 5)
        setColor(doc, YELLOW)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(`€ ${Number(item.price).toFixed(2)}`, W - 30, y, { align: 'right' })
        y += 14
    })

    // Total box
    fillRect(doc, 16, H - 42, W - 32, 26, WINE_DARK)
    setColor(doc, LIGHT)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('INVERSIÓN TOTAL + IVA', 26, H - 30)
    setColor(doc, YELLOW)
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
    const doc = await buildPDF(data)
    const safeName = (data.clientName || 'cliente').replace(/[^a-z0-9]/gi, '_').toLowerCase()
    doc.save(`Preventiva_Presupuesto_${safeName}.pdf`)
}

export const generateProposalBlob = async (data: ProposalData): Promise<Blob | null> => {
    try {
        const doc = await buildPDF(data)
        return doc.output('blob')
    } catch (err) {
        console.error('Error generating PDF blob:', err)
        return null
    }
}
