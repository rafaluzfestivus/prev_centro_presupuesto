import JSZip from 'jszip';
import type { ProposalData } from './pdfGenerator';

export interface ProposalDataPPTX extends ProposalData {
    imageUrl?: string;
    whatsapp?: string;
}

export const generateProposalPPTX = async (data: ProposalDataPPTX): Promise<Blob | null> => {
    try {
        // Fetch the template PPTX
        const response = await fetch('/assets/presupuesto_preventiva.pptx');
        if (!response.ok) throw new Error('Failed to load PPTX template');
        const buffer = await response.arrayBuffer();
        
        const zip = await JSZip.loadAsync(buffer);

        // 1. Page 1: Client Name
        if (zip.file('ppt/slides/slide1.xml')) {
            let slide1 = await zip.file('ppt/slides/slide1.xml')!.async('string');
            slide1 = slide1.replace(/\[Cliente\]/g, data.clientName);
            zip.file('ppt/slides/slide1.xml', slide1);
        }

        // 2 & 3. Page 4: Text Instruction & Mockup
        if (zip.file('ppt/slides/slide4.xml')) {
            let slide4 = await zip.file('ppt/slides/slide4.xml')!.async('string');
            
            // Build text describing the items taking the place of the static instruction
            // Use standard PPTX XML escaping mapping to not break strings
            const itemsText = data.items.map(item => 
                `• ${item.name}: ${item.width.toFixed(2)}x${item.height.toFixed(2)}m (${item.area.toFixed(2)}m²)`
            ).join('\\n');
            const instructionsText = `Superficies a proteger:\\n${itemsText}`;
            
            // Replaces "Esto es exactamente lo que necesitas."
            // PPTX text blocks are inside <a:t>. We will inject multiple <a:p> lines for multi-line.
            slide4 = slide4.replace('Esto es exactamente lo que necesitas.', itemsText.replace(/\\n/g, '</a:t></a:r></a:p><a:p><a:r><a:rPr sz="1800" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>'));
            
            // Mockup text replacements (line by line)
            // PPTX uses <a:p><a:r><a:t>Line 1</a:t></a:r></a:p> for newlines. 
            // The mockup is monospace, so we should map the string safely.
            if (data.mockup) {
                const mockupLines = data.mockup.split('\n').map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
                const mockupXml = mockupLines.join('</a:t></a:r></a:p><a:p><a:r><a:rPr sz="1200" b="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>');
                
                // Replace "Vista del Proyecto" with the mockup itself, adjusting text styling if possible.
                slide4 = slide4.replace('Vista del Proyecto', 'Vista del Proyecto</a:t></a:r></a:p><a:p><a:r><a:t>  </a:t></a:r></a:p><a:p><a:r><a:rPr sz="1200" b="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>' + mockupXml);
            }

            // Background Image replacement (slide4 background image is image2.jpeg)
            if (data.imageUrl) {
                try {
                    console.log("Fetching image for PPTX...", data.imageUrl);
                    // Use a proxy or direct fetch depending on CORS. Assuming direct fetch works for Supabase URLs.
                    const imgRes = await fetch(data.imageUrl);
                    if (imgRes.ok) {
                        const imgBlob = await imgRes.blob();
                        zip.file('ppt/media/image2.jpeg', imgBlob);
                    } else {
                        console.error("Failed to fetch image for PPTX", imgRes.status);
                    }
                } catch (e) {
                    console.error("Error fetching background image", e);
                }
            }

            zip.file('ppt/slides/slide4.xml', slide4);
        }

        // 4. Page 5: Total M2 and Total Price
        if (zip.file('ppt/slides/slide5.xml')) {
            let slide5 = await zip.file('ppt/slides/slide5.xml')!.async('string');
            slide5 = slide5.replace('\\[PRECIO\\]', data.total.toFixed(2));
            
            const totalM2 = data.items.reduce((acc, current) => acc + current.area, 0);
            slide5 = slide5.replace('\\[X\\]', totalM2.toFixed(1));
            zip.file('ppt/slides/slide5.xml', slide5);
        }

        // Return generated Blob
        const blob = await zip.generateAsync({ type: 'blob' });
        return blob;
    } catch (error) {
        console.error('Error generating PPTX:', error);
        return null;
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
