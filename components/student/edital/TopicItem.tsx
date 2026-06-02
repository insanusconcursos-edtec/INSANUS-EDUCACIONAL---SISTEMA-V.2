
/* eslint-disable react/prop-types */
import React, { useState, useMemo, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronRight, ChevronDown, CheckCircle2, Circle, Lock, StickyNote, CalendarClock, BookOpen,
  Layers, Network, Loader2
} from 'lucide-react';
import { EdictTopic, EdictSubtopic, EdictStudyLevel } from '../../../services/edictService';
import { Meta, MetaType } from '../../../services/metaService';
import { useAuth } from '../../../contexts/AuthContext';
import { useSpacedReviewModal } from '../../../contexts/SpacedReviewModalContext';
import { editalProgressService } from '../../../services/editalProgressService';
import LinkedGoalItem from './LinkedGoalItem';

// IMPORTAÇÕES DO SISTEMA DE REVISÃO
import { courseReviewService, CourseReview } from '../../../services/courseReviewService';

// Helper para formatar data curta (dd/mm)
const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
};

interface TopicItemProps {
  item: EdictTopic | EdictSubtopic;
  depth?: number;
  completedMetaIds: Set<string>;
  activeUserMode?: boolean;
  metaLookup?: Record<string, Meta>;
  planId?: string;
  disciplineId?: string; // NOVO
  disciplineName?: string; // NOVO
  studyLevels?: EdictStudyLevel[];
  onToggleGoal?: (goal: Meta) => void;
  onBatchToggle?: (ids: string[], status: boolean) => void; // NEW PROP FOR BATCH UPDATE
  onPlayVideo?: (url: string) => void;
  onOpenNotes?: (id: string, title: string, linkedGoals?: any, initialPdfUrl?: string) => void;
  onOpenFlashcards?: (id: string, title: string) => void;
  onOpenMindMap?: (id: string, title: string) => void;
  highlightGoalId?: string | null;
  activeHighlightTopicId?: string | null;
  expandedTopics?: Set<string>;
  isReadOnly?: boolean;
  numbering?: string;
}

