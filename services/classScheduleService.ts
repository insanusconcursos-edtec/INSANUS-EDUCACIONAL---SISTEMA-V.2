import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore';

const cleanObject = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(cleanObject);
  }

  // Se não for um objeto simples (ex: Timestamp, FieldValue, Date), retorna como está
  if (Object.prototype.toString.call(obj) !== '[object Object]') {
    return obj;
  }
  
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      newObj[key] = cleanObject(obj[key]);
    }
  });
  return newObj;
};

import { ClassScheduleEvent } from '../types/schedule';

export const classScheduleService = {
  saveScheduleEvents: async (classId: string, events: ClassScheduleEvent[]): Promise<void> => {
    try {
      const batch = writeBatch(db);
      const scheduleRef = collection(db, 'class_schedules');

      // 1. Busca todos os eventos antigos vinculados a esta turma
      const q = query(scheduleRef, where('classId', '==', classId));
      const snapshot = await getDocs(q);

      // 2. Adiciona a exclusão dos eventos antigos ao lote (Batch)
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      // 3. Adiciona a criação dos novos eventos ao lote
      events.forEach(event => {
        // Usa o ID do evento se existir, caso contrário deixa o Firestore gerar um
        const docRef = event.id ? doc(scheduleRef, event.id) : doc(scheduleRef);
        
        batch.set(docRef, cleanObject({
          ...event,
          id: docRef.id, // Garante que o campo 'id' interno seja igual ao ID do documento
          classId: classId,
          updatedAt: new Date().toISOString()
        }));
      });

      // 4. Executa a operação atômica (Limpa o velho e salva o novo simultaneamente)
      await batch.commit();
      console.log(`Saved ${events.length} schedule events for class ${classId}`);
    } catch (error) {
      console.error("Error saving schedule events:", error);
      throw error;
    }
  },

  getScheduleEventsByClass: async (classId: string): Promise<ClassScheduleEvent[]> => {
    try {
      const q = query(collection(db, 'class_schedules'), where('classId', '==', classId));
      const querySnapshot = await getDocs(q);
      // Garante que o doc.id sobrescreva qualquer ID interno para consistência total
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClassScheduleEvent));
    } catch (error) {
      console.error("Error fetching schedule events:", error);
      return [];
    }
  },

  updateAppointmentsStatus: async (appointmentIds: string[], newStatus: 'COMPLETED' | 'SCHEDULED'): Promise<void> => {
    if (!appointmentIds.length) return;
    try {
      const batch = writeBatch(db);
      
      appointmentIds.forEach(id => {
        const docRef = doc(db, 'class_schedules', id); 
        batch.update(docRef, { status: newStatus });
      });

      await batch.commit();
      console.log(`Updated status to ${newStatus} for ${appointmentIds.length} events`);
    } catch (error) {
      console.error("Error updating appointment status:", error);
      throw error;
    }
  },

  clearClassSchedule: async (classId: string): Promise<void> => {
    if (!classId) throw new Error("ID da turma não fornecido.");

    try {
      const scheduleRef = collection(db, 'class_schedules');
      const q = query(scheduleRef, where('classId', '==', classId));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
      console.log(`Cleared schedule events for class ${classId}`);
    } catch (error) {
      console.error("Error clearing schedule events:", error);
      throw error;
    }
  }
};
