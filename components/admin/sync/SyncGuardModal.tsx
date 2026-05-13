import React, { useState } from 'react';
import { AlertTriangle, Loader2, CloudUpload, LogOut } from 'lucide-react';

interface SyncGuardModalProps {
  isOpen: boolean;
  onCancel: () => void; // Stay on page
  onExit: () => void;   // Exit without syncing
  onSyncAndExit: () => Promise<void>; // Sync then exit
}

const SyncGuardModal: React.FC<SyncGuardModalProps> = ({ 
  isOpen, onCancel, onExit, onSyncAndExit 
}) => {
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncAndExit();
    } catch (error) {
      console.error("Sync failed", error);
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={(e) => e.stopPropagation()}>
      <div className="relative w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        
        <div className="flex flex-col items-center text-center gap-4">
          <div className="p-3 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle size={32} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">
              Alterações Pendentes
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Você fez alterações que ainda estão como <strong>Rascunho</strong>. 
              Se sair agora, os alunos não verão as atualizações até que você sincronize manualmente.
            </p>
          </div>

          <div className="flex flex-col w-full gap-3 mt-4">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-widest rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              {isSyncing ? (
                <><Loader2 size={16} className="animate-spin" /> Sincronizando e Saindo...</>
              ) : (
                <><CloudUpload size={16} /> Sincronizar Agora</>
              )}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onExit}
                disabled={isSyncing}
                className="py-3 bg-zinc-900 hover:bg-red-900/20 border border-zinc-800 hover:border-red-900/50 text-zinc-400 hover:text-red-400 font-bold uppercase text-[10px] tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={14} /> Sair Sem Sincronizar
              </button>
              
              <button
                onClick={onCancel}
                disabled={isSyncing}
                className="py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl transition-all"
              >
                Cancelar (Ficar)
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SyncGuardModal;