import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText, Link as LinkIcon, CheckCircle, Clock, AlertCircle, BookOpen, Video, CheckCircle2, Calendar, PlayCircle, ClipboardList } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Subject, Topic } from '../../../types/curriculum';
import { ClassScheduleEvent } from '../../../types/schedule';
import { Teacher } from '../../../types/teacher';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../../../contexts/AuthContext';
import { openWatermarkedPdf } from '../../../utils/pdfSecurityService';
import { classScheduleService } from '../../../services/classScheduleService';
import { curriculumService } from '../../../services/curriculumService';
import { teacherService } from '../../../services/teacherService';

interface StudentPedagogicalPlanningProps {
  classId: string;
  masterClassId?: string;
  totalMeetings?: number;
}

export function StudentPedagogicalPlanning({ classId, masterClassId, totalMeetings = 0 }: StudentPedagogicalPlanningProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, userData } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [events, setEvents] = useState<ClassScheduleEvent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Deep Linking: Auto-expand and scroll
  useEffect(() => {
    const urlSubjectId = searchParams.get('subjectId');
    const urlTopicId = searchParams.get('topicId');
    const urlModuleId = searchParams.get('moduleId');

    if (urlSubjectId || urlTopicId || urlModuleId) {
      if (urlSubjectId) setExpandedSubjects(prev => new Set([...prev, urlSubjectId]));
      if (urlTopicId) setExpandedTopics(prev => new Set([...prev, urlTopicId]));
      if (urlModuleId) setExpandedModules(prev => new Set([...prev, urlModuleId]));

      // Scroll to module after expansion
      if (urlModuleId) {
        setTimeout(() => {
          const element = document.getElementById(`module-${urlModuleId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('highlight-pulse');
            setTimeout(() => element.classList.remove('highlight-pulse'), 3000);
          }
        }, 500);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [eventsData, subjectsData, topicsData, teachersData] = await Promise.all([
          classScheduleService.getScheduleEventsByClass(classId),
          curriculumService.getSubjectsByClass(classId),
          curriculumService.getTopicsByClass(classId),
          teacherService.getTeachers()
        ]);

        setEvents(eventsData);
        setSubjects(subjectsData);
        setTopics(topicsData);
        setTeachers(teachersData);
      } catch (error) {
        console.error("Error loading planning data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [classId]);

  const handleOpenPdf = async (url: string, title: string) => {
    try {
      await openWatermarkedPdf(url, {
        uid: currentUser?.uid,
        email: currentUser?.email || 'aluno@insanus.com',
        cpf: userData?.cpf || '000.000.000-00'
      });
    } catch (error) {
      console.error('Error opening PDF:', error);
      window.open(url, '_blank');
    }
  };

  const toggleSubject = (id: string) => {
    const newSet = new Set(expandedSubjects);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedSubjects(newSet);
  };

  const toggleTopic = (id: string) => {
    const newSet = new Set(expandedTopics);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedTopics(newSet);
  };

  const toggleModule = (id: string) => {
    const newSet = new Set(expandedModules);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedModules(newSet);
  };
  
  const handleGoToTeachingArea = (teachingAreaLink: any) => {
    if (!teachingAreaLink) return;
    
    // Para turmas presenciais, o classId é usado como courseId para a Área de Ensino
    const courseId = classId; 

    if (courseId) {
      navigate(`/app/presential/${classId}?module=${teachingAreaLink.moduleId}&folder=${teachingAreaLink.folderId}`);
    } else {
      console.error("ID do curso online não encontrado para realizar o redirecionamento.");
    }
  };

  // Filter subjects that have topics
  const activeSubjects = subjects.filter(subject => 
    topics.some(topic => topic.subjectId === subject.id)
  );

  const onlineModuleIds = React.useMemo(() => {
    return new Set(
      topics.flatMap(t => t.modules || [])
        .filter(m => m.isOnline)
        .map(m => m.id)
    );
  }, [topics]);

  // Calculate global progression
  const globalStats = React.useMemo(() => {
    let totalRequired = 0;
    let totalCompleted = 0;

    subjects.forEach(subject => {
      const subjectTopics = topics.filter(t => t.subjectId === subject.id);
      const subjectRequired = subjectTopics.reduce((acc, topic) => {
        const topicPresentialClasses = (topic.modules || []).reduce((mAcc, m) => {
          if (!m.isOnline) return mAcc + (m.classesCount || 0);
          return mAcc;
        }, 0);
        
        if (topicPresentialClasses === 0 && (!topic.modules || topic.modules.length === 0)) {
          return acc + (topic.requiredClasses || 0);
        }
        return acc + topicPresentialClasses;
      }, 0);

      const subjectCompleted = events.filter(e => 
        e.subjectId === subject.id && 
        e.status === 'COMPLETED' && 
        !onlineModuleIds.has(e.moduleId)
      ).length;

      totalRequired += subjectRequired;
      totalCompleted += subjectCompleted;
    });

    // Calculate completed meetings
    const meetingsMap = new Map<number, ClassScheduleEvent[]>();
    events.forEach(e => {
      if (e.meetingNumber) {
        if (!meetingsMap.has(e.meetingNumber)) {
          meetingsMap.set(e.meetingNumber, []);
        }
        meetingsMap.get(e.meetingNumber)?.push(e);
      }
    });

    let completedMeetingsCount = 0;
    meetingsMap.forEach((meetingEvents) => {
      if (meetingEvents.length > 0 && meetingEvents.every(e => e.status === 'COMPLETED')) {
        completedMeetingsCount++;
      }
    });

    return {
      totalRequired,
      totalCompleted,
      completedMeetingsCount,
      percentage: totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0
    };
  }, [subjects, topics, events, onlineModuleIds]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Global Progression Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Progresso Geral de Aulas</h3>
              <p className="text-2xl font-black text-white">{globalStats.totalCompleted} / {globalStats.totalRequired}</p>
            </div>
            <span className="text-brand-red font-black text-xl">{globalStats.percentage}%</span>
          </div>
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-brand-red h-full transition-all duration-500" 
              style={{ width: `${globalStats.percentage}%` }}
            />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Contador de Encontros</h3>
            <p className="text-3xl font-black text-white">
              {globalStats.completedMeetingsCount} <span className="text-zinc-500 text-xl">/ {totalMeetings}</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-zinc-800 flex items-center justify-center">
            <CheckCircle2 className={twMerge(
              "w-6 h-6",
              globalStats.completedMeetingsCount === totalMeetings && totalMeetings > 0 ? "text-emerald-500" : "text-zinc-600"
            )} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="w-6 h-6 text-red-500" />
        <h2 className="text-xl font-bold text-white">Planejamento Pedagógico</h2>
      </div>

      {activeSubjects.map(subject => {
        const subjectTopics = topics.filter(t => t.subjectId === subject.id);
        
        // Calcular o total de aulas presenciais exigidas no currículo
        const totalRequiredClasses = subjectTopics.reduce((acc, topic) => {
          const topicPresentialClasses = (topic.modules || []).reduce((mAcc, m) => {
            if (!m.isOnline) return mAcc + (m.classesCount || 0);
            return mAcc;
          }, 0);
          
          // Se não houver módulos definidos, usar requiredClasses do tópico (assumindo que são presenciais)
          if (topicPresentialClasses === 0 && (!topic.modules || topic.modules.length === 0)) {
            return acc + (topic.requiredClasses || 0);
          }
          
          return acc + topicPresentialClasses;
        }, 0);

        const completedEvents = events.filter(e => 
          e.subjectId === subject.id && 
          e.status === 'COMPLETED' && 
          !onlineModuleIds.has(e.moduleId)
        );

        const isExpanded = expandedSubjects.has(subject.id);

        // Ordenar tópicos para esta disciplina
        const sortedTopics = [...subjectTopics].sort((a, b) => (a.order || 0) - (b.order || 0));

        return (
          <div key={subject.id} className="border border-zinc-800 rounded-lg overflow-hidden bg-black">
            {/* Subject Header */}
            <button
              onClick={() => toggleSubject(subject.id)}
              className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-zinc-900 transition-colors gap-3 md:gap-0"
            >
              <div className="flex items-center gap-3 w-full md:w-auto">
                {isExpanded ? <ChevronDown className="w-5 h-5 text-zinc-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />}
                <div 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: subject.color }}
                />
                <span className="font-medium text-zinc-100 text-left">{subject.name}</span>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-4 text-sm w-full md:w-auto pl-11 md:pl-0">
                <span className="text-zinc-400 text-xs md:text-sm whitespace-nowrap">
                  {completedEvents.length} / {totalRequiredClasses} aulas concluídas
                </span>
                <div className="w-20 md:w-24 h-2 bg-zinc-800 rounded-full overflow-hidden shrink-0">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ 
                      width: `${totalRequiredClasses > 0 ? (completedEvents.length / totalRequiredClasses) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
            </button>

            {/* Subject Content (Topics) */}
            {isExpanded && (
              <div className="border-t border-zinc-800 bg-black">
                {sortedTopics.map(topic => {
                  const isTopicExpanded = expandedTopics.has(topic.id);
                  const topicModules = topic.modules || [];

                  return (
                    <div key={topic.id} className="border-b border-zinc-800 last:border-0">
                      {/* Topic Header */}
                      <button
                        onClick={() => toggleTopic(topic.id)}
                        className="w-full flex flex-col md:flex-row md:items-center justify-between p-3 pl-8 hover:bg-zinc-900 transition-colors gap-1 md:gap-0"
                      >
                        <div className="flex items-center gap-3 w-full md:w-auto">
                          {isTopicExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />}
                          <span className="text-sm font-medium text-zinc-300 text-left">{topic.name}</span>
                        </div>
                        <span className="text-xs text-zinc-500 text-left pl-7 md:pl-0 shrink-0">
                          {topicModules.length} módulos
                        </span>
                      </button>

                      {/* Topic Content (Modules) */}
                      {isTopicExpanded && (
                        <div className="bg-black pl-12 pr-4 py-2 space-y-2">
                          {topicModules.map(module => {
                            const isModuleExpanded = expandedModules.has(module.id);
                            const moduleEvents = events.filter(e => e.moduleId === module.id)
                              .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime());
                            
                            const moduleContents = module.contents || [];

                            return (
                              <div 
                                key={module.id} 
                                id={`module-${module.id}`}
                                className="border border-zinc-800 rounded-md overflow-hidden bg-black transition-all duration-500"
                              >
                                {/* Module Header */}
                                <button
                                  onClick={() => toggleModule(module.id)}
                                  className="w-full flex flex-col md:flex-row md:items-center justify-between p-3 hover:bg-zinc-900 transition-colors gap-2 md:gap-0"
                                >
                                  <div className="flex items-center gap-3 w-full md:w-auto">
                                    {isModuleExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm text-zinc-300 text-left">{module.name}</span>
                                      {module.isOnline && (
                                        <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded border border-blue-500/20 font-medium uppercase shrink-0">
                                          Online
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between md:justify-end gap-3 text-xs text-zinc-500 w-full md:w-auto pl-7 md:pl-0">
                                    <span className="flex items-center gap-1 shrink-0">
                                      <FileText className="w-3 h-3" />
                                      {moduleContents.length}
                                    </span>
                                    {module.isOnline ? (
                                      <div className={`flex items-center gap-1.5 text-xs shrink-0 ${module.onlineStatus === 'PUBLICADO' ? 'text-green-500' : 'text-amber-500'}`}>
                                        {module.onlineStatus === 'PUBLICADO' ? <CheckCircle2 size={14} /> : <Video size={14} />}
                                        <span className="font-medium whitespace-nowrap">{module.onlineStatus === 'PUBLICADO' ? 'Publicado' : 'Em Gravação'}</span>
                                      </div>
                                    ) : (
                                      <span className="flex items-center gap-1 shrink-0">
                                        <Clock className="w-3 h-3" />
                                        {moduleEvents.filter(e => e.status === 'COMPLETED').length} / {module.classesCount} aulas
                                      </span>
                                    )}
                                  </div>
                                </button>

                                {/* Module Content (Materials & Classes) */}
                                {isModuleExpanded && (
                                  <div className="p-4 space-y-6 border-t border-zinc-800 bg-black">
                                    
                                    {module.isOnline && (
                                      <div className="mb-4 bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                                        <div className="flex items-start justify-between flex-wrap gap-4">
                                          <div>
                                            <h4 className="text-sm font-medium text-white mb-1">Conteúdo Online</h4>
                                            <p className="text-xs text-gray-400">
                                              {module.onlineStatus === 'PUBLICADO' 
                                                ? 'As aulas deste módulo já estão disponíveis e podem ser assistidas na sua Área de Ensino.' 
                                                : 'Este conteúdo está em fase de produção e será disponibilizado em breve.'}
                                            </p>
                                            {module.onlineStatus === 'EM_GRAVACAO' && module.publicationDate && (
                                              <div className="flex items-center gap-2 mt-3 text-xs text-amber-500 bg-amber-500/10 px-2 py-1.5 rounded w-fit font-medium border border-amber-500/20">
                                                <Calendar size={13} />
                                                <span>Previsão de publicação: {new Date(module.publicationDate).toLocaleDateString('pt-BR')}</span>
                                              </div>
                                            )}
                                          </div>
                                          {module.onlineStatus === 'PUBLICADO' && (
                                            <button 
                                              onClick={() => handleGoToTeachingArea(module.teachingAreaLink)}
                                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition shadow-lg shadow-blue-500/20 shrink-0"
                                            >
                                              <PlayCircle size={16} />
                                              Ir para Área de Ensino
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Materials Section */}
                                    {moduleContents.length > 0 && (() => {
                                      const theoryPdfs = moduleContents.filter(c => (c.fileType === 'theory' || !c.fileType) && c.type === 'PDF');
                                      const linkedQuestionPdfs = moduleContents.filter(c => c.fileType === 'questions' && c.linkedTheoryId && c.type === 'PDF');
                                      const unlinkedQuestionPdfs = moduleContents.filter(c => c.fileType === 'questions' && !c.linkedTheoryId && c.type === 'PDF');
                                      const otherContents = moduleContents.filter(c => c.type !== 'PDF');

                                      return (
                                        <div className="space-y-3">
                                          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Materiais de Apoio</h4>
                                          <div className="flex flex-col gap-2">
                                            {/* Render Theories and Linked Questions */}
                                            {theoryPdfs.map(theoryPdf => (
                                              <React.Fragment key={theoryPdf.id}>
                                                {/* Theory Card */}
                                                <button 
                                                  onClick={() => handleOpenPdf(theoryPdf.url, theoryPdf.title)}
                                                  className="w-full text-left flex items-center gap-3 p-3 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-all group relative z-10"
                                                >
                                                  <div className="p-2 rounded-md bg-black border border-zinc-800 group-hover:border-zinc-700">
                                                    <FileText className="w-4 h-4 text-red-500" />
                                                  </div>
                                                  <div className="flex-1">
                                                    <p className="text-sm text-zinc-300 group-hover:text-white transition-colors">{theoryPdf.title}</p>
                                                    <p className="text-xs text-zinc-500">Teoria • Adicionado em {new Date(theoryPdf.createdAt).toLocaleDateString('pt-BR')}</p>
                                                  </div>
                                                </button>

                                                {/* Linked Questions */}
                                                {linkedQuestionPdfs.filter(q => q.linkedTheoryId === theoryPdf.id).map(questionPdf => (
                                                  <div key={questionPdf.id} className="relative ml-8 mt-1 mb-2">
                                                    {/* Tree Connector */}
                                                    <div className="absolute -left-5 top-0 h-1/2 w-4 border-b-2 border-l-2 border-zinc-700 rounded-bl-lg"></div>
                                                    
                                                    <button 
                                                      onClick={() => handleOpenPdf(questionPdf.url, questionPdf.title)}
                                                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-md bg-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800 transition-all group relative z-10"
                                                    >
                                                      <div className="p-1.5 rounded bg-black/40 border border-zinc-800/50 group-hover:border-zinc-700">
                                                        <ClipboardList className="w-3.5 h-3.5 text-orange-500" />
                                                      </div>
                                                      <div className="flex-1">
                                                        <p className="text-sm text-zinc-400 group-hover:text-white transition-colors">{questionPdf.title}</p>
                                                        <p className="text-[10px] text-zinc-600">Questões Vinculadas</p>
                                                      </div>
                                                    </button>
                                                  </div>
                                                ))}
                                              </React.Fragment>
                                            ))}

                                            {/* Unlinked Questions Section */}
                                            {unlinkedQuestionPdfs.length > 0 && (
                                              <div className="mt-4">
                                                <h4 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2 px-1">Cadernos de Questões Adicionais</h4>
                                                <div className="flex flex-col gap-2">
                                                  {unlinkedQuestionPdfs.map(questionPdf => (
                                                    <button 
                                                      key={questionPdf.id}
                                                      onClick={() => handleOpenPdf(questionPdf.url, questionPdf.title)}
                                                      className="w-full text-left flex items-center gap-3 p-3 rounded-md bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-all group"
                                                    >
                                                      <div className="p-2 rounded-md bg-black border border-zinc-800 group-hover:border-zinc-700">
                                                        <ClipboardList className="w-4 h-4 text-orange-500" />
                                                      </div>
                                                      <div className="flex-1">
                                                        <p className="text-sm text-zinc-300 group-hover:text-white transition-colors">{questionPdf.title}</p>
                                                        <p className="text-xs text-zinc-500">Questões Avulsas • Adicionado em {new Date(questionPdf.createdAt).toLocaleDateString('pt-BR')}</p>
                                                      </div>
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            )}

                                            {/* Other Content (Links, etc) */}
                                            {otherContents.length > 0 && (
                                              <div className={unlinkedQuestionPdfs.length > 0 || theoryPdfs.length > 0 ? "mt-4" : ""}>
                                                { (unlinkedQuestionPdfs.length > 0 || theoryPdfs.length > 0) && (
                                                  <h4 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2 px-1">Outros Recursos</h4>
                                                )}
                                                <div className="flex flex-col gap-2">
                                                  {otherContents.map(content => (
                                                    <button 
                                                      key={content.id}
                                                      onClick={() => window.open(content.url, '_blank')}
                                                      className="w-full text-left flex items-center gap-3 p-3 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-all group"
                                                    >
                                                      <div className="p-2 rounded-md bg-black border border-zinc-800 group-hover:border-zinc-700">
                                                        <LinkIcon className="w-4 h-4 text-blue-400" />
                                                      </div>
                                                      <div className="flex-1">
                                                        <p className="text-sm text-zinc-300 group-hover:text-white transition-colors">{content.title}</p>
                                                        <p className="text-xs text-zinc-500">Link Externo • Adicionado em {new Date(content.createdAt).toLocaleDateString('pt-BR')}</p>
                                                      </div>
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Classes Section */}
                                    <div className="space-y-3">
                                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                        Cronograma de Aulas ({moduleEvents.length})
                                      </h4>
                                      
                                      {moduleEvents.length === 0 ? (
                                        <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg">
                                          <p className="text-sm text-zinc-500">Nenhuma aula agendada para este módulo.</p>
                                        </div>
                                      ) : (
                                        <div className="grid gap-2">
                                          {moduleEvents.map(event => {
                                            const teacher = teachers.find(t => t.id === event.teacherId);
                                            const isCompleted = event.status === 'COMPLETED';
                                            
                                            return (
                                              <div 
                                                key={event.id}
                                                className={twMerge(
                                                  "flex items-center justify-between p-3 rounded-md border transition-all",
                                                  isCompleted 
                                                    ? "bg-emerald-950/10 border-emerald-900/30" 
                                                    : "bg-zinc-900 border-zinc-800"
                                                )}
                                              >
                                                <div className="flex items-center gap-4">
                                                  <div className={twMerge(
                                                    "w-10 h-10 rounded-full flex items-center justify-center border",
                                                    isCompleted
                                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                                      : "bg-zinc-800 border-zinc-700 text-zinc-400"
                                                  )}>
                                                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                  </div>
                                                  <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                      <span className={twMerge(
                                                        "text-sm font-medium",
                                                        isCompleted ? "text-emerald-400" : "text-zinc-200"
                                                      )}>
                                                        {format(new Date(event.date + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                                                      </span>
                                                      <span className="text-xs text-zinc-500">
                                                        {event.startTime} - {event.endTime}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                      <span>Prof. {teacher?.name || 'Não definido'}</span>
                                                      {event.isSubstitute && (
                                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                          Substituto
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  <span className={twMerge(
                                                    "text-xs px-2 py-1 rounded-full border",
                                                    event.status === 'COMPLETED' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                                    event.status === 'SCHEDULED' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                                                    event.status === 'CANCELED' && "bg-red-500/10 text-red-500 border-red-500/20",
                                                    event.status === 'RESCHEDULED' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                                                  )}>
                                                    {event.status === 'COMPLETED' && 'Concluída'}
                                                    {event.status === 'SCHEDULED' && 'Agendada'}
                                                    {event.status === 'CANCELED' && 'Cancelada'}
                                                    {event.status === 'RESCHEDULED' && 'Reagendada'}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      
      {activeSubjects.length === 0 && (
        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/30">
          <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-zinc-400 font-medium">Nenhuma disciplina encontrada</h3>
          <p className="text-zinc-500 text-sm mt-1">O planejamento pedagógico será disponibilizado em breve.</p>
        </div>
      )}
    </div>
  );
}
