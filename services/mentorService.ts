import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  query, 
  orderBy,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { toPlainObject } from './firestoreUtils';
import { Mentor } from '../types/chat';

export const subscribeToMentors = (callback: (mentors: Mentor[]) => void) => {
  const q = query(collection(db, 'mentors'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const mentors = snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as Mentor);
    callback(mentors);
  });
};

export const getMentors = async (): Promise<Mentor[]> => {
  const q = query(collection(db, 'mentors'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as Mentor);
};

export const getMentorById = async (id: string): Promise<Mentor | null> => {
  const docRef = doc(db, 'mentors', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (toPlainObject({ id: docSnap.id, ...docSnap.data() }) as Mentor) : null;
};

export const uploadMentorPhoto = async (file: File): Promise<string> => {
  const fileName = `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `mentors_photos/${fileName}`);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
};

export const createMentor = async (name: string, photoUrl: string) => {
  await addDoc(collection(db, 'mentors'), {
    name,
    photoUrl,
    createdAt: serverTimestamp()
  });
};

export const updateMentor = async (id: string, data: Partial<Mentor>) => {
  const docRef = doc(db, 'mentors', id);
  await updateDoc(docRef, data);
};

export const deleteMentor = async (id: string) => {
  await deleteDoc(doc(db, 'mentors', id));
};
