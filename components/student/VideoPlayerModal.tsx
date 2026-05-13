
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Minimize2, CheckCircle, Clock, Play, Pause, BookOpen } from 'lucide-react';

interface VideoPlayerModalProps {
  isVisible: boolean; // Controls CSS visibility (hidden vs flex)
  videoTitle: string;
  videoUrl: string;
  timerFormatted: string;
  timerStatus: 'idle' | 'running' | 'paused' | 'completed';
  accentColor?: string;
  onTimerStart: () => void;
  onTimerPause: () => void;
  onMinimize: () => void; // Hides visually (keeps mounted)
  onClose: () => void;    // Unmounts/Destroys
  onComplete: () => void; // Completes task and Unmounts
  embeddedNotebookNode?: React.ReactNode; // Optional notebook to render
  hasNotebook?: boolean; // Indicates if there's a notebook available
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  isVisible,
  videoTitle,
  videoUrl,
  timerFormatted,
  timerStatus,
  accentColor = '#10b981',
  onTimerStart,
  onTimerPause,
  onMinimize,
  onClose,
  onComplete,
  embeddedNotebookNode,
  hasNotebook
}) => {
  // Use CSS display control instead of conditional rendering to keep Iframe state (buffer/playhead)
  const containerClass = isVisible 
    ? "fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col h-full animate-in fade-in duration-300" 
    : "hidden"; 

  const isTimerRunning = timerStatus === 'running';
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);

  // Garante parâmetros necessários para funcionamento correto do iframe e autoplay
  const secureUrl = videoUrl.includes('?') 
    ? `${videoUrl}&allow=autoplay` 
    : `${videoUrl}?allow=autoplay`;

  // Listener para evento de conclusão do Panda Vídeo (Reimplementado aqui pois removemos o wrapper)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
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

    const handleToggleNotebook = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.open === 'boolean') {
          setIsNotebookOpen(customEvent.detail.open);
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('TOGGLE_NOTEBOOK', handleToggleNotebook);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('TOGGLE_NOTEBOOK', handleToggleNotebook);
    };
  }, [onComplete]);

  return createPortal(
    <div className={containerClass}>
      
      {/* Header (Flex None para não encolher/esticar) */}
      <div className="flex-none flex items-center justify-between px-6 py-4 bg-zinc-950/50 border-b border-zinc-900">
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isTimerRunning ? 'bg-[var(--plan-theme)] animate-pulse shadow-[0_0_8px_var(--plan-theme)]' : 'bg-yellow-500'}`}></div>
            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                {isTimerRunning ? 'Modo Foco' : 'Pausado'}
            </span>
            <span className="text-zinc-600 mx-2">|</span>
            <span className="text-xs font-bold text-zinc-300 truncate max-w-[400px] hidden md:block">
                {videoTitle}
            </span>
        </div>
        
        <div className="flex items-center gap-2">
            {hasNotebook && (
                <button
                    onClick={() => setIsNotebookOpen(!isNotebookOpen)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                        isNotebookOpen 
                            ? 'bg-blue-600 text-white shadow-lg' 
                            : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20'
                    }`}
                >
                    <BookOpen size={16} />
                    {isNotebookOpen ? 'Fechar Caderno' : 'Caderno de Anotações'}
                </button>
            )}
            {/* Close Button (Destroy) */}
            <button 
                onClick={onClose}
                className="p-2 text-zinc-500 hover:text-red-500 transition-colors ml-4"
                title="Fechar Player (Sair)"
            >
                <X size={24} />
            </button>
        </div>
      </div>

      {/* ÁREA CENTRAL (VÍDEO E ANOTAÇÕES) */}
      <div className="flex-1 w-full bg-black flex overflow-hidden">
        
        {/* PARTE DO VÍDEO */}
        <div className={`flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden transition-all duration-300 ${isNotebookOpen ? 'w-1/2 border-r border-zinc-800' : 'w-full'}`}>
            {/* MOLDURA DO VÍDEO (Wrapper com Aspect Ratio fixo) */}
            <div className={`relative w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 ${!isNotebookOpen ? 'max-w-6xl' : ''}`}>
              <iframe
                src={secureUrl}
                title={videoTitle}
                className="absolute top-0 left-0 w-full h-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                style={{ border: 'none' }}
              />
            </div>
        </div>

        {/* PARTE DO CADERNO */}
        {isNotebookOpen && embeddedNotebookNode && (
            <div className="w-1/2 h-full flex flex-col bg-[#09090b] animate-in slide-in-from-right-8 duration-300">
                {embeddedNotebookNode}
            </div>
        )}
        
      </div>

      {/* Footer Controls (Flex None e Relative para garantir empilhamento correto) */}
      <div className="flex-none relative bg-zinc-900 border-t border-zinc-800 p-6 pb-8 z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Timer Controls */}
            <div className="flex items-center gap-4 bg-black/40 px-6 py-3 rounded-2xl border border-zinc-800">
                <button
                    onClick={isTimerRunning ? onTimerPause : onTimerStart}
                    className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg
                        ${isTimerRunning 
                            ? 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 border border-zinc-700' 
                            : 'text-white hover:scale-110 hover:brightness-110'}
                    `}
                    style={!isTimerRunning ? { backgroundColor: accentColor } : undefined}
                    title={isTimerRunning ? "Pausar Cronômetro" : "Iniciar Cronômetro"}
                >
                    {isTimerRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                </button>

                <div className="w-px h-8 bg-zinc-800 mx-2"></div>

                <div className="flex items-center gap-3">
                    <Clock size={20} className={isTimerRunning ? "text-[var(--plan-theme)]" : "text-zinc-600"} />
                    <span className={`text-3xl font-mono font-black tracking-widest tabular-nums ${isTimerRunning ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]' : 'text-zinc-500'}`}>
                        {timerFormatted}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 w-full md:w-auto">
                <button
                    onClick={onMinimize}
                    className="flex-1 md:flex-none py-3 px-6 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 font-bold uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                >
                    <Minimize2 size={16} />
                    Minimizar
                </button>

                <button
                    onClick={onComplete}
                    className="flex-1 md:flex-none py-3 px-8 rounded-xl bg-[var(--plan-theme)] hover:brightness-110 text-white font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(var(--plan-theme-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--plan-theme-rgb),0.5)] transition-all flex items-center justify-center gap-2 transform hover:scale-105"
                >
                    <CheckCircle size={18} />
                    Concluir Aula
                </button>
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VideoPlayerModal;
