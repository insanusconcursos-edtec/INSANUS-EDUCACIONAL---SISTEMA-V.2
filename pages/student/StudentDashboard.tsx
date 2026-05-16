
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  LayoutDashboard, Coffee, Loader2, 
  RefreshCw, CheckCircle2, Clock, X, Check, Trophy, PlusCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StudentGoalCard, StudentGoal } from '../../components/student/StudentGoalCard';
import { DelayedGoalsSection } from '../../components/student/dashboard/DelayedGoalsSection';
import { getDashboardData, toggleGoalStatus, getStudentConfig, getStudentCompletedMetas, getLocalISODate, checkAndUnlockSimulados, getStudentPlans, saveStudentRoutine } from '../../services/studentService';
import { fetchFullPlanData, scheduleUserSimulado, anticipateAndShiftGoals, generateSchedule, rescheduleOverdueTasks } from '../../services/scheduleService';
import { getAllPlanMetas, Meta } from '../../services/metaService';
import { EditalNotebookModal } from '../../components/student/tools/EditalNotebookModal';
import { NoteType } from '../../services/notebookService';
import { useAuth } from '../../contexts/AuthContext';
import { getEdict, EdictStructure } from '../../services/edictService';
import { SimuladoDashboardCard, ComputedSimulado } from '../../components/student/SimuladoDashboardCard';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getExams } from '../../services/simulatedService';
import { SimuladoFocusMode } from '../../components/student/goals/SimuladoFocusMode';
import StudentMentorshipViewer from '../../components/student/mentorship/StudentMentorshipViewer';
import StudentChatView from '../../components/student/chat/StudentChatView';
import { SimuladosTabContent } from '../../components/student/dashboard/SimuladosTabContent';
import { LiveEventsTabContent } from '../../components/student/dashboard/LiveEventsTabContent';
import { CourseReviewDashboard } from '../../components/student/courses/reviews/CourseReviewDashboard';
import { TopicCompletionModal } from '../../components/student/dashboard/TopicCompletionModal';
import { courseReviewService } from '../../services/courseReviewService';
import { useNavigate } from 'react-router-dom';

import { useSpacedReviewModal } from '../../contexts/SpacedReviewModalContext';
import { PlanHeroBanner } from '../../components/student/PlanHeroBanner';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Smartphone, Download } from 'lucide-react';

import { useEdictData } from '../../contexts/EdictDataContext';
import { getPlanById } from '../../services/planService';
import { toPlainObject } from '../../services/firestoreUtils';
import { subscribeToAnnouncements, Announcement } from '../../services/announcementService';
import { AnnouncementPopUp } from '../../components/student/announcements/AnnouncementPopUp';

const StudentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { openSpacedReviewModal } = useSpacedReviewModal();
  const { data: cachedData, setData: setCachedData } = useEdictData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab');
  
  // Data State
  const [todayGoals, setTodayGoals] = useState<StudentGoal[]>([]);
  const [edictStructure, setEdictStructure] = useState<EdictStructure | null>(null);
  // Split Overdue State
  const [overdueReviews, setOverdueReviews] = useState<StudentGoal[]>([]);
  const [overdueGeneral, setOverdueGeneral] = useState<StudentGoal[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState<string>(cachedData?.planId || '');
  const [isScholarship, setIsScholarship] = useState(false);
  const [isReplanning, setIsReplanning] = useState(false);

  // Anticipation State
  const [showAnticipateModal, setShowAnticipateModal] = useState(false);
  const [availableTimeForAnticipation, setAvailableTimeForAnticipation] = useState(0);
  const [isAnticipating, setIsAnticipating] = useState(false);

  // --- SIMULADOS STATES ---
  const [computedSimulados, setComputedSimulados] = useState<{ 
    blocked: ComputedSimulado[], 
    released: ComputedSimulado[],
    scheduled: ComputedSimulado[]
  }>({ blocked: [], released: [], scheduled: [] });
  const [showScheduleModal, setShowScheduleModal] = useState<string | null>(null);
  const [simuladoDate, setSimuladoDate] = useState('');

  // --- MODO FOCO SIMULADO ---
  const [isExamMode, setIsExamMode] = useState(false);
  const [activeSimulado, setActiveSimulado] = useState<StudentGoal | null>(null);
  
  // PASSO 2: NOVO ESTADO DE CONFIRMAÇÃO DE INÍCIO
  const [examToConfirm, setExamToConfirm] = useState<StudentGoal | null>(null);

  // Rolling Window State
  const [lastScheduledDate, setLastScheduledDate] = useState<string | null>(null);
  const [hasFuturePendingGoals, setHasFuturePendingGoals] = useState(false);
  const [isPlanCompleted, setIsPlanCompleted] = useState(false);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [completedMetaIds, setCompletedMetaIds] = useState<Set<string>>(cachedData?.completedMetaIds || new Set());
  const [fullPlanData, setFullPlanData] = useState<any>(cachedData?.fullPlanData || null);
  const [metaLookup, setMetaLookup] = useState<Record<string, Meta>>(cachedData?.metaLookup || {});
  const [isEdictLoading, setIsEdictLoading] = useState(false);
  const [pendingTopicReview, setPendingTopicReview] = useState<any>(null);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);
  const [topicCompletionPayload, setTopicCompletionPayload] = useState<any>(null);
  const closedTopicModalsRef = React.useRef<Set<string>>(new Set());
  const prefetchPromiseRef = React.useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (pendingTopicReview) {
      openSpacedReviewModal(pendingTopicReview);
      setPendingTopicReview(null);
    }
  }, [pendingTopicReview, openSpacedReviewModal]);

  // Lógica de Comunicados Globais (Pop-ups)
  useEffect(() => {
    if (!currentUser || !currentPlanId) return;

    const unsubscribe = subscribeToAnnouncements(currentPlanId, (announcements) => {
      // Encontra o primeiro anúncio mandatório que o usuário ainda não leu
      const mandatoryUnread = announcements.find(ann => 
        ann.forcePopUp && (!ann.readBy || !ann.readBy.includes(currentUser.uid))
      );
      
      if (mandatoryUnread) {
        setActiveAnnouncement(mandatoryUnread);
      } else {
        setActiveAnnouncement(null);
      }
    });

    return () => unsubscribe();
  }, [currentUser, currentPlanId]);
  
  // NOTEBOOK MODAL STATE
  const [notebookModal, setNotebookModal] = useState<{
    isOpen: boolean;
    nodeId: string;
    nodeTitle: string;
    type: NoteType;
    materials: any[];
    editalNode?: any;
    initialPdfUrl?: string | null;
  }>({
    isOpen: false,
    nodeId: '',
    nodeTitle: '',
    type: 'note',
    materials: [],
    initialPdfUrl: null
  });
  
  const [isMentorshipPlayerActive, setIsMentorshipPlayerActive] = useState(false);
  const lastToggleRef = React.useRef<{ id: string, time: number } | null>(null);
  const prefetchStartedRef = React.useRef<string | null>(null);
  
  // NOVO: Prefetching Silencioso do Edital
  const prefetchEditalData = async (planId: string) => {
    if (!currentUser || prefetchStartedRef.current === planId) return;
    
    // Se já temos cache para este plano, alimenta os estados locais imediatamente
    if (cachedData?.planId === planId) {
        console.log("⚡ [Prefetch] Dados já em cache para o plano:", planId);
        setEdictStructure(cachedData.structure);
        setFullPlanData(cachedData.fullPlanData);
        setMetaLookup(cachedData.metaLookup);
        setCompletedMetaIds(cachedData.completedMetaIds);
        return;
    }

    prefetchStartedRef.current = planId;
    console.log("🔍 [Prefetch] Iniciando carregamento antecipado do Edital...");
    
    const promise = (async () => {
        setIsEdictLoading(true);
        try {
            const [edictData, completedIds, planData, allMetas, fullPlan] = await Promise.all([
                getEdict(planId),
                getStudentCompletedMetas(currentUser.uid, planId),
                getPlanById(planId),
                getAllPlanMetas(planId),
                fetchFullPlanData(planId)
            ]);

            const lookup: Record<string, Meta> = {};
            allMetas.forEach(m => {
                if (m.id) lookup[m.id] = m;
            });

            const plainLookup = toPlainObject(lookup);

            // Atualiza Estados Locais
            setEdictStructure(edictData);
            setCompletedMetaIds(completedIds);
            setFullPlanData(fullPlan);
            setMetaLookup(plainLookup);

            // Alimenta o Cache Global para a aba Edital
            setCachedData({
                structure: toPlainObject(edictData),
                completedMetaIds: completedIds,
                planTitle: planData?.title || '',
                activeUserMode: planData?.isActiveUserMode || false,
                planId: planId,
                metaLookup: plainLookup,
                fullPlanData: toPlainObject(fullPlan)
            });
            
            console.log("✅ [Prefetch] Edital carregado silenciosamente.");
        } catch (error) {
            console.error("❌ [Prefetch] Erro no carregamento silencioso:", error);
            prefetchStartedRef.current = null;
        } finally {
            setIsEdictLoading(false);
            prefetchPromiseRef.current = null;
        }
    })();

    prefetchPromiseRef.current = promise;
    return promise;
  };

  const fetchSchedule = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
        const { planId, overdue: overdueData, today: todayData, lastScheduledDate: fetchedLastDateRaw, hasFuturePendingGoals: fetchedHasFutureRaw } = await getDashboardData(currentUser.uid);
        
        let overdue = overdueData;
        let today = todayData;
        let fetchedLastDate = fetchedLastDateRaw;
        let fetchedHasFuture = fetchedHasFutureRaw;
        
        let finalPlanId = planId;
        const plans = await getStudentPlans(currentUser.uid);

        // LÓGICA DE ATIVAÇÃO AUTOMÁTICA (REDIRECIONAMENTO INTELIGENTE)
        if (!planId && plans.length === 1) {
            const singlePlan = plans[0];
            finalPlanId = singlePlan.id;
            
            // Busca configurações existentes para não sobrescrever com lixo
            const currentConfig = await getStudentConfig(currentUser.uid);
            
            await saveStudentRoutine(currentUser.uid, {
                currentPlanId: finalPlanId,
                routine: currentConfig?.routine || { 0: 180, 1: 180, 2: 180, 3: 180, 4: 180, 5: 180, 6: 180 },
                studyProfile: currentConfig?.studyProfile || { 
                  level: 'beginner', 
                  semiActiveClass: false, 
                  semiActiveMaterial: false, 
                  semiActiveLaw: false 
                }
            });
            
            toast.success(`Plano "${singlePlan.title}" ativado automaticamente!`, { icon: '🚀' });
            
            // Recarrega os dados do dashboard agora com o novo plano ativo
            const newData = await getDashboardData(currentUser.uid);
            overdue = newData.overdue || [];
            today = newData.today || [];
            fetchedLastDate = newData.lastScheduledDate;
            fetchedHasFuture = newData.hasFuturePendingGoals;
        }

        setCurrentPlanId(finalPlanId);
        setLastScheduledDate(fetchedLastDate);
        setHasFuturePendingGoals(fetchedHasFuture);

        // Dispara Prefetching Silencioso sem bloquear a renderização das Metas de Hoje
        if (finalPlanId) {
            prefetchEditalData(finalPlanId);
        }

        // Fetch Scholarship Status (Crucial para o Dash, mas pode ser rápido)
        const currentPlan = plans.find(p => p.id === finalPlanId);
        setIsScholarship(currentPlan?.isScholarship || false);

        // Helper Mapper
        const mapToGoal = (event: any): StudentGoal => {
            // DETECÇÃO AGRESSIVA: Se o título, disciplina ou tópico for "ESTUDO LIVRE", tratamos como Estudo Livre
            const titleUpper = (event.title || '').toUpperCase();
            const disciplineUpper = (event.disciplineName || event.discipline || '').toUpperCase();
            const topicUpper = (event.topicName || event.subject || '').toUpperCase();
            
            const isFreeStudy = event.type === 'free_study' || 
                               titleUpper === 'ESTUDO LIVRE' || 
                               disciplineUpper === 'ESTUDO LIVRE' ||
                               topicUpper === 'ESTUDO LIVRE';

            return {
                id: event.id,
                metaId: event.metaId, // Essential for merge
                planId: event.planId, // Essential for merge
                date: event.date, // Essential for Time Tracking updates
                type: isFreeStudy ? 'free_study' : event.type,
                title: event.title,
                discipline: event.disciplineName || event.discipline || 'Geral',
                disciplineId: event.disciplineId,
                topic: event.topicName || event.subject || '',
                topicId: event.topicId,
                duration: event.duration,
                multiplier: Number(event.multiplier || event.lawConfig?.multiplier || event.lawConfig?.speedFactor) || 1,
                recordedMinutes: event.recordedMinutes || 0, // NEW: Track actual time
                isCompleted: event.status === 'completed',
                observation: event.observation,
                color: event.color || null,
                part: event.part, // Map Part Number
                order: event.order, // Map Order Number
                smartExtension: event.smartExtension || null, // Map the extension config
                cycleName: event.cycleName, // Map Cycle Name
                cycleId: event.cycleId, // Map Cycle ID
                cycleOrder: event.cycleOrder,
                disciplineOrder: event.disciplineOrder,
                subjectOrder: event.subjectOrder,
                taskOrder: event.taskOrder,
                
                // Review Specifics
                reviewLabel: event.reviewLabel,
                isSpacedReview: event.isSpacedReview || (event.type === 'review' && !!event.originalEventId),
                isFreeStudy: isFreeStudy, // Flag para sanitização posterior

                videos: event.videos || [],
                files: event.files || [],
                links: event.links || [],
                mindMap: event.mindMap || event.summaryConfig?.mindMap || [],
                flashcards: event.flashcards || event.reviewConfig?.flashcards || event.flashcardConfig?.cards || [],
                questions: event.questions || event.questionsConfig?.questions || [],
                contentCount: {
                    video: event.videos?.length || 0,
                    pdf: event.files?.length || 0,
                    questions: event.questions?.length || event.questionsConfig?.questions?.length || 0 
                }
            };
        };

        // 1. Split Overdue Goals (Priority Logic)
        const spacedReviews = overdue.filter(ev => 
            ev.type === 'review' && (!!ev.originalEventId || (ev.reviewLabel && ev.reviewLabel.startsWith('REV.')))
        ).map(mapToGoal);

        const generalOverdue = overdue.filter(ev => {
            const isSpaced = ev.type === 'review' && (!!ev.originalEventId || (ev.reviewLabel && ev.reviewLabel.startsWith('REV.')));
            return !isSpaced;
        }).map(mapToGoal);
        
        setOverdueReviews(spacedReviews);
        setOverdueGeneral(generalOverdue);

        // 2. Today Goals (Ordered)
        const mappedToday = today.map(mapToGoal);
        
        // PILAR 1: Sanitização de Dados (Isolamento total na raiz)
        const freeStudyToday = mappedToday.filter(goal => goal.type === 'free_study' || goal.isFreeStudy);
        const regularTasksToday = mappedToday.filter(goal => goal.type !== 'free_study' && !goal.isFreeStudy);

        // Ordenação da Trilha Regular
        const spacedReviewsToday = regularTasksToday.filter(item => item.isSpacedReview);
        const normalTasksToday = regularTasksToday.filter(item => !item.isSpacedReview);
        const sortedRegular = [...spacedReviewsToday, ...normalTasksToday];
        
        // PILAR 2: Reset de Comparativo (Flags calculadas APENAS na trilha regular)
        let lastTopicId: string | null = null;
        let lastCycleId: string | null = null;
        let hasPreviousItem = false;

        const regularWithFlags = sortedRegular.map(goal => {
            const isAbsoluteStartOfCycle = goal.disciplineOrder === 0 && goal.subjectOrder === 0 && goal.taskOrder === 0;
            const isNewTopic = !hasPreviousItem || goal.topicId !== lastTopicId;
            const isNewCycle = (hasPreviousItem && goal.cycleId !== lastCycleId) || isAbsoluteStartOfCycle;
            
            lastTopicId = goal.topicId || null;
            lastCycleId = goal.cycleId || null;
            hasPreviousItem = true;
            
            return { ...goal, isNewTopic, isNewCycle };
        });
        
        // Salvamos os dois tipos separadamente se preferir, ou mantemos no array mas respeitando a ordem
        // O Estudo Livre NÃO terá isNewTopic/isNewCycle
        setTodayGoals([...freeStudyToday, ...regularWithFlags]);

        // 3. CALCULATE SIMULADOS
        if (planId) {
            await calculateSimuladosStatus(currentUser.uid, planId);
        }

    } catch (error) {
        console.error("Erro ao carregar cronograma:", error);
    } finally {
        setLoading(false);
    }
  };

  // --- 2. MOTOR DE CÁLCULO DE REQUISITOS (LÓGICA FORNECIDA) ---
  const calculateSimuladosStatus = async (uid: string, planId: string) => {
      try {
          // A. Fetch Full Plan (Cycles and Content)
          const fullPlan = await fetchFullPlanData(planId);
          setFullPlanData(fullPlan);
          if (!fullPlan || !fullPlan.cycles) return;

          // B. Busca Metas Concluídas (Progress)
          // Isso inclui tanto as marcadas no calendário quanto as manuais
          const completedIdsSet = await getStudentCompletedMetas(uid, planId);
          setCompletedMetaIds(completedIdsSet);

          // Calculate total metas to check if plan is completed
          let totalMetas = 0;
          fullPlan.disciplines?.forEach((disc: any) => {
              disc.topics?.forEach((topic: any) => {
                  totalMetas += (topic.metas?.length || 0);
              });
          });
          setIsPlanCompleted(totalMetas > 0 && completedIdsSet.size >= totalMetas);

          // C. Sincroniza desbloqueios pendentes
          await checkAndUnlockSimulados(uid, planId, undefined, fullPlan, completedIdsSet);

          // D. Busca o que já está AGENDADO (Futuro) para exibir na lista
          // CORREÇÃO AQUI: Usa data local e filtragem em memória para contornar limitações do Firestore
          const todayStr = getLocalISODate(new Date());
          const schedulesRef = collection(db, 'users', uid, 'schedules');
          const snapScheduled = await getDocs(schedulesRef);
          
          // Map of MetaId -> Schedule Data
          const scheduledMap = new Map<string, any>();
          
          snapScheduled.docs.forEach(doc => {
              const data = doc.data();
              const docDate = data.date;
              if (docDate < todayStr) return;

              const items = data.items || [];
              items.forEach((item: any) => {
                  if (item.planId === planId && item.type === 'simulado' && item.status !== 'completed') {
                      const mId = item.metaId || item.taskId;
                      if (mId) {
                        scheduledMap.set(mId, { 
                            date: data.date, // 'YYYY-MM-DD'
                            ...item 
                        });
                      }
                  }
              });
          });

          // D. Fetch Real Exam Details (Duration) if linked class exists
          const realExamDetails: Record<string, any> = {};
          if (fullPlan.linkedSimuladoClassId) {
              try {
                  const exams = await getExams(fullPlan.linkedSimuladoClassId);
                  exams.forEach(exam => {
                      if (exam.id) realExamDetails[exam.id] = exam;
                  });
              } catch (e) {
                  console.warn("Could not fetch exams for linked class", e);
              }
          }

          // E. Fetch Unlocked Simulados (Triggered by backend)
          const unlockedRef = collection(db, 'users', uid, 'unlockedSimulados');
          const snapUnlocked = await getDocs(unlockedRef);
          const unlockedIdsSet = new Set(snapUnlocked.docs.map(doc => doc.id));

          const blocked: ComputedSimulado[] = [];
          const released: ComputedSimulado[] = [];
          const scheduledList: ComputedSimulado[] = [];

          // Varredura Sequencial do Plano
          fullPlan.cycles.forEach((cycle: any, cIdx: number) => {
              if (!cycle.items) return;

              cycle.items.forEach((item: any, iIdx: number) => {
                  
                  // CASO 1: É UM SIMULADO
                  if (item.type === 'simulado') {
                      const metaId = item.id; 
                      // referenceId usually points to exam ID in simulatedClasses
                      const examId = item.referenceId; 

                      // Tenta pegar do cache 'realExamDetails' (banco real), senão do item, senão padrão
                      const realData = realExamDetails[examId];
                      const realDuration = realData?.duration ? Number(realData.duration) : (item.duration ? Number(item.duration) : 240);
                      const realTitle = realData?.title || item.simuladoTitle || 'Simulado Oficial';
                      // EXTRAÇÃO DO PDF (FIX)
                      const realBookletUrl = realData?.files?.bookletUrl;

                      // Check if completed
                      const isDone = completedIdsSet.has(metaId);
                      
                      if (isDone) return; // Don't show completed in this dashboard section

                      // Check if scheduled
                      const scheduledItem = scheduledMap.get(metaId);

                      // Check if Unlocked (Source of Truth from Backend)
                      const isUnlocked = unlockedIdsSet.has(metaId);

                      const simuladoObj: ComputedSimulado = {
                          id: metaId, 
                          title: realTitle,
                          duration: realDuration,
                          status: 'blocked', // Default
                          cycleIndex: cIdx,
                          cycleName: cycle.name || `Ciclo ${cIdx + 1}`,
                          itemIndex: iIdx,
                          bookletUrl: realBookletUrl // Passando a URL para o componente
                      };

                      if (scheduledItem) {
                          // Is Scheduled
                          simuladoObj.status = 'scheduled';
                          // Parse Date
                          const [y, m, d] = scheduledItem.date.split('-').map(Number);
                          simuladoObj.date = new Date(y, m - 1, d);
                          
                          scheduledList.push(simuladoObj);
                      } else if (isUnlocked) {
                          // Is Released
                          simuladoObj.status = 'released';
                          released.push(simuladoObj);
                      } else {
                          // Is Blocked
                          simuladoObj.status = 'blocked';
                          blocked.push(simuladoObj);
                      }
                  } 
              });
          });

          // Update State
          setComputedSimulados({ 
              blocked, 
              released,
              scheduled: scheduledList
          });

      } catch (error) {
          console.error("Erro calc simulados:", error);
      }
  };

  const handleScheduleSimuladoConfirm = async () => {
      if (!showScheduleModal || !currentUser || !currentPlanId || !simuladoDate) return;

      const simuladoToSchedule = computedSimulados.released.find(s => s.id === showScheduleModal);
      if (!simuladoToSchedule) return;

      try {
          const dateObj = new Date(simuladoDate);
          // Adjust timezone to prevent day shift
          const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
          const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);

          // PASSA O OBJETO COMPLETO DE DADOS PARA A NOVA ASSINATURA (Incluindo bookletUrl)
          await scheduleUserSimulado(
              currentUser.uid, 
              currentPlanId, 
              simuladoToSchedule, // { id, title, duration, bookletUrl, ... }
              adjustedDate
          );
          
          alert("Simulado agendado com sucesso!");
          setShowScheduleModal(null);
          setSimuladoDate('');
          fetchSchedule(); // Refresh all
      } catch (error) {
          console.error("Erro ao agendar:", error);
          alert("Erro ao agendar simulado.");
      }
  };

  useEffect(() => {
    fetchSchedule();
  }, [currentUser]);

  // --- NOTIFICATION LOGIC FOR LIVE EVENTS ---
  useEffect(() => {
    if (!currentUser || !currentPlanId) return;

    const notifiedEvents = new Set<string>();
    
    const checkNotifications = async () => {
      const q = query(
        collection(db, 'live_events'),
        where('status', '==', 'scheduled')
      );
      
      const snapshot = await getDocs(q);
      const now = new Date();
      
      snapshot.docs.forEach(doc => {
        const event = doc.data() as any;
        if (!event.accessControl?.plans?.includes(currentPlanId)) return;

        const eventTime = new Date(`${event.eventDate}T${event.startTime}`);
        const diffMs = eventTime.getTime() - now.getTime();
        const diffMin = Math.floor(diffMs / 60000);

        // Notify at exactly these intervals or within current minute
        if (diffMin < 0) return;

        const notificationKey = `${doc.id}-${diffMin}`;
        if (notifiedEvents.has(notificationKey)) return;

        if (diffMin === 30) {
          toast(`Seu evento ao vivo "${event.title}" começa em 30 minutos`, { icon: '⏰' });
          notifiedEvents.add(notificationKey);
        } else if (diffMin === 15) {
          toast(`Seu evento ao vivo "${event.title}" começa em 15 minutos`, { icon: '⏰' });
          notifiedEvents.add(notificationKey);
        } else if (diffMin === 5) {
          toast(`Seu evento ao vivo "${event.title}" começa em 5 minutos`, { icon: '⏰' });
          notifiedEvents.add(notificationKey);
        } else if (diffMin === 0) {
          toast(`Seu evento ao vivo "${event.title}" começou!`, { icon: '🔴' });
          notifiedEvents.add(notificationKey);
        }
      });
    };

    // Initial check
    checkNotifications();

    // Check every minute
    const interval = setInterval(checkNotifications, 60000);

    return () => clearInterval(interval);
  }, [currentUser, currentPlanId]);

  // Reactive listener for unlocked simulados
  useEffect(() => {
    if (!currentUser || !currentPlanId) return;
    const unlockedRef = collection(db, 'users', currentUser.uid, 'unlockedSimulados');
    const q = query(unlockedRef, where('planId', '==', currentPlanId));
    const unsubscribe = onSnapshot(q, () => {
      // Re-calculate only simulados status when the collection changes
      calculateSimuladosStatus(currentUser.uid, currentPlanId);
    });
    return () => unsubscribe();
  }, [currentUser, currentPlanId]);

  // Handler INICIAL para iniciar Simulado (Abre POPUP DE CONFIRMAÇÃO)
  const handleStartSimulado = (goal: StudentGoal) => {
      setExamToConfirm(goal);
  };

  // Handler DEFINITIVO após confirmar (Abre Modo Foco)
  const handleConfirmStart = () => {
      if (examToConfirm) {
          setActiveSimulado(examToConfirm);
          setIsExamMode(true);
          setExamToConfirm(null);
      }
  };

  // Handler para completar Simulado (Fecha Modo Foco e Atualiza)
  const handleCompleteSimulado = async () => {
      if (!activeSimulado || !currentUser || !currentPlanId) return;
      try {
          // Atualiza status no banco (usando helper existente)
          await toggleGoalStatus(currentUser.uid, currentPlanId, activeSimulado.id, 'pending');
          
          // Atualiza UI local
          setTodayGoals(prev => prev.map(g => 
              g.id === activeSimulado.id ? { ...g, isCompleted: true } : g
          ));
          
          setIsExamMode(false);
          setActiveSimulado(null);
      } catch (error) {
          console.error("Erro ao concluir simulado:", error);
          alert("Erro ao salvar progresso.");
      }
  };

  const handleReplanDelays = async () => {
    if (!currentUser || !currentPlanId) return;
    setIsReplanning(true);
    try {
      const config = await getStudentConfig(currentUser.uid);
      if (!config) throw new Error("Configuração do aluno não encontrada.");
      
      const result = await rescheduleOverdueTasks(
        currentUser.uid,
        currentPlanId,
        config.routine,
        config.studyProfile
      );

      if (result.success) {
        toast.success(result.message);
        await fetchSchedule();
      }
    } catch (error) {
      console.error("Erro ao replanejar:", error);
      toast.error("Erro ao replanejar atrasos.");
    } finally {
      setIsReplanning(false);
    }
  };

  const handleGenerateNextWeeks = async () => {
      if (!currentUser || !currentPlanId) return;
      setIsGeneratingNext(true);
      try {
          await generateSchedule(currentUser.uid, currentPlanId);
          toast.success("Próximas semanas geradas com sucesso!");
          fetchSchedule();
      } catch (error) {
          console.error("Erro ao gerar próximas semanas:", error);
          toast.error("Erro ao gerar próximas semanas.");
      } finally {
          setIsGeneratingNext(false);
      }
  };

  const checkAndTriggerAnticipation = async (updatedGoals: any[]) => {
    if (!currentUser) return;
    const pendingGoals = updatedGoals.filter(g => !g.isCompleted);
    if (pendingGoals.length === 0) {
      const config = await getStudentConfig(currentUser.uid);
      const safeRoutine = config?.routine || [0, 0, 0, 0, 0, 0, 0];
      
      // 1. Calcula o tempo gasto apenas com cronômetro (conclusão manual = 0)
      const timeSpentToday = updatedGoals.reduce((acc, goal) => {
        return acc + (goal.recordedMinutes || 0); // Ajuste para a propriedade que salva o tempo do cronômetro
      }, 0);

      // 2. Calcula tempo da rotina restante
      const todayDayIndex = new Date().getDay();
      const dailyCapacity = safeRoutine[todayDayIndex] || 0;
      const routineTimeLeft = Math.max(0, dailyCapacity - timeSpentToday);

      // 3. Calcula tempo físico do relógio (até 23:59)
      const now = new Date();
      const realTimeLeft = (23 * 60 + 59) - (now.getHours() * 60 + now.getMinutes());

      // 4. Variável final (o menor entre os dois)
      const finalTimeAvailable = Math.min(routineTimeLeft, realTimeLeft);

      if (finalTimeAvailable > 0) {
        setAvailableTimeForAnticipation(finalTimeAvailable);
        setShowAnticipateModal(true);
      }
    }
  };

  const handleConfirmAnticipation = async () => {
      if (!currentUser || !currentPlanId) return;
      setIsAnticipating(true);
      try {
          const config = await getStudentConfig(currentUser.uid);
          const safeRoutine = config?.routine || [0, 0, 0, 0, 0, 0, 0];
          const todayStr = getLocalISODate(new Date());

          const result = await anticipateAndShiftGoals(
              currentUser.uid,
              currentPlanId,
              safeRoutine,
              availableTimeForAnticipation,
              todayStr
          );
          
          if (result.success) {
              await fetchSchedule(); 
              toast.success(`${result.anticipatedCount} meta(s) antecipada(s) com sucesso!`);
          } else {
              toast(result.message || 'A próxima meta não se enquadra no tempo livre de hoje.');
          }
      } catch (error) {
          console.error(error);
          toast.error('Erro ao antecipar metas.');
      } finally {
          setIsAnticipating(false);
          setShowAnticipateModal(false);
      }
  };

  const getFormattedDate = () => {
    const date = new Date();
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
    const dayAndMonth = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    return { weekday, dayAndMonth };
  };

  const { weekday, dayAndMonth } = getFormattedDate();
  
  const { isInstallable, installApp } = usePWAInstall();

  const renderEmbeddedNotebook = (goal: StudentGoal) => {
      const currentStructure = edictStructure;
      const currentLookup = metaLookup;
      
      if (!currentStructure) return null;

      // Usando undefined para fileUrl para não forçar correspondência de arquivo no finder
      const target = findTargetTopic(goal.topicId, goal.metaId, currentStructure.disciplines, goal.title, goal.discipline, currentLookup);
      
      if (!target) return null;
      
      const targetTopic = target.topic;
      const relatedMaterials: any[] = [];
      
      if (targetTopic.linkedGoals && currentLookup) {
          Object.keys(targetTopic.linkedGoals).forEach(category => {
              const goalIds = targetTopic.linkedGoals[category];
              if (Array.isArray(goalIds)) {
                  goalIds.forEach((goalId: string) => {
                      const m = currentLookup[goalId];
                      if (m && m.files) {
                          const pdfFiles = m.files
                              .filter((f: any) => (f.url || f.fileUrl)?.toLowerCase().includes('.pdf'))
                              .map((f: any) => ({
                                  ...f,
                                  url: f.url || f.fileUrl,
                                  goalContext: m.title
                              }));
                          relatedMaterials.push(...pdfFiles);
                      }
                  });
              }
          });
      }

      return (
          <EditalNotebookModal 
            isOpen={true}
            onClose={() => {}} // Não gerencia fechamento globalmente
            planId={currentPlanId || ''}
            editalNodeId={targetTopic.id}
            topicTitle={targetTopic.name}
            type="note"
            materials={relatedMaterials}
            editalNode={targetTopic}
            metaLookup={currentLookup}
            isEmbedded={true}
          />
      );
  };

  const handleOpenMaterial = async (goal: StudentGoal, fileUrl: string) => {
    // Se estiver carregando o edital, aguarda a resolução
    if (isEdictLoading && prefetchPromiseRef.current) {
        console.log("🔄 Aguardando sincronização final do Edital para abrir material.");
        await prefetchPromiseRef.current;
    }

    // Tenta pegar do cache local se ainda for nulo
    const currentStructure = edictStructure;
    const currentLookup = metaLookup;

    if (!currentStructure) {
        toast.error("Processando dados do Edital... Tente novamente em instantes.", { icon: '⏳' });
        return;
    }

    const target = findTargetTopic(goal.topicId, goal.metaId, currentStructure.disciplines, goal.title, goal.discipline, currentLookup);
    
    if (target) {
        // Encontrou vínculo no Edital!
        const targetTopic = target.topic;
        const relatedMaterials: any[] = [];
        
        if (targetTopic.linkedGoals && metaLookup) {
            Object.keys(targetTopic.linkedGoals).forEach(category => {
                const goalIds = targetTopic.linkedGoals[category];
                if (Array.isArray(goalIds)) {
                    goalIds.forEach((goalId: string) => {
                        const m = metaLookup[goalId];
                        if (m && m.files) {
                            const pdfFiles = m.files
                                .filter((f: any) => (f.url || f.fileUrl)?.toLowerCase().includes('.pdf'))
                                .map((f: any) => ({
                                    ...f,
                                    url: f.url || f.fileUrl,
                                    goalContext: m.title
                                }));
                            relatedMaterials.push(...pdfFiles);
                        }
                    });
                }
            });
        }

        setNotebookModal({
            isOpen: true,
            nodeId: targetTopic.id,
            nodeTitle: targetTopic.name,
            type: 'note',
            materials: relatedMaterials,
            editalNode: targetTopic,
            initialPdfUrl: fileUrl
        });
    } else {
        // Não vinculado
        toast.error("Material não vinculado ao Edital Verticalizado", {
            icon: '⚠️',
            style: {
                borderRadius: '10px',
                background: '#18181b',
                color: '#fff',
                border: '1px solid #3f3f46'
            }
        });
    }
  };

  const handleReviewNow = (disciplineId: string, topicId: string, goalId?: string) => {
    let url = `/app/edict?highlightDiscipline=${disciplineId}&highlightTopic=${topicId}`;
    if (goalId) {
      url += `&highlightGoal=${goalId}`;
    }
    navigate(url);
  };

  const findTargetTopic = (
    topicId: string | undefined, 
    metaId: string | undefined, 
    disciplines: any[], 
    goalTitle?: string,
    disciplineName?: string,
    metaLookup?: Record<string, any>
  ): { topic: any, discipline: any } | null => {
    if (!disciplines || !Array.isArray(disciplines)) return null;

    const normalize = (str: string) => 
      str.normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .toLowerCase()
         .replace(/\s+/g, ' ')
         .trim();

    const targetTitle = goalTitle ? normalize(goalTitle) : null;
    const targetDisc = disciplineName ? normalize(disciplineName) : null;

    if (targetTitle) {
        console.log(`[DEBUG] Dashboard Normalizado: [${targetTitle}]`);
    }

    for (const disc of disciplines) {
      if (!disc.topics) continue;
      
      // Validação por Disciplina se disponível
      if (targetDisc && disc.name) {
          const discNameNorm = normalize(disc.name);
          // Se a meta tem disciplina, mas o edital é de outra, pula (evita falso positivo global)
          if (discNameNorm !== targetDisc && !discNameNorm.includes(targetDisc) && !targetDisc.includes(discNameNorm)) {
              continue;
          }
      }
      
      for (const topic of disc.topics) {
        const searchInTopic = (item: any): any => {
          // PRIORIDADE ABSOLUTA: Busca por Título da Meta (Match de String Limpa)
          if (targetTitle) {
              // Check metas array matches
              if (item.metas && Array.isArray(item.metas)) {
                  for (const m of item.metas) {
                      const mTitle = m.title || m.name;
                      if (mTitle) {
                          const editalTitle = normalize(String(mTitle));
                          console.log(`[DEBUG] Edital Normalizado: [${editalTitle}]`);
                          
                          if (editalTitle === targetTitle) {
                              console.log(`[DEBUG] RESULTADO DO MATCH: [SUCESSO] para o tópico [${item.name}]`);
                              return item;
                          }
                      }
                  }
              }

              // Check linkedGoals resolving IDs via metaLookup
              if (item.linkedGoals) {
                  const goalIds = Object.values(item.linkedGoals).flat() as string[];
                  for (const id of goalIds) {
                      const m = metaLookup ? metaLookup[id] : null;
                      if (m && (m.title || m.name)) {
                          const editalTitle = normalize(String(m.title || m.name));
                          console.log(`[DEBUG] Edital Normalizado (via linkedGoals ID ${id}): [${editalTitle}]`);
                          if (editalTitle === targetTitle) {
                              console.log(`[DEBUG] RESULTADO DO MATCH: [SUCESSO] (via Chave LinkedGoals Resolvida) para o tópico [${item.name}]`);
                              return item;
                          }
                      }
                  }
              }
          }

          // Busca em Subtópicos (Recursão Profunda)
          if (item.subtopics && Array.isArray(item.subtopics) && item.subtopics.length > 0) {
            for (const sub of item.subtopics) {
                const found = searchInTopic(sub);
                if (found) return found;
            }
          }
          return null;
        };

        const match = searchInTopic(topic);
        if (match) return { topic: match, discipline: disc };
      }
    }
    return null;
  };

  // Helper to count goals in a topic and its subtopics recursively
  const getTopicGoalStats = (topic: any, completedIds: Set<string>, completedTitles?: Set<string>, metaLookup?: Record<string, any>) => {
    let total = 0;
    let completed = 0;

    const normalize = (str: string) => 
      str.normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .toLowerCase()
         .replace(/\s+/g, ' ')
         .trim();

    const processTopic = (t: any) => {
      // Analisa linkedGoals
      if (t.linkedGoals) {
        Object.keys(t.linkedGoals).forEach((key: any) => {
          const ids = t.linkedGoals[key];
          
          if (Array.isArray(ids)) {
            ids.forEach(id => {
              if (id) {
                total++;
                let isDone = false;
                if (completedIds.has(String(id).trim())) isDone = true;
                
                if (!isDone && completedTitles && metaLookup && metaLookup[id]) {
                    const m = metaLookup[id];
                    const mTitle = m.title || m.name;
                    if (mTitle && completedTitles.has(normalize(String(mTitle)))) {
                        isDone = true;
                    }
                }
                
                if (isDone) completed++;
              }
            });
          } else if (typeof ids === 'string' && ids.trim()) {
             total++;
             let isDone = false;
             if (completedIds.has(ids.trim())) isDone = true;
             
             if (!isDone && completedTitles && metaLookup && metaLookup[ids]) {
                 const mTitle = metaLookup[ids].title || metaLookup[ids].name;
                 if (mTitle && completedTitles.has(normalize(String(mTitle)))) {
                     isDone = true;
                 }
             }
             
             if (isDone) completed++;
          }
        });
      }

      // Analisa array de metas se existir
      if (t.metas && Array.isArray(t.metas)) {
          t.metas.forEach((m: any) => {
              const mId = m.linkedGoalId || m.id;
              const mTitle = m.title || m.name;
              
              if (mId || mTitle) {
                  total++;
                  let isDone = false;
                  if (mId && completedIds.has(String(mId).trim())) isDone = true;
                  if (!isDone && mTitle && completedTitles && completedTitles.has(normalize(String(mTitle)))) isDone = true;
                  
                  if (isDone) completed++;
              }
          });
      }

      if (t.subtopics && Array.isArray(t.subtopics) && t.subtopics.length > 0) {
        t.subtopics.forEach(processTopic);
      }
    };

    processTopic(topic);
    return { total, completed };
  };

  const handleToggleComplete = async (goalToToggle: StudentGoal) => {
    const now = Date.now();
    if (lastToggleRef.current && lastToggleRef.current.id === goalToToggle.id && (now - lastToggleRef.current.time) < 1000) {
        return;
    }
    lastToggleRef.current = { id: goalToToggle.id, time: now };

    // 1. Encontra o estado ATUAL da meta na lista (antes da alteração)
    const currentGoal = todayGoals.find(g => g.id === goalToToggle.id) ||
                        overdueReviews.find(g => g.id === goalToToggle.id) ||
                        overdueGeneral.find(g => g.id === goalToToggle.id);
    
    if (!currentGoal) {
        return;
    }

    // 2. Determina o Status ALVO (Target)
    let targetStatusBoolean: boolean;

    // Lógica Inteligente:
    // Se o objeto 'goalToToggle' que veio do componente filho (Card) tem um status DIFERENTE do que está na lista atual,
    // significa que o componente filho (ex: Timer) está FORÇANDO um novo estado (ex: completou).
    if (goalToToggle.isCompleted !== currentGoal.isCompleted) {
        targetStatusBoolean = goalToToggle.isCompleted;
    } else {
        // Se são iguais, é um clique manual de alternância (Toggle)
        targetStatusBoolean = !currentGoal.isCompleted;
    }

    const targetStatusString = targetStatusBoolean ? 'completed' : 'pending';

    // 3. Atualização Otimista na UI (Refletindo o Target)
    const toggleInList = (list: StudentGoal[]) => list.map(g => 
        g.id === goalToToggle.id 
          ? { ...g, ...goalToToggle, isCompleted: targetStatusBoolean } // Merge seguro
          : g
    );
    
    let novaListaDeMetasAtualizada = todayGoals;

    if (todayGoals.some(g => g.id === goalToToggle.id)) {
        novaListaDeMetasAtualizada = toggleInList(todayGoals);
        setTodayGoals(novaListaDeMetasAtualizada);
    }
    else if (overdueReviews.some(g => g.id === goalToToggle.id)) setOverdueReviews(toggleInList(overdueReviews));
    else if (overdueGeneral.some(g => g.id === goalToToggle.id)) setOverdueGeneral(toggleInList(overdueGeneral));

    // 4. Persistência no Backend com Status Explícito
    if (currentUser && currentPlanId) {
        const mId = goalToToggle.metaId || goalToToggle.id;

        // I. SALVAR META (Backend Sync)
        await toggleGoalStatus(
            currentUser.uid, 
            currentPlanId, 
            goalToToggle.id, 
            currentGoal.isCompleted ? 'completed' : 'pending', // Status atual (para ref)
            true, // isManual flag
            targetStatusString // <--- O NOVO PARÂMETRO QUE IMPEDE A INVERSÃO
        );

        // II. ATUALIZAR EDITAL (Revalidação de Dados - Fetch-on-Click)
        // Buscamos a lista real do banco para garantir que o Edital e o Dashboard estejam 100% sincronizados
        const freshCompletedIds = await getStudentCompletedMetas(currentUser.uid, currentPlanId);
        
        // Atualiza estados locais e globais
        setCompletedMetaIds(freshCompletedIds);
        if (cachedData) {
            setCachedData({ ...cachedData, completedMetaIds: freshCompletedIds });
        }
        
        if (todayGoals.some(g => g.id === goalToToggle.id) && targetStatusBoolean) {
            checkAndUnlockSimulados(currentUser.uid, currentPlanId, undefined, undefined, freshCompletedIds);
            checkAndTriggerAnticipation(novaListaDeMetasAtualizada);
        }

        // III. VERIFICAR CONCLUSÃO DO TÓPICO -> DISPARAR POPUP (Gatilho Pós-Sincronia)
        // Somente após a confirmação do banco que as IDs frescas estão aqui
        
        // Reset da Referência de Bloqueio (Tarefa 3)
        if (!targetStatusBoolean && goalToToggle.topicId) {
            closedTopicModalsRef.current.delete(String(goalToToggle.topicId).trim());
        }

        if (!edictStructure) {
            console.log("[DEBUG] handleToggleComplete - edictStructure is NULL. Cannot check topic completion.");
        }

        if (targetStatusBoolean && (goalToToggle.topicId || mId) && edictStructure) {
            try {
                // Use IDs normalizados
                const normalizedTopicId = goalToToggle.topicId ? String(goalToToggle.topicId).trim() : null;
                const normalizedMetaId = mId ? String(mId).trim() : null;

                const firstFileUrl = goalToToggle.files?.[0]?.url || goalToToggle.files?.[0]?.fileUrl;
                
                const result = findTargetTopic(
                    normalizedTopicId, 
                    normalizedMetaId, 
                    edictStructure.disciplines, 
                    goalToToggle.title,
                    goalToToggle.discipline,
                    metaLookup // Injetando metaLookup para resolver os nomes dos linkedGoals
                );
                
                if (result) {
                    console.log(`[DEBUG] RESULTADO DO MATCH: [SUCESSO]`);
                    const { topic, discipline } = result;

                    // Prepara set de títulos concluídos para o check de 100%
                    const normalize = (str: string) => 
                      str.normalize("NFD")
                         .replace(/[\u0300-\u036f]/g, "")
                         .toLowerCase()
                         .replace(/\s+/g, ' ')
                         .trim();
                    const completedTitles = new Set<string>();
                    if (fullPlanData) {
                        const goalsArray = Array.isArray(fullPlanData) ? fullPlanData : 
                                         (fullPlanData.days ? Object.values(fullPlanData.days).flat() : []);
                        
                        (goalsArray as any[]).forEach((g: any) => {
                            if (freshCompletedIds.has(String(g.id)) && g.title) {
                                completedTitles.add(normalize(g.title));
                            }
                        });
                    }

                    const { total: editalTotal, completed: editalCompleted } = getTopicGoalStats(topic, freshCompletedIds, completedTitles, metaLookup);
                    
                    // Tarefa 1: Simplificação do Gatilho
                    const isCompleted = editalTotal > 0 && editalCompleted >= editalTotal;

                    if (isCompleted) {
                        const tId = String(topic.id).trim();
                        
                        // Verificação de Inteligência (Não mostrar se já agendado OU se fechou nesta sessão)
                        if (closedTopicModalsRef.current.has(tId)) return;

                        const allReviews = await courseReviewService.getReviewsByTopic(currentUser.uid, tId);
                        const existingTopicReviews = allReviews.filter(r => r.type === 'topic_revision');
                        
                        console.log(`[DEBUG] Triggering Celebration Modal for Topic: [${topic.name}]. Goals: ${editalCompleted}/${editalTotal}`);
                        
                        setTopicCompletionPayload({
                            planId: currentPlanId,
                            disciplineId: discipline.id,
                            disciplineName: discipline.name,
                            topicId: tId,
                            topicName: topic.name,
                            isAutoTriggered: true,
                            message: `Você concluiu todas as metas do tópico [${topic.name}]. Deseja agendar suas revisões agora?`
                        });
                    }
                } else {
                    console.log(`[DEBUG] RESULTADO DO MATCH: [FALHA] - Meta [${goalToToggle.title}] não localizada.`);
                }
            } catch (error) {
                console.error("Error checking topic completion:", error);
            }
        }
    }
  };

  const completedTodayCount = todayGoals.filter(g => g.isCompleted).length;
  const totalTodayCount = todayGoals.length;
  const progress = totalTodayCount > 0 ? (completedTodayCount / totalTodayCount) * 100 : 0;

  // --- RENDERIZAÇÃO DA ABA DE MENTORIA ---
  if (currentTab === 'mentorship') {
      return (
          <div className="relative w-full min-h-screen bg-zinc-950 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
            {fullPlanData && !isMentorshipPlayerActive && (
              <PlanHeroBanner currentTab="mentorship" planData={fullPlanData} />
            )}
            <div className={`relative z-10 w-full max-w-[1600px] mx-auto px-4 md:px-8 flex-1 flex flex-col mb-10 ${isMentorshipPlayerActive ? 'pt-0 mt-0' : 'pt-8 md:pt-12 -mt-10 md:-mt-20'}`}>
              <StudentMentorshipViewer 
                planId={currentPlanId} 
                onActiveModuleChange={setIsMentorshipPlayerActive}
              />
            </div>
          </div>
      );
  }

  // --- RENDERIZAÇÃO DA ABA DE CALL (CHAT) ---
  if (currentTab === 'call') {
      const mentorId = searchParams.get('mentorId');
      return (
          <div className="relative w-full h-[calc(100vh-140px)] bg-zinc-950 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            {fullPlanData && (
              <div className="shrink-0">
                <PlanHeroBanner currentTab="call" planData={fullPlanData} />
              </div>
            )}
            <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 md:px-8 flex-1 flex flex-col overflow-hidden py-4">
              <StudentChatView 
                planId={currentPlanId} 
                linkedMentorIds={fullPlanData?.linkedMentors || []} 
                initialMentorId={mentorId}
              />
            </div>
          </div>
      );
  }

  // --- RENDERIZAÇÃO DA ABA DE SIMULADOS ---
  if (currentTab === 'simulados') {
      return (
          <div className="relative w-full min-h-screen bg-zinc-950 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
            {fullPlanData && (
              <PlanHeroBanner currentTab="simulados" planData={fullPlanData} />
            )}
            <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 md:px-8 flex-1 flex flex-col mb-10 pt-16 md:pt-24 -mt-10 md:-mt-20">
              <SimuladosTabContent 
                planId={currentPlanId} 
                simuladosVinculados={fullPlanData?.simuladosVinculados} 
              />
            </div>
          </div>
      );
  }

  if (currentTab === 'live') {
      return (
          <div className="relative w-full min-h-screen bg-zinc-950 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
            {fullPlanData && (
              <PlanHeroBanner currentTab="live" planData={fullPlanData} />
            )}
            <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 md:px-8 flex-1 flex flex-col mb-10 pt-16 md:pt-24 -mt-10 md:-mt-20">
              <LiveEventsTabContent planId={currentPlanId} />
            </div>
          </div>
      );
  }

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
              <Loader2 size={40} className="animate-spin text-[var(--plan-theme)]" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Carregando cronograma...</p>
          </div>
      );
  }

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* PWA INSTALL BANNER */}
      {isInstallable && (
        <div className="mx-auto max-w-[1600px] px-4 md:px-8 pt-4">
          <div className="bg-brand-red/10 border border-brand-red/20 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-4 text-center sm:text-left text-white">
              <div className="p-3 bg-brand-red rounded-xl shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider">Acesse como Aplicativo</h4>
                <p className="text-xs text-zinc-400 font-medium">Instale para uma experiência mais fluida e acesso instantâneo.</p>
              </div>
            </div>
            <button 
              onClick={installApp}
              className="w-full sm:w-auto px-6 py-3 bg-white text-black font-black uppercase text-[11px] tracking-widest rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              INSTALAR AGORA
            </button>
          </div>
        </div>
      )}

      
      {/* HERO BANNER */}
      {fullPlanData && (
        <PlanHeroBanner currentTab="today" planData={fullPlanData} />
      )}

      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 md:px-8 pt-8 md:pt-12 flex-1 flex flex-col mb-10 -mt-10 md:-mt-20">

      {/* OVERLAY MODO FOCO (COM ACESSO AO PDF CORRIGIDO) */}
      {activeAnnouncement && currentUser && (
        <AnnouncementPopUp 
          announcement={activeAnnouncement} 
          userId={currentUser.uid}
          onClose={() => setActiveAnnouncement(null)}
        />
      )}

      {isExamMode && activeSimulado && (
          <SimuladoFocusMode 
              simulado={{
                  id: (activeSimulado as any).docId || activeSimulado.id,
                  title: activeSimulado.title,
                  duration: activeSimulado.duration || 240, // Em minutos
                  
                  // CORREÇÃO DEFINITIVA: Fallback em cascata (Procura a URL em todos os lugares possíveis)
                  pdfUrl: activeSimulado.files?.[0]?.url || 
                          (activeSimulado as any).pdfUrl || 
                          (activeSimulado as any).bookletUrl || 
                          (activeSimulado as any).arquivoProvaUrl
              }}
              onClose={() => setIsExamMode(false)}
              onComplete={handleCompleteSimulado}
          />
      )}

      {/* REVISÕES ESPAÇADAS (NOVO SISTEMA) */}
      {currentPlanId && (
        <div className="mb-10">
          <CourseReviewDashboard 
            planId={currentPlanId} 
            onReviewNow={handleReviewNow} 
          />
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="relative">
          {isScholarship && (
            <div className="absolute -top-6 left-0 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded border border-blue-400/30 shadow-lg shadow-blue-900/20 animate-in slide-in-from-top-2 duration-500 uppercase tracking-widest">
              Aluno Bolsista
            </div>
          )}
          <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none mb-2">
            Hoje
          </h1>
          <div className="flex flex-col">
            <span className="text-sm md:text-base font-black text-zinc-500 uppercase tracking-widest">
              {weekday}
            </span>
            <span className="text-xl md:text-2xl font-black text-[var(--plan-theme)] uppercase tracking-tighter">
              {dayAndMonth}
            </span>
          </div>
        </div>

        {/* Progress Summary */}
        {totalTodayCount > 0 && (
            <div className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
                <div className="relative w-12 h-12">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-800" />
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-[var(--plan-theme)]" strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * progress) / 100} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                        {Math.round(progress)}%
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-2xl font-black text-white leading-none">
                        {completedTodayCount}<span className="text-zinc-600 text-lg">/{totalTodayCount}</span>
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Metas Concluídas
                    </span>
                </div>
            </div>
        )}
      </div>

      {/* CTA ROLLING WINDOW */}
      {((lastScheduledDate && !isPlanCompleted && !hasFuturePendingGoals && todayGoals.every(g => g.isCompleted)) || 
        (lastScheduledDate && !isPlanCompleted && new Date(lastScheduledDate) < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))) && (
        <div className="mb-8 bg-gradient-to-r from-[var(--plan-theme)]/20 to-transparent border border-[var(--plan-theme)]/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-4">
                <div className="p-4 bg-[var(--plan-theme)]/20 text-[var(--plan-theme)] rounded-full">
                    <Trophy size={28} />
                </div>
                <div>
                    <h3 className="text-white font-black text-xl uppercase tracking-tighter">Parabéns! Você concluiu seu ciclo atual.</h3>
                    <p className="text-zinc-400 text-sm mt-1">Suas metas agendadas acabaram ou foram concluídas antecipadamente. Libere as próximas metas para continuar evoluindo.</p>
                </div>
            </div>
            <button 
                onClick={handleGenerateNextWeeks}
                disabled={isGeneratingNext}
                className="w-full md:w-auto px-8 py-4 bg-[var(--plan-theme)] hover:brightness-110 text-white font-black text-sm rounded-xl uppercase tracking-wider transition-all shadow-lg shadow-[var(--plan-theme)]/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {isGeneratingNext ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Gerando...</>
                ) : (
                    <><RefreshCw className="w-5 h-5" /> Gerar Próximas Metas</>
                )}
            </button>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/40 w-fit px-3 py-1.5 rounded-lg border border-zinc-800/50">
          <Clock size={12} className="text-[var(--plan-theme)]" />
          Cronograma otimizado para a semana atual (até Sábado).
      </div>

      {/* --- SEÇÃO DE ATRASOS (NOVA) --- */}
      <DelayedGoalsSection 
        overdueReviews={overdueReviews}
        overdueGeneral={overdueGeneral}
        onReplan={handleReplanDelays}
        isReplanning={isReplanning}
        onToggleComplete={handleToggleComplete}
        onRefresh={fetchSchedule}
        onPdfClick={handleOpenMaterial}
        renderNotebookNode={renderEmbeddedNotebook}
      />

      {/* --- SEÇÃO 1: REVISÕES ESPAÇADAS (OCULTA SE HOUVER ATRASOS PARA EVITAR DUPLICIDADE) --- */}
      
      {/* --- SEÇÃO 2: OUTRAS METAS EM ATRASO (OCULTA SE HOUVER ATRASOS) --- */}
      
      {/* SEÇÃO 3: METAS DE HOJE */}
      <section>
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <LayoutDashboard size={16} /> Metas Agendadas Para Hoje
        </h3>

        {todayGoals.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
                {currentPlanId && !lastScheduledDate ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                        <div className="mb-4 p-4 rounded-full bg-[var(--plan-theme)]/10 border border-[var(--plan-theme)]/20 text-[var(--plan-theme)]">
                            <CheckCircle2 size={32} />
                        </div>
                        <h3 className="text-lg font-black uppercase text-white tracking-tight">Seu plano está ativo!</h3>
                        <p className="text-xs font-medium text-zinc-500 max-w-sm text-center mt-2 px-6">
                            Agora, clique em <strong className="text-white">&apos;Gerar Cronograma&apos;</strong> na aba <strong className="text-white">Configurações</strong> para montar sua rotina.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="mb-4 p-4 rounded-full bg-zinc-900 border border-zinc-800">
                            <Coffee size={32} className="text-zinc-500" />
                        </div>
                        <h3 className="text-lg font-black uppercase text-zinc-400 tracking-tight">Tudo Limpo!</h3>
                        <p className="text-xs font-medium text-zinc-500 max-w-xs text-center mt-1">
                            Você não tem mais metas para hoje.
                        </p>
                    </>
                )}
            </div>
        ) : (
            <div className="flex flex-col gap-8">
                {/* PILAR 3: Desestruturação de Renderização (Ações Livres) */}
                {todayGoals.some(g => g.type === 'free_study' || g.isFreeStudy) && (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center gap-3">
                            <PlusCircle size={16} className="text-emerald-500" />
                            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Ações Livres</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {todayGoals.filter(g => g.type === 'free_study' || g.isFreeStudy).map(goal => (
                                <StudentGoalCard 
                                    key={goal.id}
                                    goal={goal} 
                                    onToggleComplete={(g) => handleToggleComplete(g)}
                                    onRefresh={fetchSchedule}
                                    onPdfClick={handleOpenMaterial}
                                    renderNotebookNode={renderEmbeddedNotebook}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* SESSÃO OFICIAL (Trilha Programada) */}
                <div className="flex flex-col gap-1 mt-2">
                    {todayGoals.some(g => g.type !== 'free_study' && !g.isFreeStudy) && (
                         <div className="flex items-center gap-3 mb-4">
                            <LayoutDashboard size={16} className="text-zinc-500" />
                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Trilha Programada</h3>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {todayGoals.filter(g => g.type !== 'free_study' && !g.isFreeStudy).map((goal) => {
                            const isNewCycle = goal.isNewCycle;
                            const isNewTopic = goal.isNewTopic;
                            
                            return (
                                <React.Fragment key={goal.id}>
                                    {isNewCycle && (
                                        <div className="col-span-full flex flex-col items-center my-4 opacity-90 px-1">
                                            <div className="w-full h-px border-t border-solid border-white/40 mb-1"></div>
                                            <span className="text-[10px] text-white/80 font-bold text-center uppercase tracking-widest">
                                                {goal.cycleName ? `INÍCIO: ${goal.cycleName}` : "NOVO CICLO"}
                                            </span>
                                            <div className="w-full h-px border-t border-solid border-white/40 mt-1"></div>
                                        </div>
                                    )}
                                    {isNewTopic && (
                                        <div className="col-span-full flex items-center gap-4 my-2">
                                            <div className="h-px border-t border-dashed border-[var(--plan-theme)]/30 flex-1"></div>
                                            <div className="flex flex-col items-center text-center px-4">
                                                <span className="text-[9px] font-black text-[var(--plan-theme)] uppercase tracking-[0.2em]">Novo Tópico</span>
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">{goal.discipline}</span>
                                                <span className="text-[11px] font-black text-zinc-200 uppercase tracking-tight mt-0.5 leading-tight">{goal.topic}</span>
                                            </div>
                                            <div className="h-px border-t border-dashed border-[var(--plan-theme)]/30 flex-1"></div>
                                        </div>
                                    )}
                                    <StudentGoalCard 
                                        goal={goal} 
                                        onToggleComplete={(g) => handleToggleComplete(g)}
                                        onRefresh={fetchSchedule}
                                        onPdfClick={handleOpenMaterial}
                                        renderNotebookNode={renderEmbeddedNotebook}
                                        onStart={goal.type === 'simulado' ? handleStartSimulado : undefined}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
      </section>

      {/* --- SEÇÃO DE SIMULADOS (NOVO) --- */}
      {computedSimulados.scheduled.length > 0 && (
          <section className="mt-12 mb-10 animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-green-500 uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-green-500" />
                      SIMULADOS AGENDADOS
                  </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {computedSimulados.scheduled.map(sim => (
                      <SimuladoDashboardCard 
                          key={sim.id} 
                          simulado={sim} 
                      />
                  ))}
              </div>
          </section>
      )}

      {(computedSimulados.released.length > 0 || computedSimulados.blocked.length > 0) && (
          <section className="mt-12 mb-10 animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Trophy size={14} className="text-zinc-400" />
                      SIMULADOS
                  </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {computedSimulados.released.map(sim => (
                      <SimuladoDashboardCard 
                          key={sim.id} 
                          simulado={sim} 
                          onSchedule={(id) => setShowScheduleModal(id)} 
                      />
                  ))}
                  {computedSimulados.blocked.map(sim => (
                      <SimuladoDashboardCard 
                          key={sim.id} 
                          simulado={sim} 
                      />
                  ))}
              </div>
          </section>
      )}

      {/* MODAL DE AGENDAMENTO DE SIMULADO */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Agendar Simulado</h3>
                    <button onClick={() => setShowScheduleModal(null)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Escolha a Data</label>
                        <input 
                            type="date" 
                            className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl p-3 focus:outline-none focus:border-[var(--plan-theme)] font-mono uppercase"
                            value={simuladoDate}
                            onChange={(e) => setSimuladoDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]} // Min Today
                        />
                        <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                            Este simulado ocupará o dia inteiro no seu cronograma. Outras metas deste dia serão empurradas para frente.
                        </p>
                    </div>

                    <button 
                        onClick={handleScheduleSimuladoConfirm}
                        disabled={!simuladoDate}
                        className="w-full py-3 bg-[var(--plan-theme)] hover:brightness-110 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[var(--plan-theme)]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirmar Agendamento
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* SOLICITAÇÃO 2: POPUP DE CONFIRMAÇÃO DE INÍCIO */}
      {examToConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#1a1d24] p-8 rounded-2xl w-full max-w-lg border border-[var(--plan-theme)]/30 shadow-[0_0_50px_rgba(var(--plan-theme-rgb),0.2)]">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-[var(--plan-theme)]/10 rounded-full flex items-center justify-center mb-6 text-[var(--plan-theme)] border border-[var(--plan-theme)]/20">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-white font-black text-2xl uppercase mb-2">Atenção!</h3>
                    <p className="text-gray-300 text-sm leading-relaxed mb-6">
                        Você está prestes a iniciar o simulado <strong>{examToConfirm.title}</strong>.
                        <br/><br/>
                        <span className="text-[var(--plan-theme)] font-bold block bg-[var(--plan-theme)]/10 p-2 rounded">
                            O cronômetro iniciará imediatamente e NÃO poderá ser pausado.
                        </span>
                    </p>
                    
                    <div className="flex flex-col w-full gap-3">
                        <button 
                            onClick={handleConfirmStart}
                            className="w-full py-4 bg-[var(--plan-theme)] hover:brightness-110 text-white font-black text-sm rounded-xl uppercase tracking-wider transition-all shadow-lg shadow-[var(--plan-theme)]/20"
                        >
                            Estou pronto, Iniciar Agora
                        </button>
                        <button 
                            onClick={() => setExamToConfirm(null)}
                            className="w-full py-3 bg-transparent border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white font-bold text-sm rounded-xl uppercase tracking-wider transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL DE ANTECIPAÇÃO (CELEBRAÇÃO) */}
      {showAnticipateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#111111] border border-emerald-500/30 rounded-xl p-6 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Parabéns! Missão do dia cumprida.</h3>
            <p className="text-gray-400 mb-6">
              Você ainda possui <strong className="text-emerald-500">{availableTimeForAnticipation} minutos</strong> livres de estudos hoje. Deseja antecipar metas para hoje?
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setShowAnticipateModal(false)}
                className="flex-1 py-3 px-4 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 transition"
              >
                Encerrar por Hoje
              </button>
              <button 
                onClick={handleConfirmAnticipation}
                disabled={isAnticipating}
                className="flex-1 py-3 px-4 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition disabled:opacity-50"
              >
                {isAnticipating ? 'Antecipando...' : 'Sim, Antecipar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CELEBRAÇÃO DE TÓPICO */}
      <TopicCompletionModal 
        isOpen={!!topicCompletionPayload}
        topicName={topicCompletionPayload?.topicName || ''}
        onClose={() => {
            if (topicCompletionPayload?.topicId) {
                closedTopicModalsRef.current.add(topicCompletionPayload.topicId);
            }
            setTopicCompletionPayload(null);
        }}
        onConfirm={() => {
            setPendingTopicReview(topicCompletionPayload);
            setTopicCompletionPayload(null);
        }}
      />

      {/* MODAL DE REVISÃO ESPAÇADA (DIRETRIZ ESTRITA - MONTADO NO DASHBOARD) */}
      {/* Spaced Review Modal (GERENCIADO VIA CONTEXTO) */}
      </div>

      {/* MODAL DE CADERNO DE ANOTAÇÕES (EDIIAL VERTICALIZADO) */}
      {notebookModal.isOpen && (
          <EditalNotebookModal 
            isOpen={notebookModal.isOpen}
            onClose={() => setNotebookModal(prev => ({ ...prev, isOpen: false }))}
            planId={currentPlanId}
            editalNodeId={notebookModal.nodeId}
            topicTitle={notebookModal.nodeTitle}
            type={notebookModal.type}
            materials={notebookModal.materials}
            editalNode={notebookModal.editalNode}
            metaLookup={metaLookup}
            initialPdfUrl={notebookModal.initialPdfUrl}
          />
      )}
    </div>
  );
};

export default StudentDashboard;
