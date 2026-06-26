import React, { useState } from 'react';
import { CourseModule } from '../../../../types/course';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface MigrateModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceModule: CourseModule | null;
  availableModules: CourseModule[];
  onConfirm: (targetModuleId: string) => Promise<void>;
}

export function MigrateModuleModal({ isOpen, onClose, sourceModule, availableModules, onConfirm }: MigrateModuleModalProps) {
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !sourceModule) return null;

  // Filtra o módulo atual da lista de destinos
  const targets = availableModules.filter(m => m.id !== sourceModule.id);

  const handleConfirm = async () => {
    if (!selectedTargetId) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedTargetId);
      onClose();
    } catch (error) {
      console.error("Erro na migração:", error);
    } finally {
      setIsSubmitting(false);
      setSelectedTargetId('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121418] border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 bg-zinc-900/50">
          <div className="flex items-center gap-3 text-orange-500 mb-2">
            <AlertTriangle size={24} />
            <h3 className="text-xl font-black uppercase tracking-tight text-white">Migrar Disciplina</h3>
          </div>
          <p className="text-gray-400 text-sm">
            Você está movendo todo o conteúdo de <span className="text-white font-bold">"{sourceModule.title}"</span> para dentro de outra disciplina.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Selecione a Disciplina de Destino</label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-red-600 outline-none transition-all cursor-pointer"
            >
              <option value="">Escolha uma disciplina...</option>
              {targets.map(m => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 space-y-2">
            <h4 className="text-orange-500 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={14} /> O que vai acontecer?
            </h4>
            <ul className="text-[11px] text-gray-400 space-y-1 list-disc list-inside">
              <li>A estrutura de pastas e aulas será movida.</li>
              <li>A disciplina de origem será removida.</li>
              <li>O conteúdo aparecerá como um <span className="text-white font-bold">GRUPO</span> no destino.</li>
            </ul>
          </div>

          <div className="flex items-center justify-center py-2 text-gray-500">
            <div className="px-3 py-1 bg-zinc-900 rounded-full text-[10px] font-bold uppercase tracking-tighter flex items-center gap-2 border border-gray-800">
              {sourceModule.title} <ArrowRight size={12} className="text-red-500" /> {targets.find(t => t.id === selectedTargetId)?.title || '...'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900/50 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-gray-400 hover:text-white font-bold uppercase text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTargetId || isSubmitting}
            className="flex-[2] py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase text-xs rounded-lg shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              'Confirmar Migração'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
