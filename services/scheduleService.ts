import { db } from './firebase';
import { collection, query, where, getDocs, doc, writeBatch, getDoc, documentId, orderBy, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { Plan, getPlanById } from './planService';

export interface StudentRoutine {
  [key: number]: number; // 0 (Sun) - 6 (Sat) -> minutes
}

export interface StudyProfile {
  level: 'beginner' | 'intermediate' | 'advanced' | 'insane';
  semiActiveClass: boolean;   // Double time for Video Lessons
  semiActiveMaterial: boolean; // Double time for PDF/Reading
  semiActiveLaw: boolean;      // Double time for Law/Reading
  smartMergeTolerance?: number; // Tolerância para estender meta (minutos)
}
import { getDisciplines, getTopics } from './structureService';
import { getMetas } from './metaService';
import { toPlainObject } from './firestoreUtils';

export interface ScheduledEvent {
  id?: string;
  userId: string;
  planId: string;
  cycleId?: string;
  taskId?: string; // Internal link to original meta
  date: string; // YYYY-MM-DD
  type: string;
  title: string;
  description?: string;
  duration: number; // in minutes
  completed: boolean;
  status?: 'pending' | 'completed';
  part?: number;
  originalDate?: string; // For rescheduled events
  metaId?: string; // Link to original meta
  subjectId?: string;
  topicId?: string;
  disciplineName?: string;
  topicName?: string;
  reviewInterval?: number; // For spaced repetition
  order?: number;
  
  // Spaced Review fields
  spacedReviewIntervals?: string;
  reviewDuration?: number;
  color?: string;
  isSpacedReview?: boolean;
  isFixed?: boolean;
  reviewSequence?: number;
  intervalDays?: number;
  parentColor?: string;
  recordedMinutes?: number;
  isFreeStudy?: boolean;
  subject?: string;
  discipline?: string;
  cycleName?: string;
  cycleOrder?: number;
  disciplineOrder?: number;
  subjectOrder?: number;
  taskOrder?: number;
  isNewTopic?: boolean;
  isNewCycle?: boolean;
  
  // Content fields (enriched dynamically)
  videos?: any[];
  files?: any[];
  links?: any[];
  mindMap?: any[];
  flashcards?: any[];
  questions?: any[];
}

const mergeArrayUniques = (existingArr: any[], newArr: any[]) => {
  const e = existingArr || [];
  const n = newArr || [];
  if (n.length === 0) return e;
  const existingIds = new Set(e.map(item => item.id || item.title || JSON.stringify(item)));
  return [...e, ...n.filter(item => !existingIds.has(item.id || item.title || JSON.stringify(item)))];
};

export const scheduleService = {
  // ... existing methods ...
};

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

export const getScheduleLimitDate = (currentDate: Date): Date => {
  const limitDate = new Date(currentDate);
  const dayOfWeek = limitDate.getDay(); // 0 (Sun) to 6 (Sat)
  
  // Agendar apenas até o Sábado da semana atual
  const daysUntilSaturday = 6 - dayOfWeek;
  limitDate.setDate(limitDate.getDate() + daysUntilSaturday);
  
  limitDate.setHours(23, 59, 59, 999);
  return limitDate;
};

export const generateSpacedReviews = async (userId: string, planId: string, parentTask: any, completionDateStr: string) => {
  // Verifica se a meta pai possui o campo de intervalos (ex: "1,7,15,30")
  if (!parentTask.spacedReviewIntervals) return;
  
  const intervals = parentTask.spacedReviewIntervals.split(',').map((n: string) => parseInt(n.trim()));
  if (intervals.length === 0 || isNaN(intervals[0])) return;

  const batch = writeBatch(db);
  const baseDate = new Date(completionDateStr + 'T12:00:00'); // Evita fuso horário
  
  // Mapping meta type to goalType
  const typeMapping: Record<string, any> = {
    'law': 'LEI SECA',
    'questions': 'QUESTÕES',
    'summary': 'RESUMO',
    'review': 'FLASHCARD'
  };

  intervals.forEach((interval: number, index: number) => {
    // A data da revisão é cumulativa: Data Anterior + Intervalo Atual
    baseDate.setDate(baseDate.getDate() + interval);
    const targetDateStr = getLocalDataString(baseDate);

    const reviewsRef = collection(db, 'users', userId, 'course_reviews');
    const newReviewRef = doc(reviewsRef);

    const reviewData = {
      id: newReviewRef.id,
      userId,
      planId: planId,
      disciplineId: parentTask.disciplineId || '',
      disciplineName: parentTask.disciplineName || parentTask.discipline || 'Geral',
      topicId: parentTask.topicId || '',
      topicName: parentTask.topicName || parentTask.subject || 'Geral',
      scheduledDate: targetDateStr,
      status: 'pending',
      reviewIndex: index + 1,
      intervalDays: interval,
      label: `REV. ${index + 1} - ${interval} DIA${interval > 1 ? 'S' : ''}`,
      isLastOfCycle: index === intervals.length - 1,
      repeatInterval: null, // Metas não costumam repetir indefinidamente como tópicos
      createdAt: serverTimestamp(),
      
      // Novos metadados de desacoplamento
      type: 'goal_revision',
      goalType: typeMapping[parentTask.type] || 'FLASHCARD',
      goalId: parentTask.metaId || parentTask.taskId || parentTask.id,
      metaTitle: parentTask.title || parentTask.subject
    };

    batch.set(newReviewRef, cleanObject(reviewData));
  });

  await batch.commit();
};

// 1. Normalização Avançada (Fuzzy Matching)
const normalizeName = (name: string) => {
  if (!name) return '';
  let clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  clean = clean.replace(/^(m[oó]dulo|aula|cap[ií]tulo)\s*\d*\s*[-:.]?\s*/gi, '');
  clean = clean.replace(/^[\d.\-\s]+/g, '');
  clean = clean.replace(/[^\w\s]/g, '');
  return clean.replace(/\s+/g, '').trim();
};

interface LogicalGroup { name: string; topicIds: string[]; tasks: any[]; }

// 2. FASE 1: Agrupamento Lógico
const buildLogicalSubjects = (topics: any[], tasks: any[]): Record<string, LogicalGroup[]> => {
  const grouped: Record<string, LogicalGroup[]> = {};
  
  for (const topic of topics) {
    const subjectId = topic.subjectId;
    if (!grouped[subjectId]) grouped[subjectId] = [];
    
    const normName = normalizeName(topic.title || topic.name);
    let group = grouped[subjectId].find(g => normalizeName(g.name) === normName);
    
    if (!group) {
      group = { name: topic.title || topic.name, topicIds: [], tasks: [] };
      grouped[subjectId].push(group);
    }
    group.topicIds.push(topic.id);
  }

  // Preenche as tasks nos grupos e as ordena
  for (const subjectId in grouped) {
    for (const group of grouped[subjectId]) {
      // FILTRA: Não permite que simulados entrem na lógica de grupos e aulas
      const groupTasks = tasks.filter(t => 
        group.topicIds.includes(t.topicId) && 
        t.type !== 'simulado' && 
        t.type !== 'SIMULADO'
      );
      groupTasks.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      group.tasks = groupTasks;
    }
  }
  return grouped;
};

// 3. FASE 2: Geração da Fila de Execução Global (Flat Queue)
const generateExecutionQueue = (cycles: any[], logicalSubjectsBySubj: Record<string, LogicalGroup[]>, isRotative: boolean, disciplines: any[]): any[] => {
  const flatQueue: any[] = [];
  const progress: Record<string, number> = {}; 

  // Helper to expand cycle items into a flat list of processable units (Discipline or Simulado)
  const expandCycleItems = (items: any[], cycleOrder: number) => {
    const expanded: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemOrder = i;
      if (item.type === 'discipline') {
        expanded.push({ type: 'discipline', id: item.referenceId, topicsPerTurn: item.topicsPerTurn, cycleOrder, itemOrder });
      } else if (item.type === 'folder') {
        const folderDisciplines = disciplines.filter(d => d.folderId === item.referenceId);
        folderDisciplines.sort((a, b) => (a.order || 0) - (b.order || 0));
        folderDisciplines.forEach((d, dIdx) => {
          expanded.push({ type: 'discipline', id: d.id, topicsPerTurn: item.topicsPerTurn, cycleOrder, itemOrder, folderOrder: dIdx });
        });
      } else if (item.type === 'simulado') {
        expanded.push({ type: 'simulado', id: item.id, referenceId: item.referenceId, title: item.simuladoTitle, duration: item.duration, cycleOrder, itemOrder });
      }
    }
    return expanded;
  };

  if (isRotative) {
    let hasMoreTopicsGlobal = true;
    while (hasMoreTopicsGlobal) {
      hasMoreTopicsGlobal = false;
      let topicsAddedInThisGlobalRound = false;

      for (let cIdx = 0; cIdx < cycles.length; cIdx++) {
        const cycle = cycles[cIdx];
        const cycleOrder = cycle.order ?? cIdx;
        const expandedItems = expandCycleItems(cycle.items || [], cycleOrder);
        
        for (const item of expandedItems) {
          if (item.type === 'simulado') {
             // Simulados não entram na fila de execução automática
             continue;
          } else {
             const subjectId = item.id;
             const topicsPerRound = item.topicsPerTurn || 1;
             if (progress[subjectId] === undefined) progress[subjectId] = 0;

             const groups = logicalSubjectsBySubj[subjectId] || [];
             const currentIdx = progress[subjectId];

             if (currentIdx < groups.length) {
               hasMoreTopicsGlobal = true;
               topicsAddedInThisGlobalRound = true;

                const groupsToProcess = groups.slice(currentIdx, currentIdx + topicsPerRound);
                groupsToProcess.forEach((g, gIdx) => {
                    const tasksWithCycle = g.tasks.map((t, tIdx) => ({ 
                      ...t, 
                      cycleId: cycle.id,
                      cycleName: cycle.title || cycle.name,
                      cycleOrder: item.cycleOrder,
                      disciplineOrder: item.itemOrder,
                      subjectOrder: currentIdx + gIdx,
                      taskOrder: tIdx
                    }));
                    flatQueue.push(...tasksWithCycle);
                });
               
               progress[subjectId] += topicsPerRound;
             }
          }
        }
      }
      if (!topicsAddedInThisGlobalRound) break;
    }
  } else {
    // CONTÍNUO
    for (let cIdx = 0; cIdx < cycles.length; cIdx++) {
      const cycle = cycles[cIdx];
      const cycleOrder = cycle.order ?? cIdx;
      const expandedItems = expandCycleItems(cycle.items || [], cycleOrder);

      let hasMoreTopicsCycle = true;
      while (hasMoreTopicsCycle) {
        hasMoreTopicsCycle = false;
        let topicsAddedInThisRound = false;

        for (const item of expandedItems) {
           if (item.type === 'simulado') {
              // Simulados não entram na fila de execução automática
              continue;
           } else {
              const subjectId = item.id;
              const topicsPerRound = item.topicsPerTurn || 1;
              if (progress[subjectId] === undefined) progress[subjectId] = 0;

              const groups = logicalSubjectsBySubj[subjectId] || [];
              const currentIdx = progress[subjectId];

              if (currentIdx < groups.length) {
                hasMoreTopicsCycle = true;
                topicsAddedInThisRound = true;

                const groupsToProcess = groups.slice(currentIdx, currentIdx + topicsPerRound);
                groupsToProcess.forEach((g, gIdx) => {
                    const tasksWithCycle = g.tasks.map((t, tIdx) => ({ 
                      ...t, 
                      cycleId: cycle.id,
                      cycleName: cycle.title || cycle.name,
                      cycleOrder: item.cycleOrder,
                      disciplineOrder: item.itemOrder,
                      subjectOrder: currentIdx + gIdx,
                      taskOrder: tIdx
                    }));
                    flatQueue.push(...tasksWithCycle);
                });
                
                progress[subjectId] += topicsPerRound;
              }
           }
        }
        if (!topicsAddedInThisRound) break;
      }
    }
  }
  return flatQueue;
};

