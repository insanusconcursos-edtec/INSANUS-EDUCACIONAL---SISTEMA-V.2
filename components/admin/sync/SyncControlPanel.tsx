import React, { useState } from 'react';
import { 
  CheckCircle, 
  RefreshCw, 
  Loader2, 
  CloudUpload, 
  AlertTriangle 
} from 'lucide-react';
import { usePlanSync } from '../../../hooks/usePlanSync';

interface SyncControlPanelProps {
  planId: string;
  variant?: 'header' | 'minimal'; // Flexibilidade de design
}

const SyncControlPanel: React.FC<SyncControlPanelProps> = ({ planId, variant = 'header' }) => {
  const { 
    hasPendingChanges, 
    lastSynced, 
    publish, 
    publishing, 
    loading 
  } = usePlanSync(planId);

  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const handleSync = async () => {
    // Simulação de regra de negócio
    console.log("Verificando usuários ativos...");
    // Futuro: if (usersOnline > 0) alert("Existem alunos online...");

    await publish();
    
    // Feedback visual de sucesso
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 4000);
  };

  // 1. Estado de Carregamento Inicial (Verificando status...)
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <Loader2 size={14} className="animate-spin text-zinc-500" />
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          Verificando...
        </span>
      </div>
    );
  }

  // 2. Estado: Alterações Pendentes (Botão de Ação)
  if (hasPendingChanges) {
    return (
      <div className="flex items-center gap-3">
        {/* Aviso de não salvo (Opcional, apenas se houver espaço) */}
        {variant === 'header' && (
          <div className="hidden lg:flex items-center gap-2 text-amber-500/80 animate-pulse">
            <AlertTriangle size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Alterações não publicadas
            </span>
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={publishing}
          className={`
            relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg
            ${publishing 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700' 
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-95'
            }
          `}
        >
          {publishing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Sincronizando...</span>
            </>
          ) : (
            <>
              <RefreshCw size={14} className={publishing ? '' : 'animate-[spin_10s_linear_infinite]'} />
              <span>Sincronizar Alterações</span>
              {/* Badge indicativo */}
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black"></span>
            </>
          )}
        </button>
      </div>
    );
  }

  // 3. Estado: Sincronizado (Verde)
  return (
    <div className="flex items-center gap-3">
      {/* Toast de Sucesso Temporário */}
      {showSuccessToast && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 animate-in fade-in slide-in-from-right-4 duration-300">
          <CheckCircle size={12} />
          <span className="text-[10px] font-bold uppercase tracking-wide">Publicado com sucesso!</span>
        </div>
      )}

      {/* Status Permanente */}
      <div className={`
        flex items-center gap-3 px-4 py-2 rounded-xl border transition-all cursor-default group
        bg-zinc-950/80 border-zinc-800 hover:border-emerald-500/30
      `}>
        <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 blur-[6px] opacity-20 rounded-full"></div>
            <CheckCircle size={16} className="text-emerald-500 relative z-10" />
        </div>
        
        <div className="flex flex-col leading-none">
            <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest group-hover:text-white transition-colors">
                Plano Sincronizado
            </span>
            {lastSynced && (
                <span className="text-[9px] font-mono text-zinc-600 mt-1">
                    Última: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            )}
        </div>
      </div>
    </div>
  );
};

export default SyncControlPanel;