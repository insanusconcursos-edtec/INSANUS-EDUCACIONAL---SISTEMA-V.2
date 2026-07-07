import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { PresentialEvent, PresentialEventRegistration } from '../types/presentialEvent';

const COLLECTION_NAME = 'presential_events';
const REGISTRATIONS_COLLECTION = 'presential_event_registrations';

export const presentialEventService = {
  async createEvent(event: Omit<PresentialEvent, 'id' | 'createdAt' | 'updatedAt'>) {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...event,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  async updateEvent(id: string, event: Partial<PresentialEvent>) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...event,
      updatedAt: serverTimestamp()
    });
  },

  async deleteEvent(id: string) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  async getEvents() {
    const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PresentialEvent));
  },

  async getEventById(id: string) {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as PresentialEvent;
    }
    return null;
  },

  // Registrations
  async registerStudent(registration: Omit<PresentialEventRegistration, 'id' | 'registeredAt'>) {
    const docRef = await addDoc(collection(db, REGISTRATIONS_COLLECTION), {
      ...registration,
      registeredAt: serverTimestamp()
    });
    return docRef.id;
  },

  async getRegistrationsByEvent(eventId: string) {
    const q = query(
      collection(db, REGISTRATIONS_COLLECTION), 
      where('eventId', '==', eventId),
      orderBy('registeredAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PresentialEventRegistration));
  },

  async getRegistrationsCount(eventId: string): Promise<number> {
    const q = query(
      collection(db, REGISTRATIONS_COLLECTION), 
      where('eventId', '==', eventId)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  },

  getActiveLot(event: PresentialEvent, registrationsCount: number): string | null {
    if (!event.useLots || !event.lots || event.lots.length === 0) return null;

    // Sort lots by their price or order (assuming they are added in order)
    // For now, let's assume they are ordered in the array
    const now = new Date();

    for (const lot of event.lots) {
      if (lot.type === 'DATE') {
        const limitDate = lot.value instanceof Timestamp ? lot.value.toDate() : new Date(lot.value as string);
        if (now <= limitDate) {
          return lot.id;
        }
      } else if (lot.type === 'QUANTITY') {
        const limitQuantity = Number(lot.value);
        if (registrationsCount < limitQuantity) {
          return lot.id;
        }
      }
    }

    // If all lots passed, return the last one? Or null?
    // Usually the last lot stays active until the end.
    return event.lots[event.lots.length - 1].id;
  }
};
