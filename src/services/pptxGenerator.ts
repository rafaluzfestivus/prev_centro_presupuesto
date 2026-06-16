import JSZip from 'jszip';
import type { ProposalData } from './pdfGenerator';
import { getItemCategory } from '@/lib/itemTypes';

export interface ProposalDataPPTX extends ProposalData {
    imageUrl?: string;
    whatsapp?: string;
    mockupImageBlob?: Blob | null;
}

// ── XML helpers ──────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

/**
 * Replace a placeholder that PowerPoint may have split across multiple <a:r> runs.
 */
function replacePlaceholder(xml: string, placeholder: string, value: string): string {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, 'g')
    if (re.test(xml)) return xml.replace(re, value)
    return xml.replace(/(<a:p\b[^>]*>)([\s\S]*?)(<\/a:p>)/g, (match, pOpen, inner, pClose) => {
        const runMatches = [...inner.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)]
        if (!runMatches.length) return match
        const combined = runMatches
            .map(m => { const t = m[1].match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/); return t ? t[1] : '' })
            .join('')
        if (!combined.includes(placeholder)) return match
        const replaced = combined.replace(re, value)
        let firstDone = false
        const newInner = inner.replace(/<a:r>[\s\S]*?<\/a:r>/g, (run: string) => {
            if (!firstDone) { firstDone = true; return run.replace(/<a:t[^>]*>[\s\S]*?<\/a:t>/, `<a:t>${replaced}</a:t>`) }
            return ''
        })
        return pOpen + newInner + pClose
    })
}

// ── Shape content updaters ────────────────────────────────────────────────────

/**
 * Find a <p:sp> by its cNvPr name and replace its entire <p:txBody>…</p:txBody>
 * with newTxBodyInner wrapped in <p:txBody> tags.
 */
function setShapeTxBody(xml: string, shapeName: string, newTxBodyInner: string): string {
    const marker = `name="${shapeName}"`
    const nameIdx = xml.indexOf(marker)
    if (nameIdx === -1) return xml

    // Walk backwards to find the opening <p:sp> tag
    const spOpen = xml.lastIndexOf('<p:sp>', nameIdx)
    if (spOpen === -1) return xml

    // Walk forward with depth counting to find closing </p:sp>
    let depth = 0
    let pos = spOpen
    while (pos < xml.length) {
        if (/^<p:sp[\s>]/.test(xml.slice(pos))) { depth++; pos += 5 }
        else if (xml.startsWith('</p:sp>', pos)) { depth--; if (!depth) { pos += 7; break } else pos += 7 }
        else pos++
    }
    const spBlock = xml.slice(spOpen, pos)

    const tbOpen = spBlock.indexOf('<p:txBody>')
    const tbClose = spBlock.lastIndexOf('</p:txBody>') + '</p:txBody>'.length
    if (tbOpen === -1) return xml

    const newSpBlock = spBlock.slice(0, tbOpen)
        + '<p:txBody>' + newTxBodyInner + '</p:txBody>'
        + spBlock.slice(tbClose)

    return xml.slice(0, spOpen) + newSpBlock + xml.slice(pos)
}

/**
 * Find a <p:sp> by its cNvPr name and swap its fill to a blipFill (image),
 * and empty its txBody. Returns updated xml.
 */
function setShapeImageFill(xml: string, shapeName: string, rId: string): string {
    const marker = `name="${shapeName}"`
    const nameIdx = xml.indexOf(marker)
    if (nameIdx === -1) return xml

    const spOpen = xml.lastIndexOf('<p:sp>', nameIdx)
    if (spOpen === -1) return xml

    let depth = 0
    let pos = spOpen
    while (pos < xml.length) {
        if (/^<p:sp[\s>]/.test(xml.slice(pos))) { depth++; pos += 5 }
        else if (xml.startsWith('</p:sp>', pos)) { depth--; if (!depth) { pos += 7; break } else pos += 7 }
        else pos++
    }
    let spBlock = xml.slice(spOpen, pos)

    // Replace <a:noFill/> with blipFill inside spPr
    spBlock = spBlock.replace(
        /<a:noFill\/>/,
        `<a:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`,
    )

    // Empty the txBody
    const emptyTxBody = '<a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/><a:p><a:endParaRPr lang="es-ES" dirty="0"/></a:p>'
    const tbOpen = spBlock.indexOf('<p:txBody>')
    const tbClose = spBlock.lastIndexOf('</p:txBody>') + '</p:txBody>'.length
    if (tbOpen !== -1) {
        spBlock = spBlock.slice(0, tbOpen) + '<p:txBody>' + emptyTxBody + '</p:txBody>' + spBlock.slice(tbClose)
    }

    return xml.slice(0, spOpen) + spBlock + xml.slice(pos)
}

