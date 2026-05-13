import React from 'react';
import { CourseLesson } from '../../../../../types/course';

// Ícones
const PlayIcon = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;
const EditIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const MoveIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
const ContentIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;

// Ícones de Seta
const ArrowUp = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
const ArrowDown = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

// NOVOS ÍCONES PARA INDICADORES
const VideoSmallIcon = () => <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>;
const PdfSmallIcon = () => <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>;

interface LessonItemProps {
  lesson: CourseLesson;
  onEdit: () => void;
  onDelete: () => void;
  onMove: () => void; // Mover de Pasta
  onManageContent: () => void;
  
  // NOVAS PROPS DE SELEÇÃO
  isSelected?: boolean;
  onToggleSelection?: (lessonId: string) => void;

  // NOVAS PROPS DE ORDENAÇÃO
  onReorderUp: () => void;
  onReorderDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const LessonItem: React.FC<LessonItemProps> = ({ 
  lesson, onEdit, onDelete, onMove, onManageContent, 
  isSelected = false, onToggleSelection,
  onReorderUp, onReorderDown, isFirst, isLast 
}) => {
  
  // Verifica se tem contadores para exibir
  const hasVideos = (lesson.videoCount || 0) > 0;
  const hasPdfs = (lesson.pdfCount || 0) > 0;

  return (
    <div className={`flex items-center gap-3 p-3 bg-[#1a1d24] border ${isSelected ? 'border-red-600/50 bg-red-900/5' : 'border-gray-800'} rounded-lg hover:border-gray-600 transition-colors group`}>
      
      {/* Checkbox de Seleção */}
      <div className="flex items-center justify-center pr-1">
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={() => onToggleSelection && onToggleSelection(lesson.id)}
          className="w-4 h-4 rounded border-gray-700 bg-black text-red-600 focus:ring-red-600 focus:ring-offset-black cursor-pointer"
        />
      </div>

      {/* Capa ou Ícone */}
      <div className="w-16 h-10 bg-black rounded overflow-hidden flex items-center justify-center shrink-0 border border-gray-800 relative">
        {lesson.coverUrl ? (
            <img src={lesson.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
            <div className="text-gray-600"><PlayIcon /></div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="text-sm font-medium text-gray-200 truncate group-hover:text-white leading-tight">{lesson.title}</h4>
        
        {/* --- INDICADORES DE CONTEÚDO (NOVO) --- */}
        {(hasVideos || hasPdfs) && (
            <div className="flex items-center gap-3 mt-1.5">
                {hasVideos && (
                    <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-gray-800" title={`${lesson.videoCount} Vídeos`}>
                        <VideoSmallIcon />
                        <span className="text-[9px] font-bold text-gray-400">{lesson.videoCount}</span>
                    </div>
                )}
                {hasPdfs && (
                    <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-gray-800" title={`${lesson.pdfCount} PDFs`}>
                        <PdfSmallIcon />
                        <span className="text-[9px] font-bold text-gray-400">{lesson.pdfCount}</span>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
        
        {/* Botões de Ordenação */}
        <div className="flex flex-col gap-0.5 mr-2">
            <button onClick={onReorderUp} disabled={isFirst} className="text-gray-600 hover:text-white disabled:opacity-30" title="Mover para cima"><ArrowUp /></button>
            <button onClick={onReorderDown} disabled={isLast} className="text-gray-600 hover:text-white disabled:opacity-30" title="Mover para baixo"><ArrowDown /></button>
        </div>

        <button onClick={onManageContent} title="Gerenciar Conteúdo" className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-yellow-500 hover:text-yellow-400 mr-2 border border-gray-700">
            <ContentIcon />
        </button>

        <button onClick={onMove} title="Mover para outra pasta" className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
            <MoveIcon />
        </button>
        <button onClick={onEdit} title="Editar" className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400">
            <EditIcon />
        </button>
        <button onClick={onDelete} title="Excluir" className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-500">
            <TrashIcon />
        </button>
      </div>
    </div>
  );
};
