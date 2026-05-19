import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fetch from 'node-fetch'; // Requires node-fetch if Node < 18, but Vite env uses Node 18+ global fetch
import { getAdminConfig } from './firebaseAdmin.js';

export async function addWatermarkToPdf(
  inputSource: { type: 'url', url: string } | { type: 'base64', base64: string },
  uid: string
): Promise<Buffer> {
  const { dbAdmin, authAdmin } = getAdminConfig();
  
  // 1. Fetch User Data
  let userData: any = null;
  try {
      const userDoc = await dbAdmin.collection('users').doc(uid).get();
      if (userDoc.exists) {
         userData = userDoc.data();
      } else {
         const userRecord = await authAdmin.getUser(uid);
         userData = { 
            name: userRecord.displayName, 
            email: userRecord.email,
            cpf: 'CPF NÃO INFORMADO'
         };
      }
  } catch (err) {
      console.error("Error fetching user data for watermark", err);
      throw new Error("Could not verify user for watermarking");
  }

  const name = userData?.name || userData?.displayName || 'Usuário';
  const email = userData?.email || '';
  const cpf = userData?.cpf || userData?.document || 'CPF N/A';
  
  // Watermark text: Literal Name - Email - CPF
  const watermarkText = `${name.toUpperCase()} - ${email} - ${cpf}`;

  // 2. Load the PDF
  let pdfBytes: ArrayBuffer | Buffer;
  
  if (inputSource.type === 'url') {
    const response = await fetch(inputSource.url);
    if (!response.ok) throw new Error("Could not download the source PDF");
    pdfBytes = await response.arrayBuffer();
  } else {
    // base64 parsing
    const base64Data = inputSource.base64.replace(/^data:application\/pdf;base64,/, '');
    pdfBytes = Buffer.from(base64Data, 'base64');
  }

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  // 3. Apply Watermark
  const fontSize = 9;
  // Estimate text width (approx 5.5 units per char for standard Helvetica at size 9)
  const textWidthEstimate = watermarkText.length * 5;

  for (const page of pages) {
    const { width, height } = page.getSize();
    
    // Draw centered watermark at the absolute top margin (header)
    page.drawText(watermarkText, {
        x: (width / 2) - (textWidthEstimate / 2),
        y: height - 15, // Positioning at the very top margin
        size: fontSize,
        color: rgb(0.85, 0.1, 0.1), // Distinct Red
        opacity: 0.6, // Legible but semi-transparent
    });
  }

  const modifiedPdfBytes = await pdfDoc.save();
  return Buffer.from(modifiedPdfBytes);
}