const TopicItem: React.FC<TopicItemProps> = memo(({ 
  item, 
  depth = 0, 
  completedMetaIds, 
  activeUserMode = false,
  metaLookup = {},
  planId,
  disciplineId,
  disciplineName,
  studyLevels,
  onToggleGoal,
  onBatchToggle,
  onPlayVideo,
  onOpenNotes,
  onOpenFlashcards,
  onOpenMindMap,
  highlightGoalId,
  activeHighlightTopicId,
  expandedTopics,
  isReadOnly = false,
  numbering
}) => {
  const { currentUser } = useAuth();
  const { openSpacedReviewModal } = useSpacedReviewModal();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // ESTADO PARA ARMAZENAR REVISÕES DESTE TÓPICO
  const [topicReviews, setTopicReviews] = useState<CourseReview[]>([]);

  // --- LOCAL STATE FOR OPTIMISTIC UI ---
  const [localCompletedIds, setLocalCompletedIds] = useState<Set<string>>(new Set());
  
  // --- STATE VERSIONING FORCED REMOUNT ---
  // Incremented to force React to destroy and recreate child components
  // ensuring they pick up the new "completed" style immediately.
  const [remountToken, setRemountToken] = useState(0);

  // --- HIGHLIGHT SYNC ---
  const isTopicHighlighted = activeHighlightTopicId === String(item.id);

  // NOVO: Lógica recursiva para detectar se este tópico ou algum filho deve estar expandido
  const containsHighlight = useMemo(() => {
    if (!highlightGoalId && !activeHighlightTopicId) return false;
    
    const check = (t: any): boolean => {
      // 1. O próprio tópico é o alvo
      if (activeHighlightTopicId && String(t.id) === String(activeHighlightTopicId)) return true;
      
      // 2. O tópico contém a meta alvo
      if (highlightGoalId && t.linkedGoals) {
        const allIds = Object.values(t.linkedGoals).flat().map(String);
        if (allIds.includes(String(highlightGoalId))) return true;
      }
      
      // 3. Algum subtópico contém o alvo (Recursão)
      if (t.subtopics) {
        return t.subtopics.some((sub: any) => check(sub));
      }
      
      return false;
    };
    
    return check(item);
  }, [item, highlightGoalId, activeHighlightTopicId]);

  // Reset local state if props change (e.g. parent refresh)
  useEffect(() => {
    setLocalCompletedIds(new Set());
    setRemountToken(prev => prev + 1); // Ensure children refresh if parent data changes
  }, [completedMetaIds]);

  useEffect(() => {
    if (containsHighlight || (expandedTopics && expandedTopics.has(String(item.id)))) {
        setIsExpanded(true);
    }
  }, [containsHighlight, expandedTopics, item.id]);

  // Merge Prop Data + Local Optimistic Data
  const effectiveCompletedIds = useMemo(() => {
    if (localCompletedIds.size === 0) return completedMetaIds;
    const merged = new Set(completedMetaIds);
    localCompletedIds.forEach(id => merged.add(id));
    return merged;
  }, [completedMetaIds, localCompletedIds]);

  // Check for children
  const hasSubtopics = item.subtopics && item.subtopics.length > 0;
  const isLeaf = !hasSubtopics;
  
  // Check for observation
  const observation = item.observation;
  const hasObservation = !!observation && observation.trim() !== '' && observation.trim() !== '<p><br></p>';

  // Level Logic
  const levelId = item.studyLevelId;
  const levelName = levelId && studyLevels ? studyLevels.find(l => l.id === levelId)?.name : null;

  const getLevelStyle = (name: string) => {
    const norm = name?.toLowerCase() || '';
    if (norm.includes('alta') || norm.includes('muito') || norm.includes('difícil')) 
        return 'border-red-500/30 text-red-400 bg-red-500/10';
    if (norm.includes('média') || norm.includes('media') || norm.includes('médio')) 
        return 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10';
    if (norm.includes('baixa') || norm.includes('fácil') || norm.includes('facil')) 
        return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
    return 'border-zinc-700 text-zinc-400 bg-zinc-800';
  };

  // --- PROGRESS CALCULATION & META GATHERING ---
  const { progressStats, allMetaIds } = useMemo(() => {
    let totalGoals = 0;
    let completedGoals = 0;
    const ids: string[] = [];

    const countGoals = (linkedGoals: any) => {
      if (!linkedGoals) return;
      Object.values(linkedGoals).forEach((idList: any) => {
        if (Array.isArray(idList)) {
          totalGoals += idList.length;
          idList.forEach(id => {
            const safeId = String(id).trim();
            ids.push(safeId);
            // Use EFFECTIVE IDs for calculation - NORMALIZAÇÃO RIGOROSA
            if (effectiveCompletedIds.has(safeId)) completedGoals++;
          });
        }
      });
    };

    // 1. Count own goals
    countGoals(item.linkedGoals);

    // 2. Recursively count subtopics goals (to show aggregate status on parent)
    const traverse = (t: EdictTopic | EdictSubtopic) => {
        if (t.subtopics) {
            t.subtopics.forEach(sub => {
                countGoals(sub.linkedGoals);
            });
        }
    };
    if (hasSubtopics) traverse(item);

    return { 
        progressStats: { total: totalGoals, completed: completedGoals },
        allMetaIds: ids
    };
  }, [item, hasSubtopics, effectiveCompletedIds]);

  const percentage = progressStats.total > 0 
    ? Math.round((progressStats.completed / progressStats.total) * 100) 
    : 0;

  const isFullyComplete = progressStats.total > 0 && progressStats.completed === progressStats.total;

  // Carregar revisões do tópico
  const fetchReviews = async () => {
    if (currentUser) {
        try {
            const reviews = await courseReviewService.getReviewsByTopic(currentUser.uid, String(item.id));
            setTopicReviews(reviews);
        } catch (error) {
            console.error("Erro ao buscar revisões:", error);
        }
    }
  };

  useEffect(() => {
    if (isFullyComplete || isExpanded) {
        fetchReviews();
    } else {
        setTopicReviews([]);
    }
  }, [isFullyComplete, isExpanded, currentUser, item.id]);

  // --- HANDLERS ---

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 1. Active User Guard
    if (!activeUserMode) {
       return; // Lock icon shows this is disabled
    }

    // 2. Logic: Allow toggling (Complete or Uncheck)
    setShowConfirmModal(true);
  };

  const confirmCompletion = async () => {
    if (!currentUser || !planId) return;
    setIsProcessing(true);
    try {
        if (isFullyComplete) {
            // DESMARCAR TÓPICO
            await editalProgressService.completeTopicManually(currentUser.uid, planId, allMetaIds, false);
            
            // Apaga as revisões do banco
            try {
                await courseReviewService.deleteReviewsByTopic(currentUser.uid, String(item.id));
                setTopicReviews([]);
            } catch (error) {
                console.error("Erro ao apagar revisões:", error);
            }

            // Sync visual state
            if (onBatchToggle) onBatchToggle(allMetaIds, false);
            
            setShowConfirmModal(false);
        } else {
            // CONCLUIR TÓPICO
            await editalProgressService.completeTopicManually(currentUser.uid, planId, allMetaIds);
            
            // Optimistic UI Update - NORMALIZAÇÃO RIGOROSA
            const newLocal = new Set(Array.from(localCompletedIds).map(String));
            allMetaIds.forEach(id => newLocal.add(String(id)));
            setLocalCompletedIds(newLocal);
            setRemountToken(prev => prev + 1);

            if (onBatchToggle) onBatchToggle(allMetaIds, true);

            setShowConfirmModal(false);

            // Abre o modal de agendar revisão via Contexto Global (Apenas se não houver revisões de tópico)
            const allReviews = await courseReviewService.getReviewsByTopic(currentUser.uid, String(item.id));
            const existingTopicReviews = allReviews.filter(r => r.type === 'topic_revision');
            
            if (existingTopicReviews.length === 0) {
                // Lógica de Hereditariedade de Configuração (Config Lookup)
                let inheritedConfig = [1, 7, 15, 30]; // Default padrão
                const repeatLast = false;

                if (item.linkedGoals) {
                    // Tenta encontrar em qualquer categoria uma meta que tenha revisão ativa
                    const allLinkedIds = Object.values(item.linkedGoals).flat() as string[];
                    const goalWithReview = allLinkedIds
                        .map(id => metaLookup[id])
                        .find(g => g?.reviewConfig?.active);

                    if (goalWithReview && goalWithReview.reviewConfig) {
                        // Converte a string de intervalos "1,7,15,30" em array de números se necessário
                        // Ou usa o array se já for array. Depende do schema.
                        // Olhando o metaService, reviewConfig costuma ter spacedReviewIntervals string.
                        const intervalsStr = goalWithReview.reviewConfig.spacedReviewIntervals || "1,7,15,30";
                        inheritedConfig = intervalsStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                    }
                }

                openSpacedReviewModal({
                    planId: planId || '',
                    disciplineId: disciplineId || '',
                    disciplineName: disciplineName || '',
                    topicId: String(item.id),
                    topicName: item.name,
                    isAutoTriggered: true,
                    config: inheritedConfig,
                    contextType: planId ? 'plan' : 'course_topic', // Se tem planId, assume contexto de plano (Editais de Planos)
                    message: `🎉 PARABÉNS! Você concluiu todas as metas do tópico [${item.name}]. Deseja agendar suas revisões espaçadas agora?`
                });
            }
        }
    } catch (error) {
        console.error("Erro ao atualizar tópico", error);
        alert("Erro ao salvar progresso.");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- RENDER LINKED GOALS ---
  const renderLinkedGoals = () => {
    if (!item.linkedGoals) return null;
    
    // Flatten all linked IDs into a list of Meta objects
    const metasToRender: Meta[] = [];
    const types: MetaType[] = ['lesson', 'material', 'questions', 'law', 'summary', 'review'];
    
    types.forEach(type => {
        const ids = item.linkedGoals[type] || [];
        ids.forEach(id => {
            if (metaLookup[id]) {
                metasToRender.push(metaLookup[id]);
            }
        });
    });

    if (metasToRender.length === 0) return null;

    // Apply custom defined metas order if present
    if (item.metasOrder && item.metasOrder.length > 0) {
      metasToRender.sort((a, b) => {
        const indexA = item.metasOrder!.indexOf(a.id!);
        const indexB = item.metasOrder!.indexOf(b.id!);
        const valA = indexA === -1 ? Infinity : indexA;
        const valB = indexB === -1 ? Infinity : indexB;
        return valA - valB;
      });
    }

    return (
        <div className="flex flex-col gap-2 mt-2 mb-2 animate-in slide-in-from-left-2 duration-300">
            {metasToRender.map(meta => {
                const isDone = effectiveCompletedIds.has(String(meta.id).trim());
                return (
                    <LinkedGoalItem 
                        // FORCE REMOUNT on status change OR manual trigger (remountToken)
                        // This guarantees the component is fresh and green instantly
                        key={`${meta.id}-v${remountToken}-${isDone ? 'done' : 'pending'}`}
                        goal={meta}
                        isCompleted={isDone}
                        activeUserMode={isReadOnly ? false : activeUserMode}
                        isReadOnly={isReadOnly}
                        planId={planId}
                        onToggleComplete={onToggleGoal || (() => {})}
                        onPlayVideo={onPlayVideo}
                        onOpenPdfInNotebook={(url) => onOpenNotes?.(String(item.id), item.name, item.linkedGoals, url)}
                        isHighlighted={String(meta.id) === String(highlightGoalId)}
                    />
                );
            })}
        </div>
    );
  };

  // --- STYLES ---
  const paddingLeft = `${depth * 1.5 + 1}rem`;
  const isTopic = depth === 0;

  return (
    <div 
        id={`topic-${item.id}`} 
        className={`
            flex flex-col transition-all duration-500
            ${isTopicHighlighted ? 'ring-2 ring-[var(--plan-theme)] bg-[var(--plan-theme)]/10 animate-pulse shadow-[0_0_20px_rgba(var(--plan-theme-rgb),0.3)] rounded-lg' : ''}
        `}
    >
      {/* HEADER ROW */}
      <div 
        className={`
          flex items-center gap-3 p-3 border-b border-zinc-800/50 transition-colors cursor-pointer select-none
          ${isExpanded ? 'bg-zinc-900/50' : 'hover:bg-zinc-900/30'}
          ${isTopic ? 'border-l-2 border-l-transparent hover:border-l-[var(--plan-theme)]' : ''}
        `}
        style={{ paddingLeft }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand Icon */}
        <div className={`text-zinc-500 transition-transform duration-200 ${hasSubtopics ? '' : (progressStats.total > 0 || hasObservation ? '' : 'opacity-0')}`}>
           {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                {numbering && <span className="text-zinc-500 font-mono text-[10px] shrink-0">{numbering}</span>}
                <h4 className={`text-sm font-medium truncate ${isFullyComplete ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                    {item.name}
                </h4>
            </div>
            
            {/* ÁREA DE REVISÕES VISUAIS (Badge System) */}
            {topicReviews.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {topicReviews.map((rev) => {
                        const isRevDone = rev.status === 'completed';
                        return (
                            <div 
                               key={rev.id}
                               className={`text-[8px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 uppercase tracking-wider transition-colors
                                  ${isRevDone 
                                      ? 'bg-emerald-900/20 text-emerald-500 border-emerald-900/40' 
                                      : 'bg-zinc-800 text-zinc-500 border-zinc-700'}
                               `}
                            >
                               {isRevDone ? <CheckCircle2 size={8} /> : <CalendarClock size={8} />}
                               REV {rev.reviewIndex} ({formatShortDate(rev.scheduledDate)})
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Progress Micro-Bar (Mobile/Desktop) */}
            {progressStats.total > 0 && (
                <div className="flex items-center gap-2 mt-1.5 w-full max-w-[200px]">
                    <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${isFullyComplete ? 'bg-emerald-500' : 'bg-[var(--plan-theme)]'}`} 
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                    <span className={`text-[9px] font-bold ${isFullyComplete ? 'text-emerald-500' : 'text-zinc-500'}`}>
                        {percentage}%
                    </span>
                </div>
            )}
        </div>

        {/* Observation Badge (Collapsed) */}
        {!isExpanded && hasObservation && (
            <div className="mr-2 text-yellow-500/50 flex items-center gap-1" title="Possui observação">
                <StickyNote size={12} />
            </div>
        )}

            {/* Level Badge (Aligned Right, Before Status) */}
            {levelName && (
                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border tracking-wider shrink-0 ${getLevelStyle(levelName)}`}>
                    {levelName}
                </span>
            )}

            {/* Botão de Agendar Revisões (Apenas se concluído e sem revisões ativas) */}
            {isFullyComplete && topicReviews.length === 0 && !isReadOnly && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        
                        // Busca configuração herdada para o agendamento manual também
                        let inheritedConfig = [1, 7, 15, 30];
                        if (item.linkedGoals) {
                            const allLinkedIds = Object.values(item.linkedGoals).flat() as string[];
                            const goalWithReview = allLinkedIds
                                .map(id => metaLookup[id])
                                .find(g => g?.reviewConfig?.active);
                            if (goalWithReview?.reviewConfig) {
                                const intervalsStr = goalWithReview.reviewConfig.spacedReviewIntervals || "1,7,15,30";
                                inheritedConfig = intervalsStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                            }
                        }

                        openSpacedReviewModal({
                            planId: planId || '',
                            disciplineId: disciplineId || '',
                            disciplineName: disciplineName || '',
                            topicId: String(item.id),
                            topicName: item.name,
                            isAutoTriggered: false,
                            config: inheritedConfig,
                            contextType: planId ? 'plan' : 'course_topic',
                            message: `Deseja agendar as revisões espaçadas para o tópico [${item.name}]?`
                        });
                    }}
                    className="mr-2 flex items-center gap-1.5 px-2 py-1 bg-[var(--plan-theme)]/10 hover:bg-[var(--plan-theme)]/20 border border-[var(--plan-theme)]/30 rounded text-[10px] font-bold text-[var(--plan-theme)] uppercase tracking-wider transition-all"
                >
                    <CalendarClock size={12} />
                    Agendar Revisões
                </button>
            )}

            {/* ARSENAL DE ESTUDO (Apenas Leaf Nodes) */}
            {isLeaf && (
                <div className="flex items-center gap-1.5 mr-3">
                    {/* BOTÃO FLASHCARDS */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenFlashcards?.(item.id, item.name);
                        }}
                        className="p-2 bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 rounded-lg border border-pink-500/20 transition-all group"
                        title="Meus Flashcards"
                    >
                        <Layers size={14} className="group-hover:scale-110 transition-transform" />
                    </button>

                    {/* BOTÃO MAPAS MENTAIS */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenMindMap?.(item.id, item.name);
                        }}
                        className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded-lg border border-purple-500/20 transition-all group"
                        title="Meus Mapas Mentais"
                    >
                        <Network size={14} className="group-hover:scale-110 transition-transform" />
                    </button>

                    {/* BOTÃO ANOTAÇÕES */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenNotes?.(item.id, item.name, item.linkedGoals);
                        }}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg border border-blue-500/20 transition-all group"
                        title="Caderno de Anotações"
                    >
                        <BookOpen size={14} className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            )}

            {/* Status Icon */}
        <button
            onClick={handleStatusClick}
            disabled={!activeUserMode || isFullyComplete || isReadOnly} // Disable if mode off OR already done OR read-only
            className={`shrink-0 transition-colors ${(!activeUserMode || isReadOnly) ? 'cursor-not-allowed' : (isFullyComplete ? 'cursor-default' : 'cursor-pointer hover:scale-110')}`}
            title={isReadOnly ? "Visualização Somente Leitura" : (!activeUserMode ? "Modo Automático (Conclusão Manual Bloqueada)" : (isFullyComplete ? "Tópico Concluído" : "Marcar Tópico como Concluído"))}
        >
            {isFullyComplete ? (
                <CheckCircle2 size={18} className="text-emerald-500" />
            ) : (isReadOnly || !activeUserMode) ? (
                <Lock size={16} className="text-zinc-700" />
            ) : (
                <Circle size={18} className="text-zinc-600 hover:text-zinc-400" />
            )}
        </button>
      </div>

      {/* BODY (Subtopics + Linked Goals + Observation) */}
      {isExpanded && (
        <div className="animate-in slide-in-from-top-1 duration-200">
            
            {/* 1. Observation Block (NEW) */}
            {hasObservation && (
                <div 
                    className="mb-2 mt-2 mr-2 p-3 bg-yellow-900/10 border-l-2 border-yellow-600 text-sm text-zinc-300 rich-content"
                    style={{ marginLeft: `${(depth + 1) * 1.5 + 0.5}rem` }}
                >
                    <div className="flex items-center gap-2 text-yellow-500 mb-1 text-[10px] font-bold uppercase tracking-widest">
                        <StickyNote size={12} /> Observação
                    </div>
                    <div 
                        dangerouslySetInnerHTML={{ __html: observation }} 
                        className="prose prose-invert prose-sm max-w-none text-zinc-400 text-xs"
                    />
                    <style>{`
                        .rich-content ul { list-style-type: disc; padding-left: 1.5em; }
                        .rich-content ol { list-style-type: decimal; padding-left: 1.5em; }
                    `}</style>
                </div>
            )}

            {/* 2. Goals attached to THIS item */}
            {renderLinkedGoals()}

            {/* 3. Subtopics Recursive Render */}
            {hasSubtopics && item.subtopics?.map((sub, sIndex) => {
                const subNumbering = numbering ? `${numbering.replace('.', '')}.${sIndex + 1}` : `${sIndex + 1}`;
                return (
                    <TopicItem 
                        key={sub.id} 
                        item={sub} 
                        depth={depth + 1} 
                        numbering={subNumbering}
                        // Pass EFFECTIVE IDs down to children to maintain visual state
                        completedMetaIds={effectiveCompletedIds}
                        activeUserMode={activeUserMode}
                        metaLookup={metaLookup}
                        planId={planId}
                        disciplineId={disciplineId}
                        disciplineName={disciplineName}
                        studyLevels={studyLevels}
                        onToggleGoal={onToggleGoal}
                        onBatchToggle={onBatchToggle} // PROPAGATE BATCH TOGGLE DOWN
                        onPlayVideo={onPlayVideo}
                        onOpenNotes={onOpenNotes}
                        onOpenFlashcards={onOpenFlashcards}
                        onOpenMindMap={onOpenMindMap}
                        highlightGoalId={highlightGoalId}
                        activeHighlightTopicId={activeHighlightTopicId}
                        isReadOnly={isReadOnly}
                    />
                );
            })}

            {/* 4. Empty State Check */}
            {progressStats.total === 0 && !hasSubtopics && !hasObservation && (
                <div 
                    className="py-3 pr-4 border-b border-zinc-800/30 bg-zinc-950/30 text-zinc-600 text-xs italic"
                    style={{ paddingLeft: `${(depth + 1) * 1.5 + 2.5}rem` }}
                >
                    Sem conteúdo vinculado.
                </div>
            )}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE CONCLUSÃO DO TÓPICO */}
      {showConfirmModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowConfirmModal(false)}>
            <div 
                className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <CheckCircle2 size={32} />
                    </div>
                    
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                        {isFullyComplete ? 'Desmarcar Tópico?' : 'Concluir Tópico?'}
                    </h3>
                    
                    <div className="text-sm text-zinc-400 leading-relaxed">
                        {isFullyComplete ? (
                            <p>Deseja desmarcar este tópico? Isso apagará todas as revisões agendadas para ele e reiniciará o ciclo.</p>
                        ) : (
                            <>
                                <p>Você está prestes a marcar <strong>todas as {progressStats.total} metas</strong> deste tópico como concluídas.</p>
                                <p className="mt-2 text-xs bg-zinc-950 p-2 rounded border border-zinc-800 text-zinc-500">
                                    Isso removerá quaisquer agendamentos futuros dessas metas do seu calendário.
                                </p>
                            </>
                        )}
                    </div>

                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setShowConfirmModal(false)}
                            disabled={isProcessing}
                            className="flex-1 py-3 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold uppercase text-xs tracking-widest transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmCompletion}
                            disabled={isProcessing}
                            className={`flex-1 py-3 rounded-lg text-white font-black uppercase text-xs tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${isFullyComplete ? 'bg-[var(--plan-theme)] hover:brightness-110 shadow-[var(--plan-theme)]/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}
                        >
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
      )}

    </div>
  );
});

TopicItem.displayName = 'TopicItem';

export default TopicItem;
