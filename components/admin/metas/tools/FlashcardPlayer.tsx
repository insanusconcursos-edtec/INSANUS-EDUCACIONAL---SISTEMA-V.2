import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, ChevronLeft, ChevronRight, 
  BrainCircuit, Layers, ArrowRight, ArrowLeft
} from 'lucide-react';
import { Flashcard } from '../../../../services/metaService';

interface FlashcardPlayerProps {
  cards: Flashcard[];
  onClose: () => void;
  title?: string;
}

const FlashcardPlayer: React.FC<FlashcardPlayerProps> = ({ cards, onClose, title = "Flashcard" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Progress Calculation
  const progress = ((currentIndex + 1) / cards.length) * 100;
  const currentCard = cards[currentIndex];

  // --- HANDLERS ---

  const handleNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, cards.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  // --- KEYBOARD SUPPORT ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          handleNext();
          break;
        case 'ArrowLeft':
          handlePrev();
          break;
        case ' ': // Spacebar
        case 'Enter':
          e.preventDefault();
          handleFlip();
          break;
        case 'Escape':
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleFlip, onClose]);

  if (!cards || cards.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white font-sans flex flex-col overflow-hidden animate-in fade-in duration-300 select-none">
      
      {/* --- BACKGROUNDS (CYBERPUNK HUD) --- */}
      
      {/* 1. Technical Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      {/* 2. Radial Vignette (Focus Center) */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_800px_at_100%_200px,#a855f71a,transparent)]"></div>
      
      {/* 3. Dark Overlay Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>

      {/* --- HUD HEADER --- */}
      <div className="relative z-10 flex flex-col w-full bg-zinc-950/80 border-b border-zinc-800 backdrop-blur-md">
        {/* Progress Bar Line */}
        <div className="w-full h-1 bg-zinc-900">
          <div 
            className="h-full bg-purple-600 shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
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
             {/* Counter HUD */}
             <div className="flex flex-col items-end">
                <span className="text-2xl font-black font-mono text-white leading-none tracking-tighter">
                  {(currentIndex + 1).toString().padStart(2, '0')} <span className="text-zinc-700 text-lg">/ {cards.length.toString().padStart(2, '0')}</span>
                </span>
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Progresso</span>
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

      {/* --- MAIN STAGE (3D CARD) --- */}
      <div className="relative flex-1 flex items-center justify-between px-4 md:px-12 perspective-container">
        
        {/* INJECTED STYLES FOR 3D FLIP */}
        <style>{`
          .perspective-container {
            perspective: 1000px;
          }
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
          .card-front {
            transform: rotateY(0deg);
          }
          .card-back {
            transform: rotateY(180deg);
          }
          .flipped {
            transform: rotateY(180deg);
          }
        `}</style>

        {/* LEFT NAV BUTTON */}
        <button 
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="hidden md:flex w-16 h-16 rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-500 hover:text-white items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95 backdrop-blur-sm z-20"
        >
            <ChevronLeft size={32} />
        </button>

        {/* 3D CARD CONTAINER */}
        <div 
           className="relative w-full max-w-4xl h-[450px] cursor-pointer group mx-auto"
           onClick={handleFlip}
        >
           <div className={`card-inner ${isFlipped ? 'flipped' : ''}`}>
              
              {/* --- FRONT FACE (QUESTION) --- */}
              <div className="card-face card-front bg-zinc-900 border border-zinc-700 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center p-8 md:p-16 relative overflow-hidden group-hover:border-purple-500/50 transition-colors">
                  {/* Decorative Elements */}
                  <div className="absolute top-6 left-6 w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7]"></div>
                  <div className="absolute top-6 right-6 text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Pergunta</div>
                  
                  {/* Content */}
                  <div className="flex flex-col items-center justify-center w-full h-full overflow-y-auto custom-scrollbar">
                      <h3 className="text-3xl md:text-5xl font-black text-center text-white leading-tight tracking-tight">
                        {currentCard.front}
                      </h3>
                      <div className="mt-8 text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">
                          Clique para ver a resposta
                      </div>
                  </div>
              </div>

              {/* --- BACK FACE (ANSWER) --- */}
              <div className="card-face card-back bg-zinc-950 border border-emerald-500/30 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.1)] flex flex-col p-8 md:p-12 relative overflow-hidden">
                  {/* Decorative Elements */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                  <div className="absolute top-6 left-6 text-[10px] font-mono text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Resposta
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 flex items-center justify-center w-full overflow-y-auto custom-scrollbar">
                      <p className="text-xl md:text-2xl text-zinc-200 leading-relaxed font-medium whitespace-pre-wrap text-center max-w-3xl">
                        {currentCard.back}
                      </p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-600 font-mono uppercase">
                      <span>Card ID: {currentCard.id.slice(-6)}</span>
                      <span>Insanus Learning System</span>
                  </div>
              </div>

           </div>
        </div>

        {/* RIGHT NAV BUTTON */}
        <button 
            onClick={handleNext}
            disabled={currentIndex === cards.length - 1}
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
    </div>
  );
};

export default FlashcardPlayer;
