import React from 'react';
import { OnlineCourse } from '../../../types/course';

// Ícones (ajuste conforme sua biblioteca, ex: Lucide-React ou Heroicons)
const EditIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const CopyIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const SettingsIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

interface CourseCardProps {
  course: OnlineCourse;
  onEdit: (course: OnlineCourse) => void;
  onManage: (course: OnlineCourse) => void;
  onDelete: (course: OnlineCourse) => void;
  onDuplicate: (course: OnlineCourse) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, onEdit, onManage, onDelete, onDuplicate }) => {
  return (
    <div className="group relative bg-[#121418] rounded-xl overflow-hidden border border-gray-800/50 hover:border-red-600/50 transition-all duration-300 w-full max-w-[240px]">
      {/* Capa do Curso (Proporção Vertical) */}
      <div className="aspect-[474/1000] relative overflow-hidden">
        <img 
          src={course.coverUrl} 
          alt={course.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Overlay de Gradiente */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121418] via-transparent to-transparent opacity-80" />

        {/* Título Sobreposto */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block">
              {course.organization || 'Geral'}
            </span>
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
              course.type === 'ISOLADO' 
                ? 'bg-zinc-700 text-zinc-300' 
                : 'bg-red-600/20 text-red-500 border border-red-500/30'
            }`}>
              {course.type || 'REGULAR'}
            </span>
          </div>
          <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">
            {course.title}
          </h3>
        </div>
      </div>

      {/* Barra de Ações */}
      <div className="p-3 grid grid-cols-4 gap-2 bg-[#121418] border-t border-gray-800">
        <button 
          onClick={() => onManage(course)}
          title="Gerenciar Conteúdo"
          className="flex items-center justify-center p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <SettingsIcon />
        </button>
        
        <button 
          onClick={() => onEdit(course)}
          title="Editar Informações"
          className="flex items-center justify-center p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-blue-400 transition-colors"
        >
          <EditIcon />
        </button>

        <button 
          onClick={() => onDuplicate(course)}
          title="Duplicar Curso"
          className="flex items-center justify-center p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-yellow-400 transition-colors"
        >
          <CopyIcon />
        </button>

        <button 
          onClick={() => onDelete(course)}
          title="Excluir Curso"
          className="flex items-center justify-center p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
};
