import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { BRAND, CONTACT } from '@/lib/constants'
import { getItemCategory } from '@/lib/itemTypes'

export interface ProposalItem {
    name: string
    width: number
    height: number
    area: number
    price: number
    price_rule?: string
}

export interface ProposalData {
    clientName: string
    city: string
    items: ProposalItem[]
    total: number
    mockup: string
    mockupImageBlob?: Blob | null
    imageUrl?: string
    whatsapp?: string
}

const PAGE_W = 297
const PAGE_H = 167

const MAROON = BRAND.PRIMARY_COLOR // '#4D2A36'
const MAROON_LIGHT = '#6B4456'
const GOLD = BRAND.ACCENT_COLOR // '#fbbf24'
const WHITE = '#FFFFFF'
const TEXT_GRAY = '#374151'
const LIGHT_GRAY = '#F3F4F6'

const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })

const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
    try {
        const res = await fetch(url)
        if (!res.ok) return null
        const blob = await res.blob()
        return await blobToDataUrl(blob)
    } catch {
        return null
    }
}

const fitImage = (imgW: number, imgH: number, maxW: number, maxH: number) => {
    const ratio = Math.min(maxW / imgW, maxH / imgH)
    return { w: imgW * ratio, h: imgH * ratio }
}

const getImgSize = (dataUrl: string): Promise<{ w: number; h: number }> =>
    new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.width, h: img.height })
        img.onerror = () => resolve({ w: 4, h: 3 })
        img.src = dataUrl
    })

const drawCheck = (doc: jsPDF, x: number, y: number, size: number, colorHex: string) => {
    doc.setDrawColor(colorHex)
    doc.setLineWidth(size * 0.18)
    doc.line(x, y, x + size * 0.32, y + size * 0.32)
    doc.line(x + size * 0.32, y + size * 0.32, x + size, y - size * 0.36)
    doc.setLineWidth(0.5)
}

const drawCross = (doc: jsPDF, x: number, y: number, size: number, colorHex: string) => {
    doc.setDrawColor(colorHex)
    doc.setLineWidth(size * 0.18)
    doc.line(x, y, x + size * 0.7, y - size * 0.7)
    doc.line(x, y - size * 0.7, x + size * 0.7, y)
    doc.setLineWidth(0.5)
}

