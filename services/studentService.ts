
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, Timestamp, increment, orderBy, limit, setDoc, documentId, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const cleanObject = (obj: Record<string, any> | any[] | null | undefined): any => {
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
import { Student } from './userService';
import { Plan } from './planService';
import { Meta } from './metaService';
import { ScheduledEvent, generateSpacedReviews, computeSimuladoPrerequisites, fetchFullPlanData, getStudentCompletedMetas, StudentRoutine, StudyProfile } from './scheduleService';

// === FUNÇÃO AUXILIAR DE DATA LOCAL (CORREÇÃO DE FUSO HORÁRIO) ===
// Garante que a data YYYY-MM-DD seja sempre referente ao relógio do usuário, não UTC.
export const getLocalISODate = (date: Date = new Date()): string => {
  const offset = date.getTimezoneOffset() * 60000; // Deslocamento em milissegundos
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().split('T')[0];
};

export interface StudentPlan extends Plan {
  accessId: string;
  expiryDate: string | Timestamp | null;
  isScholarship?: boolean;
}

// === OPERATIONS ===

/**
 * Registra os minutos estudados na sessão.
 * Atualiza simultaneamente o documento do Usuário com lifetime e estatísticas do plano.
 */
export const registerStudySession = async (uid: string, planId: string, minutes: number, type?: string) => {
  if (minutes <= 0) return;

  try {
    const userRef = doc(db, 'users', uid);
    
    // Atualiza Lifetime e Plan Stats atomicamente
    await updateDoc(userRef, {
      lifetimeMinutes: increment(minutes),
      [`planStats.${planId}.minutes`]: increment(minutes),
      // Campos solicitados para rastreamento de tempo
      totalStudyTimeToday: increment(minutes),
      totalStudyTimeWeek: increment(minutes)
    });

    console.log(`[Timer] Registrado: +${minutes.toFixed(2)} min para o plano ${planId}`);
  } catch (error) {
    console.error("Erro ao salvar tempo de estudo:", error);
  }
};

/**
 * Atualiza o estado persistente do cronômetro ativo do aluno no Firestore.
 * Usado para garantir que o temporizador possa ser recuperado após recarregar a página.
 */
export const updateActiveTimer = async (uid: string, timerState: any) => {
  if (!uid) return;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      activeTimer: timerState ? cleanObject(timerState) : null
    });
  } catch (error) {
    console.error("Erro ao atualizar temporizador ativo:", error);
  }
};

/**
 * Atualiza o tempo gravado em uma meta específica (ScheduledEvent) dentro do documento do dia.
 * Isso permite calcular corretamente o "Tempo Restante" do dia.
 */
export const updateGoalRecordedTime = async (uid: string, date: string, goalId: string, minutesToAdd: number) => {
  try {
    const scheduleRef = doc(db, 'users', uid, 'schedules', date);
    const scheduleSnap = await getDoc(scheduleRef);

    if (scheduleSnap.exists()) {
      const data = scheduleSnap.data();
      const items = data.items || [];

      // Encontra o índice da meta
      const goalIndex = items.findIndex((i: any, index: number) => {
        const iId = i.id || `${date}-${i.metaId || 'nometa'}-${i.part || 1}-${index}`;
        return iId === goalId;
      });

      if (goalIndex !== -1) {
        // Atualiza o tempo gravado (soma ao que já existe)
        const currentRecorded = items[goalIndex].recordedMinutes || 0;
        items[goalIndex].recordedMinutes = currentRecorded + minutesToAdd;

        // Salva de volta no banco
        await updateDoc(scheduleRef, cleanObject({ items }));
        console.log(`[Goal Timer] Atualizado: +${minutesToAdd.toFixed(2)} min na meta ${goalId} do dia ${date}`);
      } else if (goalId === 'free_study' || goalId.includes('free') || goalId.includes('study')) {
        // Fallback para estudo livre se não achar pelo ID exato
        const freeStudyIndex = items.findIndex((i: any) => i.id === 'free_study' || i.type === 'free_study' || i.id === goalId);
        
        if (freeStudyIndex !== -1) {
          items[freeStudyIndex].recordedMinutes = (items[freeStudyIndex].recordedMinutes || 0) + minutesToAdd;
        } else {
          // Cria o item genérico se não existir
          items.push({
            id: goalId || 'free_study',
            type: 'free_study',
            title: 'Estudo Livre',
            recordedMinutes: minutesToAdd,
            planId: items[0]?.planId || '',
            status: 'pending', // CORREÇÃO: Deve iniciar como pending, não completed
            discipline: 'Geral',
            topic: 'Estudo Livre',
            disciplineId: 'free_study',
            topicId: 'free_study'
          });
        }
        await updateDoc(scheduleRef, cleanObject({ items }));
        console.log(`[Goal Timer] Fallback Estudo Livre: +${minutesToAdd.toFixed(2)} min no dia ${date}`);
      }
    }
  } catch (error) {
    console.error("Erro ao atualizar tempo da meta:", error);
  }
};

