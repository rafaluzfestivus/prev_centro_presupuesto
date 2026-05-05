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

// ── Colors (matching PPTX exactly) ───────────────────────────────────────────
const WINE      = '#4D2A36'
const WINE_MID  = '#6B3A4A'
const WINE_DARK = '#3D1F2B'
const YELLOW    = '#EAB308'
const WHITE     = '#FFFFFF'
const WHITE_SOFT = '#F3F4F6'
const LIGHT     = '#c9a0ae'

function hexToRgb(hex: string): [number, number, number] {
    return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}
function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, hex: string) {
    const [r,g,b] = hexToRgb(hex); doc.setFillColor(r,g,b); doc.rect(x,y,w,h,'F')
}
function setColor(doc: jsPDF, hex: string) {
    const [r,g,b] = hexToRgb(hex); doc.setTextColor(r,g,b)
}
function setDraw(doc: jsPDF, hex: string) {
    const [r,g,b] = hexToRgb(hex); doc.setDrawColor(r,g,b)
}

// ── Image loaders ─────────────────────────────────────────────────────────────

async function fetchAsBase64(path: string): Promise<string | null> {
    try {
        const r = await fetch(path)
        if (!r.ok) return null
        const buf = await r.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let b64 = ''
        // chunk to avoid call stack overflow on large files
        for (let i = 0; i < bytes.length; i += 8192) {
            b64 += String.fromCharCode(...bytes.subarray(i, i + 8192))
        }
        const ext = path.split('.').pop()?.toLowerCase() || 'png'
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
        return `data:${mime};base64,${btoa(b64)}`
    } catch { return null }
}

/** Load static slide — tries slide{n}.png / slide{n}.jpg */
async function loadStaticSlide(n: number): Promise<string | null> {
    return (
        await fetchAsBase64(`/assets/pdf/slide${n}.png`) ||
        await fetchAsBase64(`/assets/pdf/slide${n}.jpg`)
    )
}

/** Extract logo from the PPTX template */
async function loadLogoBase64(city: string): Promise<string | null> {
    // Try static PNG asset first
    const key = city?.toLowerCase().includes('este') ? 'este' : 'centro'
    const fromFile = await fetchAsBase64(`/assets/logo_preventiva_${key}.png`)
    if (fromFile) return fromFile

    // Fallback: extract from PPTX
    const pptxPaths = [
        `/assets/presupuesto_preventiva_${key}.pptx`,
        '/assets/presupuesto_preventiva.pptx',
    ]
    for (const path of pptxPaths) {
        try {
            const res = await fetch(path)
            if (!res.ok) continue
            const zip = await JSZip.loadAsync(await res.arrayBuffer())
            const f = zip.file('ppt/media/image1.png')
            if (!f) continue
            const b64 = await f.async('base64')
            return `data:image/png;base64,${b64}`
        } catch { /* try next */ }
    }
    return null
}

// ── Page generators ───────────────────────────────────────────────────────────

function addFullPageImage(doc: jsPDF, W: number, H: number, imgData: string, fmt: 'PNG'|'JPEG' = 'PNG') {
    doc.addPage([W, H])
    doc.addImage(imgData, fmt, 0, 0, W, H)
}