export const areSameMeta = (t1: any, t2: any) => {
  if (t1.metaId && t2.metaId) return t1.metaId === t2.metaId;
  return t1.topicId === t2.topicId && 
         t1.type === t2.type && 
         t1.order === t2.order && 
         t1.subjectId === t2.subjectId;
};

export const generateSchedule = async (
  userId: string, 
  planId: string, 
  studyProfile?: StudyProfile, 
  routine?: StudentRoutine, 
  ignoredTaskIds?: string[],
  priorityTasks?: any[]
): Promise<ScheduledEvent[]> => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data() || {};
  
  // Garantir que temos profile e rotina, buscando do banco se não vier por argumento
  const effectiveProfile = studyProfile || userData.studyProfile || {};
  const effectiveRoutine = routine || userData.routine || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };

  const savedRoutines = userData.savedRoutines || [];
  const activeRoutineId = userData.activeRoutineId;
  const activeEvents = savedRoutines.find((r: any) => r.id === activeRoutineId)?.events || [];
  const freeStudyEvents = activeEvents.filter((e: any) => e.isFreeStudy);

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = (time || '00:00').split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  // Normalização do Nível para suportar português e inglês e o campo studentLevel direto
  const rawLevel = effectiveProfile.level || userData.studentLevel || 'beginner';
  const profileLevel = String(rawLevel).toLowerCase();
  
  let readingSpeed = 5; // Default beginner / iniciante
  if (profileLevel === 'advanced' || profileLevel === 'avançado' || profileLevel === 'avancado') {
    readingSpeed = 1;
  } else if (profileLevel === 'insane' || profileLevel === 'insano') {
    readingSpeed = 0.8; // Faster than advanced
  } else if (profileLevel === 'intermediate' || profileLevel === 'intermediário' || profileLevel === 'intermediario') {
    readingSpeed = 3;
  } else if (profileLevel === 'beginner' || profileLevel === 'iniciante') {
    readingSpeed = 5;
  }

  const semiActiveMaterial = effectiveProfile.semiActiveMaterial ? 2 : 1;
  const semiActiveClass = effectiveProfile.semiActiveClass ? 2 : 1;
  const semiActiveLaw = effectiveProfile.semiActiveLaw ? 2 : 1;

  const calculateTotalDuration = (task: any, type: string): number => {
    if (type === 'AULA' || type === 'lesson') {
      const videosDuration = task.videos?.reduce((acc: number, v: any) => acc + (Number(v.duration) || 0), 0) || 0;
      return (videosDuration > 0 ? videosDuration : (Number(task.duration) || 30)) * semiActiveClass;
    } 
    if (type === 'MATERIAL' || type === 'material' || type === 'pdf' || type === 'PDF') {
      const pages = Number(task.pageCount) || Number(task.pages) || 0;
      // REGRA: Iniciante (5min), Intermediário (3min), Avançado (1min)
      const calculatedMaterialTime = pages * readingSpeed * semiActiveMaterial;
      return calculatedMaterialTime || Number(task.duration) || 30;
    }
    if (type === 'LEI_SECA' || type === 'LEI SECA' || type === 'law' || type === 'lei_seca' || type === 'lei seca') {
      // 1. Extrai e força a conversão para número (evita "1" * 2 = NaN)
      const pagesCount = Number(task.pages || task.lawConfig?.pages || task.pageCount) || 1; 
      
      // 2. Extrai o fator multiplicativo (multiplier, speed, speedFactor)
      const multiplierValue = Number(task.multiplier || task.speed || task.lawConfig?.multiplier || task.lawConfig?.speedFactor) || 1; 
      
      // 3. Aplica a fórmula matemática exata do PRD (2 minutos por página * fator)
      const calculatedDuration = (pagesCount * 2) * multiplierValue;
      
      // 4. Sobrescreve a duração da tarefa ANTES de enviar para o agendador (com fallback de segurança extremo de 2 min)
      const finalDuration = calculatedDuration > 0 ? calculatedDuration : 2;
      task.duration = finalDuration; 
      return finalDuration;
    }
    if (type === 'QUESTOES' || type === 'QUESTÕES' || type === 'questions' || type === 'questoes' || type === 'questões') {
      return Number(task.questionsConfig?.estimatedTime || task.duration) || 30;
    }
    if (type === 'RESUMO' || type === 'REVISAO' || type === 'summary' || type === 'review') {
      return Number(task.summaryConfig?.estimatedTime || task.reviewConfig?.estimatedTime || task.flashcardConfig?.estimatedTime || task.duration) || 30;
    }
    if (type === 'SIMULADO' || type === 'simulado' || type === 'exam') {
      return Number(task.duration) || 180;
    }
    return Number(task.duration) || 30;
  };

  // 1. Fetch Data
  const planRef = doc(db, 'plans', planId);
  const planSnap = await getDoc(planRef);
  if (!planSnap.exists()) throw new Error('Plan not found');
  const planData = planSnap.data() as Plan;

  const sortedCycles = (planData.cycles || []).sort((a, b) => (a.order || 0) - (b.order || 0));

  // CARREGAR DISCIPLINAS BLOQUEADAS INDIVIDUALMENTE PELO ALUNO
  let blockedDisciplines: string[] = [];
  try {
    const studentUserPlanRef = doc(db, 'users', userId, 'plans', planId);
    const studentUserPlanSnap = await getDoc(studentUserPlanRef);
    if (studentUserPlanSnap.exists()) {
      blockedDisciplines = studentUserPlanSnap.data().blockedDisciplines || [];
    }
  } catch (error) {
    console.error('Error fetching student-plan blocked disciplines in generator:', error);
  }

  const disciplinesQuery = query(collection(db, 'plans', planId, 'disciplines'), orderBy('order'));
  const disciplinesSnap = await getDocs(disciplinesQuery);
  let sortedDisciplines = disciplinesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // REGRA DE NEGÓCIO: Filtrar disciplinas bloqueadas para que o gerador as ignore por completo
  if (blockedDisciplines.length > 0) {
    const normalizedBlocked = blockedDisciplines.map(d => String(d).toLowerCase().trim());
    sortedDisciplines = sortedDisciplines.filter(disc => {
      const discId = disc.id.toLowerCase().trim();
      const discName = ((disc as any).name || (disc as any).title || '').toLowerCase().trim();
      return !normalizedBlocked.includes(discId) && !normalizedBlocked.includes(discName);
    });
  }

  const sortedTopics: any[] = [];
  const sortedTasks: any[] = [];

  for (const disc of sortedDisciplines) {
    const topicsQuery = query(collection(db, 'plans', planId, 'disciplines', disc.id, 'topics'), orderBy('order'));
    const topicsSnap = await getDocs(topicsQuery);
    
    for (const topicDoc of topicsSnap.docs) {
      const topicData = { id: topicDoc.id, subjectId: disc.id, ...topicDoc.data() };
      sortedTopics.push(topicData);
      
      const metasQuery = query(collection(db, 'plans', planId, 'disciplines', disc.id, 'topics', topicDoc.id, 'metas'), orderBy('order'));
      const metasSnap = await getDocs(metasQuery);
      
      for (const metaDoc of metasSnap.docs) {
        sortedTasks.push({ 
          id: metaDoc.id, 
          topicId: topicDoc.id, 
          subjectId: disc.id, 
          disciplineName: (disc as any).name || (disc as any).title || '',
          topicName: topicData.title || (topicData as any).name || '',
          ...metaDoc.data() 
        });
      }
    }
  }

  // FASE 1: Agrupamento Lógico de Assuntos
  const logicalSubjects = buildLogicalSubjects(sortedTopics, sortedTasks);

  // FASE 2: Geração da Fila Global de Execução
  const isRotative = planData.cycleSystem === 'rotative';
  
  const typeMap: Record<string, string> = {
    'aula': 'lesson',
    'lesson': 'lesson',
    'material': 'material',
    'pdf': 'material',
    'lei_seca': 'law',
    'lei seca': 'law',
    'lei': 'law',
    'law': 'law',
    'questões': 'questions',
    'questoes': 'questions',
    'questions': 'questions',
    'resumo': 'summary',
    'summary': 'summary',
    'revisão': 'review',
    'revisao': 'review',
    'review': 'review'
  };

  let allTasks = generateExecutionQueue(sortedCycles, logicalSubjects, isRotative, sortedDisciplines);

  // FASE 2.1: Filtro de Segurança (Remoção de Concluídas e Ignoradas)
  const completedMetas = await getStudentCompletedMetas(userId, planId);
  allTasks = allTasks.filter(task => 
    !completedMetas.has(task.id) && 
    !(ignoredTaskIds && ignoredTaskIds.includes(task.id))
  );

  // Se houver tarefas prioritárias (atrasos), removemos elas da fila original para evitar duplicidade e as colocamos no topo
  if (priorityTasks && priorityTasks.length > 0) {
    const priorityIds = new Set(priorityTasks.map(t => t.metaId || t.taskId || t.id));
    allTasks = allTasks.filter(t => !priorityIds.has(t.id));
    
    // Converte priorityTasks (ScheduledEvents) de volta para o formato de Task esperado pelo agendador
    const normalizedPriorities = priorityTasks.map(pt => ({
      ...pt,
      id: pt.metaId || pt.taskId || pt.id,
      duration: pt.duration,
      // Garante que o tipo esteja normalizado
      type: pt.type
    }));

    allTasks = [...normalizedPriorities, ...allTasks];
  }

  // GROUP 0-MINUTE TASKS
  const groupedTasks: any[] = [];
  for (const task of allTasks) {
    const normalizedType = typeMap[task.type?.toLowerCase()] || 'lesson';
    const duration = calculateTotalDuration(task, normalizedType);
    
    if (duration === 0 && groupedTasks.length > 0) {
      const lastTask = groupedTasks[groupedTasks.length - 1];
      if (areSameMeta(lastTask, task)) {
        // Merge
        lastTask.videos = [...(lastTask.videos || []), ...(task.videos || [])];
        lastTask.files = [...(lastTask.files || []), ...(task.files || [])];
        lastTask.links = [...(lastTask.links || []), ...(task.links || [])];
        lastTask.mindMap = [...(lastTask.mindMap || []), ...(task.mindMap || [])];
        lastTask.flashcards = [...(lastTask.flashcards || []), ...(task.flashcards || [])];
        lastTask.questions = [...(lastTask.questions || []), ...(task.questions || [])];
        continue;
      }
    }
    groupedTasks.push(task);
  }
  allTasks = groupedTasks;

  // FASE 3: Bin Packing (Allocation)
  const currentDate = new Date();
  const limitDate = getScheduleLimitDate(currentDate);
  
  // FASE 2.4: Carregamento de Tarefas Concluídas para Cálculo de Gap e Conservação
  const existingSchedule = await getRangeSchedule(userId, currentDate, limitDate);
  const completedDurationsByDate: Record<string, number> = {};
  
  Object.entries(existingSchedule).forEach(([dateKey, items]) => {
    const completedItemsOfThisPlan = items.filter((item: any) => 
      item.planId === planId && item.status === 'completed'
    );
    const sum = completedItemsOfThisPlan.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    completedDurationsByDate[dateKey] = sum;
  });

  const getMinutesForDate = (date: Date, isFirstDay: boolean = false): number => {
    const dayOfWeek = date.getDay(); 
    const dateStr = getLocalDataString(date);
    const allocatedRoutine = Number(effectiveRoutine[dayOfWeek as keyof StudentRoutine]) || 0;
    const completedTime = completedDurationsByDate[dateStr] || 0;
    
    // Sobra do dia = Routine - Tempo já gasto em metas concluídas do plano hoje
    const availableRoutine = Math.max(0, allocatedRoutine - completedTime);
    
    if (isFirstDay) {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const minutesLeftToday = Math.floor((endOfDay.getTime() - now.getTime()) / 60000);
      return Math.min(availableRoutine, Math.max(0, minutesLeftToday));
    }
    
    return availableRoutine;
  };

  const minutesRemainingInDay = getMinutesForDate(currentDate, true);
  currentDate.setHours(0, 0, 0, 0);

  const totalWeeklyMinutes = Object.values(effectiveRoutine).reduce((a, b) => Number(a) + Number(b), 0);
  if (totalWeeklyMinutes === 0) {
    throw new Error("Sua rotina semanal não tem nenhum tempo disponível. Configure sua disponibilidade antes de gerar o cronograma.");
  }

  const dailySchedules = new Map<string, any[]>();
  
  // FASE 2.5: Pré-injeção de Blocos de Estudo Livre
  if (freeStudyEvents.length > 0) {
      const tempDate = new Date(currentDate);
      tempDate.setHours(12, 0, 0, 0); // Evita problemas de fuso no loop
      
      while (tempDate <= limitDate) {
          const dayOfWeek = tempDate.getDay();
          const dayStr = getLocalDataString(tempDate);
          const dayFreeEvents = freeStudyEvents.filter((e: any) => e.days.includes(dayOfWeek));
          
          if (dayFreeEvents.length > 0) {
              if (!dailySchedules.has(dayStr)) dailySchedules.set(dayStr, []);
              
              dayFreeEvents.forEach((ev: any) => {
                  const startMin = timeToMinutes(ev.startTime);
                  const endMin = timeToMinutes(ev.endTime);
                  const duration = endMin - startMin;

                  dailySchedules.get(dayStr)!.push({
                      id: `free-${dayStr}-${ev.id}`,
                      metaId: `free-${ev.id}`,
                      userId: userId,
                      planId: planId,
                      date: dayStr,
                      title: 'ESTUDO LIVRE',
                      type: 'free_study',
                      disciplineId: 'free_study',
                      disciplineName: 'ESTUDO LIVRE',
                      duration: duration,
                      startTime: ev.startTime,
                      endTime: ev.endTime,
                      status: 'pending',
                      isFreeStudy: true,
                      recordedMinutes: 0,
                      completed: false,
                      color: '#10b981', // Emerald for free study
                      order: -1 // Garante que apareça no topo ou em ordem cronológica
                  });
              });
          }
          tempDate.setDate(tempDate.getDate() + 1);
      }
  }

  let currentDayCapacity = getMinutesForDate(currentDate, true);
  let currentDayOfWeek = currentDate.getDay();
  const safeRoutine = effectiveRoutine;

  for (const task of allTasks) {
    const normalizedType = typeMap[task.type?.toLowerCase()] || 'lesson';
    let remainingDuration = calculateTotalDuration(task, normalizedType);
    const originalDuration = task.totalDuration || task.calculatedDuration || task.duration || remainingDuration; // Guarda o tempo original para comparar
    let part = 1;
    let willSplit = false; // Flag persistente fora do loop
    let lastDate: string | null = null;

    // Extração de propriedades ricas (Lifting)
    let videos = [...(task.videos || [])];
    let files = [...(task.files || [])];
    let links = [...(task.links || [])];
    let mindMap = [...(task.mindMap || task.summaryConfig?.mindMap || [])];
    let flashcards = [...(task.flashcards || task.reviewConfig?.flashcards || task.flashcardConfig?.cards || [])];
    let questions = [...(task.questions || task.questionsConfig?.questions || [])];

    const isSplittableType = ['material', 'questions', 'lesson', 'questões', 'questoes', 'pdf'].includes(normalizedType);

    // 1. RASTREADOR DE DIVISÃO REAL (willSplit)
    let tempCapacity = currentDayCapacity;
    let tempRemaining = remainingDuration;
    const tempDate = new Date(currentDate);
    let tempDayOfWeek = currentDayOfWeek;

    while (tempRemaining > 0) {
        while (tempCapacity <= 0) {
            tempDate.setDate(tempDate.getDate() + 1);
            tempDayOfWeek = tempDate.getDay();
            tempCapacity = safeRoutine[tempDayOfWeek as keyof StudentRoutine] || 0;
        }

        if (!isSplittableType && tempRemaining > tempCapacity) {
            const maxDayCapacity = safeRoutine[tempDayOfWeek as keyof StudentRoutine] || 0;
            if (tempCapacity < maxDayCapacity && maxDayCapacity > 0) {
                tempCapacity = 0; // Force next day
                continue;
            }
        }

        const allocated = !isSplittableType ? tempRemaining : Math.min(tempRemaining, tempCapacity);
        
        if (allocated < tempRemaining && tempCapacity > 0) {
            willSplit = true;
        }
        
        tempRemaining -= allocated;
        tempCapacity -= allocated;
    }

    // 2. FATIAMENTO ATIVO (Splitting)
    while (remainingDuration > 0) {
      while (currentDayCapacity <= 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDayOfWeek = currentDate.getDay();
        currentDayCapacity = safeRoutine[currentDayOfWeek as keyof StudentRoutine] || 0;
      }

      if (currentDate > limitDate) {
        break;
      }

      // 4. CUIDADO COM INDIVISÍVEIS
      if (!isSplittableType && remainingDuration > currentDayCapacity) {
        const maxDayCapacity = safeRoutine[currentDayOfWeek as keyof StudentRoutine] || 0;
        if (currentDayCapacity < maxDayCapacity && maxDayCapacity > 0) {
            currentDayCapacity = 0; // Zera a capacidade atual e empurra para o próximo dia válido
            continue;
        }
      }

      // Se for aula, tiver vídeo na fila, e o vídeo não couber na capacidade restante do dia (rebarba), força o pulo pro dia seguinte
      if (normalizedType === 'lesson' && videos && videos.length > 0) {
        if (Number(videos[0].duration || 0) > currentDayCapacity) {
          currentDayCapacity = 0;
          continue; // Reinicia o loop para pular o dia
        }
      }

      // 3. SE FOR DIVISÍVEL e currentDayCapacity > 0
      const maxCapacityForPart = !isSplittableType ? remainingDuration : Math.min(remainingDuration, currentDayCapacity);
      let actualAllocatedTime = 0;

      let currentPartVideos: any[] = [];
      let currentPartFiles: any[] = [];
      let currentPartLinks: any[] = [];
      let currentPartMindMap: any[] = [];
      let currentPartFlashcards: any[] = [];
      let currentPartQuestions: any[] = [];

      if (isSplittableType) {
        if (videos && videos.length > 0) {
          while (videos.length > 0) {
            const itemDur = Number(videos[0].duration || 0);
            if (actualAllocatedTime + itemDur <= currentDayCapacity || actualAllocatedTime === 0) {
              actualAllocatedTime += itemDur;
              currentPartVideos.push(videos.shift());
            } else {
              break;
            }
          }
        }

        if (actualAllocatedTime === 0) {
          actualAllocatedTime = maxCapacityForPart;
        }

        // Se for o último pedaço, consome tudo que sobrou
        if (remainingDuration - actualAllocatedTime <= 0) {
          currentPartFiles = [...files];
          currentPartLinks = [...links];
          currentPartMindMap = [...mindMap];
          currentPartFlashcards = [...flashcards];
          currentPartQuestions = [...questions];
          files = []; links = []; mindMap = []; flashcards = []; questions = [];
        } else {
          let timeToFill = actualAllocatedTime;
          while (files.length > 0 && (currentPartFiles.length === 0 || (files[0].duration || 0) <= timeToFill)) {
            const item = files.shift();
            currentPartFiles.push(item);
            timeToFill -= (item.duration || 0);
          }
          while (links.length > 0 && (currentPartLinks.length === 0 || (links[0].duration || 0) <= timeToFill)) {
            const item = links.shift();
            currentPartLinks.push(item);
            timeToFill -= (item.duration || 0);
          }
          while (mindMap.length > 0 && (currentPartMindMap.length === 0 || (mindMap[0].duration || 0) <= timeToFill)) {
            const item = mindMap.shift();
            currentPartMindMap.push(item);
            timeToFill -= (item.duration || 0);
          }
          while (flashcards.length > 0 && (currentPartFlashcards.length === 0 || (flashcards[0].duration || 0) <= timeToFill)) {
            const item = flashcards.shift();
            currentPartFlashcards.push(item);
            timeToFill -= (item.duration || 0);
          }
          while (questions.length > 0 && (currentPartQuestions.length === 0 || (questions[0].duration || 0) <= timeToFill)) {
            const item = questions.shift();
            currentPartQuestions.push(item);
            timeToFill -= (item.duration || 0);
          }
        }
      } else {
        actualAllocatedTime = maxCapacityForPart;
        currentPartVideos = [...videos];
        currentPartFiles = [...files];
        currentPartLinks = [...links];
        currentPartMindMap = [...mindMap];
        currentPartFlashcards = [...flashcards];
        currentPartQuestions = [...questions];
        videos = [];
        files = [];
        links = [];
        mindMap = [];
        flashcards = [];
        questions = [];
      }

      const currentDateString = currentDate.toISOString().split('T')[0];
      if (!dailySchedules.has(currentDateString)) dailySchedules.set(currentDateString, []);
      
      if (lastDate && currentDateString !== lastDate) {
        part++;
      }
      lastDate = currentDateString;

      const existingTask = dailySchedules.get(currentDateString)!.find(t => 
        (t.metaId && task.metaId && t.metaId === task.metaId) ||
        (t.taskId && task.taskId && t.taskId === task.taskId) ||
        (t.id && task.id && t.id === task.id) ||
        (t.title === task.title && t.type === task.type && t.order === task.order)
      );
      
      if (existingTask) {
        existingTask.duration += actualAllocatedTime;
        existingTask.calculatedDuration += actualAllocatedTime;
        
        // Funde os arrays de conteúdo para não perder os itens da PT2 que estão entrando na PT1 no mesmo dia
        if (currentPartVideos && currentPartVideos.length > 0) {
          existingTask.videos = [...(existingTask.videos || []), ...currentPartVideos];
        }
        if (currentPartFiles && currentPartFiles.length > 0) {
          existingTask.files = [...(existingTask.files || []), ...currentPartFiles];
        }
        if (currentPartLinks && currentPartLinks.length > 0) {
          existingTask.links = [...(existingTask.links || []), ...currentPartLinks];
        }
        if (currentPartMindMap && currentPartMindMap.length > 0) {
          existingTask.mindMap = [...(existingTask.mindMap || []), ...currentPartMindMap];
        }
        if (currentPartFlashcards && currentPartFlashcards.length > 0) {
          existingTask.flashcards = [...(existingTask.flashcards || []), ...currentPartFlashcards];
        }
        if (currentPartQuestions && currentPartQuestions.length > 0) {
          existingTask.questions = [...(existingTask.questions || []), ...currentPartQuestions];
        }

        existingTask.totalDuration = originalDuration;
        // A meta só perde o rótulo se atingiu o tempo total E está inteira em um único dia (part === 1)
        if (!isSplittableType || (part === 1 && existingTask.calculatedDuration >= originalDuration)) {
          delete existingTask.part;
          delete existingTask.startingPart;
          existingTask.willSplit = false;
        } else {
          existingTask.part = part > 1 ? part : (existingTask.part || 1);
          existingTask.willSplit = true;
        }
      } else {
        const taskForThisDay: any = {
          ...task,
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          taskId: task.taskId || task.id,
          userId,
          planId,
          date: currentDateString,
          status: 'pending',
          type: normalizedType,
          calculatedDuration: actualAllocatedTime,
          duration: actualAllocatedTime,
          totalDuration: originalDuration,
          order: task.order ?? 999,
          cycleOrder: task.cycleOrder ?? 0,
          disciplineOrder: task.disciplineOrder ?? 0,
          subjectOrder: task.subjectOrder ?? 0,
          taskOrder: task.taskOrder ?? 0,
          color: task.color || null,
          videos: currentPartVideos,
          files: currentPartFiles,
          links: currentPartLinks,
          mindMap: currentPartMindMap,
          flashcards: currentPartFlashcards,
          questions: currentPartQuestions,
          spacedReviewIntervals: task.reviewConfig?.active ? task.reviewConfig.intervals : null
        };

        if (isSplittableType && (part > 1 || actualAllocatedTime < originalDuration)) {
          taskForThisDay.part = part;
          taskForThisDay.willSplit = true;
        } else {
          delete taskForThisDay.part;
          taskForThisDay.willSplit = false;
        }

        dailySchedules.get(currentDateString)!.push(taskForThisDay);
      }

      currentDayCapacity -= actualAllocatedTime;
      remainingDuration -= actualAllocatedTime;
    }

    if (currentDate > limitDate) {
      console.log("Limite da janela deslizante atingido. Pausando agendamento.");
      break;
    }
  }

  // 1. Limpa a grade antiga deste plano no calendário do aluno
  await resetStudentSchedule(userId, planId);

  // 2. Agrupa os eventos gerados por data
  const eventsByDate = Object.fromEntries(dailySchedules);
  
  // 3. Salva no perfil do usuário, agregando em um array 'items'
  const batch = writeBatch(db);

  for (const [dateStr, dayEvents] of Object.entries(eventsByDate)) {
    const docRef = doc(db, `users/${userId}/schedules`, dateStr);
    
    // Busca o dia para não apagar metas de outros planos simultâneos
    const docSnap = await getDoc(docRef);
    let existingItems: any[] = [];
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.items && Array.isArray(data.items)) {
        // Preserva metas que NÃO pertencem ao plano OU que estão concluídas
        existingItems = data.items.filter((item: any) => 
            item.planId !== planId || item.status === 'completed'
        );
      }
    }

    // Mescla as metas e salva
    const cleanedDayEvents = (dayEvents as any[]).map(cleanObject);
    const mergedItems = [...existingItems, ...cleanedDayEvents];
    batch.set(docRef, cleanObject({ date: dateStr, items: mergedItems }), { merge: true });
  }

  await batch.commit();

  // Re-build events array for return
  const finalEvents: ScheduledEvent[] = [];
  for (const dayEvents of Object.values(eventsByDate)) {
    finalEvents.push(...(dayEvents as ScheduledEvent[]));
  }

  return finalEvents;
};

