import { db } from './firebase';
import { collection, addDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { Equipment } from '../types/equipment';

const EQUIPMENTS_COLLECTION = 'equipments';

export const equipmentService = {
  createEquipment: async (equipment: Omit<Equipment, 'id'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, EQUIPMENTS_COLLECTION), equipment);
      return docRef.id;
    } catch (error) {
      console.error("Error creating equipment: ", error);
      throw error;
    }
  },

  deleteEquipment: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, EQUIPMENTS_COLLECTION, id));
    } catch (error) {
      console.error("Error deleting equipment: ", error);
      throw error;
    }
  },

  getEquipments: async (): Promise<Equipment[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, EQUIPMENTS_COLLECTION));
      const equipments: Equipment[] = [];
      querySnapshot.forEach((doc) => {
        equipments.push({ id: doc.id, ...doc.data() } as Equipment);
      });
      return equipments;
    } catch (error) {
      console.error("Error fetching equipments: ", error);
      throw error;
    }
  }
};
