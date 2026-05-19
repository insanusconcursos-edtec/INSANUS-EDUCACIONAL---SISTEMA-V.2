
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { MetaType } from './metaService';
import { touchPlan } from './planService';
import { sanitizeData, toPlainObject } from './firestoreUtils';

// === TYPES ===

export interface EdictLinkedGoals {
  lesson: string[];
  material: string[];
  questions: string[];
  summary: string[];
  review: string[];
  law: string[];
}

export interface EdictSubtopic {
  id: string;
  name: string;
  linkedGoals: EdictLinkedGoals;
  observation?: string;
  subtopics?: EdictSubtopic[]; // Added for compatibility with EdictTopic
  studyLevelId?: string | null; // Added for compatibility with EdictTopic
}

export interface EdictTopicGroup {
  id: string;
  name: string;
  order: number;
}

export interface EdictTopic {
  id: string;
  name: string;
  subtopics: EdictSubtopic[];
  linkedGoals: EdictLinkedGoals; 
  collapsed?: boolean;
  studyLevelId?: string | null;
  observation?: string;
  groupId?: string | null;
}

export interface EdictDiscipline {
  id: string;
  name: string;
  topics: EdictTopic[];
  collapsed?: boolean;
  topicGroups?: EdictTopicGroup[];
  analysisVideoUrl?: string;
}

export interface EdictStudyLevel {
  id: string;
  name: string;
}

export interface EdictStructure {
  planId: string;
  disciplines: EdictDiscipline[];
  studyLevels: EdictStudyLevel[]; // Novo Campo: Lista Global de Níveis
  updatedAt?: any;
}

// === HELPERS ===

const getEmptyGoals = (): EdictLinkedGoals => ({
  lesson: [],
  material: [],
  questions: [],
  summary: [],
  review: [],
  law: []
});

const getStructureRef = (planId: string) => doc(db, 'plans', planId, 'edict', 'structure');

// === MAIN FUNCTIONS ===

export const toggleEdict = async (planId: string, isEnabled: boolean) => {
  const planRef = doc(db, 'plans', planId);
  await updateDoc(planRef, { isEdictEnabled: isEnabled });
  await touchPlan(planId);
};

/**
 * Ativa ou desativa o modo "Usuário Ativo" no plano.
 * Quando ativo, permite que o aluno marque itens como concluídos manualmente.
 */
export const toggleActiveUserMode = async (planId: string, isEnabled: boolean) => {
  const planRef = doc(db, 'plans', planId);
  await updateDoc(planRef, { isActiveUserMode: isEnabled });
  await touchPlan(planId);
};

export const getEdict = async (planId: string): Promise<EdictStructure> => {
  const docRef = getStructureRef(planId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    // Converte para objeto plano para evitar erros de estrutura circular e Timestamps no estado
    const data = toPlainObject(docSnap.data()) as EdictStructure;
    // Garante que o array existe (migration on read)
    if (!data.studyLevels) data.studyLevels = [];
    return data;
  } else {
    const emptyStructure: EdictStructure = {
      planId,
      disciplines: [],
      studyLevels: [],
      updatedAt: serverTimestamp()
    };
    return emptyStructure;
  }
};

export const saveEdictStructure = async (planId: string, structure: EdictStructure) => {
  const docRef = getStructureRef(planId);
  
  // Sanitização recursiva para remover undefined
  const sanitizedData = sanitizeData({
    ...structure,
    updatedAt: serverTimestamp()
  });

  await setDoc(docRef, sanitizedData);
  await touchPlan(planId);
};

// === STUDY LEVEL OPERATIONS ===

export const addStudyLevel = async (planId: string, name: string) => {
  const structure = await getEdict(planId);
  
  const newLevel: EdictStudyLevel = {
    id: crypto.randomUUID(),
    name
  };

  structure.studyLevels.push(newLevel);
  await saveEdictStructure(planId, structure);
  return newLevel;
};

