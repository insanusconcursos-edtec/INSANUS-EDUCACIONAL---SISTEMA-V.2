import { db, storage } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PlanMentorshipData, MentorshipSection } from '../types/mentorship';

const COLLECTION_NAME = 'plan_mentorships';

// --- FUNÇÃO DE SANITIZAÇÃO (SEGURANÇA CONTRA ERROS DO FIREBASE) ---
// Remove qualquer campo 'undefined' recursivamente de objetos e arrays
const sanitizeForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null; // Converte undefined para null (que o Firestore aceita)
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }

  if (typeof obj === 'object') {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value !== undefined) {
        newObj[key] = sanitizeForFirestore(value);
      }
    });
    return newObj;
  }

  return obj;
};

export const mentorshipService = {
  // Buscar a mentoria de um plano
  getMentorship: async (planId: string): Promise<PlanMentorshipData | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, planId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as PlanMentorshipData;
      }
      return null;
    } catch (error) {
      console.error("Erro ao buscar mentoria:", error);
      throw error;
    }
  },

  // Salvar/Atualizar a estrutura completa
  saveMentorship: async (planId: string, sections: MentorshipSection[]) => {
    try {
      const docRef = doc(db, COLLECTION_NAME, planId);
      
      // Sanitiza os dados antes de enviar
      const cleanSections = sanitizeForFirestore(sections);

      await setDoc(docRef, {
        planId,
        sections: cleanSections,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Erro ao salvar mentoria:", error);
      throw error;
    }
  },

  // Upload da Capa do Módulo (474x1000)
  uploadModuleCover: async (file: File, planId: string): Promise<string> => {
    try {
      const storageRef = ref(storage, `mentorships/${planId}/covers/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      return url;
    } catch (error) {
      console.error("Erro no upload da capa:", error);
      throw error;
    }
  },

  // Upload de Material (PDF) da Aula
  uploadLessonMaterial: async (file: File, planId: string): Promise<string> => {
    try {
      const storageRef = ref(storage, `mentorships/${planId}/materials/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      return url;
    } catch (error) {
      console.error("Erro no upload do material:", error);
      throw error;
    }
  },

  // --- CONTROLE DE PROGRESSO DO ALUNO ---

  // 1. Buscar quais aulas o aluno já completou neste plano
  getStudentProgress: async (userId: string, planId: string): Promise<string[]> => {
    try {
      const docRef = doc(db, 'users', userId, 'mentorship_progress', planId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data().completedLessons || [];
      }
      return [];
    } catch (error) {
      console.error("Erro ao buscar progresso:", error);
      return [];
    }
  },

  // 2. Marcar/Desmarcar aula como concluída
  toggleLessonCompletion: async (userId: string, planId: string, lessonId: string) => {
    try {
      const docRef = doc(db, 'users', userId, 'mentorship_progress', planId);
      const docSnap = await getDoc(docRef);
      
      let currentCompleted: string[] = [];
      if (docSnap.exists()) {
        currentCompleted = docSnap.data().completedLessons || [];
      }

      // Se já existe, remove (desmarca). Se não existe, adiciona (marca).
      let newCompleted;
      if (currentCompleted.includes(lessonId)) {
        newCompleted = currentCompleted.filter(id => id !== lessonId);
      } else {
        newCompleted = [...currentCompleted, lessonId];
      }

      await setDoc(docRef, { 
        completedLessons: newCompleted,
        lastUpdate: serverTimestamp()
      }, { merge: true });

      return newCompleted; // Retorna a nova lista atualizada
    } catch (error) {
      console.error("Erro ao atualizar progresso:", error);
      throw error;
    }
  }
};