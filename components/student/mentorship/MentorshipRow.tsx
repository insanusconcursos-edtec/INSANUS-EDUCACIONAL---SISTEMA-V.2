import React, { useRef, useState, useEffect } from 'react';
import { MentorshipSection, MentorshipModule } from '../../../types/mentorship';
import { MentorshipCard } from './MentorshipCard';

interface MentorshipRowProps {
  section: MentorshipSection;
  onModuleClick: (module: MentorshipModule) => void;
}

export const MentorshipRow: React.FC<MentorshipRowProps> = ({ section, onModuleClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Estado para controlar se a seção está expandida ou recolhida
  const [isOpen, setIsOpen] = useState(true);
  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);

  // Reset de scroll no mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
      handleScroll();
    }
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setIsAtStart(scrollLeft <= 5);
      setIsAtEnd(scrollLeft + clientWidth >= scrollWidth - 5);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    const scrollAmount = 350; // Largura aproximada de um card + gap
    
    if (e.key === 'ArrowRight') {
        scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    } else if (e.key === 'ArrowLeft') {
        scrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  if (!section.modules || section.modules.length === 0) return null;

  return (
    <div className="mb-8 animate-in fade-in slide-in-from-right-4 duration-500 border-b border-gray-800/30 pb-8 last:border-0">
      
      {/* --- CABEÇALHO DA SEÇÃO (CLICÁVEL) --- */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between mb-4 px-4 md:px-8 cursor-pointer group/header select-none hover:bg-white/5 py-2 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
            {/* Indicador Visual (Barra Temática) */}
            <div className={`w-1 h-6 bg-[var(--plan-theme)] rounded-full transition-all ${isOpen ? 'opacity-100' : 'opacity-50'}`}></div>
            
            {/* Título */}
            <h3 className="text-white font-bold text-lg md:text-xl uppercase tracking-wide group-hover/header:text-[var(--plan-theme)] transition-colors">
            {section.title}
            </h3>
        </div>
        
        {/* Ícone Chevron */}
        <div className={`p-2 rounded-full bg-gray-800/50 text-gray-400 group-hover/header:text-white transition-all transform duration-300 ${isOpen ? 'rotate-180 bg-gray-700' : 'rotate-0'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
      </div>

      {/* --- CARROSSEL DE CARDS --- */}
      <div 
        className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        {/* CORREÇÃO AQUI: Removemos a classe 'group' desta div para evitar ativar todos os cards */}
        <div className="relative">
            <div 
            ref={scrollRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto px-4 md:px-8 pb-6 pt-2 scroll-smooth snap-x snap-mandatory focus:outline-none custom-scrollbar scroll-pl-4 md:scroll-pl-8"
            >
            {section.modules
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((module) => (
                <MentorshipCard 
                    key={module.id} 
                    module={module} 
                    onClick={onModuleClick} 
                />
            ))}
            </div>
            
            {/* Gradientes Laterais Dinâmicos */}
            <div className={`absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none hidden md:block transition-opacity duration-300 ${isAtStart ? 'opacity-0' : 'opacity-100'}`} />
            <div className={`absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none hidden md:block transition-opacity duration-300 ${isAtEnd ? 'opacity-0' : 'opacity-100'}`} />
        </div>
      </div>
    </div>
  );
};