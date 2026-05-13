import React, { useState } from 'react';
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
  Plus, X, Trash2, GripVertical, BookOpen, Folder, CheckSquare, Square, ChevronUp, ChevronDown, Trophy
} from 'lucide-react';
import { Cycle, CycleItem, Folder as FolderType } from '../../../services/planService';
import { Discipline } from '../../../services/structureService';
import { SimulatedExam } from '../../../services/simulatedService';

// --- PROPS ---
interface CycleContentEditorProps {
  cycle: Cycle;
  availableDisciplines: Discipline[];
  availableFolders: FolderType[];
  availableExams: SimulatedExam[]; // Lista de Simulados da Turma Vinculada
  onUpdateItems: (items: CycleItem[]) => void;
}

// --- ITEM SORTABLE ---
interface SortableItemProps {
  item: CycleItem;
  name: string;
  isFolder: boolean;
  isSimulated: boolean; // Novo Flag
  isFirst: boolean;
  isLast: boolean;
  onRemove: (id: string) => void;
  onConfigChange: (id: string, val: number) => void;
  onMove: (direction: 'up' | 'down') => void;
}

const SortableCycleItem: React.FC<SortableItemProps> = ({ 
  item, name, isFolder, isSimulated, isFirst, isLast, onRemove, onConfigChange, onMove 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  // --- VISUAL BLACK & GOLD PARA SIMULADOS ---
  if (isSimulated) {
    return (
        <div 
            ref={setNodeRef} 
            style={style}
            className="group relative flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-black border border-yellow-600/50 rounded-lg shadow-lg mb-2 overflow-hidden hover:border-yellow-500 transition-all"
        >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500"></div>
            
            <div className="flex items-center gap-3 relative z-10 flex-1">
                {/* Drag Handle */}
                <button 
                    className="text-yellow-600 hover:text-yellow-400 cursor-grab active:cursor-grabbing p-1"
                    {...attributes} 
                    {...listeners}
                >
                    <GripVertical size={16} />
                </button>

                {/* Manual Sort Arrows */}
                <div className="flex flex-col -space-y-1">
                    <button onClick={() => onMove('up')} disabled={isFirst} className="text-yellow-700 hover:text-yellow-400 disabled:opacity-20"><ChevronUp size={12} /></button>
                    <button onClick={() => onMove('down')} disabled={isLast} className="text-yellow-700 hover:text-yellow-400 disabled:opacity-20"><ChevronDown size={12} /></button>
                </div>

                <div className="p-2 bg-yellow-500/20 rounded text-yellow-500 border border-yellow-500/10">
                    <Trophy size={16} />
                </div>
                
                <div>
                    <h4 className="text-yellow-500 font-black text-[10px] uppercase tracking-wider mb-0.5">
                        META DE SIMULADO
                    </h4>
                    <p className="text-white font-bold text-sm leading-none">{name}</p>
                </div>
            </div>

            {/* Delete */}
            <button 
                onClick={() => onRemove(item.id)}
                className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded hover:bg-red-900/10"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
  }

  // --- VISUAL PADRÃO PARA DISCIPLINAS E PASTAS ---
  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl mb-2 group hover:border-zinc-700 transition-all"
    >
      {/* Drag Handle */}
      <button 
        className="text-zinc-600 hover:text-white cursor-grab active:cursor-grabbing p-1"
        {...attributes} 
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      {/* Manual Sort Arrows */}
      <div className="flex flex-col -space-y-1">
        <button 
            onClick={() => onMove('up')}
            disabled={isFirst}
            className="text-zinc-600 hover:text-purple-400 disabled:opacity-20 disabled:hover:text-zinc-600"
        >
            <ChevronUp size={12} />
        </button>
        <button 
            onClick={() => onMove('down')}
            disabled={isLast}
            className="text-zinc-600 hover:text-purple-400 disabled:opacity-20 disabled:hover:text-zinc-600"
        >
            <ChevronDown size={12} />
        </button>
      </div>

      {/* Icon */}
      <div className={`p-2 rounded-lg ${isFolder ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
        {isFolder ? <Folder size={16} /> : <BookOpen size={16} />}
      </div>

      {/* Name Info */}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-zinc-300 uppercase truncate block">
            {name}
        </span>
        <span className="text-[9px] text-zinc-600 font-mono uppercase">
            {isFolder ? 'Bloco de Disciplinas' : 'Disciplina Isolada'}
        </span>
      </div>

      {/* Config: Topics Per Turn (Enabled for both Folders and Disciplines now) */}
      <div className="flex flex-col items-end gap-1 mr-2">
          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Assuntos/Vez</span>
          <input 
              type="number" 
              min="1" 
              max="10"
              value={item.topicsPerTurn}
              onChange={(e) => onConfigChange(item.id, parseInt(e.target.value) || 1)}
              className="w-12 bg-black border border-zinc-700 rounded px-1 py-1 text-center text-xs font-bold text-white focus:border-purple-500 focus:outline-none"
          />
      </div>

      {/* Delete */}
      <button 
        onClick={() => onRemove(item.id)}
        className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

// --- MAIN COMPONENT ---
const CycleContentEditor: React.FC<CycleContentEditorProps> = ({ 
  cycle, availableDisciplines, availableFolders, availableExams, onUpdateItems 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSimulatedModalOpen, setIsSimulatedModalOpen] = useState(false); // Modal separado para simulados
  const [selectedToAdd, setSelectedToAdd] = useState<{type: 'discipline'|'folder', id: string}[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- HANDLERS ---

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = cycle.items.findIndex(i => i.id === active.id);
        const newIndex = cycle.items.findIndex(i => i.id === over.id);
        onUpdateItems(arrayMove(cycle.items, oldIndex, newIndex));
    }
  };

  const handleManualMove = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= cycle.items.length) return;
    
    const newItems = arrayMove(cycle.items, index, newIndex);
    onUpdateItems(newItems);
  };

  const handleRemove = (itemId: string) => {
    onUpdateItems(cycle.items.filter(i => i.id !== itemId));
  };

  const handleConfigChange = (itemId: string, val: number) => {
    onUpdateItems(cycle.items.map(i => i.id === itemId ? { ...i, topicsPerTurn: val } : i));
  };

  // --- ADDITION LOGIC (DISCIPLINES / FOLDERS) ---

  const toggleSelection = (type: 'discipline'|'folder', id: string) => {
    const exists = selectedToAdd.some(s => s.type === type && s.id === id);
    if (exists) {
        setSelectedToAdd(prev => prev.filter(s => !(s.type === type && s.id === id)));
    } else {
        setSelectedToAdd(prev => [...prev, { type, id }]);
    }
  };

  const confirmAdd = () => {
    const newItems: CycleItem[] = selectedToAdd.map((s, idx) => ({
        id: crypto.randomUUID(),
        type: s.type,
        referenceId: s.id,
        topicsPerTurn: 1, // Default
        order: cycle.items.length + idx
    }));
    
    onUpdateItems([...cycle.items, ...newItems]);
    setSelectedToAdd([]);
    setIsModalOpen(false);
  };

  // --- ADDITION LOGIC (SIMULATED EXAMS) ---
  const handleAddSimulado = (exam: SimulatedExam) => {
    const newItem: CycleItem = {
        id: crypto.randomUUID(),
        type: 'simulado',
        referenceId: exam.id!,
        topicsPerTurn: 1, // Irrelevante para simulado, mas mantido pelo tipo
        order: cycle.items.length,
        simuladoTitle: exam.title,
        duration: exam.duration
    };
    onUpdateItems([...cycle.items, newItem]);
    setIsSimulatedModalOpen(false);
  };

  // --- HELPERS ---
  const getName = (item: CycleItem) => {
    if (item.type === 'folder') return availableFolders.find(f => f.id === item.referenceId)?.name || 'Pasta Removida';
    if (item.type === 'simulado') return item.simuladoTitle || availableExams.find(e => e.id === item.referenceId)?.title || 'Simulado Removido';
    return availableDisciplines.find(d => d.id === item.referenceId)?.name || 'Disciplina Removida';
  };

  return (
    <div className="flex flex-col gap-4">
        {/* LISTA DE ITENS DO CICLO */}
        <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragEnd={handleDragEnd}
        >
            <SortableContext 
                items={cycle.items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="flex flex-col">
                    {cycle.items.length === 0 && (
                        <div className="text-center py-8 text-zinc-600 text-xs font-medium border-2 border-dashed border-zinc-800 rounded-xl mb-2">
                            Ciclo vazio. Adicione itens abaixo.
                        </div>
                    )}
                    {cycle.items.map((item, index) => (
                        <SortableCycleItem 
                            key={item.id}
                            item={item}
                            name={getName(item)}
                            isFolder={item.type === 'folder'}
                            isSimulated={item.type === 'simulado'}
                            isFirst={index === 0}
                            isLast={index === cycle.items.length - 1}
                            onRemove={handleRemove}
                            onConfigChange={handleConfigChange}
                            onMove={(dir) => handleManualMove(index, dir)}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>

        <div className="flex gap-2">
            {/* BOTÃO ADICIONAR DISCIPLINA/PASTA */}
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
                <Plus size={14} /> Adicionar Disciplina
            </button>

            {/* BOTÃO ADICIONAR SIMULADO (CONDICIONAL) */}
            {availableExams.length > 0 && (
                <button 
                    onClick={() => setIsSimulatedModalOpen(true)}
                    className="flex-1 py-3 bg-[#1a1d24] border border-yellow-600/30 hover:border-yellow-500 text-yellow-600 hover:text-yellow-400 rounded-xl transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 group"
                >
                    <Trophy size={14} /> Inserir Simulado
                </button>
            )}
        </div>

        {/* MODAL DE SELEÇÃO (DISCIPLINAS) */}
        {isModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                        <span className="text-sm font-black text-white uppercase tracking-tighter">Selecionar Conteúdo</span>
                        <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={18}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                        
                        {/* PASTAS */}
                        {availableFolders.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 pl-1">Pastas</h4>
                                <div className="space-y-1">
                                    {availableFolders.map(f => {
                                        const selected = selectedToAdd.some(s => s.type === 'folder' && s.id === f.id);
                                        return (
                                            <div 
                                                key={f.id} 
                                                onClick={() => toggleSelection('folder', f.id)}
                                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${selected ? 'bg-purple-900/20 border-purple-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900'}`}
                                            >
                                                {selected ? <CheckSquare size={16} className="text-purple-500"/> : <Square size={16} className="text-zinc-600"/>}
                                                <Folder size={16} className={selected ? 'text-purple-400' : 'text-zinc-500'} />
                                                <span className={`text-xs font-bold uppercase ${selected ? 'text-white' : 'text-zinc-400'}`}>{f.name}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* DISCIPLINAS */}
                        <div>
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 pl-1 mt-2">Disciplinas</h4>
                            <div className="space-y-1">
                                {availableDisciplines.map(d => {
                                    const selected = selectedToAdd.some(s => s.type === 'discipline' && s.id === d.id);
                                    return (
                                        <div 
                                            key={d.id} 
                                            onClick={() => toggleSelection('discipline', d.id!)}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${selected ? 'bg-blue-900/20 border-blue-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900'}`}
                                        >
                                            {selected ? <CheckSquare size={16} className="text-blue-500"/> : <Square size={16} className="text-zinc-600"/>}
                                            <BookOpen size={16} className={selected ? 'text-blue-400' : 'text-zinc-500'} />
                                            <span className={`text-xs font-bold uppercase ${selected ? 'text-white' : 'text-zinc-400'}`}>{d.name}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                        <button 
                            onClick={confirmAdd}
                            disabled={selectedToAdd.length === 0}
                            className="w-full py-3 bg-brand-red hover:bg-red-600 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            Adicionar Selecionados ({selectedToAdd.length})
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL DE SELEÇÃO (SIMULADOS) */}
        {isSimulatedModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-md bg-zinc-950 border border-yellow-600/30 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                        <span className="text-sm font-black text-white uppercase tracking-tighter flex items-center gap-2">
                            <Trophy size={16} className="text-yellow-500" /> Selecionar Simulado
                        </span>
                        <button onClick={() => setIsSimulatedModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={18}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                        {availableExams.map(exam => (
                            <button
                                key={exam.id}
                                onClick={() => handleAddSimulado(exam)}
                                className="w-full text-left p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-yellow-500 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-all text-xs font-bold uppercase group"
                            >
                                <span className="group-hover:text-yellow-400 transition-colors">{exam.title}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CycleContentEditor;