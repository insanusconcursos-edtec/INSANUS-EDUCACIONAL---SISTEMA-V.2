import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Infinity as InfinityIcon, 
  RefreshCw, 
  Plus, 
  Trash2, 
  GripVertical, 
  ChevronDown, 
  ChevronRight, 
  ChevronUp,
  Layout
} from 'lucide-react';
// import { useBlocker } from 'react-router-dom'; // REMOVIDO: Causa erro sem Data Router
import { Plan, Cycle, CycleSystem, CycleItem, Folder } from '../../../services/planService';
import { 
  addCycle, 
  updateCycle, 
  deleteCycle, 
  reorderCycles, 
  setCycleSystem,
  Discipline
} from '../../../services/structureService';
import { getExams, SimulatedExam } from '../../../services/simulatedService';
import { usePlanSync } from '../../../hooks/usePlanSync'; // Hook de Sync
import CycleContentEditor from './CycleContentEditor';
import ConfirmationModal from '../../ui/ConfirmationModal';
import SyncControlPanel from '../sync/SyncControlPanel'; // Botão de Sync

interface CycleManagerProps {
  plan: Plan;
  disciplines: Discipline[];
  folders: Folder[];
  onUpdate: () => void; // Trigger refresh on parent
}

// --- SUB-COMPONENT: SORTABLE CYCLE CARD ---
interface SortableCycleCardProps {
  cycle: Cycle;
  index: number;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggleExpand: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDeleteRequest: (cycle: Cycle) => void; 
  onMove: (direction: 'up' | 'down') => void;
  children: React.ReactNode; 
}

