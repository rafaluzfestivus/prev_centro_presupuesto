import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BRAND, CONTACT } from './constants';
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
}

export const generateProposalPDF = (data: ProposalData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // --- Page 1: Design Header & Client Info ---

    // Header Wine Rectangle
    doc.setFillColor(BRAND.PRIMARY_COLOR);
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Company Name / Logo Placeholder
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('PREVENTIVA NORTE', 20, 25);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Especialistas em Redes de Proteção', 20, 32);

    // Date
    const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    doc.setFontSize(10);
    doc.text(today, pageWidth - 20, 25, { align: 'right' });

    // Client Info Section
    doc.setTextColor(BRAND.SECONDARY_COLOR);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPOSTA COMERCIAL', 20, 55);

    doc.setDrawColor(BRAND.ACCENT_COLOR);
    doc.setLineWidth(1);
    doc.line(20, 58, 80, 58);

    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${data.clientName}`, 20, 70);
    doc.text(`Cidade: ${data.city || 'N/A'}`, 20, 77);
    doc.text(`WhatsApp: ${data.whatsapp || 'N/A'}`, 20, 84);

    // --- Page 1: Items Table ---

    const tableData = data.items.map(item => [
        item.name,
        `${item.width.toFixed(2)}m`,
        `${item.height.toFixed(2)}m`,
        `${item.area.toFixed(2)}m²`,
        `€ ${item.price.toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: 95,
        head: [['Ambiente', 'Largura', 'Altura', 'Área', 'Valor']],
        body: tableData,
        headStyles: {
            fillColor: BRAND.PRIMARY_COLOR,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold' },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'right', fontStyle: 'bold' }
        },
        styles: {
            fontSize: 10,
            cellPadding: 5
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        }
    });

    // --- Summary & Total ---

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Total Box
    doc.setFillColor(BRAND.SECONDARY_COLOR);
    doc.rect(pageWidth - 80, finalY, 60, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('TOTAL GERAL', pageWidth - 75, finalY + 7);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`€ ${data.total.toFixed(2)}`, pageWidth - 75, finalY + 15);

    // --- Footer ---

    doc.setDrawColor(200, 200, 200);
    doc.line(20, pageHeight - 30, pageWidth - 20, pageHeight - 30);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text([
        `Contacto: ${CONTACT.PHONE} / ${CONTACT.MOBILE}`,
        `E-mail: ${CONTACT.EMAIL}`,
        'Obrigado pela preferência!'
    ], pageWidth / 2, pageHeight - 20, { align: 'center' });

    // Save the PDF
    doc.save(`Proposta_${data.clientName.replace(/\s+/g, '_')}.pdf`);
};
