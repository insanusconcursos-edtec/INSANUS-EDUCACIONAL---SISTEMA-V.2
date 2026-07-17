
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

interface UserWatermarkData {
  uid?: string;
  email: string;
  cpf: string;
}

export const applyWatermarkToPdf = async (existingPdfBytes: ArrayBuffer, userData: UserWatermarkData): Promise<Uint8Array> => {
    // 2. Carregar o documento
    const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
    
    // 3. Incorporar fonte padrão
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // 4. Configuração da Marca D'água (Visual Refinado & Seguro)
    const safeEmail = userData.email.replace('@', ' @ ').replace(/\./g, ' . ');
    const watermarkText = `CPF: ${userData.cpf || '---'} • ${safeEmail}`;
    
    const textSize = 10;
    const textColor = rgb(0.8, 0, 0);
    const textOpacity = 0.15;
    const textRotation = degrees(45);

    // 5. Iterar sobre todas as páginas e aplicar Grid
    const pages = pdfDoc.getPages();
    
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      const step = 200;

      for (let x = -50; x < width + 50; x += step) {
        for (let y = -50; y < height + 50; y += step) {
          page.drawText(watermarkText, {
            x: x,
            y: y,
            size: textSize,
            font: font,
            color: textColor,
            opacity: textOpacity,
            rotate: textRotation,
          });
        }
      }
    });

    return await pdfDoc.save();
};

export const openWatermarkedPdf = async (pdfUrl: string, _userData: UserWatermarkData) => {
  try {
    console.log("[PDF_SECURITY] Abrindo documento diretamente (Marca d'água desativada temporariamente)");
    
    if (!pdfUrl) {
      throw new Error("URL do documento não fornecida.");
    }

    // Tenta abrir em uma nova aba diretamente
    // Nota: window.open deve ser disparado por uma ação do usuário para evitar bloqueio de popup
    const newWindow = window.open(pdfUrl, '_blank');
    
    // Fallback caso o popup seja bloqueado
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      console.warn("[PDF_SECURITY] Popup bloqueado, tentando redirecionamento na mesma aba.");
      window.location.href = pdfUrl;
    }

  } catch (error: any) {
    console.error("Erro ao abrir PDF:", error);
    // Como último recurso, tenta abrir novamente ou avisa o usuário
    window.open(pdfUrl, '_blank');
  }
};
