
import { MindMapNode, Flashcard } from '../services/metaService';

export interface LinkedLesson {
  id: string; // lessonId
  title: string;
  moduleId: string;
}

export interface MaterialPDF {
  title: string;
  url: string;
  storagePath?: string; // Para facilitar exclusão futura
  pdfType?: 'TEORIA' | 'QUESTOES';
}

export interface CourseEditalTopic {
  id: string;
  name: string;
  subtopics: CourseEditalTopic[];
  
  // Novo Campo: Observação Rica
  observation?: string;

  // Conteúdos Vinculados/Criados
  linkedLessons?: LinkedLesson[];
  materialPdfs?: MaterialPDF[];
  
  // Conteúdo Gerado por IA
  contentData?: {
    mindMap?: MindMapNode[];
    flashcards?: Flashcard[];
  };
}

export interface CourseEditalDiscipline {
  id: string;
  name: string;
  topics: CourseEditalTopic[];
}

export interface CourseEditalStructure {
  courseId: string;
  status: 'PRE_EDITAL' | 'POS_EDITAL';
  disciplines: CourseEditalDiscipline[];
  updatedAt: any;
}
