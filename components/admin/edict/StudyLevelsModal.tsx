import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2 } from 'lucide-react';
import { EdictStudyLevel } from '../../../services/edictService';

interface StudyLevelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  levels: EdictStudyLevel[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
}

const StudyLevelsModal: React.FC<StudyLevelsModalProps> = ({
  isOpen,
  onClose,
  levels,
  onAdd,
  onDelete
}) => {
  const [newLevelName, setNewLevelName] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newLevelName.trim()) {
      onAdd(newLevelName);
      setNewLevelName('');
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={onClose}>
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]" onMouseDown={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 bg-zinc-900/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
              <BarChart2 size={18} className="text-brand-red" /> Níveis de Estudo
            </h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
              Classifique os tópicos do edital
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          
          {/* Add Form */}
          <div className="flex gap-2 mb-6">
            <input 
              value={newLevelName}
              onChange={(e) => setNewLevelName(e.target.value)}
              placeholder="Ex: NÍVEL 1 - INICIANTE"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-700 uppercase font-bold focus:outline-none focus:border-brand-red transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button 
              onClick={handleAdd}
              disabled={!newLevelName.trim()}
              className="bg-zinc-800 hover:bg-brand-red text-white p-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {levels.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-xl">
                <span className="text-[10px] uppercase font-bold">Nenhum nível cadastrado</span>
              </div>
            ) : (
              levels.map((level, index) => (
                <div key={level.id} className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-zinc-600 w-4">{index + 1}.</span>
                    <span className="text-xs font-bold text-zinc-300 uppercase">{level.name}</span>
                  </div>
                  <button 
                    onClick={() => onDelete(level.id)}
                    className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default StudyLevelsModal;