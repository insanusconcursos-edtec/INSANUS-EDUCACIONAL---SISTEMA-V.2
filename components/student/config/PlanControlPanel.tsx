
import React, { useState, useEffect } from 'react';
import { 
  Pause, Play, RotateCcw, CalendarClock, AlertTriangle, Loader2, CheckCircle2 
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { togglePlanPause, resetPlanStats, resetUnlockedSimulados } from '../../../services/studentService';
import { resetStudentSchedule, generateSchedule } from '../../../services/scheduleService';
import { editalProgressService } from '../../../services/editalProgressService';
import { courseReviewService } from '../../../services/courseReviewService';
import { getStudentConfig } from '../../../services/studentService';
import ConfirmationModal from '../../ui/ConfirmationModal';

interface PlanControlPanelProps {
  planId: string;
  isPaused: boolean;
  onRefresh: () => void;
}

const PlanControlPanel: React.FC<PlanControlPanelProps> = ({ planId, isPaused, onRefresh }) => {
  const { currentUser } = useAuth();
  
  // Loading States
  const [isPausing, setIsPausing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Modal States
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Handlers
  const handleTogglePause = async () => {
    if (!currentUser) return;
    setIsPausing(true);
    try {
      await togglePlanPause(currentUser.uid, !isPaused);
      onRefresh(); // Refresh parent state
    } catch (error) {
      console.error(error);
      alert("Erro ao alterar status do plano.");
    } finally {
      setIsPausing(false);
    }
  };

  const handleReset = async () => {
    if (!currentUser) return;
    setIsResetting(true);
    try {
        // 1. Wipe Schedule
        await resetStudentSchedule(currentUser.uid, planId);
        
        // 2. Reset Stats
        await resetPlanStats(currentUser.uid, planId);

        // 3. Reset Edital Progress (Visual Checks)
        await editalProgressService.resetEditalProgress(currentUser.uid, planId);

        // 4. Reset Unlocked Simulados
        await resetUnlockedSimulados(currentUser.uid, planId);

        // 5. Delete Spaced Reviews
        await courseReviewService.deleteReviewsByPlan(currentUser.uid, planId);

        // 6. Regenerate
        const config = await getStudentConfig(currentUser.uid);
        if (config) {
            await generateSchedule(currentUser.uid, planId, config.studyProfile, config.routine);
        }
        
        // 5. Unpause if paused
        if (isPaused) {
            await togglePlanPause(currentUser.uid, false);
        }

        onRefresh();
        setResetModalOpen(false);
    } catch (error) {
        console.error(error);
        alert("Erro ao reiniciar o plano.");
    } finally {
        setIsResetting(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
        <RotateCcw size={14} /> Controle do Plano
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* BUTTON A: PAUSE */}
        <button
          onClick={handleTogglePause}
          disabled={isPausing}
          className={`
            relative overflow-hidden group p-4 rounded-xl border transition-all text-left flex flex-col justify-between h-28
            ${isPaused 
                ? 'bg-emerald-900/20 border-emerald-500/50 hover:bg-emerald-900/40' 
                : 'bg-yellow-900/20 border-yellow-500/50 hover:bg-yellow-900/40'}
          `}
        >
          <div className={`p-2 rounded-lg w-fit ${isPaused ? 'bg-emerald-500 text-black' : 'bg-yellow-500 text-black'}`}>
             {isPausing ? <Loader2 size={20} className="animate-spin" /> : isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
          </div>
          <div>
             <h4 className={`text-sm font-black uppercase ${isPaused ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {isPaused ? 'Retomar Estudos' : 'Pausar Plano'}
             </h4>
             <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                {isPaused ? 'Voltar a receber metas diárias.' : 'Congelar cronograma temporariamente.'}
             </p>
          </div>
        </button>

        {/* BUTTON C: RESET */}
        <button
          onClick={() => setResetModalOpen(true)}
          disabled={isResetting}
          className="relative overflow-hidden group p-4 rounded-xl border border-red-500/50 bg-red-900/20 hover:bg-red-900/40 transition-all text-left flex flex-col justify-between h-28"
        >
          <div className="p-2 rounded-lg bg-red-500 text-white w-fit">
             <AlertTriangle size={20} />
          </div>
          <div>
             <h4 className="text-sm font-black text-red-400 uppercase">
                Reiniciar Plano
             </h4>
             <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                Apagar progresso e começar do zero.
             </p>
          </div>
        </button>

      </div>

      <ConfirmationModal 
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleReset}
        title="Reiniciar Plano?"
        message="TEM CERTEZA? Todo o seu progresso será perdido, metas concluídas serão apagadas e o cronograma voltará ao dia 1. Essa ação é irreversível."
        confirmText="Sim, Reiniciar"
        variant="danger"
        isLoading={isResetting}
      />
    </div>
  );
};

export default PlanControlPanel;