/**
 * Alterna ou Define o status de conclusão de uma meta.
 * @param targetStatus Se fornecido, força este status. Se não, alterna o atual.
 */
export const toggleGoalStatus = async (
  uid: string, 
  planId: string, 
  eventId: string, 
  currentStatus: 'pending' | 'completed',
  isManual: boolean = false,
  targetStatus?: 'pending' | 'completed', // NEW: Permite forçar status (ex: Timer finish)
  goalData?: Meta // NEW: Permite passar os dados da meta para trigger de revisão se não estiver no calendário
) => {
  // CORREÇÃO: Se targetStatus for fornecido, usa ele. Senão, alterna o currentStatus.
  const newStatus = targetStatus ? targetStatus : (currentStatus === 'pending' ? 'completed' : 'pending');
  
  // CORREÇÃO FUSO HORÁRIO
  const todayStr = getLocalISODate(new Date());

  // Helper to update and trigger review
  const processUpdate = async (docRef: any, items: ScheduledEvent[], index: number) => {
      // Se já estiver no status desejado, não faz nada (idempotência)
      if (items[index].status === newStatus) return;

      items[index].status = newStatus;
      
      // Se concluiu, garante que recordedMinutes existe (importante para cálculos de antecipação)
      if (newStatus === 'completed' && typeof items[index].recordedMinutes !== 'number') {
         items[index].recordedMinutes = 0;
      }

      await updateDoc(docRef, cleanObject({ items }));

      // Extrai o ID canônico ignorando formatações do calendário
      const event = items[index];
      const canonicalId = String(event.taskId || event.metaId || event.id).trim();

      // Persiste a conclusão na fonte da verdade do edital (Sempre atualiza, seja 'completed' ou 'pending')
      const progressRef = doc(db, `users/${uid}/plans/${planId}/edital_progress`, canonicalId);
      await setDoc(progressRef, cleanObject({ 
        metaId: canonicalId,
        completed: newStatus === 'completed', 
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
        manuallyCompleted: isManual
      }), { merge: true });

      // Trigger Spaced Review Logic only when completing
      if (newStatus === 'completed') {
          const intervals = event.spacedReviewIntervals || (event.reviewConfig?.active ? event.reviewConfig.intervals : null);
          
          if (intervals && !event.isSpacedReview) {
              await generateSpacedReviews(uid, planId, { ...event, spacedReviewIntervals: intervals }, todayStr);
          }
          
          // Trigger Simulado Unlock Check
          await checkAndUnlockSimulados(uid, planId, event.cycleId);
      }
  };

  // 1. Try finding by eventId (Standard Flow)
  // Search in ALL schedules to ensure sync even for future goals marked in Edital
  const schedulesRef = collection(db, 'users', uid, 'schedules');
  const snapshot = await getDocs(schedulesRef);
  
  let found = false;
  const canonicalId = String(eventId).trim();

  for (const docSnap of snapshot.docs) {
      const items = (docSnap.data().items || []) as ScheduledEvent[];
      const docDateStr = docSnap.data().date;
      
      let itemsModified = false;
      const updatedItems = items.map((i, index) => {
          const iId = i.id || `${docDateStr}-${i.metaId || 'nometa'}-${i.part || 1}-${index}`;
          // Match by composite ID OR Meta ID (for direct Edital completion)
          if (iId === eventId || i.metaId === canonicalId || i.taskId === canonicalId) {
              if (i.status !== newStatus) {
                  found = true;
                  itemsModified = true;
                  return { ...i, status: newStatus, recordedMinutes: (newStatus === 'completed' && typeof i.recordedMinutes !== 'number') ? 0 : i.recordedMinutes };
              }
          }
          return i;
      });
      
      if (itemsModified) {
          await updateDoc(docSnap.ref, cleanObject({ items: updatedItems }));
          
          // Trigger Spaced Review and Simulado Unlock for completed items in this doc
          if (newStatus === 'completed') {
              const matchedItem = updatedItems.find((i, index) => {
                  const iId = i.id || `${docDateStr}-${i.metaId || 'nometa'}-${i.part || 1}-${index}`;
                  return iId === eventId || i.metaId === canonicalId || i.taskId === canonicalId;
              });
              
              if (matchedItem) {
                  const intervals = matchedItem.spacedReviewIntervals || (matchedItem.reviewConfig?.active ? matchedItem.reviewConfig.intervals : null);
                  if (intervals && !matchedItem.isSpacedReview) {
                      await generateSpacedReviews(uid, planId, { ...matchedItem, spacedReviewIntervals: intervals }, todayStr);
                  }
                  await checkAndUnlockSimulados(uid, planId, matchedItem.cycleId);
              }
          }
      }
  }

  // 2. Persiste sempre na fonte da verdade do edital (Garante redundância e Edital Sync)
  const progressRef = doc(db, `users/${uid}/plans/${planId}/edital_progress`, canonicalId);
  await setDoc(progressRef, cleanObject({ 
    metaId: canonicalId,
    completed: newStatus === 'completed', 
    status: newStatus,
    completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
    manuallyCompleted: isManual
  }), { merge: true });

  // Se for uma conclusão manual via Edital e não tinha sido encontrada em schedules,
  // ainda podemos precisar dessas triggers
  if (!found && newStatus === 'completed') {
      if (goalData && goalData.reviewConfig?.active) {
          const intervals = goalData.reviewConfig.intervals;
          if (intervals) {
              await generateSpacedReviews(uid, planId, { 
                  ...goalData, 
                  metaId: goalData.id || String(goalData.id),
                  spacedReviewIntervals: intervals 
              }, todayStr);
          }
      }
      await checkAndUnlockSimulados(uid, planId);
  }
};

