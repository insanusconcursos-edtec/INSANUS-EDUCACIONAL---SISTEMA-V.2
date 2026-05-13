
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, PlayCircle, BarChart2, Trophy, FileCheck, Lock, AlertCircle, Layers, X
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  getExams, 
  getSimulatedClassById,
  SimulatedClass, 
  SimulatedExam 
} from '../../../services/simulatedService';
import { SimulatedAttempt } from '../../../services/simulatedAttemptService';
import SimulatedExamRunner from '../simulated/SimulatedExamRunner';
import Loading from '../../ui/Loading';
import { ExamResult } from './ExamResult';
import { StudentPerformanceDashboard } from './StudentPerformanceDashboard';

interface LinkedSimulatedViewProps {
  simulatedId: string;
}

export const LinkedSimulatedView: React.FC<LinkedSimulatedViewProps> = ({ simulatedId }) => {
  const { currentUser } = useAuth();
  
  // Navigation State
  const [viewState, setViewState] = useState<'EXAMS' | 'RESULT'>('EXAMS');
  const [selectedClass, setSelectedClass] = useState<SimulatedClass | null>(null);
  const [selectedExam, setSelectedExam] = useState<SimulatedExam | null>(null);
  const [lastAttempt, setLastAttempt] = useState<SimulatedAttempt | null>(null);

  // Data State
  const [exams, setExams] = useState<SimulatedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [examAttempts, setExamAttempts] = useState<Record<string, SimulatedAttempt>>({});
  const [classAttempts, setClassAttempts] = useState<SimulatedAttempt[]>([]);
  const [classViewMode, setClassViewMode] = useState<'LIST' | 'DASHBOARD'>('LIST');

  // Runner State
  const [isRunningExam, setIsRunningExam] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [examToConfirm, setExamToConfirm] = useState<SimulatedExam | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!simulatedId) return;
      setLoading(true);
      try {
        const cls = await getSimulatedClassById(simulatedId);
        if (!cls) {
          setLoading(false);
          return;
        }
        setSelectedClass(cls);

        const examsData = await getExams(simulatedId);
        const sorted = examsData.sort((a, b) => (a.status === 'published' ? -1 : 1));
        setExams(sorted);

        if (currentUser) {
          const q = query(
            collection(db, 'simulated_attempts'),
            where('userId', '==', currentUser.uid),
            where('classId', '==', simulatedId)
          );
          const snapshot = await getDocs(q);
          const attempts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SimulatedAttempt));
          
          setClassAttempts(attempts);
          const attemptsMap: Record<string, SimulatedAttempt> = {};
          attempts.forEach(att => {
            attemptsMap[att.simulatedId] = att; 
          });
          setExamAttempts(attemptsMap);
        }
      } catch (error) {
        console.error("Error loading linked simulated data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [simulatedId, currentUser]);

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
    if (selectedExam?.id) {
      setExamAttempts(prev => ({ ...prev, [selectedExam.id!]: result }));
      setClassAttempts(prev => [...prev, result]);
    }
  };

  const handleBackToExams = () => {
    setViewState('EXAMS');
    setSelectedExam(null);
    setLastAttempt(null);
  };

  if (loading) return <Loading />;
  if (!selectedClass) return (
    <div className="p-8 text-center text-zinc-500 uppercase font-bold text-xs border-2 border-dashed border-zinc-800 rounded-2xl">
      Turma de simulados não encontrada ou indisponível.
    </div>
  );

  if (isRunningExam && selectedExam) {
    return (
      <SimulatedExamRunner 
        exam={selectedExam}
        onClose={() => setIsRunningExam(false)}
        onComplete={handleExamComplete}
        classId={selectedClass.id}
      />
    );
  }

  if (viewState === 'RESULT' && selectedExam && lastAttempt) {
    return (
      <ExamResult 
        exam={selectedExam}
        attemptData={lastAttempt}
        onBack={handleBackToExams}
      />
    );
  }

  const visibleExams = exams.filter(e => e.status === 'published');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER DA TURMA VINCULADA */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-gray-800 pb-2">
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
        <StudentPerformanceDashboard attempts={classAttempts} />
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="bg-brand-red/10 p-4 rounded-full mb-6 border border-brand-red/20">
                <PlayCircle className="w-10 h-10 text-brand-red" />
              </div>
              <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Iniciar Simulado?</h3>
              <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
                Você está prestes a iniciar o simulado <strong>{examToConfirm.title}</strong>. 
                Certifique-se de estar em um ambiente calmo e com boa conexão.
              </p>
              
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setExamToConfirm(null)}
                  className="flex-1 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmStart}
                  className="flex-1 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-lg bg-brand-red hover:bg-red-600 text-white shadow-red-900/20"
                >
                  Sim, Iniciar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
