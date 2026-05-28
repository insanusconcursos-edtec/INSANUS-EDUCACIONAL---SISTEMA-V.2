import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ChevronLeft, ChevronRight, BrainCircuit, Layers, Clock, ArrowLeft, ArrowRight,
  ThumbsUp, ThumbsDown, Shuffle, RotateCcw, Trophy, Sparkles, Play
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
  timerState?: TimerState;
  title?: string;
  accentColor?: string;
}

const FlashcardPlayerModal: React.FC<FlashcardPlayerModalProps> = ({ 
  isOpen, 
  onClose, 
  flashcards, 
  timerState = { status: 'idle', formattedTime: '00:00' },
  title = "Flashcard",
  accentColor = '#ec4899' // Default pink fallback
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // New states for study logic
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [playableCards, setPlayableCards] = useState<FlashcardData[]>([]);
  const [score, setScore] = useState(0);
  const [totalAcertos, setTotalAcertos] = useState(0);
  const [totalErros, setTotalErros] = useState(0);

  // Reset state when opening or when flashcards change
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsFlipped(false);
      setIsStarted(false);
      setIsFinished(false);
      setPlayableCards(flashcards);
      setScore(0);
      setTotalAcertos(0);
      setTotalErros(0);
    }
  }, [isOpen, flashcards]);

  // Start Study with Shuffle option
  const handleStartDeck = () => {
    let cardsToPlay = [...flashcards];
    if (isShuffleEnabled) {
      // Fisher-Yates Shuffle
      for (let i = cardsToPlay.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardsToPlay[i], cardsToPlay[j]] = [cardsToPlay[j], cardsToPlay[i]];
      }
    }
    setPlayableCards(cardsToPlay);
    setCurrentIndex(0);
    setIsFlipped(false);
    setScore(0);
    setTotalAcertos(0);
    setTotalErros(0);
    setIsFinished(false);
    setIsStarted(true);
  };

  // Score Handlers
  const handleAcertei = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScore(prev => prev + 1);
    setTotalAcertos(prev => prev + 1);
    
    // Auto advance or show results
    if (currentIndex < playableCards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 150);
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, playableCards.length]);

  const handleErrei = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScore(prev => prev - 1);
    setTotalErros(prev => prev + 1);
    
    // Auto advance or show results
    if (currentIndex < playableCards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 150);
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, playableCards.length]);

  // Navigation Logic
  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < playableCards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150); // Slight delay for smoother transition
    }
  }, [currentIndex, playableCards.length]);

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
    if (!isOpen || !isStarted || isFinished) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          if (isFlipped) {
            handleAcertei();
          } else {
            handleNext();
          }
          break;
        case 'ArrowLeft':
          if (isFlipped) {
            handleErrei();
          } else {
            handlePrev();
          }
          break;
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
  }, [isOpen, isStarted, isFinished, isFlipped, handleNext, handlePrev, handleFlip, handleAcertei, handleErrei, onClose]);

  if (!isOpen || !flashcards || flashcards.length === 0) return null;

  const currentCard = playableCards[currentIndex] || flashcards[0];
  const progress = playableCards.length > 0 ? ((currentIndex + 1) / playableCards.length) * 100 : 0;

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
                width: `${isStarted && !isFinished ? progress : 0}%`,
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
                <Layers size={20} />
             </div>
             <div>
                <h2 className="text-sm md:text-lg font-black uppercase tracking-tighter text-white leading-none mb-1 max-w-xs md:max-w-xl truncate">
                  {title}
                </h2>
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                   <Layers size={10} />
                   <span>Flashcard Deck</span>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-6">
             {/* Score Tracker Badge */}
             {isStarted && !isFinished && (
               <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
                 <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Pontuação:</span>
                 <span className={`text-xs font-mono font-black ${score >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                   {score > 0 ? `+${score}` : score} pt
                 </span>
               </div>
             )}

             {isStarted && !isFinished && (
               <div className="flex flex-col items-end">
                  <span className="text-xl md:text-2xl font-black font-mono text-white leading-none tracking-tighter">
                    {(currentIndex + 1).toString().padStart(2, '0')} <span className="text-zinc-700 text-lg">/ {playableCards.length.toString().padStart(2, '0')}</span>
                  </span>
               </div>
             )}
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

      {/* --- CONTENT CONDITIONAL RENDER --- */}
      
      {/* 1. START SCREEN */}
      {!isStarted && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 animate-in fade-in zoom-in-95 duration-350">
           <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
              style={{
                color: accentColor,
                borderColor: `${accentColor}40`,
                backgroundColor: `${accentColor}1A`,
                boxShadow: `0 0 20px ${accentColor}33`,
                borderWidth: '1px'
              }}
           >
              <Layers size={32} />
           </div>

           <h3 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter text-center max-w-2xl mb-2 px-4">
             {title}
           </h3>
           <p className="text-zinc-500 text-xs md:text-sm font-bold uppercase tracking-widest mb-8">
              Contém {flashcards.length} {flashcards.length === 1 ? 'flashcard' : 'flashcards'}
           </p>

           <div className="w-full max-w-md bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl mb-8 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                 <div className="flex flex-col">
                    <span className="text-xs font-black text-white uppercase tracking-tight">Embaralhar Cards</span>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-normal mt-0.5">Estude em ordem 100% aleatória</span>
                 </div>
                 <button 
                    onClick={() => setIsShuffleEnabled(!isShuffleEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex items-center ${isShuffleEnabled ? 'bg-pink-600' : 'bg-zinc-800'}`}
                 >
                    <div 
                       className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-305 ${isShuffleEnabled ? 'translate-x-[26px]' : 'translate-x-0.5'}`}
                    />
                 </button>
              </div>
           </div>

           <button
              onClick={handleStartDeck}
              className="px-8 py-4 bg-pink-600 hover:bg-pink-500 text-white font-black text-xs md:text-sm uppercase tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-pink-600/25 flex items-center gap-3"
           >
              <Play size={16} fill="currentColor" />
              Iniciar Estudo
           </button>
        </div>
      )}

      {/* 2. PLAYER VIEW */}
      {isStarted && !isFinished && (
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
                <div className="card-face card-front bg-zinc-900 border border-zinc-850 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center p-8 md:p-16 relative overflow-hidden transition-colors">
                    <div 
                      className="absolute top-6 left-6 w-2 h-2 rounded-full"
                      style={{
                          backgroundColor: accentColor,
                          boxShadow: `0 0 10px ${accentColor}`
                      }}
                    ></div>
                    <div className="absolute top-6 right-6 text-[10px] font-mono text-zinc-650 uppercase tracking-widest">Pergunta</div>
                    
                    <div className="flex flex-col items-center justify-center w-full h-full overflow-y-auto custom-scrollbar">
                        <h3 className="text-xl md:text-3xl font-black text-center text-white leading-tight tracking-tight px-4 whitespace-normal break-words max-w-full">
                          {currentCard.front}
                        </h3>
                        <div className="mt-8 text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">
                            Clique para ver a resposta
                        </div>
                    </div>
                </div>

                {/* BACK (ANSWER) */}
                <div className="card-face card-back bg-zinc-950 border border-emerald-500/30 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.1)] flex flex-col p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                    <div className="absolute top-6 left-6 text-[10px] font-mono text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Resposta
                    </div>
                    
                    <div className="flex-1 flex items-center justify-center w-full overflow-y-auto custom-scrollbar my-4">
                        <p className="text-base md:text-xl text-zinc-200 leading-relaxed font-semibold whitespace-pre-wrap text-center max-w-3xl px-4">
                          {currentCard.back}
                        </p>
                    </div>

                    {/* ACERTEI / ERREI BUTTONS */}
                    <div className="mt-4 mb-2 flex flex-col sm:flex-row items-center justify-center gap-4 shrink-0" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={handleErrei}
                          className="flex items-center justify-center gap-2 px-8 py-3.5 bg-red-650 hover:bg-red-550 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-900/20 border border-red-500/35 w-full sm:w-auto"
                        >
                          <ThumbsDown size={14} />
                          Errei
                          <span className="hidden md:inline-flex items-center gap-1 ml-2 text-[9px] bg-red-800 text-red-200 px-1.5 py-0.5 rounded font-mono border border-red-500/20"><ChevronLeft size={8} /> Seta Esq.</span>
                        </button>

                        <button 
                          onClick={handleAcertei}
                          className="flex items-center justify-center gap-2 px-8 py-3.5 bg-emerald-655 hover:bg-emerald-550 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-900/20 border border-emerald-500/35 w-full sm:w-auto"
                        >
                          <ThumbsUp size={14} />
                          Acertei
                          <span className="hidden md:inline-flex items-center gap-1 ml-2 text-[9px] bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded font-mono border border-emerald-500/20">Seta Dir. <ChevronRight size={8} /></span>
                        </button>
                    </div>
                </div>
             </div>
          </div>

          {/* Right Nav */}
          <button 
              onClick={handleNext}
              disabled={currentIndex === playableCards.length - 1}
              className="hidden md:flex w-16 h-16 rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-500 hover:text-white items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95 backdrop-blur-sm z-20"
          >
              <ChevronRight size={32} />
          </button>
        </div>
      )}

      {/* 3. FINISHED VIEW */}
      {isStarted && isFinished && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 animate-in fade-in zoom-in-95 duration-300">
           <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6 text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <Trophy size={40} />
           </div>

           <h3 className="text-3xl font-black text-white uppercase tracking-tighter text-center mb-1">
              Desempenho Final!
           </h3>
           <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-8 text-center px-4 max-w-sm">
              {title}
           </p>

           <div className="w-full max-w-sm bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl mb-8 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total de Cards</span>
                 <span className="text-sm font-mono font-black text-white">{playableCards.length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Acertos</span>
                 <span className="text-sm font-mono font-black text-emerald-500">{totalAcertos}</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Erros</span>
                 <span className="text-sm font-mono font-black text-red-500">{totalErros}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Pontuação Líquida</span>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">Penalidade ativa (-1 por erro)</span>
                 </div>
                 <span className={`text-xl font-mono font-black ${score >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {score > 0 ? `+${score}` : score} pt
                 </span>
              </div>
           </div>

           <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
              <button
                 onClick={() => setIsStarted(false)}
                 className="flex-grow py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                 <RotateCcw size={14} />
                 Jogar de Novo
              </button>
              <button
                 onClick={onClose}
                 className="flex-grow py-4 bg-pink-600 hover:bg-pink-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-pink-600/20 flex items-center justify-center gap-2"
              >
                 Concluir
              </button>
           </div>
        </div>
      )}

      {/* --- FOOTER HINTS --- */}
      {isStarted && !isFinished && (
        <div className="relative z-10 bg-zinc-950/90 border-t border-zinc-800 py-4 flex flex-col md:flex-row items-center justify-center gap-8 backdrop-blur-md text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
           <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 font-mono text-xs">ESPAÇO</kbd>
              <span>Virar Card</span>
           </div>
           
           {!isFlipped ? (
             <div className="flex items-center gap-2">
                <div className="flex gap-1">
                    <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 font-mono text-xs"><ArrowLeft size={10} /></kbd>
                    <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 font-mono text-xs"><ArrowRight size={10} /></kbd>
                </div>
                <span>Navegar</span>
             </div>
           ) : (
             <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 font-mono text-xs"><ArrowLeft size={10} /></kbd>
                  <span>Classificar Erro</span>
               </div>
               <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 font-mono text-xs"><ArrowRight size={10} /></kbd>
                  <span>Classificar Acerto</span>
               </div>
             </div>
           )}
        </div>
      )}

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
