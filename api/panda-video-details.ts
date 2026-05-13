import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const apiKey = process.env.PANDA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "PANDA_API_KEY não configurada no ambiente." });
    }

    const videoId = req.query.id as string;
    if (!videoId) {
      return res.status(400).json({ success: false, error: "ID do vídeo é obrigatório." });
    }

    const url = `https://api-v2.pandavideo.com.br/videos/${videoId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Erro na API do Panda: ${response.status}`);
    }

    const videoDetails = await response.json();

    return res.status(200).json({ success: true, video: videoDetails });
  } catch (error) {
    console.error("Erro ao buscar detalhes do vídeo do Panda:", error);
    return res.status(500).json({ success: false, error: "Falha ao carregar detalhes do vídeo do Panda." });
  }
}