export const getLocalDataString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalISODate = getLocalDataString;

export const getRangeSchedule = async (userId: string, startDate: Date, endDate: Date): Promise<Record<string, ScheduledEvent[]>> => {
    const startStr = getLocalDataString(startDate);
    const endStr = getLocalDataString(endDate);

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const q = query(
        schedulesRef,
        where(documentId(), '>=', startStr),
        where(documentId(), '<=', endStr)
    );

    const snapshot = await getDocs(q);
    const scheduleMap: Record<string, ScheduledEvent[]> = {};

    // Fetch completed metas to ensure sync with Edital
    // We assume the caller might want specific plan sync if data is available, 
    // but usually getRangeSchedule is for a specific user.
    // To be safe and efficient, we'll try to find a planId from the first item if not provided.
    let planIdForSync: string | null = null;

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.items && Array.isArray(data.items)) {
            if (!planIdForSync && data.items.length > 0) {
                planIdForSync = data.items[0].planId;
            }
            scheduleMap[docSnap.id] = data.items;
        }
    });

    if (planIdForSync) {
        const completedIds = await getStudentCompletedMetas(userId, planIdForSync);
        Object.keys(scheduleMap).forEach(date => {
            scheduleMap[date] = scheduleMap[date].map(item => {
                const mId = String(item.metaId || item.taskId || item.id).trim();
                if (completedIds.has(mId)) {
                    return { ...item, status: 'completed' as const, completed: true };
                }
                return item;
            });
        });
    }

    return scheduleMap;
};

