
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Layout, PauseCircle, Grid, X, PlayCircle, ChevronDown, Loader2, Trophy } from 'lucide-react';
import { ScheduledEvent, fetchFullPlanData, getStudentCompletedMetas } from '../../../services/scheduleService';
import { getStudentConfig } from '../../../services/studentService';

// Type Config for Visuals (Fallback)
const TYPE_CONFIG: Record<string, { label: string; color: string; }> = {
  lesson: { label: 'AULA', color: '#3b82f6' },       // Blue-500
  material: { label: 'PDF', color: '#f97316' },        // Orange-500
  questions: { label: 'QUESTÕES', color: '#10b981' }, // Emerald-500
  law: { label: 'LEI SECA', color: '#eab308' },            // Yellow-500
  review: { label: 'FLASHCARD', color: '#a855f7' },     // Purple-500 (Default standard review color)
  summary: { label: 'RESUMO', color: '#ec4899' },      // Pink-500
  simulado: { label: 'SIMULADO', color: '#EAB308' } // Yellow-500
};

// === COMPONENTE DE CARD INTERATIVO ===
const CalendarEventCard: React.FC<{ event: ScheduledEvent; isReadOnly?: boolean }> = ({ event, isReadOnly }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // --- SPECIAL RENDER FOR SIMULADO (BLACK & GOLD) ---
  if (event.type === 'simulado') {
      return (
        <div className="p-3 mb-2 rounded-lg border border-yellow-600/50 bg-gradient-to-br from-gray-900 to-black shadow-lg relative overflow-hidden group hover:border-yellow-500 transition-all cursor-pointer">
            {/* Efeito Dourado Lateral */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
            
            <div className="flex justify-between items-start relative z-10 pl-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-black text-yellow-500 uppercase tracking-wider bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 inline-flex items-center gap-1">
                            <Trophy size={8} /> SIMULADO
                        </span>
                        {event.cycleName && (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700">
                                {event.cycleName}
                            </span>
                        )}
                    </div>
                    <h4 className="text-white font-bold text-xs leading-tight line-clamp-2 uppercase tracking-tight">
                        {event.title}
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium flex items-center gap-1">
                        ⏱ {Math.floor(event.duration / 60)}h Prova
                    </p>
                </div>
            </div>
        </div>
      );
  }

  const defaultConfig = TYPE_CONFIG[event.type] || TYPE_CONFIG.lesson;
  const activeColor = event.color || defaultConfig.color;
  
  const isLesson = event.type === 'lesson';
  const isSpacedReview = event.isSpacedReview || (event.type === 'review' && !!event.originalEventId);
  
  const videos = event.videos || [];
  const videoCount = videos.length;
  
  const partInfo = event.part || (event.observation?.match(/Parte (\d+)/i)?.[1]);

  let reviewIndex = null;
  let reviewDays = null;
  
  if (isSpacedReview && event.reviewLabel) {
      const parts = event.reviewLabel.match(/REV\. (\d+) - (\d+) DIAS/);
      if (parts) {
          reviewIndex = parts[1];
          reviewDays = parts[2];
      }
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const getReferenceBorderClass = (originType?: string) => {
    switch (originType) {
      case 'lesson': return 'border-l-blue-500';
      case 'questions': return 'border-l-orange-500';
      case 'law': return 'border-l-yellow-500';
      case 'material': return 'border-l-yellow-400';
      case 'summary': return 'border-l-purple-500';
      default: return null; 
    }
  };

  let containerClasses = "relative rounded-lg p-2.5 transition-all cursor-pointer flex flex-col gap-1 border-l-4 overflow-hidden ";
  const inlineStyles: React.CSSProperties = {};

  if (isSpacedReview) {
      containerClasses += "bg-cyan-950/40 border-y border-r border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(34,211,238,0.25)] hover:bg-cyan-950/60 hover:border-cyan-400/60 ";
      const borderClass = getReferenceBorderClass(event.originalType);
      
      if (event.referenceColor) {
          inlineStyles.borderLeftColor = event.referenceColor; 
      } else if (borderClass) {
          containerClasses += borderClass + " "; 
      } else {
          inlineStyles.borderLeftColor = "#22d3ee"; 
      }
  } else {
      containerClasses += "bg-zinc-900 border-y border-r border-zinc-800 hover:shadow-lg hover:border-zinc-700 ";
      if (event.isFreeStudy) {
          inlineStyles.borderLeftColor = "#10b981";
          containerClasses += "shadow-[0_0_10px_-2px_rgba(16,185,129,0.2)] ";
      } else {
          inlineStyles.borderLeftColor = activeColor;
      }
  }

  if (event.status === 'completed') {
      containerClasses += " opacity-50 grayscale hover:grayscale-0";
  } else {
      containerClasses += " opacity-100";
  }

  return (
    <div 
        className={containerClasses}
        style={inlineStyles}
        onClick={(!isReadOnly && isLesson && videoCount > 0) ? handleToggle : undefined}
    >
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-1 flex-wrap">
                <span 
                    className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider border flex items-center gap-1 ${
                        isSpacedReview 
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' 
                            : event.isFreeStudy
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/20'
                                : 'text-white border-transparent'
                    }`}
                    style={(!isSpacedReview && !event.isFreeStudy) ? { backgroundColor: activeColor } : {}}
                >
                    {isSpacedReview ? 'FLASHCARD ESPAÇADO' : event.isFreeStudy ? <><Trophy size={8} className="text-emerald-500" /> ESTUDO LIVRE</> : defaultConfig.label}
                </span>
                
                {partInfo && (
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider bg-white/10 text-white border border-white/20">
                        PT {partInfo}
                    </span>
                )}

                {event.cycleName && (
                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700">
                        {event.cycleName}
                    </span>
                )}

                {isSpacedReview && reviewIndex && (
                    <>
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider bg-cyan-950 text-cyan-400 border border-cyan-800 shadow-sm">
                            REV. {reviewIndex}
                        </span>
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider bg-black/40 text-cyan-500/70 border border-cyan-900/30">
                            {reviewDays} DIAS
                        </span>
                    </>
                )}
                
                {isSpacedReview && !reviewIndex && event.reviewLabel && (
                     <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {event.reviewLabel}
                    </span>
                )}

                {isLesson && videoCount > 0 && (
                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                       <PlayCircle size={8} /> {videoCount}
                    </span>
                )}
            </div>
            
            <span className={`text-[9px] font-mono font-bold whitespace-nowrap ml-1 flex items-center gap-1 ${isSpacedReview ? 'text-cyan-200/70' : 'text-zinc-500'}`}>
                {event.duration}m
            </span>
        </div>

        <div className="flex justify-between items-start mt-1">
             <div className="flex flex-col min-w-0">
                <h4 className={`text-[10px] font-bold uppercase leading-tight line-clamp-2 ${event.status === 'completed' ? 'text-zinc-500 line-through' : isSpacedReview ? 'text-cyan-50' : 'text-zinc-300'}`}>
                    {event.title}
                </h4>
                <p className={`text-[9px] mt-0.5 truncate uppercase ${isSpacedReview ? 'text-cyan-400/60' : 'text-zinc-600'}`}>
                    {event.disciplineName || event.discipline || 'Geral'}
                </p>
             </div>

             {isLesson && videoCount > 0 && (
                 <div className={`text-zinc-500 transform transition-transform duration-200 mt-1 ml-1 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown size={12} />
                 </div>
             )}
        </div>

        {isExpanded && isLesson && videoCount > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-800/50 animate-in slide-in-from-top-1 duration-200">
                <ul className="space-y-1">
                    {videos.map((vid, idx) => (
                        <li key={idx} className="flex items-center justify-between text-[9px] text-zinc-400 bg-zinc-950/30 p-1.5 rounded px-2 hover:bg-zinc-800/50 transition-colors">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                                <span className="text-zinc-600 font-mono">{idx + 1}.</span>
                                <span className="truncate max-w-[120px] font-medium">{vid.title || `Aula ${idx + 1}`}</span>
                            </div>
                            <span className="opacity-50 font-mono ml-2 shrink-0">{vid.duration}m</span>
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </div>
  );
};

interface StudyCalendarProps {
  userId: string;
  isReadOnly?: boolean;
}

import { collection, query, where, documentId, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export const StudyCalendar: React.FC<StudyCalendarProps> = ({ userId, isReadOnly = false }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  
  const [scheduleData, setScheduleData] = useState<Record<string, ScheduledEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const [selectedDayData, setSelectedDayData] = useState<{ date: Date; goals: ScheduledEvent[] } | null>(null);

  // Rolling Window State
  const [lastScheduledDate, setLastScheduledDate] = useState<string | null>(null);
  const [isPlanCompleted, setIsPlanCompleted] = useState(false);

  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  const getISODate = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset*60*1000));
    return localDate.toISOString().split('T')[0];
  };

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const d = new Date(year, month, -i);
        days.push(d);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        days.push(d);
    }
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
        const d = new Date(year, month + 1, i);
        days.push(d);
    }
    return days;
  }, [currentDate]);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    let unsubscribe: () => void;

    const startLoading = async () => {
      try {
        const config = await getStudentConfig(userId);
        if (config?.isPlanPaused) {
            setIsPaused(true);
            setLoading(false);
            return;
        }
        setIsPaused(false);

        const activePlanId = config?.currentPlanId;
        setCurrentPlanId(activePlanId);
        setLastScheduledDate(config?.lastScheduledDate);

        // Fetch Plan Data and Status
        if (activePlanId) {
            const fullPlan = await fetchFullPlanData(activePlanId);
            const completedIdsSet = await getStudentCompletedMetas(userId, activePlanId);
            
            let totalMetas = 0;
            fullPlan.disciplines?.forEach((disc: { topics?: { metas?: any[] }[] }) => {
                disc.topics?.forEach((topic: { metas?: any[] }) => {
                    totalMetas += (topic.metas?.length || 0);
                });
            });
            setIsPlanCompleted(totalMetas > 0 && completedIdsSet.size >= totalMetas);
        }

        let start: Date, end: Date;
        if (viewMode === 'week') {
            start = weekDays[0];
            end = weekDays[6];
        } else {
            start = monthDays[0];
            end = monthDays[monthDays.length - 1];
        }

        const startStr = getISODate(start);
        const endStr = getISODate(end);

        const schedulesRef = collection(db, 'users', userId, 'schedules');
        const q = query(
            schedulesRef,
            where(documentId(), '>=', startStr),
            where(documentId(), '<=', endStr)
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
            const sortedData: Record<string, ScheduledEvent[]> = {};
            const rawData: Record<string, ScheduledEvent[]> = {};
            
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.items && Array.isArray(data.items)) {
                  rawData[doc.id] = data.items;
              }
            });

            const allDates = Object.keys(rawData).sort();
            let lastTopicId: string | null = null;
            let lastCycleId: string | null = null;
            let hasPreviousItem = false;

            allDates.forEach(dateKey => {
                const rawItems = rawData[dateKey];
                const filteredItems = activePlanId 
                    ? rawItems.filter(item => item.planId === activePlanId)
                    : rawItems;

                const spacedReviews = filteredItems.filter(item => item.isSpacedReview || (item.type === 'review' && !!item.originalEventId));
                const normalTasks = filteredItems.filter(item => !(item.isSpacedReview || (item.type === 'review' && !!item.originalEventId)));
                const dayItems = [...spacedReviews, ...normalTasks];

                const itemsWithFlags = dayItems.map((item) => {
                    const isFreeStudy = item.isFreeStudy || item.type === 'free_study';
                    const isSpacedReview = item.isSpacedReview || (item.type === 'review' && !!item.originalEventId);
                    
                    const isAbsoluteStartOfCycle = !isFreeStudy && !isSpacedReview && item.disciplineOrder === 0 && item.subjectOrder === 0 && item.taskOrder === 0;
                    const isNewTopic = !isFreeStudy && !isSpacedReview && (!hasPreviousItem || item.topicId !== lastTopicId);
                    const isNewCycle = !isFreeStudy && !isSpacedReview && ((hasPreviousItem && item.cycleId !== lastCycleId) || isAbsoluteStartOfCycle);

                    if (!isFreeStudy && !isSpacedReview) {
                        lastTopicId = item.topicId || null;
                        lastCycleId = item.cycleId || null;
                        hasPreviousItem = true;
                    }

                    return { ...item, isNewTopic, isNewCycle };
                });

                sortedData[dateKey] = itemsWithFlags;
            });

            setScheduleData(sortedData);
            setLoading(false);
        }, (error) => {
            console.error("Erro no listener do cronograma:", error);
            setLoading(false);
        });

      } catch (error) {
        console.error("Erro ao inicializar cronograma:", error);
        setLoading(false);
      }
    };

    startLoading();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userId, viewMode, currentDate, weekDays, monthDays]);

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
        newDate.setDate(currentDate.getDate() - 7);
    } else {
        newDate.setMonth(currentDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
        newDate.setDate(currentDate.getDate() + 7);
    } else {
        newDate.setMonth(currentDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    const dateKey = getISODate(date);
    const goals = scheduleData[dateKey] || [];
    setSelectedDayData({ date, goals });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };


  const getDayName = (date: Date) => date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const getDayNumber = (date: Date) => date.getDate().toString().padStart(2, '0');
  const getMonthLabel = (date: Date) => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  
  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 size={40} className="animate-spin text-yellow-500" />
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Carregando cronograma...</p>
        </div>
    );
  }

  if (isPaused) {
    return (
      <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-zinc-900/20 rounded-2xl border border-zinc-800 border-dashed animate-in fade-in">
        <div className="bg-yellow-500/10 p-6 rounded-full mb-6 border border-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.1)]">
           <PauseCircle className="w-16 h-16 text-yellow-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">PLANO PAUSADO!</h2>
        <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">O ALUNO ESTÁ COM O PLANO CONGELADO</p>
      </div>
    );
  }

  return (
    <div className="relative w-full flex flex-col animate-in fade-in duration-500">
      
      <div className="relative z-10 w-full flex-1 flex flex-col">
        {/* HEADER SECTION */}
        <div className="flex-none flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">
                {viewMode === 'week' ? 'Visualização Semanal' : 'Visualização Mensal'}
            </span>
            <span className="text-zinc-600 text-[10px] font-mono uppercase bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                {getMonthLabel(currentDate)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800/50">
            <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                <button 
                    onClick={() => setViewMode('week')}
                    className={`px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'week' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Layout size={12} />
                    Semanal
                </button>
                <button 
                    onClick={() => setViewMode('month')}
                    className={`px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'month' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Grid size={12} />
                    Mensal
                </button>
            </div>

            <div className="w-px h-6 bg-zinc-800"></div>

            <div className="flex items-center gap-1">
                <button onClick={handlePrev} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
                    <ChevronLeft size={16} />
                </button>
                <button onClick={handleToday} className="px-3 py-1.5 hover:bg-zinc-800 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white uppercase transition-colors">
                    Hoje
                </button>
                <button onClick={handleNext} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
      </div>


      {/* MENSAGEM DE CRONOGRAMA NÃO GERADO */}
      {currentPlanId && !lastScheduledDate && !loading && (
        <div className="mb-10 p-8 bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center text-center animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="mb-4 p-4 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                <Trophy size={32} />
            </div>
            <h3 className="text-xl font-black uppercase text-white tracking-tight">Seu plano está ativo!</h3>
            <p className="text-sm font-medium text-zinc-500 max-w-sm mt-2 px-6">
                Agora, clique em <strong className="text-white">&apos;Gerar Cronograma&apos;</strong> na aba <strong className="text-white">Configurações</strong> para montar sua rotina.
            </p>
        </div>
      )}

      {/* CALENDAR BODY */}
      <div className="flex-1 min-h-[500px] border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950 flex flex-col shadow-xl">
        
        {viewMode === 'week' && (
            <div className="grid grid-flow-col auto-cols-[85vw] sm:auto-cols-[45vw] lg:auto-cols-fr overflow-x-auto snap-x snap-mandatory pb-4 hide-scrollbar flex-1 min-h-0">
                {weekDays.map((day, index) => {
                    const active = isToday(day);
                    const dateKey = getISODate(day);
                    const dayEvents = scheduleData[dateKey] || [];

                    return (
                        <div 
                            key={index} 
                            className="flex flex-col border-r border-zinc-800/50 last:border-r-0 snap-center lg:snap-none min-w-[240px] lg:min-w-0 h-full"
                        >
                            {/* Header Part */}
                            <div className={`py-4 flex flex-col items-center justify-center border-b border-zinc-800 flex-none relative ${active ? 'bg-gradient-to-b from-yellow-500/10 to-transparent' : 'bg-zinc-900/30'}`}>
                                {active && <div className="absolute top-0 left-0 right-0 h-0.5 bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>}
                                <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${active ? 'text-yellow-400' : 'text-zinc-500'}`}>
                                    {getDayName(day)}
                                </span>
                                <span className={`text-xl font-black ${active ? 'text-white' : 'text-zinc-400'}`}>
                                    {getDayNumber(day)}
                                </span>
                            </div>

                            {/* Content Part */}
                            <div className={`flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent ${active ? 'bg-zinc-900/10' : 'hover:bg-zinc-900/20'}`}>
                                {dayEvents.length > 0 ? (
                                    dayEvents.map((event) => {
                                        const isNewCycle = event.isNewCycle;
                                        const isNewTopic = event.isNewTopic;

                                        return (
                                            <React.Fragment key={event.id}>
                                                {isNewCycle && (
                                                    <div className="w-full flex flex-col items-center my-4 opacity-90 px-1">
                                                        <div className="w-full h-px border-t border-solid border-white/40 mb-1"></div>
                                                        <span className="text-[10px] text-white/80 font-bold text-center uppercase tracking-widest">
                                                            {event.cycleName ? `INÍCIO: ${event.cycleName}` : "NOVO CICLO"}
                                                        </span>
                                                        <div className="w-full h-px border-t border-solid border-white/40 mt-1"></div>
                                                    </div>
                                                )}
                                                {isNewTopic && event.topicName && (
                                                    <div className="w-full flex flex-col items-center gap-1 my-4 px-1">
                                                        <div className="flex items-center w-full gap-2">
                                                            <div className="h-px border-t border-dashed border-yellow-500/30 flex-1"></div>
                                                            <span className="text-[7px] font-black text-yellow-500 uppercase tracking-[0.2em]">Novo Tópico</span>
                                                            <div className="h-px border-t border-dashed border-yellow-500/30 flex-1"></div>
                                                        </div>
                                                        <div className="flex flex-col items-center text-center">
                                                            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider leading-tight">
                                                                {event.disciplineName || event.discipline || 'Geral'}
                                                            </span>
                                                            <span className="text-[9px] font-black text-zinc-200 uppercase tracking-tight leading-tight mt-0.5 break-words max-w-full">
                                                                {event.topicName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                                <CalendarEventCard event={event} isReadOnly={isReadOnly} />
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity min-h-[100px]">
                                        <span className="text-[9px] font-bold text-zinc-800 uppercase">Livre</span>
                                    </div>
                                )}

                                {dateKey === lastScheduledDate && (
                                    <div className="mt-6 flex flex-col items-center w-full px-2 opacity-90">
                                        <div className="w-full h-px border-t border-dashed border-yellow-400 mb-3"></div>
                                        <span className="text-[10px] text-yellow-400 font-bold text-center uppercase tracking-widest">
                                            FIM DA FASE ATUAL
                                        </span>
                                        <div className="w-full h-px border-t border-dashed border-yellow-400 mt-3"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {viewMode === 'month' && (
            <>
                <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/50 flex-none">
                    {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                        <div key={d} className="py-2 text-center text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-zinc-950 min-h-0 overflow-hidden">
                    {monthDays.map((day, index) => {
                        const dateKey = getISODate(day);
                        const dayEvents = scheduleData[dateKey] || [];
                        const active = isToday(day);
                        const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                        const completedCount = dayEvents.filter(e => e.status === 'completed').length;
                        const totalCount = dayEvents.length;

                        return (
                            <div 
                                key={index}
                                onClick={() => handleDayClick(day)}
                                className={`
                                    border-r border-b border-zinc-800/50 relative p-2 transition-colors cursor-pointer flex flex-col gap-1
                                    ${!isCurrentMonth ? 'bg-zinc-950/80 opacity-40' : 'hover:bg-zinc-900/40'}
                                    ${active ? 'bg-zinc-900/30 ring-1 ring-inset ring-yellow-400/30' : ''}
                                `}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`text-xs font-bold ${active ? 'text-yellow-400' : (isCurrentMonth ? 'text-zinc-300' : 'text-zinc-600')}`}>
                                        {day.getDate()}
                                    </span>
                                    {totalCount > 0 && (
                                        <span className="text-[9px] font-mono text-zinc-500">
                                            {completedCount}/{totalCount}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 flex flex-col gap-1 overflow-hidden mt-1">
                                    {dayEvents.slice(0, 3).map(event => {
                                        if (event.type === 'simulado') {
                                            return <div key={event.id} className="h-1 w-full rounded-full bg-yellow-500" style={{ opacity: event.status === 'completed' ? 0.3 : 1 }} />;
                                        }
                                        const defaultConfig = TYPE_CONFIG[event.type] || TYPE_CONFIG.lesson;
                                        const activeColor = event.color || defaultConfig.color;
                                        return <div key={event.id} className="h-1 w-full rounded-full" style={{ backgroundColor: activeColor, opacity: event.status === 'completed' ? 0.3 : 1 }} />;
                                    })}
                                    {dayEvents.length > 3 && (
                                        <div className="text-[8px] text-zinc-600 font-bold text-center">+{dayEvents.length - 3}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        )}
      </div>

      {selectedDayData && createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedDayData(null)}
        >
            <div 
                className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                    <div>
                        <h3 className="text-sm font-black text-white capitalize tracking-tight">
                            {selectedDayData.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', weekday: 'short' })}
                        </h3>
                    </div>
                    <button onClick={() => setSelectedDayData(null)} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-3 custom-scrollbar flex-1 bg-zinc-950/30">
                    {selectedDayData.goals.length === 0 ? (
                        <div className="text-center py-8 text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
                            <span className="text-[10px] uppercase font-bold">Nenhuma meta.</span>
                        </div>
                    ) : (
                        selectedDayData.goals.map((goal) => (
                            <CalendarEventCard key={goal.id} event={goal} isReadOnly={isReadOnly} />
                        ))
                    )}
                </div>
            </div>
        </div>,
        document.body
      )}
      </div>
    </div>
  );
};
