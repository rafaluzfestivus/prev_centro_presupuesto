
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
    // Landscape orientation
    const doc = new jsPDF({ orientation: 'landscape' });
    const width = 297; // A4 landscape width in mm
    const height = 210; // A4 landscape height in mm

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
        doc.addPage();
        doc.addImage(img2, 'JPEG', 0, 0, width, height);

        // --- Page 3 ---
        doc.addPage();
        doc.addImage(img3, 'JPEG', 0, 0, width, height);

        // --- Page 4 (Measurements & Mockup) ---
        doc.addPage();
        doc.addImage(img4, 'JPEG', 0, 0, width, height);

        // Page 4: Left Side (Measurements) - White Background
        doc.setTextColor(0, 0, 0); // Black text

        // Lowered Y position to avoid overlap with background text (e.g. "Basado en...")
        let yPos = 115; // Set to 115 as requested (higher than 130)

        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);

        data.items.forEach(item => {
            // [Confirmação de medidas]
            const text = `• ${item.name}: ${item.width.toFixed(2)}x${item.height.toFixed(2)}m (${item.area.toFixed(2)}m²)`;
            doc.text(text, 20, yPos);
            yPos += 10;
        });

        // Page 4: Right Side (Mockups) - Dark Background
        // Starting higher to allow vertical stacking
        const rightColX = 160;
        let rightColY = 60;

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Mockups:", rightColX, rightColY);

        rightColY += 10;
        doc.setFont("courier", "normal");
        doc.setFontSize(12); // Increased monospace size to 12

        // Split mockup text to fit the right column (~130mm wide)
        const splitMockup = doc.splitTextToSize(data.mockup, 130);
        doc.text(splitMockup, rightColX, rightColY);


        // --- Page 5 (Price) ---
        doc.addPage();
        doc.addImage(img5, 'JPEG', 0, 0, width, height);

        // Page 5: Left Side (Items & Price) - White Background

        doc.setTextColor(0, 0, 0); // Default Black for items

        yPos = 80; // Raised slightly from 90 to 80

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);

        data.items.forEach(item => {
            // [item - medidas - calculo da area m2]
            const text = `• ${item.name} - ${item.width.toFixed(2)}x${item.height.toFixed(2)}m = ${item.area.toFixed(2)}m²`;
            doc.text(text, 20, yPos);
            yPos += 10;
        });

        // Total Price at Bottom Left
        const totalY = 160;

        // Label
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(77, 42, 54); // Brand Wine Color
        doc.text("Inversión Total:", 20, totalY);

        // Value
        doc.setFontSize(22); // Decreased slightly to 22
        doc.setTextColor(77, 42, 54); // Brand Wine Color (Standard)
        doc.text(`€ ${data.total.toFixed(2)} + IVA`, 70, totalY);

        // Footer Contact Info
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text("contacto@preventivacentro.es", 20, 190);
        doc.text("Móvil: 637 003 793  |  Fijo: 91 209 61 17", 20, 195);


        // Save
        const safeName = data.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`Preventiva_Propuesta_${safeName}.pdf`);

    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Error al generar el PDF. Asegúrate de que las imágenes de fondo existan.");
    }
};
