import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PresentialEvent } from '../../../types/presentialEvent.js';

export async function generateEventTicketPdf(
  event: PresentialEvent,
  buyerData: { name: string; email: string; cpf: string }
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  const { width, height } = page.getSize();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Background Header
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width,
    height: 100,
    color: rgb(0.88, 0.11, 0.28), // Insanus Red
  });

  // Title
  page.drawText('COMPROVANTE DE INSCRIÇÃO', {
    x: 40,
    y: height - 55,
    size: 24,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  page.drawText('EVENTO PRESENCIAL', {
    x: 40,
    y: height - 80,
    size: 14,
    font: regularFont,
    color: rgb(1, 1, 1),
  });

  // Event Details
  const startY = height - 150;
  
  page.drawText('EVENTO:', { x: 40, y: startY, size: 10, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
  page.drawText(event.title.toUpperCase(), { x: 40, y: startY - 20, size: 16, font: boldFont });

  page.drawText('DATA:', { x: 40, y: startY - 60, size: 10, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
  const eventDate = event.date instanceof Date ? event.date : (event.date as any).toDate();
  page.drawText(eventDate.toLocaleDateString('pt-BR'), { x: 40, y: startY - 75, size: 12, font: regularFont });

  page.drawText('HORÁRIO:', { x: 180, y: startY - 60, size: 10, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
  page.drawText(event.startTime, { x: 180, y: startY - 75, size: 12, font: regularFont });

  page.drawText('LOCAL:', { x: 40, y: startY - 110, size: 10, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
  const location = event.locationType === 'POLO_RI' ? 'Polo INSANUS CONCURSOS (Rio Branco/AC)' : 
                   event.locationType === 'POLO_PV' ? 'Polo GABARITO CONCURSOS (Porto Velho/RO)' : 
                   event.customLocation || 'Não definido';
  page.drawText(location, { x: 40, y: startY - 125, size: 12, font: regularFont });

  // Buyer Info
  page.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: 80,
    color: rgb(0.96, 0.96, 0.96),
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  });

  page.drawText('PARTICIPANTE:', { x: 60, y: 100, size: 9, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(buyerData.name.toUpperCase(), { x: 60, y: 85, size: 12, font: boldFont });
  
  page.drawText('CPF:', { x: 60, y: 65, size: 9, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(buyerData.cpf, { x: 90, y: 65, size: 10, font: regularFont });

  page.drawText('ID:', { x: width - 150, y: 100, size: 9, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(Math.random().toString(36).substring(7).toUpperCase(), { x: width - 150, y: 85, size: 12, font: boldFont });

  // Footer note
  page.drawText('Apresente este comprovante na entrada do evento.', {
    x: 40,
    y: 20,
    size: 8,
    font: regularFont,
    color: rgb(0.6, 0.6, 0.6),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