/**
 * Reschedule overdue tasks starting from today.
 * @param userId 
 * @param planId 
 * @param routine 
 * @param preserveToday If true, keeps tasks already scheduled for today.
 * @param todayStrOverride Optional override for today's date string (YYYY-MM-DD).
 */
export const rescheduleOverdueTasks = async (
  userId: string, 
  planId: string, 
  routine: StudentRoutine,
  studyProfile: StudyProfile
): Promise<any> => {
  const todayStr = getLocalDataString(new Date());
  const batch = writeBatch(db);

  try {
    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const allPendingGoals: any[] = [];

    // 1. Captura todas as metas em atraso (não concluídas e data < hoje)
    const overdueQuery = query(schedulesRef, where('date', '<', todayStr));
    const overdueSnap = await getDocs(overdueQuery);

    overdueSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const items = data.items || [];
      
      const isOverdueCycleTarget = (item: any) => {
        const type = String(item.type || '').toLowerCase();
        const isFreeStudy = type === 'free_study' || type === 'estudo_livre' || type === 'estudo livre';
        return item.status !== 'completed' && String(item.planId) === String(planId) && !isFreeStudy;
      };
      
      const uncompletedOfThisPlan = items.filter(isOverdueCycleTarget);
      
      if (uncompletedOfThisPlan.length > 0) {
        allPendingGoals.push(...uncompletedOfThisPlan);
        
        const itemsToKeep = items.filter((item: any) => !isOverdueCycleTarget(item));

        if (itemsToKeep.length === 0) {
          batch.delete(docSnap.ref);
        } else {
          batch.update(docSnap.ref, { items: itemsToKeep });
        }
      }
    });

    // 2. Captura os agendamentos de hoje e futuros para este plano
    const futureQuery = query(schedulesRef, where('date', '>=', todayStr));
    const futureSnap = await getDocs(futureQuery);
    
    // Precisamos ordenar cronologicamente para mesclar as partes na ordem correta
    const sortedFutureDocs = futureSnap.docs.sort((a, b) => {
      const dateA = a.data().date || '9999-12-31';
      const dateB = b.data().date || '9999-12-31';
      return dateA.localeCompare(dateB);
    });

    sortedFutureDocs.forEach(docSnap => {
      const data = docSnap.data();
      const currentItems = data.items || [];
      
      // Filtrar itens não concluídos deste plano (excluindo estudo livre para não acumular tempo extra)
      const uncompletedOfThisPlan = currentItems.filter((item: any) => {
        const type = String(item.type || '').toLowerCase();
        const isFreeStudy = type === 'free_study' || type === 'estudo_livre' || type === 'estudo livre';
        return item.status !== 'completed' && String(item.planId) === String(planId) && !isFreeStudy;
      });
      
      if (uncompletedOfThisPlan.length > 0) {
        allPendingGoals.push(...uncompletedOfThisPlan);
      }

      // Filtrar o que vamos manter no documento (ítens concluídos deste plano e ítens de outros planos)
      const keptItems = currentItems.filter((item: any) => 
        !(String(item.planId) === String(planId) && item.status !== 'completed')
      );
      
      // Atualizar o doc se algo precisou ser removido
      if (keptItems.length !== currentItems.length) {
        if (keptItems.length === 0) {
          batch.delete(docSnap.ref);
        } else {
          batch.update(docSnap.ref, { items: keptItems });
        }
      }
    });

    // Executa o batch de limpeza
    await batch.commit();

    // 3. Mesclar as fatias de uma mesma meta de volta para a sua duração restante.
    // Isso evita que a "Parte 2" seja descartada quando a "Parte 1" está em atraso.
    const mergedTasksMap = new Map();
    for (const item of allPendingGoals) {
      // Ignorar simulados e revisões espaçadas aqui (ou mantê-los se o Replanejar também for movê-los)
      // Se não removermos, eles também voltarão pra fila normal de prioridade e serão reagendados
      const baseId = item.metaId || item.taskId || item.id;
      if (mergedTasksMap.has(baseId)) {
        const existing = mergedTasksMap.get(baseId);
        
        // Restaura o tempo total somando a fatia
        existing.calculatedDuration += (item.calculatedDuration || 0);
        existing.duration = (existing.duration || 0) + (item.duration || 0); 
        
        // Mantém a 'part' original mais baixa, já que queremos que inicie daí
        if (!existing.part && item.part) existing.part = item.part;
        
        // Agrupa os materiais da meta original (vídeos, pdfs, etc.) prevenindo duplicidades
        if (item.videos) existing.videos = mergeArrayUniques(existing.videos, item.videos);
        if (item.files) existing.files = mergeArrayUniques(existing.files, item.files);
        if (item.links) existing.links = mergeArrayUniques(existing.links, item.links);
        if (item.mindMap) existing.mindMap = mergeArrayUniques(existing.mindMap, item.mindMap);
        if (item.flashcards) existing.flashcards = mergeArrayUniques(existing.flashcards, item.flashcards);
        if (item.questions) existing.questions = mergeArrayUniques(existing.questions, item.questions);
      } else {
        mergedTasksMap.set(baseId, { ...item });
      }
    }

    const tasksToReschedule = Array.from(mergedTasksMap.values());

    // 4. Re-gera o cronograma passando todas essas tarefas pendentes como prioridade
    // Ele as alocará primeiro (preservando sequência e conteúdo), e preencherá o resto da semana caso sobre tempo 
    await generateSchedule(userId, planId, studyProfile, routine, [], tasksToReschedule);

    return { 
      success: true, 
      message: "Cronograma replanejado com sucesso! Seus atrasos e as sequências de tarefas foram reorganizados." 
    };
  } catch (error) {
    console.error("Erro ao replanejar atrasos:", error);
    throw error;
  }
};


