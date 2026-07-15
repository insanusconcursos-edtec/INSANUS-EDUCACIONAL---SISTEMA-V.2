import React, { useState, useEffect } from 'react';
import { OnlineCourse, CourseModule } from '../../../../types/course';
import { courseService } from '../../../../services/courseService';
import { Search, Copy, Check, AlertCircle, X } from 'lucide-react';

interface CopyModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceModule: CourseModule | null;
  onConfirm: (targetCourseId: string) => Promise<void>;
}

export function CopyModuleModal({ isOpen, onClose, sourceModule, onConfirm }: CopyModuleModalProps) {
  const [courses, setCourses] = useState<OnlineCourse[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCourses();
      setSelectedCourseId(null);
      setSearch('');
    }
  }, [isOpen]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await courseService.getCourses();
      // Filtra o curso atual para não copiar para ele mesmo (opcional, mas evita confusão)
      setCourses(data.filter(c => c.id !== sourceModule?.courseId));
    } catch (error) {
      console.error("Erro ao carregar cursos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedCourseId) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedCourseId);
      onClose();
    } catch (error) {
      console.error("Erro ao copiar módulo:", error);
      alert("Erro ao copiar módulo. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !sourceModule) return null;

  const filteredCourses = courses.filter(course => 
    course.title.toLowerCase().includes(search.toLowerCase()) ||
    course.organization?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121418] border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-red-900/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="bg-red-600/20 p-3 rounded-xl border border-red-600/30">
              <Copy className="text-red-500" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Copiar Disciplina</h3>
              <p className="text-zinc-500 text-sm">Selecione o curso de destino para criar uma cópia de <span className="text-white font-bold">&quot;{sourceModule.title}&quot;</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 pb-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text"
              placeholder="Buscar curso por título ou órgão..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/50 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600"></div>
              <p className="text-zinc-500 text-sm animate-pulse">Carregando cursos...</p>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
              <AlertCircle className="mx-auto text-zinc-700 mb-3" size={40} />
              <p className="text-zinc-500">Nenhum curso encontrado com &quot;{search}&quot;</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filteredCourses.map(course => (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourseId(course.id)}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                    selectedCourseId === course.id 
                      ? 'bg-red-600/10 border-red-600/50 shadow-lg shadow-red-900/5' 
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <div className="w-12 h-16 rounded-lg overflow-hidden flex-none bg-zinc-800 border border-zinc-700">
                    <img 
                      src={course.coverUrl} 
                      alt={course.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                       {course.organization && (
                         <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase tracking-wider border border-zinc-700">
                           {course.organization}
                         </span>
                       )}
                       {course.type && (
                         <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${course.type === 'REGULAR' ? 'bg-blue-900/20 text-blue-400 border border-blue-900/30' : 'bg-purple-900/20 text-purple-400 border border-purple-900/30'}`}>
                           {course.type}
                         </span>
                       )}
                    </div>
                    <h4 className="text-white font-bold text-sm truncate uppercase tracking-tight">{course.title}</h4>
                    <p className="text-zinc-500 text-[10px] uppercase font-medium">Criado em {new Date(course.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  {selectedCourseId === course.id && (
                    <div className="bg-red-600 p-1.5 rounded-full">
                      <Check className="text-white" size={14} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
          <div className="text-zinc-500 text-xs flex items-center gap-2 max-w-[60%]">
             <AlertCircle size={14} />
             <p>A estrutura completa (pastas, aulas e materiais) será replicada no destino.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-bold uppercase text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            >
              Cancelar
            </button>
            <button
              disabled={!selectedCourseId || isSubmitting}
              onClick={handleConfirm}
              className="px-8 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold uppercase rounded-xl shadow-lg shadow-red-900/20 flex items-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  Copiando...
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Confirmar Cópia
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
