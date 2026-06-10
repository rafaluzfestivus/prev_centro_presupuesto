import JSZip from 'jszip';
import type { ProposalData } from './pdfGenerator';

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
 * Within each <a:p>, merges all run texts, checks for the placeholder, and if found
 * rebuilds the paragraph with the replacement in the first run (dropping extra runs).
 */
function replacePlaceholder(xml: string, placeholder: string, value: string): string {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, 'g')

    // Fast path: placeholder is not split
    if (re.test(xml)) return xml.replace(re, value)

    // Slow path: placeholder may be split across runs within a paragraph
    return xml.replace(/(<a:p\b[^>]*>)([\s\S]*?)(<\/a:p>)/g, (match, pOpen, inner, pClose) => {
        const runMatches = [...inner.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)]
        if (runMatches.length === 0) return match

        const combined = runMatches
            .map(m => { const t = m[1].match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/); return t ? t[1] : '' })
            .join('')

        if (!combined.includes(placeholder)) return match

        const replaced = combined.replace(re, value)
        let firstDone = false
        const newInner = inner.replace(/<a:r>[\s\S]*?<\/a:r>/g, (run: string) => {
            if (!firstDone) {
                firstDone = true
                return run.replace(/<a:t[^>]*>[\s\S]*?<\/a:t>/, `<a:t>${replaced}</a:t>`)
            }
            return ''
        })
        return pOpen + newInner + pClose
    })
}

// Remove previously injected shapes so re-generation doesn't accumulate them
function removeInjectedShapes(xml: string): string {
    const names = ['InsertedTextItems', 'InsertedMockup', 'InsertedItemsNew', 'InsertedMockupImage']
    let result = xml
    for (const name of names) {
        // Remove <p:sp> blocks
        const spRe = new RegExp(
            `<p:sp>\\s*<p:nvSpPr>\\s*<p:cNvPr[^>]*name="${name}"[\\s\\S]*?</p:sp>`,
            'g',
        )
        result = result.replace(spRe, '')
        // Remove <p:pic> blocks
        const picRe = new RegExp(
            `<p:pic>\\s*<p:nvPicPr>\\s*<p:cNvPr[^>]*name="${name}"[\\s\\S]*?</p:pic>`,
            'g',
        )
        result = result.replace(picRe, '')
    }
    return result
}

// ── Items text box ───────────────────────────────────────────────────────────

