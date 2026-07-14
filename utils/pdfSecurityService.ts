
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

interface UserWatermarkData {
  email: string;
  cpf: string;
}

export const applyWatermarkToPdf = async (existingPdfBytes: ArrayBuffer, userData: UserWatermarkData): Promise<Uint8Array> => {
    // 2. Carregar o documento
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
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

export const openWatermarkedPdf = async (pdfUrl: string, userData: UserWatermarkData) => {
  // Em dispositivos móveis/iOS, window.open deve ser chamado o mais próximo possível do clique do usuário.
  // No entanto, como temos um processamento pesado assíncrono, o Safari costuma bloquear.
  // Uma estratégia é abrir a aba imediatamente e depois mudar o location.
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  let newWindow: Window | null = null;

  if (isMobile) {
    newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write('<p style="font-family: sans-serif; text-align: center; margin-top: 50px; color: #666;">Gerando documento seguro...<br>Aguarde um momento.</p>');
    }
  }

  try {
    // 1. Fetch do PDF original com modo CORS explícito
    const response = await fetch(pdfUrl, { 
        method: 'GET',
        mode: 'cors'
    });

    if (!response.ok) {
        throw new Error(`Falha ao baixar o arquivo: ${response.statusText}`);
    }

    const existingPdfBytes = await response.arrayBuffer();
    const pdfBytes = await applyWatermarkToPdf(existingPdfBytes, userData);

    // 7. Criar Blob e URL
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);

    // 8. Abrir/Atualizar janela
    if (newWindow) {
      newWindow.location.href = blobUrl;
    } else {
      window.open(blobUrl, '_blank');
    }

    // Revogar URL após 1 minuto para liberar memória
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

  } catch (error: any) {
    console.error("Erro crítico no processamento de segurança do PDF:", error);
    if (newWindow) newWindow.close();
    
    // Repassar erro mais amigável
    if (error.message.includes('Failed to fetch')) {
        throw new Error("Bloqueio de segurança (CORS). O arquivo não permite acesso externo.");
    }
    throw error;
  }
};
