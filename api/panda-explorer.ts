import type { VercelRequest, VercelResponse } from '@vercel/node';

interface PandaFolder {
  id: string;
  name: string;
  title?: string;
  parent_id?: string | null;
  parent_folder_id?: string | null;
  parentId?: string | null;
}

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

    const folderId = req.query.folderId as string | undefined;

    const foldersUrl = 'https://api-v2.pandavideo.com.br/folders';
    let videosUrl = 'https://api-v2.pandavideo.com.br/videos?limit=1000';

    if (folderId && folderId !== 'root' && folderId !== 'null') {
      videosUrl += `&folder_id=${folderId}`;
    }

    const headers = {
      'Authorization': apiKey,
      'Accept': 'application/json'
    };

    const [foldersRes, videosRes] = await Promise.all([
      fetch(foldersUrl, { method: 'GET', headers }),
      fetch(videosUrl, { method: 'GET', headers })
    ]);

    if (!foldersRes.ok || !videosRes.ok) {
      throw new Error(`Erro na API do Panda: F:${foldersRes.status} V:${videosRes.status}`);
    }

    const foldersData = await foldersRes.json();
    const videosData = await videosRes.json();

    const foldersArray: PandaFolder[] = foldersData.folders || (Array.isArray(foldersData) ? foldersData : []);
    const videosArray: PandaVideo[] = videosData.videos || (Array.isArray(videosData) ? videosData : []);

    const targetFolderId = folderId;
    const isRoot = !targetFolderId || targetFolderId === 'root' || targetFolderId === 'null' || targetFolderId === '';

    const strictFolders = foldersArray.filter((folder: PandaFolder) => {
      const parentId = folder.parent_folder_id || folder.parent_id || folder.parentId || null;
      if (isRoot) {
        return !parentId || parentId === 'null' || parentId === '';
      } else {
        return String(parentId) === String(targetFolderId);
      }
    });

    strictFolders.sort((a, b) => (a.name || a.title || '').localeCompare(b.name || b.title || ''));

    const folders = strictFolders.map((f) => ({
      id: f.id,
      name: f.name || f.title || 'Pasta sem nome'
    }));

    const strictVideos = videosArray.filter((video: PandaVideo) => {
      const videoFolderId = video.folder_id || video.folderId || null;
      if (isRoot) {
        return !videoFolderId || videoFolderId === 'null' || videoFolderId === '';
      } else {
        return String(videoFolderId) === String(targetFolderId);
      }
    });

    strictVideos.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));

    const videos = strictVideos.map((v: PandaVideo) => ({
      id: v.id,
      video_id: v.video_id || v.id,
      panda_id: v.video_id || v.id,
      external_id: v.external_id || null,
      playback_id: v.playback_id || null,
      title: v.title || v.name || 'Sem título',
      video_player_url: v.video_player_url || v.embed_url || null
    }));

    return res.status(200).json({ success: true, folders, videos });
  } catch (error) {
    console.error("Erro no Explorer do Panda:", error);
    return res.status(500).json({ success: false, error: "Falha ao navegar no Panda Video." });
  }
}
