export type ContentType = 'PDF' | 'LINK';

export type OnlineStatus = 'EM_GRAVACAO' | 'PUBLICADO';

export interface TeachingAreaLink {
  moduleId: string;
  folderId: string;
  moduleName?: string;
  folderName?: string;
}

export interface ModuleContent {
  id: string;
  type: ContentType;
  title: string;
  url: string;
  createdAt: string;
  fileType?: 'theory' | 'questions';
  linkedTheoryId?: string | null;
}

export interface Module {
  id: string;
  name: string;
  classesCount: number;
  isSelected?: boolean;
  contents?: ModuleContent[];
  isOnline?: boolean;
  onlineStatus?: OnlineStatus;
  publicationDate?: string;
  teachingAreaLink?: TeachingAreaLink;
}

export interface Subject {
  id: string;
  classId: string;
  name: string;
  color: string;
  defaultTeacherId?: string;
  order?: number;
  createdAt?: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  classId: string;
  name: string;
  teacherId?: string;
  requiredClasses: number;
  isSelected: boolean;
  modules?: Module[];
  order?: number;
  createdAt?: string;
}
