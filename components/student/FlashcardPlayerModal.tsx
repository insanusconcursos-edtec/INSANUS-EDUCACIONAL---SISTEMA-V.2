
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ChevronLeft, ChevronRight, BrainCircuit, Layers, Clock, ArrowLeft, ArrowRight 
} from 'lucide-react';

interface FlashcardData {
  id?: string;
  front: string;
  back: string;
}

interface TimerState {
  formattedTime: string;
  status: 'idle' | 'running' | 'paused' | 'completed';
}

interface FlashcardPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  flashcards: FlashcardData[];
  timerState: TimerState;
  title?: string;
  accentColor?: string;
}

const FlashcardPlayerModal: React.FC<FlashcardPlayerModalProps> = ({ 
  isOpen, 
  onClose, 
  flashcards, 
  timerState,
  title = "Flashcard",
  accentColor = '#ec4899' // Default pink fallback
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  }, [isOpen]);

  // Navigation Logic
  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150); // Slight delay for smoother transition
    }
  }, [currentIndex, flashcards.length]);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev - 1), 150);
    }
  }, [currentIndex]);

  const handleFlip = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsFlipped(prev => !prev);
  }, []);

  // Keyboard Support
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': handleNext(); break;
        case 'ArrowLeft': handlePrev(); break;
        case ' ': // Spacebar
        case 'Enter':
          e.preventDefault();
          handleFlip();
          break;
        case 'Escape': onClose(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleFlip, onClose]);

  if (!isOpen || !flashcards || flashcards.length === 0) return null;

  const currentCard = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-300 select-none">
      
      {/* --- CSS FOR 3D FLIP --- */}
      <style>{`
        .perspective-container { perspective: 1000px; }
        .card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
          transform-style: preserve-3d;
        }
        .card-face {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          display: flex;
          flex-direction: column;
        }
        .card-front { transform: rotateY(0deg); }
        .card-back { transform: rotateY(180deg); }
        .flipped { transform: rotateY(180deg); }
      `}</style>

      {/* --- HEADER --- */}
      <div className="relative z-10 flex flex-col w-full bg-zinc-950/50 border-b border-zinc-800">
        <div className="w-full h-1 bg-zinc-900">
          <div 
            className="h-full transition-all duration-300 ease-out"
            style={{ 
                width: `${progress}%`,
                backgroundColor: accentColor,
                boxShadow: `0 0 10px ${accentColor}CC`
            }}
          />
        </div>

        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
             <div 
                className="w-10 h-10 rounded-lg bg-zinc-900 border flex items-center justify-center"
                style={{ 
                    color: accentColor,
                    borderColor: `${accentColor}40`,
                    backgroundColor: `${accentColor}1A`, // ~10% opacity
                    boxShadow: `0 0 15px ${accentColor}26` // ~15% opacity hex
                }}
             >
                <BrainCircuit size={20} />
             </div>
             <div>
                <h2 className="text-lg font-black uppercase tracking-tighter text-white leading-none mb-1">
                  {title}
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                   <Layers size={10} />
                   <span>Flashcard Deck</span>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="flex flex-col items-end">
                <span className="text-2xl font-black font-mono text-white leading-none tracking-tighter">
                  {(currentIndex + 1).toString().padStart(2, '0')} <span className="text-zinc-700 text-lg">/ {flashcards.length.toString().padStart(2, '0')}</span>
                </span>
             </div>
             <div className="w-px h-8 bg-zinc-800"></div>
             <button 
                onClick={onClose}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors"
                title="Fechar (Esc)"
             >
                <X size={24} />
             </button>
          </div>
        </div>
      </div>

      {/* --- MAIN STAGE (CARD) --- */}
      <div className="relative flex-1 flex items-center justify-between px-4 md:px-12 perspective-container">
        
        {/* Left Nav */}
        <button 
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="hidden md:flex w-16 h-16 rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-500 hover:text-white items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95 backdrop-blur-sm z-20"
        >
            <ChevronLeft size={32} />
        </button>

        {/* Card Container */}
        <div 
           className="relative w-full max-w-4xl h-[450px] cursor-pointer group mx-auto"
           onClick={handleFlip}
        >
           <div className={`card-inner ${isFlipped ? 'flipped' : ''}`}>
              
              {/* FRONT (QUESTION) */}
              <div className="card-face card-front bg-zinc-900 border border-zinc-700 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center p-8 md:p-16 relative overflow-hidden transition-colors">
                  <div 
                    className="absolute top-6 left-6 w-2 h-2 rounded-full"
                    style={{
                        backgroundColor: accentColor,
                        boxShadow: `0 0 10px ${accentColor}`
                    }}
                  ></div>
                  <div className="absolute top-6 right-6 text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Pergunta</div>
                  
                  <div className="flex flex-col items-center justify-center w-full h-full overflow-y-auto custom-scrollbar">
                      <h3 className="text-2xl md:text-4xl font-black text-center text-white leading-tight tracking-tight">
                        {currentCard.front}
                      </h3>
                      <div className="mt-8 text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">
                          Clique para virar
                      </div>
                  </div>
              </div>

              {/* BACK (ANSWER) */}
              <div className="card-face card-back bg-zinc-950 border border-emerald-500/30 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.1)] flex flex-col p-8 md:p-12 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                  <div className="absolute top-6 left-6 text-[10px] font-mono text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Resposta
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center w-full overflow-y-auto custom-scrollbar">
                      <p className="text-lg md:text-2xl text-zinc-200 leading-relaxed font-medium whitespace-pre-wrap text-center max-w-3xl">
                        {currentCard.back}
                      </p>
                  </div>
              </div>
           </div>
        </div>

        {/* Right Nav */}
        <button 
            onClick={handleNext}
            disabled={currentIndex === flashcards.length - 1}
            className="hidden md:flex w-16 h-16 rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-500 hover:text-white items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95 backdrop-blur-sm z-20"
        >
            <ChevronRight size={32} />
        </button>
      </div>

      {/* --- FOOTER HINTS --- */}
      <div className="relative z-10 bg-zinc-950/90 border-t border-zinc-800 py-4 flex flex-col md:flex-row items-center justify-center gap-8 backdrop-blur-md text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
         <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 font-mono text-xs">SPACE</kbd>
            <span>Virar Card</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="flex gap-1">
                <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 font-mono text-xs"><ArrowLeft size={10} /></kbd>
                <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 font-mono text-xs"><ArrowRight size={10} /></kbd>
            </div>
            <span>Navegar</span>
         </div>
      </div>

      {/* --- TIMER OVERLAY (Right Bottom) --- */}
      {timerState.status === 'running' && (
        <div className="fixed bottom-20 right-8 z-[210] pointer-events-none animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-red-600 blur-lg opacity-50 animate-pulse"></div>
                    <div className="relative p-2 bg-red-600 rounded-lg text-white">
                        <Clock size={20} />
                    </div>
                </div>
                <div>
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">Estudando...</span>
                    <div className="text-2xl font-mono font-bold text-white leading-none tracking-wider">
                        {timerState.formattedTime}
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>,
    document.body
  );
};

export default FlashcardPlayerModal;
