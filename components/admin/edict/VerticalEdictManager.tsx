import React, { useEffect, useState } from 'react';
import { 
  FileText, Plus, Loader2, BarChart2, X, HelpCircle
} from 'lucide-react';
// import { useBlocker } from 'react-router-dom'; // REMOVIDO: Causa erro sem Data Router
import { Plan } from '../../../services/planService';
import { 
  getEdict, 
  toggleEdict, 
  addEdictDiscipline, 
  addEdictTopic, 
  addEdictSubtopic, 
  deleteEdictItem, 
  renameEdictItem,
  saveEdictStructure,
  linkGoalsToItem,
  unlinkGoalFromItem,
  getAllLinkedGoalIds,
  addStudyLevel,
  deleteStudyLevel,
  updateTopicLevel,
  toggleActiveUserMode, // Importado
  EdictStructure
} from '../../../services/edictService';
import { deepCloneSafe } from '../../../services/firestoreUtils';
import { getMetas, Meta, MetaType } from '../../../services/metaService';
import { getDisciplines, getTopics, Discipline, Topic } from '../../../services/structureService';
import { usePlanSync } from '../../../hooks/usePlanSync'; // Hook de Sync
import VerticalEdictItem from './VerticalEdictItem';
import ConfirmationModal from '../../ui/ConfirmationModal';
import GoalSelectorModal from './GoalSelectorModal';
import StudyLevelsModal from './StudyLevelsModal';
import SyncControlPanel from '../sync/SyncControlPanel'; // Botão de Sync

interface VerticalEdictManagerProps {
  plan: Plan;
  onUpdate: () => void; // Para atualizar o estado do plano pai (isEdictEnabled)
}

// Type for the full tree structure passed to Modal
type PlanTreeGroup = {
  discipline: Discipline;
  topics: {
    topic: Topic;
    metas: Meta[];
  }[];
};

