import React from 'react';
import { OnlineCourse } from '../../../types/course';

interface StudentCourseCardProps {
  course: any; // Using any for flexibility with product data
  onClick?: (course: any) => void;
  isLocked?: boolean;
  price?: number;
}

export const StudentCourseCard: React.FC<StudentCourseCardProps> = ({ course, onClick, isLocked, price }) => {
  const isScholarship = course.isScholarship;

  return (
    <div 
      onClick={() => onClick && onClick(course)}
      className={`group relative aspect-[474/1000] rounded-xl overflow-hidden cursor-pointer border shadow-lg transition-all duration-300 hover:shadow-2xl ${
        isLocked 
          ? 'border-zinc-800 hover:border-red-600/50' 
          : 'border-gray-800 hover:shadow-red-900/20 hover:border-red-600/30'
      }`}
    >
      {/* --- BADGE BOLSISTA --- */}
      {isScholarship && (
        <div className="absolute top-2 left-2 z-10">
          <span className="bg-blue-900/80 backdrop-blur-sm text-blue-400 border border-blue-800 text-[10px] font-black px-2 py-0.5 rounded shadow-lg uppercase tracking-widest">
            Bolsista
          </span>
        </div>
      )}

      {/* --- CADEADO (Para Cursos Trancados) --- */}
      {isLocked && (
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
          <div className="bg-black/60 backdrop-blur-md text-zinc-400 border border-zinc-700/50 p-1.5 rounded shadow-lg">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          {price !== undefined && (
            <div className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-tighter">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)}
            </div>
          )}
        </div>
      )}

      {/* --- IMAGEM DA CAPA (Fundo Total) --- */}
      <img 
        src={course.coverUrl} 
        alt={course.title || course.name} 
        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isLocked ? 'grayscale opacity-60' : ''}`}
        loading="lazy"
      />

      {/* --- OVERLAY DE INTERAÇÃO (Aparece no Hover) --- */}
      <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center backdrop-blur-[2px] ${isLocked ? 'bg-black/60' : ''}`}>
        
        {isLocked ? (
           <div className="flex flex-col items-center gap-3">
              <div className="bg-white text-black rounded-full p-4 shadow-lg transform scale-50 group-hover:scale-100 transition-all duration-300 ease-out font-black text-xs uppercase tracking-widest">
                 Comprar
              </div>
              <p className="text-white text-[10px] font-bold uppercase tracking-widest px-4 text-center">Acesso Imediato</p>
           </div>
        ) : (
          <div className="bg-red-600 text-white rounded-full p-4 shadow-lg shadow-red-600/40 transform scale-50 group-hover:scale-100 transition-all duration-300 ease-out">
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
              </svg>
          </div>
        )}

      </div>

      {/* Gradiente sutil na base (opcional, para dar acabamento) */}
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/80 to-transparent opacity-60 pointer-events-none" />
      
      {/* Título Visível se estiver Trancado (já que a capa pode estar escura) */}
      {isLocked && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
           <h4 className="text-xs font-black text-white uppercase leading-tight line-clamp-2 drop-shadow-lg">
              {course.name || course.title}
           </h4>
        </div>
      )}
    </div>
  );
};
