import { db } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { Subject, Topic } from '../types/curriculum';

const SUBJECTS_COLLECTION = 'subjects';
const TOPICS_COLLECTION = 'topics';

export const curriculumService = {
  // --- SUBJECTS ---
  createSubject: async (subjectData: Omit<Subject, 'id'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, SUBJECTS_COLLECTION), {
        ...subjectData,
        order: subjectData.order ?? Date.now(),
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating subject: ", error);
      throw error;
    }
  },

  getSubjectsByClass: async (classId: string): Promise<Subject[]> => {
    try {
      const q = query(
        collection(db, SUBJECTS_COLLECTION), 
        where("classId", "==", classId)
      );
      const querySnapshot = await getDocs(q);
      const subjects: Subject[] = [];
      querySnapshot.forEach((doc) => {
        subjects.push({ id: doc.id, ...doc.data() } as Subject);
      });
      return subjects.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      console.error("Error fetching subjects: ", error);
      throw error;
    }
  },

  updateSubject: async (id: string, data: Partial<Subject>): Promise<void> => {
    try {
      const docRef = doc(db, SUBJECTS_COLLECTION, id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error("Error updating subject: ", error);
      throw error;
    }
  },

  deleteSubject: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, SUBJECTS_COLLECTION, id));
    } catch (error) {
      console.error("Error deleting subject: ", error);
      throw error;
    }
  },

  updateSubjectOrders: async (subjects: { id: string; order: number }[]) => {
    try {
      const batch = writeBatch(db);
      subjects.forEach(({ id, order }) => {
        const subjectRef = doc(db, SUBJECTS_COLLECTION, id);
        batch.update(subjectRef, { order });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error updating subject orders:", error);
      throw error;
    }
  },

  // --- TOPICS ---
  createTopic: async (topicData: Omit<Topic, 'id'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, TOPICS_COLLECTION), {
        ...topicData,
        order: topicData.order ?? Date.now(),
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating topic: ", error);
      throw error;
    }
  },

  getTopicsByClass: async (classId: string): Promise<Topic[]> => {
    try {
      const q = query(
        collection(db, TOPICS_COLLECTION), 
        where("classId", "==", classId)
      );
      const querySnapshot = await getDocs(q);
      const topics: Topic[] = [];
      querySnapshot.forEach((doc) => {
        topics.push({ id: doc.id, ...doc.data() } as Topic);
      });
      return topics.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
      console.error("Error fetching topics: ", error);
      throw error;
    }
  },

  updateTopic: async (id: string, data: Partial<Topic>): Promise<void> => {
    try {
      const docRef = doc(db, TOPICS_COLLECTION, id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error("Error updating topic: ", error);
      throw error;
    }
  },

  deleteTopic: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, TOPICS_COLLECTION, id));
    } catch (error) {
      console.error("Error deleting topic: ", error);
      throw error;
    }
  },

  updateTopicOrders: async (topics: {id: string, order: number}[]): Promise<void> => {
    try {
      const batch = writeBatch(db);
      topics.forEach(topic => {
        const topicRef = doc(db, TOPICS_COLLECTION, topic.id);
        batch.update(topicRef, { order: topic.order });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error updating topic orders: ", error);
      throw error;
    }
  },

  cloneCurriculum: async (sourceClassId: string, targetClassId: string): Promise<void> => {
    try {
      const subjectsQ = query(
        collection(db, SUBJECTS_COLLECTION), 
        where("classId", "==", sourceClassId)
      );
      const subjectsSnapshot = await getDocs(subjectsQ);
      
      const topicsQ = query(
        collection(db, TOPICS_COLLECTION), 
        where("classId", "==", sourceClassId)
      );
      const topicsSnapshot = await getDocs(topicsQ);

      const sourceSubjects = subjectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      const sourceTopics = topicsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));

      const batch = writeBatch(db);

      for (const subject of sourceSubjects) {
        const { id: oldSubjectId, ...subjectData } = subject;
        const newSubjectRef = doc(collection(db, SUBJECTS_COLLECTION));
        const newSubjectId = newSubjectRef.id;
        
        batch.set(newSubjectRef, {
          ...subjectData,
          classId: targetClassId,
          createdAt: new Date().toISOString()
        });

        // Find topics for this subject and clone them
        const subjectTopics = sourceTopics.filter(t => t.subjectId === oldSubjectId);
        for (const topic of subjectTopics) {
          const { id: oldTopicId, ...topicData } = topic;
          const newTopicRef = doc(collection(db, TOPICS_COLLECTION));
          batch.set(newTopicRef, {
            ...topicData,
            classId: targetClassId,
            subjectId: newSubjectId,
            createdAt: new Date().toISOString()
          });
        }
      }

      await batch.commit();
    } catch (error) {
      console.error("Error cloning curriculum: ", error);
      throw error;
    }
  }
};
