
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckCircle2, ChevronDown, PlayCircle, FileText, 
  ListChecks, Book, Edit3, RefreshCw, ExternalLink, Download, 
  Play, Eye, BrainCircuit, Layers, Lock, Trophy, TextCursor
} from 'lucide-react';
import { Meta, MetaType } from '../../../services/metaService';
import { isPandaVideo } from '../../../utils/videoHelpers';
import { openWatermarkedPdf } from '../../../utils/pdfSecurityService';
import { useAuth } from '../../../contexts/AuthContext';
import MindMapViewerModal from '../MindMapViewerModal';
import FlashcardPlayerModal from '../FlashcardPlayerModal';

interface LinkedGoalItemProps {
  goal: Meta;
  isCompleted: boolean;
  activeUserMode: boolean;
  planId?: string; // Required for User Content
  onToggleComplete: (goal: Meta) => void;
  onPlayVideo?: (url: string) => void;
  onOpenPdfInNotebook?: (url: string) => void;
  isHighlighted?: boolean;
  isReadOnly?: boolean;
}

const TYPE_CONFIG: Record<MetaType, { label: string; color: string; icon: any }> = {
  lesson: { label: 'AULA', color: '#3b82f6', icon: PlayCircle },
  material: { label: 'PDF', color: '#f97316', icon: FileText },
  questions: { label: 'QUESTÕES', color: '#10b981', icon: ListChecks },
  law: { label: 'LEI SECA', color: '#eab308', icon: Book },
  review: { label: 'FLASHCARD', color: '#ec4899', icon: RefreshCw },
  summary: { label: 'RESUMO', color: '#a855f7', icon: Edit3 },
  simulado: { label: 'SIMULADO', color: '#EAB308', icon: Trophy },
};

