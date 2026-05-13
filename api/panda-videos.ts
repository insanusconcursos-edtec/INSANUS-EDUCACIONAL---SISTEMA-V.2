import type { VercelRequest, VercelResponse } from '@vercel/node';

interface PandaVideo {
  id: string;
  video_id?: string;
  title: string;
  name?: string;
  folder_id?: string | null;
  folderId?: string | null;
  video_player_url?: string;
  embed_url?: string;
  external_id?: string | null;
  playback_id?: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const apiKey = process.env.PANDA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "PANDA_API_KEY não configurada no ambiente." });
    }

    const search = req.query.search as string;
    
    let url = 'https://api-v2.pandavideo.com.br/videos?limit=1000';
    if (search) {
      url += `&title=${encodeURIComponent(search)}`;
    }

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

    const data = await response.json();
    const videos = data.videos || data || [];
    
    const cleanVideos = Array.isArray(videos) ? videos.map((v: any) => ({
      id: v.id,
      video_id: v.video_id || v.id,
      panda_id: v.video_id || v.id,
      external_id: v.external_id || null,
      playback_id: v.playback_id || null,
      title: v.title || v.name || 'Sem título',
      video_player_url: v.video_player_url || v.embed_url || null
    })) : [];

    return res.status(200).json({ success: true, videos: cleanVideos });
  } catch (error) {
    console.error("Erro ao listar vídeos do Panda:", error);
    return res.status(500).json({ success: false, error: "Falha ao carregar vídeos do Panda." });
  }
}