export const deleteStudyLevel = async (planId: string, levelId: string) => {
  const structure = await getEdict(planId);
  
  // Remove o nível da lista global
  structure.studyLevels = structure.studyLevels.filter(l => l.id !== levelId);
  
  // (Opcional) Limpar referência nos tópicos ou deixar como "órfão" até reatribuição.
  // Por simplicidade e performance, mantemos o ID no tópico. 
  // O frontend lidará com IDs inexistentes mostrando placeholder.

  await saveEdictStructure(planId, structure);
};

export const updateTopicLevel = async (
  planId: string, 
  disciplineId: string, 
  topicId: string, 
  levelId: string | null
) => {
  const structure = await getEdict(planId);
  
  const discipline = structure.disciplines.find(d => d.id === disciplineId);
  if (discipline) {
    const topic = discipline.topics.find(t => t.id === topicId);
    if (topic) {
      topic.studyLevelId = levelId;
    }
  }

  await saveEdictStructure(planId, structure);
};

// === GOAL LINKING OPERATIONS ===

export const getAllLinkedGoalIds = (structure: EdictStructure): Set<string> => {
  const usedIds = new Set<string>();
  
  const collectFromGoals = (goals: EdictLinkedGoals) => {
    Object.values(goals).flat().forEach(id => usedIds.add(id));
  };

  structure.disciplines.forEach(d => {
    d.topics.forEach(t => {
      collectFromGoals(t.linkedGoals);
      t.subtopics.forEach(s => {
        collectFromGoals(s.linkedGoals);
      });
    });
  });

  return usedIds;
};

export const linkGoalsToItem = async (
  planId: string,
  ids: { disciplineId: string; topicId?: string; subtopicId?: string },
  goals: { id: string; type: MetaType }[]
) => {
  const structure = await getEdict(planId);
  let targetGoals: EdictLinkedGoals | undefined;

  const discipline = structure.disciplines.find(d => d.id === ids.disciplineId);
  if (discipline) {
    if (ids.topicId) {
      const topic = discipline.topics.find(t => t.id === ids.topicId);
      if (topic) {
        if (ids.subtopicId) {
          const subtopic = topic.subtopics.find(s => s.id === ids.subtopicId);
          if (subtopic) targetGoals = subtopic.linkedGoals;
        } else {
          targetGoals = topic.linkedGoals;
        }
      }
    }
  }

  if (!targetGoals) throw new Error("Item do edital não encontrado para vinculação.");

  goals.forEach(goal => {
    if (targetGoals && targetGoals[goal.type]) {
      if (!targetGoals[goal.type].includes(goal.id)) {
        targetGoals[goal.type].push(goal.id);
      }
    }
  });

  await saveEdictStructure(planId, structure);
};

export const unlinkGoalFromItem = async (
  planId: string,
  ids: { disciplineId: string; topicId?: string; subtopicId?: string },
  goalId: string,
  type: MetaType
) => {
  const structure = await getEdict(planId);
  let targetGoals: EdictLinkedGoals | undefined;

  const discipline = structure.disciplines.find(d => d.id === ids.disciplineId);
  if (discipline) {
    if (ids.topicId) {
      const topic = discipline.topics.find(t => t.id === ids.topicId);
      if (topic) {
        if (ids.subtopicId) {
          const subtopic = topic.subtopics.find(s => s.id === ids.subtopicId);
          if (subtopic) targetGoals = subtopic.linkedGoals;
        } else {
          targetGoals = topic.linkedGoals;
        }
      }
    }
  }

  if (!targetGoals) return;

  if (targetGoals[type]) {
    targetGoals[type] = targetGoals[type].filter(id => id !== goalId);
  }

  await saveEdictStructure(planId, structure);
};

// === STRUCTURE OPERATIONS ===

export const addEdictDiscipline = async (planId: string, name: string) => {
  const structure = await getEdict(planId);
  const newDiscipline: EdictDiscipline = {
    id: crypto.randomUUID(),
    name,
    topics: [],
    collapsed: false
  };
  structure.disciplines.push(newDiscipline);
  await saveEdictStructure(planId, structure);
  return newDiscipline;
};

