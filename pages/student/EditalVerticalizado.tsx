/* eslint-disable react/prop-types */
import React, { useEffect, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, Loader2, ChevronDown, ChevronUp, CheckCircle2, Layout, BookOpen, X, ClipboardList
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getEdict, EdictStructure } from '../../services/edictService';
import { getStudentConfig, getStudentCompletedMetas, toggleGoalStatus } from '../../services/studentService';
import { getPlanById } from '../../services/planService';
import { getAllPlanMetas, Meta } from '../../services/metaService';
import TopicItem from '../../components/student/edital/TopicItem';
import DisciplineItem from '../../components/student/edital/DisciplineItem';
import { useEditalProgress } from '../../hooks/useEditalProgress';
import { useSpacedReviewModal } from '../../contexts/SpacedReviewModalContext';
import { courseReviewService } from '../../services/courseReviewService';
import { fetchFullPlanData } from '../../services/scheduleService';
import { PlanHeroBanner } from '../../components/student/PlanHeroBanner';
import { EditalNotebookModal } from '../../components/student/tools/EditalNotebookModal';
import { EditalFlashcardsModal } from '../../components/student/tools/EditalFlashcardsModal';
import { EditalMindMapsModal } from '../../components/student/tools/EditalMindMapsModal';
import { NoteType } from '../../services/notebookService';
import { useEdictData } from '../../contexts/EdictDataContext';

// EditalVerticalizado component starts here

