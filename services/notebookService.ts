
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { toPlainObject } from './firestoreUtils';

export type NoteType = 'note' | 'error' | 'questions';

export interface EditalNote {
  id?: string;
  userId: string;
  planId: string;
  editalNodeId: string;
  type: NoteType;
  title: string;
  content: string;
  isFolder?: boolean;
  folderId?: string | null;
  position?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface PdfAnnotation {
  id?: string;
  userId: string;
  materialId: string;
  highlights: any[];
  notes: any[];
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION_NAME = 'edital_notes';
const PDF_ANNOTATIONS_COLLECTION = 'pdf_annotations';

export const notebookService = {
  /**
   * Get PDF Annotations for a user and material
   */
  getPdfAnnotations: async (userId: string, materialId: string): Promise<PdfAnnotation | null> => {
    const q = query(
      collection(db, PDF_ANNOTATIONS_COLLECTION),
      where('userId', '==', userId),
      where('materialId', '==', materialId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const docData = snapshot.docs[0];
    return toPlainObject({
      id: docData.id,
      ...docData.data()
    }) as PdfAnnotation;
  },

  /**
   * Save PDF Annotations
   */
  savePdfAnnotations: async (data: Omit<PdfAnnotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
    const existing = await notebookService.getPdfAnnotations(data.userId, data.materialId);
    
    if (existing && existing.id) {
      const docRef = doc(db, PDF_ANNOTATIONS_COLLECTION, existing.id);
      await updateDoc(docRef, {
        highlights: data.highlights,
        notes: data.notes,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, PDF_ANNOTATIONS_COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  },

  /**
   * Get all notes for a specific topic, user and type
   */
  getNotes: async (userId: string, planId: string, editalNodeId: string, type: NoteType): Promise<EditalNote[]> => {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      where('planId', '==', planId),
      where('editalNodeId', '==', editalNodeId),
      where('type', '==', type),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const notes = snapshot.docs.map(doc => toPlainObject({
      id: doc.id,
      ...doc.data()
    }) as EditalNote);
    
    // Sort by position on client if available, else retain createdAt desc
    return notes.sort((a, b) => {
      const posA = a.position !== undefined ? a.position : 999999;
      const posB = b.position !== undefined ? b.position : 999999;
      if (posA !== posB) return posA - posB;
      // fallback to created at
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  },

  /**
   * Create a new note
   */
  saveNote: async (note: Omit<EditalNote, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...note,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  /**
   * Update an existing note
   */
  updateNote: async (noteId: string, data: Partial<EditalNote>): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, noteId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  /**
   * Batch update positions and folders
   */
  updatePositions: async (updates: { id: string; position: number; folderId?: string | null }[]): Promise<void> => {
    // Note: A true batch requires writeBatch. For simplicity we can use Promise.all here
    // or import writeBatch from firestore. Let's use Promise.all.
    await Promise.all(updates.map(update => {
      const docRef = doc(db, COLLECTION_NAME, update.id);
      return updateDoc(docRef, {
        position: update.position,
        folderId: update.folderId !== undefined ? update.folderId : null,
        updatedAt: serverTimestamp()
      });
    }));
  },

  /**
   * Delete a note
   */
  deleteNote: async (noteId: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, noteId);
    await deleteDoc(docRef);
  }
};
