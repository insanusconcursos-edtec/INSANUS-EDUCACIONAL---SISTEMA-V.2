
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  PlayCircle, FileText, ListChecks, Book, RefreshCw, 
  Clock, CheckCircle2, Circle, StickyNote,
  ChevronDown, ChevronUp, Link as LinkIcon, Download,
  BrainCircuit, Layers, Play, Pause, Check, Maximize2, Timer, Loader2, Square, PlusCircle, Trophy, AlertTriangle, MessageSquare, Minimize2
} from 'lucide-react';
import { useStudyContext } from '../../contexts/StudyContext';
import { useAuth } from '../../contexts/AuthContext';
import { isPandaVideo } from '../../utils/videoHelpers';
import { openWatermarkedPdf } from '../../utils/pdfSecurityService';
import VideoPlayerModal from './VideoPlayerModal';
import MindMapViewerModal from './MindMapViewerModal';
import FlashcardPlayerModal from './FlashcardPlayerModal';
import { mergeGoalExtension, getLocalISODate } from '../../services/scheduleService';
import { registerStudySession, updateGoalRecordedTime, getStudentConfig } from '../../services/studentService';

export type GoalType = 'lesson' | 'material' | 'questions' | 'law' | 'review' | 'summary' | 'simulado' | 'free_study';

export interface StudentGoal {
  id: string;
  metaId?: string;
  type: GoalType;
  title: string;
  discipline: string;
  disciplineId?: string;
  topic: string;
  topicId?: string;
  duration: number; // minutes
  multiplier?: number; // Multiplicative factor for repetitions
  isCompleted: boolean;
  status?: string; // Add status for compatibility
  observation?: string;
  color?: string;
  planId?: string; // Needed for merge
  date?: string; // Essential for Time Tracking updates
  isFreeStudy?: boolean;
  part?: number; // Explicit part number
  order?: number; // Explicit order number
  
  // Time Tracking (Added)
  recordedMinutes?: number; 

  // Smart Extension
  smartExtension?: {
    minutes: number;
    type: 'overflow';
  };

  // Review System
  reviewLabel?: string;
  isSpacedReview?: boolean;
  
  // Rich Content Arrays
  videos?: { title: string; duration: number; link: string }[];
  files?: { name: string; url: string }[];
  links?: { name: string; url: string }[];
  mindMap?: any[]; 
  flashcards?: any[]; 
  questions?: any[];

  contentCount?: {
    video?: number;
    pdf?: number;
    questions?: number;
  };
  
  // Simulado Specifics
  pdfUrl?: string;
  arquivoProvaUrl?: string;
  bookletUrl?: string;

  // Cycle Identification
  cycleName?: string;
  cycleId?: string;
  cycleOrder?: number;
  disciplineOrder?: number;
  subjectOrder?: number;
  taskOrder?: number;
  isNewTopic?: boolean;
  isNewCycle?: boolean;
}

interface StudentGoalCardProps {
  goal: StudentGoal;
  onStart?: (goal: StudentGoal) => void;
  onToggleComplete?: (goal: StudentGoal) => void;
  onRefresh?: () => void; // Callback to refresh dashboard after merge
  onPdfClick?: (goal: StudentGoal, fileUrl: string, index: number) => void; // New prop
  renderNotebookNode?: (goal: StudentGoal) => React.ReactNode;
  isDelayed?: boolean;
}

const TYPE_CONFIG: Record<GoalType, { label: string; color: string; icon: any }> = {
  lesson: { label: 'AULA', color: '#3b82f6', icon: PlayCircle },
  material: { label: 'PDF', color: '#f97316', icon: FileText },
  questions: { label: 'QUESTÕES', color: '#10b981', icon: ListChecks },
  law: { label: 'LEI SECA', color: '#eab308', icon: Book },
  review: { label: 'FLASHCARD', color: '#ec4899', icon: RefreshCw },
  summary: { label: 'RESUMO', color: '#a855f7', icon: FileText },
  simulado: { label: 'SIMULADO', color: '#EAB308', icon: Trophy }, 
  free_study: { label: 'ESTUDO LIVRE', color: '#10b981', icon: Trophy },
};