export const generateProposalPDF_direct = async (data: ProposalData): Promise<Blob> => {
    const isEste = data.city?.toLowerCase().includes('este')
    const brandName = isEste ? 'PREVENTIVA ESTE' : 'PREVENTIVA CENTRO'
    const assetDir = isEste ? '/assets/pdf/este' : '/assets/pdf/centro'

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PAGE_W, PAGE_H] })

    const [photo1, photo2, photo3, photo4, photo5, photo6] = await Promise.all(
        ['photo1.png', 'photo2.png', 'photo3.png', 'photo4.png', 'photo5.png', 'photo6.png'].map((f) =>
            loadImageAsDataUrl(`${assetDir}/${f}`),
        ),
    )

    let mockupDataUrl: string | null = null
    if (data.mockupImageBlob) {
        mockupDataUrl = await blobToDataUrl(data.mockupImageBlob)
    }

    // ── PAGE 1: COVER ────────────────────────────────────────────────────────
    doc.setFillColor(MAROON)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    doc.setFillColor(GOLD)
    doc.rect(0, 0, PAGE_W, 3, 'F')
    doc.setFillColor(MAROON_LIGHT)
    doc.rect(PAGE_W / 2 + 5, 12, PAGE_W / 2 - 20, PAGE_H - 24, 'F')

    doc.setTextColor(WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(brandName, 15, 18)

    doc.setFontSize(26)
    doc.text('Tu hogar,', 15, 55)
    doc.text('protegido.', 15, 68)

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(11)
    doc.text('Hemos preparado esta propuesta', 15, 82)
    doc.text('especialmente para ti.', 15, 88)

    doc.setTextColor(GOLD)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text(data.clientName.toUpperCase(), 15, 108)

    doc.setFillColor(GOLD)
    doc.roundedRect(15, 130, 70, 14, 2, 2, 'F')
    doc.setTextColor(MAROON)
    doc.setFontSize(10)
    doc.text('Propuesta Personalizada', 18, 138.5)

    doc.setTextColor(WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(format(new Date(), 'dd/MM/yyyy'), 15, 158)

    // ── PAGE 2: RISK ─────────────────────────────────────────────────────────
    doc.addPage()
    doc.setFillColor(WHITE)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    doc.setFillColor(MAROON)
    doc.rect(PAGE_W * 0.6, 0, PAGE_W * 0.4, PAGE_H, 'F')

    doc.setTextColor(GOLD)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('EL RIESGO ES REAL', 15, 18)
    doc.setTextColor(MAROON)
    doc.setFontSize(18)
    doc.text('¿Cuánto tiempo', 15, 32)
    doc.text('puedes esperar?', 15, 41)

    const riskItems = [
        ['Seguridad ante todo', 'La prevención es la única respuesta responsable ante el riesgo de caídas.'],
        ['Protección familiar', 'Niños y mascotas suben a barandillas y ventanas sin percibir la altura.'],
        ['El coste de no actuar', 'Un accidente doméstico no tiene precio. Actuar a tiempo sí lo tiene.'],
    ]
    let ry = 55
    doc.setFontSize(10)
    riskItems.forEach(([title, desc]) => {
        doc.setFillColor(GOLD)
        doc.rect(15, ry - 4, 1.2, 14, 'F')
        doc.setFillColor(LIGHT_GRAY)
        doc.rect(17, ry - 4, 150, 14, 'F')
        doc.setTextColor(MAROON)
        doc.setFont('helvetica', 'bold')
        doc.text(title, 20, ry)
        doc.setTextColor(TEXT_GRAY)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(desc, 20, ry + 5, { maxWidth: 142 })
        doc.setFontSize(10)
        ry += 20
    })

    doc.setTextColor(WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('¿Forman parte de tu hogar?', PAGE_W * 0.6 + 10, 100, { maxWidth: PAGE_W * 0.4 - 20 })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('La protección es la única respuesta responsable.', PAGE_W * 0.6 + 10, 112, { maxWidth: PAGE_W * 0.4 - 20 })

    // ── PAGE 3: MATERIAL ─────────────────────────────────────────────────────
    doc.addPage()
    doc.setFillColor(WHITE)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    doc.setFillColor(MAROON)
    doc.rect(0, 0, PAGE_W, 28, 'F')
    doc.setTextColor(GOLD)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('MATERIAL · NUESTRA ELECCIÓN', 15, 12)
    doc.setTextColor(WHITE)
    doc.setFontSize(15)
    doc.text('Elegimos seguridad. Por eso, polietileno.', 15, 22)

    doc.setFillColor(MAROON)
    doc.rect(15, 38, 130, 105, 'F')
    doc.setTextColor(GOLD)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Polietileno alta densidad', 20, 50)
    const pros = [
        ['Resistencia real: 150 kg/m²', 'Soporta el peso de un adulto.'],
        ['Resistente a UV e intemperie', 'Mantiene sus propiedades durante años.'],
        ['Impacto visual mínimo', 'Discreta, no oscurece la vista.'],
        ['Certificada EN 1263-1', 'Misma norma que redes de seguridad en obras.'],
    ]
    let py = 62
    pros.forEach(([t, d]) => {
        drawCheck(doc, 20, py, 3, WHITE)
        doc.setTextColor(WHITE)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(t, 26, py)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(d, 20, py + 5, { maxWidth: 118 })
        py += 18
    })

    doc.setFillColor(LIGHT_GRAY)
    doc.rect(152, 38, 130, 105, 'F')
    doc.setTextColor(MAROON)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Nylon · "malla invisible"', 157, 50)
    const cons = [
        ['Hilo muy fino', 'Apenas se ve, pero apenas resiste.'],
        ['Se vuelve quebradizo', 'El sol y la lluvia lo degradan en 18-24 meses.'],
        ['Falsa sensación de seguridad', 'Lo que no se ve, no protege.'],
        ['Sin certificación de carga', 'No suele estar homologado.'],
    ]
    let cy = 62
    cons.forEach(([t, d]) => {
        drawCross(doc, 157, cy, 3, MAROON)
        doc.setTextColor(MAROON)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(t, 163, cy)
        doc.setTextColor(TEXT_GRAY)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(d, 157, cy + 5, { maxWidth: 118 })
        cy += 18
    })

    // ── PAGE 4: ITEMS + MOCKUP ───────────────────────────────────────────────
    doc.addPage()
    doc.setFillColor(MAROON)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    doc.setFillColor(GOLD)
    doc.rect(0, 0, PAGE_W, 3, 'F')
    doc.setTextColor(GOLD)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('TU PROYECTO', 15, 16)
    doc.setTextColor(WHITE)
    doc.setFontSize(16)
    doc.text('Hemos revisado tu caso.', 15, 27)

    doc.setFillColor(MAROON_LIGHT)
    doc.rect(15, 38, 130, 120, 'F')
    doc.setTextColor(GOLD)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('SUPERFICIE A PROTEGER', 20, 48)

    let iy = 58
    let hiddenCount = 0
    doc.setFontSize(9)
    data.items.forEach((item, idx) => {
        if (iy > 150) {
            hiddenCount++
            return
        }
        const cat = getItemCategory(item.name)
        const isPost = cat === 'post' || cat === 'post45'
        const dims = isPost
            ? `${Math.round(Number(item.width))} uds. · ${Number(item.height).toFixed(2)}m`
            : `${Number(item.width).toFixed(2)}×${Number(item.height).toFixed(2)}m · ${Number(item.area).toFixed(2)}m²`
        doc.setTextColor(GOLD)
        doc.setFont('helvetica', 'normal')
        doc.text(`${idx + 1}.`, 20, iy)
        doc.setTextColor(WHITE)
        doc.setFont('helvetica', 'bold')
        doc.text(item.name, 27, iy)
        doc.setTextColor('#D1D5DB')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(dims, 27, iy + 4.5)
        doc.setFontSize(9)
        iy += 11
    })
    if (hiddenCount > 0) {
        doc.setTextColor(GOLD)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text(`+${hiddenCount} más`, 20, Math.min(iy, 153))
        doc.setFontSize(9)
    }

    const netItems = data.items.filter((i) => getItemCategory(i.name) === 'net')
    const totalArea = netItems.reduce((s, i) => s + Number(i.area), 0)
    doc.setTextColor('#D1D5DB')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(
        `${totalArea > 0 ? `${totalArea.toFixed(2)} m² · ` : ''}${data.items.length} piezas`,
        20,
        Math.min(iy + 4, 152),
    )

    doc.setFillColor(MAROON_LIGHT)
    doc.rect(152, 38, 130, 120, 'F')
    doc.setTextColor(WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('VISTA DEL PROYECTO', 157, 48)
    if (mockupDataUrl) {
        try {
            const size = await getImgSize(mockupDataUrl)
            const { w, h } = fitImage(size.w, size.h, 120, 100)
            doc.addImage(mockupDataUrl, 'PNG', 157 + (120 - w) / 2, 52 + (100 - h) / 2, w, h)
        } catch (err: any) {
            console.error('[PDF] Mockup image error:', err?.message)
        }
    }

    // ── PAGE 5: INVERSIÓN ────────────────────────────────────────────────────
    doc.addPage()
    doc.setFillColor(WHITE)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    doc.setFillColor(MAROON)
    doc.rect(PAGE_W * 0.55, 0, PAGE_W * 0.45, PAGE_H, 'F')

    doc.setTextColor(GOLD)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('INVERSIÓN', 15, 18)
    doc.setTextColor(MAROON)
    doc.setFontSize(18)
    doc.text('Una sola vez.', 15, 32)
    doc.text('siempre tranquilo.', 15, 41)

    doc.setFillColor('#FEF3C7')
    doc.rect(15, 55, 145, 18, 'F')
    doc.setTextColor('#92400E')
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text('Una urgencia doméstica puede costar entre 200€ y 800€.', 19, 62)
    doc.text('Eso si todo va bien.', 19, 67)

    doc.setTextColor(TEXT_GRAY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Tu inversión:', 15, 88)
    doc.setTextColor(MAROON)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(26)
    doc.text(`€ ${data.total.toFixed(2)} + IVA`, 15, 105)

    doc.setFillColor(MAROON)
    doc.rect(15, 118, 145, 14, 'F')
    doc.setTextColor(GOLD)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    drawCheck(doc, 19, 126.5, 3, GOLD)
    doc.text('2 años de garantía. Sin letra pequeña.', 25, 126.5)

    doc.setTextColor(WHITE)
    doc.setFontSize(13)
    doc.text('¿Qué incluye tu inversión?', PAGE_W * 0.55 + 10, 22, { maxWidth: PAGE_W * 0.45 - 20 })
    const includes = [
        ['Superficie cubierta', `${(totalArea || data.items.reduce((s, i) => s + Number(i.area || 0), 0)).toFixed(2)} m² instalados`],
        ['Instalación profesional', 'Equipo certificado'],
        ['Material garantizado', 'Red EN 1263-1, 150kg/m²'],
        ['Garantía', '2 años sin coste'],
    ]
    let vy = 40
    includes.forEach(([t, d]) => {
        doc.setFillColor(MAROON_LIGHT)
        doc.rect(PAGE_W * 0.55 + 10, vy - 4, 122, 16, 'F')
        doc.setFillColor(GOLD)
        doc.rect(PAGE_W * 0.55 + 10, vy - 4, 1.2, 16, 'F')
        doc.setTextColor('#D1D5DB')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(t, PAGE_W * 0.55 + 14, vy)
        doc.setTextColor(WHITE)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text(d, PAGE_W * 0.55 + 14, vy + 6)
        vy += 22
    })

    // ── PAGE 6 & 7: PHOTOS ───────────────────────────────────────────────────
    const photoPage = async (title: string, imgs: (string | null)[]) => {
        doc.addPage()
        doc.setFillColor(WHITE)
        doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
        doc.setFillColor(MAROON)
        doc.rect(0, 0, PAGE_W, 24, 'F')
        doc.setTextColor(GOLD)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.text('POR QUÉ ' + brandName, 15, 10)
        doc.setTextColor(WHITE)
        doc.setFontSize(14)
        doc.text(title, 15, 19)

        const slots = imgs.filter(Boolean) as string[]
        const cols = Math.min(slots.length, 3) || 1
        const margin = 15
        const gap = 6
        const cellW = (PAGE_W - margin * 2 - gap * (cols - 1)) / cols
        const cellH = PAGE_H - 24 - margin - 8
        for (let idx = 0; idx < Math.min(slots.length, 3); idx++) {
            const src = slots[idx]
            try {
                const size = await getImgSize(src)
                const { w, h } = fitImage(size.w, size.h, cellW, cellH)
                const x = margin + idx * (cellW + gap) + (cellW - w) / 2
                const y = 32 + (cellH - h) / 2
                doc.addImage(src, 'PNG', x, y, w, h)
            } catch (err: any) {
                console.error('[PDF] Photo image error:', err?.message)
            }
        }
    }
    await photoPage('Nuestros Trabajos', [photo1, photo2, photo3])
    await photoPage('Resultados Reales', [photo4, photo5, photo6])

    // ── PAGE 8: CONTACT/CONFIRMATION ─────────────────────────────────────────
    doc.addPage()
    doc.setFillColor(MAROON)
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    doc.setFillColor(GOLD)
    doc.rect(0, 0, PAGE_W, 3, 'F')
    doc.setTextColor(WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.text('¿Lo confirmamos?', PAGE_W / 2, 50, { align: 'center' })
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.text('Solo tenemos hueco para pocas instalaciones más este mes.', PAGE_W / 2, 64, { align: 'center' })
    doc.text('Responde antes de que otro lo ocupe.', PAGE_W / 2, 70, { align: 'center' })

    doc.setFillColor(GOLD)
    doc.roundedRect(PAGE_W / 2 - 45, 80, 90, 14, 2, 2, 'F')
    doc.setTextColor(MAROON)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Responde "SÍ" y fijamos la fecha', PAGE_W / 2, 88.5, { align: 'center' })

    doc.setFillColor(MAROON_LIGHT)
    doc.rect(0, PAGE_H - 32, PAGE_W, 32, 'F')
    doc.setTextColor(GOLD)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('WhatsApp / Móvil:', 25, PAGE_H - 20)
    doc.text('Fijo:', 130, PAGE_H - 20)
    doc.text('Email:', 200, PAGE_H - 20)
    doc.setTextColor(WHITE)
    doc.setFontSize(11)
    doc.text(CONTACT.MOBILE, 25, PAGE_H - 12)
    doc.text(CONTACT.PHONE, 130, PAGE_H - 12)
    doc.setFontSize(9)
    doc.text(CONTACT.EMAIL, 200, PAGE_H - 12)

    return doc.output('blob')
}

export const generateProposalBlob = generateProposalPDF_direct

export const generateProposalPDF = async (data: ProposalData): Promise<void> => {
    const blob = await generateProposalPDF_direct(data)
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
