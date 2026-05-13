import React from 'react';
import { CourseSubModule, CourseLesson } from '../../../../../types/course';
import { LessonItem } from './LessonItem';
import { Folder } from 'lucide-react';

interface SubModuleItemProps {
  subModule: CourseSubModule;
  lessons: CourseLesson[];
  onEdit: () => void;
  onDelete: () => void;
  onAddLesson: () => void;
  
  // --- NOVAS PROPS ---
  isOpen: boolean;        // Recebe estado do pai
  onToggle: () => void;   // Recebe função do pai
  
  // Props para repassar às aulas (callbacks existentes)
  onEditLesson?: (lesson: CourseLesson) => void;
  onDeleteLesson?: (lesson: CourseLesson) => void;
  onMoveLesson?: (lesson: CourseLesson) => void;
  onManageLesson?: (lesson: CourseLesson) => void;

  // NOVAS PROPS DE SELEÇÃO
  selectedLessonIds?: string[];
  onToggleLessonSelection?: (lessonId: string) => void;

  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onReorderLesson?: (index: number, direction: 'up' | 'down') => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export const SubModuleItem: React.FC<SubModuleItemProps> = ({ 
  subModule, lessons, onEdit, onDelete, onAddLesson, 
  isOpen, onToggle,
  onEditLesson, onDeleteLesson, onMoveLesson, onManageLesson,
  selectedLessonIds = [], onToggleLessonSelection,
  onMoveUp, onMoveDown, onReorderLesson, isFirst, isLast
}) => {
  
  // Ícones de Seta
  const ArrowUp = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
  const ArrowDown = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7 7" /></svg>;

  return (
    <div className="border border-gray-800 rounded-lg bg-[#1a1d24] overflow-hidden transition-all">
      
      {/* Cabeçalho da Pasta */}
      <div className="flex items-center justify-between p-4 hover:bg-[#202329] transition-colors">
        
        {/* Área clicável para abrir/fechar */}
        <div 
            className="flex items-center gap-3 cursor-pointer flex-1" 
            onClick={onToggle} // Usa a função do pai
        >
            {/* Ícone da Seta (Gira conforme isOpen) */}
            <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            
            {/* Ícone de Pasta (LUCIDE) */}
            <Folder size={20} className="text-yellow-600" fill="currentColor" />
            
            <h4 className="text-white font-bold text-sm uppercase">{subModule.title}</h4>
            {subModule.publishDate && (
                <span className="text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">
                    Agendado: {new Date(subModule.publishDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
            )}
            <span className="text-[10px] text-gray-500 bg-black/30 px-2 py-0.5 rounded border border-gray-700">
                {lessons.length} aulas
            </span>
        </div>

        {/* Ações da Pasta (Editar/Excluir/Add Aula) */}
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {/* BOTÕES DE ORDENAÇÃO */}
            <div className="flex items-center bg-black/40 rounded mr-2 border border-gray-800">
                <button 
                    onClick={onMoveUp} 
                    disabled={isFirst}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-l disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para cima"
                >
                    <ArrowUp />
                </button>
                <div className="w-px h-4 bg-gray-800"></div>
                <button 
                    onClick={onMoveDown} 
                    disabled={isLast}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-r disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover para baixo"
                >
                    <ArrowDown />
                </button>
            </div>

            <button onClick={onAddLesson} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-[10px] uppercase font-bold rounded border border-gray-700 transition-colors" title="Adicionar Aula na Pasta">
                + Aula
            </button>
            <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-800 rounded">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>
      </div>

      {/* Conteúdo (Aulas) - Controlado pelo isOpen */}
      {isOpen && (
        <div className="border-t border-gray-800 bg-black/20 p-2 space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
            {lessons.length === 0 && (
                <div className="text-center py-4 text-gray-600 text-xs italic">Nenhuma aula nesta pasta.</div>
            )}
            {lessons.map((lesson, index) => (
                <LessonItem 
                    key={lesson.id} 
                    lesson={lesson}
                    // Repassar funções de edição/delete para a aula
                    onEdit={() => onEditLesson && onEditLesson(lesson)}
                    onDelete={() => onDeleteLesson && onDeleteLesson(lesson)}
                    onMove={() => onMoveLesson && onMoveLesson(lesson)}
                    onManageContent={() => onManageLesson && onManageLesson(lesson)}
                    onReorderUp={() => onReorderLesson && onReorderLesson(index, 'up')}
                    onReorderDown={() => onReorderLesson && onReorderLesson(index, 'down')}
                    isFirst={index === 0}
                    isLast={index === lessons.length - 1}

                    // Props de Seleção
                    isSelected={selectedLessonIds.includes(lesson.id)}
                    onToggleSelection={onToggleLessonSelection}
                />
            ))}
        </div>
      )}
    </div>
  );
};