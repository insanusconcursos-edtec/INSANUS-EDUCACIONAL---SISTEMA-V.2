import React, { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, Layers, ChevronRight, ChevronDown, FileCheck, AlertCircle, PlayCircle, BarChart2, ArrowLeft, Trophy,
  Search, Filter, Building2, ListChecks, Check, X, Minus, Medal, User, Lock, Brain
} from 'lucide-react';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getExams, 
  SimulatedClass, 
  SimulatedExam 
} from '../../services/simulatedService';
import { 
  checkExistingAttempt, 
  SimulatedAttempt 
} from '../../services/simulatedAttemptService';
import { Student } from '../../services/userService';
import SimulatedExamRunner from '../../components/student/simulated/SimulatedExamRunner';
import Loading from '../../components/ui/Loading';
import { StudentSimulatedList } from '../../components/student/simulados/StudentSimulatedList';
import { StudentAutoDiagnosis } from '../../components/student/simulados/StudentAutoDiagnosis';
import { StudentPerformanceDashboard } from '../../components/student/simulados/StudentPerformanceDashboard';
import { ExamResult } from '../../components/student/simulados/ExamResult';

import { useNavigate, useSearchParams } from 'react-router-dom';

// --- COMPONENTE DE RESULTADO (Acessado via componente externo em /components/student/simulados/ExamResult) ---

