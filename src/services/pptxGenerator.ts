import JSZip from 'jszip';
import type { ProposalData } from './pdfGenerator';

export interface ProposalDataPPTX extends ProposalData {
    imageUrl?: string;
    whatsapp?: string;
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

        // ── Slide 6: Items list + ASCII mockup + background image ────────────
        if (zip.file('ppt/slides/slide6.xml')) {
            let slide6 = await zip.file('ppt/slides/slide6.xml')!.async('string')

            const textItemsXml = data.items.map(item => `
<a:p>
    <a:pPr algn="l"><a:lnSpc><a:spcPct val="120000"/></a:lnSpc></a:pPr>
    <a:r>
        <a:rPr sz="2000" b="1"><a:solidFill><a:srgbClr val="F3F4F6"/></a:solidFill><a:latin typeface="Calibri (MS) Bold"/></a:rPr>
        <a:t>• ${item.name}: ${Number(item.width).toFixed(2)}x${Number(item.height).toFixed(2)}m (${Number(item.area).toFixed(2)}m²)</a:t>
    </a:r>
</a:p>`).join('')

            const leftBoxXml = `
<p:sp>
  <p:nvSpPr><p:cNvPr id="900" name="InsertedTextItems"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="1188720" y="4600000"/><a:ext cx="8000000" cy="4000000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>
    ${textItemsXml}
  </p:txBody>
</p:sp>`

            let mockupXml = ''
            if (data.mockup) {
                const mockupLinesXml = data.mockup
                    .split('\\n')
                    .map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
                    .join('</a:t></a:r></a:p><a:p><a:pPr algn="ctr"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr><a:r><a:rPr sz="1400" b="1"><a:solidFill><a:srgbClr val="A3E635"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr><a:t>')
                mockupXml = `
<p:sp>
  <p:nvSpPr><p:cNvPr id="901" name="InsertedMockup"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="9509760" y="4600000"/><a:ext cx="7863840" cy="4000000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>
    <a:p>
        <a:pPr algn="ctr"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc></a:pPr>
        <a:r>
            <a:rPr sz="1400" b="1"><a:solidFill><a:srgbClr val="A3E635"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr>
            <a:t>${mockupLinesXml}</a:t>
        </a:r>
    </a:p>
  </p:txBody>
</p:sp>`
            }

            slide6 = slide6.replace('</p:spTree>', leftBoxXml + mockupXml + '</p:spTree>')

            if (data.imageUrl) {
                try {
                    const imgRes = await fetch(data.imageUrl)
                    if (imgRes.ok) zip.file('ppt/media/image2.jpeg', await imgRes.blob())
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
};

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