function buildCoverPage(doc: jsPDF, W: number, H: number, data: ProposalData, logoB64: string | null) {
    fillRect(doc, 0, 0, W, H, WINE)
    fillRect(doc, 0, 0, W, 3, YELLOW)                // yellow top strip
    fillRect(doc, W/2, 3, W/2, H-3, WINE_MID)        // right panel

    // Logo
    if (logoB64) {
        const lw = 46, lh = 33
        doc.addImage(logoB64, 'PNG', W/4 - lw/2, 10, lw, lh)
    }

    // "Tu hogar, protegido."
    setColor(doc, WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('Tu hogar, protegido.', 14, 62)

    // Subtext
    setColor(doc, WHITE_SOFT)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text('Hemos preparado esta propuesta', 14, 72)
    doc.text('especialmente para ti.', 14, 78)

    // Client name
    setColor(doc, YELLOW)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    const nameLines = doc.splitTextToSize(data.clientName || '—', W/2 - 20) as string[]
    doc.text(nameLines, 14, 100)

    // "Propuesta Personalizada" button
    const [yr,yg,yb] = hexToRgb(YELLOW)
    doc.setFillColor(yr,yg,yb)
    doc.roundedRect(14, 128, 72, 11, 3, 3, 'F')
    setColor(doc, WINE_DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Propuesta Personalizada', 50, 135.2, { align: 'center' })

    // Right side text
    setColor(doc, WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Redes de Protección', W/2 + 10, 60)
    doc.text('para tu Hogar', W/2 + 10, 74)

    // Decorative grid lines on right
    setDraw(doc, WINE_DARK)
    doc.setLineWidth(0.3)
    for (let gx = W/2+6; gx < W-6; gx += 18) doc.line(gx, 8, gx, H-6)
    for (let gy = 8; gy < H-6; gy += 22) doc.line(W/2+6, gy, W-6, gy)
}

function buildMeasurementsPage(doc: jsPDF, W: number, H: number, data: ProposalData) {
    doc.addPage([W, H])
    fillRect(doc, 0, 0, W/2, H, WINE)
    fillRect(doc, W/2, 0, W/2, H, WINE_DARK)
    fillRect(doc, 0, 0, W, 3, YELLOW)

    // Left header
    fillRect(doc, 0, 3, W/2, 14, WINE_DARK)
    setColor(doc, YELLOW); doc.setFont('helvetica','bold'); doc.setFontSize(8)
    doc.text('TU PROYECTO', 10, 11)
    setColor(doc, WHITE); doc.setFontSize(13)
    doc.text('Hemos revisado tu caso.', 10, 24)

    // Section label
    setColor(doc, YELLOW); doc.setFont('helvetica','bold'); doc.setFontSize(7)
    doc.text('SUPERFICIE A PROTEGER', 14, 38)

    // Items list
    let y = 46
    data.items.forEach((item) => {
        if (y > H - 8) return
        setColor(doc, WHITE); doc.setFont('helvetica','bold'); doc.setFontSize(8.5)
        doc.text(
            `• ${item.name}: ${Number(item.width).toFixed(2)}x${Number(item.height).toFixed(2)}m (${Number(item.area).toFixed(2)}m²)`,
            14, y
        )
        y += 11
    })

    // Right: mockup
    fillRect(doc, W/2, 3, W/2, 14, '#2a1218')
    setColor(doc, YELLOW); doc.setFont('helvetica','bold'); doc.setFontSize(8)
    doc.text('Vista del Proyecto', W/2 + 8, 11)

    setColor(doc, '#A3E635')
    doc.setFont('courier', 'normal')
    doc.setFontSize(6)
    const mockLines = doc.splitTextToSize(data.mockup || '(sin mockup)', W/2 - 16) as string[]
    doc.text(mockLines.slice(0, 30), W/2 + 8, 22)
}

function buildPricingPage(doc: jsPDF, W: number, H: number, data: ProposalData) {
    doc.addPage([W, H])
    fillRect(doc, 0, 0, W/2, H, WHITE_SOFT)
    fillRect(doc, W/2, 0, W/2, H, WINE)
    fillRect(doc, 0, 0, W, 3, YELLOW)

    // Left side
    setColor(doc, YELLOW); doc.setFont('helvetica','bold'); doc.setFontSize(8)
    doc.text('INVERSIÓN', 14, 18)

    setColor(doc, WINE); doc.setFontSize(18)
    doc.text('Una sola vez.', 14, 34)
    doc.text('siempre tranquilo.', 14, 46)

    // Total area
    const totalArea = data.items.reduce((s, i) => s + Number(i.area), 0)

    // Price highlight box
    setColor(doc, WINE); doc.setFont('helvetica','normal'); doc.setFontSize(9)
    doc.text('Tu inversión:', 14, 90)
    setColor(doc, WINE); doc.setFont('helvetica','bold'); doc.setFontSize(28)
    doc.text(`€ ${data.total.toFixed(2)} + IVA`, 14, 115)

    // Guarantee note
    const [wr,wg,wb] = hexToRgb(WINE)
    doc.setFillColor(wr,wg,wb)
    doc.roundedRect(14, 122, 115, 11, 2, 2, 'F')
    setColor(doc, YELLOW); doc.setFont('helvetica','bold'); doc.setFontSize(8)
    doc.text('✓  3 años de garantía. Sin letra pequeña.', 14 + 57.5, 129, { align: 'center' })

    // Right side — what's included
    setColor(doc, WHITE); doc.setFont('helvetica','bold'); doc.setFontSize(13)
    doc.text('¿Qué incluye su', W/2 + 10, 24)
    doc.text('inversión?', W/2 + 10, 36)

    const includes = [
        { label: 'Superficie cubierta', value: `${totalArea.toFixed(2)} m² instalados` },
        { label: 'Instalación profesional', value: 'Equipo certificado' },
        { label: 'Material garantizado', value: 'Red EN 1263-1, 150kg/m²' },
        { label: 'Garantía', value: '3 años sin coste' },
        { label: 'LPH-compatible', value: 'Sin conflictos con vecinos' },
    ]
    let iy = 48
    includes.forEach(row => {
        fillRect(doc, W/2+8, iy, W/2-16, 16, WINE_MID)
        setColor(doc, YELLOW); doc.setFont('helvetica','bold'); doc.setFontSize(7.5)
        doc.text(row.label, W/2+12, iy+6)
        setColor(doc, WHITE_SOFT); doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
        doc.text(row.value, W/2+12, iy+12)
        iy += 20
    })
}

// ── Main builder ──────────────────────────────────────────────────────────────

async function buildPDF(data: ProposalData): Promise<jsPDF> {
    const W = 297, H = 167
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H] })

    const logoB64 = await loadLogoBase64(data.city)

    // ── Page 1: Cover (always generated) ──
    buildCoverPage(doc, W, H, data, logoB64)

    // ── Pages 2 & 3: Static slides ──
    for (const n of [2, 3]) {
        const img = await loadStaticSlide(n)
        if (img) addFullPageImage(doc, W, H, img)
    }

    // ── Page 4: Measurements + Mockup (always generated) ──
    buildMeasurementsPage(doc, W, H, data)

    // ── Page 5: Pricing (always generated) ──
    buildPricingPage(doc, W, H, data)

    // ── Pages 6, 7, 8: Static slides ──
    for (const n of [6, 7, 8]) {
        const img = await loadStaticSlide(n)
        if (img) addFullPageImage(doc, W, H, img)
    }

    return doc
}

// ── Exports ───────────────────────────────────────────────────────────────────

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
