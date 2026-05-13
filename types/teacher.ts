export type TeacherArea = 'CONCURSO' | 'ENEM';
export type TeacherLocation = 'RIO_BRANCO' | 'PORTO_VELHO';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type Shift = 'MORNING' | 'AFTERNOON' | 'NIGHT';
export type UnavailabilityType = 'PLANTÃO' | 'FÉRIAS' | 'LICENÇA_MÉDICA' | 'VIAGEM' | 'OUTROS';

export interface TeacherSubject {
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface TeacherUnavailability {
  id: string;
  startDate: string; // ISO Date string
  endDate: string; // ISO Date string
  type: UnavailabilityType;
  reason?: string;
}

export interface TeacherSchedulePreference {
  day: DayOfWeek;
  shift: Shift;
  area: TeacherArea;
  priority: 1 | 2 | 3; // 1 = Alta, 2 = Média, 3 = Baixa (ou ordem de escolha)
}

export interface Teacher {
  id?: string;
  name: string;
  email: string;
  whatsapp: string;
  photoUrl?: string;
  
  // Atuação
  areas: TeacherArea[];
  locations: TeacherLocation[];
  primaryLocation?: TeacherLocation | null; // Obrigatório se locations.length > 1
  blockTime?: number | null; // Obrigatório se locations.length > 1 (em horas)

  // Matérias
  subjects: TeacherSubject[];

  // Preferências de Horário
  schedulePreferences: TeacherSchedulePreference[];
  
  // Disponibilidade Finais de Semana
  availableWeekends: {
      saturday: boolean;
      sunday: boolean;
  };

  // Financeiro
  baseHourlyRateConcurso?: number;
  baseHourlyRateEnem?: number;

  // Indisponibilidade (Agenda de Bloqueio)
  unavailabilities: TeacherUnavailability[];
  
  createdAt: string;
  updatedAt: string;
}
