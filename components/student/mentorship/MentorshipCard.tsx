
import React from 'react';
import { MentorshipModule } from '../../../types/mentorship';

// Ícone de Cadeado (SVG)
const LockIcon = () => (
  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

interface MentorshipCardProps {
  module: MentorshipModule;
  onClick: (module: MentorshipModule) => void;
}

export const MentorshipCard: React.FC<MentorshipCardProps> = ({ module, onClick }) => {
  // LÓGICA DE BLOQUEIO
  // 1. Verifica se está bloqueado manualmente pelo admin
  // 2. Verifica se a data de liberação é futura
  const isDateLocked = module.releaseDate ? new Date(module.releaseDate + "T00:00:00") > new Date() : false;
  
  // Se estiver bloqueado manualmente, verifica se já passou a data (se houver). Se não houver data, mantém bloqueado.
  // Regra Simplificada: Se isLocked=true E (sem data OU data futura), então BLOQUEADO.
  const isLocked = module.isLocked && (!module.releaseDate || isDateLocked);

  // Formatação da data para exibição amigável (Ex: 15/02/2026)
  const formattedDate = module.releaseDate 
    ? new Date(module.releaseDate + "T00:00:00").toLocaleDateString('pt-BR') 
    : '';

  // Handler de clique seguro
  const handleClick = () => {
    if (!isLocked) {
      onClick(module);
    }
  };

  return (
    <div 
      onClick={handleClick}
      // Se bloqueado, remove o cursor pointer e o efeito de escala. Se liberado, mantém comportamento padrão.
      className={`relative flex-none flex-shrink-0 w-40 md:w-60 aspect-[474/1000] rounded-lg overflow-hidden transition-all duration-300 transform group bg-[#1a1d24] border border-transparent snap-start
        ${isLocked 
            ? 'cursor-not-allowed opacity-80' // Estilo Bloqueado
            : 'cursor-pointer hover:scale-105 hover:z-10 hover:border-[var(--plan-theme)]/50' // Estilo Liberado
        }
      `}
    >
      {/* Imagem da Capa */}
      <img 
        src={module.coverUrl} 
        alt={module.title} 
        className={`w-full h-full object-cover transition-all duration-300
            ${isLocked ? 'grayscale filter brightness-50' : 'group-hover:opacity-100'} 
        `}
        loading="lazy"
      />

      {/* --- ESTADO BLOQUEADO (LAYER FIXO) --- */}
      {isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-black/40">
            <LockIcon />
            <span className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-1">
                Bloqueado
            </span>
            {module.releaseDate && (
                <p className="text-[10px] text-gray-500 leading-tight mt-1">
                    Disponível em:<br/>
                    <span className="text-gray-300 font-mono">{formattedDate}</span>
                </p>
            )}
        </div>
      )}

      {/* --- ESTADO LIBERADO (OVERLAY NO HOVER) --- */}
      {!isLocked && (
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            {/* Título do Módulo */}
            <h4 className="text-white font-bold text-sm leading-tight drop-shadow-md line-clamp-2 mb-3">
            {module.title}
            </h4>
            
            {/* Botão de Ação */}
            <div className="flex items-center gap-2">
            <button className="bg-[var(--plan-theme)] text-white rounded-full p-2 shadow-lg hover:brightness-110 transition-colors flex items-center justify-center">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">Acessar</span>
            </div>
        </div>
      )}
    </div>
  );
};