const VerticalEdictManager: React.FC<VerticalEdictManagerProps> = ({ plan, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [structure, setStructure] = useState<EdictStructure | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isActiveUserMode, setIsActiveUserMode] = useState(false); // Estado local do toggle
  
  // Data for Linking
  const [planStructureTree, setPlanStructureTree] = useState<PlanTreeGroup[]>([]);
  const [metaLookup, setMetaLookup] = useState<Record<string, Meta>>({});
  const [globalLinkedIds, setGlobalLinkedIds] = useState<Set<string>>(new Set());

  // States para Criação de Disciplina
  const [isCreatingDiscipline, setIsCreatingDiscipline] = useState(false);
  const [newDisciplineName, setNewDisciplineName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States para Modal de Link
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{ disciplineId: string; topicId?: string; subtopicId?: string; name: string } | null>(null);

  // States para Modal de Níveis
  const [isLevelsModalOpen, setIsLevelsModalOpen] = useState(false);

  // Modal de Exclusão
  const [deleteData, setDeleteData] = useState<{
    type: 'discipline' | 'topic' | 'subtopic';
    ids: { disciplineId: string; topicId?: string; subtopicId?: string };
    name: string;
  } | null>(null);

  // Sync Logic Hook
  const { hasPendingChanges } = usePlanSync(plan.id);

  // PROTEÇÃO NATIVA (Browser Exit/Reload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges) {
        e.preventDefault();
        e.returnValue = ''; // Necessário para Chrome
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingChanges]);

  // === INITIAL LOAD ===
  useEffect(() => {
    if (plan) {
        setIsActiveUserMode(plan.isActiveUserMode || false);
    }
    if (plan.id && plan.isEdictEnabled !== false) {
      loadEdictData();
      loadPlanStructureTree(); // Build Hierarchy
    }
  }, [plan.id, plan.isEdictEnabled, plan.isActiveUserMode]);

  const loadEdictData = async () => {
    if (!plan.id) return;
    setLoading(true);
    try {
      const data = await getEdict(plan.id);
      setStructure(data);
      
      // Calculate used IDs
      const usedIds = getAllLinkedGoalIds(data);
      setGlobalLinkedIds(usedIds);

      // Auto-expand disciplines if few
      if (data.disciplines.length <= 3) {
        setExpandedItems(data.disciplines.map(d => d.id));
      }
    } catch (error) {
      console.error("Erro ao carregar edital:", error);
    } finally {
      setLoading(false);
    }
  };

  // Build the hierarchical tree: Disciplines -> Topics -> Metas
  const loadPlanStructureTree = async () => {
    if (!plan.id) return;
    
    try {
      const disciplines = await getDisciplines(plan.id);
      const tree: PlanTreeGroup[] = [];
      const lookup: Record<string, Meta> = {};

      // Build tree sequentially to ensure data integrity
      for (const disc of disciplines) {
        if (!disc.id) continue;
        
        const topics = await getTopics(plan.id, disc.id);
        const topicsWithMetas: { topic: Topic; metas: Meta[] }[] = [];

        for (const topic of topics) {
          if (!topic.id) continue;
          
          const metas = await getMetas(plan.id, disc.id, topic.id);
          
          // Populate Lookup for rendering in Edict Items
          metas.forEach(m => {
            if (m.id) lookup[m.id] = m;
          });

          topicsWithMetas.push({ topic, metas });
        }

        // Only add disciplines that have topics (optional optimization)
        tree.push({
          discipline: disc,
          topics: topicsWithMetas
        });
      }

      setPlanStructureTree(tree);
      setMetaLookup(lookup);

    } catch (error) {
      console.error("Erro ao carregar estrutura do plano:", error);
    }
  };

  // === ACTIONS ===

  const handleEnableEdict = async () => {
    if (!plan.id) return;
    setLoading(true);
    try {
      await toggleEdict(plan.id, true);
      await loadEdictData();
      await loadPlanStructureTree();
      onUpdate();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActiveUserMode = async () => {
    if (!plan.id) return;
    const newState = !isActiveUserMode;
    setIsActiveUserMode(newState);
    await toggleActiveUserMode(plan.id, newState);
    onUpdate(); // Atualiza o plano pai se necessário
  };

  // --- STUDY LEVELS ---

  const handleAddStudyLevel = async (name: string) => {
    if (!plan.id) return;
    await addStudyLevel(plan.id, name);
    await loadEdictData();
  };

  const handleDeleteStudyLevel = async (id: string) => {
    if (!plan.id) return;
    await deleteStudyLevel(plan.id, id);
    await loadEdictData();
  };

  const handleUpdateTopicLevel = async (disciplineId: string, topicId: string, levelId: string) => {
    if (!plan.id) return;
    // Otimista
    if (structure) {
        const newStructure = { ...structure };
        const disc = newStructure.disciplines.find(d => d.id === disciplineId);
        const topic = disc?.topics.find(t => t.id === topicId);
        if (topic) topic.studyLevelId = levelId || null;
        setStructure(newStructure);
    }
    await updateTopicLevel(plan.id, disciplineId, topicId, levelId || null);
  };

  // --- DISCIPLINE CREATION ---
  
  const openCreateDisciplineModal = () => {
    setNewDisciplineName("");
    setIsCreatingDiscipline(true);
  };

  const handleSaveDiscipline = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!plan.id || !newDisciplineName.trim()) return;

    setIsSubmitting(true);
    try {
      await addEdictDiscipline(plan.id, newDisciplineName);
      await loadEdictData(); // Refresh structure
      setIsCreatingDiscipline(false);
      setNewDisciplineName("");
    } catch (error) {
      console.error("Erro ao criar disciplina", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- TOPIC / SUBTOPIC CREATION ---

  const handleAddTopic = async (disciplineId: string) => {
    if (!plan.id) return;
    const name = "Novo Tópico"; 
    try {
      await addEdictTopic(plan.id, disciplineId, name);
      if (!expandedItems.includes(disciplineId)) {
        setExpandedItems(prev => [...prev, disciplineId]);
      }
      await loadEdictData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddSubtopic = async (disciplineId: string, topicId: string) => {
    if (!plan.id) return;
    const name = "Novo Subtópico";
    try {
      await addEdictSubtopic(plan.id, disciplineId, topicId, name);
      if (!expandedItems.includes(topicId)) {
        setExpandedItems(prev => [...prev, topicId]);
      }
      await loadEdictData();
    } catch (error) {
      console.error(error);
    }
  };

  // --- GOAL LINKING ---

  const openLinkModal = (
    ids: { disciplineId: string; topicId?: string; subtopicId?: string },
    name: string
  ) => {
    setLinkTarget({ ...ids, name });
    setIsLinkModalOpen(true);
  };

  const handleConfirmLink = async (selectedGoals: { id: string, type: MetaType }[]) => {
    if (!plan.id || !linkTarget) return;
    try {
      await linkGoalsToItem(plan.id, linkTarget, selectedGoals);
      await loadEdictData(); // Recalcula usedIds e structure
    } catch (error) {
      console.error("Erro ao vincular metas:", error);
    }
  };

  const handleUnlinkGoal = async (
    ids: { disciplineId: string; topicId?: string; subtopicId?: string },
    goalId: string,
    type: MetaType
  ) => {
    if (!plan.id) return;
    try {
      await unlinkGoalFromItem(plan.id, ids, goalId, type);
      await loadEdictData(); // Refresh to update usedIds
    } catch (error) {
      console.error("Erro ao desvincular meta:", error);
    }
  };

  // --- DELETE LOGIC ---
  const requestDelete = (type: 'discipline' | 'topic' | 'subtopic', ids: any, name: string) => {
    setDeleteData({ type, ids, name });
  };

  const confirmDelete = async () => {
    if (!plan.id || !deleteData) return;
    try {
      await deleteEdictItem(plan.id, deleteData.type, deleteData.ids);
      setDeleteData(null);
      await loadEdictData();
    } catch (error) {
      console.error(error);
    }
  };

  // --- RENAME & UPDATE LOGIC ---
  const handleRename = async (type: 'discipline' | 'topic' | 'subtopic', ids: any, newName: string) => {
    if (!plan.id) return;
    try {
      await renameEdictItem(plan.id, type, ids, newName);
      // Otimista
      if (structure) {
        const newStructure = deepCloneSafe(structure);
        const disc = newStructure.disciplines.find(d => d.id === ids.disciplineId);
        if (disc) {
          if (type === 'discipline') {
            disc.name = newName;
          } else if (type === 'topic' && ids.topicId) {
            const topic = disc.topics.find(t => t.id === ids.topicId);
            if (topic) topic.name = newName;
          } else if (type === 'subtopic' && ids.topicId && ids.subtopicId) {
            const topic = disc.topics.find(t => t.id === ids.topicId);
            if (topic) {
              const sub = topic.subtopics.find(s => s.id === ids.subtopicId);
              if (sub) sub.name = newName;
            }
          }
        }
        setStructure(newStructure);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateObservation = async (type: 'discipline' | 'topic' | 'subtopic', ids: any, newObservation: string) => {
    if (!plan.id) return;
    try {
      await updateEdictItem(plan.id, type, ids, { observation: newObservation });
      // Otimista
      if (structure) {
        const newStructure = deepCloneSafe(structure);
        const disc = newStructure.disciplines.find(d => d.id === ids.disciplineId);
        if (disc) {
          if (type === 'topic' && ids.topicId) {
            const topic = disc.topics.find(t => t.id === ids.topicId);
            if (topic) topic.observation = newObservation;
          } else if (type === 'subtopic' && ids.topicId && ids.subtopicId) {
            const topic = disc.topics.find(t => t.id === ids.topicId);
            if (topic) {
              const sub = topic.subtopics.find(s => s.id === ids.subtopicId);
              if (sub) sub.observation = newObservation;
            }
          }
        }
        setStructure(newStructure);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // --- REORDER LOGIC ---
  const handleMove = async (
    type: 'discipline' | 'topic' | 'subtopic', 
    ids: { disciplineId: string, topicId?: string },
    index: number, 
    direction: 'up' | 'down'
  ) => {
    if (!structure || !plan.id) return;

    const newStructure = deepCloneSafe(structure);
    let itemsArray: any[] = [];

    if (type === 'discipline') {
      itemsArray = newStructure.disciplines;
    } else if (type === 'topic') {
      const disc = newStructure.disciplines.find(d => d.id === ids.disciplineId);
      if (disc) itemsArray = disc.topics;
    } else if (type === 'subtopic' && ids.topicId) {
      const disc = newStructure.disciplines.find(d => d.id === ids.disciplineId);
      const topic = disc?.topics.find(t => t.id === ids.topicId);
      if (topic) itemsArray = topic.subtopics;
    }

    if (itemsArray.length === 0) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= itemsArray.length) return;

    // Swap
    [itemsArray[index], itemsArray[targetIndex]] = [itemsArray[targetIndex], itemsArray[index]];

    setStructure(newStructure);
    await saveEdictStructure(plan.id, newStructure);
  };

  // --- EXPAND/COLLAPSE ---
  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // === RENDER ===

  if (!plan.isEdictEnabled) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 p-10 bg-zinc-900/20 rounded-2xl border border-zinc-800 border-dashed animate-in fade-in">
        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border-2 border-zinc-800">
          <FileText size={40} className="text-zinc-600" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Edital Verticalizado</h3>
          <p className="text-zinc-500 text-sm">
            Habilite esta funcionalidade para criar um checklist hierárquico do edital, permitindo que os alunos acompanhem item a item.
          </p>
        </div>
        <button 
          onClick={handleEnableEdict}
          disabled={loading}
          className="px-8 py-3 bg-brand-red hover:bg-red-600 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-900/20 flex items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Ativar Edital Verticalizado'}
        </button>
      </div>
    );
  }

  if (loading && !structure) {
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-brand-red" /></div>;
  }

  return (
    <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Header Actions */}
      <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <FileText size={14} /> Estrutura do Edital
        </h3>
        
        <div className="flex items-center gap-2">
          {/* Painel de Sincronização */}
          {plan.id && <SyncControlPanel planId={plan.id} variant="minimal" />}

          <div className="w-px h-6 bg-zinc-800 mx-2" />

          {/* ACTIVE USER TOGGLE */}
          <div className="flex items-center gap-3 mr-2 bg-zinc-900/30 px-3 py-1 rounded-lg border border-zinc-800/50">
             <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 group relative cursor-help">
                   <span className={`text-[9px] font-black uppercase tracking-widest ${isActiveUserMode ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      Usuário Ativo
                   </span>
                   <HelpCircle size={10} className="text-zinc-600" />
                   
                   {/* Tooltip */}
                   <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-[9px] text-zinc-400 font-medium leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                      Permite que o aluno marque itens como concluídos manualmente, removendo-os da agenda futura.
                   </div>
                </div>
             </div>
             
             <button 
               onClick={handleToggleActiveUserMode}
               className={`relative w-9 h-5 rounded-full transition-colors duration-300 focus:outline-none border border-transparent ${
                 isActiveUserMode ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-zinc-800 border-zinc-700'
               }`}
             >
                <div 
                  className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-transform duration-300 shadow-sm ${
                    isActiveUserMode ? 'translate-x-4 bg-emerald-400' : 'translate-x-0 bg-zinc-500'
                  }`}
                />
             </button>
          </div>

          <div className="w-px h-6 bg-zinc-800 mx-2" />

          <button 
            onClick={() => setIsLevelsModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 rounded-lg text-[10px] font-black uppercase text-zinc-400 hover:text-white tracking-widest transition-all"
          >
            <BarChart2 size={12} /> Gerenciar Níveis
          </button>
          <button 
            onClick={openCreateDisciplineModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-900/20"
          >
            <Plus size={12} /> Nova Disciplina
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
        {!structure?.disciplines.length && (
          <div className="text-center py-20 text-zinc-600 text-xs font-bold uppercase border-2 border-dashed border-zinc-900 rounded-xl">
            Nenhuma disciplina cadastrada. Comece adicionando uma acima.
          </div>
        )}

        {structure?.disciplines.map((discipline, dIndex) => (
          <VerticalEdictItem
            key={discipline.id}
            id={discipline.id}
            name={discipline.name}
            type="discipline"
            isExpanded={expandedItems.includes(discipline.id)}
            onToggleExpand={() => toggleExpand(discipline.id)}
            onRename={(newName) => handleRename('discipline', { disciplineId: discipline.id }, newName)}
            onDelete={() => requestDelete('discipline', { disciplineId: discipline.id }, discipline.name)}
            onAddChild={() => handleAddTopic(discipline.id)}
            onMove={(dir) => handleMove('discipline', { disciplineId: discipline.id }, dIndex, dir)}
            isFirst={dIndex === 0}
            isLast={dIndex === structure.disciplines.length - 1}
          >
            {/* TÓPICOS */}
            {discipline.topics.map((topic, tIndex) => (
              <VerticalEdictItem
                key={topic.id}
                id={topic.id}
                name={topic.name}
                type="topic"
                linkedGoals={topic.linkedGoals}
                metaLookup={metaLookup}
                isExpanded={expandedItems.includes(topic.id)}
                
                // Pass Level Data
                studyLevels={structure?.studyLevels}
                currentLevelId={topic.studyLevelId}
                onLevelChange={(newLevelId) => handleUpdateTopicLevel(discipline.id, topic.id, newLevelId)}

                onToggleExpand={() => toggleExpand(topic.id)}
                onRename={(newName) => handleRename('topic', { disciplineId: discipline.id, topicId: topic.id }, newName)}
                onUpdateObservation={(newObs) => handleUpdateObservation('topic', { disciplineId: discipline.id, topicId: topic.id }, newObs)}
                onDelete={() => requestDelete('topic', { disciplineId: discipline.id, topicId: topic.id }, topic.name)}
                onAddChild={() => handleAddSubtopic(discipline.id, topic.id)}
                onMove={(dir) => handleMove('topic', { disciplineId: discipline.id }, tIndex, dir)}
                onLinkGoals={() => openLinkModal({ disciplineId: discipline.id, topicId: topic.id }, topic.name)}
                onUnlinkGoal={(goalId, type) => handleUnlinkGoal({ disciplineId: discipline.id, topicId: topic.id }, goalId, type)}
                isFirst={tIndex === 0}
                isLast={tIndex === discipline.topics.length - 1}
                observation={topic.observation}
              >
                {/* SUBTÓPICOS */}
                {topic.subtopics.map((sub, sIndex) => (
                  <VerticalEdictItem
                    key={sub.id}
                    id={sub.id}
                    name={sub.name}
                    type="subtopic"
                    linkedGoals={sub.linkedGoals}
                    metaLookup={metaLookup}
                    onRename={(newName) => handleRename('subtopic', { disciplineId: discipline.id, topicId: topic.id, subtopicId: sub.id }, newName)}
                    onUpdateObservation={(newObs) => handleUpdateObservation('subtopic', { disciplineId: discipline.id, topicId: topic.id, subtopicId: sub.id }, newObs)}
                    onDelete={() => requestDelete('subtopic', { disciplineId: discipline.id, topicId: topic.id, subtopicId: sub.id }, sub.name)}
                    onMove={(dir) => handleMove('subtopic', { disciplineId: discipline.id, topicId: topic.id }, sIndex, dir)}
                    onLinkGoals={() => openLinkModal({ disciplineId: discipline.id, topicId: topic.id, subtopicId: sub.id }, sub.name)}
                    onUnlinkGoal={(goalId, type) => handleUnlinkGoal({ disciplineId: discipline.id, topicId: topic.id, subtopicId: sub.id }, goalId, type)}
                    isFirst={sIndex === 0}
                    isLast={sIndex === topic.subtopics.length - 1}
                    observation={sub.observation}
                  />
                ))}
              </VerticalEdictItem>
            ))}
          </VerticalEdictItem>
        ))}
      </div>

      {/* MODAL CRIAR DISCIPLINA */}
      {isCreatingDiscipline && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={() => setIsCreatingDiscipline(false)}>
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Nova Disciplina do Edital</h3>
              <button onClick={() => setIsCreatingDiscipline(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveDiscipline}>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Nome da Disciplina</label>
                  <input
                    value={newDisciplineName}
                    onChange={e => setNewDisciplineName(e.target.value)}
                    autoFocus
                    placeholder="Ex: Direito Constitucional"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsCreatingDiscipline(false)} className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-widest transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSubmitting || !newDisciplineName.trim()} className="flex-1 py-3 bg-brand-red hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE SELEÇÃO DE METAS */}
      <GoalSelectorModal 
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSave={handleConfirmLink}
        planStructure={planStructureTree}
        globalLinkedIds={globalLinkedIds}
        title={linkTarget?.name || 'Item'}
      />

      {/* MODAL DE NÍVEIS DE ESTUDO */}
      <StudyLevelsModal 
        isOpen={isLevelsModalOpen}
        onClose={() => setIsLevelsModalOpen(false)}
        levels={structure?.studyLevels || []}
        onAdd={handleAddStudyLevel}
        onDelete={handleDeleteStudyLevel}
      />

      {/* MODAL DE CONFIRMAÇÃO (Exclusão) */}
      <ConfirmationModal 
        isOpen={!!deleteData}
        onClose={() => setDeleteData(null)}
        onConfirm={confirmDelete}
        title={`Excluir ${deleteData?.type === 'discipline' ? 'Disciplina' : 'Item'}?`}
        message={`Deseja excluir "${deleteData?.name}"? ${deleteData?.type !== 'subtopic' ? 'Todos os itens internos também serão removidos.' : ''}`}
      />
    </div>
  );
};

export default VerticalEdictManager;