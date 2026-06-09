
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronRight, CheckCircle2, PlayCircle, FileText, FileQuestion,
  BrainCircuit, Layers, X, BookOpen, Loader2, CalendarClock, FolderKanban
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useSpacedReviewModal } from '../../../../contexts/SpacedReviewModalContext';
import { courseService } from '../../../../services/courseService';
import { getUserContent, createUserContent, updateUserContent } from '../../../../services/userContentService';
import { openWatermarkedPdf } from '../../../../utils/pdfSecurityService';
import { ConfirmationModal } from '../../../../components/ui/ConfirmationModal';
import MindMapFullscreen from '../../../../components/admin/metas/tools/mindmap/MindMapFullscreen';
import FlashcardFullscreenEditor from '../../../../components/admin/metas/tools/FlashcardFullscreenEditor';
import FlashcardPlayerModal from '../../FlashcardPlayerModal';
import { CourseEditalStructure } from '../../../../types/courseEdital';

// IMPORTAÇÕES DO SISTEMA DE REVISÃO
import { courseReviewService, CourseReview } from '../../../../services/courseReviewService';

// Helper para formatar data curta (dd/mm)
const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
};

// ==========================================
// 1. ACORDEÃO DO TÓPICO (AUTOSSUFICIENTE)
// ==========================================
function StudentTopicAccordion({ topic, courseId, planId, disciplineId, disciplineName, completedLessons, completedTopics, onToggleTopic, focusTopicId, numberingPrefix = "" }: any) {
  
  const { openSpacedReviewModal } = useSpacedReviewModal();
  // NOVA LÓGICA: Verifica se ESTE é o tópico exato que deve piscar
  const isFocused = String(topic.id) === String(focusTopicId);

  // NOVA LÓGICA: Verifica se algum FILHO deste tópico é o foco (para abrir recursivamente)
  const hasFocusedChild = useMemo(() => {
    if (!focusTopicId) return false;
    const check = (subtopics: any[]): boolean => {
        if (!subtopics) return false;
        for (const t of subtopics) {
            if (String(t.id) === String(focusTopicId)) return true;
            if (t.subtopics && check(t.subtopics)) return true;
        }
        return false;
    };
    return check(topic.subtopics);
  }, [topic.subtopics, focusTopicId]);

  // Se for o foco ou tiver filho focado, inicia aberto
  const [isOpen, setIsOpen] = useState(isFocused || hasFocusedChild);
  
  const [isLessonsOpen, setIsLessonsOpen] = useState(false);
  const { currentUser: user, userData } = useAuth(); 
  
  // Ref para Auto-Scroll
  const topicRef = useRef<HTMLDivElement>(null);
  
  // Efeito de rolagem automática e expansão
  useEffect(() => {
      if (isFocused || hasFocusedChild) {
          setIsOpen(true);
          if (isFocused) {
              setTimeout(() => {
                  topicRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300); // Aguarda a montagem do acordeão
          }
      }
  }, [isFocused, hasFocusedChild]);

  // ESTADO INTERNO DE CONFIRMAÇÃO E REVISÃO
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  
  // ESTADO PARA ARMAZENAR REVISÕES DESTE TÓPICO
  const [topicReviews, setTopicReviews] = useState<CourseReview[]>([]);

  // CÁLCULO DIRETO DO STATUS
  const isCompleted = completedTopics?.includes(String(topic.id)) || false;

  const [activeLesson, setActiveLesson] = useState<any | null>(null);
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  // Estados do Aluno (Criação Manual e Visualização)
  const [studentContent, setStudentContent] = useState<any>({ mindmap: null, flashcards: null });
  const [isStudentMindMapOpen, setIsStudentMindMapOpen] = useState(false);
  const [isStudentFlashcardsOpen, setIsStudentFlashcardsOpen] = useState(false);
  const [isProcessingStudent, setIsProcessingStudent] = useState(false);

  // --- NOVOS ESTADOS: CHAVEAMENTO DE CONTEXTO ---
  const [mapMode, setMapMode] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [flashcardMode, setFlashcardMode] = useState<'STUDENT' | 'TEACHER'>('STUDENT');

  // Carregar conteúdo do aluno
  useEffect(() => {
      if (isOpen && user) {
          const fetchStudentContent = async () => {
              try {
                  const mapData = await getUserContent(user.uid, courseId, topic.id, 'MAP');
                  const cardsData = await getUserContent(user.uid, courseId, topic.id, 'FLASHCARD');
                  setStudentContent({ 
                      mindmap: mapData.length > 0 ? mapData[0] : null, 
                      flashcards: cardsData.length > 0 ? cardsData[0] : null 
                  });
              } catch (error) {
                  console.error("Erro ao buscar conteúdo:", error);
              }
          };
          fetchStudentContent();
      }
  }, [isOpen, user, topic.id, courseId]);

  // Carregar revisões do tópico (Se concluído)
  const fetchReviews = async () => {
    if (user) {
        try {
            const reviews = await courseReviewService.getReviewsByTopic(user.uid, String(topic.id));
            setTopicReviews(reviews);
        } catch (error) {
            console.error("Erro ao buscar revisões:", error);
        }
    }
  };

  useEffect(() => {
    // Carrega revisões se o tópico estiver marcado como concluído OU se expandir
    if (isCompleted || isOpen) {
        fetchReviews();
    } else {
        setTopicReviews([]); // Limpa se não estiver concluído
    }
  }, [isCompleted, isOpen, user, topic.id]);

  const handlePlayLesson = async (lessonId: string) => {
    setIsLoadingVideo(true);
    try {
        const contents = await courseService.getContents(lessonId); 
        const videoContent = contents.find((c: any) => c.type === 'video');
        if (videoContent && videoContent.videoUrl) {
            setActiveLesson({ id: lessonId, title: 'Aula', videoUrl: videoContent.videoUrl });
        } else {
            alert("Nenhum vídeo cadastrado para esta aula.");
        }
    } catch (error) {
        alert("Não foi possível carregar o vídeo.");
    } finally {
        setIsLoadingVideo(false);
    }
  };

  const handleOpenPdf = async (url: string, id: string) => {
    if (!user || openingPdfId) return;
    setOpeningPdfId(id);
    try {
        await openWatermarkedPdf(url, {
            email: user.email || 'Email não identificado',
            cpf: userData?.cpf || user.uid 
        });
    } catch (error) {
        alert("Erro ao gerar documento seguro.");
    } finally {
        setOpeningPdfId(null);
    }
  };

  const handleStudentMindMap = async () => {
      if (studentContent.mindmap) {
          setIsStudentMindMapOpen(true);
      } else {
          setIsProcessingStudent(true);
          try {
              await createUserContent(user!.uid, courseId, topic.id, 'MAP', topic.name || 'Meu Mapa');
              const mapData = await getUserContent(user!.uid, courseId, topic.id, 'MAP');
              if (mapData.length > 0) {
                  setStudentContent((prev: any) => ({ ...prev, mindmap: mapData[0] }));
                  setIsStudentMindMapOpen(true);
              }
          } catch (error) { 
              console.error(error);
              alert("Erro ao criar mapa mental."); 
          } finally { 
              setIsProcessingStudent(false); 
          }
      }
  };

  const handleStudentFlashcards = async () => {
      if (studentContent.flashcards) {
          setIsStudentFlashcardsOpen(true);
      } else {
          setIsProcessingStudent(true);
          try {
              await createUserContent(user!.uid, courseId, topic.id, 'FLASHCARD', topic.name || 'Meus Cards');
              const cardsData = await getUserContent(user!.uid, courseId, topic.id, 'FLASHCARD');
              if (cardsData.length > 0) {
                  setStudentContent((prev: any) => ({ ...prev, flashcards: cardsData[0] }));
                  setIsStudentFlashcardsOpen(true);
              }
          } catch (error) { 
              console.error(error);
              alert("Erro ao criar flashcards."); 
          } finally { 
              setIsProcessingStudent(false); 
          }
      }
  };

  const handleSaveStudentMindMap = async (data: any, isManualSave?: boolean) => {
      if (studentContent.mindmap?.id && user) {
          await updateUserContent(user.uid, courseId, studentContent.mindmap.id, { data });
          setStudentContent((prev: any) => ({ ...prev, mindmap: { ...prev.mindmap, data } }));
      }
  };

  const handleSaveStudentFlashcards = async (data: any) => {
      if (studentContent.flashcards?.id && user) {
          await updateUserContent(user.uid, courseId, studentContent.flashcards.id, { data });
          setStudentContent((prev: any) => ({ ...prev, flashcards: { ...prev.flashcards, data } }));
      }
  };

  const onOpenEditor = (type: 'MAP' | 'FLASHCARD', t: any, forceStudentMode: boolean = false) => {
    // 1. Definição do Modo
    const mode = forceStudentMode ? 'STUDENT' : 'TEACHER';
    
    if (type === 'MAP') {
        setMapMode(mode);
        // Se for professor, verifica se tem conteúdo
        if (mode === 'TEACHER' && !t.contentData?.mindMap?.length && !t.mindMap) {
            alert("O professor não disponibilizou um mapa mental para este tópico.");
            return;
        }
        
        if (mode === 'TEACHER') {
             setIsStudentMindMapOpen(true); // Reutiliza o modal existente
        } else {
             handleStudentMindMap();
        }
    }
    
    if (type === 'FLASHCARD') {
        setFlashcardMode(mode);
        // Se for professor, verifica se tem conteúdo
        if (mode === 'TEACHER' && !t.contentData?.flashcards?.length && !t.flashcards) {
            alert("O professor não disponibilizou flashcards para este tópico.");
            return;
        }

        if (mode === 'TEACHER') {
             setIsStudentFlashcardsOpen(true); // Reutiliza o modal existente
        } else {
             handleStudentFlashcards();
        }
    }
  };

  // --- FUNÇÃO PARA SALVAR A CONFIGURAÇÃO DE REVISÃO ESPAÇADA ---
  const handleSaveReviewConfig = async (intervals: number[], repeatLast: boolean) => {
    if (!user) return;
    try {
        await courseReviewService.scheduleReviews(
            user.uid,
            courseId,
            disciplineId,
            disciplineName, // <-- ENVIANDO O NOME PARA O BANCO DE DADOS
            String(topic.id),
            topic.name,
            intervals,
            repeatLast
        );
        // Atualiza a lista de revisões visualmente imediatamente
        fetchReviews();
        setShowReviewModal(false); 
    } catch (error) {
        console.error("Erro ao agendar revisões:", error);
        alert("Ocorreu um erro ao agendar as revisões.");
    }
  };

  // --- FUNÇÃO PARA CANCELAR TÓPICO E APAGAR REVISÕES ---
  const handleUncheckTopic = async () => {
      if (!user) return;
      
      // 1. Marca visualmente como não concluído (via função pai)
      onToggleTopic(String(topic.id)); 
      
      // 2. Apaga as revisões do banco
      try {
          await courseReviewService.deleteReviewsByTopic(user.uid, String(topic.id));
          setTopicReviews([]); // Limpa visualmente
      } catch (error) {
          console.error("Erro ao apagar revisões:", error);
      }
      
      setShowConfirmModal(false);
  };

  return (
    <>
      <div 
        ref={topicRef}
        className={`bg-[#121418] border rounded-lg overflow-hidden transition-all duration-700
          ${isCompleted ? 'border-green-900/40' : 'border-gray-800'}
          ${isFocused ? 'ring-2 ring-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]' : ''}
        `}
      >
        
        {/* CABEÇALHO DO TÓPICO COM CHECKBOX */}
        <div 
          className={`flex flex-col p-3 transition-colors cursor-pointer select-none group
             ${isFocused ? 'bg-yellow-900/10' : 'hover:bg-[#1a1d24]'}
          `} 
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
                <ChevronRight size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-90' : 'group-hover:text-white'}`} />
                
                {/* BOTÃO DE CHECK (ISOLADO E BLINDADO) */}
                <button 
                    onClick={(e) => { 
                        e.stopPropagation(); // BLOQUEIA A PROPAGAÇÃO PARA NÃO ABRIR O ACORDEÃO
                        setShowConfirmModal(true); 
                    }}
                    className={`flex items-center justify-center rounded-full transition-all ${isCompleted ? 'text-green-500 hover:text-green-400' : 'text-gray-600 hover:text-green-500'}`}
                    title={isCompleted ? "Desmarcar Tópico" : "Marcar como Concluído"}
                >
                    <CheckCircle2 size={18} />
                </button>

                <h4 className={`font-bold text-xs uppercase transition-colors flex items-center gap-1 ${isCompleted ? 'text-gray-400 line-through decoration-green-900/50' : isFocused ? 'text-yellow-500' : 'text-gray-200'}`}>
                    {numberingPrefix && <span className="text-gray-500">{numberingPrefix}</span>}
                    <span title={topic.name}>{topic.name}</span>
                </h4>
            </div>

            {/* BOTÕES INLINE À DIREITA */}
            {!(topic.subtopics && topic.subtopics.length > 0) && (
              <div className="flex items-center gap-2">
                {(topic.contentData?.mindMap?.length > 0 || topic.mindMap || studentContent.mindmap) ? (
                  <button 
                      onClick={(e) => { e.stopPropagation(); onOpenEditor('MAP', topic, !!studentContent.mindmap); }} 
                      disabled={isProcessingStudent}
                      title="Mapa Mental"
                      className="flex items-center justify-center w-8 h-8 rounded bg-[#1a1d24] border border-gray-800 hover:border-purple-500/50 hover:bg-purple-900/20 text-purple-400 transition-colors"
                  >
                      {isProcessingStudent ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
                  </button>
                ) : (
                  <button 
                      onClick={(e) => { e.stopPropagation(); onOpenEditor('MAP', topic, true); }} 
                      disabled={isProcessingStudent}
                      title="Criar Mapa Mental"
                      className="flex items-center justify-center w-8 h-8 rounded bg-[#1a1d24] border border-gray-800 hover:border-purple-500/50 hover:bg-purple-900/10 text-gray-500 hover:text-purple-400 transition-colors"
                  >
                      {isProcessingStudent ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
                  </button>
                )}

                {(topic.contentData?.flashcards?.length > 0 || topic.flashcards || studentContent.flashcards) ? (
                  <button 
                      onClick={(e) => { e.stopPropagation(); onOpenEditor('FLASHCARD', topic, !!studentContent.flashcards); }} 
                      disabled={isProcessingStudent}
                      title="Flashcards"
                      className="flex items-center justify-center w-8 h-8 rounded bg-[#1a1d24] border border-gray-800 hover:border-pink-500/50 hover:bg-pink-900/20 text-pink-400 transition-colors"
                  >
                      {isProcessingStudent ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
                  </button>
                ) : (
                  <button 
                      onClick={(e) => { e.stopPropagation(); onOpenEditor('FLASHCARD', topic, true); }} 
                      disabled={isProcessingStudent}
                      title="Criar Flashcards"
                      className="flex items-center justify-center w-8 h-8 rounded bg-[#1a1d24] border border-gray-800 hover:border-pink-500/50 hover:bg-pink-900/10 text-gray-500 hover:text-pink-400 transition-colors"
                  >
                      {isProcessingStudent ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ÁREA DE REVISÕES VISUAIS (Badge System) */}
          {topicReviews.length > 0 && (
              <div className="flex items-center gap-2 mt-2 ml-10 flex-wrap">
                  {topicReviews.map((rev) => {
                      const isRevDone = rev.status === 'completed';
                      return (
                          <div 
                             key={rev.id}
                             className={`text-[9px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 uppercase tracking-wider transition-colors
                                ${isRevDone 
                                    ? 'bg-green-900/20 text-green-500 border-green-900/40' 
                                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'}
                             `}
                          >
                             {isRevDone ? <CheckCircle2 size={10} /> : <CalendarClock size={10} />}
                             REV {rev.reviewIndex} ({formatShortDate(rev.scheduledDate)})
                          </div>
                      );
                  })}
              </div>
          )}
        </div>

        {isOpen && (
          <div className="p-4 border-t border-gray-800/50 bg-black flex flex-col gap-4">
            
            {topic.observation && (
              <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                  <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider block mb-2">Aviso / Observação</span>
                  <div className="prose prose-invert prose-sm max-w-none text-gray-300" dangerouslySetInnerHTML={{ __html: topic.observation }} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              {/* GRUPO DE AULAS VINCULADAS */}
              {topic.linkedLessons && topic.linkedLessons.length > 0 && (
                 <div className="col-span-1 md:col-span-2 flex flex-col gap-2">
                    <div onClick={() => setIsLessonsOpen(!isLessonsOpen)} className="flex items-center justify-between p-3 bg-[#1a1d24] border border-gray-800 rounded-lg hover:border-gray-700 transition-colors cursor-pointer group select-none">
                        <div className="flex items-center gap-3">
                            <ChevronRight size={16} className={`text-gray-500 transition-transform ${isLessonsOpen ? 'rotate-90' : 'group-hover:text-white'}`} />
                            <div className="w-8 h-8 rounded-full bg-red-900/20 text-red-500 flex items-center justify-center shrink-0"><PlayCircle size={16} /></div>
                            <div>
                                <span className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">Conteúdo em Vídeo</span>
                                <span className="text-xs text-white font-bold block tracking-wider">AULAS</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 bg-black px-3 py-1 rounded-full border border-gray-800">{topic.linkedLessons.length}</span>
                    </div>

                    {isLessonsOpen && (
                        <div className="flex flex-col gap-2 pl-4 border-l-2 border-gray-800/50 ml-4 mt-1 animate-in slide-in-from-top-2 fade-in duration-200">
                            {topic.linkedLessons.map((lesson: any) => {
                                const isLessonCompleted = completedLessons.includes(lesson.id);
                                return (
                                    <button key={lesson.id} onClick={() => handlePlayLesson(lesson.id)} disabled={isLoadingVideo} className={`flex items-center gap-3 p-3 bg-[#16181c] border rounded-lg hover:bg-[#1a1d24] transition-all text-left group ${isLessonCompleted ? 'border-green-900/30 hover:border-green-500/50' : 'border-gray-800/80 hover:border-red-600/50'}`}>
                                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all shrink-0 ${isLessonCompleted ? 'bg-green-900/20 text-green-500 border-green-500/30' : 'bg-black text-gray-500 border-gray-800 group-hover:scale-110 group-hover:border-red-500/30 group-hover:text-red-500 group-hover:bg-red-900/10'}`}>
                                            {isLessonCompleted ? <CheckCircle2 size={14} /> : <PlayCircle size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className={`text-[9px] font-bold uppercase block mb-0.5 transition-colors ${isLessonCompleted ? 'text-green-500' : 'text-gray-600 group-hover:text-red-500/70'}`}>
                                                {isLessonCompleted ? 'Aula Concluída' : 'Assistir Aula'}
                                            </span>
                                            <span className={`text-xs font-bold block truncate transition-colors ${isLessonCompleted ? 'text-gray-400 line-through' : 'text-gray-300 group-hover:text-white'}`}>
                                                {lesson.title}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                 </div>
              )}

              {/* PDFs VINCULADOS - SEPARADOS POR TIPO */}
              {(() => {
                  const theoryPdfs = topic.materialPdfs?.filter((pdf: any) => (pdf.pdfType || 'TEORIA') === 'TEORIA') || [];
                  const questionsPdfs = topic.materialPdfs?.filter((pdf: any) => pdf.pdfType === 'QUESTOES') || [];

                  return (
                    <>
                      {/* MATERIAIS TEÓRICOS */}
                      {theoryPdfs.length > 0 && (
                        <div className="col-span-1 md:col-span-2 space-y-2 mt-2">
                          <h4 className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-2 mb-1">
                            <BookOpen size={12} /> Materiais Teóricos
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {theoryPdfs.map((pdf: any, idx: number) => {
                              const pdfId = pdf.id || `pdf-theory-${idx}`;
                              return (
                                <button 
                                  key={pdfId} 
                                  onClick={() => handleOpenPdf(pdf.url, pdfId)} 
                                  className={`flex items-center gap-3 p-3 bg-[#1a1d24] border border-yellow-500/10 rounded-lg transition-all text-left group ${openingPdfId === pdfId ? 'opacity-70 cursor-not-allowed' : 'hover:border-yellow-500/50 hover:bg-yellow-500/5'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-yellow-900/20 text-yellow-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        {openingPdfId === pdfId ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-500 border-t-transparent"></div> : <FileText size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">{openingPdfId === pdfId ? <span className="text-yellow-400 animate-pulse">Gerando Seguro...</span> : "Material de Teoria"}</span>
                                        <span className="text-xs text-white font-bold block truncate">{pdf.title || `Teoria ${idx + 1}`}</span>
                                    </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* CADERNOS DE QUESTÕES */}
                      {questionsPdfs.length > 0 && (
                        <div className="col-span-1 md:col-span-2 space-y-2 mt-2">
                          <h4 className="text-[10px] font-bold text-orange-500 uppercase tracking-wider flex items-center gap-2 mb-1">
                            <FileQuestion size={12} /> Cadernos de Questões
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {questionsPdfs.map((pdf: any, idx: number) => {
                              const pdfId = pdf.id || `pdf-quest-${idx}`;
                              return (
                                <button 
                                  key={pdfId} 
                                  onClick={() => handleOpenPdf(pdf.url, pdfId)} 
                                  className={`flex items-center gap-3 p-3 bg-[#1a1d24] border border-orange-500/10 rounded-lg transition-all text-left group ${openingPdfId === pdfId ? 'opacity-70 cursor-not-allowed' : 'hover:border-orange-500/50 hover:bg-orange-500/5'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-orange-900/20 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        {openingPdfId === pdfId ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent"></div> : <FileQuestion size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">{openingPdfId === pdfId ? <span className="text-orange-400 animate-pulse">Gerando Seguro...</span> : "Caderno de Questões"}</span>
                                        <span className="text-xs text-white font-bold block truncate">{pdf.title || `Questões ${idx + 1}`}</span>
                                    </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
              })()}
            </div>

            {/* SUBTÓPICOS RECURSIVOS (A CHAVE DA SOLUÇÃO) */}
            {topic.subtopics && topic.subtopics.length > 0 && (
              <div className="mt-4 space-y-2 border-l border-gray-800 pl-3">
                  {topic.subtopics.map((sub: any, idx: number) => (
                    <StudentTopicAccordion 
                       key={sub.id} 
                       topic={sub} 
                       courseId={courseId}
                       disciplineId={disciplineId}
                       disciplineName={disciplineName} // <-- REPASSANDO PARA OS SUBTÓPICOS
                       completedLessons={completedLessons}
                       completedTopics={completedTopics} 
                       onToggleTopic={onToggleTopic}
                       focusTopicId={focusTopicId}
                       planId={planId}
                       numberingPrefix={`${numberingPrefix ? numberingPrefix.replace('.', '') : ''}.${idx + 1}.`}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* OVERLAYS E PORTAIS */}
      {activeLesson && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in">
            <div className="h-14 border-b border-gray-800 flex items-center justify-end px-4 shrink-0 bg-[#0f1114]">
                <button onClick={() => setActiveLesson(null)} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 flex items-center gap-2 text-xs font-bold uppercase transition-colors">
                    Fechar <X size={20} />
                </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
                    <iframe src={activeLesson.videoUrl} className="w-full h-full" frameBorder="0" allowFullScreen />
                </div>
            </div>
        </div>, document.body
      )}

      {isStudentMindMapOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#0f1114]">
            <MindMapFullscreen 
                nodes={mapMode === 'TEACHER' 
                    ? (topic.contentData?.mindMap || topic.mindMap || []) 
                    : (studentContent.mindmap?.data && studentContent.mindmap?.data.length > 0
                        ? studentContent.mindmap.data 
                        : [{ 
                            id: 'root', 
                            type: 'root', 
                            x: 0, 
                            y: 0, 
                            label: topic.name || 'Meu Mapa', 
                            color: '#a855f7' 
                          }]
                      )
                } 
                onChange={mapMode === 'TEACHER' ? () => {} : handleSaveStudentMindMap} 
                onClose={() => setIsStudentMindMapOpen(false)} 
                readOnly={mapMode === 'TEACHER'}
            />
        </div>, document.body
      )}

      {/* ==================================================== */}
      {/* MODAL DE FLASHCARDS (MODO PROFESSOR - PLAYER NATIVO) */}
      {/* ==================================================== */}
      {isStudentFlashcardsOpen && flashcardMode === 'TEACHER' && (
          <FlashcardPlayerModal 
              isOpen={true} // Mandatory for the portal inside the component to mount
              title={`Cards do Professor: ${topic.name}`}
              flashcards={topic.contentData?.flashcards || topic.flashcards || []}
              onClose={() => setIsStudentFlashcardsOpen(false)}
              timerState={{ status: 'idle', formattedTime: '00:00' }} // Required prop
              accentColor="#ec4899" // Added for consistency
          />
      )}

      {/* ==================================================== */}
      {/* MODAL DE FLASHCARDS (MODO ALUNO - EDITOR COMPLETO)   */}
      {/* ==================================================== */}
      {isStudentFlashcardsOpen && flashcardMode === 'STUDENT' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-[#0f1114]">
            <FlashcardFullscreenEditor 
                cards={studentContent.flashcards?.data || []} // Mapped from user's "initialData" intent to actual prop
                onChange={handleSaveStudentFlashcards} 
                onClose={() => setIsStudentFlashcardsOpen(false)} 
                manualOnly={true}
                accentColor="#ec4899" // Added for consistency
            />
        </div>, document.body
      )}

      {/* MODAL DE CONFIRMAÇÃO DE CONCLUSÃO/DESMARCAÇÃO DO TÓPICO */}
      {showConfirmModal && createPortal(
        <ConfirmationModal 
            isOpen={showConfirmModal}
            onClose={() => setShowConfirmModal(false)}
            onConfirm={() => {
                // Se já estiver completo, chama função de desmarcar que limpa as revisões
                if (isCompleted) {
                    handleUncheckTopic();
                } else {
                    // Se não estiver, marca como completo
                    onToggleTopic(String(topic.id));
                    setShowConfirmModal(false);

                    // INJEÇÃO DE LOGS DE RASTREAMENTO (OBRIGATÓRIO)
                    console.log('🔍 [DEBUG REVISÃO]: Disparando modal via Edital (Tópico Inteiro)', {
                        topicName: topic.name,
                        topicId: topic.id,
                        disciplineName
                    });

                    // E abre o modal de agendar revisão via Contexto Global
                    openSpacedReviewModal({
                        planId: planId || '', // Passa o planId se disponível (opcional para curso)
                        courseId: courseId,   // CRÍTICO para curso
                        disciplineId: disciplineId || '',
                        disciplineName: disciplineName || '',
                        topicId: String(topic.id),
                        topicName: topic.name,
                        contextType: 'course_topic' // Define que é contexto de curso
                    });
                }
            }}
            title={isCompleted ? "Desmarcar Tópico?" : "Concluir Tópico?"}
            message={isCompleted 
                ? "Deseja desmarcar este tópico? Isso apagará todas as revisões agendadas para ele e reiniciará o ciclo." 
                : "Tem certeza que deseja marcar este tópico como concluído em seu edital?"}
            confirmText={isCompleted ? "Sim, Desmarcar" : "Concluir"}
            cancelText="Cancelar"
            variant={isCompleted ? 'danger' : 'primary'}
        />,
        document.body
      )}

      {/* MODAL DE CONFIGURAÇÃO DE REVISÃO REMOVIDO - USANDO GLOBAL AGORA */}
    </>
  );
}

// ==========================================
// 1.2 ACORDEÃO DE PASTA (FOLDERS)
// ==========================================
function StudentFolderAccordion({ group, topics, courseId, planId, disciplineId, disciplineName, completedLessons, completedTopics, onToggleTopic, focusTopicId, startNumber }: any) {
    const hasFocusedTopic = useMemo(() => {
        if (!focusTopicId) return false;
        const check = (items: any[]): boolean => {
            for (const t of items) {
                if (String(t.id) === String(focusTopicId)) return true;
                if (t.subtopics && check(t.subtopics)) return true;
            }
            return false;
        };
        return check(topics);
    }, [topics, focusTopicId]);

    const [isOpen, setIsOpen] = useState(hasFocusedTopic);
    
    useEffect(() => {
        if (hasFocusedTopic) setIsOpen(true);
    }, [hasFocusedTopic]);

    const completedInGroup = topics.filter((t: any) => completedTopics.includes(String(t.id))).length;

    return (
        <div className="border border-red-600/10 rounded-xl bg-zinc-950/30 overflow-hidden mb-3">
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-900/50 transition-colors group/folder"
            >
                <div className="flex items-center gap-3">
                    <ChevronRight size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : 'group-hover:text-white'}`} />
                    <FolderKanban size={16} className="text-red-500" />
                    <div>
                        <h4 className="text-white font-black text-[10px] uppercase tracking-tight" title={group.name}>{group.name}</h4>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{topics.length} tópicos • {completedInGroup} concluídos</span>
                    </div>
                </div>
            </div>

            {isOpen && (
                <div className="p-3 pt-0 space-y-2 animate-in slide-in-from-top-1 duration-200">
                    {topics.map((topic: any, index: number) => (
                        <StudentTopicAccordion 
                            key={topic.id} 
                            topic={topic} 
                            courseId={courseId}
                            planId={planId}
                            disciplineId={disciplineId} 
                            disciplineName={disciplineName}
                            completedLessons={completedLessons}
                            completedTopics={completedTopics}
                            onToggleTopic={onToggleTopic}
                            focusTopicId={focusTopicId}
                            numberingPrefix={`${startNumber + index}.`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ==========================================
// 2. DISCIPLINAS (WRAPPER)
// ==========================================
function StudentDisciplineAccordion({ discipline, courseId, planId, completedLessons, completedTopics, onToggleTopic, focusTopicId }: any) {
    // NOVA LÓGICA: Verifica se o tópico focado está escondido dentro desta disciplina
    const hasFocusedTopic = useMemo(() => {
      if (!focusTopicId) return false;
      const check = (topics: any[]): boolean => {
          if (!topics) return false;
          for (const t of topics) {
              if (String(t.id) === String(focusTopicId)) return true;
              if (t.subtopics && check(t.subtopics)) return true;
          }
          return false;
      };
      return check(discipline.topics);
    }, [discipline, focusTopicId]);

    // Se tiver, o estado inicial de isOpen será true
    const [isOpen, setIsOpen] = useState(hasFocusedTopic);
    
    // Monitora mudanças para abrir automaticamente
    useEffect(() => {
        if (hasFocusedTopic) setIsOpen(true);
    }, [hasFocusedTopic]);
  
    // --- CÁLCULO RECURSIVO DA BARRA DE PROGRESSO DA DISCIPLINA ---
    const countDisciplineTopics = (topics: any[]): number => {
        let count = 0;
        topics.forEach(t => {
            count++;
            if (t.subtopics) count += countDisciplineTopics(t.subtopics);
        });
        return count;
    };
  
    const countDisciplineCompleted = (topics: any[]): number => {
        let count = 0;
        topics.forEach(t => {
            if (completedTopics.includes(String(t.id))) count++;
            if (t.subtopics) count += countDisciplineCompleted(t.subtopics);
        });
        return count;
    };
  
    const discTotal = countDisciplineTopics(discipline.topics || []);
    const discCompleted = countDisciplineCompleted(discipline.topics || []);
    const discProgress = discTotal > 0 ? Math.round((discCompleted / discTotal) * 100) : 0;
  
    return (
      <div className={`border rounded-xl bg-[#1a1d24] overflow-hidden transition-all ${discProgress === 100 ? 'border-green-900/50' : 'border-gray-800'}`}>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-[#202329] transition-colors cursor-pointer select-none group gap-4"
        >
          <div className="flex items-center gap-3">
            <ChevronRight size={18} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-90' : 'group-hover:text-white'}`} />
            <BookOpen size={20} className={discProgress === 100 ? 'text-green-500' : 'text-red-500'} />
            <h3 className="text-white font-black text-sm uppercase" title={discipline.name}>{discipline.name}</h3>
          </div>
          
          <div className="flex items-center gap-4 ml-7 sm:ml-0">
              <div className="flex flex-col items-end hidden sm:flex w-32">
                  <span className="text-[9px] font-bold text-gray-500 uppercase">{discProgress}% Concluído</span>
                  <div className="w-full bg-black rounded-full h-1.5 overflow-hidden mt-1">
                      <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${discProgress}%` }}></div>
                  </div>
              </div>
              <span className="text-[10px] font-bold text-gray-500 bg-black/50 px-3 py-1 rounded-full border border-gray-800">
                {discTotal} Tópicos
              </span>
          </div>
        </div>
  
        {/* Progress Bar Mobile */}
        <div className="sm:hidden w-full bg-black h-1">
           <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${discProgress}%` }}></div>
        </div>
  
        {isOpen && discipline.topics && (
          <div className="p-4 pt-0 border-t border-gray-800/50 bg-black/20">
            <div className="pl-4 border-l-2 border-gray-800 mt-4 space-y-3">
              {/* TÓPICOS AGRUPADOS EM PASTAS */}
              {(discipline.topicGroups || []).map((group: any) => {
                const groupTopics = discipline.topics.filter((t: any) => t.groupId === group.id);
                if (groupTopics.length === 0) return null;
                
                // Precisamos calcular o índice inicial baseado nos tópicos anteriores que NÃO estão em pastas
                // Mas simplificando, podemos apenas usar o índice do tópico no array original ou omitir se preferir.
                // Aqui vou apenas passar um numbering prefix simples ou omitir.
                return (
                  <StudentFolderAccordion 
                    key={group.id}
                    group={group}
                    topics={groupTopics}
                    courseId={courseId}
                    planId={planId}
                    disciplineId={discipline.id}
                    disciplineName={discipline.name}
                    completedLessons={completedLessons}
                    completedTopics={completedTopics}
                    onToggleTopic={onToggleTopic}
                    focusTopicId={focusTopicId}
                    startNumber={1}
                  />
                );
              })}

              {/* TÓPICOS SEM PASTA */}
              {(() => {
                const unassigned = discipline.topics.filter((t: any) => !t.groupId);
                const hasGroups = (discipline.topicGroups || []).length > 0;
                
                if (unassigned.length > 0) {
                  return (
                    <div className={hasGroups ? "mt-4 pt-4 border-t border-gray-800/50" : ""}>
                      {hasGroups && (
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest block mb-3 pl-2">Outros Tópicos</span>
                      )}
                      <div className="space-y-3">
                        {unassigned.map((topic: any, index: number) => (
                          <StudentTopicAccordion 
                            key={topic.id} 
                            topic={topic} 
                            courseId={courseId}
                            planId={planId}
                            disciplineId={discipline.id} 
                            disciplineName={discipline.name}
                            completedLessons={completedLessons}
                            completedTopics={completedTopics}
                            onToggleTopic={onToggleTopic}
                            focusTopicId={focusTopicId}
                            numberingPrefix={`${index + 1}.`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        )}
      </div>
    );
  }

// ==========================================
// 3. COMPONENTE PRINCIPAL (MANAGER)
// ==========================================
export function StudentCourseEdital({ courseId, planId, focusTopicId }: { courseId: string, planId?: string, focusTopicId?: string | null }) {
    const { currentUser: user } = useAuth();
    const [structure, setStructure] = useState<CourseEditalStructure | null>(null);
    const [loading, setLoading] = useState(true);
    const [completedTopics, setCompletedTopics] = useState<string[]>([]);
    
    // Novas vars
    const [completedLessons, setCompletedLessons] = useState<string[]>([]);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const [editalData, topicsDone, lessonsDone] = await Promise.all([
                    courseService.getCourseEdital(courseId),
                    courseService.getCompletedTopics(user.uid, courseId),
                    courseService.getCompletedLessons(user.uid, courseId)
                ]);
                setStructure(editalData);
                // Garante que todos os IDs de tópicos sejam strings
                setCompletedTopics((topicsDone || []).map(String));
                setCompletedLessons(lessonsDone || []);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [courseId, user]);

    // Função Blindada para Marcar/Desmarcar o Tópico (Optimistic UI)
    const handleToggleTopic = (topicId: string | number) => {
        if (!user) return;
        const safeId = String(topicId);
  
        // setCompletedTopics com 'prev' garante que NUNCA usaremos dados obsoletos
        setCompletedTopics(prev => {
            const isAlreadyCompleted = prev.includes(safeId);
            const newStatus = !isAlreadyCompleted;
  
            // 1. Dispara o salvamento pro banco em segundo plano (não trava a tela)
            courseService.toggleTopicCompletion(user.uid, courseId, safeId, newStatus)
                .catch(err => console.error("Erro ao salvar progresso no banco:", err));
  
            // 2. Atualiza a interface instantaneamente (o Check fica verde na mesma hora)
            if (newStatus) {
                return [...prev, safeId];
            } else {
                return prev.filter(id => String(id) !== safeId);
            }
        });
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-red-500" /></div>;

    if (!structure || !structure.disciplines || structure.disciplines.length === 0) {
        return (
            <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl">
                <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 uppercase font-bold text-sm">Edital não disponível.</p>
                <p className="text-gray-600 text-xs mt-1">O professor ainda não publicou o edital verticalizado.</p>
            </div>
        );
    }
    
    // --- CÁLCULO DA BARRA DE PROGRESSO GERAL ---
    const countTotalTopics = (items: any[]): number => {
        let count = 0;
        items.forEach(item => {
            count++; 
            if (item.subtopics && item.subtopics.length > 0) {
                count += countTotalTopics(item.subtopics); 
            }
        });
        return count;
    };
  
    const totalTopics = structure.disciplines.reduce((acc: number, disc: any) => acc + countTotalTopics(disc.topics || []), 0);
    const overallProgress = totalTopics > 0 ? Math.round((completedTopics.length / totalTopics) * 100) : 0;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in">
            {/* Header / Resumo */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-800 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Edital Verticalizado</h2>
                    <p className="text-gray-500 text-sm font-medium mt-1">Acompanhe seu progresso tópico por tópico.</p>
                </div>
                
                {/* BARRA DE PROGRESSO GERAL */}
                <div className="bg-[#1a1d24] border border-gray-800 rounded-xl p-3 flex flex-col gap-1 w-full md:w-64">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Progresso Geral</span>
                        <span className="text-sm font-black text-white">{overallProgress}%</span>
                    </div>
                    <div className="w-full bg-black rounded-full h-2 overflow-hidden border border-gray-800">
                        <div className="bg-green-500 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${overallProgress}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Lista de Disciplinas */}
            <div className="space-y-4">
                {structure.disciplines.map(discipline => (
                    <StudentDisciplineAccordion 
                        key={discipline.id} 
                        discipline={discipline} 
                        courseId={courseId}
                        planId={planId}
                        completedLessons={completedLessons}
                        completedTopics={completedTopics} 
                        onToggleTopic={handleToggleTopic}
                        focusTopicId={focusTopicId} // PASSANDO O ID DE FOCO PARA BAIXO
                    />
                ))}
            </div>
        </div>
    );
}