// ── Items content builder ─────────────────────────────────────────────────────

function buildItemsTxBodyInner(items: ProposalData['items']): string {
    const n = items.length
    // Slide is ~20" wide — larger fonts than standard slides
    const fontSize = n <= 3 ? 2000 : n <= 5 ? 1700 : n <= 8 ? 1400 : 1200

    const itemLines = items.map((item, idx) => {
        const name = escapeXml(item.name)
        const cat = getItemCategory(item.name)
        const isPost = cat === 'post' || cat === 'post45'
        const dims = isPost
            ? `${Math.round(Number(item.width))} uds. · ${Number(item.height).toFixed(2)}m`
            : `${Number(item.width).toFixed(2)} × ${Number(item.height).toFixed(2)}m · ${Number(item.area).toFixed(2)}m²`
        const price = `€${Number(item.price).toFixed(0)}`
        // Two lines per item: name + price on line 1, dims on line 2
        return `
<a:p>
  <a:pPr algn="l"><a:lnSpc><a:spcPct val="110000"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 0.7)}" b="0" dirty="0"><a:solidFill><a:srgbClr val="9CA3AF"/></a:solidFill><a:latin typeface="Calibri (MS)"/></a:rPr><a:t>${idx + 1}.  </a:t></a:r>
  <a:r><a:rPr lang="es-ES" sz="${fontSize}" b="1" dirty="0"><a:solidFill><a:srgbClr val="F3F4F6"/></a:solidFill><a:latin typeface="Calibri (MS) Bold"/></a:rPr><a:t>${name}  </a:t></a:r>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 1.05)}" b="1" dirty="0"><a:solidFill><a:srgbClr val="EAB308"/></a:solidFill><a:latin typeface="Calibri (MS) Bold"/></a:rPr><a:t>${price}</a:t></a:r>
</a:p>
<a:p>
  <a:pPr algn="l" indent="228600"><a:lnSpc><a:spcPct val="90000"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 0.75)}" b="0" dirty="0"><a:solidFill><a:srgbClr val="6B7280"/></a:solidFill><a:latin typeface="Calibri (MS)"/></a:rPr><a:t>${dims}</a:t></a:r>
</a:p>`
    }).join('')

    const total = items.reduce((s, i) => s + Number(i.price), 0)
    const netItems = items.filter(i => getItemCategory(i.name) === 'net')
    const totalArea = netItems.reduce((s, i) => s + Number(i.area), 0)

    const headerLine = `
<a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>
<a:p><a:pPr algn="l"><a:lnSpc><a:spcPct val="130000"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 0.85)}" b="1" dirty="0"><a:solidFill><a:srgbClr val="EAB308"/></a:solidFill><a:latin typeface="Calibri (MS) Bold"/></a:rPr><a:t>MEDIDAS Y PRECIOS</a:t></a:r>
</a:p>
${itemLines}
<a:p><a:pPr algn="l"><a:lnSpc><a:spcPct val="150000"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 0.65)}" b="0" dirty="0"><a:solidFill><a:srgbClr val="4B5563"/></a:solidFill></a:rPr><a:t>──────────────────────────</a:t></a:r>
</a:p>
<a:p><a:pPr algn="l"/>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 0.85)}" b="0" dirty="0"><a:solidFill><a:srgbClr val="D1D5DB"/></a:solidFill><a:latin typeface="Calibri (MS)"/></a:rPr><a:t>${totalArea > 0 ? `${totalArea.toFixed(2)} m² · ` : ''}${items.length} piezas</a:t></a:r>
</a:p>
<a:p><a:pPr algn="l"/>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 1.15)}" b="1" dirty="0"><a:solidFill><a:srgbClr val="EAB308"/></a:solidFill><a:latin typeface="Calibri (MS) Bold"/></a:rPr><a:t>TOTAL: €${total.toFixed(2)}</a:t></a:r>
</a:p>`

    return headerLine
}

// ── Main generator ───────────────────────────────────────────────────────────

