
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  doc, 
  query, 
  where, 
  serverTimestamp, 
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';

export type UserContentType = 'MAP' | 'FLASHCARD' | 'NOTEBOOK';

export interface UserContentItem {
  id: string;
  metaId: string;
  type: UserContentType;
  title: string;
  createdAt: any;
  data?: any; // JSON structure for the map or flashcards
}

// Helper to get collection ref
const getUserContentRef = (userId: string, planId: string) => 
  collection(db, 'users', userId, 'plans', planId, 'user_content');

/**
 * Busca todo o conteúdo criado pelo usuário para uma meta específica.
 */
export const getUserContent = async (userId: string, planId: string, metaId: string, type: UserContentType): Promise<UserContentItem[]> => {
  const q = query(
    getUserContentRef(userId, planId),
    where('metaId', '==', metaId),
    where('type', '==', type),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserContentItem));
};

/**
 * Cria um novo item de conteúdo (Mapa ou Flashcard).
 * Valida o limite de 5 itens por meta.
 */
export const createUserContent = async (
  userId: string, 
  planId: string, 
  metaId: string, 
  type: UserContentType, 
  title: string
) => {
  const colRef = getUserContentRef(userId, planId);
  
  // 1. Check Limit
  const currentItems = await getUserContent(userId, planId, metaId, type);
  if (currentItems.length >= 5) {
    throw new Error("Limite de 5 itens atingido para esta meta.");
  }

  // 2. Create
  await addDoc(colRef, {
    metaId,
    type,
    title: title.toUpperCase(),
    createdAt: serverTimestamp(),
    data: null // Starts empty
  });
};

/**
 * Atualiza campos de um item do usuário (Titulo ou Dados).
 * updates: { title?: string, data?: any }
 */
export const updateUserContent = async (
  userId: string, 
  planId: string, 
  contentId: string, 
  updates: Partial<UserContentItem>
) => {
  const docRef = doc(db, 'users', userId, 'plans', planId, 'user_content', contentId);
  await updateDoc(docRef, updates);
};

/**
 * Exclui um item de conteúdo.
 */
export const deleteUserContent = async (userId: string, planId: string, contentId: string) => {
  const docRef = doc(db, 'users', userId, 'plans', planId, 'user_content', contentId);
  await deleteDoc(docRef);
};
