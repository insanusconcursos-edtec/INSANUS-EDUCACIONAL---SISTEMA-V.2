
import React from 'react';
import { Target, Check } from 'lucide-react';
import { Meta } from '../../../../services/metaService';

interface ReferenceSelectProps {
  availableMetas: Meta[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const ReferenceSelect: React.FC<ReferenceSelectProps> = ({ availableMetas, selectedIds, onChange }) => {
  
  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(s => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (availableMetas.length === 0) {
    return (
        <div className="p-3 bg-zinc-900/30 border border-zinc-800/50 rounded-lg text-center">
            <p className="text-[10px] text-zinc-600 font-bold uppercase">Nenhuma outra meta cadastrada neste tópico.</p>
        </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          <Target size={14} className="text-purple-500"/> Referências (Outras Metas)
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
        {availableMetas.map(meta => {
            const isSelected = selectedIds.includes(meta.id!);
            return (
                <div 
                    key={meta.id}
                    onClick={() => toggleSelection(meta.id!)}
                    className={`
                        cursor-pointer flex items-center justify-between p-2 rounded-lg border text-xs font-bold uppercase transition-all
                        ${isSelected 
                            ? 'bg-purple-900/20 border-purple-500/50 text-white' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}
                    `}
                >
                    <span className="truncate">{meta.title}</span>
                    {isSelected && <Check size={12} className="text-purple-500" />}
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default ReferenceSelect;
