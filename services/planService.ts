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
  writeBatch,
  WriteBatch,
  DocumentReference,
  Firestore
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { sanitizeData as cleanObject, toPlainObject } from './firestoreUtils';
import { Plan } from '../types/plan';

// Interfaces
export interface Category {
  id?: string;
  name: string;
  subcategories: string[];
}

// === HELPER CLASS FOR BATCH OPERATIONS ===
// Firestore batches are limited to 500 operations. This class manages automatic commits.
class BatchHandler {
  private batch: WriteBatch;
  private count: number;
  private dbInstance: Firestore;

  constructor(dbInstance: Firestore) {
    this.dbInstance = dbInstance;
    this.batch = writeBatch(dbInstance);
    this.count = 0;
  }

  async set(ref: DocumentReference, data: object) {
    this.batch.set(ref, cleanObject(data));
    this.count++;
    if (this.count >= 450) await this.flush();
  }

  async update(ref: DocumentReference, data: object) {
    this.batch.update(ref, cleanObject(data));
    this.count++;
    if (this.count >= 450) await this.flush();
  }

  async flush() {
    if (this.count > 0) {
      await this.batch.commit();
      this.batch = writeBatch(this.dbInstance);
      this.count = 0;
    }
  }
}

// === SYNC HELPERS ===

/**
 * Marca o plano como "Modificado", atualizando o timestamp lastModifiedAt.
 * Deve ser chamado por qualquer serviço que altere a estrutura, metas, ciclos ou edital.
 */
export const touchPlan = async (planId: string) => {
  const docRef = doc(db, 'plans', planId);
  // Injeta o serverTimestamp diretamente, sem passar por utilitários de limpeza
  await updateDoc(docRef, {
    lastModifiedAt: serverTimestamp()
  });
};

