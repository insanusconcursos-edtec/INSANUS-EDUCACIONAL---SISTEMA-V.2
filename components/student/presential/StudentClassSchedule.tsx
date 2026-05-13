import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { classScheduleService } from '../../../services/classScheduleService';
import { curriculumService } from '../../../services/curriculumService';
import { teacherService } from '../../../services/teacherService';
import { holidayService } from '../../../services/holidayService';
import { ClassScheduleEvent } from '../../../types/schedule';
import { Subject, Topic } from '../../../types/curriculum';
import { Teacher } from '../../../types/teacher';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  BookOpen, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  List,
  ChevronDown,
  ChevronUp,
  CheckCircle
} from 'lucide-react';

interface StudentClassScheduleProps {
  classId: string;
}

export const StudentClassSchedule: React.FC<StudentClassScheduleProps> = ({ classId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<ClassScheduleEvent[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // View State
  const [viewMode, setViewMode] = useState<'month' | 'week'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [eventsData, subjectsData, topicsData, teachersData, holidaysData] = await Promise.all([
          classScheduleService.getScheduleEventsByClass(classId),
          curriculumService.getSubjectsByClass(classId),
          curriculumService.getTopicsByClass(classId),
          teacherService.getTeachers(),
          holidayService.getHolidays()
        ]);

        setEvents(eventsData);
        setSubjects(subjectsData);
        setTopics(topicsData);
        setTeachers(teachersData);
        setHolidays(holidaysData);
      } catch (error) {
        console.error("Error loading schedule data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [classId]);

  // Helpers
  const getSubject = (id: string) => subjects.find(s => s.id === id);
  const getTopicName = (id: string) => topics.find(t => t.id === id)?.name || 'Assunto não encontrado';
  const getTeacherName = (id: string) => teachers.find(t => t.id === id)?.name || 'Professor não atribuído';
  const getModuleName = (topicId: string, moduleId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return 'Tópico desconhecido';
    const module = topic.modules?.find(m => m.id === moduleId);
    return module ? module.name : 'Módulo desconhecido';
  };

  // Calendar Logic
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const getStartOfWeek = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.getFullYear(), date.getMonth(), diff);
  };

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    }
  };

  const formatHeaderDate = (date: Date) => {
    if (viewMode === 'month') {
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } else {
      const start = getStartOfWeek(date);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startStr = start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
      const endStr = end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
  };

  const calendarCells = useMemo(() => {
    const cells = [];
    
    if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = getDaysInMonth(currentDate);
      const firstDay = getFirstDayOfMonth(currentDate);
      
      // Empty cells for previous month
      for (let i = 0; i < firstDay; i++) {
        cells.push({ type: 'empty', key: `empty-${i}` });
      }
      
      // Days of current month
      for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = events.filter(e => e.date === dateString)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const isHoliday = holidays.includes(dateString);
        
        cells.push({
          type: 'day',
          day,
          dateString,
          events: dayEvents,
          isHoliday,
          key: dateString
        });
      }
    } else {
      // Week View
      const startOfWeek = getStartOfWeek(currentDate);
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = events.filter(e => e.date === dateString)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const isHoliday = holidays.includes(dateString);

        cells.push({
          type: 'day',
          day,
          dateString,
          events: dayEvents,
          isHoliday,
          key: dateString
        });
      }
    }

    return cells;
  }, [currentDate, events, holidays, viewMode]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (events.length === 0 && holidays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-900/30 rounded-xl border border-gray-800">
        <CalendarIcon size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhuma aula agendada ainda.</p>
        <p className="text-sm">O cronograma será disponibilizado em breve.</p>
      </div>
    );
  }

  return (
    <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-b border-zinc-800 bg-black gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white capitalize flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-brand-red" />
            {formatHeaderDate(currentDate)}
          </h2>
          <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button
              onClick={() => setViewMode('month')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'month' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Visualização Mensal"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'week' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Visualização Semanal"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrev}
            className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors border border-transparent hover:border-zinc-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors"
          >
            Hoje
          </button>
          <button 
            onClick={handleNext}
            className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors border border-transparent hover:border-zinc-800"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar Container with Horizontal Scroll for Tablets */}
      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        <div className="min-w-full md:min-w-[900px]">
          {/* Weekday Headers */}
          <div className="hidden md:grid grid-cols-7 border-b border-zinc-800 bg-black">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className={`grid grid-cols-1 md:grid-cols-7 bg-black ${viewMode === 'month' ? 'auto-rows-fr' : 'md:h-[600px]'}`}>
            {calendarCells.map((cell: any) => {
              if (cell.type === 'empty') {
                return <div key={cell.key} className="hidden md:block min-h-[140px] border-b border-r border-zinc-800/50 bg-black"></div>;
              }

              const isToday = new Date().toISOString().split('T')[0] === cell.dateString;
              const dayEvents = cell.events || [];
              const isHoliday = cell.isHoliday;
              const hasEvents = dayEvents.length > 0;
              const isDayCompleted = hasEvents && dayEvents.every(e => e.status === 'COMPLETED');
              
              // Obter o dia da semana abreviado para exibir no mobile
              const dateObj = new Date(cell.dateString + 'T12:00:00');
              const dayOfWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

              return (
                <div 
                  key={cell.key} 
                  className={`
                    p-2 border-b border-r border-zinc-800 transition-colors relative group overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent
                    ${viewMode === 'month' ? 'min-h-[140px]' : 'h-auto md:h-full'}
                    ${isToday ? 'bg-brand-red/5' : 'hover:bg-zinc-900/30'}
                  `}
                >
                  <div className="flex justify-between items-start mb-2 sticky top-0 bg-inherit z-10 pb-1">
                    <div className="flex items-center gap-2">
                      <span 
                        className={`
                          text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full
                          ${isToday ? 'bg-brand-red text-white' : 'text-zinc-400 group-hover:text-zinc-200'}
                        `}
                      >
                        {cell.day}
                      </span>
                      <span className="md:hidden text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        {dayOfWeek}
                      </span>
                    </div>
                    {hasEvents && (
                      <span className={`
                        text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide
                        ${isDayCompleted 
                          ? 'bg-emerald-600 text-white border-emerald-500' 
                          : dayEvents[0].isOverflow 
                            ? 'bg-red-600 text-white border-red-500' 
                            : 'text-brand-red bg-brand-red/10 border-brand-red/20'}
                      `}>
                        {dayEvents[0].isOverflow 
                          ? `Encontro #${dayEvents[0].meetingNumber} (EXTRA)` 
                          : `Encontro #${dayEvents[0].meetingNumber}`}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {/* Holiday Display */}
                    {isHoliday && (
                      <div className="h-full flex flex-col items-center justify-center py-4">
                        <div className="w-full p-3 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30 text-zinc-500 flex flex-col items-center justify-center text-center gap-2">
                          <CalendarIcon className="w-5 h-5 opacity-50" />
                          <span className="text-xs font-medium">Feriado</span>
                        </div>
                      </div>
                    )}

                    {/* Events Display */}
                    {!isHoliday && dayEvents.map((event: ClassScheduleEvent, index: number) => {
                      const subject = getSubject(event.subjectId);
                      const isExpanded = expandedEventId === event.id;
                      const borderColor = subject?.color || '#52525b';
                      const isOverflow = event.isOverflow;

                      return (
                        <React.Fragment key={event.id}>
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedEventId(isExpanded ? null : event.id);
                            }}
                            className={`
                              rounded-lg border-l-4 transition-all cursor-pointer overflow-hidden
                              ${isExpanded ? 'bg-zinc-900 shadow-lg ring-1 ring-zinc-800 z-20 relative' : 'bg-zinc-900/50 hover:bg-zinc-900'}
                              ${isOverflow ? 'border-red-500 bg-red-900/20' : ''}
                              ${event.status === 'COMPLETED' ? 'border-emerald-500 bg-emerald-900/10 opacity-80' : ''}
                            `}
                            style={{ borderLeftColor: event.status === 'COMPLETED' ? '#10b981' : borderColor }}
                          >
                            {/* Card Header */}
                            <div className="p-2">
                              <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
                                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                                  {index + 1}º Tempo
                                </div>
                                <div className="flex gap-1 flex-wrap justify-end">
                                  {event.status === 'COMPLETED' && (
                                    <span className="text-[8px] font-bold text-emerald-500 bg-emerald-950/50 px-1 py-0.5 rounded border border-emerald-900/50 uppercase tracking-wider flex items-center gap-1" title="Concluído">
                                      <CheckCircle className="w-2 h-2 shrink-0" />
                                      <span className="hidden lg:inline">CONCLUÍDO</span>
                                    </span>
                                  )}
                                  {event.isSubstitute && (
                                    <span className="text-[8px] font-bold text-black bg-yellow-500 px-1 py-0.5 rounded border border-yellow-600 uppercase tracking-wider flex items-center gap-1" title="Substituição">
                                      SUBST.
                                    </span>
                                  )}
                                  {isOverflow && (
                                    <span className="text-[8px] font-bold text-red-400 bg-red-950/50 px-1 py-0.5 rounded border border-red-900/50 uppercase tracking-wider flex items-center gap-1" title="Aula Extra">
                                      <AlertTriangle className="w-2 h-2 shrink-0" />
                                      <span className="hidden lg:inline">EXTRA</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-between items-start gap-1">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 mb-0.5 flex-wrap">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    <span className="whitespace-nowrap">{event.startTime} - {event.endTime}</span>
                                  </div>
                                  <div className="font-bold text-xs text-zinc-200 truncate leading-tight" title={subject?.name}>
                                    {subject?.name || 'Disciplina Desconhecida'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newParams = new URLSearchParams(searchParams);
                                      newParams.set('tab', 'PLANNING');
                                      if (event.subjectId) newParams.set('subjectId', event.subjectId);
                                      if (event.topicId) newParams.set('topicId', event.topicId);
                                      if (event.moduleId) newParams.set('moduleId', event.moduleId);
                                      setSearchParams(newParams);
                                    }}
                                    className="p-1 text-zinc-500 hover:text-brand-red transition-colors"
                                    title="Ver materiais no Planejamento"
                                  >
                                    <BookOpen className="w-3 h-3" />
                                  </button>
                                  <div className="text-zinc-500">
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Card Details */}
                            {isExpanded && (
                              <div className="px-2 pb-2 pt-0 space-y-2 animate-in slide-in-from-top-1 duration-200">
                                <div className="h-px bg-zinc-800 w-full my-1" />
                                
                                <div>
                                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-0.5">Módulo</span>
                                  <p className="text-[11px] text-zinc-300 leading-tight">
                                    {getModuleName(event.topicId, event.moduleId)}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-0.5">Assunto</span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                                    <BookOpen className="w-3 h-3 text-zinc-500 shrink-0" />
                                    <span>{getTopicName(event.topicId)}</span>
                                  </div>
                                </div>

                                <div>
                                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-0.5">Professor</span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                                    <User className="w-3 h-3 text-zinc-500 shrink-0" />
                                    <span>{getTeacherName(event.teacherId)}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Interval Divider */}
                          {index === 0 && dayEvents.length > 1 && (
                            <div className="flex items-center gap-2 my-2 opacity-50">
                              <div className="h-px bg-zinc-800 border-t border-dashed border-zinc-700 flex-1"></div>
                              <span className="text-[9px] text-zinc-500 font-medium whitespace-nowrap">Intervalo (15 min)</span>
                              <div className="h-px bg-zinc-800 border-t border-dashed border-zinc-700 flex-1"></div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
