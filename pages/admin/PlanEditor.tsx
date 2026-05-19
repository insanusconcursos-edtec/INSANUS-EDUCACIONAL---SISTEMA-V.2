
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Layout, Layers, RefreshCw, FileText, GraduationCap, MessageSquare } from 'lucide-react';
import { getPlanById, Plan, updatePlan } from '../../services/planService';
import { PlanVisualEditor } from '../../components/admin/plan/visual/PlanVisualEditor';
import { 
  getDisciplines, 
  addDiscipline, 
  deleteDiscipline, 
  reorderDiscipline,
  moveDiscipline,
  getTopics, 
  addTopic, 
  deleteTopic,
  reorderTopic,
  addFolder,
  renameFolder,
  deleteFolder,
  renameDiscipline,
  Discipline,
  Topic 
} from '../../services/structureService';
import DisciplineList from '../../components/admin/structure/DisciplineList';
import TopicList from '../../components/admin/structure/TopicList';
import CycleManager from '../../components/admin/cycles/CycleManager';
import MetaManager from '../../components/admin/metas/MetaManager';
import VerticalEdictManager from '../../components/admin/edict/VerticalEdictManager';
import { PlanMentorshipTab } from '../../components/admin/plan/mentorship/PlanMentorshipTab';
import { PlanVideoCallTab } from '../../components/admin/plan/video/PlanVideoCallTab';
import { PlanAnnouncementsTab } from '../../components/admin/plan/announcements/PlanAnnouncementsTab';
import MentorChatWorkspace from '../admin/MentorChatWorkspace';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import Loading from '../../components/ui/Loading';
import SyncControlPanel from '../../components/admin/sync/SyncControlPanel';
import { usePlanSync } from '../../hooks/usePlanSync';
import { Video, BarChart3, Megaphone } from 'lucide-react';
import { PlanAnalyticsTab } from '../../components/admin/plan/analytics/PlanAnalyticsTab';

type TabView = 'STRUCTURE' | 'CYCLES' | 'EDICT' | 'MENTORSHIP' | 'VISUAL' | 'CHAT' | 'CALL' | 'ANALYTICS' | 'ANNOUNCEMENTS';