export const mergeGoalExtension = async (userId: string, planId: string, event: ScheduledEvent) => {
    console.log("mergeGoalExtension called for event:", event.id);
    const todayStr = getLocalDataString(new Date());
    const eventDate = event.date || todayStr;
    const batch = writeBatch(db);

    const isSameMetaIntelligent = (item: ScheduledEvent, event: ScheduledEvent) => {
      // Nível 1: Match por IDs Técnicos (Se existirem)
      const idMatch = 
        (item.metaId && event.metaId && item.metaId === event.metaId) ||
        (item.taskId && event.taskId && item.taskId === event.taskId) ||
        (item.id && event.id && item.id === event.id) ||
        (item.taskId && event.metaId && item.taskId === event.metaId) ||
        (item.metaId && event.taskId && item.metaId === event.taskId);

      if (idMatch) return true;

      // Nível 2: Match Nominal (Fallback)
      // Se os IDs técnicos não bateram ou estão ausentes em um dos lados, 
      // confiamos no Título + Tipo + Disciplina (se disponível)
      const titleMatch = item.title === event.title && item.type === event.type;
      const disciplineMatch = !item.disciplineName || !event.disciplineName || item.disciplineName === event.disciplineName;
      
      return titleMatch && disciplineMatch;
    };

    // 1. Find the current event and update its duration
    const todayRef = doc(db, 'users', userId, 'schedules', eventDate);
    const todaySnap = await getDoc(todayRef);
    if (todaySnap.exists()) {
        const items = (todaySnap.data().items as ScheduledEvent[]) || [];
        const targetIndex = items.findIndex(i => isSameMetaIntelligent(i, event));
        if (targetIndex !== -1) {
            // Update duration
            items[targetIndex].duration += event.smartExtension?.minutes || 0;
            // Remove part number to indicate it's merged
            delete items[targetIndex].part;
            batch.update(todayRef, cleanObject({ items }));
        }
    }

    // 2. Find the next part in future schedules and delete it
    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const q = query(schedulesRef, where('date', '>', eventDate));
    const futureSnaps = await getDocs(q);

    // Sort to find the immediate next part
    const sortedDocs = futureSnaps.docs.sort((a, b) => a.data().date.localeCompare(b.data().date));
    
    let foundNextPart = false;
    for (const docSnap of sortedDocs) {
        if (foundNextPart) break;
        const items = (docSnap.data().items as ScheduledEvent[]) || [];
        const nextPartIndex = items.findIndex(i => 
          isSameMetaIntelligent(i, event) && 
          Number(i.part) === (Number(event.part) || 1) + 1
        );
        if (nextPartIndex !== -1) {
            items.splice(nextPartIndex, 1);
            if (items.length === 0) {
                batch.delete(docSnap.ref);
            } else {
                batch.update(docSnap.ref, cleanObject({ items }));
            }
            foundNextPart = true;
        }
    }

    await batch.commit();
    console.log("mergeGoalExtension completed");
};

/**
 * Retrieves all completed meta IDs for a specific plan.
 * Used to calculate progress in the Vertical Edict.
 * UPDATED: Merges results from `schedules` AND `edital_progress`.
 */
export const getStudentCompletedMetas = async (uid: string, planId: string): Promise<Set<string>> => {
  const completedIds = new Set<string>();
  
    // 2. Query Schedule Collection (Standard Completions)
    const schedulesRef = collection(db, 'users', uid, 'schedules');
    const snapshotSchedule = await getDocs(schedulesRef);

    snapshotSchedule.docs.forEach(docSnap => {
      const items = (docSnap.data().items || []) as any[];
      // Filtra apenas os itens deste plano
      const planItems = items.filter(i => i.planId === planId);
      
      planItems.forEach(ev => {
        const mId = String(ev.metaId || ev.taskId || ev.id).trim();
        if (ev.status === 'completed' && mId) {
          completedIds.add(mId);
        }
      });
    });

  // 2. Query Edital Progress Collection (Manual Completions & Overrides)
  const progressRef = collection(db, 'users', uid, 'plans', planId, 'edital_progress');
  const snapshotProgress = await getDocs(progressRef);

  snapshotProgress.docs.forEach(docSnap => {
    const data = docSnap.data();
    const isCompleted = data.completed === true || data.status === 'completed';
    const mId = String(data.metaId || docSnap.id).trim();
    
    if (mId) {
      if (isCompleted) {
        completedIds.add(mId);
      } else {
        // Se explicitamente marcado como não concluído no edital_progress, remove (Sync total)
        completedIds.delete(mId);
      }
    }
  });

  return completedIds;
};

export const fetchFullPlanData = async (planId: string) => {
    try {
        const plan = await getPlanById(planId);
        if (!plan) return null;

        const disciplines = await getDisciplines(planId);
        
        const disciplinesWithTopics = await Promise.all(
            disciplines.map(async (disc) => {
                const topics = await getTopics(planId, disc.id!);
                
                const topicsWithMetas = await Promise.all(
                    topics.map(async (topic) => {
                        const metas = await getMetas(planId, disc.id!, topic.id!);
                        return { ...topic, metas };
                    })
                );
                
                return { ...disc, topics: topicsWithMetas };
            })
        );

        const result = {
            ...plan,
            disciplines: disciplinesWithTopics
        };

        return toPlainObject(result);
    } catch (error) {
        console.error("Error fetching full plan data:", error);
        return null;
    }
};

export const getNextPendingGoals = async (userId: string) => {
    console.log("Restored getNextPendingGoals placeholder");
    return Promise.resolve([]);
}

export const anticipateGoals = async (userId: string) => {
    console.log("Restored anticipateGoals placeholder");
    return Promise.resolve();
}

export const scheduleUserActiveGoal = async (userId: string, goal: any) => {
    console.log("Restored scheduleUserActiveGoal placeholder");
    return Promise.resolve();
}

export const scheduleUserSimulado = async (userId: string, planId: string, simuladoTask: any, date: Date) => {
    const targetDateStr = getLocalDataString(date);
    
    // Fetch user profile and routine
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const userData = userSnap.data();
    
    await scheduleSimuladoManual(
      userId,
      planId,
      simuladoTask,
      targetDateStr,
      userData.routine || [180, 180, 180, 180, 180, 180, 180],
      userData.studyProfile || {}
    );
}

export const anticipateFutureGoals = async (userId: string) => {
    console.log("Restored anticipateFutureGoals placeholder");
    return Promise.resolve();
}

export const resetStudentSchedule = async (userId: string, planId: string, startDate?: Date, wipeAll: boolean = false) => {
  const schedulesRef = collection(db, 'users', userId, 'schedules');
  
  let q;
  if (wipeAll) {
    // Busca TODOS os agendamentos para limpar o histórico e atrasos também
    q = query(schedulesRef);
  } else {
    const startStr = getLocalDataString(startDate || new Date());
    // Apenas agendamentos de hoje/futuro ou a partir da data informada
    q = query(schedulesRef, where(documentId(), '>=', startStr));
  }
  
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  let operationCount = 0;

  snapshot.docs.forEach(document => {
    const data = document.data();
    if (data.items && Array.isArray(data.items)) {
      // REGRA: Remove apenas metas que pertencem a este plano
      // Se wipeAll for true, remove inclusive as concluídas. Se false, preserva as concluídas.
      const remainingItems = data.items.filter((item: any) => {
        const isTarget = item.planId === planId;
        if (!isTarget) return true; // Mantém itens de outros planos
        
        if (wipeAll) return false; // Se wipeAll, remove TUDO deste plano
        return item.status === 'completed'; // Se não for wipeAll, mantém apenas concluídas
      });
      
      if (remainingItems.length === 0) {
        batch.delete(document.ref);
        operationCount++;
      } else if (remainingItems.length < data.items.length) {
        batch.update(document.ref, cleanObject({ items: remainingItems }));
        operationCount++;
      }
    }
  });

  if (operationCount > 0) {
      await batch.commit();
  }
};