export const generateProposalPPTX = async (data: ProposalDataPPTX): Promise<Blob | null> => {
    try {
        const isEste = data.city?.toLowerCase().includes('este')
        const templatePath = isEste
            ? '/assets/presupuesto_prev_este_v2.pptx'
            : '/assets/presupuesto_prev_centro_v2.pptx'
        const response = await fetch(templatePath)
        if (!response.ok) throw new Error(`Failed to load PPTX template: ${templatePath}`)
        const buffer = await response.arrayBuffer()
        const zip = await JSZip.loadAsync(buffer)

        // ── Slide 1: Cover ───────────────────────────────────────────────────
        if (zip.file('ppt/slides/slide1.xml')) {
            let slide1 = await zip.file('ppt/slides/slide1.xml')!.async('string')
            slide1 = replacePlaceholder(slide1, '[cliente]', data.clientName)
            zip.file('ppt/slides/slide1.xml', slide1)
        }

        // ── Slide 6: Items + Mockup ──────────────────────────────────────────
        if (zip.file('ppt/slides/slide6.xml')) {
            let slide6 = await zip.file('ppt/slides/slide6.xml')!.async('string')

            // Fill InsertedTextItems with items list (update content in-place)
            slide6 = setShapeTxBody(slide6, 'InsertedTextItems', buildItemsTxBodyInner(data.items))

            // Fill InsertedMockup with image or ASCII fallback
            if (data.mockupImageBlob) {
                const relsPath = 'ppt/slides/_rels/slide6.xml.rels'
                const MOCKUP_RID = 'rId_mockup'

                zip.file('ppt/media/mockup_img.png', data.mockupImageBlob)

                if (zip.file(relsPath)) {
                    let rels = await zip.file(relsPath)!.async('string')
                    if (!rels.includes(MOCKUP_RID)) {
                        rels = rels.replace(
                            '</Relationships>',
                            `<Relationship Id="${MOCKUP_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/mockup_img.png"/></Relationships>`,
                        )
                        zip.file(relsPath, rels)
                    }
                }

                slide6 = setShapeImageFill(slide6, 'InsertedMockup', MOCKUP_RID)
            } else if (data.mockup) {
                // ASCII text fallback
                const mockupLinesXml = data.mockup
                    .split('\n')
                    .map(line => escapeXml(line))
                    .join('</a:t></a:r></a:p><a:p><a:pPr algn="ctr"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr><a:r><a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="A3E635"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr><a:t>')

                slide6 = setShapeTxBody(
                    slide6,
                    'InsertedMockup',
                    `<a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>
<a:p><a:pPr algn="ctr"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr>
  <a:r><a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="A3E635"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr>
    <a:t>${mockupLinesXml}</a:t>
  </a:r>
</a:p>`,
                )
            }

            // Client photo as background image (optional)
            if (data.imageUrl) {
                try {
                    const imgRes = await fetch(data.imageUrl)
                    if (imgRes.ok) zip.file('ppt/media/image1.jpeg', await imgRes.blob())
                } catch (e) {
                    console.error('Error fetching background image', e)
                }
            }

            zip.file('ppt/slides/slide6.xml', slide6)
        }

        // ── Slide 7: Pricing ─────────────────────────────────────────────────
        if (zip.file('ppt/slides/slide7.xml')) {
            let slide7 = await zip.file('ppt/slides/slide7.xml')!.async('string')
            const totalPrice = Number(data.total || 0).toFixed(2)
            const totalArea = data.items.reduce((acc, item) => acc + Number(item.area || 0), 0).toFixed(2)
            slide7 = replacePlaceholder(slide7, '[valor]', totalPrice)
            slide7 = replacePlaceholder(slide7, '[area]', totalArea)
            zip.file('ppt/slides/slide7.xml', slide7)
        }

        return await zip.generateAsync({ type: 'blob' })
    } catch (error) {
        console.error('Error generating PPTX:', error)
        return null
    }
}

export const downloadProposalPPTX = async (data: ProposalDataPPTX) => {
    const blob = await generateProposalPPTX(data)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const safeName = data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    link.download = `Preventiva_Presupuesto_${safeName}.pptx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

/** Generate a PPSX blob (slideshow mode) from the same PPTX content. */
export const generateProposalPPSX = async (data: ProposalDataPPTX): Promise<Blob | null> => {
    const pptxBlob = await generateProposalPPTX(data)
    if (!pptxBlob) return null
    const zip = await JSZip.loadAsync(pptxBlob)
    if (zip.file('[Content_Types].xml')) {
        let ct = await zip.file('[Content_Types].xml')!.async('string')
        ct = ct.replace(
            'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
            'application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml',
        )
        zip.file('[Content_Types].xml', ct)
    }
    return await zip.generateAsync({ type: 'blob' })
}

export const downloadProposalPPSX = async (data: ProposalDataPPTX) => {
    const blob = await generateProposalPPSX(data)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const safeName = data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    link.download = `Preventiva_Presupuesto_${safeName}.ppsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
