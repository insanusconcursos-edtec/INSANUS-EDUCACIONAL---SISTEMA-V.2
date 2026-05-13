import React, { useState, useEffect } from 'react';
import { 
  X, Check, PlayCircle, FileText, ListChecks, Book, Edit3, RefreshCw, Link as LinkIcon, ChevronDown, ChevronRight, Folder 
} from 'lucide-react';
import { Meta, MetaType } from '../../../services/metaService';
import { Discipline, Topic } from '../../../services/structureService';

interface GoalSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedGoals: { id: string, type: MetaType }[]) => void;
  
  // Data for Hierarchy
  planStructure: {
    discipline: Discipline;
    topics: {
      topic: Topic;
      metas: Meta[];
    }[];
  }[];
  
  globalLinkedIds: Set<string>; // ID Blocklist
  title: string;
}

const GoalSelectorModal: React.FC<GoalSelectorModalProps> = ({ 
  isOpen, onClose, onSave, planStructure, globalLinkedIds, title 
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set());
  
  // Filtered Structure State (Calculated on Open)
  const [availableStructure, setAvailableStructure] = useState<typeof planStructure>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      
      // Calculate available structure (Filtering out used goals)
      const filtered = planStructure.map(group => {
        const validTopics = group.topics.map(tGroup => {
          const validMetas = tGroup.metas.filter(m => m.id && !globalLinkedIds.has(m.id));
          return { ...tGroup, metas: validMetas };
        }).filter(tGroup => tGroup.metas.length > 0); // Remove empty topics

        return { ...group, topics: validTopics };
      }).filter(group => group.topics.length > 0); // Remove empty disciplines

      setAvailableStructure(filtered);
      
      // Auto-expand first discipline if exists
      if (filtered.length > 0 && filtered[0].discipline.id) {
        setExpandedDisciplines(new Set([filtered[0].discipline.id]));
      }
    }
  }, [isOpen, planStructure, globalLinkedIds]);

  const toggleSelection = (meta: Meta) => {
    if (!meta.id) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(meta.id)) {
      newSet.delete(meta.id);
    } else {
      newSet.add(meta.id);
    }
    setSelectedIds(newSet);
  };

  const toggleDiscipline = (id: string) => {
    const newSet = new Set(expandedDisciplines);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedDisciplines(newSet);
  };

  const handleConfirm = () => {
    // Collect selected meta objects (ID + Type)
    const selection: { id: string, type: MetaType }[] = [];
    
    availableStructure.forEach(d => {
      d.topics.forEach(t => {
        t.metas.forEach(m => {
          if (m.id && selectedIds.has(m.id)) {
            selection.push({ id: m.id, type: m.type });
          }
        });
      });
    });
    
    onSave(selection);
    onClose();
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'lesson': return <PlayCircle size={14} className="text-blue-500" />;
      case 'material': return <FileText size={14} className="text-orange-500" />;
      case 'questions': return <ListChecks size={14} className="text-green-500" />;
      case 'law': return <Book size={14} className="text-yellow-500" />;
      case 'summary': return <Edit3 size={14} className="text-purple-500" />;
      case 'review': return <RefreshCw size={14} className="text-pink-500" />;
      default: return <FileText size={14} />;
    }
  };

  const getMetaLabel = (meta: Meta) => {
    const typeLabels: Record<string, string> = { 
        lesson: 'Aula', material: 'Material', questions: 'Questões', 
        law: 'Lei Seca', summary: 'Resumo', review: 'Flashcard' 
    };
    return `${typeLabels[meta.type]}: ${meta.title}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={onClose}>
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]" onMouseDown={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 bg-zinc-900/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
              <LinkIcon size={18} className="text-brand-red" /> Vincular Metas
            </h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
              Destino: <span className="text-zinc-300">{title}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Hierarchical List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
          {availableStructure.length === 0 ? (
            <div className="text-center py-20 opacity-50">
              <Folder size={40} className="mx-auto text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500 uppercase font-bold">Nenhuma meta disponível.</p>
              <p className="text-[10px] text-zinc-600 mt-1">Todas as metas do plano já foram vinculadas ou não existem.</p>
            </div>
          ) : (
            availableStructure.map((group) => {
              const isExpanded = expandedDisciplines.has(group.discipline.id!);
              return (
                <div key={group.discipline.id} className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                  {/* Discipline Header */}
                  <div 
                    onClick={() => toggleDiscipline(group.discipline.id!)}
                    className="flex items-center gap-2 p-3 bg-zinc-900/50 cursor-pointer hover:bg-zinc-900 transition-colors"
                  >
                    <div className="text-zinc-500">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    <span className="text-xs font-black text-zinc-200 uppercase tracking-wide">
                      {group.discipline.name}
                    </span>
                    <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1.5 rounded ml-auto">
                      {group.topics.reduce((acc, t) => acc + t.metas.length, 0)} metas
                    </span>
                  </div>

                  {/* Topics & Metas */}
                  {isExpanded && (
                    <div className="p-2 space-y-3 bg-zinc-950/30">
                      {group.topics.map((tGroup) => (
                        <div key={tGroup.topic.id} className="ml-4 pl-4 border-l border-zinc-800 border-dashed">
                          <h4 className="text-[10px] font-bold text-brand-red uppercase tracking-wider mb-2 flex items-center gap-2">
                            <div className="w-1 h-1 bg-brand-red rounded-full"></div>
                            {tGroup.topic.name}
                          </h4>
                          
                          <div className="space-y-1">
                            {tGroup.metas.map(meta => {
                              const isSelected = selectedIds.has(meta.id!);
                              return (
                                <div 
                                  key={meta.id}
                                  onClick={() => toggleSelection(meta)}
                                  className={`
                                    flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all
                                    ${isSelected 
                                      ? 'bg-zinc-900 border-brand-red/50 text-white shadow-sm' 
                                      : 'bg-transparent border-transparent hover:bg-zinc-900 hover:border-zinc-800 text-zinc-400'}
                                  `}
                                >
                                  <div className={`
                                    w-4 h-4 rounded border flex items-center justify-center transition-colors
                                    ${isSelected ? 'bg-brand-red border-brand-red text-white' : 'border-zinc-700 bg-zinc-950'}
                                  `}>
                                    {isSelected && <Check size={10} strokeWidth={4} />}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    {getIcon(meta.type)}
                                    <span className="text-xs font-medium truncate">{getMetaLabel(meta)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-900 bg-zinc-900/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest"
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="px-6 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Vincular ({selectedIds.size})
          </button>
        </div>

      </div>
    </div>
  );
};

export default GoalSelectorModal;