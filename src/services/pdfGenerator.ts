import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { CONTACT, BRAND, PRICING } from '@/lib/constants';

// Type definitions
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

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
    });
};

export const generateProposalPDF = async (data: ProposalData) => {
    // Landscape orientation with custom 16:9 aspect ratio
    // Width: 297mm (A4 width), Height: 167.1mm (to match 16:9 ratio of images)
    const width = 297;
    const height = 167.1;

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [width, height]
    });

    try {
        // Load all images first
        const [img1, img2, img3, img4, img5] = await Promise.all([
            loadImage('/assets/pdf/page1.jpg'),
            loadImage('/assets/pdf/page2.jpg'),
            loadImage('/assets/pdf/page3.jpg'),
            loadImage('/assets/pdf/page4.jpg'),
            loadImage('/assets/pdf/page5.jpg'),
        ]);

        // --- Page 1 ---
        doc.addImage(img1, 'JPEG', 0, 0, width, height);

        // --- Page 2 ---
        doc.addPage([width, height]);
        doc.addImage(img2, 'JPEG', 0, 0, width, height);

        // --- Page 3 ---
        doc.addPage([width, height]);
        doc.addImage(img3, 'JPEG', 0, 0, width, height);

        // --- Page 4 (Measurements & Mockup) ---
        doc.addPage([width, height]);
        doc.addImage(img4, 'JPEG', 0, 0, width, height);

        // Page 4: Left Side (Measurements) - White Background
        doc.setTextColor(0, 0, 0); // Black text

        // Lowered Y position to avoid overlap with background text (e.g. "Basado en...")
        let yPos = 95; // Adjusted for new height (was 115)

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12); // Slightly smaller font to fit more items

        data.items.forEach(item => {
            // [Confirmação de medidas]
            const text = `• ${item.name}: ${item.width.toFixed(2)}x${item.height.toFixed(2)}m (${item.area.toFixed(2)}m²)`;
            doc.text(text, 15, yPos);
            yPos += 8; // Reduced spacing
        });

        // Page 4: Right Side (Mockups) - Dark Background
        // Starting higher to allow vertical stacking
        const rightColX = 160;
        let rightColY = 50; // Adjusted for new height (was 60)

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Mockups:", rightColX, rightColY);

        rightColY += 8;
        doc.setFont("courier", "normal");
        doc.setFontSize(10); // Reduced monospace size to fit 16:9

        // Split mockup text to fit the right column (~130mm wide)
        const splitMockup = doc.splitTextToSize(data.mockup, 130);
        doc.text(splitMockup, rightColX, rightColY);


        // --- Page 5 (Price) ---
        doc.addPage([width, height]);
        doc.addImage(img5, 'JPEG', 0, 0, width, height);

        // Page 5: Left Side (Items & Price) - White Background

        doc.setTextColor(0, 0, 0); // Default Black for items

        yPos = 60; // Adjusted for new height (was 80)

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);

        data.items.forEach(item => {
            // [item - medidas - calculo da area m2]
            const text = `• ${item.name} - ${item.width.toFixed(2)}x${item.height.toFixed(2)}m = ${item.area.toFixed(2)}m²`;
            doc.text(text, 15, yPos);
            yPos += 8;
        });

        // Total Price at Bottom Left
        const totalY = 135; // Moved up significantly (was 160)

        // Label
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(77, 42, 54); // Brand Wine Color
        doc.text("Inversión Total:", 15, totalY);

        // Value
        doc.setFontSize(22);
        doc.setTextColor(BRAND.PRIMARY_COLOR); // Brand Wine Color (Standard)
        doc.text(`€ ${data.total.toFixed(2)} + IVA`, 65, totalY);

        // Footer Contact Info
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const footerY = 158; // Moved up to valid range (max 167)
        doc.text(CONTACT.EMAIL, 15, footerY);
        doc.text(`Móvil: ${CONTACT.MOBILE}  |  Fijo: ${CONTACT.PHONE}`, 15, footerY + 5);


        // Save
        const safeName = data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`Preventiva_Presupuesto_${safeName}.pdf`);

    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Error al generar el PDF. Asegúrate de que las imágenes de fondo existan.");
    }
};

export const generateProposalBlob = async (data: ProposalData): Promise<Blob | null> => {
    // Landscape orientation with custom 16:9 aspect ratio
    const width = 297;
    const height = 167.1;

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [width, height]
    });

    try {
        // Load all images first
        const [img1, img2, img3, img4, img5] = await Promise.all([
            loadImage('/assets/pdf/page1.jpg'),
            loadImage('/assets/pdf/page2.jpg'),
            loadImage('/assets/pdf/page3.jpg'),
            loadImage('/assets/pdf/page4.jpg'),
            loadImage('/assets/pdf/page5.jpg'),
        ]);

        // --- Page 1 ---
        doc.addImage(img1, 'JPEG', 0, 0, width, height);

        // --- Page 2 ---
        doc.addPage([width, height]);
        doc.addImage(img2, 'JPEG', 0, 0, width, height);

        // --- Page 3 ---
        doc.addPage([width, height]);
        doc.addImage(img3, 'JPEG', 0, 0, width, height);

        // --- Page 4 (Measurements & Mockup) ---
        doc.addPage([width, height]);
        doc.addImage(img4, 'JPEG', 0, 0, width, height);

        // Page 4: Left Side (Measurements)
        doc.setTextColor(0, 0, 0);
        let yPos = 95;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);

        data.items.forEach(item => {
            const text = `• ${item.name}: ${item.width.toFixed(2)}x${item.height.toFixed(2)}m (${item.area.toFixed(2)}m²)`;
            doc.text(text, 15, yPos);
            yPos += 8;
        });

        // Page 4: Right Side (Mockups)
        const rightColX = 160;
        let rightColY = 50;

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Mockups:", rightColX, rightColY);

        rightColY += 8;
        doc.setFont("courier", "normal");
        doc.setFontSize(10);

        const splitMockup = doc.splitTextToSize(data.mockup, 130);
        doc.text(splitMockup, rightColX, rightColY);

        // --- Page 5 (Price) ---
        doc.addPage([width, height]);
        doc.addImage(img5, 'JPEG', 0, 0, width, height);

        // Page 5: Left Side (Items & Price)
        doc.setTextColor(0, 0, 0);
        yPos = 60;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);

        data.items.forEach(item => {
            const text = `• ${item.name} - ${item.width.toFixed(2)}x${item.height.toFixed(2)}m = ${item.area.toFixed(2)}m²`;
            doc.text(text, 15, yPos);
            yPos += 8;
        });

        // Total Price
        const totalY = 135;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(BRAND.PRIMARY_COLOR);
        doc.text("Inversión Total:", 15, totalY);

        // Value
        doc.setFontSize(22);
        doc.setTextColor(BRAND.PRIMARY_COLOR);
        doc.text(`€ ${data.total.toFixed(2)} + IVA`, 65, totalY);

        // Footer Contact Info
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const footerY = 158;
        doc.text(CONTACT.EMAIL, 15, footerY);
        doc.text(`Móvil: ${CONTACT.MOBILE}  |  Fijo: ${CONTACT.PHONE}`, 15, footerY + 5);

        return doc.output('blob');

    } catch (error) {
        console.error("Error generating PDF Blob:", error);
        return null;
    }
};