function buildItemsXml(items: ProposalData['items']): string {
    const n = items.length
    // Slide is ~20" wide — use larger font sizes than standard
    const fontSize = n <= 4 ? 2200 : n <= 7 ? 1900 : n <= 11 ? 1600 : 1400

    const itemLines = items.map((item, idx) => {
        const name = escapeXml(item.name)
        const dims = `${Number(item.width).toFixed(2)}×${Number(item.height).toFixed(2)}m`
        const area = `${Number(item.area).toFixed(2)}m²`
        const price = `€${Number(item.price).toFixed(0)}`

        return `
<a:p>
  <a:pPr algn="l"><a:lnSpc><a:spcPct val="108000"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 0.75)}" b="0" dirty="0">
    <a:solidFill><a:srgbClr val="9CA3AF"/></a:solidFill>
    <a:latin typeface="Calibri (MS)"/>
  </a:rPr><a:t>${idx + 1}. </a:t></a:r>
  <a:r><a:rPr lang="es-ES" sz="${fontSize}" b="1" dirty="0">
    <a:solidFill><a:srgbClr val="F3F4F6"/></a:solidFill>
    <a:latin typeface="Calibri (MS) Bold"/>
  </a:rPr><a:t>${name}</a:t></a:r>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 0.82)}" b="0" dirty="0">
    <a:solidFill><a:srgbClr val="9CA3AF"/></a:solidFill>
    <a:latin typeface="Calibri (MS)"/>
  </a:rPr><a:t>  ${dims} · ${area}</a:t></a:r>
  <a:r><a:rPr lang="es-ES" sz="${fontSize}" b="1" dirty="0">
    <a:solidFill><a:srgbClr val="EAB308"/></a:solidFill>
    <a:latin typeface="Calibri (MS) Bold"/>
  </a:rPr><a:t>  ${price}</a:t></a:r>
</a:p>`
    }).join('')

    const total = items.reduce((s, i) => s + Number(i.price), 0)
    const totalArea = items.reduce((s, i) => s + Number(i.area), 0)

    const summaryLine = `
<a:p><a:pPr algn="l"><a:lnSpc><a:spcPct val="160000"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 0.7)}" b="0" dirty="0">
    <a:solidFill><a:srgbClr val="4B5563"/></a:solidFill>
  </a:rPr><a:t>──────────────────────────────</a:t></a:r>
</a:p>
<a:p><a:pPr algn="l"/>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 0.85)}" b="0" dirty="0">
    <a:solidFill><a:srgbClr val="D1D5DB"/></a:solidFill>
    <a:latin typeface="Calibri (MS)"/>
  </a:rPr><a:t>${totalArea.toFixed(2)} m² · ${items.length} piezas</a:t></a:r>
</a:p>
<a:p><a:pPr algn="l"/>
  <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 1.2)}" b="1" dirty="0">
    <a:solidFill><a:srgbClr val="EAB308"/></a:solidFill>
    <a:latin typeface="Calibri (MS) Bold"/>
  </a:rPr><a:t>TOTAL: €${total.toFixed(2)}</a:t></a:r>
</a:p>`

    // Left zone: x=1.2" y=4.5" w=8.3" h=6.0"  (in EMU at 914400/inch)
    // Left zone body starts below "SUPERFICIE A PROTEGER" header (which ends at ~4.5")
    return `
<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="900" name="InsertedItemsNew"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="1097280" y="4572000"/><a:ext cx="7600000" cy="5500000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" rtlCol="0"><a:normAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="l"><a:lnSpc><a:spcPct val="140000"/></a:lnSpc></a:pPr>
      <a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 0.85)}" b="1" dirty="0">
        <a:solidFill><a:srgbClr val="EAB308"/></a:solidFill>
        <a:latin typeface="Calibri (MS) Bold"/>
      </a:rPr><a:t>MEDIDAS Y PRECIOS</a:t></a:r>
    </a:p>
    ${itemLines}
    ${summaryLine}
  </p:txBody>
</p:sp>`
}

// ── Mockup image pic element ─────────────────────────────────────────────────

function buildMockupPicXml(rId: string): string {
    // Right zone: x=10.6" y=4.5" w=8.7" h=6.0"
    return `
<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="901" name="InsertedMockupImage"/>
    <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="${rId}"/>
    <a:stretch><a:fillRect/></a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm><a:off x="9700000" y="4572000"/><a:ext cx="8300000" cy="5500000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
</p:pic>`
}

// ── Main generator ───────────────────────────────────────────────────────────