export const scheduleSimuladoManual = async (
  userId: string, 
  planId: string, 
  simuladoTask: any, 
  targetDateStr: string, 
  routine: any, 
  userProfile: any
) => {
  const safeRoutine = Array.isArray(routine) 
    ? routine 
    : [0, 1, 2, 3, 4, 5, 6].map(day => (routine as any)?.[day] || 0);

  const schedulesRef = collection(db, 'users', userId, 'schedules');
  const q = query(schedulesRef, where(documentId(), '>=', targetDateStr));
  const snapshot = await getDocs(q);

  const displacedTasks: any[] = [];
  const batch = writeBatch(db);
  const futureDaysMap = new Map<string, any[]>();
  let targetDateItemsToKeep: any[] = [];

  const sortedDocs = [...snapshot.docs].sort((a, b) => a.id.localeCompare(b.id));

  sortedDocs.forEach(docSnap => {
    const date = docSnap.id;
    const data = docSnap.data();
    const items = data.items || [];
    
    const itemsToKeep = items.filter((item: any) => {
      // PRD 5.3.9: Simulado é meta única. Mantemos apenas o que já foi concluído e revisões espaçadas.
      // Metas pendentes de QUALQUER plano serão deslocadas.
      return item.status === 'completed' || item.isSpacedReview;
    });

    const itemsToDisplace = items.filter((item: any) => {
      // Todas as metas pendentes (mesmo de outros planos) saem do dia do simulado, exceto revisões espaçadas
      return item.status === 'pending' && item.id !== simuladoTask.id && !item.isSpacedReview;
    });

    displacedTasks.push(...itemsToDisplace);

    if (date === targetDateStr) {
      targetDateItemsToKeep = itemsToKeep;
    } else {
      futureDaysMap.set(date, itemsToKeep);
    }
  });

  // A ordem global de execução já está preservada porque iteramos os dias em ordem cronológica
  // e os itens dentro de cada dia já estavam na ordem correta.

  const simuladoEvent = cleanObject({
    ...simuladoTask,
    id: simuladoTask.id || Date.now().toString(),
    metaId: simuladoTask.id,
    taskId: simuladoTask.id,
    planId: planId,
    date: targetDateStr,
    type: 'simulado',
    calculatedDuration: simuladoTask.duration || 240,
    status: 'pending'
  });

  targetDateItemsToKeep.push(simuladoEvent);
  
  const targetDocRef = doc(db, 'users', userId, 'schedules', targetDateStr);
  batch.set(targetDocRef, cleanObject({ date: targetDateStr, items: targetDateItemsToKeep }), { merge: true });

  const currentDate = new Date(targetDateStr + 'T00:00:00'); 
  const limitDate = getScheduleLimitDate(currentDate);
  currentDate.setDate(currentDate.getDate() + 1);
  
  let currentDayOfWeek = currentDate.getDay();
  let currentDateStr = currentDate.toISOString().split('T')[0];
  
  const profileLevel = String(userProfile?.level || 'beginner').toLowerCase();
  
  let readingSpeed = 5; // Default beginner / iniciante
  if (profileLevel === 'advanced' || profileLevel === 'avançado' || profileLevel === 'avancado') {
    readingSpeed = 1;
  } else if (profileLevel === 'intermediate' || profileLevel === 'intermediário' || profileLevel === 'intermediario') {
    readingSpeed = 3;
  } else if (profileLevel === 'beginner' || profileLevel === 'iniciante') {
    readingSpeed = 5;
  }

  const semiActiveMaterial = userProfile?.semiActiveMaterial ? 2 : 1;

  const calculateTotalDuration = (task: any): number => {
    let duration = Number(task.calculatedDuration) || Number(task.duration);
    const type = task.type?.toLowerCase()?.trim() || 'lesson';

    if (!duration || duration === 30 || type === 'material' || type === 'pdf') {
      if (['law', 'lei_seca', 'lei seca'].includes(type)) {
        const pagesCount = Number(task.pages || task.lawConfig?.pages || task.pageCount) || 1; 
        const multiplierValue = Number(task.multiplier || task.speed || task.lawConfig?.multiplier || task.lawConfig?.speedFactor) || 1; 
        duration = (pagesCount * 2) * multiplierValue;
        if (duration <= 0) duration = 2;
      } else if (type === 'material' || type === 'pdf') {
        const pages = Number(task.pageCount) || Number(task.pages) || 0;
        duration = pages * readingSpeed * semiActiveMaterial || duration || 30;
      } else {
        duration = duration || 30;
      }
    }
    return duration;
  };

  for (const task of displacedTasks) {
    let remainingDuration = calculateTotalDuration(task);
    let part = task.part || 1;
    
    // Simplistic bin packing for displaced tasks
    while (remainingDuration > 0) {
      if (currentDate > limitDate) break;

      let dayCapacity = safeRoutine[currentDayOfWeek] || 0;
      let existingItems = futureDaysMap.get(currentDateStr) || [];
      let usedCapacity = existingItems.reduce((acc: number, item: any) => acc + (Number(item.calculatedDuration) || Number(item.duration) || 0), 0);
      let availableCapacity = Math.max(0, dayCapacity - usedCapacity);

      while (availableCapacity <= 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDateStr = currentDate.toISOString().split('T')[0];
        currentDayOfWeek = currentDate.getDay();
        dayCapacity = safeRoutine[currentDayOfWeek] || 0;
        existingItems = futureDaysMap.get(currentDateStr) || [];
        usedCapacity = existingItems.reduce((acc: number, item: any) => acc + (Number(item.calculatedDuration) || Number(item.duration) || 0), 0);
        availableCapacity = Math.max(0, dayCapacity - usedCapacity);
      }

      let allocatedTime = remainingDuration;
      let isSplit = false;

      const type = task.type?.toLowerCase()?.trim() || 'lesson';
      const isSplittableType = ['material', 'questions', 'lesson', 'questões', 'questoes', 'pdf'].includes(type);

      if (!isSplittableType) {
        if (allocatedTime > availableCapacity) {
          if (availableCapacity === dayCapacity && dayCapacity > 0) {
            allocatedTime = remainingDuration;
          } else {
            availableCapacity = 0;
            continue;
          }
        }
      } else {
        if (allocatedTime > availableCapacity) {
          allocatedTime = availableCapacity;
          isSplit = true;
        }
      }

      const scheduledTask: any = {
        ...task,
        id: isSplit ? Date.now().toString() + Math.random().toString(36).substring(2, 9) : task.id,
        date: currentDateStr,
        calculatedDuration: allocatedTime,
        isSplit: isSplit || task.isSplit
      };

      if (isSplittableType && (isSplit || task.part)) {
        scheduledTask.part = isSplit ? part : task.part;
      } else {
        delete scheduledTask.part;
      }

      const existingInDay = existingItems.find((t: any) => areSameMeta(t, scheduledTask));
      
      if (existingInDay) {
        existingInDay.calculatedDuration += allocatedTime;
        existingInDay.duration = existingInDay.calculatedDuration;
        
        if (task.videos) existingInDay.videos = [...(existingInDay.videos || []), ...task.videos];
        if (task.files) existingInDay.files = [...(existingInDay.files || []), ...task.files];
        if (task.links) existingInDay.links = [...(existingInDay.links || []), ...task.links];
        
        delete existingInDay.part;
        existingInDay.isSplit = false;
      } else {
        existingItems.push(scheduledTask);
      }
      
      futureDaysMap.set(currentDateStr, existingItems);

      remainingDuration -= allocatedTime;
      if (isSplit) part++;
    }
  }

  for (const [dateStr, items] of futureDaysMap.entries()) {
    const docRef = doc(db, 'users', userId, 'schedules', dateStr);
    if (items.length === 0) {
      batch.delete(docRef);
    } else {
      batch.set(docRef, cleanObject({ items }));
    }
  }

  await batch.commit();
};