const StudentSimulated: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Navigation State
  const [viewState, setViewState] = useState<'CLASSES' | 'EXAMS' | 'RESULT'>('CLASSES');
  const [selectedClass, setSelectedClass] = useState<SimulatedClass | null>(null);
  const [selectedExam, setSelectedExam] = useState<SimulatedExam | null>(null);
  const [lastAttempt, setLastAttempt] = useState<SimulatedAttempt | null>(null);

  // Data State (Exams Only - Classes now handled by subcomponent)
  const [exams, setExams] = useState<SimulatedExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [examAttempts, setExamAttempts] = useState<Record<string, SimulatedAttempt>>({}); // Cache de tentativas
  
  // New: Class Attempts for Dashboard
  const [classAttempts, setClassAttempts] = useState<SimulatedAttempt[]>([]);
  const [classViewMode, setClassViewMode] = useState<'LIST' | 'DASHBOARD'>('LIST');

  // Runner State
  const [isRunningExam, setIsRunningExam] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [examToConfirm, setExamToConfirm] = useState<SimulatedExam | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const classId = searchParams.get('classId');
    const examId = searchParams.get('examId');
    const start = searchParams.get('start');
    const view = searchParams.get('view');

    if (currentUser && classId && examId) {
        handleAutoOpen(classId, examId, start === 'true', view === 'result');
    }
  }, [currentUser, searchParams]);

  const handleAutoOpen = async (classId: string, examId: string, shouldStart: boolean, shouldViewResult: boolean) => {
      setLoadingAuto(true);
      try {
          // 1. Load Class
          const classSnap = await getDoc(doc(db, 'simulatedClasses', classId));
          if (!classSnap.exists()) return;
          const cls = { id: classSnap.id, ...classSnap.data() } as SimulatedClass;
          
          setSelectedClass(cls);
          setViewState('EXAMS');

          // 2. Load Exams for this class
          const examsData = await getExams(classId);
          setExams(examsData);
          
          const targetExam = examsData.find(e => e.id === examId);
          if (targetExam) {
              setSelectedExam(targetExam);
              
              if (shouldViewResult) {
                  // Fetch the latest attempt
                  const q = query(
                      collection(db, 'simulated_attempts'),
                      where('userId', '==', currentUser.uid),
                      where('simulatedId', '==', examId),
                      orderBy('completedAt', 'desc'),
                      limit(1)
                  );
                  const snap = await getDocs(q);
                  if (!snap.empty) {
                      setLastAttempt({ id: snap.docs[0].id, ...snap.docs[0].data() } as SimulatedAttempt);
                      setViewState('RESULT');
                  }
              } else if (shouldStart) {
                  setIsRunningExam(true);
              }
          }
      } catch (error) {
          console.error("Error in auto-open:", error);
      } finally {
          setLoadingAuto(false);
      }
  };

  const handleSelectClass = (cls: SimulatedClass) => {
    loadExams(cls);
  };

  const loadExams = async (cls: SimulatedClass) => {
    setLoadingExams(true);
    setSelectedClass(cls);
    setViewState('EXAMS');
    setClassViewMode('LIST'); // Reset view mode when opening a class
    try {
        const data = await getExams(cls.id!);
        // Ordenar: Published primeiro
        const sorted = data.sort((a,b) => (a.status === 'published' ? -1 : 1));
        setExams(sorted);

        // Fetch All Attempts for this Class
        if (currentUser) {
            const q = query(
                collection(db, 'simulated_attempts'),
                where('userId', '==', currentUser.uid),
                where('classId', '==', cls.id)
            );
            const snapshot = await getDocs(q);
            const attempts = snapshot.docs.map(d => ({id: d.id, ...d.data()} as SimulatedAttempt));
            
            setClassAttempts(attempts);

            // Populate Map for List View (latest attempt per exam logic if needed, here just existence)
            const attemptsMap: Record<string, SimulatedAttempt> = {};
            attempts.forEach(att => {
                attemptsMap[att.simulatedId] = att; 
            });
            setExamAttempts(attemptsMap);
        }

    } catch (error) {
        console.error(error);
    } finally {
        setLoadingExams(false);
    }
  };

  // --- HANDLERS ---

  const handleStartExam = (exam: SimulatedExam) => {
    setExamToConfirm(exam);
  };

  const handleConfirmStart = () => {
    if (examToConfirm) {
      setSelectedExam(examToConfirm);
      setIsRunningExam(true);
      setExamToConfirm(null);
    }
  };

  const handleViewResult = (exam: SimulatedExam, attempt: SimulatedAttempt) => {
    setSelectedExam(exam);
    setLastAttempt(attempt);
    setViewState('RESULT');
  };

  const handleExamComplete = (result: SimulatedAttempt) => {
    setIsRunningExam(false);
    setLastAttempt(result);
    setViewState('RESULT');
    // Atualiza cache local
    if (selectedExam?.id) {
        setExamAttempts(prev => ({ ...prev, [selectedExam.id!]: result }));
        // Also update class attempts list to reflect new data in dashboard
        setClassAttempts(prev => [...prev, result]);
    }
  };

  const handleBackToClasses = () => {
    setViewState('CLASSES');
    setSelectedClass(null);
    setExams([]);
    setClassAttempts([]);
  };

  const handleBackToExams = () => {
    setViewState('EXAMS');
    setSelectedExam(null);
    setLastAttempt(null);
  };

  if (loadingAuto) {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-zinc-900 border-t-yellow-400 rounded-full animate-spin shadow-[0_0_20px_rgba(250,204,21,0.3)]" />
                <div className="absolute inset-0 bg-yellow-400/10 blur-xl animate-pulse rounded-full" />
            </div>
            <div className="space-y-2 text-center">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Preparando Ambiente</h3>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">Sincronizando dados oficiais...</p>
            </div>
        </div>
    );
  }

  if (loadingExams) return <Loading />;

  // === RENDER: EXAM RUNNER (OVERLAY) ===
  if (isRunningExam && selectedExam) {
      return (
          <SimulatedExamRunner 
              exam={selectedExam}
              onClose={() => setIsRunningExam(false)}
              onComplete={handleExamComplete}
              classId={selectedClass?.id}
          />
      );
  }

  // === RENDER: RESULT & RANKING (NEW EXAMRESULT COMPONENT) ===
  if (viewState === 'RESULT' && selectedExam && lastAttempt) {
      return (
          <ExamResult 
              exam={selectedExam}
              attemptData={lastAttempt}
              onBack={handleBackToExams}
          />
      );
  }

  // === RENDER: EXAMS LIST ===
  if (viewState === 'EXAMS' && selectedClass) {
      // Filtrar apenas simulados PUBLICADOS para o aluno
      const visibleExams = exams.filter(e => e.status === 'published');

      return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              
              {/* --- CABEÇALHO DA TURMA COM ABAS --- */}
              <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-4">
                      <button onClick={handleBackToClasses} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:text-white text-zinc-400 transition-colors">
                          <ArrowLeft size={20} />
                      </button>
                      <div>
                          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedClass.title}</h2>
                          <div className="flex items-center gap-3 mt-1">
                              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{selectedClass.organization}</p>
                              {selectedClass.presentationVideoUrl && (
                                  <button 
                                      onClick={() => setIsVideoModalOpen(true)}
                                      className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-700"
                                  >
                                      <PlayCircle size={12} className="text-brand-red" />
                                      Vídeo de Apresentação
                                  </button>
                              )}
                          </div>
                      </div>
                  </div>
                  
                  {/* SELETOR DE VISUALIZAÇÃO */}
                  <div className="flex gap-6 mt-4 md:mt-0">
                      <button 
                          onClick={() => setClassViewMode('LIST')}
                          className={`pb-2 text-xs font-bold uppercase transition-all tracking-widest ${classViewMode === 'LIST' ? 'text-brand-red border-b-2 border-brand-red' : 'text-zinc-500 hover:text-white'}`}
                      >
                          Simulados Disponíveis
                      </button>
                      <button 
                          onClick={() => setClassViewMode('DASHBOARD')}
                          className={`pb-2 text-xs font-bold uppercase transition-all tracking-widest flex items-center gap-2 ${classViewMode === 'DASHBOARD' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-zinc-500 hover:text-white'}`}
                      >
                          <BarChart2 size={14} />
                          Evolução & Performance
                      </button>
                  </div>
              </div>

              {classViewMode === 'LIST' ? (
                  <>
                      {visibleExams.length === 0 ? (
                          <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl">
                              <p className="text-zinc-500 font-bold uppercase text-xs">Nenhum simulado disponível nesta turma.</p>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 gap-4">
                              {visibleExams.map(exam => {
                                  const attempt = examAttempts[exam.id!];
                                  const isDone = !!attempt;
                                  
                                  // Lógica de Agendamento (Data de Publicação)
                                  const now = new Date();
                                  const publishDate = exam.publishDate ? new Date(exam.publishDate) : null;
                                  const isBlocked = publishDate && publishDate > now;
                                  
                                  return (
                                      <div key={exam.id} className={`bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-zinc-700 transition-all ${isBlocked ? 'opacity-75' : ''}`}>
                                          <div className="flex items-center gap-4">
                                              <div className={`p-3 rounded-xl ${isDone ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : isBlocked ? 'bg-zinc-800 text-zinc-600 border border-zinc-700' : 'bg-zinc-800 text-zinc-400'}`}>
                                                  {isDone ? <Trophy size={24} /> : isBlocked ? <Lock size={24} /> : <FileCheck size={24} />}
                                              </div>
                                              <div>
                                                  <div className="flex items-center gap-2">
                                                    <h3 className={`text-lg font-black uppercase tracking-tight ${isBlocked ? 'text-zinc-500' : 'text-white'}`}>{exam.title}</h3>
                                                    {isBlocked && (
                                                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[9px] font-bold uppercase border border-zinc-700 flex items-center gap-1">
                                                            <Lock size={10} /> BLOQUEADO
                                                        </span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500 uppercase mt-1">
                                                      <span className="flex items-center gap-1"><Layers size={12} /> {exam.questionCount} Questões</span>
                                                      {exam.hasPenalty && <span className="flex items-center gap-1 text-red-500"><AlertCircle size={12} /> Penalidade Ativa</span>}
                                                      {isBlocked && publishDate && (
                                                          <span className="flex items-center gap-1 text-purple-400">
                                                               Liberação em: {publishDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                          </span>
                                                      )}
                                                  </div>
                                              </div>
                                          </div>

                                          <div className="flex items-center gap-3">
                                              {isDone ? (
                                                  <button 
                                                      onClick={() => handleViewResult(exam, attempt)}
                                                      className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                                  >
                                                      <BarChart2 size={14} /> Ver Resultado
                                                  </button>
                                              ) : isBlocked ? (
                                                  <button 
                                                      disabled
                                                      className="px-6 py-3 bg-zinc-800 text-zinc-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-not-allowed border border-zinc-700"
                                                  >
                                                      <Lock size={14} /> Bloqueado
                                                  </button>
                                              ) : (
                                                  <button 
                                                      onClick={() => handleStartExam(exam)}
                                                      className="px-6 py-3 bg-brand-red hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-red-900/20"
                                                  >
                                                      <PlayCircle size={14} /> Iniciar Prova
                                                  </button>
                                              )}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </>
              ) : (
                  <StudentPerformanceDashboard attempts={classAttempts} exams={exams} />
              )}

              {/* MODAL DE VÍDEO DE APRESENTAÇÃO */}
              {isVideoModalOpen && selectedClass.presentationVideoUrl && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsVideoModalOpen(false)}></div>
                      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                          <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
                              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                  <PlayCircle size={16} className="text-brand-red" />
                                  Vídeo de Apresentação
                              </h3>
                              <button onClick={() => setIsVideoModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                                  <X size={20} />
                              </button>
                          </div>
                          <div className="aspect-video w-full bg-black">
                              <iframe 
                                  src={selectedClass.presentationVideoUrl}
                                  className="w-full h-full"
                                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" 
                                  allowFullScreen
                              />
                          </div>
                      </div>
                  </div>
              )}

              {/* MODAL DE CONFIRMAÇÃO DE INÍCIO */}
              {examToConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#1a1d24] p-8 rounded-2xl w-full max-w-lg border border-red-600/30 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mb-6 text-red-500 border border-red-500/20">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-white font-black text-2xl uppercase mb-2">Atenção!</h3>
                            <p className="text-gray-300 text-sm leading-relaxed mb-6">
                                Você está prestes a iniciar o simulado <strong>{examToConfirm.title}</strong>.
                                <br/><br/>
                                <span className="text-red-400 font-bold block bg-red-900/10 p-2 rounded">
                                    O cronômetro iniciará imediatamente e NÃO poderá ser pausado.
                                </span>
                            </p>
                            
                            <div className="flex flex-col w-full gap-3">
                                <button 
                                    onClick={handleConfirmStart}
                                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl uppercase tracking-wider transition-all shadow-lg"
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


          </div>
      );
  }

  // === RENDER: CLASSES LIST (NEW COMPONENT) ===
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Meus Simulados</h1>
        <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest mt-1">
          Treine com provas reais e acompanhe sua evolução.
        </p>
      </div>

      <StudentSimulatedList onSelectClass={handleSelectClass} />
    </div>
  );
};

export default StudentSimulated;