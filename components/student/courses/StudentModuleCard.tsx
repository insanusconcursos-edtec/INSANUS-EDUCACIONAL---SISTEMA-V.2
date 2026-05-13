import React from 'react';
import { CourseModule } from '../../../types/course';

// Ícone de Cadeado (SVG)
const LockIcon = () => (
  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

interface StudentModuleCardProps {
  module: CourseModule;
  onClick: (module: CourseModule) => void;
}

export const StudentModuleCard: React.FC<StudentModuleCardProps> = ({ module, onClick }) => {
  // Lógica de Bloqueio (Data ou Manual)
  // Fix: parsing releaseDate ("YYYY-MM-DD") correctly for comparison
  const isDateLocked = module.releaseDate 
    ? new Date(module.releaseDate + "T00:00:00") > new Date() 
    : false;
    
  const isLocked = module.isLocked || isDateLocked;

  const formattedDate = module.releaseDate 
    ? new Date(module.releaseDate + 'T00:00:00').toLocaleDateString('pt-BR') 
    : '';

  const handleClick = () => {
    if (!isLocked) {
      onClick(module);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`relative flex-none w-48 md:w-60 aspect-[474/1000] rounded-lg overflow-hidden transition-all duration-300 group border border-gray-800
        ${isLocked 
            ? 'cursor-not-allowed opacity-70 grayscale' 
            : 'cursor-pointer hover:scale-105 hover:z-10 hover:border-red-600/50 hover:shadow-xl hover:shadow-red-900/20'
        }
      `}
    >
      <img 
        src={module.coverUrl} 
        alt={module.title} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />

      {/* Overlay de Bloqueio */}
      {isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 text-center backdrop-blur-[2px]">
            <div className="bg-gray-800 p-3 rounded-full mb-2 border border-gray-700">
                <LockIcon />
            </div>
            <span className="text-gray-300 font-bold text-xs uppercase tracking-wider mb-1">Bloqueado</span>
            {module.releaseDate && (
                <div className="bg-black/80 px-2 py-1 rounded text-[10px] text-gray-400 mt-2 border border-gray-700">
                    Disponível em: <br/><span className="text-white font-mono">{formattedDate}</span>
                </div>
            )}
        </div>
      )}

      {/* Overlay de Título (Apenas Hover se não bloqueado) */}
      {!isLocked && (
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            <h4 className="text-white font-bold text-sm leading-tight drop-shadow-md">{module.title}</h4>
            <div className="h-1 w-10 bg-red-600 mt-2 rounded-full"></div>
        </div>
      )}
    </div>
  );
};