// Storage Functions
export const uploadPlanImage = async (file: File): Promise<string> => {
  // Cria uma referência única: plans/timestamp_nome-do-arquivo
  const fileName = `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `plans/${fileName}`);
  
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
};

// Plan Functions
export const getPlans = async (): Promise<Plan[]> => {
  const q = query(collection(db, 'plans'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as Plan);
};

export const getPlanById = async (id: string): Promise<Plan | null> => {
  const docRef = doc(db, 'plans', id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    // Converte para objeto plano para evitar erros de estrutura circular e Timestamps no estado
    return toPlainObject({ id: docSnap.id, ...docSnap.data() }) as Plan;
  } else {
    return null;
  }
};

export const createPlan = async (data: Omit<Plan, 'id'>) => {
  const cleaned = cleanObject({
    ...data,
    folders: [], 
    cycles: [], // Inicializa ciclos vazios
    cycleSystem: 'continuous', // Default
    isActiveUserMode: false, // Default off
    lastSyncedAt: null
  });

  await addDoc(collection(db, 'plans'), {
    ...cleaned,
    createdAt: serverTimestamp(),
    lastModifiedAt: serverTimestamp()
  });
};

export const updatePlan = async (id: string, data: Partial<Plan>) => {
  const docRef = doc(db, 'plans', id);
  const cleaned = cleanObject(data);
  
  await updateDoc(docRef, {
    ...cleaned,
    lastModifiedAt: serverTimestamp()
  });
};

export const deletePlan = async (id: string) => {
  // Note: Deep delete of subcollections is not supported by client SDK directly.
  // Ideally, this should be done via Cloud Functions.
  // For now, we delete the main doc, leaving orphans (acceptable for MVP/Prototypes)
  // or we implement a recursive delete if needed later.
  await deleteDoc(doc(db, 'plans', id));
};

/**
 * DUPLICAÇÃO PROFUNDA DE PLANO (DEEP COPY)
 * Copia o plano, pastas, ciclos, disciplinas, tópicos, metas e estrutura do edital.
 */
export const duplicatePlan = async (originalPlanId: string) => {
  console.log(`Starting deep copy for plan: ${originalPlanId}`);
  const batchHandler = new BatchHandler(db);

  // 1. Fetch Original Plan
  const originalPlanSnap = await getDoc(doc(db, 'plans', originalPlanId));
  if (!originalPlanSnap.exists()) throw new Error("Plano original não encontrado");
  
  const originalData = originalPlanSnap.data() as Plan;

  // 2. Maps for ID Mapping (Old ID -> New ID)
  const folderMap = new Map<string, string>();
  const disciplineMap = new Map<string, string>();
  const metaMap = new Map<string, string>(); // Needed for Edict Linkage

  // 3. Process Folders (Regenerate IDs)
  // Folders are in the array, so we create new IDs and map them.
  const newFolders = (originalData.folders || []).map(f => {
    const newId = `folder-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    folderMap.set(f.id, newId);
    return { ...f, id: newId };
  });

  // 4. Create New Plan Document (Reserve ID first)
  const newPlanRef = doc(collection(db, 'plans'));
  const newPlanId = newPlanRef.id;

  // Set initial data (Cycles will be empty initially, updated after IDs are mapped)
  await batchHandler.set(newPlanRef, {
    ...originalData,
    title: `${originalData.title} (Cópia)`,
    folders: newFolders,
    cycles: [], // Will be filled after disciplines are processed
    createdAt: serverTimestamp(),
    lastModifiedAt: serverTimestamp(),
    lastSyncedAt: null,
    isEdictEnabled: originalData.isEdictEnabled || false
  });

  // 5. Copy Subcollections (Disciplines -> Topics -> Metas)
  const oldDisciplinesSnap = await getDocs(collection(db, 'plans', originalPlanId, 'disciplines'));
  
  for (const discDoc of oldDisciplinesSnap.docs) {
    const oldDiscData = discDoc.data();
    const newDiscRef = doc(collection(db, 'plans', newPlanId, 'disciplines'));
    
    // Map Discipline ID
    disciplineMap.set(discDoc.id, newDiscRef.id);

    // Map Folder ID (if discipline was inside a folder)
    const newFolderId = oldDiscData.folderId ? folderMap.get(oldDiscData.folderId) : null;

    batchHandler.set(newDiscRef, {
      ...oldDiscData,
      folderId: newFolderId || null,
      createdAt: serverTimestamp()
    });

    // 5.1 Topics
    const oldTopicsSnap = await getDocs(collection(db, 'plans', originalPlanId, 'disciplines', discDoc.id, 'topics'));
    for (const topicDoc of oldTopicsSnap.docs) {
      const oldTopicData = topicDoc.data();
      const newTopicRef = doc(collection(db, 'plans', newPlanId, 'disciplines', newDiscRef.id, 'topics'));
      
      batchHandler.set(newTopicRef, {
        ...oldTopicData,
        createdAt: serverTimestamp()
      });

      // 5.2 Metas
      const oldMetasSnap = await getDocs(collection(db, 'plans', originalPlanId, 'disciplines', discDoc.id, 'topics', topicDoc.id, 'metas'));
      for (const metaDoc of oldMetasSnap.docs) {
        const oldMetaData = metaDoc.data();
        const newMetaRef = doc(collection(db, 'plans', newPlanId, 'disciplines', newDiscRef.id, 'topics', newTopicRef.id, 'metas'));
        
        // Map Meta ID (Crucial for Edict and Summary References)
        metaMap.set(metaDoc.id, newMetaRef.id);

        batchHandler.set(newMetaRef, {
          ...oldMetaData,
          createdAt: serverTimestamp()
        });
      }
    }
  }

  // 6. Reconstruct Cycles with New IDs
  // Now that we have folderMap and disciplineMap populated, we can fix the cycles.
  const newCycles = (originalData.cycles || []).map(cycle => {
    const newCycleId = `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const newItems = (cycle.items || []).map(item => {
      let newReferenceId = item.referenceId;
      
      if (item.type === 'folder') {
        newReferenceId = folderMap.get(item.referenceId) || item.referenceId; // Fallback to old if not found (shouldn't happen)
      } else if (item.type === 'discipline') {
        newReferenceId = disciplineMap.get(item.referenceId) || item.referenceId;
      }
      // Se for simulado, mantém o ID original (referência à outra coleção) ou lida conforme regra de negócio (aqui mantemos)

      return { ...item, referenceId: newReferenceId };
    });

    return { ...cycle, id: newCycleId, items: newItems };
  });

  // Update new plan with the fixed cycles
  batchHandler.update(newPlanRef, { cycles: newCycles });

  // 7. Copy Edict Structure (If exists)
  const oldEdictSnap = await getDoc(doc(db, 'plans', originalPlanId, 'edict', 'structure'));
  
  if (oldEdictSnap.exists()) {
    const oldEdictData = oldEdictSnap.data();
    
    // Recursive function to traverse edict tree and replace Meta IDs in linkedGoals
    const replaceMetaIdsInGoals = (linkedGoals: Record<string, string[]>) => {
      if (!linkedGoals) return;
      const types = ['lesson', 'material', 'questions', 'law', 'summary', 'review'];
      
      types.forEach(type => {
        if (linkedGoals[type] && Array.isArray(linkedGoals[type])) {
          // Replace old IDs with new IDs from metaMap
          linkedGoals[type] = linkedGoals[type]
            .map((oldId: string) => metaMap.get(oldId))
            .filter((newId: string | undefined): newId is string => newId !== undefined); // Remove if not found
        }
      });
    };

    // Deep clone to avoid mutating original data (using cleanObject to be safe with Firestore objects)
    const newEdictData = cleanObject(oldEdictData) as any;

    // Traverse Structure
    if (newEdictData.disciplines) {
        newEdictData.disciplines.forEach((d: any) => {
            if (d.topics) {
                d.topics.forEach((t: any) => {
                    replaceMetaIdsInGoals(t.linkedGoals);
                    if (t.subtopics) {
                        t.subtopics.forEach((s: any) => {
                            replaceMetaIdsInGoals(s.linkedGoals);
                        });
                    }
                });
            }
        });
    }

    const newEdictRef = doc(db, 'plans', newPlanId, 'edict', 'structure');
    
    batchHandler.set(newEdictRef, {
      ...newEdictData,
      planId: newPlanId,
      updatedAt: serverTimestamp()
    });
  }

  // 8. Commit All Batches
  await batchHandler.flush();
  console.log(`Deep copy finished successfully. New Plan ID: ${newPlanId}`);
};

// Category Functions
export const getCategories = async (): Promise<Category[]> => {
  const snapshot = await getDocs(collection(db, 'categories'));
  return snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as Category);
};

export const createCategory = async (name: string) => {
  await addDoc(collection(db, 'categories'), {
    name,
    subcategories: []
  });
};

export const updateCategory = async (id: string, data: Partial<Category>) => {
  const docRef = doc(db, 'categories', id);
  await updateDoc(docRef, data);
};

export const deleteCategory = async (id: string) => {
  await deleteDoc(doc(db, 'categories', id));
};

import { getStudentPlans } from './studentService';

export const planService = {
  touchPlan,
  uploadPlanImage,
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  duplicatePlan,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getStudentPlans
};
