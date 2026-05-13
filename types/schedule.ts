export interface ScheduleGap {
  date: string;
  startTime?: string;
  endTime?: string;
  reason: 'HOLIDAY' | 'NO_TEACHER' | 'NO_CLASS_DAY';
  description: string;
}

export interface ClassScheduleEvent {
  id: string;
  classId: string;
  date: string; // Formato YYYY-MM-DD
  startTime: string; // Formato HH:mm
  endTime: string; // Formato HH:mm
  shift?: string; // Turno do evento (MORNING, AFTERNOON, NIGHT)
  
  // Relacionamentos de Currículo
  subjectId: string;
  topicId: string;
  moduleId: string;
  
  // Relacionamentos de Pessoal
  teacherId: string;
  originalTeacherId?: string; // ID do professor que DEVERIA dar a aula (para aplicar o desconto)
  isSubstitute: boolean; // Flag para indicar se o professor foi alterado manualmente
  
  // Controle de Estado
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELED' | 'RESCHEDULED';
  
  // Metadados para Lógica de Empuxo
  meetingNumber: number; // Ex: Encontro 1, Encontro 2
  classOrderIndex: number; // A ordem matemática desta aula dentro do currículo
  isOverflow?: boolean; // Flag para indicar se o evento excede o limite original de encontros ou data
}

export type ExceptionType = 'SUBSTITUTION' | 'CANCELLATION';

export interface ScheduleException {
  id: string;
  eventId?: string; // ID of the event being modified
  date: string;
  meetingNumber?: number; // Identifica qual encontro do dia (1, 2, etc)
  originalTeacherId?: string; // Para quem ia dar aula (opcional se for slot vazio)
  substituteTeacherId?: string; // Quem vai assumir (apenas para substituição/alteração)
  type: ExceptionType;
}

export interface ScheduleConflictData {
  teacherId: string;
  teacherName: string;
  date: string;
  subjectId: string;
  meetingNumber: number;
}

export interface ScheduleAlert {
  type: 'RED' | 'YELLOW';
  message: string;
  conflictData?: ScheduleConflictData; // Populado se houver conflito de professor no final de semana
}
