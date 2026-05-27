'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import type { ProposalData } from './pdfGenerator'

// ─── Brand colours ───────────────────────────────────────────────────────────
type RGB = [number, number, number]
const WINE:    RGB = [77,  42,  54]   // #4D2A36
const GOLD:    RGB = [234, 179,  8]   // #EAB308
const LIGHT:   RGB = [243, 244, 246]  // #F3F4F6
const WHITE:   RGB = [255, 255, 255]
const DARK:    RGB = [55,  65,  81]   // #374151
const LIME:    RGB = [163, 230,  53]  // #A3E635
const WARM:    RGB = [254, 243, 199]  // #FEF3C7 (pricing slide)
const LGRAY:   RGB = [229, 231, 235]  // #E5E7EB
const MGRAY:   RGB = [156, 163, 175]  // #9CA3AF

const W = 297
const H = 167

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]) }
function stroke(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]) }
function ink(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]) }

function rect(doc: jsPDF, x: number, y: number, w: number, h: number, c: RGB) {
    fill(doc, c); doc.rect(x, y, w, h, 'F')
}

function loadImg(url: string): Promise<string | null> {
    return new Promise(resolve => {
        const img = new Image()
        img.crossOrigin = 'Anonymous'
        img.onload = () => {
            const c = document.createElement('canvas')
            c.width = img.width; c.height = img.height
            const ctx = c.getContext('2d')
            if (!ctx) { resolve(null); return }
            ctx.drawImage(img, 0, 0)
            resolve(c.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = () => resolve(null)
        img.src = url
    })
}

function boldLabel(doc: jsPDF, text: string, x: number, y: number, size = 7) {
    doc.setFontSize(size)
    doc.setFont('helvetica', 'bold')
    doc.text(text, x, y)
}

function normalText(doc: jsPDF, text: string, x: number, y: number, size = 8, maxW?: number) {
    doc.setFontSize(size)
    doc.setFont('helvetica', 'normal')
    if (maxW) { doc.text(text, x, y, { maxWidth: maxW }) } else { doc.text(text, x, y) }
}

function goldAccentLine(doc: jsPDF, x: number, y: number, w = 20) {
    doc.setLineWidth(0.6)
    stroke(doc, GOLD)
    doc.line(x, y, x + w, y)
}

function wineHeader(doc: jsPDF, tag: string, title: string, subtitle: string) {
    rect(doc, 0, 0, W, H, WINE)
    // gold accent bar left edge
    rect(doc, 0, 0, 3, H, GOLD)
    ink(doc, GOLD)
    boldLabel(doc, tag, 10, 14, 6)
    goldAccentLine(doc, 10, 16, 25)
    ink(doc, WHITE)
    doc.setFontSize(16); doc.setFont('helvetica', 'bold')
    doc.text(title, 10, 30)
    ink(doc, LGRAY)
    normalText(doc, subtitle, 10, 38, 9, 120)
}

function lightHeader(doc: jsPDF, tag: string, title: string, subtitle: string) {
    rect(doc, 0, 0, W, H, LIGHT)
    rect(doc, 0, 0, 3, H, WINE)
    ink(doc, WINE)
    boldLabel(doc, tag, 10, 14, 6)
    goldAccentLine(doc, 10, 16, 25)
    ink(doc, WINE)
    doc.setFontSize(16); doc.setFont('helvetica', 'bold')
    doc.text(title, 10, 30)
    ink(doc, DARK)
    normalText(doc, subtitle, 10, 38, 9, 120)
}

// ─── Slide 1 – Cover ─────────────────────────────────────────────────────────
async function drawCover(doc: jsPDF, data: ProposalData, coverBgUrl: string, logoUrl: string) {
    rect(doc, 0, 0, W, H, WINE)

    const bgImg = await loadImg(coverBgUrl)
    if (bgImg) doc.addImage(bgImg, 'JPEG', 0, 0, W, H)

    // Dark overlay on left half
    doc.setFillColor(77, 42, 54, )
    // semi-transparent left panel effect via solid rect
    rect(doc, 0, 0, W * 0.52, H, WINE)

    // Gold bar
    rect(doc, 0, 0, 3, H, GOLD)

    // Logo
    const logo = await loadImg(logoUrl)
    if (logo) doc.addImage(logo, 'JPEG', 8, 6, 28, 10)

    ink(doc, GOLD)
    boldLabel(doc, 'PROPUESTA PERSONALIZADA', 10, 35, 7)
    goldAccentLine(doc, 10, 38, 35)

    ink(doc, WHITE)
    doc.setFontSize(22); doc.setFont('helvetica', 'bold')
    doc.text('Tu hogar,', 10, 54)
    ink(doc, GOLD)
    doc.text('protegido.', 10, 66)

    ink(doc, LGRAY)
    normalText(doc, 'Hemos preparado esta propuesta', 10, 78, 9)
    normalText(doc, 'especialmente para ti.', 10, 84, 9)

    // Client name
    rect(doc, 8, 100, W * 0.48, 20, [55, 30, 40])
    ink(doc, WHITE)
    boldLabel(doc, data.clientName.toUpperCase(), 12, 112, 11)
    ink(doc, MGRAY)
    normalText(doc, format(new Date(), 'dd/MM/yyyy'), 12, 120, 8)
}

// ─── Slide 2 – Risk ──────────────────────────────────────────────────────────
function drawRisk(doc: jsPDF) {
    lightHeader(doc, 'EL RIESGO ES REAL', '¿Cuánto tiempo puedes esperar?', '')

    const col = (n: number) => 10 + n * 92

    const risks = [
        {
            icon: '🐱',
            title: 'Síndrome del Gato Paracaidista',
            body: 'Los gatos no perciben la altura. Un pájaro al otro lado del cristal puede provocar una caída fatal desde el piso 3 o el 10.'
        },
        {
            icon: '👶',
            title: 'Seguridad Infantil',
            body: 'Los niños suben a las barandillas. Una ventana sin protección es un accidente esperando ocurrir.'
        },
        {
            icon: '💸',
            title: 'El coste de no actuar',
            body: 'Una urgencia veterinaria cuesta entre 200€ y 800€. Un accidente doméstico no tiene precio.'
        },
    ]

    risks.forEach((r, i) => {
        const x = col(i)
        rect(doc, x, 45, 85, 95, WHITE)
        // gold top bar
        rect(doc, x, 45, 85, 3, GOLD)
        ink(doc, WINE)
        boldLabel(doc, r.title, x + 5, 62, 8)
        ink(doc, DARK)
        normalText(doc, r.body, x + 5, 72, 7.5, 75)
    })

    // Stat
    rect(doc, 0, 148, W, 19, WINE)
    ink(doc, GOLD)
    boldLabel(doc, '85%', 12, 161, 14)
    ink(doc, WHITE)
    normalText(doc, 'de los propietarios de mascotas las consideran parte de la familia. ¿Forman parte de la tuya?', 40, 158, 8, 200)
}

// ─── Slide 3 – Material ──────────────────────────────────────────────────────
function drawMaterial(doc: jsPDF) {
    rect(doc, 0, 0, W, H, WHITE)
    rect(doc, 0, 0, 3, H, WINE)

    ink(doc, WINE)
    boldLabel(doc, 'MATERIAL · NUESTRA ELECCIÓN', 10, 14, 6)
    goldAccentLine(doc, 10, 16, 35)
    ink(doc, WINE)
    doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('Elegimos seguridad. Por eso, polietileno.', 10, 27)
    ink(doc, DARK)
    normalText(doc, 'No todas las redes son iguales. La diferencia se ve a los 2 años.', 10, 34, 8)

    // Two columns
    const bad = [
        'Nylon · "malla invisible" — hilo muy fino',
        'Apenas se ve, pero apenas resiste.',
        'Se vuelve quebradizo: sol y lluvia degradan en 18-24 meses.',
        'Falsa sensación de seguridad.',
        'Sin certificación de carga.',
    ]
    const good = [
        'Polietileno alta densidad',
        'Resistencia real: 150 kg/m² — soporta el peso de un adulto.',
        'Resistente a UV y a la intemperie, mantiene propiedades años.',
        'Impacto visual mínimo — discreta pero efectiva.',
        'Certificada EN 1263-1 (misma norma que redes en obras).',
    ]

    // Bad column
    rect(doc, 8, 42, 130, 100, [255, 245, 245])
    rect(doc, 8, 42, 130, 6, [220, 80, 80])
    ink(doc, WHITE)
    boldLabel(doc, '✕  LO QUE OFRECEN OTROS', 10, 47, 7)
    ink(doc, [180, 50, 50])
    bad.forEach((t, i) => normalText(doc, '✕  ' + t, 11, 57 + i * 12, 7.5, 124))

    // Good column
    rect(doc, 152, 42, 138, 100, [240, 253, 233])
    rect(doc, 152, 42, 138, 6, [80, 160, 40])
    ink(doc, WHITE)
    boldLabel(doc, '✓  LO QUE GARANTIZA PREVENTIVA', 154, 47, 7)
    ink(doc, [60, 130, 30])
    good.forEach((t, i) => normalText(doc, '✓  ' + t, 154, 57 + i * 12, 7.5, 132))

    ink(doc, WINE)
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
    doc.text('No optamos por la red más barata. Optamos por la que de verdad protege.', 10, 148)
}

// ─── Slide 4 – FAQ ───────────────────────────────────────────────────────────
function drawFAQ(doc: jsPDF) {
    wineHeader(doc, 'SIN COMPROMISOS · SIN COMPLICACIONES', 'Lo que probablemente te estás preguntando.', '')

    const faqs = [
        ['01  ¿Tengo que hacer obras?', 'No. Cero obras, cero polvo, cero ruido. Anclajes específicos para tu ventana o balcón.'],
        ['02  Si me mudo, ¿se queda fija?', 'Es totalmente reversible. Cuando dejes el inmueble la retiramos sin marcas visibles.'],
        ['03  ¿Se va a ver desde la calle?', 'No altera la fachada. La red es discreta y no requiere autorización de la comunidad.'],
        ['04  ¿Y mis vecinos / la comunidad?', 'Compatible con la Ley de Propiedad Horizontal. La comunidad no puede impedir su instalación.'],
        ['05  ¿Cuánto tarda la instalación?', 'En la mayoría de viviendas, una sola visita. Pocas horas, sin que tengas que ausentarte.'],
        ['06  ¿Y si algo falla con el tiempo?', '3 años de garantía sin letra pequeña. Si algo falla, volvemos y lo resolvemos sin coste.'],
    ]

    const col1 = faqs.slice(0, 3)
    const col2 = faqs.slice(3)

    ;[col1, col2].forEach((col, ci) => {
        const x = 10 + ci * 143
        col.forEach(([q, a], i) => {
            const y = 46 + i * 38
            rect(doc, x, y, 135, 34, [55, 30, 40])
            rect(doc, x, y, 2, 34, GOLD)
            ink(doc, GOLD)
            boldLabel(doc, q, x + 6, y + 9, 7.5)
            ink(doc, LGRAY)
            normalText(doc, a, x + 6, y + 16, 7, 127)
        })
    })

    ink(doc, MGRAY)
    normalText(doc, '¿Otra duda? Llámanos. Preferimos resolverla ahora a que se quede pendiente.', 10, 160, 7)
}

// ─── Slide 5 – Trajectory ────────────────────────────────────────────────────
function drawTrajectory(doc: jsPDF, isEste: boolean) {
    lightHeader(doc, 'TRAYECTORIA', '10 años protegiendo familias en la Península Ibérica.', 'Equipo local, presencia en 4 ciudades, una sola promesa: seguridad real.')

    const stats: [string, string, string][] = [
        ['+10', 'AÑOS EN EL MERCADO', 'Desde 2016, un único foco: redes de protección que de verdad protegen.'],
        ['4',   'ciudades atendidas', ''],
        ['EN 1263-1', 'norma europea', ''],
        ['3 años', 'garantía', ''],
    ]

    stats.forEach(([big, label, sub], i) => {
        const x = 10 + i * 70
        rect(doc, x, 50, 63, 45, WHITE)
        rect(doc, x, 50, 63, 3, GOLD)
        ink(doc, WINE)
        doc.setFontSize(14); doc.setFont('helvetica', 'bold')
        doc.text(big, x + 5, 68)
        ink(doc, DARK)
        boldLabel(doc, label, x + 5, 77, 7)
        if (sub) { ink(doc, MGRAY); normalText(doc, sub, x + 5, 85, 6.5, 55) }
    })

    // Cities map text
    rect(doc, 8, 105, W - 16, 40, WINE)
    ink(doc, GOLD)
    boldLabel(doc, 'PRESENCIA · PENÍNSULA IBÉRICA', 14, 115, 7)
    ink(doc, WHITE)
    const cities = 'Porto  ·  Madrid  ·  Barcelona  ·  Málaga'
    doc.setFontSize(10); doc.setFont('helvetica', 'bold')
    doc.text(cities, 14, 125)
    ink(doc, LGRAY)
    const local = isEste
        ? 'Equipo local en Barcelona. Mismo estándar de instalación, una década perfeccionándolo.'
        : 'Equipo local en Madrid. Mismo estándar de instalación, una década perfeccionándolo.'
    normalText(doc, local, 14, 134, 8, 260)
}

// ─── Slide 6 – Project ───────────────────────────────────────────────────────
async function drawProject(doc: jsPDF, data: ProposalData) {
    rect(doc, 0, 0, W, H, WINE)
    rect(doc, 0, 0, 3, H, GOLD)

    ink(doc, GOLD)
    boldLabel(doc, 'TU PROYECTO', 10, 14, 7)
    goldAccentLine(doc, 10, 16, 25)
    ink(doc, WHITE)
    normalText(doc, 'Hemos revisado tu caso.', 10, 23, 9)

    // Items section
    rect(doc, 8, 28, 130, 10, [55, 30, 40])
    ink(doc, GOLD)
    boldLabel(doc, 'SUPERFICIE A PROTEGER', 12, 35, 7)

    const tableData = data.items.map(it => [
        it.name,
        `${Number(it.width).toFixed(2)} x ${Number(it.height).toFixed(2)} m`,
        `${Number(it.area).toFixed(2)} m²`,
        `€ ${Number(it.price).toFixed(2)}`,
    ])

    autoTable(doc, {
        startY: 40,
        margin: { left: 8, right: W / 2 + 5 },
        head: [['Zona', 'Medidas', 'Área', 'Precio']],
        body: tableData,
        headStyles: { fillColor: [55, 30, 40], textColor: [234, 179, 8], fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { fillColor: [55, 30, 40], textColor: WHITE, fontSize: 7 },
        alternateRowStyles: { fillColor: [66, 35, 48] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
        styles: { cellPadding: 2 },
    })

    // Mockup / ASCII section
    const mockupStartX = W / 2 + 5
    rect(doc, mockupStartX, 28, W - mockupStartX - 8, 10, [55, 30, 40])
    ink(doc, GOLD)
    boldLabel(doc, 'VISTA DEL PROYECTO', mockupStartX + 4, 35, 7)

    if (data.mockup) {
        const lines = data.mockup.split('\n').slice(0, 18)
        ink(doc, LIME)
        doc.setFontSize(5.5); doc.setFont('courier', 'normal')
        lines.forEach((line, i) => doc.text(line, mockupStartX + 4, 44 + i * 5))
    }

    // Background photo if available
    if (data.imageUrl) {
        const img = await loadImg(data.imageUrl)
        if (img) {
            // small thumbnail bottom right
            doc.addImage(img, 'JPEG', W - 56, H - 46, 48, 38)
        }
    }

    // Total bar
    const finalY = (doc as any).lastAutoTable?.finalY ?? 120
    rect(doc, 8, Math.min(finalY + 4, H - 20), 130, 12, [55, 30, 40])
    ink(doc, GOLD)
    boldLabel(doc, `TOTAL: € ${Number(data.total).toFixed(2)} + IVA`, 12, Math.min(finalY + 12, H - 11), 9)
}

// ─── Slide 7 – Pricing ───────────────────────────────────────────────────────
function drawPricing(doc: jsPDF, data: ProposalData) {
    rect(doc, 0, 0, W, H, WARM)
    rect(doc, 0, 0, 3, H, WINE)

    ink(doc, WINE)
    boldLabel(doc, 'INVERSIÓN', 10, 14, 7)
    goldAccentLine(doc, 10, 16, 20)
    ink(doc, WINE)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text('Una sola vez.', 10, 24)
    ink(doc, DARK)
    doc.setFontSize(8)
    doc.text('siempre tranquilo.', 10, 30)

    // Tip box
    rect(doc, 8, 34, 130, 14, [254, 230, 160])
    ink(doc, [150, 100, 0])
    normalText(doc, '💡  Una urgencia veterinaria cuesta entre 200€ y 800€. Eso si todo va bien.', 12, 43, 7, 122)

    // Price highlight
    rect(doc, 8, 52, 130, 28, WINE)
    ink(doc, LGRAY)
    normalText(doc, 'Tu inversión:', 14, 60, 8)
    ink(doc, GOLD)
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text(`€ ${Number(data.total).toFixed(2)} + IVA`, 14, 72)
    ink(doc, WHITE)
    normalText(doc, '✓  3 años de garantía. Sin letra pequeña.', 14, 78, 7.5)

    // Inclusions
    ink(doc, WINE)
    boldLabel(doc, '¿Qué incluye su inversión?', 10, 90, 8)

    const inclusions = [
        [`${data.items.reduce((a, it) => a + Number(it.area), 0).toFixed(2)} m²`, 'Superficie instalada'],
        ['Instalación profesional', 'Equipo certificado'],
        ['Material garantizado', 'Red EN 1263-1, 150 kg/m²'],
        ['Garantía', '3 años sin coste'],
        ['LPH-compatible', 'Sin conflictos con vecinos'],
    ]

    inclusions.forEach(([k, v], i) => {
        const col = i < 3 ? 8 : 145
        const row = i < 3 ? i : i - 3
        rect(doc, col, 94 + row * 17, 130, 13, WHITE)
        rect(doc, col, 94 + row * 17, 3, 13, GOLD)
        ink(doc, WINE)
        boldLabel(doc, k, col + 7, 101 + row * 17, 7.5)
        ink(doc, DARK)
        normalText(doc, v, col + 7, 104 + row * 17 + 3, 6.5)
    })
}

// ─── Slides 8 & 9 – Work photos ──────────────────────────────────────────────
async function drawWorks(doc: jsPDF, company: 'centro' | 'este', slideNum: 8 | 9) {
    const isDark = slideNum === 8
    rect(doc, 0, 0, W, H, isDark ? WINE : LIGHT)
    rect(doc, 0, 0, 3, H, GOLD)

    if (isDark) {
        ink(doc, GOLD)
        boldLabel(doc, 'POR QUÉ PREVENTIVA', 10, 14, 7)
        goldAccentLine(doc, 10, 16, 28)
        ink(doc, WHITE)
        doc.setFontSize(13); doc.setFont('helvetica', 'bold')
        doc.text('Nuestros Trabajos', 10, 27)
    } else {
        ink(doc, WINE)
        boldLabel(doc, 'GALERÍA DE TRABAJOS', 10, 14, 7)
        goldAccentLine(doc, 10, 16, 28)
    }

    const base = slideNum === 8 ? 1 : 4
    const photoUrls = [
        `/assets/pdf/${company}/photo${base}.png`,
        `/assets/pdf/${company}/photo${base + 1}.png`,
        `/assets/pdf/${company}/photo${base + 2}.png`,
    ]

    const yStart = 32
    const photoH = H - yStart - 6
    const photoW = (W - 20) / 3

    await Promise.all(photoUrls.map(async (url, i) => {
        const img = await loadImg(url)
        const x = 8 + i * (photoW + 5)
        if (img) {
            doc.addImage(img, 'PNG', x, yStart, photoW, photoH)
        } else {
            rect(doc, x, yStart, photoW, photoH, isDark ? [55, 30, 40] : LGRAY)
        }
    }))
}

// ─── Slide 10 – CTA ──────────────────────────────────────────────────────────
function drawCTA(doc: jsPDF, isEste: boolean, logoData: string | null) {
    rect(doc, 0, 0, W, H, WINE)
    rect(doc, 0, 0, 3, H, GOLD)

    if (logoData) doc.addImage(logoData, 'JPEG', 8, 6, 28, 10)

    ink(doc, WHITE)
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text('¿Lo confirmamos?', 10, 38)
    ink(doc, LGRAY)
    normalText(doc, 'Solo tenemos hueco para pocas instalaciones más este mes.', 10, 47, 9, 150)
    normalText(doc, 'Responde antes de que otro lo ocupe.', 10, 55, 9)

    // CTA box
    rect(doc, 8, 62, 140, 16, [55, 30, 40])
    ink(doc, GOLD)
    boldLabel(doc, 'Responde "SÍ" y fijamos la fecha', 12, 73, 10)

    // Contact info
    const phone = isEste ? '672 078 885' : '637 003 793'
    const fixed = isEste ? '' : '91 209 61 17'
    const email = isEste ? 'contacto@preventivaeste.com' : 'contacto@preventivacentro.es'
    const web   = isEste ? 'preventivaeste.com' : 'preventivacentro.es'
    const area  = isEste
        ? 'Barcelona y Área Metropolitana  ·  Cataluña'
        : 'Madrid, Móstoles, Leganés, Getafe, Alcorcón y toda la Comunidad de Madrid'

    const contacts = [
        ['📱  WhatsApp / Móvil:', phone],
        ...(fixed ? [['📞  Fijo:', fixed]] : []),
        ['✉️  Email:', email],
    ]

    contacts.forEach(([label, value], i) => {
        ink(doc, MGRAY)
        normalText(doc, label, 10, 90 + i * 11, 7.5)
        ink(doc, WHITE)
        boldLabel(doc, value, 60, 90 + i * 11, 8)
    })

    rect(doc, 0, H - 16, W, 16, [55, 30, 40])
    ink(doc, MGRAY)
    normalText(doc, `${web}  ·  ${area}`, 10, H - 7, 6.5, 260)
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function generateDirectPDF(data: ProposalData): Promise<Blob> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H] })

    const isEste = data.city?.toLowerCase().includes('este') ||
                   data.city?.toLowerCase().includes('barcelona')
    const company = isEste ? 'este' : 'centro'

    const logoExt    = isEste ? 'png'  : 'jpeg'
    const coverExt   = isEste ? 'jpeg' : 'png'
    const logoUrl    = `/assets/pdf/${company}/logo.${logoExt}`
    const coverBgUrl = `/assets/pdf/${company}/cover_bg.${coverExt}`

    const [logoData] = await Promise.all([loadImg(logoUrl)])

    // Page 1 – Cover
    await drawCover(doc, data, coverBgUrl, logoUrl)

    // Page 2 – Risk
    doc.addPage()
    drawRisk(doc)

    // Page 3 – Material
    doc.addPage()
    drawMaterial(doc)

    // Page 4 – FAQ
    doc.addPage()
    drawFAQ(doc)

    // Page 5 – Trajectory
    doc.addPage()
    drawTrajectory(doc, isEste)

    // Page 6 – Project (dynamic)
    doc.addPage()
    await drawProject(doc, data)

    // Page 7 – Pricing (dynamic)
    doc.addPage()
    drawPricing(doc, data)

    // Page 8 – Works
    doc.addPage()
    await drawWorks(doc, company, 8)

    // Page 9 – Gallery
    doc.addPage()
    await drawWorks(doc, company, 9)

    // Page 10 – CTA
    doc.addPage()
    drawCTA(doc, isEste, logoData)

    return doc.output('blob')
}
