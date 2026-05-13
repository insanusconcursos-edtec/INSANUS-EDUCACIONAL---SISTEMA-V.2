import { Teacher } from '../../types/teacher';
import { ClassScheduleEvent } from '../../types/schedule';

export interface AvailabilityResult {
  isAvailable: boolean;
  reason?: 'BLOCK_DATE' | 'WEEKEND_UNAVAILABLE' | 'WEEKDAY_UNAVAILABLE' | 'NO_PREFERENCE';
  details?: string;
}

export const isTeacherExclusiveToWeekends = (teacher: Teacher): boolean => {
  if (!teacher) return false;
  
  // Verifica se o professor tem disponibilidade de final de semana
  const canWorkWeekend = teacher.availableWeekends?.saturday || teacher.availableWeekends?.sunday;
  
  // Verifica se o professor tem QUALQUER preferência de dia útil cadastrada
  const hasWeekdayPreferences = Array.isArray(teacher.schedulePreferences) && 
    teacher.schedulePreferences.length > 0 &&
    teacher.schedulePreferences.some((pref: any) => 
      pref.day !== 'SATURDAY' && pref.day !== 'SUNDAY'
    );

  // É exclusivo SE pode trabalhar no final de semana E NÃO possui dias úteis cadastrados
  return !!canWorkWeekend && !hasWeekdayPreferences;
};

export const checkTeacherAvailability = (teacher: Teacher, date: string, classData?: any): AvailabilityResult => {
  // 1. Check Unavailabilities (Block dates)
  if (teacher.unavailabilities && teacher.unavailabilities.length > 0) {
    const targetDate = new Date(date + 'T00:00:00');
    
    const unavailability = teacher.unavailabilities.find(u => {
      const start = new Date(u.startDate);
      const end = new Date(u.endDate);
      
      // Normalize dates to ignore time components for day-level blocking
      const targetTime = targetDate.getTime();
      const startTime = new Date(start.toISOString().split('T')[0] + 'T00:00:00').getTime();
      const endTime = new Date(end.toISOString().split('T')[0] + 'T00:00:00').getTime();

      return targetTime >= startTime && targetTime <= endTime;
    });

    if (unavailability) {
      return {
        isAvailable: false,
        reason: 'BLOCK_DATE',
        details: `Bloqueio de agenda (${unavailability.type}${unavailability.reason ? ': ' + unavailability.reason : ''})`
      };
    }
  }

  // 2. Check Day of Week Availability
  // Use T12:00:00 to avoid timezone issues shifting the day
  const dateObj = new Date(date + 'T12:00:00');
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  const dayMap: { [key: number]: string } = {
    0: 'SUNDAY',
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
    6: 'SATURDAY'
  };
  
  const slotDayName = dayMap[dayOfWeek];
  const isWeekend = slotDayName === 'SATURDAY' || slotDayName === 'SUNDAY';

  if (isWeekend) {
    const canWorkWeekends = (slotDayName === 'SATURDAY' && teacher.availableWeekends?.saturday) || 
                            (slotDayName === 'SUNDAY' && teacher.availableWeekends?.sunday);
    if (!canWorkWeekends) {
      return {
        isAvailable: false,
        reason: 'WEEKEND_UNAVAILABLE',
        details: 'Não ministra aulas neste dia do final de semana'
      };
    }
  }

  // TRAVA CIRÚRGICA: Se for dia útil, bloqueia professores que são EXCLUSIVOS de final de semana.
  // Isso protege o professor de Direito Penal e outros especialistas de FDS.
  if (!isWeekend) {
    if (isTeacherExclusiveToWeekends(teacher)) {
      return {
        isAvailable: false,
        reason: 'WEEKDAY_UNAVAILABLE',
        details: 'Professor exclusivo de finais de semana'
      };
    }
  }

  // Validação Multidimensional (Tríade) para dias úteis (e fins de semana se aplicável)
  if (!isWeekend && classData) {
    const matchesTriad = teacher.schedulePreferences?.some((pref: any) => {
      const matchesDay = pref.day === slotDayName;
      const matchesShift = pref.shift === classData.shift;
      
      // Mapeamento de categoria da turma para área do professor
      const classArea = classData.category?.toUpperCase().includes('ENEM') ? 'ENEM' : 'CONCURSO';
      const matchesArea = pref.area === classArea;
      
      return matchesDay && matchesShift && matchesArea; 
    });

    if (!matchesTriad) {
      return {
        isAvailable: false,
        reason: 'WEEKDAY_UNAVAILABLE',
        details: 'Fora do dia/turno/área de preferência'
      };
    }
  } else if (!isWeekend) {
    // Fallback if classData is not provided
    const hasPreference = teacher.schedulePreferences?.some(pref => pref.day === slotDayName);
    if (!hasPreference) {
      return {
        isAvailable: false,
        reason: 'WEEKDAY_UNAVAILABLE',
        details: 'Fora do dia de preferência'
      };
    }
  }

  return { isAvailable: true };
};

export const checkGeographicLock = (
  teacher: Teacher, 
  targetDate: string, 
  targetStartTime: string,
  targetCity: string, 
  lastEvent: ClassScheduleEvent, 
  lastCity: string
): boolean => {
  if (targetCity === lastCity) {
    return true;
  }

  if (!teacher.blockTime) {
    return true; // No block time configured, assume no restriction or handle elsewhere
  }

  const lastEventEnd = new Date(`${lastEvent.date}T${lastEvent.endTime}`);
  const targetEventStart = new Date(`${targetDate}T${targetStartTime}`);

  const diffInMs = targetEventStart.getTime() - lastEventEnd.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);

  return diffInHours >= teacher.blockTime;
};

export const checkClassConflict = (
  teacherId: string, 
  date: string, 
  startTime: string, 
  endTime: string,
  existingSchedules: ClassScheduleEvent[]
): boolean => {
  const teacherEventsOnDate = existingSchedules.filter(
    event => event.teacherId === teacherId && event.date === date && event.status !== 'CANCELED'
  );

  if (teacherEventsOnDate.length === 0) {
    return true;
  }

  const newStart = new Date(`${date}T${startTime}`);
  const newEnd = new Date(`${date}T${endTime}`);

  return !teacherEventsOnDate.some(event => {
    const existingStart = new Date(`${event.date}T${event.startTime}`);
    const existingEnd = new Date(`${event.date}T${event.endTime}`);

    // Check for overlap
    // (StartA < EndB) and (EndA > StartB)
    return newStart < existingEnd && newEnd > existingStart;
  });
};
