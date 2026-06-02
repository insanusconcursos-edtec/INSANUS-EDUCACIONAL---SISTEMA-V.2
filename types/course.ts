
// Definição dos Status Possíveis
export type ContestStatus = 
  | 'SEM_PREVISAO' 
  | 'COMISSAO_FORMADA' 
  | 'AUTORIZADO' 
  | 'BANCA_CONTRATADA' 
  | 'EDITAL_PUBLICADO';

// Helper para labels legíveis
export const CONTEST_STATUS_LABELS: Record<ContestStatus, string> = {
  'SEM_PREVISAO': 'Sem Previsão',
  'COMISSAO_FORMADA': 'Comissão Formada',
  'AUTORIZADO': 'Concurso Autorizado',
  'BANCA_CONTRATADA': 'Banca Contratada',
  'EDITAL_PUBLICADO': 'Edital Publicado'
};

export interface OnlineCourse {
  id: string;
  title: string;
  description?: string; // Novo campo
  coverUrl: string;
  
  // Banner (Netflix Style)
  bannerUrlDesktop?: string;
  bannerUrlTablet?: string;
  bannerUrlMobile?: string;

  // Vídeo de Boas-Vindas
  welcomeButtonTitle?: string;
  welcomeVideoUrl?: string;

  categoryId: string;
  subcategoryId?: string;
  organization?: string;
  
  // --- NOVOS CAMPOS DE STATUS ---
  contestStatus?: ContestStatus; 
  examBoard?: string;            
  examDate?: string;             
  
  type?: 'REGULAR' | 'ISOLADO';

  createdAt: string;
  updatedAt: string;
  active: boolean;
}

// --- NOVO: Interface do Módulo ---
export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  coverUrl: string; // Proporção 474x1000
  order: number;
  
  // Função Bloqueio
  isLocked: boolean;
  // CORREÇÃO: Adicionado '| null' para permitir limpar a data no Firestore
  releaseDate?: string | null; 
}

// --- NOVO: Interface do Grupo (Agrupador de Pastas e Aulas) ---
export interface CourseGroup {
  id: string;
  moduleId: string; // Vincula ao módulo pai
  title: string;
  order: number;
}

// --- NOVO: Interface da Pasta (Submódulo) ---
export interface CourseSubModule {
  id: string;
  moduleId: string; // Vincula ao módulo pai
  groupId?: string | null; // Opcional para retrocompatibilidade
  title: string;
  order: number;
  publishDate?: string | null; // Adicionado para Drip Content
  scheduledDate?: string | null; // Novo: Data de gravação/agendamento
  status?: 'published' | 'recording' | 'scheduled' | null; // Novo: Status do módulo
  parentId?: string | null; // Adicionado para suportar subpastas aninhadas
}

// --- NOVO: Interface da Aula ---
export interface CourseLesson {
  id: string;
  moduleId: string;
  subModuleId?: string | null;
  groupId?: string | null; // Opcional para retrocompatibilidade
  title: string;
  coverUrl?: string;
  order: number;
  
  // --- NOVO CAMPO: Tipo de Aula ---
  type: 'video' | 'pdf'; // Identificador visual

  // Contadores (já existentes)
  videoCount?: number;
  pdfCount?: number;
}

export interface CourseStructureModule extends CourseModule {
  folders: (CourseSubModule & { lessons: CourseLesson[] })[];
  looseLessons: CourseLesson[];
}

export interface CourseFormData {
  title: string;
  description?: string;
  coverUrl: string;
  
  // Banner (Netflix Style)
  bannerUrlDesktop?: string;
  bannerUrlTablet?: string;
  bannerUrlMobile?: string;

  // Vídeo de Boas-Vindas
  welcomeButtonTitle?: string;
  welcomeVideoUrl?: string;

  categoryId: string;
  subcategoryId: string;
  organization: string;
  
  // Novos campos no form
  contestStatus?: ContestStatus;
  examBoard?: string;
  examDate?: string;
  type?: 'REGULAR' | 'ISOLADO';
}

// --- NOVO: Tipos de Conteúdo ---
export type ContentType = 'video' | 'pdf' | 'link' | 'text' | 'embed';

export interface CourseContent {
  id: string;
  lessonId: string;
  title: string;
  type: ContentType;
  order: number;
  
  // Campos específicos por tipo
  videoUrl?: string;
  videoPlatform?: 'panda' | 'youtube';
  useAlternativePlayer?: boolean; // Para YouTube
  
  fileUrl?: string; // Para PDF
  pdfClassification?: 'TEORIA' | 'QUESTÕES' | 'TEORIA_QUESTÕES';
  isLinkedToPreviousTheory?: boolean;
  linkedTheoryId?: string | null;
  
  linkUrl?: string; // Para Links
  
  textContent?: string; // Para Texto (HTML)
  
  embedCode?: string; // Para Códigos (Google Forms, etc)
}

// --- NOVO: Interface de Matrícula (Enrollment) ---
export interface CourseEnrollment {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  userCpf?: string;
  userAvatar?: string;
  
  enrollmentType: 'REGULAR' | 'MIGRACAO' | 'BOLSISTA';
  
  releasedAt: string;
  expiresAt: string;
  active: boolean;
}
