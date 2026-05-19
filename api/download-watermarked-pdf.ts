import { VercelRequest, VercelResponse } from '@vercel/node';
import { addWatermarkToPdf } from '../src/backend/services/pdfWatermarkService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { source, uid } = req.body;
    if (!source || !uid) {
      return res.status(400).json({ success: false, error: "Missing source or user UID" });
    }

    console.log(`[PDF DOWNLOAD SERVERLESS] Gerando PDF com marca d'água para usuário: ${uid}`);

    const watermarkedPdfBuffer = await addWatermarkToPdf(source, uid);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="material_${Date.now()}.pdf"`);
    return res.status(200).send(watermarkedPdfBuffer);
  } catch (error) {
    console.error("[PDF DOWNLOAD SERVERLESS] Error:", error);
    return res.status(500).json({ success: false, error: "Falha ao gerar o PDF com marca d'água." });
  }
}