/**
 * Reseta as estatísticas de tempo de um plano específico do aluno.
 * Mantém o lifetimeMinutes intacto.
 */
export const resetPlanStats = async (uid: string, planId: string) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      [`planStats.${planId}.minutes`]: 0
    });
  } catch (error) {
    console.error("Erro ao resetar estatísticas do plano:", error);
  }
};

/**
 * Fetches all plans the student has active access to.
 */
export const getStudentPlans = async (uid: string): Promise<StudentPlan[]> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) throw new Error("Usuário não encontrado.");

  const studentData = userSnap.data() as Student;
  const activeAccesses = studentData.access?.filter(a => a.type === 'plan' && a.isActive) || [];

  if (activeAccesses.length === 0) return [];

  // Fetch details for each plan
  const planPromises = activeAccesses.map(async (access) => {
    try {
      const planRef = doc(db, 'plans', access.targetId);
      const planSnap = await getDoc(planRef);
      
      if (planSnap.exists()) {
        const planData = planSnap.data() as Plan;
        return {
          ...planData,
          id: planSnap.id,
          accessId: access.id,
          expiryDate: access.diaFim || access.endDate,
          isScholarship: access.isScholarship || false
        } as StudentPlan;
      }
      return null;
    } catch (e) {
      console.error(`Error fetching plan ${access.targetId}`, e);
      return null;
    }
  });

  const results = await Promise.all(planPromises);
  return results.filter((p): p is StudentPlan => p !== null);
};

/**
 * Saves the student's routine, selected plan, and study profile.
 */
