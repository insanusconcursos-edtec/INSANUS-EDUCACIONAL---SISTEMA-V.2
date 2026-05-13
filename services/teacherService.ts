import { db, storage } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Teacher } from '../types/teacher';

const TEACHERS_COLLECTION = 'teachers';

export const teacherService = {
  // Criar novo professor
  createTeacher: async (teacher: Omit<Teacher, 'id'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, TEACHERS_COLLECTION), {
        ...teacher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error("Erro ao criar professor: ", error);
      throw error;
    }
  },

  // Atualizar professor existente
  updateTeacher: async (id: string, teacher: Partial<Teacher>): Promise<void> => {
    try {
      const teacherRef = doc(db, TEACHERS_COLLECTION, id);
      await updateDoc(teacherRef, {
        ...teacher,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao atualizar professor: ", error);
      throw error;
    }
  },

  // Deletar professor
  deleteTeacher: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, TEACHERS_COLLECTION, id));
    } catch (error) {
      console.error("Erro ao deletar professor: ", error);
      throw error;
    }
  },

  // Listar todos os professores
  getTeachers: async (): Promise<Teacher[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, TEACHERS_COLLECTION));
      const teachers: Teacher[] = [];
      querySnapshot.forEach((doc) => {
        teachers.push({ id: doc.id, ...doc.data() } as Teacher);
      });
      return teachers;
    } catch (error) {
      console.error("Erro ao listar professores: ", error);
      throw error;
    }
  },

  // Obter professor por ID
  getTeacherById: async (id: string): Promise<Teacher | null> => {
    try {
      const docRef = doc(db, TEACHERS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Teacher;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Erro ao obter professor: ", error);
      throw error;
    }
  },

  // Upload de foto do professor
  uploadPhoto: async (file: File, teacherId: string): Promise<string> => {
    try {
      const storageRef = ref(storage, `teachers/${teacherId}/${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error("Erro ao fazer upload da foto: ", error);
      throw error;
    }
  }
};
