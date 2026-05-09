import JSZip from 'jszip';
import type { ProposalData } from './pdfGenerator';

export interface ProposalDataPPTX extends ProposalData {
    imageUrl?: string;
    whatsapp?: string;
}

/** Extract plain text from slide XML (strips all tags) */
function slideText(xml: string): string {
    return xml.replace(/<[^>]+>/g, ' ')
}

/** List all slide file paths sorted by slide number */
function listSlides(zip: JSZip): string[] {
    return Object.keys(zip.files)
        .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => {
            const na = parseInt(a.match(/\d+/)![0])
            const nb = parseInt(b.match(/\d+/)![0])
            return na - nb
        })
}

export const generateProposalPPTX = async (data: ProposalDataPPTX): Promise<Blob | null> => {
    try {
        // Load city-specific v2 template
        const isEste = data.city?.toLowerCase().includes('este')
        const templatePath = isEste
            ? '/assets/presupuesto_prev_este_v2.pptx'
            : '/assets/presupuesto_prev_centro_v2.pptx'
        let response = await fetch(templatePath)
        if (!response.ok) throw new Error(`Failed to load PPTX template: ${templatePath}`)
        const buffer = await response.arrayBuffer()

        const zip = await JSZip.loadAsync(buffer)
        const slides = listSlides(zip)

        for (const slidePath of slides) {
            let xml = await zip.file(slidePath)!.async('string')
            const text = slideText(xml)
            let changed = false

            // ── Cover slide: contains [Cliente] ──────────────────────────────
            if (text.includes('[Cliente]')) {
                xml = xml.replace(/\[Cliente\]/g, data.clientName)
                changed = true
            }

            // ── Items + mockup slide: contains the instruction text placeholder ─
            if (text.includes('Esto es exactamente lo que necesitas.')) {
                xml = xml.replace('Esto es exactamente lo que necesitas.', '')

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

                xml = xml.replace('</p:spTree>', leftBoxXml + mockupXml + '</p:spTree>')

                // Replace background image on this slide if provided
                if (data.imageUrl) {
                    try {
                        const imgRes = await fetch(data.imageUrl)
                        if (imgRes.ok) {
                            const imgBlob = await imgRes.blob()
                            zip.file('ppt/media/image2.jpeg', imgBlob)
                        }
                    } catch (e) {
                        console.error('Error fetching background image', e)
                    }
                }

                changed = true
            }

            // ── Pricing slide: contains [PRECIO] or [X] ──────────────────────
            if (text.includes('[PRECIO]') || text.includes('[X]')) {
                const totalPrice = Number(data.total || 0).toFixed(2)
                const totalArea = data.items
                    .reduce((acc, item) => acc + Number(item.area || 0), 0)
                    .toFixed(2)
                xml = xml.replace(/\[PRECIO\]/g, totalPrice)
                xml = xml.replace(/\[X\]/g, totalArea)
                changed = true
            }

            if (changed) zip.file(slidePath, xml)
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

    // Create download link
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