export const generateProposalPPTX = async (data: ProposalDataPPTX): Promise<Blob | null> => {
    try {
        // Load city-specific v2 template
        const isEste = data.city?.toLowerCase().includes('este')
        const templatePath = isEste
            ? '/assets/presupuesto_prev_este_v2.pptx'
            : '/assets/presupuesto_prev_centro_v2.pptx'
        const response = await fetch(templatePath)
        if (!response.ok) throw new Error(`Failed to load PPTX template: ${templatePath}`)
        const buffer = await response.arrayBuffer()

        const zip = await JSZip.loadAsync(buffer)

        // ── Slide 1: Cover — replace [cliente] ───────────────────────────────
        if (zip.file('ppt/slides/slide1.xml')) {
            let slide1 = await zip.file('ppt/slides/slide1.xml')!.async('string')
            slide1 = replacePlaceholder(slide1, '[cliente]', data.clientName)
            zip.file('ppt/slides/slide1.xml', slide1)
        }

        // ── Slide 6: Items + Mockup image ────────────────────────────────────
        if (zip.file('ppt/slides/slide6.xml')) {
            let slide6 = await zip.file('ppt/slides/slide6.xml')!.async('string')

            // Remove any shapes from previous generation runs
            slide6 = removeInjectedShapes(slide6)

            // Build items list shape (left zone)
            const itemsXml = buildItemsXml(data.items)

            let mockupXml = ''
            let relsUpdated = false

            if (data.mockupImageBlob) {
                // Insert mockup PNG as an actual image in the right zone
                const relsPath = 'ppt/slides/_rels/slide6.xml.rels'
                const MOCKUP_RID = 'rId_mockup'
                const MOCKUP_MEDIA = 'ppt/media/mockup_img.png'

                // Add image to media
                zip.file(MOCKUP_MEDIA, data.mockupImageBlob)

                // Add relationship
                if (zip.file(relsPath)) {
                    let rels = await zip.file(relsPath)!.async('string')
                    if (!rels.includes(MOCKUP_RID)) {
                        const newRel = `<Relationship Id="${MOCKUP_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/mockup_img.png"/>`
                        rels = rels.replace('</Relationships>', newRel + '</Relationships>')
                        zip.file(relsPath, rels)
                    }
                }

                mockupXml = buildMockupPicXml(MOCKUP_RID)
                relsUpdated = true
            } else if (data.mockup) {
                // Fallback: ASCII text box (legacy)
                const mockupLinesXml = data.mockup
                    .split('\n')
                    .map(line => escapeXml(line))
                    .join('</a:t></a:r></a:p><a:p><a:pPr algn="ctr"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr><a:r><a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="A3E635"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr><a:t>')

                mockupXml = `
<p:sp>
  <p:nvSpPr><p:cNvPr id="901" name="InsertedMockupImage"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="9800000" y="1828800"/><a:ext cx="8200000" cy="8000000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>
    <a:p>
      <a:pPr algn="ctr"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr>
      <a:r>
        <a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="A3E635"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr>
        <a:t>${mockupLinesXml}</a:t>
      </a:r>
    </a:p>
  </p:txBody>
</p:sp>`
            }

            slide6 = slide6.replace('</p:spTree>', itemsXml + mockupXml + '</p:spTree>')

            // Optionally update background image (client photo)
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

        // ── Slide 7: Pricing — replace [valor] and [area] ────────────────────
        if (zip.file('ppt/slides/slide7.xml')) {
            let slide7 = await zip.file('ppt/slides/slide7.xml')!.async('string')
            const totalPrice = Number(data.total || 0).toFixed(2)
            const totalArea = data.items
                .reduce((acc, item) => acc + Number(item.area || 0), 0)
                .toFixed(2)
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
    const blob = await generateProposalPPTX(data);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `Preventiva_Presupuesto_${safeName}.pptx`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/** Generate a PPSX blob (slideshow mode) from the same PPTX content. */
export const generateProposalPPSX = async (data: ProposalDataPPTX): Promise<Blob | null> => {
    const pptxBlob = await generateProposalPPTX(data);
    if (!pptxBlob) return null;

    const zip = await JSZip.loadAsync(pptxBlob);

    // Switch content type from presentation to slideshow
    if (zip.file('[Content_Types].xml')) {
        let ct = await zip.file('[Content_Types].xml')!.async('string');
        ct = ct.replace(
            'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
            'application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml',
        );
        zip.file('[Content_Types].xml', ct);
    }

    return await zip.generateAsync({ type: 'blob' });
};

export const downloadProposalPPSX = async (data: ProposalDataPPTX) => {
    const blob = await generateProposalPPSX(data);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `Preventiva_Presupuesto_${safeName}.ppsx`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