const LinkedGoalItem: React.FC<LinkedGoalItemProps> = ({ 
  goal, 
  isCompleted, 
  activeUserMode, 
  planId,
  onToggleComplete,
  onPlayVideo,
  onOpenPdfInNotebook,
  isHighlighted,
  isReadOnly = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser, userData } = useAuth();
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Admin Content Viewers State
  const [isAdminMapOpen, setIsAdminMapOpen] = useState(false);
  const [isAdminFlashcardOpen, setIsAdminFlashcardOpen] = useState(false);

  // --- AUTO-OPEN IF HIGHLIGHTED ---
  useEffect(() => {
    if (isHighlighted) {
      setIsOpen(true);
    }
  }, [isHighlighted]);

  const config = TYPE_CONFIG[goal.type] || TYPE_CONFIG.lesson;
  const GoalIcon = config.icon;
  const metaColor = goal.color || config.color || '#71717a';

  const isSummary = goal.type === 'summary';
  const isReview = goal.type === 'review';
  const isQuestions = goal.type === 'questions';
  const supportsUserContent = isSummary || isReview || isQuestions;

  // Check for Admin Content
  const hasAdminMindMap = isSummary && goal.summaryConfig?.mindMap && goal.summaryConfig.mindMap.length > 0;
  const hasAdminFlashcards = isReview && goal.flashcardConfig?.cards && goal.flashcardConfig.cards.length > 0;

  const handleOpenPdf = async (url: string) => {
    // Redireciona para o caderno interno se for meta de MATERIAL ou LEI SECA e o callback estiver disponível
    if (onOpenPdfInNotebook && (goal.type === 'material' || goal.type === 'law')) {
      onOpenPdfInNotebook(url);
      return;
    }

    if (!currentUser || loadingPdf) return;
    setLoadingPdf(true);
    try {
      await openWatermarkedPdf(url, {
        email: currentUser.email || '',
        cpf: userData?.cpf || '000.000.000-00'
      });
    } catch (error) {
      console.error(error);
      alert("Erro ao abrir documento protegido.");
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleCheckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // TRAVA DO USUÁRIO ATIVO
    if (!activeUserMode || isReadOnly) {
      if (!isReadOnly) alert("A conclusão manual está desativada para este plano. Siga o cronograma ou ative o 'Usuário Ativo'.");
      return;
    }

    // Se já estiver concluído, executa direto (undo). Se não, abre modal.
    if (!isCompleted) {
        setShowConfirmModal(true);
    } else {
        onToggleComplete(goal);
    }
  };

  const confirmCompletion = () => {
      onToggleComplete(goal);
      setShowConfirmModal(false);
  };

  const getReviewCount = () => {
    if (!goal.reviewConfig?.active) return null;
    
    const intervals = goal.reviewConfig.intervals.split(',').filter(i => i.trim());
    const total = intervals.length;
    
    if (total === 0) return null;

    // Recupera progresso se disponível, senão 0
    const completed = (goal as any).completedReviewsCount || (goal as any).completedReviews || 0;
    const isAllDone = total > 0 && completed >= total;

    return (
      <span 
        className={`
            text-[9px] font-mono px-1.5 py-0.5 rounded ml-2 flex items-center gap-1 border
            ${isAllDone 
                ? 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30' 
                : 'text-zinc-500 bg-zinc-900 border-zinc-700'}
        `}
        title={`${completed} de ${total} revisões concluídas`}
      >
        <RefreshCw size={8} className={isAllDone ? 'text-emerald-500' : ''} />
        {completed}/{total} Rev
      </span>
    );
  };

  return (
    <>
    <div 
      id={`goal-${goal.id}`}
      className={`
        border-l-2 ml-5 pl-4 mb-2 relative group transition-all duration-1000
        ${isHighlighted ? 'ring-2 ring-[var(--plan-theme)] bg-[var(--plan-theme)]/10 animate-pulse shadow-[0_0_20px_rgba(var(--plan-theme-rgb),0.3)] rounded-r-xl' : ''}
      `}
      style={{ borderColor: metaColor }}
    >
      {/* HEADER */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all
          ${isCompleted 
            ? 'bg-zinc-950/30 border-zinc-800/50 opacity-70 hover:opacity-100' 
            : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={handleCheckClick}
            className={`
              shrink-0 w-5 h-5 rounded-md flex items-center justify-center border transition-all
              ${isCompleted 
                ? 'bg-emerald-500 border-emerald-500 text-black' 
                : (isReadOnly || !activeUserMode)
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-600 cursor-not-allowed opacity-50' 
                    : 'bg-transparent border-zinc-600 text-transparent hover:border-zinc-400 cursor-pointer'}
            `}
            title={isReadOnly ? "Visualização Somente Leitura" : activeUserMode ? "Marcar como concluído" : "A conclusão manual está desativada neste plano"}
          >
            {isCompleted ? (
                <CheckCircle2 size={14} strokeWidth={3} />
            ) : (isReadOnly || !activeUserMode) ? (
                <Lock size={12} />
            ) : (
                <CheckCircle2 size={14} strokeWidth={3} />
            )}
          </button>

          <div 
            className="shrink-0 p-1.5 rounded-md flex items-center justify-center border border-white/5"
            style={{ 
              color: metaColor, 
              backgroundColor: `${metaColor}1A`
            }}
          >
             <GoalIcon size={16} />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold truncate ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                {goal.title}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span 
                className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wide"
                style={{ 
                    color: metaColor, 
                    borderColor: `${metaColor}40`, 
                    backgroundColor: `${metaColor}10` 
                }}
              >
                {config.label}
              </span>
              {getReviewCount()}
              {(goal.videos?.length || 0) > 0 && <span className="text-[9px] text-zinc-600 font-medium">• {goal.videos?.length} Aulas</span>}
              {(goal.files?.length || 0) > 0 && <span className="text-[9px] text-zinc-600 font-medium">• {goal.files?.length} PDFs</span>}
            </div>
          </div>
        </div>

        <div className={`text-zinc-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={16} />
        </div>
      </div>

      {/* CONTENT BODY */}
      {isOpen && (
        <div className="mt-2 space-y-2 animate-in slide-in-from-top-1 duration-200 pl-2">
          
          {/* OBSERVATION CALLOUT */}
          {goal.observation && (
            <div className="p-3 bg-white/5 border-l-2 border-white/20 rounded-r-lg mb-3">
                <div className="flex items-start gap-2">
                    <TextCursor size={14} className="text-white/50 shrink-0 mt-0.5" />
                    <p className="text-xs text-white/80 italic leading-relaxed">
                        {goal.observation}
                    </p>
                </div>
            </div>
          )}
          
          {/* 1. VIDEOS */}
          {goal.type === 'lesson' && goal.videos?.map((video, idx) => (
            <div 
                key={idx} 
                className="flex items-start justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:bg-zinc-900 transition-colors group/video"
            >
                <div className="flex items-start gap-3 w-full">
                    <button 
                        onClick={() => isPandaVideo(video.link) && onPlayVideo ? onPlayVideo(video.link) : window.open(video.link, '_blank')}
                        className="w-8 h-8 rounded-full bg-[var(--plan-theme)]/20 text-[var(--plan-theme)] flex items-center justify-center group-hover/video:bg-[var(--plan-theme)] group-hover/video:text-white transition-all shrink-0 mt-0.5"
                    >
                        <Play size={12} className="ml-0.5" fill="currentColor" />
                    </button>
                    
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs text-zinc-300 font-medium whitespace-normal break-words leading-tight">
                            {video.title || `Aula ${idx + 1}`}
                        </span>
                        <span className="text-[9px] text-zinc-600 font-mono flex items-center gap-1 mt-1">
                            {isPandaVideo(video.link) ? 'Player Interno' : 'Link Externo'} • {video.duration} min
                        </span>
                    </div>
                </div>
            </div>
          ))}

          {/* 2. FILES (Dynamic Color) */}
          {goal.files?.map((file, idx) => (
            <button
              key={idx}
              onClick={() => handleOpenPdf(file.url)}
              disabled={loadingPdf}
              className="w-full flex items-center justify-between p-2.5 rounded-lg border transition-all text-left group/file mb-1 hover:border-white/10"
              style={{ backgroundColor: `${metaColor}0D`, borderColor: 'transparent' }}
            >
              <div className="flex items-center gap-3">
                <div 
                    className="p-1.5 rounded"
                    style={{ backgroundColor: `${metaColor}1A`, color: metaColor }}
                >
                  <FileText size={14} />
                </div>
                <span className="text-xs font-medium text-zinc-300 group-hover/file:text-white transition-colors">{file.name}</span>
              </div>
              {loadingPdf ? (
                 <span className="text-[9px] animate-pulse" style={{ color: metaColor }}>Abrindo...</span>
              ) : (
                 <Download size={14} className="text-zinc-600 group-hover/file:text-white transition-colors" />
              )}
            </button>
          ))}

          {/* 3. LINKS (Dynamic Color) */}
          {goal.links?.map((link, idx) => (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-2.5 rounded-lg border transition-all group/link mb-1 hover:border-white/10"
              style={{ backgroundColor: `${metaColor}0D`, borderColor: 'transparent' }}
            >
              <div 
                className="p-1.5 rounded"
                style={{ backgroundColor: `${metaColor}1A`, color: metaColor }}
              >
                <ExternalLink size={14} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate transition-colors" style={{ color: metaColor }}>{link.name}</span>
                <span className="text-[9px] text-zinc-600 truncate">{link.url}</span>
              </div>
            </a>
          ))}

          {/* 4. ADMIN CONTENT (Dynamic Color) */}
          {(hasAdminMindMap || hasAdminFlashcards) && (
             <div 
                className="mt-2 mb-2 p-2 border rounded-lg flex items-center justify-between group/admin transition-colors"
                style={{ 
                    borderColor: `${metaColor}30`, 
                    backgroundColor: `${metaColor}10` 
                }}
             >
                <div className="flex items-center gap-2">
                    {hasAdminMindMap ? (
                        <BrainCircuit size={16} style={{ color: metaColor }} />
                    ) : (
                        <Layers size={16} style={{ color: metaColor }} />
                    )}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: metaColor }}>
                            {hasAdminMindMap ? 'Mapa Mental' : 'Flashcards'}
                        </span>
                        <span className="text-[9px] font-medium" style={{ color: metaColor, opacity: 0.7 }}>
                            Material Oficial do Curso
                        </span>
                    </div>
                </div>
                <button 
                    onClick={() => hasAdminMindMap ? setIsAdminMapOpen(true) : setIsAdminFlashcardOpen(true)}
                    className="px-3 py-1.5 text-white text-[9px] font-bold uppercase rounded transition-colors flex items-center gap-1.5 hover:brightness-110 shadow-sm"
                    style={{ backgroundColor: metaColor }}
                >
                    {hasAdminMindMap ? <Eye size={10} /> : <Play size={10} />}
                    Visualizar
                </button>
             </div>
          )}

          {/* EMPTY STATE */}
          {(!goal.videos?.length && !goal.files?.length && !goal.links?.length && !hasAdminMindMap && !hasAdminFlashcards) && (
             <div className="p-3 text-center border border-dashed border-zinc-800 rounded-lg">
                <p className="text-[10px] text-zinc-600 uppercase font-bold">Sem conteúdo anexado</p>
             </div>
          )}

        </div>
      )}
    </div>

    {/* --- ADMIN CONTENT VIEWERS --- */}
    {hasAdminMindMap && (
        <MindMapViewerModal 
            isOpen={isAdminMapOpen}
            onClose={() => setIsAdminMapOpen(false)}
            nodes={goal.summaryConfig?.mindMap || []}
            edges={[]}
            title={`Mapa Mental: ${goal.title}`}
            timerState={{ status: 'idle', formattedTime: '00:00' }} // No timer needed in static view
        />
    )}

    {hasAdminFlashcards && (
        <FlashcardPlayerModal 
            isOpen={isAdminFlashcardOpen}
            onClose={() => setIsAdminFlashcardOpen(false)}
            flashcards={goal.flashcardConfig?.cards || []}
            title={`Flashcards: ${goal.title}`}
            timerState={{ status: 'idle', formattedTime: '00:00' }}
            accentColor={metaColor}
        />
    )}

    {/* MODAL DE CONFIRMAÇÃO DE CONCLUSÃO MANUAL */}
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
                        Concluir Meta?
                    </h3>
                    
                    <div className="text-sm text-zinc-400 leading-relaxed">
                        <p>Você está prestes a marcar a meta <strong>&quot;{goal.title}&quot;</strong> como concluída.</p>
                        <p className="mt-2 text-xs bg-zinc-950 p-2 rounded border border-zinc-800 text-zinc-500">
                            Isso removerá quaisquer agendamentos futuros desta meta do seu calendário.
                        </p>
                    </div>

                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setShowConfirmModal(false)}
                            className="flex-1 py-3 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold uppercase text-xs tracking-widest transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmCompletion}
                            className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )}
    </>
  );
};

export default LinkedGoalItem;