export const anticipateAndShiftGoals = async (
  userId: string, planId: string, routine: any, availableMinutesToday: number, todayStr: string
) => {
  const safeRoutine = Array.isArray(routine) ? routine : [0, 1, 2, 3, 4, 5, 6].map(day => (routine as any)?.[day] || 0);
  const schedulesRef = collection(db, `users/${userId}/schedules`);
  const snapshot = await getDocs(schedulesRef);
  const batch = writeBatch(db);

  const todayDocRef = doc(db, `users/${userId}/schedules`, todayStr);
  let todayItems: any[] = [];

  // 1. Coletar dados futuros e de hoje
  const sortedDocs = [...snapshot.docs].sort((a, b) => a.id.localeCompare(b.id));
  const allFutureTasks: any[] = [];

  sortedDocs.forEach(document => {
    const dateStr = document.id;
    const data = document.data();
    if (!data.items) return;

    if (dateStr === todayStr) {
      todayItems = data.items;
    } else if (dateStr > todayStr) {
      // Adiciona a data original em cada meta para poder restaurar depois se for fixa
      const itemsWithDate = data.items.map((i: any) => ({ ...i, date: dateStr }));
      allFutureTasks.push(...itemsWithDate);
      batch.delete(document.ref); // Apaga o dia antigo para reconstruir
    }
  });

  // Metas que serão redistribuídas (removendo simulados e revisões espaçadas)
  let tasksToShift = allFutureTasks.filter(t => t.planId === planId && t.status === 'pending' && !t.isSpacedReview && t.type !== 'simulado' && t.type !== 'SIMULADO');

  // Metas que ficarão fixadas onde estão (incluindo metas de outros planos)
  const fixedTasks = allFutureTasks.filter(t => t.planId !== planId || t.status !== 'pending' || t.isSpacedReview || t.type === 'simulado' || t.type === 'SIMULADO');

  // Reagrupar metas fatiadas (mesmo taskId) para reconstruir a duração total antes de redistribuir
  const mergedTasksMap = new Map();
  for (const item of tasksToShift) {
    const baseId = item.metaId || item.taskId || item.id;
    if (mergedTasksMap.has(baseId)) {
      const existing = mergedTasksMap.get(baseId);
      
      // Restaura o tempo total
      existing.calculatedDuration += item.calculatedDuration;
      existing.duration = (existing.duration || 0) + (item.duration || 0); 
      if (!existing.part && item.part) existing.part = item.part;
      
      // Restaura o conteúdo concatenando as listas, prevenindo duplicidades
      if (item.videos) existing.videos = mergeArrayUniques(existing.videos, item.videos);
      if (item.files) existing.files = mergeArrayUniques(existing.files, item.files);
      if (item.links) existing.links = mergeArrayUniques(existing.links, item.links);
      if (item.mindMap) existing.mindMap = mergeArrayUniques(existing.mindMap, item.mindMap);
      if (item.flashcards) existing.flashcards = mergeArrayUniques(existing.flashcards, item.flashcards);
      if (item.questions) existing.questions = mergeArrayUniques(existing.questions, item.questions);
    } else {
      mergedTasksMap.set(baseId, { ...item });
    }
  }
  tasksToShift = Array.from(mergedTasksMap.values());
  
  if (tasksToShift.length === 0) return { success: false, message: 'Sem metas futuras' };

  // 2. Tentar encaixar no dia de HOJE com Fatiamento Inteligente
  let remainingToday = availableMinutesToday;
  const tasksForToday: any[] = [];
  let hasAnticipatedSomething = false;
  
  while (tasksToShift.length > 0 && remainingToday > 0) {
    const task = tasksToShift[0];
    const normalizedType = task.type?.toLowerCase();
    const isSplittableType = ['material', 'questions', 'lesson', 'questões', 'questoes', 'pdf'].includes(normalizedType);

    if (task.calculatedDuration <= remainingToday) {
      // Cabe inteira, retira da fila e agenda para hoje
      tasksToShift.shift();
      task.date = todayStr;
      
      // Limpeza rigorosa das tags de parte para metas que cabem inteiras
      if (!isSplittableType || task.calculatedDuration >= (task.totalDuration || task.calculatedDuration)) {
        delete task.part;
        delete task.startingPart;
        task.willSplit = false;
        task.isSplitContinuity = false;
      } else {
        task.part = task.part || 1;
        task.willSplit = true;
      }
      
      // Verifica se já existe uma parte dessa mesma meta no dia de hoje
      const existingInToday = tasksForToday.find(t => areSameMeta(t, task) && t.status === 'pending') || todayItems.find(t => areSameMeta(t, task) && t.status === 'pending');
      
      if (existingInToday) {
        // Unifica as partes
        existingInToday.calculatedDuration += task.calculatedDuration;
        existingInToday.duration = existingInToday.calculatedDuration;
        
        if (task.videos) existingInToday.videos = [...(existingInToday.videos || []), ...task.videos];
        if (task.files) existingInToday.files = [...(existingInToday.files || []), ...task.files];
        if (task.links) existingInToday.links = [...(existingInToday.links || []), ...task.links];
        
        if (!isSplittableType || existingInToday.calculatedDuration >= (existingInToday.totalDuration || existingInToday.calculatedDuration)) {
          delete existingInToday.part;
          existingInToday.isSplit = false;
        } else {
          existingInToday.part = existingInToday.part || 1;
          existingInToday.isSplit = true;
        }
        hasAnticipatedSomething = true;
      } else {
        tasksForToday.push(task);
        hasAnticipatedSomething = true;
      }
      
      remainingToday -= task.calculatedDuration;
    } else if (isSplittableType) {
      // Não cabe inteira, mas é divisível. Vamos fatiar para HOJE usando "Conteúdo-First"
      let actualAllocatedTime = 0;
      const currentPartVideos: any[] = [];
      
      if (normalizedType === 'lesson' && task.videos && task.videos.length > 0) {
        while (task.videos.length > 0) {
          const itemDur = Number(task.videos[0].duration || 0);
          if (actualAllocatedTime + itemDur <= remainingToday || actualAllocatedTime === 0) {
            actualAllocatedTime += itemDur;
            currentPartVideos.push(task.videos.shift());
          } else {
            break;
          }
        }
      } else {
        // Fallback para pdf/questões contínuas (Math.min)
        actualAllocatedTime = remainingToday; 
      }

      // Se a rebarba de tempo de hoje for muito pequena para o próximo vídeo, aborta o preenchimento de hoje
      if (actualAllocatedTime === 0) {
        break; 
      }

      // Cria a parte de hoje
      const taskForToday = { 
        ...task, 
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        metaId: task.metaId || task.taskId || task.id,
        taskId: task.taskId || task.metaId || task.id,
        date: todayStr, 
        totalDuration: task.totalDuration || task.calculatedDuration || task.duration,
        duration: actualAllocatedTime, 
        calculatedDuration: actualAllocatedTime, 
        part: task.part || 1,
        willSplit: true,
        isSplit: true,
        planId: task.planId,
        videos: currentPartVideos.length > 0 ? currentPartVideos : (normalizedType === 'lesson' ? [] : task.videos)
      };
      
      // Verifica se já existe uma parte dessa mesma meta no dia de hoje
      const existingInToday = tasksForToday.find(t => areSameMeta(t, taskForToday) && t.status === 'pending') || todayItems.find(t => areSameMeta(t, taskForToday) && t.status === 'pending');
      
      if (existingInToday) {
        // Unifica as partes
        existingInToday.calculatedDuration += taskForToday.calculatedDuration;
        existingInToday.duration = existingInToday.calculatedDuration;
        
        if (taskForToday.videos) existingInToday.videos = [...(existingInToday.videos || []), ...taskForToday.videos];
        if (taskForToday.files) existingInToday.files = [...(existingInToday.files || []), ...taskForToday.files];
        if (taskForToday.links) existingInToday.links = [...(existingInToday.links || []), ...taskForToday.links];
        hasAnticipatedSomething = true;
      } else {
        tasksForToday.push(taskForToday);
        hasAnticipatedSomething = true;
      }
      
      remainingToday -= actualAllocatedTime;
      
      // Atualiza a meta original (que continua na fila [0] para o empuxo futuro)
      task.calculatedDuration -= actualAllocatedTime;
      task.duration = task.calculatedDuration;
      task.startingPart = (task.part || 1) + 1;
      task.isSplitContinuity = true;
      
    } else {
      // Não cabe inteira e NÃO é divisível (ex: Resumo). Acabou o espaço de hoje.
      break; 
    }
  }

  if (!hasAnticipatedSomething) return { success: false, message: 'Nenhuma meta futura cabe no tempo livre de hoje.' };

  // Atualiza o dia de hoje
  const newTodayItems = [...todayItems, ...tasksForToday];
  batch.set(todayDocRef, cleanObject({ date: todayStr, items: newTodayItems }), { merge: true });

  // 3. Efeito Empuxo (Reagendar o resto para o futuro)
  const currentDate = new Date(todayStr + 'T00:00:00');
  const limitDate = getScheduleLimitDate(currentDate);
  currentDate.setDate(currentDate.getDate() + 1);
  let currentDayCapacity = safeRoutine[currentDate.getDay()] || 0;
  const newFutureSchedules = new Map<string, any[]>();

  // Devolve as metas fixas exatamente para os dias em que já estavam agendadas
  for (const fixedTask of fixedTasks) {
    const originalDate = fixedTask.date; 
    if (new Date(originalDate + 'T12:00:00') > limitDate) continue; // Respect limit

    if (!newFutureSchedules.has(originalDate)) {
      newFutureSchedules.set(originalDate, []);
    }
    newFutureSchedules.get(originalDate)!.push(fixedTask);
  }

  for (const task of tasksToShift) {
    if (currentDate > limitDate) break;

    const normalizedType = task.type || 'lesson';
    
    let currentPart = task.startingPart || task.part || 1;
    
    // Limpa o lixo de estados anteriores (Sanitização)
    delete task.part;
    delete task.startingPart;
    delete task.willSplit;
    delete task.isSplitContinuity;

    let remainingDuration = task.calculatedDuration || task.duration;
    if (!remainingDuration || remainingDuration === 30) {
      const type = task.type?.toLowerCase() || 'lesson';
      if (['law', 'lei_seca', 'lei seca'].includes(type)) {
        const pagesCount = Number(task.pages || task.lawConfig?.pages || task.pageCount) || 1; 
        const multiplierValue = Number(task.multiplier || task.speed || task.lawConfig?.multiplier || task.lawConfig?.speedFactor) || 1; 
        remainingDuration = (pagesCount * 2) * multiplierValue;
        if (remainingDuration <= 0) remainingDuration = 2;
      } else {
        remainingDuration = remainingDuration || 30;
      }
    }
    const originalTotalDuration = task.totalDuration || task.calculatedDuration || task.duration || remainingDuration; // Guarda o tempo original para comparar na fusão
    let willSplit = false;
    let lastAllocatedDate: string | null = null;

    // Extração de propriedades ricas (Lifting)
    let videos = [...(task.videos || [])];
    let files = [...(task.files || [])];
    let links = [...(task.links || [])];
    let mindMap = [...(task.mindMap || task.summaryConfig?.mindMap || [])];
    let flashcards = [...(task.flashcards || task.reviewConfig?.flashcards || task.flashcardConfig?.cards || [])];
    let questions = [...(task.questions || task.questionsConfig?.questions || [])];

    const isSplittableType = ['material', 'questions', 'lesson', 'questões', 'questoes', 'pdf'].includes(normalizedType?.toLowerCase());

    // 1. RASTREADOR DE DIVISÃO REAL (willSplit)
    let tempCapacity = currentDayCapacity;
    let tempRemaining = remainingDuration;
    const tempDate = new Date(currentDate);
    let tempDayOfWeek = tempDate.getDay();

    while (tempRemaining > 0) {
        let dStr = tempDate.toISOString().split('T')[0];
        let hasSimulado = newFutureSchedules.get(dStr)?.some(i => i.type?.toLowerCase() === 'simulado');

        while (tempCapacity <= 0 || hasSimulado) {
            tempDate.setDate(tempDate.getDate() + 1);
            tempDayOfWeek = tempDate.getDay();
            tempCapacity = safeRoutine[tempDayOfWeek as keyof StudentRoutine] || 0;
            dStr = tempDate.toISOString().split('T')[0];
            hasSimulado = newFutureSchedules.get(dStr)?.some(i => i.type?.toLowerCase() === 'simulado');
        }

        if (!isSplittableType && tempRemaining > tempCapacity) {
            const maxDayCapacity = safeRoutine[tempDayOfWeek as keyof StudentRoutine] || 0;
            if (tempCapacity < maxDayCapacity && maxDayCapacity > 0) {
                tempCapacity = 0; // Force next day
                continue;
            }
        }

        const allocated = !isSplittableType ? tempRemaining : Math.min(tempRemaining, tempCapacity);
        
        if (allocated < tempRemaining && tempCapacity > 0) {
            willSplit = true;
        }
        
        tempRemaining -= allocated;
        tempCapacity -= allocated;
    }

    // 2. FATIAMENTO ATIVO (Splitting)
    while (remainingDuration > 0) {
      let dStr = currentDate.toISOString().split('T')[0];
      let hasSimulado = newFutureSchedules.get(dStr)?.some(i => i.type?.toLowerCase() === 'simulado');

      while (currentDayCapacity <= 0 || hasSimulado) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDayCapacity = safeRoutine[currentDate.getDay()] || 0;
        dStr = currentDate.toISOString().split('T')[0];
        hasSimulado = newFutureSchedules.get(dStr)?.some(i => i.type?.toLowerCase() === 'simulado');
      }

      // 4. CUIDADO COM INDIVISÍVEIS
      if (!isSplittableType && remainingDuration > currentDayCapacity) {
        const maxDayCapacity = safeRoutine[currentDate.getDay()] || 0;
        if (currentDayCapacity < maxDayCapacity && maxDayCapacity > 0) {
            currentDayCapacity = 0; // Zera a capacidade atual e empurra para o próximo dia válido
            continue;
        }
      }

      // Se for aula, tiver vídeo na fila, e o vídeo não couber na capacidade restante do dia (rebarba), força o pulo pro dia seguinte
      if (normalizedType === 'lesson' && videos && videos.length > 0) {
        if (Number(videos[0].duration || 0) > currentDayCapacity) {
          currentDayCapacity = 0;
          continue; // Reinicia o loop para pular o dia
        }
      }

      // 3. SE FOR DIVISÍVEL e currentDayCapacity > 0
      const maxCapacityForPart = !isSplittableType ? remainingDuration : Math.min(remainingDuration, currentDayCapacity);
      let actualAllocatedTime = 0;

      let currentPartVideos: any[] = [];
      let currentPartFiles: any[] = [];
      let currentPartLinks: any[] = [];
      let currentPartMindMap: any[] = [];
      let currentPartFlashcards: any[] = [];
      let currentPartQuestions: any[] = [];

      if (isSplittableType) {
        if (videos && videos.length > 0) {
          while (videos.length > 0) {
            const itemDur = Number(videos[0].duration || 0);
            if (actualAllocatedTime + itemDur <= currentDayCapacity || actualAllocatedTime === 0) {
              actualAllocatedTime += itemDur;
              currentPartVideos.push(videos.shift());
            } else {
              break;
            }
          }
        }

        if (actualAllocatedTime === 0) {
          actualAllocatedTime = maxCapacityForPart;
        }

        // Se for o último pedaço, consome tudo que sobrou
        if (remainingDuration - actualAllocatedTime <= 0) {
          currentPartFiles = [...files];
          currentPartLinks = [...links];
          currentPartMindMap = [...mindMap];
          currentPartFlashcards = [...flashcards];
          currentPartQuestions = [...questions];
          files = []; links = []; mindMap = []; flashcards = []; questions = [];
        } else {
          let timeToFill = actualAllocatedTime;
          while (files.length > 0 && (currentPartFiles.length === 0 || (files[0].duration || 0) <= timeToFill)) {
            const item = files.shift();
            currentPartFiles.push(item);
            timeToFill -= (item.duration || 0);
          }
          while (links.length > 0 && (currentPartLinks.length === 0 || (links[0].duration || 0) <= timeToFill)) {
            const item = links.shift();
            currentPartLinks.push(item);
            timeToFill -= (item.duration || 0);
          }
          while (mindMap.length > 0 && (currentPartMindMap.length === 0 || (mindMap[0].duration || 0) <= timeToFill)) {
            const item = mindMap.shift();
            currentPartMindMap.push(item);
            timeToFill -= (item.duration || 0);
          }
          while (flashcards.length > 0 && (currentPartFlashcards.length === 0 || (flashcards[0].duration || 0) <= timeToFill)) {
            const item = flashcards.shift();
            currentPartFlashcards.push(item);
            timeToFill -= (item.duration || 0);
          }
          while (questions.length > 0 && (currentPartQuestions.length === 0 || (questions[0].duration || 0) <= timeToFill)) {
            const item = questions.shift();
            currentPartQuestions.push(item);
            timeToFill -= (item.duration || 0);
          }
        }
      } else {
        actualAllocatedTime = maxCapacityForPart;
        currentPartVideos = [...videos];
        currentPartFiles = [...files];
        currentPartLinks = [...links];
        currentPartMindMap = [...mindMap];
        currentPartFlashcards = [...flashcards];
        currentPartQuestions = [...questions];
        videos = [];
        files = [];
        links = [];
        mindMap = [];
        flashcards = [];
        questions = [];
      }

      const currentDateString = currentDate.toISOString().split('T')[0];
      if (!newFutureSchedules.has(currentDateString)) newFutureSchedules.set(currentDateString, []);
      
      if (lastAllocatedDate && currentDateString !== lastAllocatedDate) {
        currentPart++;
        if (currentPart > 1) willSplit = true;
      }
      lastAllocatedDate = currentDateString;

      const existingTask = newFutureSchedules.get(currentDateString)!.find(t => 
        (t.metaId && task.metaId && t.metaId === task.metaId) ||
        (t.taskId && task.taskId && t.taskId === task.taskId) ||
        (t.id && task.id && t.id === task.id) ||
        (t.title === task.title && t.type?.toLowerCase() === task.type?.toLowerCase()) // Fallback Nominal
      );
      
      if (existingTask) {
        existingTask.duration += actualAllocatedTime;
        existingTask.calculatedDuration += actualAllocatedTime;
        
        // Funde os arrays de conteúdo para não perder os itens da PT2 que estão entrando na PT1 no mesmo dia
        if (currentPartVideos && currentPartVideos.length > 0) {
          existingTask.videos = [...(existingTask.videos || []), ...currentPartVideos];
        }
        if (currentPartFiles && currentPartFiles.length > 0) {
          existingTask.files = [...(existingTask.files || []), ...currentPartFiles];
        }
        if (currentPartLinks && currentPartLinks.length > 0) {
          existingTask.links = [...(existingTask.links || []), ...currentPartLinks];
        }
        if (currentPartMindMap && currentPartMindMap.length > 0) {
          existingTask.mindMap = [...(existingTask.mindMap || []), ...currentPartMindMap];
        }
        if (currentPartFlashcards && currentPartFlashcards.length > 0) {
          existingTask.flashcards = [...(existingTask.flashcards || []), ...currentPartFlashcards];
        }
        if (currentPartQuestions && currentPartQuestions.length > 0) {
          existingTask.questions = [...(existingTask.questions || []), ...currentPartQuestions];
        }

        existingTask.totalDuration = originalTotalDuration;
        // A meta só perde o rótulo se atingiu o tempo total E está inteira em um único dia (currentPart === 1)
        if (!isSplittableType || (currentPart === 1 && existingTask.calculatedDuration >= originalTotalDuration)) {
          delete existingTask.part;
          delete existingTask.startingPart;
          existingTask.willSplit = false;
          existingTask.isSplitContinuity = false;
        } else {
          // Se não atingiu o total, ou se atingiu mas é a parte 2 em diante, ela mantém o rótulo
          existingTask.part = currentPart > 1 ? currentPart : (existingTask.part || 1);
          existingTask.willSplit = true;
        }
      } else {
        const taskForThisDay: any = {
          ...task,
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          taskId: task.taskId || task.id,
          metaId: task.metaId || task.id,
          date: currentDateString,
          planId: planId,
          cycleId: task.cycleId,
          totalDuration: originalTotalDuration,
          calculatedDuration: actualAllocatedTime,
          duration: actualAllocatedTime,
          videos: currentPartVideos,
          files: currentPartFiles,
          links: currentPartLinks,
          mindMap: currentPartMindMap,
          flashcards: currentPartFlashcards,
          questions: currentPartQuestions
        };

        if (isSplittableType && (currentPart > 1 || actualAllocatedTime < originalTotalDuration)) {
          taskForThisDay.part = currentPart;
          taskForThisDay.willSplit = true;
        } else {
          delete taskForThisDay.part;
          taskForThisDay.willSplit = false;
        }

        newFutureSchedules.get(currentDateString)!.push(taskForThisDay);
      }

      currentDayCapacity -= actualAllocatedTime;
      remainingDuration -= actualAllocatedTime;
    }
  }

  for (const [dStr, items] of newFutureSchedules.entries()) {
    batch.set(doc(db, `users/${userId}/schedules`, dStr), cleanObject({ date: dStr, items }), { merge: true });
  }

  await batch.commit();
  return { success: true, anticipatedCount: tasksForToday.length };
};

