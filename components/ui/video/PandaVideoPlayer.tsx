
import React, { useEffect } from 'react';

interface PandaVideoPlayerProps {
  url: string;
  title?: string;
  onComplete?: () => void;
}

export const PandaVideoPlayer: React.FC<PandaVideoPlayerProps> = ({ 
  url, 
  title = "Aula", 
  onComplete 
}) => {
  
  if (!url) return null;

  // Garante parâmetros necessários para funcionamento correto do iframe e autoplay
  // Adicionamos 'allow=autoplay' que ajuda na permissão de reprodução
  const secureUrl = url.includes('?') 
    ? `${url}&allow=autoplay` 
    : `${url}?allow=autoplay`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Debug: Logar todos os eventos para identificar o padrão correto
      // O Panda envia muitos eventos de progresso, então filtramos para não poluir demais,
      // mas mantemos o log do objeto data se contiver 'panda' para facilitar o debug.
      if (event.data && typeof event.data === 'object' && 'message' in event.data) {
         if (String(event.data.message).includes('panda')) {
             // console.log('[PandaPlayer Event]', event.data);
         }
      } else if (typeof event.data === 'string' && event.data.includes('panda')) {
         // console.log('[PandaPlayer String]', event.data);
      }

      // 2. Detecção de Conclusão
      // A API do Panda geralmente envia { message: 'panda_ended' } ou 'panda_onFinish'
      const msg = event.data;
      
      const isPandaEnd = 
        msg === 'panda_ended' || 
        msg?.message === 'panda_ended' || 
        msg === 'panda_onFinish' ||
        msg?.message === 'panda_onFinish';

      if (isPandaEnd) {
        console.log('✅ Aula Concluída (Evento Panda Detectado)');
        if (onComplete) {
            onComplete();
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup para remover o listener quando o componente desmontar
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onComplete]);

  return (
    <div className="relative w-full pt-[56.25%] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl group">
      {/* O padding-top 56.25% mantém a proporção 16:9 perfeita em qualquer tela */}
      <iframe
        src={secureUrl}
        title={title}
        className="absolute top-0 left-0 w-full h-full"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy" 
        id={`panda-player-${Date.now()}`}
        style={{ border: 'none' }}
      />
      
      {/* Overlay visual discreto removido para evitar bloqueio de interação em bordas */}
    </div>
  );
};

export default PandaVideoPlayer;
