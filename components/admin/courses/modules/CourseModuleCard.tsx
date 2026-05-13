import React from 'react';
import { CourseModule } from '../../../../types/course';

// Ícones SVG Inline
const EditIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const ArrowLeft = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
const ArrowRight = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const LockIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const ContentIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;

interface CourseModuleCardProps {
  module: CourseModule;
  onEdit: (module: CourseModule) => void;
  onDelete: (module: CourseModule) => void;
  onMoveLeft: (module: CourseModule) => void;
  onMoveRight: (module: CourseModule) => void;
  onManageContent: (module: CourseModule) => void;
  isFirst: boolean;
  isLast: boolean;
}

export const CourseModuleCard: React.FC<CourseModuleCardProps> = ({ 
  module, onEdit, onDelete, onMoveLeft, onMoveRight, onManageContent, isFirst, isLast 
}) => {
  
  // Formata data se existir
  const formattedDate = module.releaseDate 
    ? new Date(module.releaseDate + 'T00:00:00').toLocaleDateString('pt-BR') 
    : '';

  return (
    <div className="flex-none w-60 group relative flex flex-col">
      {/* Container da Imagem (Capa Vertical) */}
      <div className="relative aspect-[474/1000] bg-[#121418] rounded-xl overflow-hidden border border-gray-800 hover:border-red-600/50 transition-all duration-300">
        
        <img 
          src={module.coverUrl} 
          alt={module.title} 
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${module.isLocked ? 'grayscale opacity-50' : ''}`}
        />

        {/* Overlay de Bloqueio */}
        {module.isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 text-center">
            <div className="bg-red-600 p-2 rounded-full mb-2">
              <LockIcon />
            </div>
            <span className="text-white font-bold text-xs uppercase tracking-wider mb-1">Bloqueado</span>
            {module.releaseDate && (
              <p className="text-[10px] text-gray-300">Libera em: {formattedDate}</p>
            )}
          </div>
        )}

        {/* Overlay Hover (Título e Ação Principal) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <h3 className="text-white font-bold text-sm mb-3 line-clamp-2 drop-shadow-md">{module.title}</h3>
          
          <button 
            onClick={() => onManageContent(module)}
            className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase rounded flex items-center justify-center gap-2 shadow-lg"
          >
            <ContentIcon />
            Gerenciar
          </button>
        </div>
      </div>

      {/* Barra de Ações Inferior */}
      <div className="mt-2 grid grid-cols-4 gap-1 bg-[#121418] p-1 rounded-lg border border-gray-800">
        <button onClick={() => onMoveLeft(module)} disabled={isFirst} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded disabled:opacity-30 flex justify-center">
          <ArrowLeft />
        </button>
        
        <button onClick={() => onEdit(module)} className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-700 rounded flex justify-center">
          <EditIcon />
        </button>

        <button onClick={() => onDelete(module)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-700 rounded flex justify-center">
          <TrashIcon />
        </button>

        <button onClick={() => onMoveRight(module)} disabled={isLast} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded disabled:opacity-30 flex justify-center">
          <ArrowRight />
        </button>
      </div>
    </div>
  );
};