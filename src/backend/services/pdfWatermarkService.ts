import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import axios from 'axios';
import { getAdminConfig } from './firebaseAdmin.js';

export async function addWatermarkToPdf(
  inputSource: { type: 'url', url: string } | { type: 'base64', base64: string },
  uid: string
): Promise<Buffer> {
  const { dbAdmin, authAdmin } = getAdminConfig();
  
  console.log(`[PDF_WATERMARK] Iniciando processamento para UID: ${uid}`);

  // 1. Fetch User Data
  let userData: any = null;
  try {
      const userDoc = await dbAdmin.collection('users').doc(uid).get();
      if (userDoc.exists) {
         userData = userDoc.data();
      } else {
         try {
            const userRecord = await authAdmin.getUser(uid);
            userData = { 
               name: userRecord.displayName, 
               email: userRecord.email,
               cpf: 'CPF NÃO INFORMADO'
            };
         } catch (authErr) {
            console.warn(`[PDF_WATERMARK] Usuário não encontrado no Auth: ${uid}`);
            userData = { name: 'Usuário', email: 'N/A', cpf: 'CPF N/A' };
         }
      }
  } catch (err: any) {
      console.error("[PDF_WATERMARK] Error fetching user data:", err);
      // Fallback para dados genéricos em vez de travar tudo se for apenas erro de banco
      userData = { name: 'Usuário', email: 'N/A', cpf: 'CPF N/A' };
  }

  const name = String(userData?.name || userData?.displayName || 'Usuário');
  const email = String(userData?.email || '');
  const cpf = String(userData?.cpf || userData?.document || 'CPF N/A');
  
  const watermarkText = `${name.toUpperCase()} - ${email} - ${cpf}`;
  console.log(`[PDF_WATERMARK] Texto da marca d'água: ${watermarkText}`);

  // 2. Load the PDF
  let pdfBytes: Buffer;
  
  if (inputSource.type === 'url') {
    if (!inputSource.url) throw new Error("URL do PDF não fornecida.");
    try {
      console.log(`[PDF_WATERMARK] Baixando PDF da URL: ${inputSource.url.substring(0, 50)}...`);
      const response = await axios.get(inputSource.url, { 
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/pdf,application/octet-stream,*/*'
        }
      });
      pdfBytes = Buffer.from(response.data);
      console.log(`[PDF_WATERMARK] PDF baixado com sucesso. Tamanho: ${pdfBytes.length} bytes`);
    } catch (error: any) {
      const statusCode = error.response?.status;
      const statusText = error.response?.statusText;
      const errorMessage = `Falha ao baixar PDF da URL (${statusCode || 'N/A'} ${statusText || ''}): ${error.message}`;
      console.error(`[PDF_WATERMARK] ${errorMessage} | URL: ${inputSource.url}`);
      throw new Error(errorMessage);
    }
  } else {
    try {
      const base64Data = inputSource.base64.replace(/^data:application\/pdf;base64,/, '');
      pdfBytes = Buffer.from(base64Data, 'base64');
      console.log(`[PDF_WATERMARK] PDF carregado via Base64. Tamanho: ${pdfBytes.length} bytes`);
    } catch (error: any) {
      throw new Error(`Erro ao decodificar base64 do PDF: ${error.message}`);
    }
  }

  try {
    if (!pdfBytes || pdfBytes.length < 5) {
      throw new Error("O arquivo baixado está vazio ou é muito curto.");
    }
    
    const pdfSignature = pdfBytes.slice(0, 5).toString();
    if (pdfSignature !== '%PDF-') {
      console.error(`[PDF_WATERMARK] Conteúdo baixado não parece ser um PDF. Assinatura: ${pdfSignature}`);
      const preview = pdfBytes.slice(0, 50).toString('utf-8').replace(/[^\x20-\x7E]/g, '?');
      throw new Error(`O arquivo não é um PDF válido (Assinatura: ${pdfSignature}). Preview: ${preview}`);
    }

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    // Incorporar fonte explicitamente para evitar erros de renderização
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    // 3. Apply Watermark
    const fontSize = 9;
    const textWidthEstimate = watermarkText.length * 5;

    for (const page of pages) {
      const { width, height } = page.getSize();
      
      page.drawText(watermarkText, {
          x: (width / 2) - (textWidthEstimate / 2),
          y: height - 15,
          size: fontSize,
          font: font,
          color: rgb(0.85, 0.1, 0.1),
          opacity: 0.6,
      });
    }

    const modifiedPdfBytes = await pdfDoc.save();
    console.log(`[PDF_WATERMARK] Marca d'água aplicada com sucesso.`);
    return Buffer.from(modifiedPdfBytes);
  } catch (error: any) {
    console.error(`[PDF_WATERMARK] Erro ao processar PDF:`, error.message);
    throw new Error(`Erro ao processar estrutura do PDF: ${error.message}`);
  }
}
