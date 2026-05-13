
/**
 * Verifica se uma URL pertence ao serviço Panda Vídeo.
 * Aceita domínios comuns do player do Panda.
 */
export const isPandaVideo = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.includes('pandavideo.com.br') || 
    lowerUrl.includes('player-') || 
    lowerUrl.includes('b-cdn.net') // CDN comum usada pelo Panda
  );
};
