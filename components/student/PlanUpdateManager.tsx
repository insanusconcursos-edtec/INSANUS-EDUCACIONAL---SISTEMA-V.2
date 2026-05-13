
import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { syncStudentPlan } from '../../services/syncService';
import { Student } from '../../services/userService';
import { RefreshCw, Zap, Loader2, Info } from 'lucide-react';
import { createPortal } from 'react-dom';

const PlanUpdateManager: React.FC = () => {
  const { currentUser } = useAuth();
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [masterSync, setMasterSync] = useState<any>(null);
  const [userSync, setUserSync] = useState<any>(null);

  useEffect(() => {
    if (!currentUser) return;

    // 1. Monitorar Usuário para saber qual plano está ativo e qual a última sync dele
    const userUnsub = onSnapshot(doc(db, 'users', currentUser.uid), (userSnap) => {
      if (userSnap.exists()) {
        const userData = userSnap.data() as Student & { currentPlanId?: string };
        const activePlanId = userData.currentPlanId;
        
        if (activePlanId) {
          setCurrentPlanId(activePlanId);
          
          // Timestamp da última sync do USUÁRIO
          // @ts-expect-error - planStats might not be fully typed in userData
          const lastSync = userData.planStats?.[activePlanId]?.lastSyncedAt;
          setUserSync(lastSync);
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

    // Se o usuário nunca sincronizou, ou se o mestre é mais novo que o do usuário
    // Adicionamos uma margem de 1000ms para evitar falsos positivos por micro-diferenças de precisão
    const isOutdated = !userSync || (masterMillis > userMillis + 1000);
    
    console.log(`[PlanUpdateManager] Checking update for ${currentPlanId}:`, {
      master: masterMillis,
      user: userMillis,
      isOutdated,
      masterDate: new Date(masterMillis).toISOString(),
      userDate: userMillis > 0 ? new Date(userMillis).toISOString() : 'NEVER'
    });

    if (isOutdated) {
      setHasUpdate(true);
      setIsOpen(true);
    } else {
      setHasUpdate(false);
      setIsOpen(false);
    }
  }, [masterSync, userSync, currentPlanId]);

  const handleSync = async () => {
    if (!currentUser || !currentPlanId) return;
    
    setIsSyncing(true);
    try {
      await syncStudentPlan(currentUser.uid, currentPlanId);
      // O listener acima irá detectar que os timestamps agora batem e fechará o modal automaticamente
      // Mas forçamos o close visualmente para feedback imediato
      setIsOpen(false);
      setHasUpdate(false);
      
      // Opcional: Recarregar a página para garantir que caches de query sejam limpos, 
      // ou confiar na reatividade do React se os componentes estiverem ouvindo o banco.
      // window.location.reload(); 
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      alert("Houve um erro ao atualizar seu plano. Tente novamente.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen || !hasUpdate) return null;

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