export const saveStudentRoutine = async (
  uid: string, 
  payload: {
    currentPlanId: string;
    routine: StudentRoutine;
    studyProfile: StudyProfile;
    savedRoutines?: Record<string, any>[];
    activeRoutineId?: string;
  }
) => {
  const userRef = doc(db, 'users', uid);
  
  await updateDoc(userRef, {
    currentPlanId: payload.currentPlanId,
    routine: payload.routine,
    studyProfile: payload.studyProfile,
    savedRoutines: payload.savedRoutines || [],
    activeRoutineId: payload.activeRoutineId || '',
    onboardingCompleted: true
  });
};

/**
 * Toggles the pause state of the student's plan.
 */
export const togglePlanPause = async (uid: string, isPaused: boolean) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    isPlanPaused: isPaused,
    planPausedAt: isPaused ? serverTimestamp() : null
  });
};

/**
 * Fetches today's schedule for the current active plan.
 * UPDATED: Reads from Date Document structure.
 */
export const getTodayStudentSchedule = async (uid: string): Promise<{ planId: string, events: ScheduledEvent[] }> => {
  // Legacy Wrapper - Keeping for backward compatibility if needed, but prefer getDashboardData
  const data = await getDashboardData(uid);
  return { planId: data.planId, events: data.today };
};

/**
 * Fetches Dashboard Data: Overdue Items + Today Items
 */
