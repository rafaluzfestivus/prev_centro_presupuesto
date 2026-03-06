import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BRAND } from './constants';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProposalItem {
    name: string;
    width: number;
    height: number;
    area: number;
    price: number;
}

interface ProposalData {
    clientName: string;
    city: string;
    items: ProposalItem[];
    total: number;
    whatsapp: string;
    mockup?: string;
}

const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            } else {
                reject(new Error('Could not get canvas context'));
            }
        };
        img.onerror = () => reject(new Error(`Could not load image at ${url}`));
        img.src = url;
    });
};

export const generateProposalPDF = async (data: ProposalData) => {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [297, 167] // Approximately 16:9 aspect ratio
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    try {
        // Prepare image URLs
        const imgUrls = [
            '/assets/pdf/page1.jpg',
            '/assets/pdf/page2.jpg',
            '/assets/pdf/page3.jpg',
            '/assets/pdf/page4.jpg',
            '/assets/pdf/page5.jpg'
        ];

        // Load all images
        const images = await Promise.all(imgUrls.map(url => loadImage(url)));

        // --- PAGE 1: COVER ---
        doc.addImage(images[0], 'JPEG', 0, 0, pageWidth, pageHeight);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        // More space for the name
        doc.text(data.clientName.toUpperCase(), 20, pageHeight - 25);
        doc.setFontSize(10);
        doc.text(format(new Date(), "dd/MM/yyyy"), 20, pageHeight - 15);

        // --- PAGE 2: RISK ---
        doc.addPage();
        doc.addImage(images[1], 'JPEG', 0, 0, pageWidth, pageHeight);

        // --- PAGE 3: BRAND ---
        doc.addPage();
        doc.addImage(images[2], 'JPEG', 0, 0, pageWidth, pageHeight);

        // --- PAGE 4: PROJECT DETAILS ---
        doc.addPage();
        doc.addImage(images[3], 'JPEG', 0, 0, pageWidth, pageHeight);

        // Background has "Confirmación de Medidas" and "Basado en tu descrição, cubriremos:"
        // We start lower to avoid overlap (Basado... is at ~65mm)
        let currentY = 90;

        doc.setTextColor(BRAND.PRIMARY_COLOR);
        doc.setFontSize(9); // More compact for many items
        doc.setFont('helvetica', 'normal');
        data.items.forEach((item) => {
            doc.text(`• ${item.name}: ${item.width.toFixed(2)}m x ${item.height.toFixed(2)}m (${item.area.toFixed(2)}m²)`, 15, currentY);
            currentY += 5.5;
        });

        // Mockup - Positioned lower to avoid overlap with large lists
        if (data.mockup) {
            doc.setFontSize(7);
            doc.setFont('courier', 'normal');
            doc.setTextColor(200, 200, 200);
            const mockupLines = data.mockup.split('\n');
            doc.text(mockupLines.slice(0, 12), 15, 132);
        }

        // --- PAGE 5: BUDGET ---
        doc.addPage();
        doc.addImage(images[4], 'JPEG', 0, 0, pageWidth, pageHeight);

        // Gap between "¿Qué incluye su inversión?" and bullets is around 65-135mm
        const tableData = data.items.map(item => [
            item.name,
            `${item.area.toFixed(2)}m²`,
            `€ ${item.price.toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: 68, // Slightly higher to fit more items and leave room for Total
            margin: { left: 15, right: pageWidth / 2 + 10 },
            head: [['Descrição', 'Área', 'Valor']],
            body: tableData,
            headStyles: {
                fillColor: BRAND.PRIMARY_COLOR,
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 9,
                cellPadding: 2.5
            },
            columnStyles: {
                2: { halign: 'right' }
            },
            didDrawPage: (data) => {
                // Background images should not be repeated on new pages if table overflows
                // But autoTable might create a new page if list is long. 
                // For now we assume typical proposals fit.
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(BRAND.PRIMARY_COLOR);
        doc.text(`TOTAL DO INVESTIMENTO: € ${data.total.toFixed(2)}`, 15, finalY);

        // Save the PDF
        doc.save(`Proposta_Preventiva_${data.clientName.replace(/\s+/g, '_')}.pdf`);

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Erro ao gerar PDF com template. Verifique se os assets estão acessíveis.');
    }
};
