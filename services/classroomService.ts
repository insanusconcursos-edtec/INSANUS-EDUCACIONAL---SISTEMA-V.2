import { db } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc } from 'firebase/firestore';
import { Classroom } from '../types/classroom';

const CLASSROOMS_COLLECTION = 'classrooms';

export const classroomService = {
  createClassroom: async (classroom: Omit<Classroom, 'id'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, CLASSROOMS_COLLECTION), {
        ...classroom,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating classroom: ", error);
      throw error;
    }
  },

  updateClassroom: async (id: string, classroom: Partial<Classroom>): Promise<void> => {
    try {
      const classroomRef = doc(db, CLASSROOMS_COLLECTION, id);
      await updateDoc(classroomRef, {
        ...classroom,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating classroom: ", error);
      throw error;
    }
  },

  deleteClassroom: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, CLASSROOMS_COLLECTION, id));
    } catch (error) {
      console.error("Error deleting classroom: ", error);
      throw error;
    }
  },

  getClassrooms: async (): Promise<Classroom[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, CLASSROOMS_COLLECTION));
      const classrooms: Classroom[] = [];
      querySnapshot.forEach((doc) => {
        classrooms.push({ id: doc.id, ...doc.data() } as Classroom);
      });
      return classrooms;
    } catch (error) {
      console.error("Error fetching classrooms: ", error);
      throw error;
    }
  },

  getClassroomById: async (id: string): Promise<Classroom | null> => {
    try {
      const docRef = doc(db, CLASSROOMS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Classroom;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error fetching classroom: ", error);
      throw error;
    }
  }
};
