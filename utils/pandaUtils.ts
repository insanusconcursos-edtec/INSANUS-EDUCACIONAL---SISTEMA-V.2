
/**
 * Panda Video Utilities
 */

export interface PandaVideo {
  id: string;
  title?: string;
  name?: string;
  playback_id?: string;
  video_external_id?: string;
  video_player?: string;
  video_player_url?: string;
  embed_url?: string;
  video_external_url?: string;
  video_hls?: string;
  url?: string;
  length?: number;
  duration?: number;
  [key: string]: any;
}

/**
 * Extracts the correct Playback ID from a Panda Video object.
 * Prioritizes the standard ID fields returned by the API.
 */
export const extractPandaVideoId = (video: PandaVideo): string | null => {
  if (!video) return null;

  // 1. Prioridade Máxima: Campos de ID direto (disponíveis no objeto detalhado)
  if (video.playback_id && typeof video.playback_id === 'string') {
    return video.playback_id;
  }
  if (video.video_external_id && typeof video.video_external_id === 'string') {
    return video.video_external_id;
  }

  // 2. Array com os campos seguros que contêm a URL pública do Panda
  const possibleUrls = [
    video.video_player,      // Campo do objeto detalhado
    video.video_player_url,  // Campo comum
    video.embed_url,         // Campo comum
    video.video_external_url,
    video.video_hls,
    video.url
  ];

  // 3. Extração rigorosa (Parser de URL)
  for (const url of possibleUrls) {
    if (url && typeof url === 'string' && url.includes('?v=')) {
      // Isola o código exatamente após o '?v=' e antes de qualquer '&'
      return url.split('?v=')[1].split('&')[0];
    }
  }

  // 4. Retorna null se nenhum Playback ID for encontrado via URL (Fallback para ID interno proibido)
  return null;
};

/**
 * Builds or retrieves the best specific Embed URL for a given Panda Video.
 */
export const getPandaEmbedUrl = (video: PandaVideo, playbackId: string): string => {
  // Se o objeto já tem o player pronto, usamos ele (mais seguro que hardcoded)
  if (video.video_player && typeof video.video_player === 'string') {
    return video.video_player;
  }
  
  // Fallback para construção manual se necessário
  return `https://player-vz-226f9de3-772.tv.pandavideo.com.br/embed/?v=${playbackId}`;
};

/**
 * Builds the specific Ticto Embed URL for a given Panda Video ID (Legacy/Fallback).
 */
export const buildPandaEmbedUrl = (videoId: string): string => {
  return `https://player-vz-226f9de3-772.tv.pandavideo.com.br/embed/?v=${videoId}`;
};