export const getDashboardData = async (uid: string): Promise<{ 
  planId: string, 
  overdue: ScheduledEvent[], 
  today: ScheduledEvent[],
  lastScheduledDate: string | null,
  hasFuturePendingGoals: boolean
}> => {
  // 1. Get Current Plan ID
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return { planId: '', overdue: [], today: [], lastScheduledDate: null };
  
  const userData = userSnap.data();
  const currentPlanId = userData?.activePlanId || userData?.currentPlanId;

  if (userData?.isPlanPaused || !currentPlanId) {
    return { planId: currentPlanId || '', overdue: [], today: [], lastScheduledDate: null };
  }

  // 2. Calculate Date Strings (CORREÇÃO FUSO)
  const todayStr = getLocalISODate(new Date());

  // 3. Query all docs <= Today (To catch overdue)
  const schedulesRef = collection(db, 'users', uid, 'schedules');
  const q = query(schedulesRef, where('date', '<=', todayStr));
  const snapshot = await getDocs(q);

  const overdueEvents: ScheduledEvent[] = [];
  const todayEvents: ScheduledEvent[] = [];

  // Sort docs by date to ensure chronological order for overdue items
  const sortedDocs = snapshot.docs.sort((a, b) => a.data().date.localeCompare(b.data().date));

  sortedDocs.forEach(docSnap => {
    const data = docSnap.data();
    const items = (data.items || []) as ScheduledEvent[];
    const docDateStr = data.date; // YYYY-MM-DD

    // Filter by PlanID and ensure ID exists
    const planItems = items
      .map((e, index) => ({
        ...e,
        id: e.id || `${docDateStr}-${e.metaId || 'nometa'}-${e.part || 1}-${index}`
      }))
      .filter(e => e.planId === currentPlanId);

    if (docDateStr === todayStr) {
      // Today's Items (Pending + Completed)
      // We preserve the exact order from the database (which matches the calendar)
      todayEvents.push(...planItems);
    } else {
      // Past Date Items (Only Pending)
      const pendingPast = planItems.filter(e => e.status === 'pending');
      overdueEvents.push(...pendingPast);
    }
  });

  // ENRICH EVENTS WITH META CONTENT (Videos, PDFs, Links, etc.)
  const metaCache = new Map<string, Promise<Meta | null>>();

  // --- SMART EXTENSION LOGIC ---
  const smartMergeTolerance = userData.studyProfile?.smartMergeTolerance || 20;
  
  const eligibleEvents = todayEvents.filter(e => {
    const type = e.type?.toLowerCase();
    return (type === 'material' || type === 'pdf' || type === 'questions' || type === 'questões' || type === 'questoes' || type === 'law' || type === 'lei_seca' || type === 'lei seca') && 
      e.part != null && 
      e.status === 'pending';
  });

  if (eligibleEvents.length > 0) {
    // Query future schedules to find next parts
    const futureQ = query(schedulesRef, where('date', '>', todayStr));
    const futureSnap = await getDocs(futureQ);
    const futureDocs = futureSnap.docs.sort((a, b) => a.data().date.localeCompare(b.data().date));

    for (const event of eligibleEvents) {
      let foundNextPart = false;
      for (const docSnap of futureDocs) {
        if (foundNextPart) break;
        const items = (docSnap.data().items as ScheduledEvent[]) || [];
        const nextPart = items.find(i => 
          (i.metaId === event.metaId || i.taskId === event.taskId) && 
          i.part === (Number(event.part) || 1) + 1
        );
        
        if (nextPart) {
          if (nextPart.duration <= smartMergeTolerance) {
            event.smartExtension = {
              minutes: nextPart.duration,
              type: 'overflow'
            };
          }
          foundNextPart = true;
        }
      }
    }
  }

  const enrichWithMeta = async (events: ScheduledEvent[]) => {
    return Promise.all(events.map(async (event) => {
      if (!event.metaId || !event.subjectId || !event.topicId) return event;
      
      const metaPath = `plans/${currentPlanId}/disciplines/${event.subjectId}/topics/${event.topicId}/metas/${event.metaId}`;
      
      if (!metaCache.has(metaPath)) {
        const metaRef = doc(db, 'plans', currentPlanId, 'disciplines', event.subjectId, 'topics', event.topicId, 'metas', event.metaId);
        const fetchPromise = getDoc(metaRef).then(snap => snap.exists() ? snap.data() : null);
        metaCache.set(metaPath, fetchPromise);
      }

      const metaData = await metaCache.get(metaPath);
      if (metaData) {
        return {
          ...metaData, // Spread all meta configs (summaryConfig, etc) first
          ...event,    // Keep event's id, title, duration, type, etc.
          videos: metaData.videos || [],
          files: metaData.files || [],
          links: metaData.links || [],
          mindMap: metaData.mindMap || metaData.summaryConfig?.mindMap || [],
          flashcards: metaData.flashcards || metaData.reviewConfig?.flashcards || metaData.flashcardConfig?.cards || [],
          questions: metaData.questions || metaData.questionsConfig?.questions || [],
        };
      }
      return event;
    }));
  };

  // 4. Merge results from edital_progress to ensure Dashboard/Schedule sync
  const completedMetaIds = await getStudentCompletedMetas(uid, currentPlanId);
  
  const mergeProgress = (events: ScheduledEvent[]) => {
    return events.map(event => {
      const mId = String(event.metaId || event.taskId || event.id).trim();
      if (completedMetaIds.has(mId)) {
        return { ...event, status: 'completed' as const, isCompleted: true };
      }
      return event;
    });
  };

  const enrichedOverdue = await enrichWithMeta(mergeProgress(overdueEvents));
  const enrichedToday = await enrichWithMeta(mergeProgress(todayEvents));

  // Check for any future pending goals for this plan
  let hasFuturePendingGoals = false;
  const futurePendingQ = query(schedulesRef, where('date', '>', todayStr));
  const futurePendingSnap = await getDocs(futurePendingQ);
  
  for (const docSnap of futurePendingSnap.docs) {
    if (hasFuturePendingGoals) break;
    const items = docSnap.data().items || [];
    hasFuturePendingGoals = items.some((item: ScheduledEvent) => 
      item.planId === currentPlanId && item.status === 'pending'
    );
  }

  // Fetch last scheduled date
  let lastScheduledDate = null;
  const lastScheduleQuery = query(schedulesRef, orderBy(documentId(), 'desc'), limit(1));
  const lastScheduleSnap = await getDocs(lastScheduleQuery);
  if (!lastScheduleSnap.empty) {
    lastScheduledDate = lastScheduleSnap.docs[0].id;
  }

  return { 
    planId: currentPlanId, 
    overdue: enrichedOverdue, 
    today: enrichedToday,
    lastScheduledDate,
    hasFuturePendingGoals
  };
};

/**
 * Reseta os simulados desbloqueados de um plano específico do aluno.
 */
