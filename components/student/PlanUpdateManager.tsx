
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { syncStudentPlan } from '../../services/syncService';
import { Student } from '../../services/userService';
import { RefreshCw, Zap, Loader2, Info, CalendarClock, ArrowRight } from 'lucide-react';
import { createPortal } from 'react-dom';

const PlanUpdateManager: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [totalMinutes, setTotalMinutes] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showRoutineRedirect, setShowRoutineRedirect] = useState(false);

  const [masterSync, setMasterSync] = useState<any>(null);
  const [userSync, setUserSync] = useState<any>(null);

  useEffect(() => {
    if (!currentUser) return;

    // 1. Monitorar Usuário para saber qual plano está ativo e qual a última sync dele
    const userUnsub = onSnapshot(doc(db, 'users', currentUser.uid), (userSnap) => {
      if (userSnap.exists()) {
        const userData = userSnap.data() as Student;
        const activePlanId = userData.activePlanId || userData.currentPlanId;
        
        if (activePlanId) {
          setCurrentPlanId(activePlanId);
          
          // Timestamp da última sync do USUÁRIO
          // @ts-expect-error - planStats might not be fully typed in userData
          const lastSync = userData.planStats?.[activePlanId]?.lastSyncedAt;
          setUserSync(lastSync);

          // Calcular total de minutos da rotina
          const routine = userData.routine || {};
          const total = Object.values(routine).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
          setTotalMinutes(total);
        }
      }
    });

    return () => userUnsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentPlanId) return;

    // 2. Monitorar o Plano Mestre para ver se há novas publicações
    const planUnsub = onSnapshot(doc(db, 'plans', currentPlanId), (planSnap) => {
      if (planSnap.exists()) {
        const planData = planSnap.data();
        setMasterSync(planData.lastSyncedAt);
      }
    });

    return () => planUnsub();
  }, [currentPlanId]);

  useEffect(() => {
    if (!masterSync) {
      setHasUpdate(false);
      setIsOpen(false);
      return;
    }

    // Helper to get millis from Timestamp or Date
    const getMillis = (val: any) => {
      if (!val) return 0;
      if (val.toMillis) return val.toMillis();
      if (val.seconds) return val.seconds * 1000;
      if (val instanceof Date) return val.getTime();
      try {
        return new Date(val).getTime() || 0;
      } catch {
        return 0;
      }
    };

    const masterMillis = getMillis(masterSync);
    const userMillis = getMillis(userSync);

    const isMentorshipRoute = (location.pathname.includes('/dashboard') && searchParams.get('tab') === 'mentorship') || 
                               location.pathname.includes('/mentoria') || 
                               location.pathname.includes('/mentorship');

    // REGRA DE SILENCIAMENTO COMPLETO (PRD 9.2)
    // Se o aluno estiver na aba de Mentoria OU não tiver carga horária configurada, 
    // ignoramos completamente qualquer alerta de sincronização pendente.
    if (isMentorshipRoute || totalMinutes === 0) {
      setHasUpdate(false);
      setIsOpen(false);
      setShowRoutineRedirect(false);
      return;
    }

    // Se o usuário nunca sincronizou, ou se o mestre é mais novo que o do usuário
    // Adicionamos uma margem de 1000ms para evitar falsos positivos por micro-diferenças de precisão
    const isOutdated = !userSync || (masterMillis > userMillis + 1000);
    
    if (isOutdated) {
      setHasUpdate(true);
      setIsOpen(true);
    } else {
      setHasUpdate(false);
      setIsOpen(false);
    }
  }, [masterSync, userSync, currentPlanId, location.pathname, searchParams, totalMinutes]);

  const handleSync = async () => {
    if (!currentUser || !currentPlanId) return;

    const isMentorshipRoute = (location.pathname.includes('/dashboard') && searchParams.get('tab') === 'mentorship') || 
                               location.pathname.includes('/mentoria') || 
                               location.pathname.includes('/mentorship');

    // Bloqueio preventivo redundante
    if (isMentorshipRoute || totalMinutes === 0) {
      console.log("🚫 [SyncService] Sincronização manual abortada: Aluno sem rotina ou na aba Mentoria.");
      return;
    }
    
    setIsSyncing(true);
    try {
      await syncStudentPlan(currentUser.uid, currentPlanId);
      // O listener acima irá detectar que os timestamps agora batem e fechará o modal automaticamente
      // Mas forçamos o close visualmente para feedback imediato
      setIsOpen(false);
      setHasUpdate(false);
    } catch (error: any) {
      console.error("Erro ao sincronizar:", error);
      
      const errorMessage = error?.message || "";
      if (errorMessage.includes("Sua rotina semanal não tem nenhum tempo disponível") || 
          errorMessage.includes("rotina") || 
          errorMessage.includes("tempo disponível")) {
        // Fluxo Amigável de Redirecionamento
        setIsOpen(false);
        setShowRoutineRedirect(true);
      } else {
        alert("Houve um erro ao atualizar seu plano. Tente novamente.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen && !showRoutineRedirect) return null;

  // Renderização do Modal de Redirecionamento (Rotina Vazia)
  if (showRoutineRedirect) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
        <div className="relative w-full max-w-md bg-zinc-950 border border-brand-red/30 rounded-3xl shadow-[0_0_80px_rgba(220,38,38,0.2)] p-8 overflow-hidden text-center">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-red to-red-400"></div>

          <div className="flex flex-col items-center gap-6 relative z-10">
            <div className="w-20 h-20 rounded-full bg-brand-red/10 border-2 border-brand-red/30 flex items-center justify-center text-brand-red">
              <CalendarClock size={40} />
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight">
                Monte sua Rotina Primeiro! 📅
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Para carregar suas metas personalizadas, precisamos saber seus horários disponíveis. Vamos montar sua rotina?
              </p>
            </div>

            <div className="w-full space-y-3">
               <button
                onClick={() => {
                  setShowRoutineRedirect(false);
                  navigate('/app/config');
                }}
                className="w-full py-4 bg-white text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-[0_4px_20px_rgba(255,255,255,0.2)] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
              >
                Configurar Horários <ArrowRight size={16} />
              </button>
              
              <button
                onClick={() => setShowRoutineRedirect(false)}
                className="w-full py-2 text-zinc-500 font-bold uppercase text-[10px] tracking-widest hover:text-zinc-300 transition-colors"
              >
                Fazer isso depois
              </button>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-brand-red/5 rounded-full blur-3xl"></div>
        </div>
      </div>,
      document.body
    );
  }

  if (!hasUpdate) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.2)] p-6 overflow-hidden">
        
        {/* Glow Effect */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 to-yellow-400"></div>

        <div className="flex flex-col items-center text-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 animate-pulse">
            <RefreshCw size={32} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">
              Atualização Disponível
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              O administrador realizou melhorias no seu plano de estudos (novas aulas, materiais ou ajustes).
            </p>
          </div>

          <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 w-full flex items-start gap-3 text-left">
             <Info size={16} className="text-zinc-500 mt-0.5 shrink-0" />
             <p className="text-[10px] text-zinc-500">
                Seu progresso atual (metas concluídas) será mantido. Apenas as metas futuras serão reorganizadas.
             </p>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full py-4 mt-2 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-black uppercase text-xs tracking-widest rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
          >
            {isSyncing ? (
                <>
                    <Loader2 size={16} className="animate-spin" /> Atualizando Cronograma...
                </>
            ) : (
                <>
                    <Zap size={16} fill="currentColor" /> Atualizar Agora
                </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PlanUpdateManager;
