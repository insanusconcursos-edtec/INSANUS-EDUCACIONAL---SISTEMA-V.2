import React, { useState, useEffect } from 'react';
import { X, PlayCircle, Folder, CheckSquare, Square, Loader2, Save, FileText } from 'lucide-react';
import { courseService } from '../../../../services/courseService';
import { CourseLesson, CourseStructureModule } from '../../../../types/course';
import { LinkedLesson } from '../../../../types/courseEdital';

interface LinkLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  topicId?: string; // Opcional, usado para contexto se necessário
  onSave: (lessons: LinkedLesson[]) => void;
  initialSelectedIds?: string[];
}

interface LessonRowProps {
  lesson: CourseLesson;
  isSelected: boolean;
  onClick: () => void;
}

const LessonRow: React.FC<LessonRowProps> = ({ lesson, isSelected, onClick }) => (
  <div 
      onClick={onClick}
      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all mb-1 ${isSelected ? 'bg-blue-900/10 border-blue-500/30' : 'bg-transparent border-transparent hover:bg-zinc-800'}`}
  >
      {isSelected 
          ? <CheckSquare size={16} className="text-blue-500 shrink-0" /> 
          : <Square size={16} className="text-zinc-600 shrink-0" />
      }
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${lesson.type === 'pdf' ? 'border-yellow-600/30 bg-yellow-600/10 text-yellow-500' : 'border-red-600/30 bg-red-600/10 text-red-500'}`}>
          {lesson.type === 'pdf' ? <FileText size={10} /> : <PlayCircle size={10} />}
      </div>
      <span className={`text-xs font-medium uppercase ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
          {lesson.title}
      </span>
  </div>
);

export function LinkLessonModal({ isOpen, onClose, courseId, onSave, initialSelectedIds = [] }: LinkLessonModalProps) {
  const [structure, setStructure] = useState<CourseStructureModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && courseId) {
        loadData();
        setSelectedIds(new Set(initialSelectedIds));
    }
  }, [isOpen, courseId]);

  const loadData = async () => {
    setLoading(true);
    try {
        const data = await courseService.getCourseStructure(courseId);
        setStructure(data);
        
        // Auto-expandir módulos que já tenham aulas selecionadas
        const toExpand: Record<string, boolean> = {};
        
        data.forEach((mod: CourseStructureModule) => {
            let hasSelection = false;
            
            // Check loose lessons
            if (mod.looseLessons?.some((l: CourseLesson) => initialSelectedIds.includes(l.id))) {
                hasSelection = true;
            }
            
            // Check folders
            if (!hasSelection && mod.folders) {
                mod.folders.forEach((f) => {
                    if (f.lessons?.some((l: CourseLesson) => initialSelectedIds.includes(l.id))) {
                        hasSelection = true;
                    }
                });
            }

            if (hasSelection) toExpand[mod.id] = true;
        });
        
        setExpandedModules(toExpand);

    } catch (error) {
        console.error("Erro ao carregar estrutura", error);
    } finally {
        setLoading(false);
    }
  };

  const toggleSelection = (lessonId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(lessonId)) newSet.delete(lessonId);
    else newSet.add(lessonId);
    setSelectedIds(newSet);
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => ({...prev, [moduleId]: !prev[moduleId]}));
  };

  const handleConfirm = () => {
    const selectedLessons: LinkedLesson[] = [];
    
    // Varre a estrutura para reconstruir os objetos LinkedLesson baseados nos IDs selecionados
    structure.forEach((mod: CourseStructureModule) => {
        // 1. Aulas Soltas
        mod.looseLessons?.forEach((lesson: CourseLesson) => {
            if (selectedIds.has(lesson.id)) {
                selectedLessons.push({
                    id: lesson.id,
                    title: lesson.title,
                    moduleId: mod.id
                });
            }
        });

        // 2. Aulas em Pastas
        mod.folders?.forEach((folder) => {
            folder.lessons?.forEach((lesson: CourseLesson) => {
                if (selectedIds.has(lesson.id)) {
                    selectedLessons.push({
                        id: lesson.id,
                        title: lesson.title,
                        moduleId: mod.id
                    });
                }
            });
        });
    });

    onSave(selectedLessons);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 bg-zinc-900/50 flex justify-between items-center shrink-0">
            <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <PlayCircle size={20} className="text-blue-500" />
                Vincular Aulas do Curso
            </h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : structure.length === 0 ? (
                <div className="text-center py-10 text-zinc-600 font-bold uppercase text-xs">Nenhuma aula encontrada no curso.</div>
            ) : (
                structure.map((mod: CourseStructureModule) => {
                    const isExpanded = expandedModules[mod.id];
                    
                    // Contagem de selecionados neste módulo
                    let moduleSelectedCount = 0;
                    mod.looseLessons?.forEach((l: CourseLesson) => { if(selectedIds.has(l.id)) moduleSelectedCount++; });
                    mod.folders?.forEach((f) => {
                        f.lessons?.forEach((l: CourseLesson) => { if(selectedIds.has(l.id)) moduleSelectedCount++; });
                    });

                    return (
                        <div key={mod.id} className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/20">
                            {/* Module Header */}
                            <div 
                                onClick={() => toggleModule(mod.id)}
                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-900 transition-colors bg-[#1a1d24]"
                            >
                                <div className="flex items-center gap-3">
                                    <Folder size={16} className="text-yellow-600" />
                                    <span className="text-sm font-bold text-zinc-300 uppercase">{mod.title}</span>
                                </div>
                                {moduleSelectedCount > 0 && (
                                    <span className="text-[9px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                                        {moduleSelectedCount} selecionadas
                                    </span>
                                )}
                            </div>

                            {/* Module Content */}
                            {isExpanded && (
                                <div className="p-3 space-y-3 bg-black/20">
                                    
                                    {/* 1. Pastas (Submódulos) */}
                                    {mod.folders?.map((folder) => (
                                        <div key={folder.id} className="ml-2 border-l-2 border-zinc-800 pl-3">
                                            <div className="flex items-center gap-2 mb-2 text-zinc-500">
                                                <Folder size={12} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">{folder.title}</span>
                                            </div>
                                            
                                            <div className="pl-1">
                                                {folder.lessons?.length === 0 && <span className="text-[10px] text-zinc-600 italic">Pasta vazia</span>}
                                                {folder.lessons?.map((lesson: CourseLesson) => (
                                                    <LessonRow 
                                                        key={lesson.id} 
                                                        lesson={lesson} 
                                                        isSelected={selectedIds.has(lesson.id)} 
                                                        onClick={() => toggleSelection(lesson.id)} 
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {/* 2. Aulas Soltas no Módulo */}
                                    {mod.looseLessons?.length > 0 && (
                                        <div className="mt-2">
                                            {mod.folders?.length > 0 && <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-2 ml-1">Aulas Avulsas</div>}
                                            {mod.looseLessons.map((lesson: CourseLesson) => (
                                                <LessonRow 
                                                    key={lesson.id} 
                                                    lesson={lesson} 
                                                    isSelected={selectedIds.has(lesson.id)} 
                                                    onClick={() => toggleSelection(lesson.id)} 
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {(!mod.folders?.length && !mod.looseLessons?.length) && (
                                        <div className="text-xs text-zinc-600 italic px-2">Módulo vazio.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-900 bg-zinc-900/50 flex justify-between items-center shrink-0">
            <span className="text-xs font-bold text-zinc-500 uppercase">{selectedIds.size} aulas selecionadas</span>
            <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-bold uppercase">Cancelar</button>
                <button 
                    onClick={handleConfirm}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-900/20"
                >
                    <Save size={14} /> Salvar Vínculos
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}