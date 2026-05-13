
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  where,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { toPlainObject } from './firestoreUtils';

// === TYPES ===

export type ExamType = 'multiple_choice' | 'true_false'; // Certo/Errado (Cespe) vs Múltipla Escolha
export type ExamStatus = 'draft' | 'published';

export interface BlockDiscipline {
  id: string;
  name: string;
  questionCount: number;
}

export interface ExamBlock {
  name: string;
  questionCount: number;
  minApproval: number; // Porcentagem ou valor absoluto (depende da regra, assumindo % por enquanto)
  disciplines?: BlockDiscipline[];
}

export interface ExamFiles {
  bookletUrl?: string; // Caderno de Questões (PDF)
  answerKeyUrl?: string; // Gabarito (PDF)
}

export interface ExamDiscipline {
  id: string;
  name: string;
}

export interface ExamQuestion {
  index: number;
  answer: string; // 'A', 'B', 'C', 'D', 'E' ou 'C' (Certo), 'E' (Errado)
  value: number;  // Pontuação (ex: 1.0)
  isAnnulled: boolean; // Se foi anulada
  
  // Autodiagnóstico Fields
  disciplineId?: string; // ID da disciplina criada neste simulado
  topic?: string; // Assunto (ex: Crase, Atos Administrativos)
  comment?: string; // Comentário ou Observação curta
}

export interface StudentExamResult {
  id: string;
  studentId: string;
  studentName: string;
  studentPhoto?: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  totalQuestions: number;
  completedAt: any;
  isApproved: boolean;
}

export interface SimulatedExam {
  id?: string;
  title: string;
  type: ExamType;
  questionCount: number;
  
  // Nivelamento
  isLeveling?: boolean;
  levelingRanges?: {
    beginner: number;
    intermediate: number;
    advanced: number;
    insane: number;
  };
  
  // Specific Configs
  duration?: number; // Duração em minutos
  alternativesCount?: number; // 4 (ABCD) ou 5 (ABCDE) - Apenas para multiple_choice
  hasPenalty: boolean; // Se uma errada anula uma certa
  
  // Blocks / Areas
  hasBlocks: boolean;
  blocks?: ExamBlock[];
  
  // Rules
  minApprovalPercent: number; // Mínimo para aprovação geral
  isAutoDiagnosisEnabled: boolean; // Se gera diagnóstico automático
  
  // Content
  files: ExamFiles;
  questions?: ExamQuestion[]; // Gabarito estruturado
  autodiagnosisDisciplines?: ExamDiscipline[]; // Disciplinas cadastradas para o autodiagnóstico (FIX: Renamed for clarity)
  
  status: ExamStatus;
  publishDate?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

export interface SimulatedClass {
  id?: string;
  title: string;
  coverUrl: string;
  categoryId: string;
  subcategoryId: string;
  organization: string; // Órgão (ex: PF, PRF)
  buyLink: string;
  presentationVideoUrl?: string;
  
