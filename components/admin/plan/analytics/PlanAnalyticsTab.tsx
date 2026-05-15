
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Search, 
  Brain, 
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  ChevronRight,
  Target,
  X,
  ListTodo,
  BookOpen,
  Check,
  Layout,
  Users,
  ChevronDown,
  ChevronUp,
  Medal,
  TrendingUp,
  ShieldCheck,
  Zap,
  Info,
  BarChart,
  Lock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { SimulatedExam, getExams } from '../../../../services/simulatedService';
import { SimulatedAttempt, getAttemptsByUserId, getExamRanking } from '../../../../services/simulatedAttemptService';
import { getStudents, Student } from '../../../../services/userService';
import { getEdict, EdictStructure } from '../../../../services/edictService';
import { getAllPlanMetas, Meta } from '../../../../services/metaService';
import { useEditalProgress } from '../../../../hooks/useEditalProgress';
import { collection, getDocs, query, where, documentId, doc, getDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { toPlainObject } from '../../../../services/firestoreUtils';
import { StudyCalendar } from '../../../../components/student/calendar/StudyCalendar';
import DisciplineItem from '../../../../components/student/edital/DisciplineItem';
import Loading from '../../../ui/Loading';
import { updateStudent } from '../../../../services/userService';
import { motion, AnimatePresence } from 'motion/react';

const StudentAvatar = ({ student, size = 32, onExpand }: { student: Student; size?: number; onExpand?: (url: string) => void }) => {
  const finalPhotoUrl = student.photoURL || student.photoUrl || student.photo || (student as any).userProfile?.photoURL || (student as any).userProfile?.photoUrl || (student as any).userProfile?.photo || (student as any).profile?.photoURL || (student as any).profile?.photoUrl || (student as any).profile?.photo || (student as any).avatar || (student as any).avatarURL || (student as any).avatarUrl;
  const initials = student.name
    ? student.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '??';

  const colors = [
    'bg-blue-600', 'bg-emerald-600', 'bg-violet-600',
    'bg-amber-600', 'bg-rose-600', 'bg-cyan-600',
    'bg-indigo-600', 'bg-orange-600'
  ];
  
  // Deterministic color based on UID
  const charSum = student.uid ? student.uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const bgColor = colors[charSum % colors.length];

  return (
    <div 
      className={`rounded-full flex items-center justify-center text-white font-black overflow-hidden border border-white/10 ${bgColor} shrink-0 shadow-inner ${finalPhotoUrl ? 'cursor-pointer hover:ring-2 hover:ring-yellow-400/50 transition-all' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      onClick={(e) => {
        if (finalPhotoUrl && onExpand) {
          e.stopPropagation();
          onExpand(finalPhotoUrl);
        }
      }}
    >
      {finalPhotoUrl ? (
        <img src={finalPhotoUrl} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="tracking-tighter">{initials}</span>
      )}
    </div>
  );
};

const formatStudyTime = (minutes: number = 0) => {
  const totalMinutesRounded = Math.floor(minutes);
  if (totalMinutesRounded < 60) return `${totalMinutesRounded} min`;
  const hours = Math.floor(totalMinutesRounded / 60);
  const remainingMinutes = totalMinutesRounded % 60;
  
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
};

interface PlanAnalyticsTabProps {
  planId: string;
  linkedSimuladoClassId?: string;
}

type ViewState = 'STUDENTS' | 'STUDENT_DASHBOARD' | 'ATTEMPT_DETAIL';
type SubTab = 'SIMULADOS' | 'SCHEDULE' | 'EDITAL';

export const PlanAnalyticsTab: React.FC<PlanAnalyticsTabProps> = ({ planId, linkedSimuladoClassId }) => {
  const [view, setView] = useState<ViewState>('STUDENTS');
  const [subTab, setSubTab] = useState<SubTab>('SIMULADOS');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [planExams, setPlanExams] = useState<SimulatedExam[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPhotoUrl, setExpandedPhotoUrl] = useState<string | null>(null);
  const [edictStructure, setEdictStructure] = useState<EdictStructure | null>(null);
  const [metaLookup, setMetaLookup] = useState<Record<string, Meta>>({});
  
  // Selection
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentAttempts, setStudentAttempts] = useState<SimulatedAttempt[]>([]);
  const [studentEditalProgress, setStudentEditalProgress] = useState<Set<string>>(new Set());
  const [selectedAttempt, setSelectedAttempt] = useState<SimulatedAttempt | null>(null);
  const [currentRank, setCurrentRank] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['beginner', 'intermediate', 'advanced', 'insane', 'not_leveled']));
  const [isSyncing, setIsSyncing] = useState(false);
  const [chartMode, setChartMode] = useState<'quantity' | 'percentage' | 'autodiagnosis'>('quantity');

  // Routine to sync levels for non-leveled students
  const handleSyncLevels = async () => {
    if (!linkedSimuladoClassId) return;
    setIsSyncing(true);
    try {
      const nonLeveled = allStudents.filter(s => !s.studentLevel);
      let updatedCount = 0;

      for (const student of nonLeveled) {
        const q = query(
          collection(db, 'simulated_attempts'),
          where('userId', '==', student.uid)
        );
        const snap = await getDocs(q);
        
        for (const d of snap.docs) {
          const attempt = d.data();
          const examRef = doc(db, 'simulatedClasses', linkedSimuladoClassId, 'exams', attempt.simulatedId);
          const examSnap = await getDoc(examRef);
          
          if (examSnap.exists() && examSnap.data().isLeveling) {
            const exam = examSnap.data();
            const percent = (attempt.correctCount / exam.questionCount) * 100;
            let newLevel: 'beginner' | 'intermediate' | 'advanced' | 'insane' = 'beginner';
            if (percent > 90) newLevel = 'insane';
            else if (percent >= 71) newLevel = 'advanced';
            else if (percent >= 51) newLevel = 'intermediate';
            
            await updateStudent(student.uid, { studentLevel: newLevel });
            updatedCount++;
            break; 
          }
        }
      }
      console.log(`Sync complete. ${updatedCount} students updated.`);
    } catch (error) {
      console.error("Error syncing student levels:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupId)) newSet.delete(groupId);
    else newSet.add(groupId);
    setExpandedGroups(newSet);
  };

  const handleToggleManualGeneration = async (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !student.allowManualGeneration;
    try {
        await updateStudent(student.uid, { allowManualGeneration: newValue });
        
        if (selectedStudent?.uid === student.uid) {
            setSelectedStudent(prev => prev ? { ...prev, allowManualGeneration: newValue } : null);
        }

        toast.success(
            newValue 
                ? `Geração manual LIBERADA para ${student.name}` 
                : `Geração manual BLOQUEADA para ${student.name}`,
            { icon: newValue ? '🔓' : '🔒' }
        );
    } catch (error) {
        toast.error("Erro ao atualizar permissão");
    }
  };

  // Fetch Rank for the selected attempt
  useEffect(() => {
    if (selectedAttempt && view === 'ATTEMPT_DETAIL') {
      const fetchRank = async () => {
        try {
          const ranking = await getExamRanking(selectedAttempt.simulatedId);
          const index = ranking.findIndex(a => a.userId === selectedAttempt.userId);
          if (index !== -1) {
            setCurrentRank(index + 1);
          } else {
            setCurrentRank(null);
          }
        } catch (error) {
          console.error("Error fetching rank", error);
          setCurrentRank(null);
        }
      };
      fetchRank();
    }
  }, [selectedAttempt, view]);

  // 1. Initial Data Fetch & Real-time Sync
  useEffect(() => {
    setLoading(true);
    
    // a. Fetch Static Plan Data
    const fetchStatic = async () => {
      try {
        const [edictData, metasData] = await Promise.all([
           getEdict(planId),
           getAllPlanMetas(planId)
        ]);
        const lookup: Record<string, Meta> = {};
        metasData.forEach((m: Meta) => { lookup[m.id!] = m; });
        setEdictStructure(edictData);
        setMetaLookup(lookup);
      } catch (e) {
        console.error("Error fetching static analytics data", e);
      }
    };
    fetchStatic();

    // b. Fetch Exams
    if (linkedSimuladoClassId) {
      getExams(linkedSimuladoClassId).then(setPlanExams);
    }

    // c. Real-time Students Monitor
    const q = query(
      collection(db, 'users'), 
      where('role', '==', 'student'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => toPlainObject({
        ...doc.data(),
        uid: doc.id
      }) as Student);

      // Filter students who have active access to this plan
      const planStudents = studentsData.filter((s: Student) => 
        s.access?.some(a => a.targetId === planId && a.type === 'plan' && a.isActive)
      );

      setAllStudents(planStudents);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to students base:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [planId, linkedSimuladoClassId]);

  // 2. Fetch Student Specific Data
  // 2. Handle Escape key for Lightbox
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedPhotoUrl(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setView('STUDENT_DASHBOARD');
    setSubTab('SIMULADOS');
    setLoading(true);
    try {
      // 1. Fetch Attempts
      const attemptsPromise = getAttemptsByUserId(student.uid).then(attempts => {
        return attempts.filter(a => a.classId === linkedSimuladoClassId);
      });

      // 3. Fetch Edital Progress
      const editalPromise = (async () => {
        const progressRef = collection(db, 'users', student.uid, 'plans', planId, 'edital_progress');
        const snap = await getDocs(progressRef);
        const completedIds = new Set<string>();
        snap.docs.forEach(d => {
          if (d.data().completed) completedIds.add(d.id);
        });
        return completedIds;
      })();

      const [attempts, edital] = await Promise.all([
        attemptsPromise,
        editalPromise
      ]);

      setStudentAttempts(attempts ?? []);
      setStudentEditalProgress(edital ?? new Set());
    } catch (error) {
      console.error("Error fetching student comprehensive data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAttempt = (attempt: SimulatedAttempt) => {
    setSelectedAttempt(attempt);
    setView('ATTEMPT_DETAIL');
  };

  const menuBack = () => {
    if (view === 'ATTEMPT_DETAIL') setView('STUDENT_DASHBOARD');
    else if (view === 'STUDENT_DASHBOARD') setView('STUDENTS');
  };

  const filteredStudents = useMemo(() => {
    return allStudents.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allStudents, searchQuery]);

  // Grouped students by level
  const groupedStudents = useMemo(() => {
    const groups: Record<string, Student[]> = {
      insane: [],
      advanced: [],
      intermediate: [],
      beginner: [],
      not_leveled: []
    };

    filteredStudents.forEach(s => {
      const level = s.studentLevel || 'not_leveled';
      if (groups[level]) {
        groups[level].push(s);
      } else {
        groups.not_leveled.push(s);
      }
    });

    return groups;
  }, [filteredStudents]);

  // Discipline Stats for the selected attempt
  const disciplineStats = useMemo(() => {
    if (!selectedAttempt) return [];
    const currentExam = planExams.find(e => e.id === selectedAttempt.simulatedId);
    if (!currentExam || !currentExam.hasBlocks || !currentExam.blocks) return [];
    
    let currentStart = 1;
    const stats: any[] = [];
    const autodiagnosisRaw = (selectedAttempt as any).autodiagnosis?.rawAnswers || {};
    
    currentExam.blocks.forEach(block => {
        (block.disciplines || []).forEach(disc => {
            const start = currentStart;
            const end = currentStart + (Number(disc.questionCount) || 0) - 1;
            
            let hits = 0;
            let misses = 0;
            let blank = 0;

            // Autodiagnosis category counts
            let dominio = 0;      // Verde (Domínio Real)
            let revisao = 0;      // Amarelo (Revisão Necessária)
            let lacuna = 0;       // Vermelho (Lacuna de Conhecimento)
            
            for (let i = start; i <= end; i++) {
                const userAns = selectedAttempt.userAnswers[i] || selectedAttempt.userAnswers[String(i)];
                const questionData = currentExam.questions?.find(q => q.index === i);
                const correctAns = questionData?.answer;
                const isAnnulled = questionData?.isAnnulled;

                const reason = autodiagnosisRaw[i] || autodiagnosisRaw[String(i)];
                const isCorrect = isAnnulled || (userAns === correctAns);
                
                if (isAnnulled) {
                    hits++; 
                    dominio++;
                    continue;
                }
                
                if (!userAns) {
                    blank++;
                    // Blank + Insegurança = Amarelo
                    if (reason === 'INSEGURANCA') revisao++;
                    // Blank + Falta de conteúdo = Vermelho
                    else if (reason === 'FALTA_CONTEUDO') lacuna++;
                    else lacuna++; // Default for blank if no reason
                } else if (isCorrect) {
                    hits++;
                    // Correct + Domínio = Verde
                    if (reason === 'DOMINIO') dominio++;
                    // Correct + Chute Consciente = Amarelo
                    else if (reason === 'CHUTE_CONSCIENTE') revisao++;
                    // Correct + Chute Sorte = Vermelho
                    else if (reason === 'CHUTE_SORTE') lacuna++;
                    else dominio++; // Default for correct if no reason
                } else {
                    misses++;
                    // Wrong + Falta Atenção = Amarelo
                    if (reason === 'FALTA_ATENCAO') revisao++;
                    // Wrong + Falta Conteúdo = Vermelho
                    else if (reason === 'FALTA_CONTEUDO') lacuna++;
                    else lacuna++; // Default for wrong if no reason
                }
            }
            
            const total = Number(disc.questionCount) || (hits + misses + blank);
            const rate = total > 0 ? (hits / total) * 100 : 0;
            
            stats.push({
                name: disc.name,
                hits,
                misses,
                blank,
                realMastery: dominio,
                revisao: revisao,
                knowledgeGap: lacuna,
                total,
                rate: Number(rate.toFixed(1))
            });
            
            currentStart = end + 1;
        });
    });
    
    return stats;
  }, [selectedAttempt, planExams]);

  const sortedStats = useMemo(() => {
    const stats = [...disciplineStats];
    if (chartMode === 'percentage') {
        return stats.sort((a, b) => b.rate - a.rate);
    }
    return stats;
  }, [disciplineStats, chartMode]);

  // Stats for the header
  const groupStats = useMemo(() => {
    return {
      total: allStudents.length,
      insane: allStudents.filter(s => s.studentLevel === 'insane').length,
      advanced: allStudents.filter(s => s.studentLevel === 'advanced').length,
      intermediate: allStudents.filter(s => s.studentLevel === 'intermediate').length,
      beginner: allStudents.filter(s => s.studentLevel === 'beginner').length,
      not_leveled: allStudents.filter(s => !s.studentLevel).length
    };
  }, [allStudents]);

  // ==========================================
// NEW: READ-ONLY SUB-COMPONENTS
// ==========================================

const StudentEditalReadOnly = ({ structure, completedIds, metaLookup }: { structure: EdictStructure | null; completedIds: Set<string>; metaLookup: Record<string, Meta> }) => {
  const stats = useEditalProgress(structure, completedIds);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());
  
  if (!structure) {
    return (
      <div className="p-20 text-center bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl">
        <BookOpen size={40} className="text-zinc-700 mx-auto mb-4" />
        <h3 className="text-sm font-black text-zinc-600 uppercase tracking-widest">Edital não configurado para este plano.</h3>
      </div>
    );
  }

  const toggleDiscipline = (id: string) => {
    const newSet = new Set(expandedDisciplines);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedDisciplines(newSet);
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Global Progress Header */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 blur-[100px] pointer-events-none group-hover:bg-yellow-400/10 transition-all duration-700" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
           <div className="text-center md:text-left">
              <div className="flex items-center gap-2 text-[10px] font-black text-yellow-400 uppercase tracking-[0.3em] mb-4 font-mono">
                <Target size={12} />
                <span>Status de Cobertura do Edital</span>
              </div>
              <div className="flex items-center gap-4">
                 <div className="text-7xl font-black text-white tracking-tighter leading-none italic">{stats.globalProgress}%</div>
                 <div className="h-12 w-[1px] bg-zinc-800 hidden md:block" />
                 <div className="text-left">
                    <div className="text-xs font-black text-zinc-400 uppercase tracking-widest">{stats.completedGoals} Metas</div>
                    <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mt-0.5">Concluídas de {stats.totalGoals}</div>
                 </div>
              </div>
           </div>
           
           <div className="flex-1 w-full max-w-xl">
              <div className="h-6 bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden p-1 shadow-inner group/bar relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.globalProgress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-xl relative"
                >
                   <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[slide_1s_linear_infinite]" />
                   <div className="absolute inset-0 shadow-[0_0_20px_rgba(250,204,21,0.3)]" />
                </motion.div>
              </div>
              
              <div className="grid grid-cols-2 mt-4 gap-4">
                 <div className="bg-zinc-800/20 p-3 rounded-2xl border border-zinc-800/50 flex flex-col gap-1">
                    <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={8} /> Projeção de Fim
                    </div>
                    <div className="text-xs font-black text-zinc-400 uppercase">Automática</div>
                 </div>
                 <div className="bg-zinc-800/20 p-3 rounded-2xl border border-zinc-800/50 flex flex-col gap-1">
                    <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-1">
                      <BarChart3 size={8} /> Desempenho
                    </div>
                    <div className="text-xs font-black text-zinc-400 uppercase">Monitorado</div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Disciplines MIRROR VIEW */}
      <h3 className="text-sm font-black text-white uppercase tracking-[0.3em] flex items-center gap-3 pl-2">
        <Layout size={18} className="text-yellow-400" />
        Visão Espelhada por Disciplina
      </h3>

      <div className="grid grid-cols-1 gap-4">
        {structure.disciplines.map(discipline => {
          const progress = stats.disciplineStats[discipline.id] || 0;
          return (
            <DisciplineItem 
              key={discipline.id}
              discipline={discipline}
              expandedDisciplines={expandedDisciplines}
              toggleDiscipline={toggleDiscipline}
              progress={progress}
              completedMetaIds={completedIds}
              activeUserMode={false}
              isReadOnly={true}
              metaLookup={metaLookup}
              planId={structure.planId}
              structure={structure}
              variant="circular"
              openNotebook={() => {}} // Read-only
            />
          );
        })}
      </div>
    </div>
  );
};

// Derived Data for Dashboard
  const dashboardData = useMemo(() => {
    if (!selectedStudent) return null;
    
    const realizedIds = new Set(studentAttempts.map(a => a.simulatedId));
    const realized = studentAttempts;
    const pending = planExams.filter(e => !realizedIds.has(e.id!));
    
    const avgScore = realized.length > 0 
      ? realized.reduce((acc, curr) => acc + curr.score, 0) / realized.length 
      : 0;

    return { realized, pending, avgScore };
  }, [selectedStudent, studentAttempts, planExams]);

  if (!linkedSimuladoClassId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
        <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 border border-zinc-700">
          <BarChart3 size={32} className="text-zinc-500" />
        </div>
        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Sem Turma Vinculada</h3>
        <p className="text-zinc-500 max-w-sm text-sm">
          Este plano não possui uma turma de simulados vinculada. Vá na aba &apos;Visual&apos; para vincular uma turma e habilitar as análises pedagógicas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md">
        <div className="flex items-center gap-4">
          {view !== 'STUDENTS' && (
            <button 
              onClick={menuBack}
              className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all transform active:scale-90"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-yellow-400 uppercase tracking-widest mb-0.5">
              <Brain size={12} />
              <span>
                {view === 'STUDENTS' && "Gestão Estratégica de Turma"}
                {view === 'STUDENT_DASHBOARD' && "Perfil de Evolução do Aluno"}
                {view === 'ATTEMPT_DETAIL' && "Raio-X de Performance"}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
              {view === 'STUDENTS' && "Meus Alunos"}
              {view === 'STUDENT_DASHBOARD' && selectedStudent?.name}
              {view === 'ATTEMPT_DETAIL' && selectedAttempt?.simulatedTitle}
            </h2>
          </div>
        </div>

        {view === 'STUDENTS' && (
          <div className="flex items-center gap-4">
            <button 
              onClick={handleSyncLevels}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all transform active:scale-95 ${isSyncing ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed' : 'bg-yellow-400 border-yellow-500 text-black hover:bg-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.2)]'}`}
            >
              <TrendingUp size={14} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Sincronizando..." : "Sincronizar Níveis"}
            </button>

            <div className="relative w-80">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text"
                placeholder="BUSCAR ALUNO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-xs font-bold text-white uppercase tracking-widest focus:border-yellow-400 outline-none transition-all placeholder:text-zinc-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800">
        
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center py-20 opacity-50">
            <Loading />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-6 animate-pulse">Sincronizando Base de Dados...</span>
          </div>
        ) : (
          <>
            {/* LEVEL 1: STUDENT LIST - GROUPED ACCORDION VIEW */}
            {view === 'STUDENTS' && (
              <div className="max-w-7xl mx-auto space-y-8 pb-20">
                
                {/* 1. Dashboard Counters */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                   <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group hover:border-zinc-700 transition-all">
                      <Users size={16} className="text-zinc-500 mb-1" />
                      <div className="text-2xl font-black text-white">{groupStats.total}</div>
                      <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center leading-tight">Total de Alunos</div>
                   </div>
                   
                   <div className="bg-zinc-900 border border-red-500/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group hover:border-red-500/40 transition-all shadow-[0_0_15px_rgba(239,68,68,0.05)]">
                      <TrendingUp size={16} className="text-red-500 mb-1" />
                      <div className="text-2xl font-black text-red-500">{groupStats.insane}</div>
                      <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center leading-tight">Nível Insano</div>
                   </div>

                   <div className="bg-zinc-900 border border-[#FFFF00]/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group hover:border-[#FFFF00]/40 transition-all shadow-[0_0_15px_rgba(255,255,0,0.05)]">
                      <ShieldCheck size={16} className="text-[#FFFF00] mb-1" />
                      <div className="text-2xl font-black text-[#FFFF00]">{groupStats.advanced}</div>
                      <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center leading-tight">Nível Avançado</div>
                   </div>

                   <div className="bg-zinc-900 border border-emerald-500/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group hover:border-emerald-500/40 transition-all shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                      <Medal size={16} className="text-emerald-500 mb-1" />
                      <div className="text-2xl font-black text-emerald-500">{groupStats.intermediate}</div>
                      <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center leading-tight">Nível Intermediário</div>
                   </div>

                   <div className="bg-zinc-900 border border-cyan-500/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group hover:border-cyan-500/40 transition-all shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                      <Target size={16} className="text-cyan-500 mb-1" />
                      <div className="text-2xl font-black text-cyan-500">{groupStats.beginner}</div>
                      <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center leading-tight">Nível Iniciante</div>
                   </div>

                   <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group hover:border-zinc-700 transition-all">
                      <Info size={16} className="text-zinc-600 mb-1" />
                      <div className="text-2xl font-black text-zinc-500">{groupStats.not_leveled}</div>
                      <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center leading-tight">Não Nivelados</div>
                   </div>
                </div>

                {/* 2. Group Accordions */}
                <div className="space-y-6">
                  {[
                    { id: 'beginner', label: 'GRUPO 1: NÍVEL INICIANTE', color: 'text-cyan-500', bg: 'bg-cyan-500/5', border: 'border-cyan-500/30' },
                    { id: 'intermediate', label: 'GRUPO 2: NÍVEL INTERMEDIÁRIO', color: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/30' },
                    { id: 'advanced', label: 'GRUPO 3: NÍVEL AVANÇADO', color: 'text-[#FFFF00]', bg: 'bg-[#FFFF00]/5', border: 'border-[#FFFF00]/30' },
                    { id: 'insane', label: 'GRUPO 4: NÍVEL INSANO', color: 'text-red-500', bg: 'bg-red-500/5', border: 'border-red-500/30' },
                    { id: 'not_leveled', label: 'GRUPO 5: ALUNOS NÃO NIVELADOS', color: 'text-zinc-500', bg: 'bg-zinc-900/50', border: 'border-zinc-800' }
                  ].map(group => {
                    const students = groupedStudents[group.id] || [];
                    const isExpanded = expandedGroups.has(group.id);
                    
                    if (students.length === 0 && searchQuery) return null;

                    return (
                      <div key={group.id} className={`rounded-3xl border ${group.border} overflow-hidden bg-zinc-900/20 backdrop-blur-sm transition-all`}>
                        {/* Accordion Header */}
                        <button 
                          onClick={() => toggleGroup(group.id)}
                          className={`w-full flex items-center justify-between px-8 py-5 text-left transition-all ${isExpanded ? group.bg : 'hover:bg-zinc-800/30'}`}
                        >
                          <div className="flex items-center gap-4">
                             <div className={`flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-950 border ${group.border} ${group.color}`}>
                                {group.id === 'insane' && <Zap size={20} />}
                                {group.id === 'advanced' && <ShieldCheck size={20} />}
                                {group.id === 'intermediate' && <Medal size={20} />}
                                {group.id === 'beginner' && <Target size={20} />}
                                {group.id === 'not_leveled' && <Info size={20} />}
                             </div>
                             <div>
                                <h3 className={`text-sm font-black uppercase tracking-[0.2em] ${group.color}`}>{group.label}</h3>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{students.length} Alunos na seção</p>
                             </div>
                          </div>
                          {isExpanded ? <ChevronUp className="text-zinc-500" /> : <ChevronDown className="text-zinc-500" />}
                        </button>

                        {/* Accordion Content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-zinc-800">
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="bg-zinc-950/30 border-b border-zinc-800/50">
                                        <th className="px-8 py-3 text-left text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] w-16">Foto</th>
                                        <th className="px-8 py-3 text-left text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Estudante</th>
                                        <th className="px-8 py-3 text-center text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Tempo de Estudo</th>
                                        <th className="px-8 py-3 text-center text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Status</th>
                                        <th className="px-8 py-3 text-right text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Ação</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/30">
                                      {students.length === 0 ? (
                                        <tr>
                                          <td colSpan={5} className="py-12 text-center text-zinc-700 font-bold uppercase tracking-widest text-xs">
                                            Nenhum aluno nesta categoria.
                                          </td>
                                        </tr>
                                      ) : (
                                        students.map(student => (
                                          <tr 
                                            key={student.uid}
                                            className="group hover:bg-zinc-800/20 transition-colors cursor-pointer"
                                            onClick={() => handleSelectStudent(student)}
                                          >
                                            <td className="px-8 py-3">
                                              <StudentAvatar student={student} size={36} onExpand={setExpandedPhotoUrl} />
                                            </td>
                                            <td className="px-8 py-3">
                                              <div className="flex flex-col">
                                                <span className="text-sm font-black text-white uppercase tracking-tighter group-hover:text-yellow-400 transition-colors">{student.name}</span>
                                                <span className="text-[10px] text-zinc-500 lowercase font-medium">{student.email}</span>
                                              </div>
                                            </td>
                                            <td className="px-8 py-3 text-center">
                                              <span className="text-xs font-mono font-black text-zinc-300">{formatStudyTime(student.lifetimeMinutes || 0)}</span>
                                            </td>
                                            <td className="px-8 py-3 text-center">
                                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${student.status === 'inactive' ? 'bg-red-500/10 border border-red-500/20 text-red-500' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'}`}>
                                                {student.status === 'inactive' ? 'INATIVO' : 'ATIVO'}
                                              </span>
                                            </td>
                                            <td className="px-8 py-3 text-right">
                                              <div className="flex items-center justify-end gap-2">
                                                <button 
                                                  onClick={(e) => handleToggleManualGeneration(student, e)}
                                                  title={student.allowManualGeneration ? "Bloquear Geração Manual" : "Liberar Geração Manual"}
                                                  className={`p-2 rounded-xl border transition-all ${
                                                    student.allowManualGeneration 
                                                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                                                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                                                  }`}
                                                >
                                                  <Lock size={14} className={student.allowManualGeneration ? 'animate-pulse' : ''} />
                                                </button>

                                                <div className="inline-flex items-center justify-center p-2 rounded-xl bg-zinc-800 text-zinc-500 group-hover:bg-yellow-400 group-hover:text-black transition-all transform active:scale-90">
                                                  <ChevronRight size={16} />
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* LEVEL 2: STUDENT DASHBOARD */}
            {view === 'STUDENT_DASHBOARD' && dashboardData && (
              <div className="max-w-6xl mx-auto space-y-8 pb-20">
                {/* Student Identity Header */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 backdrop-blur-xl">
                  <StudentAvatar student={selectedStudent!} size={80} onExpand={setExpandedPhotoUrl} />
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-1">{selectedStudent?.name}</h3>
                    <p className="text-sm text-zinc-500 font-medium lowercase mb-4">{selectedStudent?.email}</p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                       {selectedStudent?.studentLevel && (
                         <span className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${
                           selectedStudent.studentLevel === 'insane' ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' :
                           selectedStudent.studentLevel === 'advanced' ? 'bg-[#FFFF00]/10 border-[#FFFF00]/30 text-[#FFFF00]' :
                           selectedStudent.studentLevel === 'intermediate' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
                           'bg-cyan-500/10 border-cyan-500/30 text-cyan-500'
                         }`}>
                           <Medal size={12} />
                           {selectedStudent.studentLevel === 'insane' ? 'Nível Insano' :
                            selectedStudent.studentLevel === 'advanced' ? 'Nível Avançado' :
                            selectedStudent.studentLevel === 'intermediate' ? 'Nível Intermediário' :
                            'Nível Iniciante'}
                         </span>
                       )}
                       <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 border border-zinc-700 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                         <Clock size={12} className="text-yellow-400" /> {formatStudyTime(selectedStudent?.lifetimeMinutes || 0)} de estudo
                       </span>
                       <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                         <CheckCircle2 size={12} /> Aluno Ativo
                       </span>

                       {/* NOVO: BOTÃO DE BLOQUEIO NA DASHBOARD */}
                       <button 
                          onClick={(e) => handleToggleManualGeneration(selectedStudent!, e)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                            selectedStudent?.allowManualGeneration 
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                              : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          <Lock size={12} className={selectedStudent?.allowManualGeneration ? 'animate-pulse' : ''} />
                          {selectedStudent?.allowManualGeneration ? 'Geração Manual: Liberada' : 'Geração Manual: Bloqueada'}
                       </button>
                    </div>
                  </div>
                </div>

                {/* Sub-Tabs Switcher */}
                <div className="flex p-1.5 bg-zinc-950/80 border border-zinc-900 rounded-2xl w-fit mx-auto sm:mx-0">
                  <button 
                    onClick={() => setSubTab('SIMULADOS')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${subTab === 'SIMULADOS' ? 'bg-zinc-800 text-yellow-400 border border-zinc-700 shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Target size={14} />
                    SIMULADOS
                  </button>
                  <button 
                    onClick={() => setSubTab('SCHEDULE')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${subTab === 'SCHEDULE' ? 'bg-zinc-800 text-yellow-400 border border-zinc-700 shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Calendar size={14} />
                    CRONOGRAMA
                  </button>
                  <button 
                    onClick={() => setSubTab('EDITAL')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${subTab === 'EDITAL' ? 'bg-zinc-800 text-yellow-400 border border-zinc-700 shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <ListTodo size={14} />
                    EDITAL VERTICALIZADO
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {subTab === 'SIMULADOS' && (
                    <motion.div 
                      key="simulados"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      {/* Stats Summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 flex flex-col items-center gap-2">
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">Simulados Realizados</span>
                          <div className="text-4xl font-black text-white">{dashboardData.realized.length}</div>
                          <div className="text-[10px] text-zinc-600 font-bold uppercase">de {planExams.length} disponíveis</div>
                        </div>
                        <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 flex flex-col items-center gap-2">
                          <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest bg-yellow-500/10 px-3 py-1 rounded-full">Simulados Pendentes</span>
                          <div className="text-4xl font-black text-white text-yellow-500">{dashboardData.pending.length}</div>
                          <div className="text-[10px] text-zinc-600 font-bold uppercase">ainda não realizados</div>
                        </div>
                        <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 flex flex-col items-center gap-2">
                          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full">Média Geral</span>
                          <div className="text-4xl font-black text-white">{dashboardData.avgScore.toFixed(1)}</div>
                          <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">pontuação líquida</div>
                        </div>
                      </div>

                      {/* Lists Section */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Realized List */}
                        <div>
                          <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-500" />
                            Histórico de Realizados
                          </h3>
                          <div className="space-y-4">
                            {dashboardData.realized.length === 0 ? (
                              <div className="p-10 border border-dashed border-zinc-800 rounded-3xl text-center text-zinc-600 text-xs font-bold uppercase">
                                Nenhum simulado realizado.
                              </div>
                            ) : (
                              dashboardData.realized.map(attempt => (
                                <div 
                                  key={attempt.id}
                                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-600 transition-all group flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-4">
                                     <div className="w-12 h-12 rounded-xl bg-zinc-800 flex flex-col items-center justify-center border border-zinc-700">
                                        <span className="text-[10px] font-black text-zinc-600 uppercase">Score</span>
                                        <span className={`text-sm font-black ${attempt.score > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{attempt.score}</span>
                                     </div>
                                     <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-tighter">{attempt.simulatedTitle}</h4>
                                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-widest">
                                           <span className="flex items-center gap-1"><Calendar size={10} /> {attempt.completedAt?.toDate ? attempt.completedAt.toDate().toLocaleDateString() : 'Recent'}</span>
                                           <span className="flex items-center gap-1"><Clock size={10} /> Finalizado</span>
                                        </div>
                                     </div>
                                  </div>
                                  <button 
                                    onClick={() => handleSelectAttempt(attempt)}
                                    className="bg-zinc-800 text-white p-3 rounded-xl hover:bg-yellow-400 hover:text-black transition-all transform active:scale-90"
                                  >
                                    <ChevronRight size={20} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Pending List */}
                        <div>
                          <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <AlertCircle size={16} className="text-yellow-500" />
                            Simulados em Aberto
                          </h3>
                          <div className="space-y-4">
                            {dashboardData.pending.length === 0 ? (
                              <div className="p-10 border border-dashed border-zinc-800 rounded-3xl text-center text-zinc-600 text-xs font-bold uppercase">
                                Todos os simulados concluídos!
                              </div>
                            ) : (
                              dashboardData.pending.map(exam => (
                                <div 
                                  key={exam.id}
                                  className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-5 flex items-center gap-4 opacity-70 group hover:opacity-100 transition-all"
                                >
                                  <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-700">
                                     <AlertCircle size={20} />
                                  </div>
                                  <div className="flex-1">
                                     <h4 className="text-sm font-black text-zinc-500 uppercase tracking-tighter group-hover:text-white transition-colors">{exam.title}</h4>
                                     <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Aguardando realização do aluno</p>
                                  </div>
                                  <div className="text-[9px] font-black text-zinc-700 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800 uppercase tracking-tighter">Pendente</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {subTab === 'SCHEDULE' && (
                    <motion.div 
                      key="schedule"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {selectedStudent && (
                        <StudyCalendar userId={selectedStudent.uid} isReadOnly={true} />
                      )}
                    </motion.div>
                  )}

                  {subTab === 'EDITAL' && (
                    <motion.div 
                      key="edital"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <StudentEditalReadOnly structure={edictStructure} completedIds={studentEditalProgress} metaLookup={metaLookup} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* LEVEL 3: ATTEMPT DETAIL - RAIO-X */}
            {view === 'ATTEMPT_DETAIL' && selectedAttempt && (() => {
               const currentExam = planExams.find(e => e.id === selectedAttempt.simulatedId);
               const isLeveling = currentExam?.isLeveling;
               const percent = (selectedAttempt.correctCount / selectedAttempt.totalQuestions) * 100;
               
               const getPreparationLevel = (p: number) => {
                 if (p >= 90) return { label: "INSANO", color: "border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]" };
                 if (p >= 71) return { label: "AVANÇADO", color: "border-[#FFFF00] text-[#FFFF00] shadow-[0_0_20px_rgba(255,255,0,0.2)]" };
                 if (p >= 51) return { label: "INTERMEDIÁRIO", color: "border-emerald-500 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]" };
                 return { label: "INICIANTE", color: "border-cyan-500 text-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.1)]" };
               };

               const level = getPreparationLevel(percent);

               return (
                <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-5 duration-500">
                  {/* Preparation Level Badge (Only for Leveling) */}
                  {isLeveling && (
                    <div className="flex justify-center">
                      <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-zinc-950 border-2 ${level.color} text-xs font-black uppercase tracking-[0.2em] animate-pulse`}>
                        NÍVEL DE PREPARAÇÃO: {level.label}
                      </div>
                    </div>
                  )}

                  {/* Performance Overview */}
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-[2.5rem] p-8 relative overflow-hidden backdrop-blur-xl">
                    {/* BG Decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 blur-[100px] pointer-events-none" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                       <div className="text-center md:text-left flex flex-col justify-center">
                          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em] mb-2">Desempenho Geral</div>
                          <div className="text-6xl font-black text-white tracking-tighter leading-none mb-2">{selectedAttempt.score.toFixed(1)}</div>
                          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Pontos Líquidos</div>
                       </div>
                       
                       <div className="flex flex-col justify-center gap-4 border-l border-zinc-800 pl-8">
                          <div>
                             <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Acertos</div>
                             <div className="text-xl font-bold text-emerald-500">{selectedAttempt.correctCount} / {selectedAttempt.totalQuestions}</div>
                          </div>
                          <div>
                             <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Erros</div>
                             <div className="text-xl font-bold text-red-500">{selectedAttempt.wrongCount}</div>
                          </div>
                       </div>
  
                       <div className="flex flex-col justify-center gap-4 border-l border-zinc-800 pl-8">
                          <div>
                             <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Tempo Gasto</div>
                             <div className="text-xl font-bold text-white">--:--</div>
                          </div>
                          <div>
                             <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Posição Ranking</div>
                             <div className="text-xl font-bold text-yellow-400"># {currentRank || '--'}</div>
                          </div>
                       </div>
  
                       <div className="flex flex-col items-center justify-center">
                          <div className={`w-32 h-32 rounded-full border-8 flex items-center justify-center p-4 ${selectedAttempt.isApproved ? 'border-emerald-500/20 text-emerald-500' : 'border-red-500/20 text-red-500'}`}>
                             <div className="text-center">
                                <Target size={24} className="mx-auto mb-1" />
                                <div className="text-[10px] font-black uppercase leading-tight font-serif italic">
                                  {selectedAttempt.isApproved ? "Aprovado" : "Reprovado"}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
  
                  {/* Discipline Performance Chart */}
                  {disciplineStats.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 animate-in slide-in-from-bottom-4 duration-700">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                          <div>
                              <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                  <BarChart className="text-brand-red w-6 h-6" />
                                  Performance por Disciplina
                              </h3>
                              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                                  Detalhamento de acertos e aproveitamento por matéria
                              </p>
                          </div>

                          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit self-end md:self-auto">
                              <button 
                                  onClick={() => setChartMode('quantity')}
                                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${chartMode === 'quantity' ? 'bg-zinc-800 text-white shadow-lg shadow-black/50' : 'text-zinc-600 hover:text-zinc-400'}`}
                              >
                                  Quantidade
                              </button>
                              <button 
                                  onClick={() => setChartMode('percentage')}
                                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${chartMode === 'percentage' ? 'bg-zinc-800 text-white shadow-lg shadow-black/50' : 'text-zinc-600 hover:text-zinc-400'}`}
                              >
                                  Porcentagem
                              </button>
                              {(selectedAttempt as any).autodiagnosis?.analysis && (
                                  <button 
                                      onClick={() => setChartMode('autodiagnosis')}
                                      className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${chartMode === 'autodiagnosis' ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20' : 'text-zinc-600 hover:text-zinc-400'}`}
                                  >
                                      Autodiagnóstico
                                  </button>
                              )}
                          </div>
                      </div>

                      <div className="h-[400px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <ReBarChart
                                  data={sortedStats}
                                  layout="vertical"
                                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                              >
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                                  <XAxis 
                                      type="number" 
                                      hide 
                                      domain={chartMode === 'percentage' ? [0, 100] : [0, 'dataMax']} 
                                  />
                                  <YAxis 
                                      dataKey="name" 
                                      type="category" 
                                      width={150} 
                                      axisLine={false}
                                      tickLine={false}
                                      tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold' }}
                                  />
                                  <Tooltip 
                                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                      content={({ active, payload }) => {
                                          if (active && payload && payload.length) {
                                              const data = payload[0].payload;
                                              return (
                                                  <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl shadow-2xl">
                                                      <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2 pb-1 border-b border-zinc-900">{data.name}</p>
                                                      <div className="space-y-1">
                                                          {chartMode === 'autodiagnosis' ? (
                                                              <>
                                                                  <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                      <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" /> Domínio Real:</span>
                                                                      <span className="text-emerald-500">{data.realMastery}</span>
                                                                  </div>
                                                                  <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                      <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#FFFF00] block" /> Revisar:</span>
                                                                      <span className="text-yellow-400">{data.revisao}</span>
                                                                  </div>
                                                                  <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                      <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500 block" /> Lacuna Conhec.:</span>
                                                                      <span className="text-red-500">{data.knowledgeGap}</span>
                                                                  </div>
                                                              </>
                                                          ) : (
                                                              <>
                                                                  <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                      <span>Acertos:</span>
                                                                      <span className="text-emerald-500">{data.hits}</span>
                                                                  </div>
                                                                  <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                      <span>Erros:</span>
                                                                      <span className="text-red-500">{data.misses}</span>
                                                                  </div>
                                                              </>
                                                          )}
                                                          <div className="pt-1 mt-1 border-t border-zinc-900">
                                                              <div className="text-[10px] font-black text-white flex items-center justify-between uppercase">
                                                                  <span>Aproveitamento:</span>
                                                                  <span className="text-[#DC2626] font-black">{data.rate}%</span>
                                                              </div>
                                                          </div>
                                                      </div>
                                                  </div>
                                              );
                                          }
                                          return null;
                                      }}
                                  />
                                  {chartMode === 'quantity' ? (
                                      <>
                                          <Bar 
                                              dataKey="hits" 
                                              stackId="a" 
                                              fill="#10b981" 
                                              radius={[0, 0, 0, 0]} 
                                              barSize={20}
                                          />
                                          <Bar 
                                              dataKey="misses" 
                                              stackId="a" 
                                              fill="#ef4444" 
                                              radius={[0, 4, 4, 0]} 
                                              barSize={20}
                                          />
                                      </>
                                  ) : chartMode === 'percentage' ? (
                                      <Bar 
                                          dataKey="rate" 
                                          radius={[0, 4, 4, 0]} 
                                          barSize={20}
                                      >
                                          {sortedStats.map((entry, index) => (
                                              <Cell 
                                                  key={`cell-${index}`} 
                                                  fill={entry.rate >= 70 ? '#10b981' : entry.rate >= 50 ? '#eab308' : '#ef4444'} 
                                              />
                                          ))}
                                          <LabelList 
                                              dataKey="rate" 
                                              position="right" 
                                              style={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold' }} 
                                              formatter={(v: number) => `${v}%`} 
                                          />
                                      </Bar>
                                  ) : (
                                      <>
                                          <Bar 
                                              dataKey="realMastery" 
                                              stackId="a" 
                                              fill="#10b981" 
                                              radius={[0, 0, 0, 0]} 
                                              barSize={20}
                                              name="Domínio Real"
                                          />
                                          <Bar 
                                              dataKey="revisao" 
                                              stackId="a" 
                                              fill="#FFFF00" 
                                              radius={[0, 0, 0, 0]} 
                                              barSize={20}
                                              name="Revisar"
                                          />
                                          <Bar 
                                              dataKey="knowledgeGap" 
                                              stackId="a" 
                                              fill="#ef4444" 
                                              radius={[0, 4, 4, 0]} 
                                              barSize={20}
                                              name="Lacuna de Conhecimento"
                                          />
                                      </>
                                  )}
                              </ReBarChart>
                          </ResponsiveContainer>
                      </div>
                      
                      {chartMode === 'quantity' && (
                          <div className="flex items-center justify-center gap-6 mt-4">
                              <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Acertos</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Erros</span>
                              </div>
                          </div>
                      )}

                      {chartMode === 'autodiagnosis' && (
                          <div className="flex flex-wrap items-center justify-center gap-6 mt-4">
                              <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Domínio Real</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Revisão Nec.</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Lacuna de Conteúdo</span>
                              </div>
                          </div>
                      )}
                    </div>
                  )}

                  {/* Question Map */}
                  {(selectedAttempt as any).autodiagnosis?.analysis ? (
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.3em] pl-2 border-l-4 border-yellow-400">Mapa Estratégico por Disciplina</h3>
                    <div className="grid grid-cols-1 gap-6">
                      {Object.entries((selectedAttempt as any).autodiagnosis.analysis).map(([subject, data]: [string, any]) => (
                        <div key={subject} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 group hover:border-zinc-700 transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                             <div>
                                <h4 className="text-lg font-black text-white uppercase tracking-tighter">{subject}</h4>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Plano de ação baseado em autodiagnóstico</p>
                             </div>
                             <div className="flex gap-2">
                                <div className="text-center bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                                   <div className="text-[8px] font-black text-emerald-600 uppercase">Forte</div>
                                   <div className="text-sm font-black text-emerald-500">{data.strong}</div>
                                </div>
                                <div className="text-center bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-xl">
                                   <div className="text-[8px] font-black text-yellow-600 uppercase">Revisar</div>
                                   <div className="text-sm font-black text-yellow-500">{data.review}</div>
                                </div>
                                <div className="text-center bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl">
                                   <div className="text-[8px] font-black text-red-600 uppercase">Fraco</div>
                                   <div className="text-sm font-black text-red-500">{data.weak}</div>
                                </div>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {data.topicsToStudy?.length > 0 && (
                               <div className="bg-black/20 p-4 rounded-2xl border border-zinc-800/50">
                                  <div className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                     <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                     Estudar do Zero (Gaps de Conteúdo)
                                  </div>
                                  <div className="space-y-1.5">
                                    {data.topicsToStudy.map((t: string, i: number) => (
                                      <div key={i} className="text-xs text-zinc-400 font-medium pl-3 border-l border-zinc-800">{t}</div>
                                    ))}
                                  </div>
                               </div>
                             )}
                             {data.topicsToReview?.length > 0 && (
                               <div className="bg-black/20 p-4 rounded-2xl border border-zinc-800/50">
                                  <div className="text-[9px] font-black text-yellow-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                     <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                                     Revisar Detalhes (Falta de Atenção/Dúvida)
                                  </div>
                                  <div className="space-y-1.5">
                                    {data.topicsToReview.map((t: string, i: number) => (
                                      <div key={i} className="text-xs text-zinc-400 font-medium pl-3 border-l border-zinc-800">{t}</div>
                                    ))}
                                  </div>
                               </div>
                             )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-20 text-center bg-zinc-900 border border-dashed border-zinc-800 rounded-[2.5rem]">
                     <AlertCircle size={40} className="text-zinc-700 mx-auto mb-4" />
                     <h3 className="text-sm font-black text-zinc-600 uppercase tracking-widest">O aluno ainda não preencheu o autodiagnóstico deste simulado.</h3>
                     <p className="text-[10px] text-zinc-700 font-bold uppercase mt-2">Os dados detalhados por assunto só estarão disponíveis após o preenchimento.</p>
                  </div>
                )}
              </div>
            );
          })()}
          </>
        )}
      </div>

      {/* LIGHTBOX MODAL */}
      {expandedPhotoUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setExpandedPhotoUrl(null)}
        >
          <button 
            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white hover:bg-zinc-700 transition-all transform active:scale-90 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedPhotoUrl(null);
            }}
          >
            <X size={24} />
          </button>
          
          <div 
            className="relative max-w-4xl max-h-[85vh] group animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={expandedPhotoUrl} 
              alt="Expanded Profile" 
              className="w-full h-full object-contain rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-zinc-800"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
