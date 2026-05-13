import { Class } from '../../types/class';
import { Topic, Module, Subject } from '../../types/curriculum';
import { Teacher } from '../../types/teacher';
import { ClassScheduleEvent, ScheduleGap, ScheduleException, ScheduleAlert } from '../../types/schedule';
import { checkTeacherAvailability, checkGeographicLock, checkClassConflict, isTeacherExclusiveToWeekends } from './ResourceValidator';
import { generateEmptySlots, TimeSlot } from './TimeSlotGenerator';
import { addDays, parseISO, isAfter, getDay, differenceInDays } from 'date-fns';

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

interface TopicPoolItem {
  topic: Topic;
  remainingModules: {
    module: Module;
    partIndex: number;
    totalParts: number;
  }[];
  lastScheduledDate: string | null;
}

export const buildSchedule = (
  classData: Class,
  selectedTopics: Topic[],
  teachers: Teacher[],
  holidays: string[],
  exceptions: ScheduleException[] = [],
  subjects: Subject[]
): { events: ClassScheduleEvent[], gaps: ScheduleGap[], alert: ScheduleAlert | null } => {
  const schedule: ClassScheduleEvent[] = [];
  const gaps: ScheduleGap[] = [];

  // 1. Initialize Pool
  // Inject holidays immediately
  holidays.forEach(h => gaps.push({ date: h, reason: 'HOLIDAY', description: 'Feriado / Recesso' }));

  const pool: TopicPoolItem[] = selectedTopics.map(topic => {
    const remainingModules: { module: Module; partIndex: number; totalParts: number }[] = [];
    
    if (topic.modules && topic.modules.length > 0) {
      topic.modules.forEach(module => {
        if (module.isSelected !== false && !module.isOnline) {
          for (let i = 0; i < module.classesCount; i++) {
            remainingModules.push({ module, partIndex: i + 1, totalParts: module.classesCount });
          }
        }
      });
    } else if (topic.requiredClasses > 0) {
      const dummyModule: Module = {
        id: `topic-${topic.id}-general`,
        name: topic.name,
        classesCount: topic.requiredClasses,
        isSelected: true
      };
      for (let i = 0; i < topic.requiredClasses; i++) {
        remainingModules.push({ module: dummyModule, partIndex: i + 1, totalParts: topic.requiredClasses });
      }
    }

    return {
      topic,
      remainingModules,
      lastScheduledDate: null
    };
  });

  const isTeacherWeekendOnly = (teacherId: string, teachers: Teacher[]): boolean => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return false;
    
    const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const hasWeekdayAvailability = teacher.schedulePreferences.some(pref => 
      weekdays.includes(pref.day as string)
    );
    
    return !hasWeekdayAvailability;
  };

  // Helper function to select best topic
  const selectBestTopicForDate = (
    dateString: string,
    startTime: string,
    endTime: string,
    pool: TopicPoolItem[],
    teachers: Teacher[],
    previousDaySubjectId: string | null,
    currentMeetingSubjectId: string | null,
    exceptions: ScheduleException[],
    currentMeetingNumber: number,
    subjects: Subject[],
    classData: Class,
    requireExclusiveTeacher: boolean
  ): TopicPoolItem | null => {
    // Filter candidates with remaining modules
    let candidates = pool.filter(p => p.remainingModules.length > 0);

    // 1. Check for exceptions for today
    // We check for exceptions that match the date AND (optionally) the meeting number
    const exceptionForToday = exceptions.find(ex => 
        ex.date === dateString && 
        ex.type === 'SUBSTITUTION' &&
        (!ex.meetingNumber || ex.meetingNumber === currentMeetingNumber)
    );

    if (exceptionForToday) {
      // 2. Force Substitute
      if (exceptionForToday.substituteTeacherId) {
        const substituteCandidate = candidates.find(c => c.topic.teacherId === exceptionForToday.substituteTeacherId);
        if (substituteCandidate) {
          return substituteCandidate;
        }
      }

      // 3. Block Original
      if (exceptionForToday.originalTeacherId) {
        candidates = candidates.filter(c => c.topic.teacherId !== exceptionForToday.originalTeacherId);
      }
    }

    // Filter by availability
    candidates = candidates.filter(candidate => {
      // SEQUENTIAL BLOCKING: Check if there are earlier topics for the same subject that are still pending
      // This ensures we finish Topic 1 before starting Topic 2 of the same Subject
      const candidateIndex = pool.findIndex(p => p.topic.id === candidate.topic.id);
      const hasPendingPreviousTopic = pool.some((p, index) => 
        index < candidateIndex && 
        p.topic.subjectId === candidate.topic.subjectId && 
        p.remainingModules.length > 0
      );

      if (hasPendingPreviousTopic) return false;

      const subject = subjects.find(s => s.id === candidate.topic.subjectId);
      const effectiveTeacherId = candidate.topic.teacherId || subject?.defaultTeacherId;

      if (!effectiveTeacherId) return false; // No teacher assigned

      const teacher = teachers.find(t => t.id === effectiveTeacherId);
      if (!teacher) return false;

      if (requireExclusiveTeacher && !isTeacherExclusiveToWeekends(teacher)) {
        return false;
      }

      // 1. HARD BLOCK DE DIA ÚTIL (Ignora Scarcity Boost)
      const dateObj = parseISO(dateString);
      const dayOfWeek = getDay(dateObj);
      const daysMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
      const slotDayName = daysMap[dayOfWeek];
      const isWeekend = slotDayName === 'SATURDAY' || slotDayName === 'SUNDAY';

      if (!isWeekend) {
        const hasAvailabilityForThisDay = teacher.schedulePreferences?.some(
          (pref) => pref.day === slotDayName
        );
        if (!hasAvailabilityForThisDay) {
          return false; // Ignora o Scarcity Boost. O professor NÃO TRABALHA NESTE DIA.
        }
      } else {
        // Se for final de semana, verifica se tem disponibilidade
        const canWorkThisWeekendDay = (slotDayName === 'SATURDAY' && teacher.availableWeekends?.saturday) || 
                                      (slotDayName === 'SUNDAY' && teacher.availableWeekends?.sunday);
        if (!canWorkThisWeekendDay) {
          return false;
        }
      }

      // Check basic availability (holidays, blocks)
      if (!checkTeacherAvailability(teacher, dateString, classData).isAvailable) return false;

      // Check geographic lock
      // Assuming default city RIO_BRANCO for now as per original code
      const currentCity = 'RIO_BRANCO'; 
      const lastCity = 'RIO_BRANCO'; 
      // We need to check against the last event of THIS teacher in the GLOBAL schedule
      const teacherEvents = schedule.filter(e => e.teacherId === teacher.id);
      const lastTeacherEvent = teacherEvents[teacherEvents.length - 1];
      
      if (lastTeacherEvent) {
         if (!checkGeographicLock(teacher, dateString, startTime, currentCity, lastTeacherEvent, lastCity)) {
           return false;
         }
      }

      // Check class conflict (is teacher teaching another class at this time?)
      if (!checkClassConflict(teacher.id, dateString, startTime, endTime, schedule)) {
        return false;
      }

      return true;
    });

    if (candidates.length === 0) return null;

    // RULE: CONTINUITY (Force same subject if already scheduled in this meeting)
    if (currentMeetingSubjectId) {
        const continuityCandidate = candidates.find(c => c.topic.subjectId === currentMeetingSubjectId);
        if (continuityCandidate) {
            return continuityCandidate;
        }
        // If we are here, it means the current subject has NO more modules available (Exception case).
        // We fall through to the standard selection logic below.
    }

    // COOLDOWN LOGIC: Penalize subject if it was scheduled previously (yesterday)
    let preferredCandidates = candidates;
    if (previousDaySubjectId) {
        const nonPenalized = candidates.filter(c => c.topic.subjectId !== previousDaySubjectId);
        // Only switch to non-penalized list if it has items. 
        // If ONLY penalized items are available, we must use them (don't leave gap).
        if (nonPenalized.length > 0) {
            preferredCandidates = nonPenalized;
        }
    }

    // Sort by Equity (LRU - Least Recently Used) with Scarcity Boost
    preferredCandidates.sort((a, b) => {
      const subjectA = subjects.find(s => s.id === a.topic.subjectId);
      const teacherIdA = a.topic.teacherId || subjectA?.defaultTeacherId;

      const subjectB = subjects.find(s => s.id === b.topic.subjectId);
      const teacherIdB = b.topic.teacherId || subjectB?.defaultTeacherId;

      // Note: teacherId is guaranteed to exist due to previous filter
      if (!teacherIdA || !teacherIdB) return 0;

      const aIsWeekendOnly = isTeacherWeekendOnly(teacherIdA, teachers);
      const bIsWeekendOnly = isTeacherWeekendOnly(teacherIdB, teachers);

      // Prioridade 1: Escassez (Fura-fila absoluto para professores de fim de semana)
      if (aIsWeekendOnly && !bIsWeekendOnly) return -1;
      if (!aIsWeekendOnly && bIsWeekendOnly) return 1;

      // Prioridade 2: LRU (Quem deu aula há mais tempo)
      if (a.lastScheduledDate === null && b.lastScheduledDate === null) return 0;
      if (a.lastScheduledDate === null) return -1; // a comes first (never scheduled)
      if (b.lastScheduledDate === null) return 1; // b comes first
      
      // Both have dates, pick the older one (smaller string value YYYY-MM-DD)
      if (a.lastScheduledDate < b.lastScheduledDate) return -1;
      if (a.lastScheduledDate > b.lastScheduledDate) return 1;
      return 0;
    });

    return preferredCandidates[0];
  };

  // 2. Generate Slots
  const slots = generateEmptySlots(classData, holidays);

  // 3. Allocation Loop
  let previousDaySubjectId: string | null = null;
  let lastScheduledDate: string | null = null;
  let pendingRecovery = 0;
  let logicalMeetingCounter = 1;
  
  // Group slots by meetingNumber (Encontro)
  const slotsByMeeting: Record<number, TimeSlot[]> = {};
  slots.forEach(slot => {
    if (!slotsByMeeting[slot.meetingNumber]) slotsByMeeting[slot.meetingNumber] = [];
    slotsByMeeting[slot.meetingNumber].push(slot);
  });

  // Iterate chronologically by meeting number
  const sortedMeetingNumbers = Object.keys(slotsByMeeting).map(Number).sort((a, b) => a - b);

  for (const meetingNum of sortedMeetingNumbers) {
    // Check if we still have content to schedule
    if (!pool.some(p => p.remainingModules.length > 0)) break;

    let hasScheduledInThisMeeting = false;
    const meetingSlots = slotsByMeeting[meetingNum];
    const currentDate = meetingSlots[0].date;
    const isReserveMeeting = meetingSlots[0].isReserve;

    // --- Lógica de Reserva (Soldado de Reserva) ---
    let requireExclusiveTeacher = false;
    if (isReserveMeeting) {
      let shouldSchedule = false;

      // Exceção 1: Recuperação de Aulas
      if (pendingRecovery > 0) {
        shouldSchedule = true;
      }

      // Exceção 3: Risco de Estouro de Prazo (Hard Deadline)
      if (!shouldSchedule && classData.hardDeadline) {
        const daysToDeadline = differenceInDays(parseISO(classData.hardDeadline), parseISO(currentDate));
        // Se faltam menos de 15 dias e ainda há conteúdo
        if (daysToDeadline < 15 && pool.some(p => p.remainingModules.length > 0)) {
          shouldSchedule = true;
        }
      }

      // Exceção 2: Professor de Fim de Semana Exclusivo
      if (!shouldSchedule) {
        requireExclusiveTeacher = true;
        // Busca Global: Varre todos os tópicos pendentes
        for (const poolItem of pool) {
          if (poolItem.remainingModules.length === 0) continue;
          
          const subject = subjects.find(s => s.id === poolItem.topic.subjectId);
          const effectiveTeacherId = poolItem.topic.teacherId || subject?.defaultTeacherId;
          const teacherObj = teachers.find(t => t.id === effectiveTeacherId);
          
          if (isTeacherExclusiveToWeekends(teacherObj as any)) {
            shouldSchedule = true;
            break;
          }
        }
      }

      if (!shouldSchedule) {
        continue; // Deixa o sábado vazio e avança para o próximo dia útil
      }
    }

    
    // Reset previousDaySubjectId if we moved to a new day
    if (lastScheduledDate && lastScheduledDate !== currentDate) {
        // We keep the previousDaySubjectId from the last meeting of the previous day
        // No action needed here, the variable holds the correct value
    }

    const meetingEvents: ClassScheduleEvent[] = [];
    const topicsToUpdate = new Set<TopicPoolItem>();
    let currentMeetingSubjectId: string | null = null;

    for (const slot of meetingSlots) {
       // Check pool again inside slot loop (for optimization exception)
       if (!pool.some(p => p.remainingModules.length > 0)) break;

       const bestTopic = selectBestTopicForDate(
           currentDate, 
           slot.startTime, 
           slot.endTime, 
           pool,
           teachers,
           previousDaySubjectId,
           currentMeetingSubjectId,
           exceptions,
           logicalMeetingCounter,
           subjects,
           classData,
           requireExclusiveTeacher
       );

       if (bestTopic) {
          const moduleItem = bestTopic.remainingModules.shift()!;
          topicsToUpdate.add(bestTopic);

          // Update current meeting subject for continuity in next slot of SAME meeting
          currentMeetingSubjectId = bestTopic.topic.subjectId;

          // Calculate Overflow Status
          const isMeetingOverflow = logicalMeetingCounter > classData.totalMeetings;
          const isDateOverflow = classData.endDate 
             ? new Date(currentDate + 'T00:00:00') > new Date(classData.endDate + 'T00:00:00') 
             : false;
           
          const isOverflowing = isMeetingOverflow || isDateOverflow;

          // Check for substitution (Only mark as substitute if type is SUBSTITUTION)
          const exceptionForToday = exceptions.find(ex => 
            ex.date === currentDate && 
            ex.type === 'SUBSTITUTION' &&
            (!ex.meetingNumber || ex.meetingNumber === logicalMeetingCounter)
          );
          
          const isSubstitute = exceptionForToday?.type === 'SUBSTITUTION';
          const originalTeacherId = (bestTopic.topic.teacherId || subjects.find(s => s.id === bestTopic.topic.subjectId)?.defaultTeacherId) || null;
          const assignedTeacherId = isSubstitute && exceptionForToday?.substituteTeacherId ? exceptionForToday.substituteTeacherId : originalTeacherId;

          meetingEvents.push({
            isOverflow: isOverflowing,
            id: generateId(),
            classId: classData.id,
            date: currentDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            subjectId: bestTopic.topic.subjectId,
            topicId: bestTopic.topic.id,
            moduleId: moduleItem.module.id,
            teacherId: assignedTeacherId,
            isSubstitute: isSubstitute,
            originalTeacherId: isSubstitute ? originalTeacherId : null,
            status: 'SCHEDULED',
            meetingNumber: logicalMeetingCounter,
            classOrderIndex: 0 // Will be set later
          });
          hasScheduledInThisMeeting = true;
       } else {
          // If failed for this specific slot, generate a gap
          gaps.push({ 
            date: slot.date, 
            startTime: slot.startTime, 
            endTime: slot.endTime, 
            reason: 'NO_TEACHER', 
            description: 'Nenhum professor titular disponível para este horário' 
          });
       }
    }

    if (meetingEvents.length > 0) {
       // Finalize events
       meetingEvents.forEach((event, index) => {
         event.classOrderIndex = schedule.length + index + 1;
       });
       schedule.push(...meetingEvents);

       // Update LRU dates
       topicsToUpdate.forEach(topic => {
         topic.lastScheduledDate = currentDate;
       });

       // Update tracking for next iteration
       lastScheduledDate = currentDate;
       
       // The subject of this meeting becomes the "previous" for the next meeting
       if (currentMeetingSubjectId) {
           previousDaySubjectId = currentMeetingSubjectId;
       }

       // Se usamos um slot reserva para recuperação, diminuímos a dívida
       if (isReserveMeeting && pendingRecovery > 0) {
         pendingRecovery--;
       }
    } else {
      // Se falhamos em agendar um encontro REGULAR (gerou gaps ou nada), aumentamos a dívida
      if (!isReserveMeeting) {
        pendingRecovery++;
      }
    }

    if (hasScheduledInThisMeeting) {
      logicalMeetingCounter++;
    }
  }

  // --- Lógica de Auditoria Final (Alertas) ---
  let scheduleAlert: ScheduleAlert | null = null;
  const lastEvent = schedule[schedule.length - 1];

  if (lastEvent) {
    const projectedEndDate = parseISO(lastEvent.date);

    // 1. Verificação de Limites (Hard Deadline)
    if (classData.type === 'POS_EDITAL' && classData.hardDeadline) {
      const hardDeadlineDate = parseISO(classData.hardDeadline);
      if (isAfter(projectedEndDate, hardDeadlineDate)) {
        scheduleAlert = {
          type: 'RED',
          message: 'Alerta Crítico: O cronograma ultrapassou a Data Limite Inegociável da turma. Ajustes manuais ou aulas em contraturno são obrigatórios.'
        };
      }
    }

    // 2. Verificação de Limites (Soft Deadline)
    // Só verifica se não houver alerta vermelho prévio
    if (!scheduleAlert && (classData.type === 'PRE_EDITAL' || classData.modality === 'REGULAR') && classData.softDeadlineMargin && classData.endDate) {
      const originalEndDate = parseISO(classData.endDate);
      const marginDays = classData.softDeadlineMargin;
      const extendedDeadline = addDays(originalEndDate, marginDays);

      if (isAfter(projectedEndDate, extendedDeadline)) {
        scheduleAlert = {
          type: 'YELLOW',
          message: 'Aviso: O cronograma excedeu a margem de tolerância da data de término prevista.'
        };
      }
    }
  }

  // 3. Verificação de Conflito de Final de Semana
  // Busca qualquer aula agendada no Sábado (6) ou Domingo (0)
  const weekendConflictEvent = schedule.find(ev => {
    const date = parseISO(ev.date);
    const day = getDay(date);
    return day === 0 || day === 6;
  });

  if (weekendConflictEvent) {
    const teacher = teachers.find(t => t.id === weekendConflictEvent.teacherId);
    if (teacher) {
      const date = parseISO(weekendConflictEvent.date);
      const day = getDay(date);
      const isSaturday = day === 6;
      const isSunday = day === 0;

      // Verifica disponibilidade específica
      const isAvailable = isSaturday 
        ? teacher.availableWeekends?.saturday 
        : (isSunday ? teacher.availableWeekends?.sunday : false);

      if (!isAvailable) {
        // Sobrescreve qualquer alerta anterior com este conflito crítico
        scheduleAlert = {
          type: 'RED',
          message: 'Conflito de Regras: Uma aula foi realocada para o final de semana, mas o professor escalado não possui disponibilidade neste período.',
          conflictData: {
            teacherId: teacher.id || '',
            teacherName: teacher.name,
            date: weekendConflictEvent.date,
            subjectId: weekendConflictEvent.subjectId,
            meetingNumber: weekendConflictEvent.meetingNumber
          }
        };
      }
    }
  }

  return { events: schedule, gaps, alert: scheduleAlert };
};
