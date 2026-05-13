import React, { useState, useMemo } from 'react';
import { X, Check, Clock, AlertCircle } from 'lucide-react';
import { Class } from '../../../../../../types/class';
import { Teacher } from '../../../../../../types/teacher';
import { Subject, Topic } from '../../../../../../types/curriculum';
import { checkTeacherAvailability } from '../../../../../../utils/scheduler/ResourceValidator';
import { calculateMultiPeriodTimes } from '../../../../../../utils/scheduler/TimeCalculator';

interface AddManualAppointmentModalProps {
  selectedDate: string;
  classData: Class;
  teachers: Teacher[];
  subjects: Subject[];
  topics: Topic[];
  isHoliday?: boolean;
  onClose: () => void;
  onSave: (appointments: any[]) => void;
}

const normalizeText = (text: string | undefined | null) => {
  if (!text) return '';
  // Remove acentos, converte para minúsculo e remove espaços em branco extras
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

export const AddManualAppointmentModal: React.FC<AddManualAppointmentModalProps> = ({
  selectedDate,
  classData,
  teachers,
  subjects,
  topics,
  isHoliday = false,
  onClose,
  onSave
}) => {
  const dateObj = new Date(selectedDate + 'T12:00:00');
  const dayOfWeek = dateObj.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 || isHoliday;

  const [startTime, setStartTime] = useState(isWeekend ? '' : classData.startTime);
  const [shift, setShift] = useState(isWeekend ? '' : classData.shift);
  
  const [numberOfPeriods, setNumberOfPeriods] = useState(1);
  const [isSameSubject, setIsSameSubject] = useState(true);
  
  const [globalSelection, setGlobalSelection] = useState({ subjectId: '', teacherId: '' });
  const [periodSelections, setPeriodSelections] = useState<Array<{ subjectId: string, teacherId: string }>>(
    Array(4).fill({ subjectId: '', teacherId: '' })
  );

  const intervalMinutes = classData.hasBreak ? classData.breakDuration : 0;
  const classDurationMinutes = useMemo(() => {
    const totalMinutes = classData.meetingDuration * 60;
    // O tempo total de encontro (ensino) é dividido pela quantidade de tempos selecionada
    return Math.floor(totalMinutes / numberOfPeriods);
  }, [classData.meetingDuration, numberOfPeriods]);

  const getAvailableTeachers = (subjectId: string) => {
    if (!shift || !subjectId) return { availableTeachers: [], unavailableTeachers: [] };

    const available: Teacher[] = [];
    const unavailable: { teacher: Teacher, details: string }[] = [];

    const selectedSubject = subjects.find(s => s.id === subjectId);
    
    // Normaliza os dados alvo
    const normTargetId = normalizeText(subjectId);
    const normTargetName = normalizeText(selectedSubject?.name);

    // Robust filtering for qualified teachers
    const qualifiedTeachers = teachers.filter(t => {
      // 1. Check if teacher is linked to this subject in the class curriculum (Pedagogical Planning)
      // Check both topic-level links and subject-level default teacher
      const isLinkedInCurriculum = 
        (selectedSubject?.defaultTeacherId === t.id) ||
        topics.some(topic => topic.subjectId === subjectId && topic.teacherId === t.id);

      if (isLinkedInCurriculum) return true;

      // 2. Fallback: Check if teacher has this subject in their profile (Flexible matching)
      const professorSubjects = (t as any).subjects || (t as any).materiasLecionadas || [];
      
      if (!professorSubjects || !Array.isArray(professorSubjects) || professorSubjects.length === 0) {
        return false;
      }

      // Helper for flexible matching
      const isMatch = (target: string, candidate: string) => {
        if (!target || !candidate) return false;
        return target === candidate || target.includes(candidate) || candidate.includes(target);
      };

      // Busca Bidirecional com Normalização
      return professorSubjects.some((sub: any) => {
        if (typeof sub === 'string') {
          const normSub = normalizeText(sub);
          return isMatch(normTargetId, normSub) || isMatch(normTargetName, normSub);
        }
        
        if (typeof sub === 'object' && sub !== null) {
          const normSubId = normalizeText(sub.id);
          const normSubName = normalizeText(sub.name || sub.title || sub.materia);

          // Cruza tudo: Testa o ID e Nome da aula contra o ID e Nome do professor, e vice-versa
          return isMatch(normTargetId, normSubId) || 
                 isMatch(normTargetId, normSubName) ||
                 isMatch(normTargetName, normSubId) ||
                 isMatch(normTargetName, normSubName);
        }
        
        return false;
      });
    });

    qualifiedTeachers.forEach(t => {
      const mockClassData = { ...classData, shift: shift as any };
      const availability = checkTeacherAvailability(t, selectedDate, mockClassData);
      
      if (availability.isAvailable) {
        available.push(t);
      } else {
        unavailable.push({ teacher: t, details: availability.details || 'Indisponível' });
      }
    });

    return { availableTeachers: available, unavailableTeachers: unavailable, hasQualifiedTeachers: qualifiedTeachers.length > 0 };
  };

  const handleSave = () => {
    if (!startTime || !shift) return;
    
    if (isSameSubject) {
      if (!globalSelection.subjectId || !globalSelection.teacherId) return;
    } else {
      for (let i = 0; i < numberOfPeriods; i++) {
        if (!periodSelections[i].subjectId || !periodSelections[i].teacherId) return;
      }
    }

    const periodsTimes = calculateMultiPeriodTimes(
      startTime, 
      numberOfPeriods, 
      classDurationMinutes,
      intervalMinutes
    );

    const appointmentsToSave = periodsTimes.map((period, index) => {
      const selection = isSameSubject ? globalSelection : periodSelections[index]; 
      
      return {
        id: Math.random().toString(36).substring(2, 15),
        date: selectedDate,
        startTime: period.startTime,
        endTime: period.endTime,
        shift: shift,
        teacherId: selection.teacherId,
        subjectId: selection.subjectId,
        periodNumber: period.periodNumber,
        isManual: true
      };
    });

    onSave(appointmentsToSave);
  };

  const renderSelectionFields = (index: number, isGlobal: boolean) => {
    const selection = isGlobal ? globalSelection : periodSelections[index];
    const setSelection = (newSelection: Partial<{ subjectId: string, teacherId: string }>) => {
      if (isGlobal) {
        setGlobalSelection(prev => ({ ...prev, ...newSelection }));
      } else {
        setPeriodSelections(prev => {
          const newArr = [...prev];
          newArr[index] = { ...newArr[index], ...newSelection };
          return newArr;
        });
      }
    };

    const { availableTeachers, unavailableTeachers, hasQualifiedTeachers } = getAvailableTeachers(selection.subjectId);

    return (
      <div className="space-y-4 p-4 bg-zinc-950/50 rounded-lg border border-zinc-800">
        {!isGlobal && <h4 className="text-sm font-bold text-white mb-2">{index + 1}º Tempo</h4>}
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Disciplina</label>
          <select
            value={selection.subjectId}
            onChange={(e) => {
              setSelection({ subjectId: e.target.value, teacherId: '' });
            }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white text-sm focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none"
          >
            <option value="">Selecione a disciplina...</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {shift && selection.subjectId && (
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <label className="text-sm font-medium text-zinc-300 block">Professor</label>
            
            <div className="border border-zinc-700 p-2 rounded bg-zinc-900">
              {!hasQualifiedTeachers ? (
                <div className="text-zinc-500 text-xs text-center py-4 italic">
                  Nenhum professor cadastrado e habilitado para esta disciplina.
                </div>
              ) : (
                <>
                  {availableTeachers.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-bold text-emerald-500 uppercase mb-1 flex items-center gap-1">
                        ✅ Professores Disponíveis
                      </div>
                      <div className="space-y-1">
                        {availableTeachers.map(teacher => (
                          <button
                            key={teacher.id}
                            onClick={() => setSelection({ teacherId: teacher.id })}
                            className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center justify-between ${
                              selection.teacherId === teacher.id 
                                ? 'bg-emerald-900/30 text-emerald-200 border border-emerald-800' 
                                : 'text-zinc-300 hover:bg-zinc-800'
                            }`}
                          >
                            <span>{teacher.name}</span>
                            {selection.teacherId === teacher.id && <Check className="w-3 h-3" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {unavailableTeachers.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-red-500 uppercase mb-1 flex items-center gap-1">
                        ❌ Professores Indisponíveis
                      </div>
                      <div className="space-y-1">
                        {unavailableTeachers.map(({ teacher, details }) => (
                          <div
                            key={teacher.id}
                            className="w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between opacity-75 bg-zinc-950/50 border border-zinc-800"
                          >
                            <span className="text-zinc-400">{teacher.name}</span>
                            <span className="text-[10px] text-red-400 max-w-[50%] text-right truncate" title={details}>{details}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const isSaveDisabled = () => {
    if (!startTime || !shift) return true;
    if (isSameSubject) {
      return !globalSelection.subjectId || !globalSelection.teacherId;
    } else {
      for (let i = 0; i < numberOfPeriods; i++) {
        if (!periodSelections[i].subjectId || !periodSelections[i].teacherId) return true;
      }
      return false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Adicionar Agendamento
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Data</label>
              <div className="text-sm font-medium text-white bg-zinc-800/50 p-2 rounded border border-zinc-700">
                {dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Turno</label>
                {isWeekend ? (
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white text-sm focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="MORNING">Manhã</option>
                    <option value="AFTERNOON">Tarde</option>
                    <option value="NIGHT">Noite</option>
                  </select>
                ) : (
                  <div className="text-sm font-medium text-zinc-300 bg-zinc-800/30 p-2 rounded border border-zinc-800">
                    {shift === 'MORNING' ? 'Manhã' : shift === 'AFTERNOON' ? 'Tarde' : 'Noite'}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Horário de Início</label>
                {isWeekend ? (
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white text-sm focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none"
                  />
                ) : (
                  <div className="text-sm font-medium text-zinc-300 bg-zinc-800/30 p-2 rounded border border-zinc-800 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {startTime}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Quantos tempos de aula?</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={numberOfPeriods}
                  onChange={(e) => setNumberOfPeriods(Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white text-sm focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-zinc-400 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
              <AlertCircle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
              <p>O sistema aplicará os intervalos de acordo com a configuração da turma ({intervalMinutes} minutos de intervalo).</p>
            </div>

            {numberOfPeriods > 1 && (
              <div className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700">
                <label className="text-sm font-medium text-white flex-1 cursor-pointer">
                  Usar a mesma disciplina/professor para todos os tempos?
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSameSubject(true)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${isSameSubject ? 'bg-brand-red text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                  >
                    Sim
                  </button>
                  <button
                    onClick={() => setIsSameSubject(false)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${!isSameSubject ? 'bg-brand-red text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                  >
                    Não
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {isSameSubject ? (
                renderSelectionFields(0, true)
              ) : (
                Array.from({ length: numberOfPeriods }).map((_, index) => (
                  <React.Fragment key={index}>
                    {renderSelectionFields(index, false)}
                  </React.Fragment>
                ))
              )}
            </div>

          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-red-600 font-medium shadow-lg shadow-brand-red/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            Salvar Agendamento
          </button>
        </div>
      </div>
    </div>
  );
};
