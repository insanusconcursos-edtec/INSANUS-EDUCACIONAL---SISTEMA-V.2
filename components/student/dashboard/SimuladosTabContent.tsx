import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Layers, 
  FileCheck, 
  AlertCircle, 
  PlayCircle, 
  BarChart2, 
  Lock,
  ArrowRight,
  ArrowLeft,
  Search
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  getExams, 
  SimulatedClass, 
  SimulatedExam 
} from '../../../services/simulatedService';
import { SimulatedAttempt } from '../../../services/simulatedAttemptService';
import Loading from '../../ui/Loading';
import { useNavigate } from 'react-router-dom';

import { ExamResult } from '../simulados/ExamResult';
import SimulatedExamRunner from '../simulated/SimulatedExamRunner';

interface SimuladosTabContentProps {
  planId: string;
  simuladosVinculados?: string[];
}

export const SimuladosTabContent: React.FC<SimuladosTabContentProps> = ({ planId, simuladosVinculados }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [linkedClasses, setLinkedClasses] = useState<SimulatedClass[]>([]);
  const [examsMap, setExamsMap] = useState<Record<string, SimulatedExam[]>>({});
  const [attemptsMap, setAttemptsMap] = useState<Record<string, SimulatedAttempt>>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // States for direct viewing
  const [activeExam, setActiveExam] = useState<SimulatedExam | null>(null);
  const [viewingAttempt, setViewingAttempt] = useState<SimulatedAttempt | null>(null);
  const [viewingExamForResult, setViewingExamForResult] = useState<SimulatedExam | null>(null);

  const fetchData = async () => {
    if (!currentUser || !planId) return;
    setLoading(true);
    setError(null);

    try {
      let classIds = simuladosVinculados || [];

      // Se não vier por props, tenta buscar do banco para garantir
      if (classIds.length === 0) {
        const planDoc = await getDoc(doc(db, 'plans', planId));
        if (planDoc.exists()) {
          const planData = planDoc.data();
          classIds = planData.simuladosVinculados || (planData.linkedSimuladoClassId ? [planData.linkedSimuladoClassId] : []);
        }
      }

      if (classIds.length === 0) {
        setLinkedClasses([]);
        setLoading(false);
        return;
      }

      // Busca as Turmas Vinculadas
      const classesData: SimulatedClass[] = [];
      const examsDataMap: Record<string, SimulatedExam[]> = {};

      for (const classId of classIds) {
        const classRef = doc(db, 'simulatedClasses', classId);
        const classSnap = await getDoc(classRef);
        
        if (classSnap.exists()) {
          const data = classSnap.data();
          const cls = { id: classSnap.id, ...data } as SimulatedClass;
          classesData.push(cls);

          // Busca Simulados desta Turma
          const exams = await getExams(classId);
          examsDataMap[classId] = exams.filter(e => e.status === 'published');
        }
      }

      setLinkedClasses(classesData);
      setExamsMap(examsDataMap);

      // Busca Tentativas do Usuário para estes simulados
      const qAttempts = query(
        collection(db, 'simulated_attempts'),
        where('userId', '==', currentUser.uid)
      );
      const snapAttempts = await getDocs(qAttempts);
      const attMap: Record<string, SimulatedAttempt> = {};
      snapAttempts.docs.forEach(d => {
        const att = { id: d.id, ...d.data() } as SimulatedAttempt;
        attMap[att.simulatedId] = att;
      });
      setAttemptsMap(attMap);

    } catch (err) {
      console.error("Erro ao carregar simulados vinculados:", err);
      setError("Não foi possível carregar os simulados vinculados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, planId, simuladosVinculados]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-3xl">
        <AlertCircle size={40} className="text-zinc-500 mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest">{error}</p>
      </div>
    );
  }

  if (linkedClasses.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-3xl animate-in fade-in duration-500">
        <div className="mb-4 p-4 rounded-full bg-zinc-900 border border-zinc-800">
          <GraduationCap size={32} className="text-zinc-500" />
        </div>
        <h3 className="text-lg font-black uppercase text-zinc-400 tracking-tight">Nenhum simulado vinculado</h3>
        <p className="text-xs font-medium text-zinc-500 max-w-xs text-center mt-1">
          Nenhum simulado vinculado a este plano no momento.
        </p>
      </div>
    );
  }

  const selectedClass = linkedClasses.find(cls => cls.id === selectedClassId);

  // --- NÍVEL 1: LISTAGEM DE TURMAS ---
  if (!selectedClassId) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
              <Layers className="w-5 h-5 text-[var(--plan-theme)]" />
            </div>
            Turmas de Simulados
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {linkedClasses.map(cls => {
            const coverImage = (cls as any).thumbnail || cls.coverUrl;
            
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id!)}
                className="bg-zinc-900/40 border border-zinc-800 rounded-3xl flex flex-col text-left group hover:border-zinc-700 hover:bg-zinc-900/60 transition-all duration-300 relative overflow-hidden h-full"
              >
                {/* Turma Cover Image or Placeholder */}
                <div className="relative h-40 w-full bg-zinc-950 overflow-hidden">
                  {coverImage ? (
                    <img 
                      src={coverImage} 
                      alt={cls.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-60 group-hover:opacity-80"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] bg-[radial-gradient(circle_at_50%_120%,rgba(60,60,60,0.5),rgba(0,0,0,0))] border-b border-zinc-900">
                       <div className="p-4 rounded-full bg-zinc-900/50 border border-zinc-800 shadow-2xl transition-transform duration-500 group-hover:scale-110 group-hover:bg-zinc-800">
                          <GraduationCap size={32} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                       </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  
                  <div className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4 text-[var(--plan-theme)]" />
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <div className="mb-4">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight group-hover:text-[var(--plan-theme)] transition-colors">
                      {cls.title}
                    </h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                      {cls.organization}
                    </p>
                  </div>
                  
                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-zinc-800 rounded-lg">
                        <GraduationCap size={14} className="text-[var(--plan-theme)]" />
                      </div>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                         Oficial
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-[var(--plan-theme)] uppercase tracking-widest bg-[var(--plan-theme)]/10 px-3 py-1 rounded-full border border-[var(--plan-theme)]/20">
                      {examsMap[cls.id!]?.length || 0} Simulados
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // --- NÍVEL 2: LISTAGEM DE SIMULADOS DA TURMA ---
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header com Botão Voltar */}
      <div className="space-y-6">
        <button 
          onClick={() => setSelectedClassId(null)}
          className="flex items-center gap-2 text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors mb-2"
        >
          <ArrowLeft size={14} /> Voltar para Turmas
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <GraduationCap className="w-6 h-6 text-[var(--plan-theme)]" />
              </div>
              {selectedClass?.title}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest">{selectedClass?.organization}</span>
              <span className="w-1 h-1 bg-zinc-800 rounded-full" />
              <span className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest">{examsMap[selectedClassId]?.length || 0} QUESTÕES DISPONÍVEIS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Simulados */}
      <div className="grid grid-cols-1 gap-4">
        {examsMap[selectedClassId]?.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10">
            <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Nenhum simulado publicado nesta turma.</p>
          </div>
        ) : (
          examsMap[selectedClassId]?.map(exam => {
            const attempt = attemptsMap[exam.id!];
            const isDone = !!attempt;
            
            const now = new Date();
            const publishDate = exam.publishDate ? new Date(exam.publishDate) : null;
            const isBlocked = publishDate && publishDate > now;

            return (
              <div 
                key={exam.id} 
                className={`bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-zinc-700 transition-all ${isBlocked ? 'opacity-75' : ''}`}
              >
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-2xl ${isDone ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : isBlocked ? 'bg-zinc-800 text-zinc-600 border border-zinc-700' : 'bg-zinc-800 text-zinc-400'}`}>
                    {isDone ? <FileCheck size={28} /> : isBlocked ? <Lock size={28} /> : <PlayCircle size={28} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className={`text-xl font-black uppercase tracking-tight ${isBlocked ? 'text-zinc-500' : 'text-white'}`}>{exam.title}</h3>
                      {isBlocked && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[9px] font-bold uppercase border border-zinc-700 flex items-center gap-1">
                          <Lock size={10} /> BLOQUEADO
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-zinc-500 uppercase mt-2">
                      <span className="flex items-center gap-1.5"><Layers size={14} className="text-zinc-600" /> {exam.questionCount} Questões</span>
                      {exam.hasPenalty && <span className="flex items-center gap-1.5 text-red-500/80 bg-red-500/5 px-2 py-0.5 rounded-md border border-red-500/10"><AlertCircle size={14} /> Penalidade Ativa</span>}
                      {isBlocked && publishDate && (
                        <span className="flex items-center gap-1.5 text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded-md border border-purple-500/10">
                           Liberação em: {publishDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {isDone && (
                        <span className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10">
                           <FileCheck size={14} /> SIMULADO CONCLUÍDO
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isDone ? (
                    <button 
                      onClick={() => {
                        setViewingAttempt(attempt);
                        setViewingExamForResult(exam);
                      }}
                      className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 min-w-[180px]"
                    >
                      <BarChart2 size={16} /> Ver Resultado
                    </button>
                  ) : isBlocked ? (
                    <button 
                      disabled
                      className="px-8 py-4 bg-zinc-800 text-zinc-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-not-allowed border border-zinc-700 min-w-[180px]"
                    >
                      <Lock size={16} /> Bloqueado
                    </button>
                  ) : (
                    <button 
                      onClick={() => setActiveExam(exam)}
                      className="px-8 py-4 bg-brand-red hover:bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-red-900/20 min-w-[180px]"
                    >
                      <PlayCircle size={16} /> Realizar Simulado
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* AMBIENTE DE PROVA (MODAL DIRECTO) */}
      {activeExam && (
        <SimulatedExamRunner 
          exam={activeExam}
          classId={selectedClassId!}
          onClose={() => setActiveExam(null)}
          onComplete={(result) => {
             setAttemptsMap(prev => ({ ...prev, [activeExam.id!]: result }));
             setActiveExam(null);
             // Opcional: Abrir resultado automaticamente
             setViewingAttempt(result);
             setViewingExamForResult(activeExam);
          }}
        />
      )}

      {/* TELA DE RESULTADO / GABARITO (OVERLAY) */}
      {viewingAttempt && viewingExamForResult && (
        <ExamResult 
          exam={viewingExamForResult}
          attemptData={viewingAttempt}
          onBack={() => {
            setViewingAttempt(null);
            setViewingExamForResult(null);
          }}
        />
      )}
    </div>
  );
};