  // Metadata
  createdAt?: any;
  updatedAt?: any;
}

// === HELPERS ===

/**
 * Upload genérico para Storage
 * Path sugerido: simulated/{classId}/{examId?}/{filename}
 */
const uploadFile = async (path: string, file: File): Promise<string> => {
  const uniqueName = `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `${path}/${uniqueName}`);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
};

// === SIMULATED CLASS OPERATIONS (TURMAS) ===

export const getSimulatedClasses = async (filters?: { categoryId?: string; subcategoryId?: string }) => {
  let q = query(collection(db, 'simulatedClasses'), orderBy('createdAt', 'desc'));

  if (filters?.categoryId) {
    q = query(q, where('categoryId', '==', filters.categoryId));
  }
  if (filters?.subcategoryId) {
    q = query(q, where('subcategoryId', '==', filters.subcategoryId));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as SimulatedClass);
};

export const getSimulatedClassById = async (id: string): Promise<SimulatedClass | null> => {
  const docRef = doc(db, 'simulatedClasses', id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return toPlainObject({ id: snapshot.id, ...snapshot.data() }) as SimulatedClass;
  }
  return null;
};

export const createSimulatedClass = async (
  data: Omit<SimulatedClass, 'id' | 'coverUrl' | 'createdAt'>, 
  coverFile?: File
) => {
  let coverUrl = '';

  // 1. Create Doc Ref to generate ID (needed for storage path organization)
  const collectionRef = collection(db, 'simulatedClasses');
  
  // 2. Upload Cover if exists
  if (coverFile) {
    coverUrl = await uploadFile(`simulated/covers`, coverFile);
  }

  // 3. Save to Firestore
  const newClass = await addDoc(collectionRef, {
    ...data,
    coverUrl,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return newClass.id;
};

export const updateSimulatedClass = async (
  id: string, 
  data: Partial<SimulatedClass>, 
  coverFile?: File
) => {
  const docRef = doc(db, 'simulatedClasses', id);
  const updates: any = { ...data, updatedAt: serverTimestamp() };

  if (coverFile) {
    const coverUrl = await uploadFile(`simulated/covers`, coverFile);
    updates.coverUrl = coverUrl;
  }

  await updateDoc(docRef, updates);
};

export const deleteSimulatedClass = async (id: string) => {
  await deleteDoc(doc(db, 'simulatedClasses', id));
};

// === EXAM OPERATIONS (SIMULADOS) ===

export const getExams = async (classId: string) => {
  const q = query(
    collection(db, 'simulatedClasses', classId, 'exams'), 
    orderBy('createdAt', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as SimulatedExam);
};

export const addExamToClass = async (
  classId: string, 
  examData: Omit<SimulatedExam, 'id' | 'createdAt' | 'files'>,
  files?: { booklet?: File; answerKey?: File }
) => {
  const collectionRef = collection(db, 'simulatedClasses', classId, 'exams');
  
  const uploadedFiles: ExamFiles = {};
  
  if (files?.booklet) {
    uploadedFiles.bookletUrl = await uploadFile(`simulated/classes/${classId}/exams/booklets`, files.booklet);
  }
  if (files?.answerKey) {
    uploadedFiles.answerKeyUrl = await uploadFile(`simulated/classes/${classId}/exams/keys`, files.answerKey);
  }

  await addDoc(collectionRef, {
    ...examData,
    files: uploadedFiles,
    questions: [], 
    autodiagnosisDisciplines: [], // Init empty
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const updateExam = async (
  classId: string, 
  examId: string, 
  examData: Partial<SimulatedExam>,
  newFiles?: { booklet?: File; answerKey?: File }
) => {
  const docRef = doc(db, 'simulatedClasses', classId, 'exams', examId);
  const updates: any = { ...examData, updatedAt: serverTimestamp() };

  if (newFiles) {
    if (newFiles.booklet) {
      updates['files.bookletUrl'] = await uploadFile(`simulated/classes/${classId}/exams/booklets`, newFiles.booklet);
    }
    if (newFiles.answerKey) {
      updates['files.answerKeyUrl'] = await uploadFile(`simulated/classes/${classId}/exams/keys`, newFiles.answerKey);
    }
  }

  await updateDoc(docRef, updates);
};

export const updateExamQuestions = async (
  classId: string, 
  examId: string, 
  questions: ExamQuestion[]
) => {
  const docRef = doc(db, 'simulatedClasses', classId, 'exams', examId);
  await updateDoc(docRef, { 
    questions,
    updatedAt: serverTimestamp() 
  });
};

export const saveExamAutodiagnosis = async (
  classId: string,
  examId: string,
  disciplines: ExamDiscipline[],
  questions: ExamQuestion[]
) => {
  const docRef = doc(db, 'simulatedClasses', classId, 'exams', examId);
  
  // FIX: Persistindo disciplinas explicitamente
  await updateDoc(docRef, {
    autodiagnosisDisciplines: disciplines, 
    questions, 
    updatedAt: serverTimestamp()
  });
};

export const deleteExam = async (classId: string, examId: string) => {
  await deleteDoc(doc(db, 'simulatedClasses', classId, 'exams', examId));
};

export const getStudentExamResults = async (classId: string, examId: string): Promise<StudentExamResult[]> => {
  const q = query(
    collection(db, 'simulated_attempts'),
    where('simulatedId', '==', examId),
    where('classId', '==', classId),
    orderBy('score', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      studentId: data.userId,
      studentName: data.userName,
      studentPhoto: data.userPhoto,
      score: data.score,
      correctCount: data.correctCount,
      wrongCount: data.wrongCount,
      blankCount: data.blankCount,
      totalQuestions: data.totalQuestions,
      completedAt: data.completedAt,
      isApproved: data.isApproved
    } as StudentExamResult;
  });
};
