
import React, { useState } from 'react';
import { Plus, Trash2, ArrowLeft, Target, ChevronUp, ChevronDown, ChevronRight, Edit2, Check, X, FolderKanban, Folder, Link } from 'lucide-react';
import { Topic, Discipline, touchPlan, TopicGroup, updateDisciplineTopicGroups, batchUpdateTopicGroup } from '../../../services/structureService';
import { useParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

interface TopicListProps {
  topics: Topic[];
  activeDiscipline: Discipline | null;
  loading: boolean;
  onAdd: (name: string) => void;
  onDeleteRequest: (topic: Topic) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onSelectTopic: (topic: Topic) => void;
  onUpdateTopic: (id: string, name: string) => void;
  onRefresh: () => void;
}

const TopicList: React.FC<TopicListProps> = ({ 
  topics, 
  activeDiscipline, 
  loading,
  onAdd, 
  onDeleteRequest,
  onMove,
  onSelectTopic,
  onUpdateTopic,
  onRefresh
}) => {
  const { planId } = useParams<{ planId: string }>();
  const [newTopicName, setNewTopicName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  
  // Group Create State
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  
  // Link Modal State
  const [linkingGroup, setLinkingGroup] = useState<TopicGroup | null>(null);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    onAdd(newTopicName);
    setNewTopicName('');
  };

  const handleUpdateTopicTitle = async (topicId: string) => {
    if (!planId || !activeDiscipline?.id || !editTitle.trim()) return;
    
    try {
      const topicRef = doc(db, 'plans', planId, 'disciplines', activeDiscipline.id, 'topics', topicId);
      await updateDoc(topicRef, { name: editTitle });
      
      await touchPlan(planId);
      
      onUpdateTopic(topicId, editTitle);
      setEditingTopicId(null);
    } catch (error) {
      console.error("Error updating topic title", error);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !planId || !activeDiscipline?.id) return;
    
    const newGroup: TopicGroup = {
      id: `tg-${Date.now()}`,
      name: newGroupName,
      order: (activeDiscipline.topicGroups || []).length + 1
    };

    const updatedGroups = [...(activeDiscipline.topicGroups || []), newGroup];
    try {
      await updateDisciplineTopicGroups(planId, activeDiscipline.id, updatedGroups);
      setNewGroupName('');
      setIsCreatingGroup(false);
      onRefresh();
    } catch (error) {
      console.error(error);
    }
  };
  
  const handleDeleteGroup = async (groupId: string) => {
    if (!planId || !activeDiscipline?.id) return;
    
    const updatedGroups = (activeDiscipline.topicGroups || []).filter(g => g.id !== groupId);
    try {
      await updateDisciplineTopicGroups(planId, activeDiscipline.id, updatedGroups);
      // Untie topics
      const updates = topics.filter(t => t.groupId === groupId).map(t => ({
        topicId: t.id!,
        groupId: null
      }));
      if (updates.length > 0) {
        await batchUpdateTopicGroup(planId, activeDiscipline.id, updates);
      }
      onRefresh();
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenLinkModal = (group: TopicGroup) => {
    setLinkingGroup(group);
    const existingIds = topics.filter(t => t.groupId === group.id).map(t => t.id!);
    setSelectedTopicIds(new Set(existingIds));
  };
  
  const handleSaveLinks = async () => {
    if (!linkingGroup || !planId || !activeDiscipline?.id) return;
    
    const updates: {topicId: string; groupId: string | null}[] = [];
    topics.forEach(t => {
      const isSelected = selectedTopicIds.has(t.id!);
      const wasSelected = t.groupId === linkingGroup.id;
      if (isSelected && !wasSelected) updates.push({ topicId: t.id!, groupId: linkingGroup.id });
      else if (!isSelected && wasSelected) updates.push({ topicId: t.id!, groupId: null });
    });

    try {
      if (updates.length > 0) {
        await batchUpdateTopicGroup(planId, activeDiscipline.id, updates);
        onRefresh();
      }
      setLinkingGroup(null);
    } catch (error) {
      console.error(error);
    }
  };

  if (!activeDiscipline) {
    return (
        <div className="h-full bg-zinc-900/20 border border-zinc-800/50 rounded-2xl flex flex-col items-center justify-center p-10 text-center dashed-border">
            <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-700">
                <ArrowLeft size={24} className="animate-pulse" />
            </div>
            <h3 className="text-lg font-black text-zinc-600 tracking-tighter">Selecione uma Disciplina</h3>
            <p className="text-zinc-700 text-xs mt-2 tracking-widest">Para gerenciar seus assuntos e tópicos</p>
        </div>
    );
  }

  const topicGroups = activeDiscipline.topicGroups || [];
  const groupedTopics: Record<string, Topic[]> = { unassigned: [] };
  topicGroups.forEach(g => groupedTopics[g.id] = []);
  topics.forEach(t => {
    if (t.groupId && groupedTopics[t.groupId]) groupedTopics[t.groupId].push(t);
    else groupedTopics.unassigned.push(t);
  });

  const renderTopicItem = (topic: Topic, index: number, isGrouped: boolean = false) => (
    <div 
        key={topic.id}
        onClick={() => !editingTopicId && onSelectTopic(topic)}
        className={`group bg-zinc-950 border border-zinc-800 hover:border-brand-red/50 hover:bg-zinc-900 p-4 rounded-xl flex items-center justify-between transition-all hover:translate-x-1 cursor-pointer ${editingTopicId === topic.id ? 'border-brand-red bg-zinc-900' : ''}`}
    >
        <div className="flex items-center gap-4 flex-1">
            <span className="text-zinc-600 font-mono text-xs">{(index + 1).toString().padStart(2, '0')}</span>
            {editingTopicId === topic.id ? (
                <div className="flex-1 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <input 
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1 text-xs font-bold text-white focus:outline-none focus:border-brand-red"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateTopicTitle(topic.id!);
                            if (e.key === 'Escape') setEditingTopicId(null);
                        }}
                    />
                    <button 
                        onClick={() => handleUpdateTopicTitle(topic.id!)}
                        className="p-1.5 bg-green-600/20 text-green-500 rounded hover:bg-green-600 hover:text-white transition-all"
                    >
                        <Check size={14} />
                    </button>
                    <button 
                        onClick={() => setEditingTopicId(null)}
                        className="p-1.5 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 hover:text-white transition-all"
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : (
                <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">{topic.name}</span>
            )}
        </div>
        
        <div className="flex items-center gap-2">
            {!editingTopicId && (
                <>
                    {/* Reorder Buttons only for unassigned, for simplicity, or keep if you prefer */}
                    {!isGrouped && (
                      <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800" onClick={(e) => e.stopPropagation()}>
                          <button
                              onClick={() => onMove(index, 'up')}
                              disabled={index === 0}
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                              title="Mover para cima"
                          >
                              <ChevronUp size={14} />
                          </button>
                          <button
                              onClick={() => onMove(index, 'down')}
                              disabled={index === topics.length - 1}
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                              title="Mover para baixo"
                          >
                              <ChevronDown size={14} />
                          </button>
                      </div>
                    )}

                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setEditingTopicId(topic.id!);
                            setEditTitle(topic.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-zinc-800 text-zinc-600 hover:text-white rounded transition-all"
                        title="Editar"
                    >
                        <Edit2 size={14} />
                    </button>

                    <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteRequest(topic); }}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-900/20 text-zinc-600 hover:text-red-500 rounded transition-all"
                        title="Excluir"
                    >
                        <Trash2 size={14} />
                    </button>

                    <ChevronRight size={16} className="text-zinc-700 group-hover:text-brand-red transition-colors" />
                </>
            )}
        </div>
    </div>
  );

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col h-[calc(100vh-200px)] overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300 relative">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
        <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-red/10 rounded-lg text-brand-red border border-brand-red/20">
                <Target size={18} />
             </div>
             <div>
                <h3 className="text-sm font-black text-white tracking-tighter">{activeDiscipline.name}</h3>
                <span className="text-[10px] text-zinc-500 font-bold tracking-widest">{topics.length} Assuntos Cadastrados</span>
             </div>
        </div>
      </div>

      {/* Add Forms */}
      <div className="p-4 bg-zinc-950/30 border-b border-zinc-800 flex flex-col gap-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input 
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Adicionar novo assunto..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red transition-all"
            />
            <button 
                type="submit" 
                disabled={!newTopicName.trim() || loading}
                className="bg-zinc-800 hover:bg-white hover:text-black text-white px-6 rounded-xl font-black text-[10px] tracking-widest transition-all disabled:opacity-50"
            >
                Adicionar Tópico
            </button>
            <button 
                type="button"
                onClick={() => setIsCreatingGroup(!isCreatingGroup)}
                className="bg-zinc-800 hover:bg-brand-red/10 hover:text-brand-red text-zinc-400 px-4 flex items-center justify-center rounded-xl font-black transition-all"
                title="Criar Grupo/Pasta"
            >
                <FolderKanban size={16} />
            </button>
        </form>
        {isCreatingGroup && (
          <form onSubmit={handleCreateGroup} className="flex gap-2 animate-in fade-in slide-in-from-top-2">
              <input 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Nome do grupo (ex: Parte Geral)..."
                  autoFocus
                  className="flex-1 bg-brand-red/5 border border-brand-red/20 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder-brand-red/50 focus:outline-none focus:border-brand-red transition-all"
              />
              <button 
                  type="submit" 
                  disabled={!newGroupName.trim() || loading}
                  className="bg-brand-red hover:bg-red-600 text-white px-6 rounded-xl font-black text-[10px] tracking-widest transition-all disabled:opacity-50"
              >
                  Criar Pasta
              </button>
          </form>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-zinc-950">
        {loading ? (
             <div className="flex justify-center py-10"><div className="animate-spin h-6 w-6 border-2 border-brand-red rounded-full border-t-transparent"></div></div>
        ) : topics.length === 0 && topicGroups.length === 0 ? (
             <div className="text-center py-10 opacity-50">
                <span className="text-[10px] font-bold text-zinc-600">Nenhum assunto ou grupo cadastrado nesta disciplina</span>
             </div>
        ) : (
          <div className="space-y-6">
            {/* Render Groups */}
            {topicGroups.map(group => (
              <div key={group.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800/50 bg-zinc-900 flex justify-between items-center group-hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-red/10 rounded-lg">
                      <Folder size={16} className="text-brand-red" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white tracking-tight">{group.name}</h4>
                      <p className="text-[10px] text-zinc-500 font-bold tracking-widest">{groupedTopics[group.id]?.length || 0} tópicos vinculados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenLinkModal(group)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-brand-red text-zinc-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                    >
                      <Link size={12} /> Vincular
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-1.5 hover:bg-red-900/20 text-zinc-600 hover:text-red-500 rounded-lg transition-colors"
                      title="Excluir Pasta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-3 space-y-2 bg-black/20">
                  {groupedTopics[group.id]?.map((topic, i) => renderTopicItem(topic, i, true))}
                  {(!groupedTopics[group.id] || groupedTopics[group.id].length === 0) && (
                    <div className="text-center py-4 opacity-50 text-xs font-bold text-zinc-600 uppercase tracking-widest">Pasta Vazia</div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Render unassigned topics */}
            {groupedTopics.unassigned.length > 0 && (
              <div className="space-y-2 pt-2">
                {topicGroups.length > 0 && (
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2 mb-3">Tópicos Soltos</h4>
                )}
                {groupedTopics.unassigned.map((topic, index) => renderTopicItem(topic, topics.findIndex(t => t.id === topic.id)))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Linking Modal Overlay */}
      {linkingGroup && (
        <div className="absolute inset-0 bg-black/90 flex flex-col z-50 animate-in fade-in duration-200">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
            <div>
              <h3 className="text-lg font-black text-white">Vincular a "{linkingGroup.name}"</h3>
              <p className="text-xs text-zinc-400">Selecione os tópicos para esta pasta</p>
            </div>
            <button onClick={() => setLinkingGroup(null)} className="p-2 text-zinc-400 hover:text-white"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-1 bg-zinc-950 border-b border-zinc-800">
             {topics.map(topic => (
                <label key={topic.id} className="flex items-center gap-3 cursor-pointer p-4 hover:bg-zinc-900 rounded-xl transition-colors border border-zinc-800/50 hover:border-zinc-700 bg-zinc-900/20">
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedTopicIds.has(topic.id!) ? 'bg-brand-red border-brand-red' : 'bg-black border-zinc-700'}`}>
                    {selectedTopicIds.has(topic.id!) && <Check size={14} className="text-white" />}
                  </div>
                  <span className="text-sm font-bold text-zinc-300">{topic.name}</span>
                  {topic.groupId && topic.groupId !== linkingGroup.id && (
                    <span className="ml-auto text-[10px] text-zinc-500 px-2 py-0.5 rounded bg-black border border-zinc-800">
                      Na pasta: {activeDiscipline?.topicGroups?.find(g => g.id === topic.groupId)?.name}
                    </span>
                  )}
                </label>
             ))}
             {topics.length === 0 && <p className="text-zinc-500 text-sm text-center py-10">Nenhum tópico.</p>}
          </div>
          <div className="p-4 bg-zinc-900 flex flex-col">
             <button 
                 onClick={handleSaveLinks}
                 className="py-4 bg-brand-red text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-red-600 transition-colors"
             >
                 Salvar Vinculações
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicList;

