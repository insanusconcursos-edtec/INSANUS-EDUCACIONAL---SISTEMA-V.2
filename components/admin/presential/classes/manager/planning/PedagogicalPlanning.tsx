import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, FileText, CheckCircle, Clock, AlertCircle, Globe, Video, CheckCircle2 } from 'lucide-react';
import { Subject, Topic, Module } from '../../../../../../types/curriculum';
import { ClassScheduleEvent } from '../../../../../../types/schedule';
import { Teacher } from '../../../../../../types/teacher';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../../../../../../contexts/AuthContext';
import { openWatermarkedPdf } from '../../../../../../utils/pdfSecurityService';

interface PedagogicalPlanningProps {
  subjects: Subject[];
  topics: Topic[];
  modules: Module[];
  events: ClassScheduleEvent[];
  teachers: Teacher[];
  totalMeetings?: number;
}

export function PedagogicalPlanning({ subjects, topics, modules, events, teachers, totalMeetings = 0 }: PedagogicalPlanningProps) {
  const { currentUser, userData } = useAuth();
  const [searchParams] = useSearchParams();
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

  const onlineModuleIds = new Set(modules.filter(m => m.isOnline).map(m => m.id));

  const handleOpenPdf = async (url: string, _title: string) => {
    try {
      await openWatermarkedPdf(url, {
        email: currentUser?.email || 'admin@insanus.com',
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

  // Filter subjects that have topics
  const activeSubjects = subjects.filter(subject => 
    topics.some(topic => topic.subjectId === subject.id)
  );

  // Calculate global progression
  const globalStats = useMemo(() => {
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

  return (
    <div className="space-y-6">
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
            <CheckCircle2 className={clsx(
              "w-6 h-6",
              globalStats.completedMeetingsCount === totalMeetings && totalMeetings > 0 ? "text-emerald-500" : "text-zinc-600"
            )} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
      {activeSubjects.map(subject => {
        const subjectTopics = topics.filter(t => t.subjectId === subject.id);
        
        // Calculate total required presential classes from curriculum
        const totalRequiredClasses = subjectTopics.reduce((acc, topic) => {
          const topicPresentialClasses = (topic.modules || []).reduce((mAcc, m) => {
            if (!m.isOnline) return mAcc + (m.classesCount || 0);
            return mAcc;
          }, 0);
          
          // If no modules are defined, use the topic's requiredClasses (assuming they are presential)
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

        // Sort topics for this subject
        const sortedTopics = [...subjectTopics].sort((a, b) => (a.order || 0) - (b.order || 0));

        return (
          <div key={subject.id} className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
            {/* Subject Header */}
            <button
              onClick={() => toggleSubject(subject.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="w-5 h-5 text-zinc-400" /> : <ChevronRight className="w-5 h-5 text-zinc-400" />}
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: subject.color }}
                />
                <span className="font-medium text-zinc-100">{subject.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-400">
                  {completedEvents.length} / {totalRequiredClasses} aulas concluídas
                </span>
                <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
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
              <div className="border-t border-zinc-800 bg-zinc-900/30">
                {sortedTopics.map(topic => {
                  const isTopicExpanded = expandedTopics.has(topic.id);
                  const topicModules = topic.modules || [];

                  return (
                    <div key={topic.id} className="border-b border-zinc-800 last:border-0">
                      {/* Topic Header */}
                      <button
                        onClick={() => toggleTopic(topic.id)}
                        className="w-full flex items-center justify-between p-3 pl-8 hover:bg-zinc-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isTopicExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                          <span className="text-sm font-medium text-zinc-300">{topic.name}</span>
                        </div>
                        <span className="text-xs text-zinc-500">
                          {topicModules.length} módulos
                        </span>
                      </button>

                      {/* Topic Content (Modules) */}
                      {isTopicExpanded && (
                        <div className="bg-zinc-950/30 pl-12 pr-4 py-2 space-y-2">
                          {topicModules.map(module => {
                            const isModuleExpanded = expandedModules.has(module.id);
                            const moduleEvents = events.filter(e => e.moduleId === module.id)
                              .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime());
                            
                            const moduleContents = module.contents || [];

                            return (
                              <div 
                                key={module.id} 
                                id={`module-${module.id}`}
                                className="border border-zinc-800 rounded-md overflow-hidden bg-zinc-900 transition-all duration-500"
                              >
                                {/* Module Header */}
                                  <button
                                    onClick={() => toggleModule(module.id)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      {isModuleExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-zinc-300">{module.name}</span>
                                        {module.isOnline && (
                                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-bold uppercase">
                                            Online
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                                      <span className="flex items-center gap-1">
                                        <FileText className="w-3 h-3" />
                                        {moduleContents.length}
                                      </span>
                                      {!module.isOnline && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {moduleEvents.filter(e => e.status === 'COMPLETED').length} / {module.classesCount} aulas
                                        </span>
                                      )}
                                      {module.isOnline && (
                                        <span className="flex items-center gap-1">
                                          {module.onlineStatus === 'EM_GRAVACAO' ? (
                                            <Video className="w-3 h-3 text-amber-500" />
                                          ) : (
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                          )}
                                          {module.onlineStatus === 'EM_GRAVACAO' ? 'Em Gravação' : 'Publicado'}
                                        </span>
                                      )}
                                    </div>
                                  </button>

                                {/* Module Content (Materials & Classes) */}
                                {isModuleExpanded && (
                                  <div className="p-4 space-y-6 border-t border-zinc-800 bg-zinc-950/50">
                                    
                                    {/* Online Info Section */}
                                    {module.isOnline && (
                                      <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 space-y-4">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className={twMerge(
                                              "w-10 h-10 rounded-full flex items-center justify-center border",
                                              module.onlineStatus === 'PUBLICADO' 
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                                : "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                            )}>
                                              {module.onlineStatus === 'PUBLICADO' ? <CheckCircle2 className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                                            </div>
                                            <div>
                                              <h4 className="text-sm font-bold text-white">Módulo Online</h4>
                                              <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">
                                                Status: {module.onlineStatus === 'EM_GRAVACAO' ? 'Em Gravação' : 'Publicado'}
                                              </p>
                                            </div>
                                          </div>
                                          
                                          {module.onlineStatus === 'EM_GRAVACAO' && module.publicationDate && (
                                            <div className="text-right">
                                              <p className="text-[10px] text-zinc-500 uppercase font-bold">Previsão de Publicação</p>
                                              <p className="text-sm font-bold text-amber-500">
                                                {format(new Date(module.publicationDate + 'T00:00:00'), "dd/MM/yyyy")}
                                              </p>
                                            </div>
                                          )}
                                        </div>

                                        {module.onlineStatus === 'PUBLICADO' && module.teachingAreaLink && (
                                          <button 
                                            onClick={() => {
                                              console.log('Redirecting to teaching area:', module.teachingAreaLink);
                                            }}
                                            className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-brand-red/50 transition-all group"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:border-brand-red/30">
                                                <Globe className="w-4 h-4 text-brand-red" />
                                              </div>
                                              <div className="text-left">
                                                <p className="text-xs font-bold text-zinc-300 group-hover:text-white">Acessar na Área de Ensino</p>
                                                <p className="text-[10px] text-zinc-500">Módulo: {module.teachingAreaLink.moduleId} | Pasta: {module.teachingAreaLink.folderId}</p>
                                              </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-brand-red" />
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {/* Materials Section */}
                                    {moduleContents.length > 0 && (
                                      <div className="space-y-4">
                                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Materiais de Apoio</h4>
                                        
                                        <div className="space-y-3">
                                          {/* Step A: Theory PDFs */}
                                          {moduleContents.filter(c => c.fileType === 'theory' || !c.fileType).map(content => (
                                            <div key={content.id} className="space-y-2">
                                              <button 
                                                onClick={() => {
                                                  if (content.type === 'PDF') {
                                                    handleOpenPdf(content.url, content.title);
                                                  } else {
                                                    window.open(content.url, '_blank');
                                                  }
                                                }}
                                                className="w-full text-left flex items-center gap-3 p-3 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-all group"
                                              >
                                                <div className="p-2 rounded-md bg-zinc-950 border border-zinc-800 group-hover:border-zinc-700">
                                                  <FileText className="w-4 h-4 text-red-500" />
                                                </div>
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[8px] font-black uppercase">Teoria</span>
                                                    <p className="text-sm text-zinc-300 group-hover:text-white transition-colors">{content.title}</p>
                                                  </div>
                                                  <p className="text-xs text-zinc-500">Adicionado em {new Date(content.createdAt).toLocaleDateString('pt-BR')}</p>
                                                </div>
                                              </button>

                                              {/* Step B & C: Linked Questions */}
                                              {moduleContents.filter(q => q.fileType === 'questions' && q.linkedTheoryId === content.id).map(question => (
                                                <div key={question.id} className="relative ml-8">
                                                  {/* Connection Line */}
                                                  <div className="absolute -left-5 top-0 h-1/2 w-5 border-b-2 border-l-2 border-zinc-700 rounded-bl-md"></div>
                                                  
                                                  <button 
                                                    onClick={() => handleOpenPdf(question.url, question.title)}
                                                    className="w-full text-left flex items-center gap-3 p-2 rounded-md bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800 transition-all group"
                                                  >
                                                    <div className="p-1.5 rounded-md bg-zinc-950 border border-zinc-800 group-hover:border-zinc-700">
                                                      <FileText className="w-3.5 h-3.5 text-orange-500" />
                                                    </div>
                                                    <div className="flex-1">
                                                      <div className="flex items-center gap-2">
                                                        <span className="px-1 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[8px] font-black uppercase">Questões</span>
                                                        <p className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">{question.title}</p>
                                                      </div>
                                                    </div>
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          ))}

                                          {/* Step D: Orphaned Questions */}
                                          {moduleContents.some(c => c.fileType === 'questions' && !c.linkedTheoryId) && (
                                            <div className="pt-2 space-y-2">
                                              <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest pl-1">Outras Listas de Questões</h5>
                                              <div className="grid gap-2">
                                                {moduleContents.filter(c => c.fileType === 'questions' && !c.linkedTheoryId).map(content => (
                                                  <button 
                                                    key={content.id}
                                                    onClick={() => handleOpenPdf(content.url, content.title)}
                                                    className="w-full text-left flex items-center gap-3 p-3 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-all group"
                                                  >
                                                    <div className="p-2 rounded-md bg-zinc-950 border border-zinc-800 group-hover:border-zinc-700">
                                                      <FileText className="w-4 h-4 text-orange-500" />
                                                    </div>
                                                    <div className="flex-1">
                                                      <div className="flex items-center gap-2">
                                                        <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[8px] font-black uppercase">Questões</span>
                                                        <p className="text-sm text-zinc-300 group-hover:text-white transition-colors">{content.title}</p>
                                                      </div>
                                                      <p className="text-xs text-zinc-500">Adicionado em {new Date(content.createdAt).toLocaleDateString('pt-BR')}</p>
                                                    </div>
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Classes Section */}
                                    {!module.isOnline && (
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
                                    )}
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
          <p className="text-zinc-500 text-sm mt-1">Cadastre disciplinas e tópicos para visualizar o planejamento.</p>
        </div>
      )}
      </div>
    </div>
  );
}
