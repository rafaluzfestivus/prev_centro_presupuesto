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
        orientation: 'landscape', // The images look landscape (likely 1920x1080 or similar)
        unit: 'mm',
        format: 'a4'
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
        doc.text(data.clientName.toUpperCase(), 20, pageHeight - 30);
        doc.setFontSize(10);
        doc.text(format(new Date(), "dd/MM/yyyy"), 20, pageHeight - 20);

        // --- PAGE 2: RISK ---
        doc.addPage();
        doc.addImage(images[1], 'JPEG', 0, 0, pageWidth, pageHeight);

        // --- PAGE 3: BRAND ---
        doc.addPage();
        doc.addImage(images[2], 'JPEG', 0, 0, pageWidth, pageHeight);

        // --- PAGE 4: PROJECT DETAILS ---
        doc.addPage();
        doc.addImage(images[3], 'JPEG', 0, 0, pageWidth, pageHeight);

        doc.setTextColor(BRAND.PRIMARY_COLOR);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Ambientes a serem protegidos:', 15, 65);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        data.items.forEach((item, index) => {
            doc.text(`• ${item.name}: ${item.width.toFixed(2)}m x ${item.height.toFixed(2)}m (${item.area.toFixed(2)}m²)`, 15, 75 + (index * 6));
        });

        if (data.mockup) {
            doc.setFontSize(8);
            doc.setFont('courier', 'normal');
            doc.setTextColor(100, 100, 100);
            const mockupLines = data.mockup.split('\n');
            doc.text(mockupLines.slice(0, 15), 15, 120); // Show partial mockup if it fits
        }

        // --- PAGE 5: BUDGET ---
        doc.addPage();
        doc.addImage(images[4], 'JPEG', 0, 0, pageWidth, pageHeight);

        doc.setTextColor(BRAND.PRIMARY_COLOR);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo do Investimento', 15, 60);

        const tableData = data.items.map(item => [
            item.name,
            `${item.area.toFixed(2)}m²`,
            `€ ${item.price.toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: 70,
            margin: { left: 15, right: pageWidth / 2 + 10 }, // Keep table on the left white space
            head: [['Descrição', 'Área', 'Valor']],
            body: tableData,
            headStyles: {
                fillColor: BRAND.PRIMARY_COLOR,
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 9,
                cellPadding: 3
            },
            columnStyles: {
                2: { halign: 'right' }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(BRAND.PRIMARY_COLOR);
        doc.text(`TOTAL DO INVESTIMENTO: € ${data.total.toFixed(2)}`, 15, finalY);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text('* Pagamento facilitado e garantia de 3 anos inclusa.', 15, finalY + 8);

        // Save the PDF
        doc.save(`Proposta_Preventiva_${data.clientName.replace(/\s+/g, '_')}.pdf`);

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Erro ao gerar PDF com template. Verifique se os assets estão acessíveis.');
    }
};