export const resetUnlockedSimulados = async (uid: string, planId: string) => {
  try {
    const unlockedRef = collection(db, 'users', uid, 'unlockedSimulados');
    const q = query(unlockedRef, where('planId', '==', planId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`[Reset] Simulados desbloqueados removidos para o plano ${planId}`);
  } catch (error) {
    console.error("Erro ao resetar simulados desbloqueados:", error);
  }
};


export const checkAndUnlockSimulados = async (uid: string, planId: string, cycleId?: string, providedFullPlan?: Plan, providedCompletedIdsSet?: Set<string>) => {
  try {
    const fullPlan = providedFullPlan || await fetchFullPlanData(planId);
    if (!fullPlan || !fullPlan.cycles) return;

    // 1. BUSCAR O PROGRESSO DO EDITAL (Lendo a subcoleção)
    const progressRef = collection(db, `users/${uid}/plans/${planId}/edital_progress`);
    const progressSnap = await getDocs(progressRef);
    const progressData: Record<string, { completed?: boolean; status?: string; [key: string]: any }> = {};

    progressSnap.forEach(document => {
      // Salva o dado usando o ID do documento (que é o ID da meta) como chave
      progressData[document.id] = document.data();
    });

    // ABANDONE computeSimuladoPrerequisites - Usaremos lógica estática do plano
    const unlockedRef = collection(db, `users/${uid}/unlockedSimulados`);
    
    const cyclesToCheck = cycleId 
      ? fullPlan.cycles.filter(c => c.id === cycleId)
      : fullPlan.cycles;

    // Fetch all scheduled items for this user and filter by planId in memory
    // (Firestore doesn't support querying nested arrays of objects directly without a top-level field)
    const schedulesRef = collection(db, 'users', uid, 'schedules');
    const snapScheduled = await getDocs(schedulesRef);
    const allScheduledItems: ScheduledEvent[] = [];
    snapScheduled.docs.forEach(docSnap => {
      const data = docSnap.data();
      const items = (data.items || []) as any[];
      // Filtra apenas os itens deste plano
      const planItems = items.filter(i => i.planId === planId);
      allScheduledItems.push(...planItems);
    });

    for (const cycle of cyclesToCheck) {
      if (!cycle.items) continue;

      // 1. Determinar as metas que pertencem a este ciclo
      // Se houver agendamento, o agendamento é a fonte da verdade sobre o fatiamento por ciclos.
      const hasSchedule = allScheduledItems.length > 0;
      let cycleMetaIds: string[] = [];

      if (hasSchedule) {
        // Pega as metas que foram agendadas especificamente para este ciclo
        const itemsInCycle = allScheduledItems.filter(i => i.cycleId === cycle.id);
        cycleMetaIds = Array.from(new Set(itemsInCycle.map(i => i.metaId || i.taskId || i.id).filter(Boolean)));
      } else {
        // Fallback: Extrair todos os IDs de metas das disciplinas do ciclo (para planos sem agenda)
        for (const item of cycle.items) {
          if (item.type === 'discipline' || item.type === 'folder') {
            const disciplines = (fullPlan.disciplines || []) as any[];
            
            let targetDisciplines = [];
            if (item.type === 'discipline') {
              targetDisciplines = disciplines.filter(d => d.id === item.referenceId);
            } else if (item.type === 'folder') {
              targetDisciplines = disciplines.filter(d => d.folderId === item.referenceId);
            }

            for (const disc of targetDisciplines) {
              for (const topic of (disc.topics || [])) {
                for (const meta of (topic.metas || [])) {
                  cycleMetaIds.push(meta.id);
                }
              }
            }
          }
        }
      }

      // 2. Verificar simulados no ciclo
      for (const item of cycle.items) {
        if (item.type === 'simulado') {
          const metaId = item.id;
          
          // Auditoria: Filtrar IDs que NÃO estão nas concluídas (Dupla checagem: Edital Progress + Goals)
          const missingIds = cycleMetaIds.filter(canonicalId => {
            // 1. Checagem na fonte da verdade (Edital Progress)
            const pData = progressData[canonicalId];
            const inProgress = pData === true || pData?.completed === true || pData?.status === 'completed' || (providedCompletedIdsSet && providedCompletedIdsSet.has(canonicalId));
            
            // 2. Checagem inteligente no calendário (Fuzzy Matching)
            const inGoals = allScheduledItems.some(g => {
              // Verifica se o ID base existe ou se o ID dinâmico CONTÉM o ID canônico
              const baseIdMatch = g.taskId === canonicalId || g.metaId === canonicalId || g.id === canonicalId;
              const stringMatch = typeof g.id === 'string' && g.id.includes(canonicalId);
              
              return (baseIdMatch || stringMatch) && g.status === 'completed';
            });

            return !inProgress && !inGoals; // Falta apenas se não estiver em nenhum dos dois
          });
          
          if (missingIds.length > 0) {
            // Re-lock if it was previously unlocked but now has missing prerequisites (e.g. after a reset)
            const docRef = doc(unlockedRef, metaId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const batch = writeBatch(db);
              batch.delete(docRef);
              await batch.commit();
            }
          } else {
            // Verifica se o simulado em si já foi concluído
            const isSimuladoCompleted = (progressData[metaId] === true || progressData[metaId]?.completed === true) || 
                                        allScheduledItems.some(g => (g.id === metaId || g.taskId === metaId || g.metaId === metaId) && g.status === 'completed');

            if (!isSimuladoCompleted) {
              // Check if already scheduled
              const isScheduled = allScheduledItems.some((i: any) => (i.metaId === metaId || i.taskId === metaId) && i.status !== 'completed');

              if (!isScheduled) {
                const docRef = doc(unlockedRef, metaId);
                await setDoc(docRef, {
                  status: 'unlocked',
                  planId: planId,
                  cycleId: cycle.id,
                  unlockedAt: new Date().toISOString(),
                  simuladoName: item.simuladoTitle || 'Simulado Oficial',
                  duration: item.duration || 240
                }, { merge: true });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking simulado unlocks:", error);
  }
};

/**
 * Helper to fetch current student config
 */
export const getStudentLastScheduledDate = async (uid: string) => {
  const schedulesRef = collection(db, 'users', uid, 'schedules');
  const lastScheduleQuery = query(schedulesRef, orderBy(documentId(), 'desc'), limit(1));
  const lastScheduleSnap = await getDocs(lastScheduleQuery);
  if (!lastScheduleSnap.empty) {
    return lastScheduleSnap.docs[0].id;
  }
  return null;
};

export const getStudentConfig = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return null;
  
  const data = userSnap.data();
  if (!data) return null;
  const lastScheduledDate = await getStudentLastScheduledDate(uid);

  return {
    currentPlanId: data.activePlanId || data.currentPlanId,
    routine: data.routine,
    studyProfile: data.studyProfile,
    savedRoutines: data.savedRoutines || [],
    activeRoutineId: data.activeRoutineId,
    isPlanPaused: data.isPlanPaused || false,
    lastScheduledDate
  };
};

/**
 * Busca todos os alunos matriculados em uma turma presencial específica.
 */
export const getStudentsByClass = async (classId: string) => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(query(usersRef));
  
  const enrolledStudents: Student[] = [];

  snapshot.forEach(docSnap => {
    const userData = { id: docSnap.id, ...docSnap.data() } as Student;
    const accesses = userData.access || [];
    
    // Procura se o aluno tem um acesso válido para esta turma presencial
    const classAccess = accesses.find((a: AccessItem) => a.targetId === classId && a.type === 'presential_class' && a.isActive !== false);
    
    if (classAccess) {
      enrolledStudents.push({
        ...userData,
        classAccess // Injetamos o objeto de acesso para facilitar a leitura da data e do status de bolsista na UI
      });
    }
  });

  return enrolledStudents;
};

/**
 * Busca todos os alunos matriculados em um plano específico.
 */
export const getStudentsByPlan = async (planId: string) => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(query(usersRef));
  
  const enrolledStudents: Student[] = [];

  snapshot.forEach(docSnap => {
    const userData = { id: docSnap.id, ...docSnap.data() } as Student;
    const accesses = userData.access || [];
    
    // Procura se o aluno tem um acesso válido para este plano
    const planAccess = accesses.find((a: AccessItem) => a.targetId === planId && a.type === 'plan' && a.isActive !== false);
    
    if (planAccess) {
      enrolledStudents.push({
        ...userData,
        planAccess
      });
    }
  });

  return enrolledStudents;
};
