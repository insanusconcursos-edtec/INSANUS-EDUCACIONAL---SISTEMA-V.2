import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc, 
  arrayUnion, 
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { Announcement } from '../types/announcement';

const COLLECTION_NAME = 'announcements';

/**
 * Cria um novo comunicado para um plano específico.
 */
export const createAnnouncement = async (announcement: Omit<Announcement, 'id' | 'createdAt' | 'readBy'>) => {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...announcement,
    createdAt: Date.now(),
    readBy: []
  });
  return docRef.id;
};

/**
 * Busca comunicados de um plano.
 */
export const getAnnouncementsByPlan = async (planId: string) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('planId', '==', planId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
};

/**
 * Marca um comunicado como lido por um usuário.
 */
export const markAnnouncementAsRead = async (announcementId: string, userId: string) => {
  const docRef = doc(db, COLLECTION_NAME, announcementId);
  await updateDoc(docRef, {
    readBy: arrayUnion(userId)
  });
};

/**
 * Inscreve-se para receber atualizações de comunicados em tempo real para um plano.
 */
export const subscribeToAnnouncements = (planId: string, callback: (announcements: Announcement[]) => void) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('planId', '==', planId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
    callback(announcements);
  });
};