const PlanEditor: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();

  // Data State
  const [plan, setPlan] = useState<Plan | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState<TabView>('STRUCTURE');
  const [loading, setLoading] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);
  
  // Selection State
  const [selectedDiscipline, setSelectedDiscipline] = useState<Discipline | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  
  // Sync State
  const { hasPendingChanges } = usePlanSync(planId);
  
  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'DISCIPLINE' | 'TOPIC' | 'FOLDER' | null;
    item: any | null;
    message: string;
  }>({ isOpen: false, type: null, item: null, message: '' });

  // 1. Initial Load
  const fetchPlanAndStructure = useCallback(async () => {
        if (!planId) return;
        try {
            const [fetchedPlan, fetchedDisciplines] = await Promise.all([
                getPlanById(planId),
                getDisciplines(planId)
            ]);
            
            if (!fetchedPlan) {
                alert('Plano não encontrado');
                navigate('/admin/planos');
                return;
            }
            
            setPlan(fetchedPlan);
            setDisciplines(fetchedDisciplines);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
  }, [planId, navigate]);

  useEffect(() => {
    fetchPlanAndStructure();
  }, [fetchPlanAndStructure]);

  const handleUpdatePlan = async (updates: Partial<Plan>) => {
    if (!planId) return;
    try {
      await updatePlan(planId, updates);
      setPlan(prev => prev ? { ...prev, ...updates } : null);
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar plano');
    }
  };

  // 2. Browser Exit Protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingChanges]);

  // 2. Load Topics
  useEffect(() => {
    const fetchTopicsForDiscipline = async () => {
        setSelectedTopic(null);

        if (!planId || !selectedDiscipline?.id) {
            setTopics([]);
            return;
        }
        
        setLoadingTopics(true);
        try {
            const fetchedTopics = await getTopics(planId, selectedDiscipline.id);
            setTopics(fetchedTopics);
        } catch (error) {
            console.error("Error fetching topics", error);
        } finally {
            setLoadingTopics(false);
        }
    };
    
    fetchTopicsForDiscipline();
  }, [planId, selectedDiscipline]);

  // === HANDLERS (Structure) ===

  // Folder Actions
  const handleAddFolder = async (name: string) => {
    if (!planId) return;
    try {
        await addFolder(planId, name);
        fetchPlanAndStructure();
    } catch (e) {
        console.error(e);
    }
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    if (!planId) return;
    try {
        await renameFolder(planId, id, newName);
        fetchPlanAndStructure();
    } catch (e) {
        console.error(e);
    }
  };

  const handleRenameDiscipline = async (id: string, newName: string) => {
    if (!planId) return;
    try {
        await renameDiscipline(planId, id, newName);
        setDisciplines(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
        if (selectedDiscipline?.id === id) {
            setSelectedDiscipline(prev => prev ? { ...prev, name: newName } : null);
        }
    } catch (e) {
        console.error(e);
    }
  };

  const handleDeleteFolderRequest = (folderId: string) => {
    setModalConfig({
        isOpen: true,
        type: 'FOLDER',
        item: { id: folderId },
        message: 'Tem certeza que deseja excluir esta pasta? As disciplinas dentro dela serão movidas para a raiz.'
    });
  };

  // Discipline Actions
  const handleAddDiscipline = async (name: string, folderId: string | null) => {
    if (!planId) return;
    try {
        await addDiscipline(planId, name, folderId);
        const updated = await getDisciplines(planId);
        setDisciplines(updated);
    } catch (e) {
        console.error(e);
    }
  };

  const requestDeleteDiscipline = (disc: Discipline) => {
    setModalConfig({
        isOpen: true,
        type: 'DISCIPLINE',
        item: disc,
        message: `Ao excluir a disciplina "${disc.name}", todos os tópicos vinculados também serão perdidos.`
    });
  };

  const handleMoveDiscipline = async (index: number, direction: 'up' | 'down') => {
    if (!planId) return;
    
    // Optimistic Update for Reorder
    const newDisciplines = [...disciplines];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newDisciplines.length) return;

    const temp = newDisciplines[index];
    newDisciplines[index] = newDisciplines[targetIndex];
    newDisciplines[targetIndex] = temp;
    
    setDisciplines(newDisciplines);

    try {
        await reorderDiscipline(planId, disciplines, index, direction);
    } catch (error) {
        console.error("Reorder failed", error);
        setDisciplines(disciplines);
    }
  };

  const handleChangeDisciplineFolder = async (discipline: Discipline, targetFolderId: string | null) => {
    if (!planId || !discipline.id) return;
    
    // Optimistic Update
    setDisciplines(prev => prev.map(d => 
        d.id === discipline.id ? { ...d, folderId: targetFolderId } : d
    ));

    try {
        await moveDiscipline(planId, discipline.id, targetFolderId);
    } catch (error) {
        console.error("Move folder failed", error);
        fetchPlanAndStructure();
    }
  };

  // Topic Actions
  const handleAddTopic = async (name: string) => {
    if (!planId || !selectedDiscipline?.id) return;
    try {
        await addTopic(planId, selectedDiscipline.id, name);
        const updated = await getTopics(planId, selectedDiscipline.id);
        setTopics(updated);
    } catch (e) {
        console.error(e);
    }
  };

  const requestDeleteTopic = (topic: Topic) => {
    setModalConfig({
        isOpen: true,
        type: 'TOPIC',
        item: topic,
        message: `Deseja excluir o assunto "${topic.name}"?`
    });
  };

  const handleMoveTopic = async (index: number, direction: 'up' | 'down') => {
    if (!planId || !selectedDiscipline?.id) return;

    const newTopics = [...topics];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newTopics.length) return;

    const temp = newTopics[index];
    newTopics[index] = newTopics[targetIndex];
    newTopics[targetIndex] = temp;

    setTopics(newTopics);

    try {
        await reorderTopic(planId, selectedDiscipline.id, topics, index, direction);
    } catch (error) {
        console.error("Reorder topic failed", error);
        setTopics(topics);
    }
  };

  const handleUpdateTopicLocal = (id: string, name: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  };

  const handleConfirmDelete = async () => {
    if (!planId || !modalConfig.item) return;

    try {
        if (modalConfig.type === 'DISCIPLINE') {
            await deleteDiscipline(planId, modalConfig.item.id);
            setDisciplines(prev => prev.filter(d => d.id !== modalConfig.item.id));
            if (selectedDiscipline?.id === modalConfig.item.id) {
                setSelectedDiscipline(null);
            }
        } else if (modalConfig.type === 'TOPIC' && selectedDiscipline?.id) {
            await deleteTopic(planId, selectedDiscipline.id, modalConfig.item.id);
            setTopics(prev => prev.filter(t => t.id !== modalConfig.item.id));
            if (selectedTopic?.id === modalConfig.item.id) {
                setSelectedTopic(null);
            }
        } else if (modalConfig.type === 'FOLDER') {
            await deleteFolder(planId, modalConfig.item.id);
            await fetchPlanAndStructure();
        }
    } catch (error) {
        console.error("Delete failed", error);
    } finally {
        setModalConfig({ ...modalConfig, isOpen: false });
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col animate-in fade-in duration-500">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => navigate('/admin/planos')}
                className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
            >
                <ChevronLeft size={20} />
            </button>
            <div>
                <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">
                    <Layout size={12} />
                    <span>Editor de Plano</span>
                </div>
                <h1 className="text-2xl font-black text-white tracking-tighter leading-none">
                    {plan?.title}
                </h1>
            </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="bg-zinc-900 p-1 rounded-xl border border-zinc-800 flex gap-1">
            <button 
                onClick={() => setActiveTab('STRUCTURE')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'STRUCTURE' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <Layers size={14} /> Estrutura
            </button>
            <button 
                onClick={() => setActiveTab('CYCLES')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'CYCLES' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <RefreshCw size={14} /> Ciclos
            </button>
            <button 
                onClick={() => setActiveTab('EDICT')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'EDICT' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <FileText size={14} /> Edital
            </button>
            <button 
                onClick={() => setActiveTab('MENTORSHIP')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'MENTORSHIP' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <GraduationCap size={14} /> Mentoria
            </button>
            <button 
                onClick={() => setActiveTab('VISUAL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'VISUAL' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <Layout size={14} /> Visual
            </button>
            <button 
                onClick={() => setActiveTab('ANALYTICS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ANALYTICS' ? 'bg-zinc-800 text-white shadow-lg border border-yellow-400/30' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <BarChart3 size={14} className={activeTab === 'ANALYTICS' ? 'text-yellow-400' : ''} /> Análise
            </button>
            <button 
                onClick={() => setActiveTab('CHAT')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'CHAT' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <MessageSquare size={14} /> Chat
            </button>
            <button 
                onClick={() => setActiveTab('CALL')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'CALL' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <Video size={14} /> Call
            </button>
            <button 
                onClick={() => setActiveTab('ANNOUNCEMENTS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ANNOUNCEMENTS' ? 'bg-zinc-800 text-white shadow-lg border border-red-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <Megaphone size={14} className={activeTab === 'ANNOUNCEMENTS' ? 'text-red-500' : ''} /> Avisos
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'STRUCTURE' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Sync Bar for Structure */}
            <div className="flex items-center justify-between bg-zinc-900/30 p-3 rounded-xl border border-zinc-800/50">
                <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                    <RefreshCw size={12} />
                    <span>Status de Publicação</span>
                </div>
                {planId && <SyncControlPanel planId={planId} variant="minimal" />}
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
              {/* Left Column - Disciplines (30%) */}
              <div className="col-span-4 lg:col-span-3">
                <DisciplineList 
                    disciplines={disciplines}
                    folders={plan?.folders || []}
                    selectedDisciplineId={selectedDiscipline?.id}
                    onSelect={(d) => {
                        setSelectedDiscipline(d);
                        setSelectedTopic(null);
                    }}
                    onAddDiscipline={handleAddDiscipline}
                    onDeleteRequest={requestDeleteDiscipline}
                    onRenameDiscipline={handleRenameDiscipline}
                    onMoveDisciplineFolder={handleChangeDisciplineFolder}
                    onReorderDiscipline={handleMoveDiscipline}
                    
                    // Folder Props
                    onAddFolder={handleAddFolder}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolderRequest}
                />
            </div>

            {/* Right Column - Topics OR Meta Manager (70%) */}
            <div className="col-span-8 lg:col-span-9">
                {selectedTopic && selectedDiscipline && planId ? (
                    <MetaManager 
                        planId={planId}
                        discipline={selectedDiscipline}
                        topic={selectedTopic}
                        onBack={() => setSelectedTopic(null)}
                    />
                ) : (
                    <TopicList 
                        topics={topics}
                        activeDiscipline={selectedDiscipline}
                        loading={loadingTopics}
                        onAdd={handleAddTopic}
                        onDeleteRequest={requestDeleteTopic}
                        onMove={handleMoveTopic}
                        onSelectTopic={setSelectedTopic}
                        onUpdateTopic={handleUpdateTopicLocal}
                        onRefresh={() => window.location.reload()}
                    />
                )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'CYCLES' && (
          <div className="flex-1 overflow-hidden">
             {plan && (
                 <CycleManager 
                    plan={plan}
                    disciplines={disciplines}
                    folders={plan.folders || []}
                    onUpdate={fetchPlanAndStructure}
                 />
             )}
          </div>
      )}

      {activeTab === 'EDICT' && (
          <div className="flex-1 overflow-hidden">
             {plan && (
                 <VerticalEdictManager 
                    plan={plan}
                    onUpdate={fetchPlanAndStructure}
                 />
             )}
          </div>
      )}

      {activeTab === 'MENTORSHIP' && plan && (
          <div className="flex-1 overflow-hidden">
             <PlanMentorshipTab planId={plan.id!} />
          </div>
      )}

      {activeTab === 'VISUAL' && plan && (
          <div className="flex-1 overflow-hidden">
             <PlanVisualEditor plan={plan} onUpdate={handleUpdatePlan} />
          </div>
      )}

      {activeTab === 'ANALYTICS' && plan && (
          <div className="flex-1 overflow-hidden flex flex-col">
             <PlanAnalyticsTab 
                planId={plan.id!}
                linkedSimuladoClassId={plan.linkedSimuladoClassId} 
             />
          </div>
      )}

      {activeTab === 'CHAT' && planId && (
          <div className="flex-1 overflow-hidden">
             <MentorChatWorkspace planId={planId} />
          </div>
      )}

      {activeTab === 'CALL' && planId && (
          <div className="flex-1 overflow-hidden">
             <PlanVideoCallTab planId={planId} />
          </div>
      )}

      {activeTab === 'ANNOUNCEMENTS' && planId && (
          <div className="flex-1 overflow-hidden">
             <PlanAnnouncementsTab planId={planId} />
          </div>
      )}

      <ConfirmationModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message={modalConfig.message}
      />
    </div>
  );
};

export default PlanEditor;