export const StudentGoalCard: React.FC<StudentGoalCardProps> = ({ goal, onStart, onToggleComplete, onRefresh, onPdfClick, isDelayed, renderNotebookNode }) => {
  const { userData, currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  // -- ESTADOS LOCAIS DE PROGRESSO --
  const [completedVideoIndices, setCompletedVideoIndices] = useState<Set<number>>(new Set());
  
  // -- CONTROLE DO PLAYER (Apenas para Aulas) --
  const [playerState, setPlayerState] = useState<'closed' | 'open' | 'minimized'>('closed');
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  
  // -- CONTROLE DE PDF (Loading) --
  const [loadingPdfIndex, setLoadingPdfIndex] = useState<number | null>(null);

  // -- CONTROLE DE MAPA MENTAL --
  const [isMapOpen, setIsMapOpen] = useState(false);

  // -- CONTROLE DE FLASHCARDS --
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  const [selectedFlashcards, setSelectedFlashcards] = useState<any[]>([]);

  // -- CONTROLE DE MERGE (SMART EXTENSION) --
  const [isMerging, setIsMerging] = useState(false);
  const [isMerged, setIsMerged] = useState(false); // Optimistic UI state to hide box
  const [displayDuration, setDisplayDuration] = useState(goal.duration); // Optimistic UI state for time

  // -- CONTROLE DE CONCLUSÃO MANUAL --
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

  // -- CONTROLE DE OBSERVAÇÃO (ACORDEÃO) --
  const [isObservationOpen, setIsObservationOpen] = useState(false);

  // -- CONTROLE DE SIMULADO (Local state to map to the requested logic) --
  const [isSimuladoMaterialsExpanded, setIsSimuladoMaterialsExpanded] = useState(false);

  // O Timer é global.
  const studyManager = useStudyContext();
  const isThisGoalActive = studyManager.activeGoal?.id === goal.id;
  
  // Create a local proxy if this goal isn't active, it should look like 'idle'
  const timer = isThisGoalActive ? studyManager : {
    status: 'idle' as const,
    seconds: 0,
    formattedTime: '00:00',
    start: () => studyManager.startGoal(goal),
    pause: studyManager.pause,
    resume: studyManager.resume,
    finish: studyManager.finish,
    reset: studyManager.reset,
    setIsFloating: studyManager.setIsFloating,
    setIsMaterialActive: studyManager.setIsMaterialActive,
    isMaterialActive: studyManager.isMaterialActive
  };
  
  const defaultConfig = TYPE_CONFIG[goal.type] || TYPE_CONFIG.lesson;
  const activeColor = (goal.color && goal.color.startsWith('#')) ? goal.color : defaultConfig.color;
  const isLessonGoal = goal.type === 'lesson';
  const isFreeStudyGoal = goal.type === 'free_study' || goal.isFreeStudy;

  // Counts & Checks
  const videoCount = goal.videos?.length || 0;
  const fileCount = goal.files?.length || 0;
  const linkCount = goal.links?.length || 0;
  const hasMindMap = !!goal.mindMap && goal.mindMap.length > 0;
  const hasFlashcards = !!goal.flashcards && goal.flashcards.length > 0;
  const questionCount = goal.questions?.length || 0;

  // Separação Lógica: Anexos vs Capacidade de Estudo
  const hasActualMaterials = videoCount > 0 || fileCount > 0 || linkCount > 0 || hasMindMap || hasFlashcards || questionCount > 0;
  const hasContent = hasActualMaterials || isFreeStudyGoal;
  const totalMaterials = videoCount + fileCount + linkCount + (hasMindMap ? 1 : 0) + (hasFlashcards ? 1 : 0) + (questionCount > 0 ? 1 : 0);

  // Sincroniza duração se a prop mudar (ex: após refresh real do banco)
  useEffect(() => {
    setDisplayDuration(goal.duration);
    if (!goal.smartExtension) {
        setIsMerged(false); // Reset state if prop changes structure
    }
  }, [goal.duration, goal.smartExtension]);

  // --- LOGIC: MERGE EXTENSION (OPTIMISTIC) ---
  const handleMergeExtension = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !goal.planId || !goal.smartExtension) return;
    
    setIsMerging(true);
    
    // 1. Optimistic Update (Feedback Instantâneo)
    const extensionMinutes = goal.smartExtension.minutes;
    const previousDuration = displayDuration; // Backup para rollback
    
    setIsMerged(true); // Esconde a caixa de aviso
    setDisplayDuration(prev => prev + extensionMinutes); // Atualiza o tempo no header

    try {
        const eventPayload: any = {
            ...goal,
            id: goal.id,
            metaId: goal.metaId, // Now correctly using the property
        };

        // We need date for the service to find the document.
        eventPayload.date = goal.date || new Date().toISOString().split('T')[0]; 

        // 1. Execute Merge (DB Update)
        await mergeGoalExtension(currentUser.uid, goal.planId, eventPayload);
        
        if (onRefresh) onRefresh();
    } catch (error) {
        console.error(error);
        alert("Erro ao unificar meta.");
        
        // Rollback em caso de erro
        setIsMerged(false);
        setDisplayDuration(previousDuration);
    } finally {
        setIsMerging(false);
    }
  };

  // --- LOGIC: COMPLETION (MACRO) ---
  const handleMainCheckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (goal.isCompleted) {
       // Se já está concluída, permite desfazer imediatamente (UX)
       if (onToggleComplete) onToggleComplete(goal);
       setCompletedVideoIndices(new Set()); 
    } else {
       // Se não está concluída, pede confirmação
       setIsCompleteModalOpen(true);
    }
  };

  const handleConfirmCompletion = () => {
    if (onToggleComplete) onToggleComplete(goal);
    
    // Se for Aula, marca visualmente todos os vídeos como vistos (Efeito cascata visual)
    if (isLessonGoal && goal.videos) {
        const allIndices = goal.videos.map((_, i) => i);
        setCompletedVideoIndices(new Set(allIndices));
    }
    
    setIsCompleteModalOpen(false);
  };

  // Sincroniza estado inicial se a meta já vier completa do banco
  useEffect(() => {
    if (goal.isCompleted && goal.videos) {
        const allIndices = goal.videos.map((_, i) => i);
        setCompletedVideoIndices(new Set(allIndices));
    }
  }, [goal.isCompleted]);

  // Auto-complete goal se todos os vídeos forem assistidos (Apenas Aulas)
  useEffect(() => {
    if (isLessonGoal && goal.videos && goal.videos.length > 0 && !goal.isCompleted) {
        if (completedVideoIndices.size === goal.videos.length) {
            // Check if timer session needs to be saved before completing
            if (timer.status !== 'idle') {
                handleFinishGlobalSession();
            } else if (onToggleComplete) {
                onToggleComplete(goal);
            }
        }
    }
  }, [completedVideoIndices, goal.videos, goal.isCompleted, isLessonGoal]);


  // --- LOGIC: VIDEO PLAYER (LESSON ONLY) ---

  const handleVideoClick = (video: { title: string; link: string }, index: number) => {
    if (isPandaVideo(video.link)) {
        if (activeVideoIndex === index && playerState !== 'closed') {
            setPlayerState('open');
            studyManager.setIsMaterialActive(true);
            return;
        }
        setActiveVideoIndex(index);
        setPlayerState('open');
        studyManager.setIsMaterialActive(true);
        timer.reset(); 
        if (onStart && timer.status === 'idle') onStart(goal);
    } else {
        window.open(video.link, '_blank');
        if (timer.status === 'idle') {
            timer.start();
            if (onStart) onStart(goal);
        }
    }
  };

  const handleMinimizePlayer = () => {
    setPlayerState('minimized');
    studyManager.setIsMaterialActive(false);
  };

  const handleClosePlayer = async () => {
    // Ao fechar player, pausa (o contexto já salva o tempo)
    await timer.pause();
    setPlayerState('closed');
    setActiveVideoIndex(null);
    studyManager.setIsMaterialActive(false);
  };

  const handleCompleteVideo = async () => {
    if (activeVideoIndex !== null) {
        setCompletedVideoIndices(prev => new Set(prev).add(activeVideoIndex!));
        // Ao completar vídeo, também pausa
        await timer.pause();
        handleClosePlayer();
    }
  };

  // Wrapper para Pausar do Player
  const handlePlayerPause = async () => {
      await timer.pause();
  };

  // --- LOGIC: PDF SECURITY (WATERMARK) ---
  const handleFileClick = async (fileUrl: string, index: number) => {
    if (!fileUrl) return;
    if (loadingPdfIndex !== null) return;

    // INTERCEPTAGEM PARA INTEGRAÇÃO COM CADERNO
    const isPdf = fileUrl.toLowerCase().includes('.pdf');
    const isMaterialOrLaw = goal.type === 'material' || goal.type === 'law';

    if (isPdf && isMaterialOrLaw && onPdfClick) {
        onPdfClick(goal, fileUrl, index);
        studyManager.setIsMaterialActive(true);
        return;
    }

    setLoadingPdfIndex(index);
    
    try {
        const userCpf = userData?.cpf || '000.000.000-00';
        const userEmail = currentUser?.email || 'usuario@insanus.com';

        await openWatermarkedPdf(fileUrl, {
            uid: currentUser?.uid,
            email: userEmail,
            cpf: userCpf
        });
    } catch (error: any) {
        console.error("Erro ao abrir PDF:", error);
        alert(`Erro de Segurança: ${error.message || "Não foi possível carregar o arquivo."}`);
    } finally {
        setLoadingPdfIndex(null);
    }
  };

  // --- LOGIC: MIND MAP OPENER ---
  const handleOpenMindMap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!goal.mindMap) return;
    setIsMapOpen(true);
    studyManager.setIsMaterialActive(true);
  };

  // --- LOGIC: FLASHCARD OPENER ---
  const handleOpenFlashcards = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!goal.flashcards) return;
    setSelectedFlashcards(goal.flashcards);
    setIsFlashcardOpen(true);
    studyManager.setIsMaterialActive(true);
  };

  // --- LOGIC: GLOBAL TIMER CONTROLS (NON-LESSON) ---
  
  const handleGlobalPause = async () => {
      await timer.pause();
  };

  const handleFinishGlobalSession = async () => {
    // 1. Force timer finish visually (and save in context)
    const timeSpent = await timer.finish(); 
    console.log(`Meta "${goal.title}" concluída em ${timeSpent} segundos.`);
    
    // 2. Calculate total time to pass up
    const sessionMinutes = timeSpent / 60; // Total session time
    const updatedRecordedMinutes = (goal.recordedMinutes || 0) + sessionMinutes;

    // 4. Update parent with COMPLETED status + NEW TOTAL TIME
    if (onToggleComplete) {
        // Enforce isCompleted: true to trigger service logic for completion
        onToggleComplete({
            ...goal,
            isCompleted: true, // FORCE COMPLETED
            recordedMinutes: updatedRecordedMinutes
        });
    }
  };

  const activeVideoData = activeVideoIndex !== null && goal.videos ? goal.videos[activeVideoIndex] : null;
  const isCardCompleted = goal.isCompleted || timer.status === 'completed';

  // --- SPECIAL RENDER FOR SIMULADO ---
  if (goal.type === 'simulado') {
    const pdfUrl = goal.files?.[0]?.url || goal.pdfUrl || goal.arquivoProvaUrl || goal.bookletUrl; 
    const isCompleted = goal.isCompleted || goal.status === 'completed';
    const isExpanded = isSimuladoMaterialsExpanded;

    return (
        <div className={`border rounded-xl overflow-hidden mb-4 transition-all duration-300
            ${isCompleted 
                ? 'bg-[#121418] border-green-900/30 opacity-75 grayscale-[0.2]' // Visual Concluído
                : 'bg-black border-yellow-600/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' // Visual Pendente
            }`}
        >
            <div className="p-5 md:p-6 relative flex flex-col">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isCompleted ? 'bg-green-500' : 'bg-yellow-500'}`}></div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                    <div className={`p-4 rounded-xl shrink-0 hidden sm:block border
                        ${isCompleted 
                            ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        }`}
                    >
                        {isCompleted ? (
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        )}
                    </div>

                    <div className="flex-1 w-full">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h4 className={`${isCompleted ? 'text-green-500' : 'text-yellow-500'} font-black text-xs uppercase tracking-widest`}>
                                META DE SIMULADO
                            </h4>
                            <span className="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded border border-gray-700 font-mono">
                                ID: {goal.metaId?.slice(0,6) || goal.id?.slice(0,6)}
                            </span>
                            {goal.cycleName && (
                                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center">
                                    <span className="mx-1.5 opacity-30">•</span>
                                    {goal.cycleName}
                                </span>
                            )}
                        </div>
                        
                        <h3 className={`font-bold text-xl md:text-2xl leading-tight break-words ${isCompleted ? 'text-gray-500 line-through decoration-gray-600' : 'text-white'}`}>
                            {goal.title}
                        </h3>
                        
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                            <span className="text-gray-400 text-sm flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {Math.floor((goal.duration || 240) / 60)}h Duração
                            </span>
                            {!isCompleted && (
                                <span className={`text-sm flex items-center gap-1.5 ${pdfUrl ? 'text-green-500' : 'text-red-500'}`}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    {pdfUrl ? 'Caderno Disponível' : 'Caderno Pendente'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {!isCompleted ? (
                    <div className="mt-6 pt-4 border-t border-gray-800 flex flex-col sm:flex-row justify-end items-center gap-3 w-full">
                        <button
                            onClick={() => setIsSimuladoMaterialsExpanded(!isSimuladoMaterialsExpanded)}
                            className={`w-full sm:w-auto px-6 py-3 rounded-lg font-bold text-xs uppercase tracking-wider border transition-all flex justify-center items-center gap-2
                                ${isExpanded ? 'bg-gray-800 border-gray-600 text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'}
                            `}
                        >
                            {isExpanded ? 'Ocultar Materiais' : 'Ver Materiais'}
                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); if (onStart) onStart(goal); }}
                            className="w-full sm:w-auto px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm rounded-lg uppercase tracking-wider transition-all shadow-lg shadow-yellow-900/30 flex justify-center items-center gap-2 transform hover:scale-105"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            INICIAR PROVA
                        </button>
                    </div>
                ) : (
                    <div className="mt-6 pt-4 border-t border-gray-800 flex justify-center items-center gap-2 text-green-500 bg-green-900/10 rounded-b-xl -mx-5 -mb-5 md:-mx-6 md:-mb-6 p-4">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="font-black text-sm uppercase tracking-widest">Simulado Concluído</span>
                    </div>
                )}

                {isExpanded && !isCompleted && (
                    <div className="mt-4 border-t border-gray-800 bg-[#0f1115] p-4 md:p-6 rounded-lg animate-in slide-in-from-top-2">
                        <h4 className="text-gray-400 font-bold text-xs uppercase mb-3">Material de Apoio</h4>
                        {pdfUrl ? (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg bg-[#1a1d24] border border-gray-700 hover:border-gray-500 transition-colors gap-4 group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500/10 text-red-500 rounded shrink-0">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">Caderno de Questões Oficial</p>
                                        <p className="text-gray-500 text-xs">PDF • Clique para abrir</p>
                                    </div>
                                </div>
                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto text-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded uppercase transition-colors">
                                    Abrir PDF
                                </a>
                            </div>
                        ) : (
                            <div className="text-gray-500 text-sm italic p-4 text-center border border-gray-800 border-dashed rounded">Nenhum caderno disponível.</div>
                        )}
                        <div className="mt-4 p-4 bg-yellow-900/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
                            <svg className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="text-xs text-yellow-200/80 leading-relaxed"><strong>Atenção:</strong> Baixe o caderno antes de iniciar a prova. O modo foco bloqueará outras ações na tela.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <>
    <div 
      className={`
        group relative flex flex-col
        bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden
        transition-all duration-300 hover:border-zinc-700 hover:-translate-y-1 hover:shadow-xl
        ${isCardCompleted ? 'opacity-60 grayscale-[0.5]' : 'opacity-100'}
        ${playerState === 'open' ? 'ring-1 ring-white/20 border-zinc-600' : ''}
      `}
    >
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 z-10 transition-colors"
        style={{ backgroundColor: activeColor }}
      />

      <div className="p-5 pb-2 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleMainCheckClick}
            className="text-zinc-500 hover:text-white transition-colors focus:outline-none"
          >
            {isCardCompleted ? (
              <CheckCircle2 size={24} className="text-emerald-500" weight="fill" />
            ) : (
              <Circle size={24} className="text-zinc-600 group-hover:text-[var(--plan-theme)]" />
            )}
          </button>

          <span 
            className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border transition-colors flex items-center gap-1.5"
            style={{ 
              color: isFreeStudyGoal ? '#10b981' : activeColor, 
              borderColor: isFreeStudyGoal ? '#10b98140' : `${activeColor}40`, 
              backgroundColor: isFreeStudyGoal ? '#10b98115' : `${activeColor}15`
            }}
          >
            {isFreeStudyGoal ? <Trophy size={10} className="text-emerald-500" /> : null}
            {isFreeStudyGoal ? 'ESTUDO LIVRE' : defaultConfig.label}
          </span>

          {goal.cycleName && (
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center">
              <span className="mx-1.5 opacity-30">•</span>
              {goal.cycleName}
            </span>
          )}

          {goal.part !== null && goal.part !== undefined && goal.part > 0 && !isMerged && (
            <span 
                className="px-2 py-0.5 text-[9px] font-bold uppercase rounded border border-white/20 bg-white/5 text-gray-300"
                onClick={(e) => e.stopPropagation()}
            >
                PARTE {goal.part}
            </span>
          )}

          {goal.reviewLabel && (
            <span 
                className="px-2 py-0.5 text-[9px] font-bold uppercase rounded border border-purple-500/50 bg-purple-500/10 text-purple-400 animate-pulse"
                onClick={(e) => e.stopPropagation()}
            >
                {goal.reviewLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-zinc-500">
          <Clock size={12} />
          <span className="text-xs font-mono font-bold">{displayDuration} min</span>
        </div>
      </div>

      {/* BODY */}
      <div className="px-5 py-2 flex-1 cursor-pointer" onClick={() => hasContent && setIsOpen(!isOpen)}>
        {isDelayed && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Atrasado</span>
          </div>
        )}
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1 truncate">
          {goal.discipline}
        </span>
        <h3 className={`text-sm font-black uppercase leading-tight line-clamp-3 ${isCardCompleted ? 'text-zinc-500 line-through' : 'text-white'}`}>
          {goal.title}
        </h3>
        <p className="text-[10px] text-zinc-400 font-medium mt-1 line-clamp-2 uppercase">
          {goal.topic}
        </p>
        
        {goal.observation && (
          <div className="mt-3 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setIsObservationOpen(!isObservationOpen)}
              className="flex items-center justify-between w-full p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-all group"
            >
              <div className="flex items-center gap-2 text-orange-500 text-[10px] font-black uppercase tracking-wider">
                <MessageSquare size={14} className="group-hover:scale-110 transition-transform" />
                <span>Dica do Mentor</span>
              </div>
              <ChevronDown 
                size={14} 
                className={`text-orange-500 transition-transform duration-300 ${isObservationOpen ? 'rotate-180' : ''}`} 
              />
            </button>
            
            {isObservationOpen && (
              <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-lg text-[11px] text-orange-200/90 leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-1 duration-300">
                {goal.observation}
              </div>
            )}
          </div>
        )}

        {/* REPETITION WARNING FOR LEI SECA */}
        {goal.type === 'law' && goal.multiplier && goal.multiplier > 1 && !isCardCompleted && (
          <div 
            className="mt-3 flex items-start gap-2 bg-[var(--plan-theme)]/10 border border-[var(--plan-theme)]/20 p-2 rounded-lg animate-pulse"
            onClick={(e) => e.stopPropagation()}
          >
              <AlertTriangle size={12} className="text-[var(--plan-theme)] mt-0.5 shrink-0" />
              <span className="text-[10px] text-[var(--plan-theme)] font-black uppercase tracking-tight">
                  Repita a leitura do documento {goal.multiplier} vezes
              </span>
          </div>
        )}

        {/* SMART EXTENSION NOTICE */}
        {goal.smartExtension && !isCardCompleted && !isMerged && (
            <div className="mt-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 flex flex-col gap-2 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                <div className="flex items-start gap-2 pl-2">
                    <Clock className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-zinc-300 leading-relaxed">
                        Faltam apenas <span className="text-orange-400 font-bold">{goal.smartExtension.minutes} min</span> para finalizar esta meta.
                        Deseja adicionar esse tempo hoje?
                    </p>
                </div>
                <button 
                    onClick={handleMergeExtension}
                    disabled={isMerging}
                    className="self-end px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1 shadow-lg shadow-orange-900/20"
                >
                    {isMerging ? <Loader2 size={10} className="animate-spin" /> : <PlusCircle size={10} />}
                    {isMerging ? 'Unindo...' : 'Sim, Adicionar'}
                </button>
            </div>
        )}
      </div>

      {/* EXPANDED CONTENT */}
      {isOpen && hasContent && (
        <div className="bg-black/20 border-t border-zinc-800/50 animate-in slide-in-from-top-2 duration-200">
            {/* 1. VIDEOS */}
            {videoCount > 0 && (
                <div className="p-4 space-y-2">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <PlayCircle size={12} /> Aulas
                    </h4>
                    {goal.videos?.map((vid, idx) => {
                        const isVideoDone = completedVideoIndices.has(idx);
                        const isActive = activeVideoIndex === idx;
                        const isMinimized = isActive && playerState === 'minimized';
                        const isPlaying = isActive && playerState === 'open';

                        return (
                            <div 
                                key={idx} 
                                className={`
                                    flex items-center justify-between p-2 rounded-lg border transition-all 
                                    ${isActive ? 'bg-zinc-900 border-zinc-700 ring-1 ring-zinc-700' : 'bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800'}
                                    ${isVideoDone ? 'opacity-70' : ''}
                                `}
                            >
                                <div 
                                    className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                                    onClick={() => handleVideoClick(vid, idx)}
                                >
                                    <button 
                                        className={`
                                            p-1.5 rounded-full transition-all flex-shrink-0
                                            ${isVideoDone ? 'bg-emerald-500/20 text-emerald-500' : 
                                              isActive ? 'bg-[var(--plan-theme)] text-white' : 
                                              'bg-zinc-900 text-zinc-400 group-hover:text-white group-hover:bg-zinc-700'}
                                        `}
                                    >
                                        {isVideoDone ? <Check size={10} /> : <Play size={10} fill="currentColor" />}
                                    </button>
                                    
                                    <span className={`text-xs font-medium truncate ${isVideoDone ? 'text-zinc-500 line-through' : isActive ? 'text-white font-bold' : 'text-zinc-300'}`}>
                                        {vid.title || `Aula ${idx+1}`}
                                    </span>
                                </div>

                                <div className="ml-3 flex items-center">
                                    {isMinimized ? (
                                        <div className="flex items-center gap-2 bg-zinc-950 px-2 py-1 rounded border border-zinc-800 animate-in fade-in">
                                            <span className={`w-1.5 h-1.5 rounded-full ${timer.status === 'running' ? 'bg-[var(--plan-theme)] animate-pulse shadow-[0_0_8px_var(--plan-theme)]' : 'bg-yellow-500'}`}></span>
                                            <span className="text-[10px] font-mono font-bold text-white tabular-nums">
                                                {timer.formattedTime}
                                            </span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setPlayerState('open'); }}
                                                className="text-zinc-400 hover:text-white"
                                                title="Maximizar"
                                            >
                                                <Maximize2 size={10} />
                                            </button>
                                        </div>
                                    ) : isPlaying ? (
                                        <span className="text-[9px] font-bold text-[var(--plan-theme)] uppercase animate-pulse tracking-wider">
                                            Assistindo...
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-mono text-zinc-500">
                                            {vid.duration}m
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 2. NON-VIDEO */}
            {(fileCount > 0 || linkCount > 0 || hasMindMap || hasFlashcards) && (
                <div className="p-4 pt-0 space-y-2">
                    {fileCount > 0 && goal.files?.map((file, idx) => {
                        const isLoading = loadingPdfIndex === idx;
                        return (
                            <div 
                                key={idx} 
                                onClick={() => !isLoading && handleFileClick(file.url, idx)}
                                className={`
                                    flex items-center justify-between p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 transition-colors group/item cursor-pointer
                                    ${isLoading ? 'opacity-70 cursor-wait bg-zinc-800' : ''}
                                `}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <FileText size={14} className="text-zinc-500 group-hover/item:text-orange-400 transition-colors" />
                                    <span className="text-xs font-medium text-zinc-300 truncate">{file.name}</span>
                                </div>
                                {isLoading ? (
                                    <Loader2 size={14} className="text-[var(--plan-theme)] animate-spin" />
                                ) : (
                                    <Download size={14} className="text-zinc-600 group-hover/item:text-white transition-colors" />
                                )}
                            </div>
                        );
                    })}
                    
                    {linkCount > 0 && goal.links?.map((link, idx) => (
                        <a href={link.url} target="_blank" rel="noreferrer" key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 transition-colors group/item">
                            <LinkIcon size={14} className="text-zinc-500 group-hover/item:text-blue-400 transition-colors" />
                            <span className="text-xs font-medium text-zinc-300 truncate underline decoration-zinc-700 group-hover/item:decoration-blue-400/50">{link.name}</span>
                        </a>
                    ))}

                    {(hasMindMap || hasFlashcards) && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            {hasMindMap && (
                                <button 
                                    onClick={handleOpenMindMap}
                                    className="flex flex-col items-center justify-center gap-2 p-3 bg-purple-900/10 hover:bg-purple-900/20 border border-purple-500/20 hover:border-purple-500/40 rounded-xl transition-all group/mm"
                                >
                                    <BrainCircuit size={20} className="text-purple-500 group-hover/mm:scale-110 transition-transform" />
                                    <span className="text-[9px] font-bold text-purple-400 uppercase">Mapa Mental</span>
                                </button>
                            )}
                            {hasFlashcards && (
                                <button 
                                    onClick={handleOpenFlashcards}
                                    className="flex flex-col items-center justify-center gap-2 p-3 bg-pink-900/10 hover:bg-pink-900/20 border border-pink-500/20 hover:border-pink-500/40 rounded-xl transition-all group/fc"
                                >
                                    <Layers size={20} className="text-pink-500 group-hover/fc:scale-110 transition-transform" />
                                    <span className="text-[9px] font-bold text-pink-400 uppercase">Flashcards</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
      )}

      {/* === FOOTER (CONDITIONAL) === */}
      
      {isLessonGoal && hasActualMaterials && (
        <div 
            className="p-3 bg-zinc-950/30 border-t border-zinc-800/50 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-900/50 transition-colors group/indicator"
            onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
            }}
        >
            {!isOpen && (
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 group-hover/indicator:text-zinc-400 transition-colors">
                    {totalMaterials} {totalMaterials === 1 ? 'Material Disponível' : 'Materiais Disponíveis'}
                </span>
            )}
            <div className="text-zinc-600">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
        </div>
      )}

      {!isLessonGoal && (
        <div className="p-4 mt-auto">
            {hasActualMaterials && (
                <div 
                    className="flex flex-col items-center justify-center mb-3 cursor-pointer text-zinc-600 hover:text-white transition-colors group/indicator"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                >
                    {!isOpen && (
                        <span className="text-[10px] font-bold uppercase tracking-widest mb-1 group-hover/indicator:text-zinc-400 transition-colors">
                            {totalMaterials} {totalMaterials === 1 ? 'Material Disponível' : 'Materiais Disponíveis'}
                        </span>
                    )}
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            )}

            {timer.status === 'idle' && !isCardCompleted && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        timer.start();
                        if(onStart) onStart(goal);
                        if (hasContent && !isOpen) setIsOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-110 shadow-lg active:scale-95 text-white"
                    style={{ 
                        backgroundColor: activeColor,
                        boxShadow: `0 4px 20px ${activeColor}40`
                    }}
                >
                    <Play size={14} fill="currentColor" /> INICIAR ESTUDO
                </button>
            )}

            {timer.status === 'running' && (
                <div className="flex flex-col gap-2 p-3 bg-[var(--plan-theme)]/5 border border-[var(--plan-theme)]/20 rounded-xl animate-pulse">
                    <div className="flex items-center justify-center gap-2 text-[var(--plan-theme)] font-black text-[10px] uppercase tracking-[0.2em]">
                        <Timer size={14} className="animate-spin-slow" />
                        Estudo em Andamento
                    </div>
                    <p className="text-[9px] text-zinc-500 text-center font-bold uppercase tracking-wider">
                        Use o painel flutuante para pausar ou concluir
                    </p>
                </div>
            )}

            {timer.status === 'paused' && (
                <div className="flex flex-col gap-2 p-3 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                    <div className="flex items-center justify-center gap-2 text-zinc-400 font-black text-[10px] uppercase tracking-[0.2em]">
                        <Pause size={14} fill="currentColor" />
                        Estudo Pausado
                    </div>
                </div>
            )}

            {isCardCompleted && (
                <div className="w-full py-3 bg-zinc-950 border border-emerald-900/30 rounded-xl flex items-center justify-center gap-2 text-emerald-500 cursor-not-allowed">
                    <CheckCircle2 size={16} />
                    <span className="text-xs font-black uppercase tracking-widest">Meta Concluída</span>
                </div>
            )}
        </div>
      )}

      {/* MODAL PERSISTENTE (VIDEO PLAYER) */}
      {activeVideoData && playerState !== 'closed' && (
        <VideoPlayerModal 
            isVisible={playerState === 'open'}
            videoTitle={activeVideoData.title}
            videoUrl={activeVideoData.link}
            timerFormatted={timer.formattedTime}
            timerStatus={timer.status}
            accentColor={activeColor}
            onTimerStart={timer.status === 'paused' ? timer.resume : timer.start}
            onTimerPause={handlePlayerPause} 
            onMinimize={handleMinimizePlayer}
            onClose={handleClosePlayer}
            onComplete={handleCompleteVideo}
            hasNotebook={!!renderNotebookNode}
            embeddedNotebookNode={renderNotebookNode ? renderNotebookNode(goal) : undefined}
        />
      )}

      {/* MODAL PERSISTENTE (MIND MAP) */}
      <MindMapViewerModal
        isOpen={isMapOpen}
        onClose={() => {
            setIsMapOpen(false);
            studyManager.setIsMaterialActive(false);
        }}
        nodes={goal.mindMap || []}
        edges={[]} 
        title={goal.title}
        timerState={{
            formattedTime: timer.formattedTime,
            status: timer.status
        }}
      />

      {/* MODAL PERSISTENTE (FLASHCARDS) */}
      <FlashcardPlayerModal 
        isOpen={isFlashcardOpen}
        onClose={() => {
            setIsFlashcardOpen(false);
            studyManager.setIsMaterialActive(false);
        }}
        flashcards={selectedFlashcards}
        title={goal.title}
        timerState={{
            formattedTime: timer.formattedTime,
            status: timer.status
        }}
        accentColor={activeColor}
      />

      {/* MODAL DE CONFIRMAÇÃO DE CONCLUSÃO MANUAL */}
      {isCompleteModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div 
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
            >
            <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                </div>

                <h3 className="text-xl font-bold text-white uppercase tracking-tight">CONCLUIR META?</h3>
                
                <p className="text-zinc-400 text-sm">
                Tem certeza que deseja concluir esta meta manualmente? 
                <br />
                O progresso será salvo e contabilizado no seu plano.
                </p>

                <div className="flex gap-3 w-full mt-2">
                <button
                    onClick={(e) => {
                    e.stopPropagation();
                    setIsCompleteModalOpen(false);
                    }}
                    className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-semibold transition-colors border border-zinc-700 text-xs uppercase tracking-widest"
                >
                    CANCELAR
                </button>
                
                <button
                    onClick={(e) => {
                    e.stopPropagation();
                    handleConfirmCompletion();
                    }}
                    className="flex-1 px-4 py-2 bg-[var(--plan-theme)] hover:brightness-110 text-white rounded-lg font-bold transition-colors shadow-lg shadow-[var(--plan-theme)]/20 text-xs uppercase tracking-widest"
                >
                    SIM, CONCLUIR
                </button>
                </div>
            </div>
            </div>
        </div>,
        document.body
      )}
    </div>
    </>
  );
};

export default StudentGoalCard;
