
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { OnlineCourse, CourseModule, CONTEST_STATUS_LABELS, CourseStructureModule } from '../../../types/course';
import { courseService } from '../../../services/courseService';
import { getStudentConfig } from '../../../services/studentService';
import { liveEventService } from '../../../services/liveEventService';
import { LiveEvent } from '../../../types/liveEvent';
import { StudentModuleCard } from './StudentModuleCard';
import { CoursePlayer } from './player/CoursePlayer';
import { useAuth } from '../../../contexts/AuthContext';
import { CheckCircle2, LayoutList, ListTree, PlayCircle, ArrowLeft, Radio, Video, Clock, Play, Calendar, PlaySquare } from 'lucide-react';
import { StudentCourseEdital } from './edital/StudentCourseEdital';
import { CourseReviewDashboard } from './reviews/CourseReviewDashboard';
import { WelcomeVideoModal } from './WelcomeVideoModal';

interface CourseDetailsProps {
  course: OnlineCourse;
  onBack: () => void;
}

export function CourseDetails({ course, onBack }: CourseDetailsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // ESTADO DAS ABAS (NOVO) - MÓDULOS, EDITAL ou LIVE
  const [activeTab, setActiveTab] = useState<'MODULES' | 'EDITAL' | 'LIVE'>('MODULES');
  const [focusTopicId, setFocusTopicId] = useState<string | null>(null);

  const [modules, setModules] = useState<CourseModule[]>([]);
  const [courseLiveEvents, setCourseLiveEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<CourseModule | null>(null);
  
  // Estado do Progresso e Estrutura para o "Continuar Estudos"
  const [structure, setStructure] = useState<CourseStructureModule[]>([]);
  const [detailedProgress, setDetailedProgress] = useState<Record<string, { completedAt: string }>>({});
  const [progress, setProgress] = useState(0);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loadData = async () => {
        try {
            // 1. Carrega Módulos, Estrutura e Eventos ao Vivo
            const [modulesData, structureData, liveEventsData] = await Promise.all([
                courseService.getModules(course.id),
                courseService.getCourseStructure(course.id),
                liveEventService.getLiveEventsByOnlineCourse(course.id)
            ]);
            setModules(modulesData);
            setStructure(structureData);
            setCourseLiveEvents(liveEventsData);

            // 2. Calcula Progresso Geral
            if (currentUser) {
                const [completedLessons, detailed, stats, config] = await Promise.all([
                    courseService.getCompletedLessons(currentUser.uid, course.id),
                    courseService.getDetailedProgress(currentUser.uid, course.id),
                    courseService.getCourseStats(course.id),
                    getStudentConfig(currentUser.uid)
                ]);
                
                setDetailedProgress(detailed);
                setCurrentPlanId(config?.currentPlanId);
                const total = stats.totalLessons;
                const completed = completedLessons.length;
                const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                
                setProgress(percentage);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [course.id, currentUser]);

  // Lógica para abrir módulo via URL
  useEffect(() => {
    const moduleId = searchParams.get('module');
    if (moduleId && modules.length > 0) {
      const module = modules.find(m => m.id === moduleId);
      if (module) {
        setSelectedModule(module);
      }
    }
  }, [searchParams, modules]);

  // Handler para Navegação via Review
  const handleReviewNow = (topicId: string) => {
      setActiveTab('EDITAL');
      setFocusTopicId(topicId);
  };

  // Algoritmo de Busca Cronológica (Última Concluída + 1)
  const handleContinue = () => {
    if (!currentUser || structure.length === 0) return;

    // 1. Achatamento (Flatten) da grade curricular para uma fila única 1D
    const flatCurriculum: { moduleId: string, lessonId: string }[] = [];
    structure.forEach(mod => {
        mod.folders.forEach(folder => {
            folder.lessons.forEach(lesson => {
                flatCurriculum.push({ moduleId: mod.id, lessonId: lesson.id });
            });
        });
        mod.looseLessons.forEach(lesson => {
            flatCurriculum.push({ moduleId: mod.id, lessonId: lesson.id });
        });
    });

    if (flatCurriculum.length === 0) return;

    // 2. Busca Cronológica: Encontra a aula concluída MAIS RECENTEMENTE no tempo
    let mostRecentIndex = -1;
    let latestTimestamp = 0;

    for (let i = 0; i < flatCurriculum.length; i++) {
        const item = flatCurriculum[i];
        const progress = detailedProgress[item.lessonId];
        
        if (progress) {
            const itemDate = new Date(progress.completedAt).getTime();
            if (itemDate >= latestTimestamp) {
                latestTimestamp = itemDate;
                mostRecentIndex = i;
            }
        }
    }

    let targetItem = null;

    // 3. Regras de Negócio Estritas: Última Concluída + 1
    if (mostRecentIndex === -1) {
        // Regra A: Nada concluído -> Vai para a primeiríssima aula do curso
        targetItem = flatCurriculum[0];
    } else if (mostRecentIndex + 1 < flatCurriculum.length) {
        // Regra B: Existe aula após a mais recente concluída -> Vai exatamente para a PRÓXIMA (+1)
        targetItem = flatCurriculum[mostRecentIndex + 1];
    } else {
        // Regra C: O curso todo foi concluído -> Mantém na última aula existente
        targetItem = flatCurriculum[mostRecentIndex];
    }

    // 4. Redirecionamento Imediato via URL Params
    if (targetItem) {
        setSearchParams({ module: targetItem.moduleId, lesson: targetItem.lessonId });
    }
  };

  if (selectedModule) {
      return (
        <CoursePlayer 
            course={course} 
            module={selectedModule} 
            onBack={() => {
                setSelectedModule(null);
                setSearchParams({});
            }} 
        />
      );
  }

  return (
    <div className="flex flex-col w-full animate-in fade-in pb-20 min-h-full">
      
      {/* ==================================================== */}
      {/* HERO BANNER RESPONSIVO (IGUAL PRESENCIAL)            */}
      {/* ==================================================== */}
      <div className="relative w-full mb-6 bg-zinc-900">
         
         {/* Botão Voltar */}
         <button 
            onClick={onBack}
            className="absolute top-4 left-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors backdrop-blur-sm"
         >
            <ArrowLeft size={24} />
         </button>

         <picture>
             <source media="(min-width: 768px)" srcSet={course.bannerUrlDesktop || course.coverUrl} />
             <img 
                src={course.bannerUrlMobile || course.coverUrl} 
                alt={`Banner do curso ${course.title}`} 
                className="w-full h-48 md:h-[400px] object-cover border-b border-[var(--plan-theme)]/30 shadow-lg" 
             />
         </picture>

         <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black to-transparent h-24 md:h-32 pointer-events-none"></div>
      </div>

      <div className="w-full px-6 md:px-8">
          {/* BARRA DE AÇÕES E PROGRESSO (MOVIDA PARA BAIXO DO BANNER) */}
          <div className="mb-8">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                   {/* Botão de Ação Principal */}
                   <button 
                    onClick={handleContinue}
                    className="flex items-center justify-center gap-2 bg-white hover:bg-gray-200 text-black px-8 py-3 rounded-lg font-black text-sm uppercase transition-transform hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)] shrink-0"
                   >
                       <PlayCircle size={20} fill="currentColor" />
                       {progress > 0 ? 'CONTINUAR ESTUDOS' : 'INICIAR CURSO'}
                   </button>

                   {/* Botão de Boas-Vindas (Opcional) */}
                   {course.welcomeVideoUrl && (
                      <button 
                        onClick={() => setIsWelcomeModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-lg font-black text-sm uppercase transition-transform hover:scale-105 border border-zinc-700 shrink-0"
                      >
                          <PlaySquare size={20} className="text-[var(--plan-theme)]" />
                          {course.welcomeButtonTitle || 'BOAS VINDAS'}
                      </button>
                   )}

                   <div className="flex items-center gap-4 flex-wrap w-full md:w-auto">
                      {/* Badge de Status */}
                      {course.contestStatus && course.contestStatus !== 'SEM_PREVISAO' && (
                          <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-bold text-xs uppercase shrink-0">
                              <CheckCircle2 size={16} className="text-green-500" />
                              <span className="text-gray-300">
                                {CONTEST_STATUS_LABELS[course.contestStatus]}
                                {course.contestStatus === 'BANCA_CONTRATADA' && course.examBoard && (
                                    <span className="text-white ml-1">: {course.examBoard}</span>
                                )}
                              </span>
                          </div>
                      )}

                      {/* Barra de Progresso */}
                      <div className="flex-1 min-w-[200px] max-w-md flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-3 px-4">
                          <span className="text-[10px] font-bold text-gray-400 uppercase hidden sm:block">Progresso</span>
                          <div className="flex-1 bg-black rounded-full h-1.5 overflow-hidden">
                              <div className="bg-[var(--plan-theme)] h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className="text-sm font-black text-white">{progress}%</span>
                      </div>
                   </div>
              </div>
          </div>

          {/* DASHBOARD DE REVISÕES */}
          <div className="mb-8">
            <CourseReviewDashboard courseId={course.id} onReviewNow={handleReviewNow} />
          </div>

          {/* SISTEMA DE ABAS (NOVO) */}
          <div className="flex items-center gap-8 border-b border-gray-800 mb-8">
            <button 
                onClick={() => setActiveTab('MODULES')}
                className={`flex items-center gap-2 pb-4 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-all
                    ${activeTab === 'MODULES' ? 'border-[var(--plan-theme)] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}
                `}
            >
                <LayoutList size={18} />
                Módulos do Curso
            </button>
            <button 
                onClick={() => setActiveTab('EDITAL')}
                className={`flex items-center gap-2 pb-4 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-all
                    ${activeTab === 'EDITAL' ? 'border-[var(--plan-theme)] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}
                `}
            >
                <ListTree size={18} />
                Edital Verticalizado
            </button>

            {courseLiveEvents.length > 0 && (
                <button 
                    onClick={() => setActiveTab('LIVE')}
                    className={`flex items-center gap-2 pb-4 px-1 border-b-2 font-bold text-xs uppercase tracking-widest transition-all
                        ${activeTab === 'LIVE' ? 'border-[var(--plan-theme)] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}
                    `}
                >
                    <Radio size={18} className={activeTab === 'LIVE' ? 'text-[var(--plan-theme)]' : ''} />
                    🔴 Eventos ao Vivo
                </button>
            )}
          </div>

          {/* CONTEÚDO CONDICIONAL */}
          <div>
              {activeTab === 'MODULES' ? (
                  // VISÃO DOS MÓDULOS
                  loading ? (
                      <div className="flex gap-4 overflow-hidden">
                          {[1,2,3].map(i => <div key={i} className="w-60 h-[300px] bg-zinc-900 rounded-lg animate-pulse" />)}
                      </div>
                  ) : modules.length === 0 ? (
                      <div className="text-zinc-500 italic px-1 text-sm border-l-2 border-zinc-800 pl-4 py-2">Nenhum módulo disponível neste curso.</div>
                  ) : (
                      <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent px-1">
                          {modules.map(module => (
                              <StudentModuleCard 
                                  key={module.id} 
                                  module={module} 
                                  onClick={setSelectedModule} 
                              />
                          ))}
                      </div>
                  )
              ) : activeTab === 'EDITAL' ? (
                  // VISÃO DO EDITAL VERTICALIZADO
                  <StudentCourseEdital 
                    courseId={course.id} 
                    planId={currentPlanId}
                    focusTopicId={focusTopicId} 
                  />
              ) : (
                  // VISÃO DOS EVENTOS AO VIVO
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {courseLiveEvents.map((event) => (
                          <div 
                              key={event.id}
                              className="group bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden hover:border-[var(--plan-theme)]/50 transition-all duration-300 flex flex-col"
                          >
                              {/* Thumbnail */}
                              <div className="relative aspect-video overflow-hidden bg-zinc-800">
                                  {event.thumbnailUrl ? (
                                      <img 
                                          src={event.thumbnailUrl} 
                                          alt={event.title}
                                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                          referrerPolicy="no-referrer"
                                      />
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                          <Video size={48} />
                                      </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                  
                                  {/* Status Badge */}
                                  <div className="absolute top-4 left-4">
                                      {event.status === 'live' ? (
                                          <div className="flex items-center gap-2 bg-[var(--plan-theme)] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse shadow-[0_0_15px_rgba(var(--plan-theme-rgb),0.5)]">
                                              <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                              Ao Vivo Agora
                                          </div>
                                      ) : (
                                          <div className="flex items-center gap-2 bg-zinc-800/90 backdrop-blur-md text-zinc-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-zinc-700">
                                              <Clock size={10} />
                                              {event.status === 'scheduled' ? 'Agendado' : 'Encerrado'}
                                          </div>
                                      )}
                                  </div>
                              </div>

                              {/* Info */}
                              <div className="p-5 flex-1 flex flex-col gap-4">
                                  <div className="space-y-2">
                                      <h3 className="text-white font-black text-lg uppercase tracking-tight line-clamp-2 group-hover:text-[var(--plan-theme)] transition-colors">
                                          {event.title}
                                      </h3>
                                      <div className="flex items-center gap-4 text-zinc-500 font-bold text-[10px] uppercase tracking-widest">
                                          <div className="flex items-center gap-1.5">
                                              <Calendar size={12} className="text-[var(--plan-theme)]" />
                                              {event.eventDate.split('-').reverse().join('/')}
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                              <Clock size={12} />
                                              {event.startTime}
                                          </div>
                                      </div>
                                  </div>

                                  <button 
                                      onClick={() => navigate(`/app/eventos-ao-vivo/sala/${event.id}`)}
                                      className={`w-full mt-auto flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 group/btn ${
                                          event.status === 'live' 
                                              ? 'bg-[var(--plan-theme)] hover:brightness-110 text-white shadow-lg shadow-[var(--plan-theme)]/20' 
                                              : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                                      }`}
                                  >
                                      <Play size={14} fill="currentColor" className="group-hover/btn:scale-110 transition-transform" />
                                      {event.status === 'live' ? 'ACESSAR SALA DE TRANSMISSÃO' : 'VER DETALHES DO EVENTO'}
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </div>

      {/* MODAL DE VÍDEO DE BOAS-VINDAS */}
      {course.welcomeVideoUrl && (
        <WelcomeVideoModal 
          isOpen={isWelcomeModalOpen}
          onClose={() => setIsWelcomeModalOpen(false)}
          videoUrl={course.welcomeVideoUrl}
          title={course.welcomeButtonTitle || 'BOAS VINDAS'}
        />
      )}
    </div>
  );
}
