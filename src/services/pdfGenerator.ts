import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

// Brand colours — use index access to avoid spread-tuple TS error
const NAVY   = { r: 26,  g: 54,  b: 93  }
const WINE   = { r: 77,  g: 42,  b: 54  }
const ACCENT = { r: 251, g: 191, b: 36  }
const WHITE  = { r: 255, g: 255, b: 255 }

function fill(doc: jsPDF, c: { r: number; g: number; b: number }) {
    doc.setFillColor(c.r, c.g, c.b)
}
function text(doc: jsPDF, c: { r: number; g: number; b: number }) {
    doc.setTextColor(c.r, c.g, c.b)
}

async function loadLogoBase64(city: string): Promise<string | null> {
    const isEste = city?.toLowerCase().includes('este')
    const path = isEste ? '/assets/logo_preventiva_este.png' : '/assets/logo_preventiva_centro.png'
    try {
        const res = await fetch(path)
        if (!res.ok) return null
        const blob = await res.blob()
        return await new Promise<string>(resolve => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
        })
    } catch {
        return null
    }
}

export const generateProposalBlob = async (data: ProposalData): Promise<Blob> => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = 210
    const pageH = 297
    const margin = 18

    // ── Header bar
    fill(doc, NAVY)
    doc.rect(0, 0, pageW, 38, 'F')

    const logo = await loadLogoBase64(data.city)
    if (logo) {
        doc.addImage(logo, 'PNG', margin, 7, 48, 22)
    } else {
        text(doc, WHITE)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('PREVENTIVA', margin, 22)
    }

    text(doc, WHITE)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text('contacto@preventivacentro.es', pageW - margin, 14, { align: 'right' })
    doc.text('637 003 793  ·  91 209 61 17', pageW - margin, 20, { align: 'right' })
    doc.text('www.preventivacentro.es', pageW - margin, 26, { align: 'right' })

    // ── Title band
    fill(doc, WINE)
    doc.rect(0, 38, pageW, 18, 'F')

    text(doc, WHITE)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('PRESUPUESTO DE INSTALACIÓN', margin, 50)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
        new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        pageW - margin, 50, { align: 'right' },
    )

    let y = 70

    // ── Client info box
    doc.setFillColor(245, 247, 250)
    doc.roundedRect(margin, y - 4, pageW - margin * 2, 22, 3, 3, 'F')

    text(doc, NAVY)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('CLIENTE', margin + 5, y + 2)

    doc.setFontSize(12)
    doc.text(data.clientName, margin + 5, y + 11)

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(data.city, pageW - margin - 5, y + 2, { align: 'right' })
    if (data.whatsapp) {
        doc.text(`WhatsApp: ${data.whatsapp}`, pageW - margin - 5, y + 10, { align: 'right' })
    }

    y += 30

    // ── Items table
    const tableBody = data.items.map((item, idx) => [
        String(idx + 1),
        item.name,
        `${Number(item.width).toFixed(2)} m`,
        `${Number(item.height).toFixed(2)} m`,
        `${Number(item.area).toFixed(2)} m²`,
        `€ ${Number(item.price).toFixed(2)}`,
    ])

    autoTable(doc, {
        startY: y,
        head: [['#', 'Elemento', 'Ancho', 'Alto', 'Área', 'Precio']],
        body: tableBody,
        margin: { left: margin, right: margin },
        headStyles: {
            fillColor: [NAVY.r, NAVY.g, NAVY.b],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 8.5,
        },
        bodyStyles: {
            fontSize: 8.5,
            textColor: [40, 40, 40],
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 65 },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'right', fontStyle: 'bold' },
        },
    })

    y = (doc as any).lastAutoTable.finalY + 6

    // ── Total box
    fill(doc, NAVY)
    doc.roundedRect(pageW - margin - 68, y, 68, 16, 3, 3, 'F')

    text(doc, WHITE)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL PRESUPUESTO', pageW - margin - 34, y + 5.5, { align: 'center' })

    text(doc, ACCENT)
    doc.setFontSize(13)
    doc.text(`€ ${Number(data.total).toFixed(2)}`, pageW - margin - 34, y + 13, { align: 'center' })

    y += 24

    // ── Mockup (only if there's space)
    if (data.mockup && y < pageH - 55) {
        const lines = data.mockup.split('\n')
        const maxLines = Math.floor((pageH - y - 35) / 3.8)
        const visibleLines = lines.slice(0, maxLines)
        const boxH = visibleLines.length * 3.8 + 10

        doc.setFillColor(22, 30, 46)
        doc.roundedRect(margin, y, pageW - margin * 2, boxH, 3, 3, 'F')

        doc.setTextColor(163, 230, 53)
        doc.setFontSize(6)
        doc.setFont('courier', 'normal')
        let lineY = y + 7
        for (const line of visibleLines) {
            doc.text(line, margin + 3, lineY)
            lineY += 3.8
        }
        y += boxH + 8
    }

    // ── Footer
    fill(doc, NAVY)
    doc.rect(0, pageH - 16, pageW, 16, 'F')

    text(doc, WHITE)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.text(
        'Preventiva Centro · contacto@preventivacentro.es · 637 003 793',
        pageW / 2, pageH - 9, { align: 'center' },
    )
    doc.text(
        'Presupuesto válido por 30 días · Sujeto a inspección técnica previa',
        pageW / 2, pageH - 4, { align: 'center' },
    )

    return doc.output('blob')
}

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
