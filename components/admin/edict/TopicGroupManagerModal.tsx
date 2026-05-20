import React, { useState } from 'react';
import { X, Folder, Trash2, Link, Save, Check } from 'lucide-react';
import { EdictDiscipline, EdictTopicGroup, saveEdictStructure, EdictStructure } from '../../../services/edictService';

interface TopicGroupManagerProps {
  planId: string;
  discipline: EdictDiscipline;
  structure: EdictStructure;
  onClose: () => void;
  onRefresh: (newStructure: EdictStructure) => void;
}

export const TopicGroupManagerModal: React.FC<TopicGroupManagerProps> = ({
  planId,
  discipline,
  structure,
  onClose,
  onRefresh
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  
  // Link Modal State
  const [linkingGroup, setLinkingGroup] = useState<EdictTopicGroup | null>(null);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup: EdictTopicGroup = {
      id: `tg-${Date.now()}`,
      name: newGroupName,
      order: (discipline.topicGroups || []).length + 1
    };

    const updatedGroups = [...(discipline.topicGroups || []), newGroup];
    
    try {
      const newStructure: EdictStructure = {
        ...structure,
        disciplines: structure.disciplines.map(d => 
          d.id === discipline.id ? { ...d, topicGroups: updatedGroups } : d
        )
      };
      await saveEdictStructure(planId, newStructure);
      setNewGroupName('');
      onRefresh(newStructure);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const updatedGroups = (discipline.topicGroups || []).filter(g => g.id !== groupId);
    
    try {
      const newStructure: EdictStructure = {
        ...structure,
        disciplines: structure.disciplines.map(d => 
          d.id === discipline.id ? {
            ...d, 
            topicGroups: updatedGroups,
            topics: d.topics.map(t => t.groupId === groupId ? { ...t, groupId: null } : t)
          } : d
        )
      };
      await saveEdictStructure(planId, newStructure);
      onRefresh(newStructure);
    } catch (error) {
      console.error(error);
    }
  };

  const openLinkModal = (group: EdictTopicGroup) => {
    setLinkingGroup(group);
    const existingIds = discipline.topics.filter(t => t.groupId === group.id).map(t => t.id!);
    setSelectedTopicIds(new Set(existingIds));
  };

  const handleToggleTopic = (topicId: string) => {
    const next = new Set(selectedTopicIds);
    if (next.has(topicId)) next.delete(topicId);
    else next.add(topicId);
    setSelectedTopicIds(next);
  };

  const handleSaveLinks = async () => {
    if (!linkingGroup) return;
    
    try {
      const newStructure: EdictStructure = {
        ...structure,
        disciplines: structure.disciplines.map(d => 
          d.id === discipline.id ? {
            ...d,
            topics: d.topics.map(t => {
              if (selectedTopicIds.has(t.id!)) {
                return { ...t, groupId: linkingGroup.id };
              } else if (t.groupId === linkingGroup.id) {
                return { ...t, groupId: null };
              }
              return t;
            })
          } : d
        )
      };
      await saveEdictStructure(planId, newStructure);
      onRefresh(newStructure);
      setLinkingGroup(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[110] p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-red/10 rounded-lg text-brand-red">
              <Folder size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Gerenciar Pastas</h2>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{discipline.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {linkingGroup ? (
          /* Linker View */
          <div className="flex-1 overflow-hidden flex flex-col p-6">
            <div className="mb-4">
              <h3 className="text-lg font-black text-white">Vincular Tópicos a &quot;{linkingGroup.name}&quot;</h3>
              <p className="text-xs text-zinc-400">Selecione os tópicos que pertencem a esta pasta.</p>
            </div>
            <div className="flex-1 overflow-y-auto bg-zinc-900/50 rounded-xl border border-zinc-800 p-2 space-y-1">
              {discipline.topics.map(topic => (
                <label key={topic.id} className="flex items-center gap-3 cursor-pointer p-3 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700">
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedTopicIds.has(topic.id!) ? 'bg-brand-red border-brand-red' : 'bg-zinc-950 border-zinc-700'}`} onClick={() => handleToggleTopic(topic.id!)}>
                    {selectedTopicIds.has(topic.id!) && <Check size={14} className="text-white" />}
                  </div>
                  <span className="text-sm font-bold text-zinc-300 pointer-events-none" onClick={() => handleToggleTopic(topic.id!)}>{topic.name}</span>
                  {topic.groupId && topic.groupId !== linkingGroup.id && (
                    <span className="ml-auto text-[10px] text-zinc-500 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 pointer-events-none">
                      Já na pasta: {(discipline.topicGroups || []).find(g => g.id === topic.groupId)?.name}
                    </span>
                  )}
                </label>
              ))}
              {discipline.topics.length === 0 && <p className="text-center text-zinc-500 text-sm py-10">Nenhum tópico nesta disciplina.</p>}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setLinkingGroup(null)}
                className="px-6 py-2 rounded-xl text-zinc-400 font-bold text-sm hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveLinks}
                className="px-6 py-2 rounded-xl bg-brand-red text-white font-black text-sm hover:bg-red-600 transition-colors flex items-center gap-2"
              >
                <Save size={16} /> Salvar Vínculos
              </button>
            </div>
          </div>
        ) : (
          /* Folders Manager View */
          <div className="flex-1 overflow-hidden flex flex-col">
            <form onSubmit={handleAddGroup} className="p-6 border-b border-zinc-800 bg-zinc-950/50">
              <div className="flex gap-3">
                <input 
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Nome da nova pasta..."
                  autoFocus
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-brand-red"
                />
                <button 
                  type="submit"
                  disabled={!newGroupName.trim()}
                  className="px-6 bg-brand-red text-white rounded-xl font-black text-xs hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  Criar Pasta
                </button>
              </div>
            </form>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {(discipline.topicGroups || []).map(group => {
                const count = discipline.topics.filter(t => t.groupId === group.id).length;
                return (
                  <div key={group.id} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-800 rounded-lg">
                        <Folder size={16} className="text-zinc-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">{group.name}</h4>
                        <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">{count} tópicos vinculados</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openLinkModal(group)}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-brand-red text-zinc-400 hover:text-white rounded-lg text-xs font-black transition-colors"
                      >
                        <Link size={14} /> Vincular Tópicos
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-2 bg-zinc-950 border border-zinc-800 hover:border-red-500 text-zinc-600 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {!(discipline.topicGroups || []).length && (
                <div className="text-center py-10">
                  <Folder size={40} className="mx-auto text-zinc-800 mb-3" />
                  <p className="text-zinc-500 font-bold text-sm">Nenhuma pasta criada nesta disciplina.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
