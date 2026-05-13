
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  updateDoc,
  orderBy, 
  limit,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { getDisciplines, getTopics } from './structureService';
import { touchPlan } from './planService';
import { toPlainObject } from './firestoreUtils';

export type MetaType = 'lesson' | 'material' | 'questions' | 'law' | 'summary' | 'review' | 'simulado';

export interface VideoLesson {
  title: string;
  link: string;
  duration: number; // minutes
}

export interface MaterialFile {
  name: string;
  url: string;
}

export interface MaterialLink {
  name: string;
  url: string;
}

export interface SpacedReviewConfig {
  active: boolean;
  intervals: string; // "1, 7, 15, 30"
  repeatLast: boolean;
}

export interface MindMapNote {
  id: string;
  text: string;
  color: string;
  date: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  type: 'root' | 'child' | 'note';
  parentId?: string;
  styles?: ('bold' | 'italic' | 'underline' | 'strikethrough')[];
  media?: {
    url: string;
    position: 'top' | 'bottom' | 'left' | 'right';
    scale: number;
    width: number;
    aspectRatio?: number;
    file?: any;
  };
  notes?: MindMapNote[];
  collapsed?: boolean;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface Meta {
  id?: string;
  title: string;
  type: MetaType;
  order: number;
  color?: string; // Propriedade de Cor Visual
  
  // Lesson
  videos?: VideoLesson[]; 
  
  // Material / Shared
  description?: string;
  pageCount?: number;     
  files?: MaterialFile[];
  links?: MaterialLink[];

  // Configs Específicas
  questionsConfig?: {
    estimatedTime: number; // minutes
  };
  
  lawConfig?: {
    articles: string;
    pages: number;
    speedFactor: number;
  };

  summaryConfig?: {
    estimatedTime: number;
    references?: string[]; // IDs de outras metas
    mindMap?: MindMapNode[];
  };

  flashcardConfig?: {
    estimatedTime: number;
    cards?: Flashcard[];
  };

  // Configuração Global de Revisão Espaçada (Quando essa meta deve reaparecer)
  reviewConfig?: SpacedReviewConfig;

  observation?: string;

  createdAt?: any;
}

// Helper to construct path
const getCollectionPath = (planId: string, discId: string, topicId: string) => 
  `plans/${planId}/disciplines/${discId}/topics/${topicId}/metas`;

// Get Next Order
const getNextOrder = async (path: string): Promise<number> => {
  const q = query(collection(db, path), orderBy('order', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return 1;
  return snapshot.docs[0].data().order + 1;
};

// === CRUD OPERATIONS ===

export const getMetas = async (planId: string, discId: string, topicId: string): Promise<Meta[]> => {
  const path = getCollectionPath(planId, discId, topicId);
  const q = query(collection(db, path));
  const snapshot = await getDocs(q);
  
  // Converte para objeto plano para evitar erros de estrutura circular e Timestamps no estado
  const list = snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as Meta);
  
  return list.sort((a, b) => {
    const orderA = a.order ?? 99999;
    const orderB = b.order ?? 99999;
    return orderA - orderB;
  });
};

/**
 * Busca TODAS as metas de um plano, percorrendo disciplinas e tópicos.
 * (Operação pesada, usar com cache ou moderação)
 */
export const getAllPlanMetas = async (planId: string): Promise<Meta[]> => {
  const allMetas: Meta[] = [];
  
  // 1. Get Disciplines
  const disciplines = await getDisciplines(planId);
  
  // 2. Iterate Disciplines
  for (const disc of disciplines) {
    if (!disc.id) continue;
    // 3. Get Topics
    const topics = await getTopics(planId, disc.id);
    
    // 4. Iterate Topics & Get Metas
    for (const topic of topics) {
      if (!topic.id) continue;
      const metas = await getMetas(planId, disc.id, topic.id);
      allMetas.push(...metas);
    }
  }
  
  return allMetas;
};

export const addMeta = async (
  ids: { planId: string; discId: string; topicId: string }, 
  data: Omit<Meta, 'id' | 'order' | 'createdAt'>
) => {
  const path = getCollectionPath(ids.planId, ids.discId, ids.topicId);
  const nextOrder = await getNextOrder(path);

  await addDoc(collection(db, path), {
    ...data,
    order: nextOrder,
    createdAt: serverTimestamp()
  });
  await touchPlan(ids.planId);
};

export const updateMeta = async (
  ids: { planId: string; discId: string; topicId: string },
  metaId: string,
  data: Partial<Meta>
) => {
  const path = getCollectionPath(ids.planId, ids.discId, ids.topicId);
  const docRef = doc(db, path, metaId);
  await updateDoc(docRef, data);
  await touchPlan(ids.planId);
};

export const deleteMeta = async (
  ids: { planId: string; discId: string; topicId: string },
  metaId: string
) => {
  const path = getCollectionPath(ids.planId, ids.discId, ids.topicId);
  await deleteDoc(doc(db, path, metaId));
  await touchPlan(ids.planId);
};

// === STORAGE ===

export const uploadMetaFile = async (planId: string, file: File): Promise<string> => {
  const fileName = `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `plans/${planId}/materials/${fileName}`);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
};

// Batch Upload Logic
export const uploadBatchMetaFiles = async (
  planId: string, 
  files: { name: string; file?: File; url?: string }[]
): Promise<MaterialFile[]> => {
  
  const promises = files.map(async (item) => {
    // Se já tem URL, mantém
    if (item.url) {
      return { name: item.name, url: item.url };
    }
    // Se tem arquivo novo, faz upload
    if (item.file) {
      const url = await uploadMetaFile(planId, item.file);
      return { name: item.name, url };
    }
    return null;
  });

  const results = await Promise.all(promises);
  return results.filter((r): r is MaterialFile => r !== null);
};

// === REORDER ===

export const reorderMeta = async (
  ids: { planId: string; discId: string; topicId: string },
  items: Meta[],
  index: number,
  direction: 'up' | 'down'
) => {
  if (direction === 'up' && index === 0) return;
  if (direction === 'down' && index === items.length - 1) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  const currentItem = items[index];
  const targetItem = items[targetIndex];

  if (!currentItem.id || !targetItem.id) return;

  const path = getCollectionPath(ids.planId, ids.discId, ids.topicId);
  const batch = writeBatch(db);
  
  const ref1 = doc(db, path, currentItem.id);
  const ref2 = doc(db, path, targetItem.id);

  batch.update(ref1, { order: targetItem.order ?? 0 });
  batch.update(ref2, { order: currentItem.order ?? 0 });

  await batch.commit();
  await touchPlan(ids.planId);
};

/**
 * Atualiza a ordem de todas as metas em lote (Batch Update).
 * Corrige índices duplicados e garante consistência total.
 */
export const reorderMetasBatch = async (
  ids: { planId: string; discId: string; topicId: string },
  items: Meta[]
) => {
  const path = getCollectionPath(ids.planId, ids.discId, ids.topicId);
  const batch = writeBatch(db);
  
  items.forEach((item, index) => {
    if (item.id) {
        const ref = doc(db, path, item.id);
        batch.update(ref, { order: index });
    }
  });

  await batch.commit();
  await touchPlan(ids.planId);
};