export const addEdictTopic = async (planId: string, disciplineId: string, name: string, observation?: string) => {
  const structure = await getEdict(planId);
  const disciplineIndex = structure.disciplines.findIndex(d => d.id === disciplineId);
  if (disciplineIndex === -1) throw new Error("Disciplina não encontrada");

  const newTopic: EdictTopic = {
    id: crypto.randomUUID(),
    name,
    subtopics: [],
    linkedGoals: getEmptyGoals(),
    collapsed: false,
    studyLevelId: null, // Init empty
    observation: observation || ""
  };
  structure.disciplines[disciplineIndex].topics.push(newTopic);
  await saveEdictStructure(planId, structure);
  return newTopic;
};

export const addEdictSubtopic = async (planId: string, disciplineId: string, topicId: string, name: string, observation?: string) => {
  const structure = await getEdict(planId);
  const discipline = structure.disciplines.find(d => d.id === disciplineId);
  if (!discipline) throw new Error("Disciplina não encontrada");

  const topicIndex = discipline.topics.findIndex(t => t.id === topicId);
  if (topicIndex === -1) throw new Error("Tópico não encontrado");

  const newSubtopic: EdictSubtopic = {
    id: crypto.randomUUID(),
    name,
    linkedGoals: getEmptyGoals(),
    subtopics: [],
    studyLevelId: null,
    observation: observation || ""
  };
  discipline.topics[topicIndex].subtopics.push(newSubtopic);
  discipline.topics[topicIndex].collapsed = false; // Auto-expand
  await saveEdictStructure(planId, structure);
  return newSubtopic;
};

export const deleteEdictItem = async (
  planId: string, 
  type: 'discipline' | 'topic' | 'subtopic', 
  ids: { disciplineId: string, topicId?: string, subtopicId?: string }
) => {
  const structure = await getEdict(planId);
  if (type === 'discipline') {
    structure.disciplines = structure.disciplines.filter(d => d.id !== ids.disciplineId);
  } else if (type === 'topic') {
    const discipline = structure.disciplines.find(d => d.id === ids.disciplineId);
    if (discipline) discipline.topics = discipline.topics.filter(t => t.id !== ids.topicId);
  } else if (type === 'subtopic') {
    const discipline = structure.disciplines.find(d => d.id === ids.disciplineId);
    if (discipline) {
      const topic = discipline.topics.find(t => t.id === ids.topicId);
      if (topic) topic.subtopics = topic.subtopics.filter(s => s.id !== ids.subtopicId);
    }
  }
  await saveEdictStructure(planId, structure);
};

export const updateEdictItem = async (
  planId: string,
  type: 'discipline' | 'topic' | 'subtopic',
  ids: { disciplineId: string, topicId?: string, subtopicId?: string },
  updates: { name?: string, observation?: string, analysisVideoUrl?: string }
) => {
  const structure = await getEdict(planId);
  const discipline = structure.disciplines.find(d => d.id === ids.disciplineId);
  if (!discipline) return;

  if (type === 'discipline') {
    if (updates.name !== undefined) discipline.name = updates.name;
    if (updates.analysisVideoUrl !== undefined) discipline.analysisVideoUrl = updates.analysisVideoUrl;
  } else if (type === 'topic' && ids.topicId) {
    const topic = discipline.topics.find(t => t.id === ids.topicId);
    if (topic) {
      if (updates.name !== undefined) topic.name = updates.name;
      if (updates.observation !== undefined) topic.observation = updates.observation;
    }
  } else if (type === 'subtopic' && ids.topicId && ids.subtopicId) {
    const topic = discipline.topics.find(t => t.id === ids.topicId);
    if (topic) {
      const sub = topic.subtopics.find(s => s.id === ids.subtopicId);
      if (sub) {
        if (updates.name !== undefined) sub.name = updates.name;
        if (updates.observation !== undefined) sub.observation = updates.observation;
      }
    }
  }
  await saveEdictStructure(planId, structure);
};

export const renameEdictItem = async (
  planId: string,
  type: 'discipline' | 'topic' | 'subtopic',
  ids: { disciplineId: string, topicId?: string, subtopicId?: string },
  newName: string
) => {
  await updateEdictItem(planId, type, ids, { name: newName });
};
