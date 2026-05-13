import React from 'react';
import { LiveEvent } from '../../../../types/liveEvent';
import { AlternativeYouTubePlayer } from '../../../shared/AlternativeYouTubePlayer';

interface AdminLivePlayerProps {
  event: LiveEvent;
}

export const AdminLivePlayer: React.FC<AdminLivePlayerProps> = ({ event }) => {
  const getSafeEmbedUrl = (url?: string) => {
    if (!url) return { url: '', videoId: null };

    // Verifica se é um link do YouTube (padrão, encurtado ou já embutido)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      // Regex poderosa que captura o ID de 11 caracteres de qualquer formato de link do YouTube
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      const videoId = (match && match[2].length === 11) ? match[2] : null;

      if (videoId) {
        // Retorna a URL de embed autorizada. 
        // Já aproveitamos para injetar parâmetros que limpam a interface do YouTube (rel=0 e modestbranding=1)
        return {
          url: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
          videoId
        };
      }
    }

    // Se for um link do Panda Vídeo ou qualquer outro servidor, retorna a URL original
    return { url, videoId: null };
  };

  if (!event.videoLink) {
    return (
      <div className="w-full aspect-video bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500">
        <p>Aguardando Link de Transmissão</p>
      </div>
    );
  }

  const { url: safeUrl, videoId } = getSafeEmbedUrl(event.videoLink);

  // Se o evento estiver configurado para Player Alternativo E for um vídeo do YouTube
  if (event.useAlternativePlayer && videoId) {
    return (
      <div className="w-full aspect-video bg-black rounded-xl overflow-hidden">
        <AlternativeYouTubePlayer videoId={videoId} />
      </div>
    );
  }

  // Basic iframe rendering for YouTube or Panda
  return (
    <div className="w-full aspect-video bg-black rounded-xl overflow-hidden">
      <iframe
        src={safeUrl}
        title="Player de Transmissão"
        className="w-full h-full border-0 rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};
