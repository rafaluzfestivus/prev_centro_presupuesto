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
            let slide4 = await zip.file('ppt/slides/slide4.xml')?.async('string');
            if (slide4) {
                let textItems = data.items.map(item => `
<a:p>
    <a:pPr algn="l"><a:lnSpc><a:spcPts val="1200"/></a:lnSpc></a:pPr>
    <a:r>
        <a:rPr sz="1400" b="1"><a:solidFill><a:srgbClr val="F3F4F6"/></a:solidFill><a:latin typeface="Calibri (MS) Bold"/></a:rPr>
        <a:t>• ${item.name}: ${Number(item.width).toFixed(2)}x${Number(item.height).toFixed(2)}m (${Number(item.area).toFixed(2)}m²)</a:t>
    </a:r>
</a:p>`).join('');

                // Remove the old instruction text
                slide4 = slide4.replace('Esto es exactamente lo que necesitas.', '');

                // Inject the white items into the SUPERFICIE A PROTEGER dark box
                slide4 = slide4.replace(
                    'SUPERFICIE A PROTEGER</a:t></a:r></a:p>',
                    'SUPERFICIE A PROTEGER</a:t></a:r></a:p><a:p><a:r><a:t>  </a:t></a:r></a:p>' + textItems.replace(/\n/g, '')
                );

                let mockupXml = '';
                if (data.mockup) {
                    mockupXml = data.mockup.split('\n').map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('</a:t></a:r></a:p><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="900" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr><a:t>');
                }
                
                if (mockupXml) {
                    slide4 = slide4.replace(
                        'Vista del Proyecto</a:t></a:r></a:p>',
                        'Vista del Proyecto</a:t></a:r></a:p><a:p><a:r><a:t>  </a:t></a:r></a:p><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="900" b="1"><a:solidFill><a:srgbClr val="A3E635"/></a:solidFill><a:latin typeface="Consolas"/></a:rPr><a:t>' + mockupXml + '</a:t></a:r></a:p>'
                    );
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
        }

        // 4. Page 5: Total M2 and Total Price
        if (zip.file('ppt/slides/slide5.xml')) {
            let slide5 = await zip.file('ppt/slides/slide5.xml')?.async('string');
            if (slide5) {
                const totalPrice = Number(data.total || 0).toFixed(2);
                const totalArea = Object.values(data.items).reduce((acc, item) => acc + Number(item.area || 0), 0).toFixed(2);
                
                // Replace [PRECIO] safely checking for potential splitting
                slide5 = slide5.replace(/\[PRECIO\]/g, totalPrice);
                slide5 = slide5.replace(/\[X\]/g, totalArea);
                zip.file('ppt/slides/slide5.xml', slide5);
            }
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
