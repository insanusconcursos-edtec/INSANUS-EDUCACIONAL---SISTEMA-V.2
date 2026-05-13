
export type ContentType = 'video' | 'pdf' | 'link' | 'text';

export interface MentorshipContent {
  id: string;
  title: string;
  type: ContentType;
  // Campos específicos
  videoUrl?: string;     // Para Panda/YouTube
  videoProvider?: 'panda' | 'youtube';
  fileUrl?: string;      // Para PDF
  linkUrl?: string;      // Para Link externo
  textContent?: string;  // Para Avisos
  createdAt: string; // ISO String
}

export interface MentorshipLesson {
  id: string;
  title: string;
  contents: MentorshipContent[];
  order: number;
}

export interface MentorshipModule {
  id: string;
  title: string;
  coverUrl: string; // Proporção 474x1000
  description?: string;
  lessons: MentorshipLesson[];
  subModules: MentorshipModule[]; // Recursividade para subpastas
  order: number;
  // Configuração de Bloqueio
  isLocked?: boolean;
  releaseDate?: string; // ISO Date String (YYYY-MM-DD)
}

export interface MentorshipSection {
  id: string;
  title: string; // Ex: "TUTORIAL", "PLANEJAMENTO"
  modules: MentorshipModule[];
  order: number;
}

export interface PlanMentorshipData {
  planId: string;
  sections: MentorshipSection[];
  updatedAt: any; // Firestore Timestamp
}
