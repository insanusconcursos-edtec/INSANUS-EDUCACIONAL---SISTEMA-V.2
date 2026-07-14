import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OnlineCourse, CourseModule, CourseSubModule, CourseLesson, CourseGroup } from '../../../../types/course';
import { courseService } from '../../../../services/courseService';
import { CoursePlayerSidebar } from './CoursePlayerSidebar';
import { CoursePlayerContent } from './CoursePlayerContent';
import { useAuth } from '../../../../contexts/AuthContext';

interface CoursePlayerProps {
  course: OnlineCourse;
  module: CourseModule;
  onBack: () => void;
}

export function CoursePlayer({ course, module, onBack }: CoursePlayerProps) {
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const [structure, setStructure] = useState<{ 
    groups: CourseGroup[],
    subModules: CourseSubModule[], 
    lessons: CourseLesson[] 
  }>({ groups: [], subModules: [], lessons: [] });
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);
  
  // Estado para armazenar IDs das aulas concluídas
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
        try {
            // 1. Carrega dados do Módulo Atual
            const [subs, lessons, grps] = await Promise.all([
                courseService.getSubModules(module.id),
                courseService.getLessons(module.id),
                courseService.getGroups(module.id)
            ]);
            setStructure({ subModules: subs, lessons: lessons, groups: grps });
            
            // 2. Carrega Progresso (Aulas Feitas)
            if (currentUser) {
                const completed = await courseService.getCompletedLessons(currentUser.uid, course.id);
                setCompletedLessons(completed);
            }

            // 3. Lógica para abrir aula via URL (Smart Resume)
            const lessonIdFromUrl = searchParams.get('lesson');
            if (lessonIdFromUrl && lessons.length > 0) {
                const target = lessons.find(l => l.id === lessonIdFromUrl);
                if (target) {
                    setActiveLesson(target);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [module.id, course.id, currentUser, searchParams]);

  const handleToggleComplete = async () => {
    if (!activeLesson || !currentUser) return;

    const isCurrentlyCompleted = completedLessons.includes(activeLesson.id);
    let newCompletedList = [];

    // Atualização Otimista da UI
    if (isCurrentlyCompleted) {
        newCompletedList = completedLessons.filter(id => id !== activeLesson.id);
    } else {
        newCompletedList = [...completedLessons, activeLesson.id];
    }
    setCompletedLessons(newCompletedList);

    // Persistência no Banco
    try {
        await courseService.toggleLessonCompletion(currentUser.uid, course.id, activeLesson.id, !isCurrentlyCompleted);
    } catch (error) {
        console.error("Erro ao salvar progresso", error);
        // Reverter UI em caso de falha
        setCompletedLessons(completedLessons);
    }
  };

  return (
    <div className="fixed top-[64px] left-0 right-0 bottom-0 bg-black z-50 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden animate-in fade-in custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
      
      {/* ÁREA DE CONTEÚDO (Esquerda) */}
      <div className="w-full lg:flex-1 flex flex-col bg-black order-1 lg:order-1 relative lg:border-r border-gray-900 h-auto lg:h-full lg:min-h-0">
        
        {/* Barra de Navegação Interna */}
        <div className="w-full h-12 border-b border-gray-800 bg-[#0f1114] flex items-center justify-between px-4 shrink-0 sticky top-0 lg:relative z-20">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white text-xs font-bold uppercase transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    <span className="hidden sm:inline">Voltar</span>
                </button>
                <div className="h-4 w-px bg-gray-800 hidden sm:block"></div>
                <span className="text-gray-500 font-bold text-xs uppercase tracking-wider hidden md:block truncate max-w-[300px]">
                    {module.title}
                </span>
            </div>
            
            {activeLesson && (
                <button 
                    onClick={handleToggleComplete}
                    className={`px-4 py-2 text-white text-[10px] font-bold uppercase rounded flex items-center gap-2 transition-all duration-300 shadow-lg
                        ${completedLessons.includes(activeLesson.id) 
                            ? 'bg-green-600 hover:bg-green-500' 
                            : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                        }
                    `}
                >
                    {completedLessons.includes(activeLesson.id) ? (
                        <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            <span>Concluída</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>Concluir Aula</span>
                        </>
                    )}
                </button>
            )}
        </div>

        {/* Área de Conteúdo */}
        <div className="w-full h-auto lg:flex-1 lg:overflow-y-auto custom-scrollbar bg-black">
            {loading ? (
                <div className="flex items-center justify-center py-20 lg:h-full"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600"></div></div>
            ) : activeLesson ? (
                <CoursePlayerContent lesson={activeLesson} />
            ) : (
                <div className="flex flex-col items-center justify-center py-20 lg:h-full text-gray-500">
                    <p>Selecione uma aula para começar.</p>
                </div>
            )}
        </div>
      </div>

      {/* SIDEBAR (Direita) */}
      <div className="w-full lg:w-96 bg-[#121418] border-t lg:border-t-0 lg:border-l border-gray-800 shrink-0 h-auto lg:h-full flex flex-col order-2 lg:order-2 z-10">
        <CoursePlayerSidebar 
            structure={structure} 
            activeLessonId={activeLesson?.id || null} 
            onSelectLesson={setActiveLesson}
            moduleTitle={module.title}
            completedLessons={completedLessons}
        />
      </div>


    </div>
  );
}