const EditalVerticalizado: React.FC = () => {
  const { currentUser } = useAuth();
  const { openSpacedReviewModal } = useSpacedReviewModal();
  const { data: cachedData, setData: setCachedData } = useEdictData();
  const [searchParams] = useSearchParams();
  const highlightDisciplineId = searchParams.get('highlightDiscipline');
  const highlightTopicId = searchParams.get('highlightTopic') || searchParams.get('focusTopicId') || searchParams.get('topicId') || searchParams.get('highlightTopicId');
  const highlightGoalId = searchParams.get('highlightGoal') || searchParams.get('highlightGoalId') || searchParams.get('goalId');
  
  // Data State
  const [structure, setStructure] = useState<EdictStructure | null>(cachedData?.structure || null);
  const [completedMetaIds, setCompletedMetaIds] = useState<Set<string>>(cachedData?.completedMetaIds || new Set());
  const [activeUserMode, setActiveUserMode] = useState(cachedData?.activeUserMode || false);
  const [planTitle, setPlanTitle] = useState(cachedData?.planTitle || '');
  const [planId, setPlanId] = useState<string | null>(cachedData?.planId || null);
  
  // Meta Lookup (ID -> Meta Object) for detailed rendering
  const [metaLookup, setMetaLookup] = useState<Record<string, Meta>>(cachedData?.metaLookup || {});
  
  // UI State
  const [loading, setLoading] = useState(!cachedData);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [activeHighlightTopic, setActiveHighlightTopic] = useState<string | null>(null);
  const [activeHighlightGoal, setActiveHighlightGoal] = useState<string | null>(null);
  const [fullPlanData, setFullPlanData] = useState<any>(cachedData?.fullPlanData || null);
  
  // Trigger spaced review
  const [pendingTopicReview, setPendingTopicReview] = useState<any>(null);

  // Sincronização de Estado: Garante que se o Dashboard marcar uma meta, o Edital reflita
  useEffect(() => {
    if (cachedData?.completedMetaIds) {
      setCompletedMetaIds(cachedData.completedMetaIds);
    }
  }, [cachedData?.completedMetaIds]);

  useEffect(() => {
    if (pendingTopicReview) {
      openSpacedReviewModal(pendingTopicReview);
      setPendingTopicReview(null);
    }
  }, [pendingTopicReview, openSpacedReviewModal]);

  // Video Player State
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  // --- NOTEBOOK STATE ---
  const [noteModal, setNoteModal] = useState<{
    isOpen: boolean;
    nodeId: string;
    nodeTitle: string;
    type: NoteType;
    materials: any[];
    editalNode?: any;
    metaLookup?: Record<string, Meta>;
    initialPdfUrl?: string | null;
  }>({
    isOpen: false,
    nodeId: '',
    nodeTitle: '',
    type: 'note',
    materials: [],
    initialPdfUrl: null
  });

  const [flashcardModal, setFlashcardModal] = useState({
    isOpen: false,
    nodeId: '',
    nodeTitle: ''
  });

  const [mindMapModal, setMindMapModal] = useState({
    isOpen: false,
    nodeId: '',
    nodeTitle: ''
  });

  const openNotebook = useCallback((nodeId: string, nodeTitle: string, type: NoteType, linkedGoals?: any, nodeData?: any, initialPdfUrl?: string) => {
    // 1. Coleta Profunda de Materiais (PDFs) em todas as categorias de metas
    const relatedMaterials: any[] = [];
    
    // Fallback: Se por algum motivo linkedGoals vier vazio, tenta buscar na estrutura carregada
    let goalsToScan = linkedGoals;
    if ((!goalsToScan || Object.keys(goalsToScan).length === 0) && structure) {
        for (const disc of structure.disciplines) {
            for (const topic of disc.topics) {
                if (topic.id === nodeId) {
                    goalsToScan = topic.linkedGoals;
                    break;
                }
                for (const sub of topic.subtopics) {
                    if (sub.id === nodeId) {
                        goalsToScan = sub.linkedGoals;
                        break;
                    }
                }
                if (goalsToScan) break;
            }
            if (goalsToScan) break;
        }
    }

    if (goalsToScan && metaLookup) {
        // Itera sobre todas as categorias de metas vinculadas (lesson, material, law, questions, etc)
        Object.keys(goalsToScan).forEach(category => {
            const goalIds = goalsToScan[category];
            if (Array.isArray(goalIds)) {
                goalIds.forEach((goalId: string) => {
                    const goal = metaLookup[goalId];
                    if (goal && goal.files && goal.files.length > 0) {
                        // Extração assistida de PDFs (suporta links com query params como FB storage)
                        const pdfFiles = goal.files
                            .filter((f: any) => (f.url || f.fileUrl)?.toLowerCase().includes('.pdf'))
                            .map((f: any) => ({
                                ...f,
                                url: f.url || f.fileUrl,
                                goalContext: goal.title // Útil para o aluno saber de qual meta veio o PDF
                            }));
                        
                        if (pdfFiles.length > 0) {
                            relatedMaterials.push(...pdfFiles);
                        }
                    }
                });
            }
        });
    }

    setNoteModal({
      isOpen: true,
      nodeId,
      nodeTitle,
      type,
      materials: relatedMaterials,
      editalNode: nodeData,
      metaLookup,
      initialPdfUrl: initialPdfUrl || null
    });
  }, [structure, metaLookup]);

  // === HOOK DE PROGRESSO (ANALYTICS) ===
  const stats = useEditalProgress(structure, completedMetaIds);

  // === INITIALIZATION ===
  useEffect(() => {
    // Se já temos dados em cache, não recarrega do banco
    if (cachedData) {
        console.log("♻️ Usando dados do Edital em Memória");
        return;
    }

    const init = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // 1. Get Current Plan ID
            const config = await getStudentConfig(currentUser.uid);
            const currentPlanId = config?.currentPlanId;

            if (!currentPlanId) {
                setLoading(false);
                return;
            }
            setPlanId(currentPlanId);

            // 2. Parallel Fetch
            const [edictData, completedIds, planData, allMetas] = await Promise.all([
                getEdict(currentPlanId),
                getStudentCompletedMetas(currentUser.uid, currentPlanId),
                getPlanById(currentPlanId),
                getAllPlanMetas(currentPlanId) // Fetch all metas to populate lookup
            ]);

            const fullPlan = await fetchFullPlanData(currentPlanId);

            // Build Lookup
            const lookup: Record<string, Meta> = {};
            allMetas.forEach(m => {
                if (m.id) lookup[m.id] = m;
            });

            // Update States
            setStructure(edictData);
            setCompletedMetaIds(completedIds);
            setFullPlanData(fullPlan);
            if (planData) {
                setPlanTitle(planData.title);
                setActiveUserMode(planData.isActiveUserMode || false);
            }
            setMetaLookup(lookup);

            // Cache Data
            setCachedData({
                structure: edictData,
                completedMetaIds: completedIds,
                planTitle: planData?.title || '',
                activeUserMode: planData?.isActiveUserMode || false,
                planId: currentPlanId,
                metaLookup: lookup,
                fullPlanData: fullPlan
            });

        } catch (error) {
            console.error("Erro ao carregar edital:", error);
        } finally {
            setLoading(false);
        }
    };

    init();
  }, [currentUser, cachedData, setCachedData]);

  // === AUTO-EXPAND FOR FOCUS TOPIC OR GOAL (Sincronização Data-Ready) ===
  useEffect(() => {
    // Trava de Segurança: Só executa se tiver os parâmetros E a estrutura do edital já existir
    if ((highlightDisciplineId || highlightTopicId || highlightGoalId) && structure && structure.disciplines.length > 0) {
        console.log("🎯 Iniciando Sincronização Data-Ready:", { highlightDisciplineId, highlightTopicId, highlightGoalId });
        
        let targetTopicId = highlightTopicId ? String(highlightTopicId) : null;
        let targetDisciplineId = highlightDisciplineId ? String(highlightDisciplineId) : null;
        const targetGoalId = highlightGoalId ? String(highlightGoalId) : null;

        // 1. FALLBACK: BUSCA RECURSIVA BLINDADA (Se faltar IDs na trilha)
        if (targetGoalId && (!targetTopicId || !targetDisciplineId)) {
             const findTopicByMetaId = (metaId: string, disciplines: any[]) => {
                for (const disc of disciplines) {
                    for (const topic of disc.topics) {
                        const check = (t: any): any => {
                            if (t.linkedGoals) {
                                const allIds = Object.values(t.linkedGoals).flat().map(String);
                                if (allIds.includes(String(metaId))) return { topicId: String(t.id), disciplineId: String(disc.id) };
                            }
                            if (t.subtopics) {
                                for (const sub of t.subtopics) {
                                    const res = check(sub);
                                    if (res) return res;
                                }
                            }
                            return null;
                        };
                        const found = check(topic);
                        if (found) return found;
                    }
                }
                return null;
            };
            const found = findTopicByMetaId(targetGoalId, structure.disciplines);
            if (found) {
                if (!targetTopicId) targetTopicId = found.topicId;
                if (!targetDisciplineId) targetDisciplineId = found.disciplineId;
            }
        } else if (targetTopicId && !targetDisciplineId) {
            const discipline = structure.disciplines.find(d => 
                d.topics.some(t => {
                    const check = (topic: any): boolean => {
                        if (String(topic.id) === String(targetTopicId)) return true;
                        if (topic.subtopics) return topic.subtopics.some(check);
                        return false;
                    };
                    return check(t);
                })
            );
            if (discipline) targetDisciplineId = String(discipline.id);
        }

        // 2. SINCRONIZAÇÃO DE ESTADOS RECURSIVOS
        if (targetDisciplineId) {
            setExpandedDisciplines(prev => new Set(prev).add(String(targetDisciplineId)));
        }
        if (targetTopicId) {
            setExpandedTopics(prev => new Set(prev).add(String(targetTopicId)));
            setActiveHighlightTopic(String(targetTopicId));
        }
        if (targetGoalId) {
            setActiveHighlightGoal(String(targetGoalId));
        }

        // 3. AJUSTE DE DELAY E SCROLL (MOUNTING WAIT)
        const scrollTimer = setTimeout(() => {
            const elId = targetGoalId ? `goal-${targetGoalId}` : (targetTopicId ? `topic-${targetTopicId}` : null);
            if (elId) {
                const el = document.getElementById(elId);
                if (el) {
                    console.log("🚀 Elemento encontrado, aplicando scroll:", elId);
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    console.warn("⚠️ Elemento não encontrado para scroll:", elId);
                }
            }
        }, 700);

        // Cleanup effect e URL após 8 segundos
        const timer = setTimeout(() => {
            setActiveHighlightTopic(null);
            setActiveHighlightGoal(null);
            
            // Limpa os parâmetros da URL para não re-expandir em refresh
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('highlightDiscipline');
            newParams.delete('highlightTopic');
            newParams.delete('highlightGoal');
            newParams.delete('highlightTopicId');
            newParams.delete('highlightGoalId');
            newParams.delete('topicId');
            newParams.delete('goalId');
            newParams.delete('focusTopicId');
            // setSearchParams(newParams, { replace: true }); // Comentado para evitar loops se necessário, mas idealmente ativo
        }, 8000);

        return () => {
            clearTimeout(scrollTimer);
            clearTimeout(timer);
        };
    }
  }, [structure, searchParams]);
  // === HANDLERS ===

  const handleToggleGoal = useCallback(async (goal: Meta) => {
    if (!currentUser || !planId || !goal.id) return;

    // Optimistic Update
    const isNowCompleted = !completedMetaIds.has(goal.id);
    const newSet = new Set(completedMetaIds);
    if (isNowCompleted) newSet.add(goal.id);
    else newSet.delete(goal.id);
    setCompletedMetaIds(newSet);

    // Sync context to keep memory updated
    if (cachedData) {
        setCachedData({ ...cachedData, completedMetaIds: newSet });
    }

    try {
        // Persist to DB (Manual toggle)
        await toggleGoalStatus(
            currentUser.uid, 
            planId, 
            goal.id, 
            isNowCompleted ? 'completed' : 'pending', 
            true, // isManual
            undefined,
            goal // Pass goal data for review trigger fallback
        );

        // --- CHECK FOR TOPIC COMPLETION ---
        if (isNowCompleted && structure) {
            // 1. Find the topic this goal belongs to
            const findTopicByMetaId = (metaId: string, disciplines: any[]) => {
                for (const disc of disciplines) {
                    for (const topic of disc.topics) {
                        const check = (t: any): any => {
                            if (t.linkedGoals) {
                                const allIds = Object.values(t.linkedGoals).flat().map(String);
                                if (allIds.includes(metaId)) return { topic: t, discipline: disc };
                            }
                            if (t.subtopics) {
                                for (const sub of t.subtopics) {
                                    const res = check(sub);
                                    if (res) return res;
                                }
                            }
                            return null;
                        };
                        const found = check(topic);
                        if (found) return found;
                    }
                }
                return null;
            };

            const target = findTopicByMetaId(goal.id, structure.disciplines);
            
            if (target) {
                const { topic, discipline } = target;
                
                // 2. Calculate Stats
                const getStats = (t: any, completedIds: Set<string>) => {
                    let total = 0;
                    let completed = 0;
                    const process = (item: any) => {
                        if (item.linkedGoals) {
                            Object.values(item.linkedGoals).forEach((ids: any) => {
                                if (Array.isArray(ids)) {
                                    ids.forEach(id => {
                                        total++;
                                        if (completedIds.has(String(id))) completed++;
                                    });
                                }
                            });
                        }
                        if (item.subtopics) item.subtopics.forEach(process);
                    };
                    process(t);
                    return { total, completed };
                };

                const currentCompleted = new Set(newSet);
                const { total: editalTotal, completed: editalCompleted } = getStats(topic, currentCompleted);
                
                // 3. Check Full Plan too
                let planTotal = 0;
                let planCompleted = 0;
                if (fullPlanData && fullPlanData.disciplines) {
                    const searchTopicId = String(topic.id || '');
                    const searchTopicName = String(topic.name || '').trim().toLowerCase();
                    const searchDiscipline = String(discipline.name || '').trim().toLowerCase();

                    fullPlanData.disciplines.forEach((disc: any) => {
                        const discName = String(disc.name || disc.title || '').trim().toLowerCase();
                        const isSameDisc = !searchDiscipline || !discName || discName.includes(searchDiscipline) || searchDiscipline.includes(discName);
                        
                        if (isSameDisc) {
                            disc.topics?.forEach((t: any) => {
                                const tId = String(t.id || '');
                                const tName = String(t.name || t.title || '').trim().toLowerCase();
                                const isMatch = (searchTopicId && tId === searchTopicId) ||
                                                (searchTopicName && tName && (searchTopicName.includes(tName) || tName.includes(searchTopicName)));
                                
                                if (isMatch && t.metas) {
                                    t.metas.forEach((m: any) => {
                                        planTotal++;
                                        if (currentCompleted.has(String(m.id))) planCompleted++;
                                    });
                                }
                            });
                        }
                    });
                }

                const isEditalComplete = editalTotal > 0 && editalCompleted >= editalTotal;
                const isPlanComplete = planTotal > 0 && planCompleted >= planTotal;
                
                if (isEditalComplete && isPlanComplete) {
                    // Check for existing reviews of type 'topic_revision'
                    const allReviews = await courseReviewService.getReviewsByTopic(currentUser.uid, String(topic.id));
                    const existingTopicReviews = allReviews.filter(r => r.type === 'topic_revision');

                    if (existingTopicReviews.length === 0) {
                        setPendingTopicReview({
                            planId: planId,
                            disciplineId: discipline.id,
                            disciplineName: discipline.name,
                            topicId: topic.id,
                            topicName: topic.name,
                            isAutoTriggered: true,
                            message: `🎉 PARABÉNS! Você concluiu todas as metas do tópico [${topic.name}]. Deseja agendar suas revisões espaçadas agora?`
                        });
                    }
                }
            }
        }

    } catch (error) {
        console.error("Erro ao atualizar meta:", error);
        // Rollback
        setCompletedMetaIds(prev => {
            const rb = new Set(prev);
            if (isNowCompleted) rb.delete(goal.id!);
            else rb.add(goal.id!);
            return rb;
        });
    }
  }, [currentUser, planId, completedMetaIds, cachedData, setCachedData, structure, fullPlanData, openSpacedReviewModal]);

  // NOVA FUNÇÃO: BATCH TOGGLE
  // Atualiza múltiplos IDs de uma vez no estado local para evitar race conditions visuais
  const handleBatchToggle = useCallback((ids: string[], isCompleted: boolean) => {
    setCompletedMetaIds(prev => {
        const newSet = new Set(prev);
        ids.forEach(id => {
            if (isCompleted) newSet.add(id);
            else newSet.delete(id);
        });
        
        // Sync context
        if (cachedData) {
            setCachedData({ ...cachedData, completedMetaIds: newSet });
        }
        
        return newSet;
    });
  }, [cachedData, setCachedData]);

  const toggleDiscipline = useCallback((id: string) => {
    setExpandedDisciplines(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  }, []);

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
              <Loader2 size={40} className="animate-spin text-brand-red" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Carregando edital...</p>
          </div>
      );
  }

  if (!structure || structure.disciplines.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
              <div className="p-6 rounded-full bg-zinc-900 border border-zinc-800">
                  <FileText size={48} className="text-zinc-600" />
              </div>
              <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Edital Indisponível</h2>
                  <p className="text-zinc-500 text-sm mt-2 max-w-md">
                      Este plano ainda não possui um edital verticalizado configurado.
                  </p>
              </div>
          </div>
      );
  }

  return (
    <div className="relative w-full min-h-screen bg-zinc-950 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {fullPlanData && (
        <PlanHeroBanner currentTab="edict" planData={fullPlanData} />
      )}

      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 md:px-8 pt-8 md:pt-12 flex-1 flex flex-col mb-10 -mt-10 md:-mt-20">
        
        {/* HEADER */}
        <div className="mb-10">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <BookOpen size={32} className="text-zinc-600" />
                Edital Verticalizado
            </h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1 pl-11">
                {planTitle}
            </p>
        </div>

        {/* GLOBAL PROGRESS CARD */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 bg-brand-red/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="flex justify-between items-end mb-3 relative z-10">
                <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Progresso Geral</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Cobertura do Conteúdo</p>
                </div>
                <div className="text-3xl font-black text-brand-red">
                    {stats.globalProgress}<span className="text-sm text-zinc-600">%</span>
                </div>
            </div>

            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50 relative z-10">
                <div 
                    className="h-full bg-gradient-to-r from-brand-red to-red-600 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all duration-1000 ease-out"
                    style={{ width: `${stats.globalProgress}%` }}
                ></div>
            </div>
            
            {/* Stats Detail */}
            <div className="flex justify-end mt-2 relative z-10">
               <span className="text-[9px] font-mono text-zinc-500">
                  {stats.completedGoals}/{stats.totalGoals} Metas Concluídas
               </span>
            </div>
        </div>

        {/* DISCIPLINES LIST */}
        <div className="space-y-4">
            {structure.disciplines.map((discipline) => (
                <DisciplineItem 
                    key={discipline.id}
                    discipline={discipline}
                    expandedDisciplines={expandedDisciplines}
                    toggleDiscipline={toggleDiscipline}
                    progress={stats.disciplineStats[discipline.id] || 0}
                    openNotebook={openNotebook}
                    completedMetaIds={completedMetaIds}
                    activeUserMode={activeUserMode}
                    metaLookup={metaLookup}
                    planId={planId}
                    structure={structure}
                    handleToggleGoal={handleToggleGoal}
                    handleBatchToggle={handleBatchToggle}
                    setActiveVideo={setActiveVideo}
                    setFlashcardModal={setFlashcardModal}
                    setMindMapModal={setMindMapModal}
                    activeHighlightGoal={activeHighlightGoal}
                    activeHighlightTopic={activeHighlightTopic}
                    expandedTopics={expandedTopics}
                />
            ))}
        </div>

        {/* --- MODAL DE VÍDEO (OVERLAY) --- */}
        {activeVideo && createPortal(
            <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
                {/* Header do Modal */}
                <div className="flex justify-end p-6">
                    <button 
                        onClick={() => setActiveVideo(null)}
                        className="p-3 bg-zinc-900/50 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all border border-zinc-800"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Player Container */}
                <div className="flex-1 flex items-center justify-center p-4 pb-20">
                    <div className="w-full max-w-6xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 relative">
                        <iframe 
                            src={activeVideo.includes('?') ? `${activeVideo}&allow=autoplay` : `${activeVideo}?allow=autoplay`}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" 
                            allowFullScreen
                            style={{ border: 'none' }}
                        />
                    </div>
                </div>
            </div>,
            document.body
        )}

        {/* --- MODAL DE CADERNO / ERROS --- */}
        <EditalNotebookModal 
            isOpen={noteModal.isOpen}
            onClose={() => setNoteModal(prev => ({ ...prev, isOpen: false }))}
            planId={planId || ''}
            editalNodeId={noteModal.nodeId}
            type={noteModal.type}
            topicTitle={noteModal.nodeTitle}
            materials={noteModal.materials}
            editalNode={noteModal.editalNode}
            metaLookup={noteModal.metaLookup}
            initialPdfUrl={noteModal.initialPdfUrl}
        />

        {/* --- MODAL DE FLASHCARDS --- */}
        <EditalFlashcardsModal 
            isOpen={flashcardModal.isOpen}
            onClose={() => setFlashcardModal(prev => ({ ...prev, isOpen: false }))}
            planId={planId || ''}
            editalNodeId={flashcardModal.nodeId}
            topicTitle={flashcardModal.nodeTitle}
        />

        {/* --- MODAL DE MAPAS MENTAIS --- */}
        <EditalMindMapsModal 
            isOpen={mindMapModal.isOpen}
            onClose={() => setMindMapModal(prev => ({ ...prev, isOpen: false }))}
            planId={planId || ''}
            editalNodeId={mindMapModal.nodeId}
            topicTitle={mindMapModal.nodeTitle}
        />
      </div>
    </div>
  );
};

export default EditalVerticalizado;