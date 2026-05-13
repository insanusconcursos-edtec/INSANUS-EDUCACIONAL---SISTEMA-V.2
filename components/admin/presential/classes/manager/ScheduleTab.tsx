import React, { useState, useEffect } from 'react';
import { Class } from '../../../../../types/class';
import { Topic, Subject, Module } from '../../../../../types/curriculum';
import { Teacher } from '../../../../../types/teacher';
import { ClassScheduleEvent, ScheduleGap, ScheduleException, ScheduleAlert } from '../../../../../types/schedule';
import { buildSchedule } from '../../../../../utils/scheduler/ScheduleBuilder';
import { resolveManualSchedule } from '../../../../../utils/scheduler/ContentResolver';
import { generateEmptySlots } from '../../../../../utils/scheduler/TimeSlotGenerator';
import { SchedulePreview } from './schedule/SchedulePreview';
import { classScheduleService } from '../../../../../services/classScheduleService';
import { holidayService } from '../../../../../services/holidayService';
import { sanitizeSchedule } from '../../../../../utils/scheduler/ScheduleSynchronizer';
import { Calendar, RefreshCw, Save, Loader2, CheckCircle, AlertTriangle, AlertOctagon, Trash2 } from 'lucide-react';

interface ScheduleTabProps {
  cls: Class;
  topics: Topic[];
  subjects: Subject[];
  teachers: Teacher[];
  onUpdate?: () => void;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ cls, topics, subjects, teachers, onUpdate }) => {
  const [generatedEvents, setGeneratedEvents] = useState<ClassScheduleEvent[]>([]);
  const [generatedGaps, setGeneratedGaps] = useState<ScheduleGap[]>([]);
  const [alert, setAlert] = useState<ScheduleAlert | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [manualAppointments, setManualAppointments] = useState<any[]>([]);
  const [saveMessage, setSaveMessage] = useState('');
  const [instructionMessage, setInstructionMessage] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const fetchedHolidays = await holidayService.getHolidays();
        setHolidays(fetchedHolidays);
      } catch (error) {
        console.error("Error fetching holidays:", error);
      }
    };
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (isPreviewMode) return;

    const loadAndSanitize = async () => {
      try {
        const originalEvents = await classScheduleService.getScheduleEventsByClass(cls.id);
        setManualAppointments(originalEvents);
      } catch (error) {
        console.error("Error loading schedule:", error);
      }
    };
    
    loadAndSanitize();
  }, [cls.id, isPreviewMode]);

  useEffect(() => {
    if (manualAppointments.length > 0) {
      const resolved = resolveManualSchedule(manualAppointments, subjects, topics);
      setGeneratedEvents(resolved);
    } else {
      setGeneratedEvents([]);
    }
  }, [manualAppointments, subjects, topics]);

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    setSaveMessage('');
    setAlert(null);
    setInstructionMessage(null);
    
    // 1. HARD RESET: Limpa a memória de eventos antigos
    setManualAppointments([]);
    
    // 2. Trava a intromissão do banco de dados
    setIsPreviewMode(true);
    setIsManualMode(false);

    // 3. Aguarda um pequeno delay para o React limpar a tela
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // 4. CHAMA O MOTOR DE AGENDAMENTO COM AS EXCEÇÕES ZERADAS
      const { events, gaps, alert: generatedAlert } = buildSchedule(cls, topics, teachers, holidays, [], subjects);
      setManualAppointments(events);
      setGeneratedGaps(gaps);
      setAlert(generatedAlert);
    } catch (error) {
      console.error("Error generating schedule:", error);
      window.alert("Erro ao gerar cronograma. Verifique o console para mais detalhes.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddException = (newException: ScheduleException) => {
    setManualAppointments(prev => {
      // Encontra o evento original na lista resolvida para pegar os metadados (data, turno, disciplina)
      const originalEvent = generatedEvents.find(e => e.id === newException.eventId);
      
      if (!originalEvent) {
        // Fallback for missing originalEvent (e.g. if generatedEvents is out of sync)
        const eventIndex = prev.findIndex(e => 
          (e.id && e.id === newException.eventId) || 
          (e.date === newException.date && (e.meetingNumber === newException.meetingNumber || e.periodNumber === newException.meetingNumber))
        );
        
        if (eventIndex !== -1) {
          const updated = [...prev];
          if (newException.type === 'CANCELLATION') {
            updated.splice(eventIndex, 1);
          } else {
            updated[eventIndex] = {
              ...updated[eventIndex],
              teacherId: newException.substituteTeacherId || updated[eventIndex].teacherId,
              isSubstitute: newException.type === 'SUBSTITUTION',
              originalTeacherId: newException.type === 'SUBSTITUTION' ? newException.originalTeacherId : undefined
            };
          }
          return updated;
        }
        return prev;
      }

      if (newException.type === 'CANCELLATION') {
        // Remove all events that match the same date, shift, and subject
        return prev.filter(e => !(e.date === originalEvent.date && e.shift === originalEvent.shift && e.subjectId === originalEvent.subjectId));
      } else {
        // Update all events that match the same date, shift, and subject
        return prev.map(e => {
          if (e.date === originalEvent.date && e.shift === originalEvent.shift && e.subjectId === originalEvent.subjectId) {
            return {
              ...e,
              teacherId: newException.substituteTeacherId || e.teacherId,
              isSubstitute: newException.type === 'SUBSTITUTION',
              originalTeacherId: newException.type === 'SUBSTITUTION' ? newException.originalTeacherId : undefined
            };
          }
          return e;
        });
      }
    });
  };

  const handleDeleteAppointment = (eventId: string) => {
    setManualAppointments(prev => {
      // Encontra o evento na lista resolvida para pegar os metadados
      const eventToDelete = generatedEvents.find(ge => ge.id === eventId);
      
      if (eventToDelete) {
        // Remove todos os eventos que compartilham a mesma data, turno e disciplina
        return prev.filter(e => 
          !(e.date === eventToDelete.date && e.shift === eventToDelete.shift && e.subjectId === eventToDelete.subjectId)
        );
      }

      // Fallback: tenta remover pelo ID
      return prev.filter(e => e.id !== eventId);
    });
  };

  const handleSaveSchedule = async () => {
    if (alert?.type === 'RED') return;

    setIsSaving(true);
    setSaveMessage('');
    try {
      await classScheduleService.saveScheduleEvents(cls.id, generatedEvents);
      setSaveMessage('Cronograma salvo e sincronizado com sucesso!');
      setIsPreviewMode(false);
      if (onUpdate) onUpdate();
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error("Error saving schedule:", error);
      window.alert("Erro ao salvar cronograma. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateEventStatus = async (eventIds: string[], status: 'COMPLETED' | 'SCHEDULED') => {
    try {
      await classScheduleService.updateAppointmentsStatus(eventIds, status);
      
      // Atualiza o estado local para refletir a mudança imediatamente
      setManualAppointments(prev => prev.map(event => {
        if (eventIds.includes(event.id)) {
          return { ...event, status };
        }
        return event;
      }));
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error updating event status:", error);
      window.alert("Erro ao atualizar status das aulas.");
    }
  };

  const handleClearSchedule = async () => {
    setIsClearing(true);
    try {
      // 1. Apaga do banco de dados
      await classScheduleService.clearClassSchedule(cls.id); 
      
      // 2. Limpa o estado visual da tela
      setGeneratedEvents([]); 
      setManualAppointments([]);
      
      // 3. Fecha o modal
      setIsClearModalOpen(false);
      
      // 4. Se quiser, pode voltar para o modo inicial
      setIsPreviewMode(false);
      setIsManualMode(false);
    } catch (error) {
      console.error("Erro ao limpar cronograma:", error);
      window.alert("Erro ao limpar cronograma. Tente novamente.");
    } finally {
      setIsClearing(false);
    }
  };

  const handleCreateManually = () => {
    // 1. Limpa qualquer evento fantasma anterior
    setGeneratedEvents([]);
    setManualAppointments([]);
    
    // 2. FORÇA a geração da estrutura vazia do calendário (Gaps)
    if (cls) {
      const emptySlots = generateEmptySlots(cls, holidays);
      const emptyGaps: ScheduleGap[] = emptySlots.map(slot => ({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        reason: 'NO_TEACHER',
        description: 'Disponível para Agendamento'
      }));
      
      // Adiciona os feriados aos gaps também
      holidays.forEach(h => {
        if (!emptyGaps.some(g => g.date === h && g.reason === 'HOLIDAY')) {
          emptyGaps.push({ date: h, reason: 'HOLIDAY', description: 'Feriado / Recesso' });
        }
      });
      
      setGeneratedGaps(emptyGaps);
    }

    // 3. Ativa a visualização do calendário
    setIsPreviewMode(true);
    setIsManualMode(true);
  };

  return (
    <div className="space-y-6">
      {generatedEvents.length === 0 && !isPreviewMode ? (
        <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 rounded-xl border border-dashed border-zinc-800 shadow-sm animate-in fade-in">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Cronograma de Aulas</h3>
          <p className="text-zinc-400 text-center max-w-md mb-8">
            Inicie a montagem do cronograma para organizar os encontros e aulas desta turma.
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={handleCreateManually}
              className="flex items-center gap-2 px-8 py-4 bg-brand-red text-white rounded-lg hover:bg-red-600 transition-colors font-bold shadow-lg shadow-brand-red/20 uppercase tracking-wider"
            >
              <Calendar className="w-5 h-5" />
              INICIAR MONTAGEM MANUAL
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-white">Configuração do Cronograma</h3>
              <p className="text-sm text-zinc-400">
                {generatedEvents.length} aulas agendadas. Verifique os detalhes abaixo antes de salvar.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
              {saveMessage && (
                <div className="flex items-center gap-2 text-emerald-500 bg-emerald-950/30 px-3 py-2 rounded-lg border border-emerald-900/50 text-sm font-medium animate-in slide-in-from-right-5 fade-in">
                  <CheckCircle className="w-4 h-4" />
                  {saveMessage}
                </div>
              )}

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setIsClearModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition text-sm font-medium"
                >
                  <Trash2 size={16} />
                  Limpar Cronograma
                </button>
                
                <button
                  onClick={handleSaveSchedule}
                  disabled={isSaving || isGenerating || alert?.type === 'RED'}
                  title={alert?.type === 'RED' ? "Resolva os alertas críticos antes de salvar" : "Salvar cronograma"}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      SALVAR CRONOGRAMA DEFINITIVO
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {alert && (
            <div className={`p-4 rounded-lg border ${
              alert.type === 'RED' 
                ? 'bg-red-900/30 border-red-500 text-red-200' 
                : 'bg-yellow-900/30 border-yellow-500 text-yellow-200'
            } animate-in slide-in-from-top-2`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {alert.type === 'RED' ? <AlertOctagon className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">
                    {alert.type === 'RED' ? 'Bloqueio Crítico' : 'Atenção'}
                  </h4>
                  <p className="text-sm">{alert.message}</p>
                  
                  {alert.conflictData && (
                    <div className="mt-4 flex flex-col gap-2">
                      <div className="flex gap-3">
                        <button
                          onClick={() => setAlert(null)}
                          className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 rounded border border-white/10 transition-colors"
                        >
                          Manter Professor (Ignorar Regra)
                        </button>
                        <button
                          onClick={() => {
                            if (alert.conflictData) {
                              setInstructionMessage(`Por favor, localize o Encontro #${alert.conflictData.meetingNumber} no dia ${alert.conflictData.date} abaixo e clique para substituí-lo manualmente.`);
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 rounded border border-white/10 transition-colors"
                        >
                          Substituir Professor
                        </button>
                      </div>
                      {instructionMessage && (
                        <p className="text-sm italic opacity-90 mt-1 bg-black/20 p-2 rounded">
                          {instructionMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <SchedulePreview 
            classData={cls}
            events={generatedEvents} 
            gaps={generatedGaps}
            teachers={teachers} 
            subjects={subjects} 
            topics={topics}
            onAddException={handleAddException}
            onAddManualAppointment={(appointmentOrArray) => {
              if (Array.isArray(appointmentOrArray)) {
                setManualAppointments(prev => [...prev, ...appointmentOrArray]);
                console.log('Manual appointments added:', appointmentOrArray);
              } else {
                setManualAppointments(prev => [...prev, appointmentOrArray]);
                console.log('Manual appointment added:', appointmentOrArray);
              }
            }}
            onDeleteAppointment={handleDeleteAppointment}
            onUpdateEventStatus={isPreviewMode ? undefined : handleUpdateEventStatus}
          />
        </div>
      )}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 flex flex-col gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Trash2 className="text-red-500" size={24} />
                Limpar todo o cronograma?
              </h2>
              <p className="text-gray-400 text-sm">
                Esta ação removerá <strong className="text-red-400">permanentemente</strong> todos os agendamentos desta turma do banco de dados. Você terá que recriar o planejamento manualmente do zero.
              </p>
              <p className="text-gray-300 text-sm font-semibold">
                Esta ação não pode ser desfeita. Deseja continuar?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800 bg-gray-900/50">
              <button
                onClick={() => setIsClearModalOpen(false)}
                disabled={isClearing}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearSchedule}
                disabled={isClearing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition disabled:opacity-50 flex items-center gap-2"
              >
                {isClearing ? 'Limpando...' : 'Sim, Limpar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