export const computeSimuladoPrerequisites = (fullPlan: any): Record<string, string[]> => {
  const sortedCycles = (fullPlan.cycles || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  const sortedDisciplines = (fullPlan.disciplines || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  const sortedTopics: any[] = [];
  const sortedTasks: any[] = [];

  for (const disc of sortedDisciplines) {
    const topics = (disc.topics || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    for (const topic of topics) {
      const topicData = { id: topic.id, subjectId: disc.id, ...topic };
      sortedTopics.push(topicData);
      
      const metas = (topic.metas || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      for (const meta of metas) {
        sortedTasks.push({ 
          id: meta.id, 
          topicId: topic.id, 
          subjectId: disc.id, 
          ...meta 
        });
      }
    }
  }

  const logicalSubjectsBySubj = buildLogicalSubjects(sortedTopics, sortedTasks);
  const isRotative = fullPlan.cycleSystem === 'rotative';

  const expandCycleItems = (items: any[]) => {
    const expanded: any[] = [];
    for (const item of items) {
      if (item.type === 'discipline') {
        expanded.push({ type: 'discipline', id: item.referenceId, topicsPerTurn: item.topicsPerTurn });
      } else if (item.type === 'folder') {
        const folderDisciplines = sortedDisciplines.filter((d: any) => d.folderId === item.referenceId);
        folderDisciplines.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        folderDisciplines.forEach((d: any) => {
          expanded.push({ type: 'discipline', id: d.id, topicsPerTurn: item.topicsPerTurn });
        });
      } else if (item.type === 'simulado') {
        expanded.push({ type: 'simulado', id: item.id, referenceId: item.referenceId });
      }
    }
    return expanded;
  };

  const flatQueue = generateExecutionQueue(sortedCycles, logicalSubjectsBySubj, isRotative, sortedDisciplines);
  const prerequisites: Record<string, string[]> = {};

  for (const cycle of sortedCycles) {
    // Get all tasks assigned to this cycle
    const cycleTasks = flatQueue.filter(t => t.cycleId === cycle.id).map(t => t.id);
    
    const expandedItems = expandCycleItems(cycle.items || []);
    for (const item of expandedItems) {
      if (item.type === 'simulado' && item.id) {
        prerequisites[item.id] = cycleTasks;
      }
    }
  }

  return prerequisites;
};