const SortableCycleCard: React.FC<SortableCycleCardProps> = ({ 
  cycle, index, isExpanded, isFirst, isLast, onToggleExpand, onRename, onDeleteRequest, onMove, children 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: cycle.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="mb-3 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-sm transition-all hover:border-zinc-700 group"
    >
      {/* Header do Card */}
      <div 
        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-900' : 'hover:bg-zinc-900/50'}`}
        onClick={() => onToggleExpand(cycle.id)}
      >
        {/* Drag Handle */}
        <button 
          type="button"
          {...attributes} 
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="text-zinc-600 hover:text-white cursor-grab active:cursor-grabbing p-1 rounded"
        >
          <GripVertical size={16} />
        </button>

        {/* Expand Icon */}
        <div className="text-zinc-500">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        {/* Nome Editável */}
        <div className="flex-1">
            <input 
                value={cycle.name}
                onChange={(e) => onRename(cycle.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Nome do Ciclo"
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-white uppercase tracking-wide w-full placeholder-zinc-700"
            />
            <span className="text-[9px] text-zinc-600 font-mono block pl-0.5">
                Ciclo #{index + 1}
            </span>
        </div>

        {/* Cycle Ordering Arrows */}
        <div className="flex items-center gap-1 bg-zinc-900/50 rounded border border-zinc-800/50 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); onMove('up'); }}
                disabled={isFirst}
                className="p-1 text-zinc-600 hover:text-purple-400 disabled:opacity-20 disabled:hover:text-zinc-600 transition-colors"
                title="Mover para Cima"
            >
                <ChevronUp size={12} />
            </button>
            <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); onMove('down'); }}
                disabled={isLast}
                className="p-1 text-zinc-600 hover:text-purple-400 disabled:opacity-20 disabled:hover:text-zinc-600 transition-colors"
                title="Mover para Baixo"
            >
                <ChevronDown size={12} />
            </button>
        </div>

        {/* Delete Button (Safe) */}
        <button 
            type="button"
            onClick={(e) => { 
                e.stopPropagation(); 
                onDeleteRequest(cycle); 
            }}
            className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100 ml-2"
            title="Excluir Ciclo"
        >
            <Trash2 size={14} />
        </button>
      </div>

      {/* Conteúdo Expansível (EDITOR) */}
      {isExpanded && (
        <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 animate-in slide-in-from-top-2 duration-200 cursor-default" onClick={e => e.stopPropagation()}>
            {children}
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

const CycleManager: React.FC<CycleManagerProps> = ({ plan, disciplines, folders, onUpdate }) => {
  const [localCycles, setLocalCycles] = useState<Cycle[]>([]);
  const [system, setSystem] = useState<CycleSystem>('continuous');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  
  // Available Simulated Exams
  const [availableExams, setAvailableExams] = useState<SimulatedExam[]>([]);

  // Estado para exclusão segura
  const [cycleToDelete, setCycleToDelete] = useState<Cycle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Sync props to state
  useEffect(() => {
    if (plan) {
        setLocalCycles(plan.cycles || []);
        setSystem(plan.cycleSystem || 'continuous');
        if (plan.cycles?.length === 1 && expandedIds.length === 0) {
            setExpandedIds([plan.cycles[0].id]);
        }
    }
  }, [plan]);

  // Fetch Exams linked to Plan
  useEffect(() => {
    const fetchExams = async () => {
        if (!plan.linkedSimuladoClassId) {
            setAvailableExams([]);
            return;
        }
        try {
            const examsData = await getExams(plan.linkedSimuladoClassId);
            setAvailableExams(examsData);
        } catch (error) {
            console.error("Error fetching exams for cycle:", error);
        }
    };
    fetchExams();
  }, [plan.linkedSimuladoClassId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- HANDLERS ---

  const handleSystemChange = async (newSystem: CycleSystem) => {
    setSystem(newSystem); 
    if (plan.id) await setCycleSystem(plan.id, newSystem);
    onUpdate();
  };

  const handleAddCycle = async () => {
    if (!plan.id) return;
    const name = `Ciclo ${localCycles.length + 1}`;
    await addCycle(plan.id, name);
    onUpdate();
  };

  const requestDeleteCycle = (cycle: Cycle) => {
    setCycleToDelete(cycle);
  };

  const confirmDeleteCycle = async () => {
    if (!plan.id || !cycleToDelete) return;
    setIsDeleting(true);
    try {
        await deleteCycle(plan.id, cycleToDelete.id);
        setLocalCycles(prev => prev.filter(c => c.id !== cycleToDelete.id));
        setCycleToDelete(null);
        onUpdate();
    } catch (error) {
        console.error("Erro ao excluir ciclo:", error);
        alert("Não foi possível excluir o ciclo.");
    } finally {
        setIsDeleting(false);
    }
  };

  const handleRenameCycle = async (id: string, name: string) => {
    setLocalCycles(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    if (plan.id) {
       await updateCycle(plan.id, id, { name });
    }
  };

  const handleUpdateCycleItems = async (cycleId: string, items: CycleItem[]) => {
    setLocalCycles(prev => prev.map(c => c.id === cycleId ? { ...c, items } : c));
    if (plan.id) {
        await updateCycle(plan.id, cycleId, { items });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = localCycles.findIndex(c => c.id === active.id);
        const newIndex = localCycles.findIndex(c => c.id === over.id);
        const newOrder = arrayMove(localCycles, oldIndex, newIndex);
        setLocalCycles(newOrder); 
        if (plan.id) {
            await reorderCycles(plan.id, newOrder);
            onUpdate();
        }
    }
  };

  const handleManualMoveCycle = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localCycles.length) return;
    const newOrder = arrayMove(localCycles, index, newIndex);
    setLocalCycles(newOrder);
    if (plan.id) {
        await reorderCycles(plan.id, newOrder);
        onUpdate();
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* 1. SELETOR DE SISTEMA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Opção Contínuo */}
        <button
            onClick={() => handleSystemChange('continuous')}
            className={`
                relative p-6 rounded-2xl border-2 text-left transition-all duration-300 group overflow-hidden
                ${system === 'continuous' 
                    ? 'bg-emerald-950/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'}
            `}
        >
            <div className={`absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity ${system === 'continuous' ? 'text-emerald-500' : 'text-zinc-600'}`}>
                <InfinityIcon size={40} />
            </div>
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${system === 'continuous' ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                    <InfinityIcon size={20} />
                </div>
                <span className={`text-sm font-black uppercase tracking-wider ${system === 'continuous' ? 'text-white' : 'text-zinc-400'}`}>
                    Ciclo Contínuo
                </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-medium leading-relaxed max-w-[90%]">
                Estudo sequencial de disciplinas. Ao terminar a lista, reinicia-se o processo. Ideal para cobrir todo o edital linearmente.
            </p>
        </button>

        {/* Opção Rotativo */}
        <button
            onClick={() => handleSystemChange('rotative')}
            className={`
                relative p-6 rounded-2xl border-2 text-left transition-all duration-300 group overflow-hidden
                ${system === 'rotative' 
                    ? 'bg-purple-950/20 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.1)]' 
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'}
            `}
        >
            <div className={`absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity ${system === 'rotative' ? 'text-purple-500' : 'text-zinc-600'}`}>
                <RefreshCw size={40} />
            </div>
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${system === 'rotative' ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                    <RefreshCw size={20} />
                </div>
                <span className={`text-sm font-black uppercase tracking-wider ${system === 'rotative' ? 'text-white' : 'text-zinc-400'}`}>
                    Ciclo Rotativo
                </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-medium leading-relaxed max-w-[90%]">
                Alternância dinâmica entre blocos de matérias. Permite priorizar pesos diferentes e revisões intercaladas.
            </p>
        </button>
      </div>

      <div className="h-px bg-zinc-800 w-full" />

      {/* 2. HEADER DA LISTA + SYNC */}
      <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Layout size={14} /> Estrutura dos Ciclos
          </h3>
          
          <div className="flex items-center gap-3">
              {/* Painel de Sincronização */}
              {plan.id && <SyncControlPanel planId={plan.id} variant="minimal" />}
              
              <button 
                  onClick={handleAddCycle}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all active:scale-95"
              >
                  <Plus size={12} /> Novo Ciclo
              </button>
          </div>
      </div>

      {/* 3. GERENCIADOR DE LISTA */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext 
                    items={localCycles.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {localCycles.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl">
                            <span className="text-zinc-600 text-xs font-bold uppercase">Nenhum ciclo criado</span>
                        </div>
                    ) : (
                        localCycles.map((cycle, index) => (
                            <SortableCycleCard 
                                key={cycle.id} 
                                cycle={cycle}
                                index={index}
                                isFirst={index === 0}
                                isLast={index === localCycles.length - 1}
                                isExpanded={expandedIds.includes(cycle.id)}
                                onToggleExpand={toggleExpand}
                                onRename={handleRenameCycle}
                                onDeleteRequest={requestDeleteCycle}
                                onMove={(dir) => handleManualMoveCycle(index, dir)}
                            >
                                <CycleContentEditor 
                                    cycle={cycle}
                                    availableDisciplines={disciplines}
                                    availableFolders={folders}
                                    availableExams={availableExams}
                                    onUpdateItems={(items) => handleUpdateCycleItems(cycle.id, items)}
                                />
                            </SortableCycleCard>
                        ))
                    )}
                </SortableContext>
            </DndContext>
      </div>

      {/* MODAL DE CONFIRMAÇÃO (Segurança) */}
      <ConfirmationModal 
        isOpen={!!cycleToDelete}
        onClose={() => setCycleToDelete(null)}
        onConfirm={confirmDeleteCycle}
        title="Excluir Ciclo de Estudos?"
        message={`Você está prestes a excluir o "${cycleToDelete?.name}". Isso removerá todas as configurações deste ciclo. Essa ação não pode ser desfeita.`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default CycleManager;