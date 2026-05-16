
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, Clock, Zap, BookOpen, 
  PlayCircle, FileText, Scale, Loader2,
  CalendarClock, Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getStudentPlans, 
  saveStudentRoutine, 
  getStudentConfig,
  StudentPlan, 
  StudentRoutine, 
  StudyProfile 
} from '../../services/studentService';
import { generateSchedule } from '../../services/scheduleService';
import Loading from '../../components/ui/Loading';
import PlanControlPanel from '../../components/student/config/PlanControlPanel';
import WeeklyPlannerModal, { RoutineTemplate } from '../../components/student/config/WeeklyPlannerModal';

import { toast } from 'react-hot-toast';

const DAYS_OF_WEEK = [
  { id: 0, label: 'Domingo' },
  { id: 1, label: 'Segunda' },
  { id: 2, label: 'Terça' },
  { id: 3, label: 'Quarta' },
  { id: 4, label: 'Quinta' },
  { id: 5, label: 'Sexta' },
  { id: 6, label: 'Sábado' },
];

const StudentConfigPage: React.FC = () => {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  
  // Data State
  const [plans, setPlans] = useState<StudentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState('');

  // Form State
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [initialPlanId, setInitialPlanId] = useState<string | null>(null);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [isPlanPaused, setIsPlanPaused] = useState(false); // New State
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [savedRoutines, setSavedRoutines] = useState<RoutineTemplate[]>([]);
  const [activeRoutineId, setActiveRoutineId] = useState<string>('');
  
  const [studyProfile, setStudyProfile] = useState<StudyProfile>({
    level: 'intermediate',
    semiActiveClass: false,
    semiActiveMaterial: false,
    semiActiveLaw: false,
    smartMergeTolerance: 20 // Default fallback
  });
  const [routine, setRoutine] = useState<StudentRoutine>({
    0: 180, 1: 180, 2: 180, 3: 180, 4: 180, 5: 180, 6: 180
  });

  // Initialization (Wrapped in useCallback to allow refresh)
  const init = useCallback(async () => {
      if (!currentUser) return;
      try {
        const [fetchedPlans, currentConfig] = await Promise.all([
          getStudentPlans(currentUser.uid),
          getStudentConfig(currentUser.uid)
        ]);

        setPlans(fetchedPlans);

        // Pre-fill if exists
        if (currentConfig && currentConfig.currentPlanId) {
          setSelectedPlanId(currentConfig.currentPlanId);
          setInitialPlanId(currentConfig.currentPlanId || null);
          setIsPlanPaused(currentConfig.isPlanPaused || false); // Sync Pause State
          
          if (currentConfig.studyProfile) {
             const profile = currentConfig.studyProfile;
             setStudyProfile({
               level: profile.level || 'intermediate',
               semiActiveClass: profile.semiActiveClass || false,
               semiActiveMaterial: profile.semiActiveMaterial || false,
               semiActiveLaw: profile.semiActiveLaw || false,
               smartMergeTolerance: profile.smartMergeTolerance || 20, // Load Saved Value
             });
          }
          if (currentConfig.routine) setRoutine(currentConfig.routine);
          if (currentConfig.savedRoutines) setSavedRoutines(currentConfig.savedRoutines);
          if (currentConfig.activeRoutineId) setActiveRoutineId(currentConfig.activeRoutineId);
        } else if (fetchedPlans.length > 0) {
          // Se não tem nada salvo ou ID vazio, seleciona o primeiro por padrão
          setSelectedPlanId(fetchedPlans[0].id!);
          if (currentConfig) {
             setIsPlanPaused(currentConfig.isPlanPaused || false);
             if (currentConfig.studyProfile) {
                const profile = currentConfig.studyProfile;
                setStudyProfile(prev => ({
                    ...prev,
                    level: profile.level || prev.level,
                    semiActiveClass: profile.semiActiveClass || false,
                    semiActiveMaterial: profile.semiActiveMaterial || false,
                    semiActiveLaw: profile.semiActiveLaw || false,
                    smartMergeTolerance: profile.smartMergeTolerance || 20,
                }));
             }
             if (currentConfig.routine) setRoutine(currentConfig.routine);
             if (currentConfig.savedRoutines) setSavedRoutines(currentConfig.savedRoutines);
             if (currentConfig.activeRoutineId) setActiveRoutineId(currentConfig.activeRoutineId);
          }
        }

      } catch (error) {
        console.error("Failed to load config", error);
      } finally {
        setLoading(false);
      }
  }, [currentUser]);

  useEffect(() => {
    init();
  }, [init]);

  // Handlers
  const handleRoutineChange = (dayId: number, minutes: number) => {
    setRoutine(prev => ({ ...prev, [dayId]: Math.max(0, minutes) }));
  };

  const handlePlannerSave = (newRoutine: Record<number, number>) => {
    setRoutine(newRoutine as any);
  };

  const calculateWeeklyHours = () => {
    const totalMinutes = (Object.values(routine) as number[]).reduce((acc, curr) => acc + curr, 0);
    return (totalMinutes / 60).toFixed(1);
  };

  const checkPlanChangeAndSave = () => {
    // Se o aluno já tinha um plano e agora selecionou um diferente
    if (initialPlanId && selectedPlanId && initialPlanId !== selectedPlanId) {
      setShowPlanChangeModal(true); // Levanta o aviso
    } else {
      handleSave(); // Fluxo normal, não houve troca
    }
  };

  const handleSave = async () => {
    if (!currentUser || !selectedPlanId) return;

    // NOVO: Verificação de bloqueio
    const selectedPlan = plans.find(p => p.id === selectedPlanId);
    if (selectedPlan?.isGenerationBlocked && !userData?.allowManualGeneration) {
        toast.error("O plano está em manutenção técnica. Geração bloqueada pelo administrador.", {
            icon: '🛠️',
            duration: 4000
        });
        return;
    }

    setSaving(true);
    setGeneratingMessage("Salvando preferências...");

    try {
      // 1. Save User Preferences
      await saveStudentRoutine(currentUser.uid, {
        currentPlanId: selectedPlanId,
        routine,
        studyProfile,
        savedRoutines,
        activeRoutineId
      });

      // 2. Generate Schedule (Includes Fetching & Saving)
      setGeneratingMessage("Gerando cronograma inteligente...");
      const schedule = await generateSchedule(currentUser.uid, selectedPlanId, studyProfile, routine);

      console.log("Schedule generated:", schedule.length, "items");

      // 3. Navigate
      navigate('/app/dashboard');

    } catch (error: any) {
      console.error("Save failed", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
      setGeneratingMessage("");
    }
  };

  // FAB Lock Logic
  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const isGenerationLocked = selectedPlan?.isGenerationBlocked && !userData?.allowManualGeneration;

  if (loading) return <Loading />;

  if (!userData?.activePlanId && !userData?.currentPlanId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
          <Lock size={40} className="text-zinc-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Nenhum Plano Ativo</h2>
          <p className="text-zinc-500 text-sm max-w-sm mx-auto">
            Você ainda não selecionou um plano para seguir. Acesse a área de planos para escolher um e liberar as configurações.
          </p>
        </div>
        <button 
          onClick={() => navigate('/app/dashboard/planos')}
          className="bg-brand-red text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
        >
          Ir para Seleção de Planos
        </button>
      </div>
    );
  }

  return (
    <div className="pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Planejador de Rotina</h1>
        <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest mt-1">
          Ajuste sua disponibilidade e preferências para o seu plano ativo.
        </p>
      </div>

      {/* SECTION 2: PLAN CONTROL */}
      {selectedPlanId && (
        <section className="mb-12">
            <PlanControlPanel 
                planId={selectedPlanId} 
                isPaused={isPlanPaused}
                onRefresh={init}
            />
        </section>
      )}

      <div className="w-full h-px bg-zinc-800 mb-10" />

      {/* SECTION 3: ROUTINE CONFIG */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* SUBSECTION A: STUDY LEVEL & MODES */}
        <div className="space-y-8">
          
          {/* LEVEL SELECTOR */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Zap size={14} /> Ritmo de Estudo
            </h3>

            <div className="space-y-3">
                {[
                { id: 'beginner', label: 'Iniciante', time: '5 min/pág', desc: 'Leitura detalhada e cuidadosa.' },
                { id: 'intermediate', label: 'Intermediário', time: '3 min/pág', desc: 'Ritmo constante e focado.' },
                { id: 'advanced', label: 'Avançado', time: '1 min/pág', desc: 'Leitura dinâmica e revisão.' },
                ].map((level) => {
                const isActive = studyProfile.level === level.id;
                return (
                    <div 
                    key={level.id}
                    onClick={() => setStudyProfile(prev => ({ ...prev, level: level.id as any }))}
                    className={`
                        flex items-center justify-between p-4 rounded-xl cursor-pointer border transition-all
                        ${isActive 
                        ? 'bg-zinc-900 border-brand-red shadow-[0_0_10px_rgba(220,38,38,0.2)]' 
                        : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900'}
                    `}
                    >
                    <div>
                        <h4 className={`text-sm font-black uppercase ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                        {level.label}
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{level.desc}</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isActive ? 'bg-brand-red text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                        {level.time}
                    </div>
                    </div>
                );
                })}
            </div>
          </div>

          {/* PREFERÊNCIAS DE AGENDAMENTO (SMART MERGE) */}
          <div className="space-y-4">
             <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} /> Preferências de Agendamento
             </h3>
             
             <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">Tolerância de Extensão</h4>
                        <p className="text-[10px] text-zinc-500 mt-1 max-w-[250px]">
                            Tempo máximo que você aceita estender para finalizar uma meta no mesmo dia, evitando quebras.
                        </p>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black text-brand-red tracking-tighter">
                            {studyProfile.smartMergeTolerance || 20}<span className="text-sm text-zinc-600">min</span>
                        </span>
                    </div>
                </div>

                <div className="pt-2">
                    <input 
                        type="range"
                        min="15"
                        max="60"
                        step="5"
                        value={studyProfile.smartMergeTolerance || 20}
                        onChange={(e) => setStudyProfile(prev => ({ ...prev, smartMergeTolerance: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-red hover:accent-red-500 transition-all"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-zinc-600 uppercase mt-2">
                        <span>15 min</span>
                        <span>30 min</span>
                        <span>45 min</span>
                        <span>60 min</span>
                    </div>
                </div>
             </div>
          </div>

          {/* SEMI-ACTIVE MODES (GRANULAR) */}
          <div className="space-y-4">
             <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <BookOpen size={14} /> Modos de Estudo Semiativo
             </h3>
             
             <div className="grid grid-cols-1 gap-3">
                
                {/* 1. Video Classes */}
                <div 
                    onClick={() => setStudyProfile(prev => ({ ...prev, semiActiveClass: !prev.semiActiveClass }))}
                    className={`
                        flex items-center justify-between p-4 rounded-xl cursor-pointer border transition-all
                        ${studyProfile.semiActiveClass 
                            ? 'bg-purple-900/20 border-purple-500/50' 
                            : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900'}
                    `}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${studyProfile.semiActiveClass ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                            <PlayCircle size={16} />
                        </div>
                        <div>
                            <h4 className={`text-sm font-black uppercase ${studyProfile.semiActiveClass ? 'text-purple-400' : 'text-zinc-400'}`}>
                                Semiativo em Aulas
                            </h4>
                            <p className="text-[10px] text-zinc-500 mt-0.5">Dobra tempo p/ anotações.</p>
                        </div>
                    </div>
                    
                    <div className={`
                        w-8 h-4 rounded-full relative transition-colors 
                        ${studyProfile.semiActiveClass ? 'bg-purple-500' : 'bg-zinc-700'}
                    `}>
                        <div className={`
                            absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200
                            ${studyProfile.semiActiveClass ? 'translate-x-4' : 'translate-x-0'}
                        `} />
                    </div>
                </div>

                {/* 2. Materials */}
                <div 
                    onClick={() => setStudyProfile(prev => ({ ...prev, semiActiveMaterial: !prev.semiActiveMaterial }))}
                    className={`
                        flex items-center justify-between p-4 rounded-xl cursor-pointer border transition-all
                        ${studyProfile.semiActiveMaterial 
                            ? 'bg-purple-900/20 border-purple-500/50' 
                            : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900'}
                    `}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${studyProfile.semiActiveMaterial ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                            <FileText size={16} />
                        </div>
                        <div>
                            <h4 className={`text-sm font-black uppercase ${studyProfile.semiActiveMaterial ? 'text-purple-400' : 'text-zinc-400'}`}>
                                Semiativo em Material
                            </h4>
                            <p className="text-[10px] text-zinc-500 mt-0.5">Dobra tempo p/ leitura atenta.</p>
                        </div>
                    </div>
                    
                    <div className={`
                        w-8 h-4 rounded-full relative transition-colors 
                        ${studyProfile.semiActiveMaterial ? 'bg-purple-500' : 'bg-zinc-700'}
                    `}>
                        <div className={`
                            absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200
                            ${studyProfile.semiActiveMaterial ? 'translate-x-4' : 'translate-x-0'}
                        `} />
                    </div>
                </div>

                {/* 3. Law */}
                <div 
                    onClick={() => setStudyProfile(prev => ({ ...prev, semiActiveLaw: !prev.semiActiveLaw }))}
                    className={`
                        flex items-center justify-between p-4 rounded-xl cursor-pointer border transition-all
                        ${studyProfile.semiActiveLaw 
                            ? 'bg-purple-900/20 border-purple-500/50' 
                            : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900'}
                    `}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${studyProfile.semiActiveLaw ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                            <Scale size={16} />
                        </div>
                        <div>
                            <h4 className={`text-sm font-black uppercase ${studyProfile.semiActiveLaw ? 'text-purple-400' : 'text-zinc-400'}`}>
                                Semiativo em Leis
                            </h4>
                            <p className="text-[10px] text-zinc-500 mt-0.5">Dobra tempo p/ letra da lei.</p>
                        </div>
                    </div>
                    
                    <div className={`
                        w-8 h-4 rounded-full relative transition-colors 
                        ${studyProfile.semiActiveLaw ? 'bg-purple-500' : 'bg-zinc-700'}
                    `}>
                        <div className={`
                            absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200
                            ${studyProfile.semiActiveLaw ? 'translate-x-4' : 'translate-x-0'}
                        `} />
                    </div>
                </div>

             </div>
          </div>

        </div>

        {/* SUBSECTION B: AVAILABILITY */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} /> Disponibilidade Diária
            </h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsPlannerOpen(true)}
                className="text-[10px] font-black text-brand-red bg-brand-red/10 px-3 py-1.5 rounded-lg border border-brand-red/20 hover:bg-brand-red/20 transition-all flex items-center gap-2 uppercase tracking-widest"
              >
                <CalendarClock size={14} /> Planejar Semana Visualmente
              </button>
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                Total: <span className="text-white">{calculateWeeklyHours()}h</span> / semana
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 space-y-2">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.id} className="flex items-center gap-4 group">
                <div className="w-24 text-[10px] font-bold text-zinc-500 uppercase group-hover:text-zinc-300 transition-colors">
                  {day.label}
                </div>
                <div className="flex-1 relative">
                  <input 
                    type="number"
                    min="0"
                    max="1440"
                    step="10"
                    value={routine[day.id]}
                    onChange={(e) => handleRoutineChange(day.id, parseInt(e.target.value) || 0)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-4 pr-12 text-sm text-white font-mono focus:border-brand-red focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] font-bold text-zinc-600 uppercase">min</span>
                </div>
                {/* Visual Bar Indicator */}
                <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden hidden sm:block">
                  <div 
                    className="h-full bg-brand-red transition-all duration-500"
                    style={{ width: `${Math.min((routine[day.id] / 300) * 100, 100)}%` }} // Max visual 5h
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent z-50 flex justify-center pointer-events-none">
        <button 
          onClick={checkPlanChangeAndSave}
          disabled={!selectedPlanId || saving || isGenerationLocked}
          className={`pointer-events-auto shadow-2xl text-white text-sm font-black uppercase tracking-widest py-4 px-10 rounded-full transition-all flex items-center gap-3 ${
            isGenerationLocked 
              ? 'bg-zinc-800 border border-zinc-700 cursor-not-allowed opacity-100 shadow-none' 
              : 'shadow-brand-red/40 bg-brand-red hover:bg-red-600 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
                <Loader2 size={18} className="animate-spin" /> {generatingMessage || 'Salvando...'}
            </>
          ) : isGenerationLocked ? (
            <>
              <Lock size={18} className="text-zinc-500" /> BLOQUEADO PELO ADMINISTRADOR - AGUARDE LIBERAÇÃO
            </>
          ) : (
            <>
              <CheckCircle size={18} /> Salvar e Gerar Cronograma
            </>
          )}
        </button>
      </div>

      {showPlanChangeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl">
            <h3 className="text-xl font-bold text-white">Alterar Plano de Estudos?</h3>
            <p className="text-gray-400 text-sm">
              Você está alterando seu plano de estudos. O plano atual será <strong className="text-yellow-500">PAUSADO</strong> (mantendo seu histórico e progresso) e um novo cronograma será gerado para o plano recém-selecionado.
            </p>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowPlanChangeModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition"
              >
                CANCELAR
              </button>
              <button
                onClick={() => {
                  setShowPlanChangeModal(false);
                  handleSave(); // Chama a função original que fará a limpeza e o agendamento
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition"
              >
                CONFIRMAR E GERAR
              </button>
            </div>
          </div>
        </div>
      )}

      <WeeklyPlannerModal 
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        onSave={handlePlannerSave}
        initialRoutines={savedRoutines}
        initialActiveRoutineId={activeRoutineId}
        onSaveTemplates={(templates, activeId) => {
          setSavedRoutines(templates);
          setActiveRoutineId(activeId);
        }}
      />

    </div>
  );
};

export default StudentConfigPage;
