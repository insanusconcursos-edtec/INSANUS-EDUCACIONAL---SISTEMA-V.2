
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Clock, BookOpen, Check, ChevronLeft, Pencil, Plus, Save, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast, { Toaster } from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../services/firebase';

interface PlannerEvent {
  id: string;
  title: string;
  color: string;
  startTime: string;
  endTime: string;
  isStudy: boolean;
  isFreeStudy?: boolean;
  days: number[];
}

export interface RoutineTemplate {
  id: string;
  name: string;
  events: PlannerEvent[];
}

interface WeeklyPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (routine: Record<number, number>) => void;
  initialRoutines?: RoutineTemplate[];
  initialActiveRoutineId?: string;
  onSaveTemplates: (templates: RoutineTemplate[], activeId: string) => void;
}

const DAYS = [
  { id: 0, label: 'Dom', full: 'Domingo' },
  { id: 1, label: 'Seg', full: 'Segunda' },
  { id: 2, label: 'Ter', full: 'Terça' },
  { id: 3, label: 'Qua', full: 'Quarta' },
  { id: 4, label: 'Qui', full: 'Quinta' },
  { id: 5, label: 'Sex', full: 'Sexta' },
  { id: 6, label: 'Sáb', full: 'Sábado' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // pixels per hour

const COLORS = [
  { name: 'Zinc', value: '#3f3f46' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
];

const WeeklyPlannerModal: React.FC<WeeklyPlannerModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialRoutines = [], 
  initialActiveRoutineId,
  onSaveTemplates 
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PlannerEvent | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  
  const [savedRoutines, setSavedRoutines] = useState<RoutineTemplate[]>([]);
  const [activeRoutineId, setActiveRoutineId] = useState<string>("");
  const [isHydrated, setIsHydrated] = useState(false);

  React.useEffect(() => {
    // Se temos dados iniciais e ainda não hidratamos com sucesso ou estamos vazios
    if (initialRoutines && initialRoutines.length > 0) {
      if (!isHydrated || savedRoutines.length === 0) {
        setSavedRoutines(initialRoutines);
        setActiveRoutineId(initialActiveRoutineId || initialRoutines[0].id);
        setIsHydrated(true);
      }
    } else if (!isHydrated) {
      // Se não temos dados, inicializamos com o padrão
      setSavedRoutines([{ id: 'default-1', name: 'MINHA ROTINA 1', events: [] }]);
      setActiveRoutineId('default-1');
      setIsHydrated(true);
    }
  }, [initialRoutines, initialActiveRoutineId, isHydrated, savedRoutines.length]);
  
  const activeRoutine = savedRoutines.find(r => String(r.id) === String(activeRoutineId)) || (savedRoutines.length > 0 ? savedRoutines[0] : { id: 'default-1', name: 'MINHA ROTINA 1', events: [] });
  const [events, setEvents] = useState<PlannerEvent[]>(activeRoutine.events);

  React.useEffect(() => {
    const routine = savedRoutines.find(r => String(r.id) === String(activeRoutineId));
    if (routine) setEvents(routine.events);
  }, [activeRoutineId, savedRoutines]);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formColor, setFormColor] = useState(COLORS[0].value);
  const [formStart, setFormStart] = useState('08:00');
  const [formEnd, setFormEnd] = useState('09:00');
  const [formIsStudy, setFormIsStudy] = useState(false);
  const [formIsFreeStudy, setFormIsFreeStudy] = useState(false);
  const [formDays, setFormDays] = useState<number[]>([]);

  const handleAddRoutine = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Executando: handleAddRoutine");

    // 1. Gera um ID único simples
    const newId = `routine-${Date.now()}`; 
    
    // 2. Define o nome provisório
    const newRoutineName = `NOVA ROTINA ${savedRoutines.length + 1}`;

    // 3. Cria o objeto zerado
    const newRoutine: RoutineTemplate = {
        id: newId,
        name: newRoutineName,
        events: []
    };

    // 4. Atualiza os estados
    const updatedRoutines = [...savedRoutines, newRoutine];
    setSavedRoutines(updatedRoutines);
    setActiveRoutineId(newId);
    setEvents([]);
    onSaveTemplates(updatedRoutines, newId);
  };

  const handleRenameRoutine = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const routine = savedRoutines.find(r => String(r.id) === String(activeRoutineId));
    if (routine) {
      setNewRoutineName(routine.name);
      setShowRenameModal(true);
    }
  };

  const confirmRename = () => {
    if (newRoutineName.trim() !== "") {
      const updatedRoutines = savedRoutines.map(r => String(r.id) === String(activeRoutineId) ? { ...r, name: newRoutineName } : r);
      setSavedRoutines(updatedRoutines);
      onSaveTemplates(updatedRoutines, activeRoutineId);
      setShowRenameModal(false);
      toast.success("Rotina renomeada!");
    }
  };

  const handleSaveRoutine = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Executando: handleSaveRoutine");

    if (savedRoutines.length === 0) {
      toast.error("Não há rotinas para salvar.");
      return;
    }

    if (!auth.currentUser || !auth.currentUser.uid) {
      console.error("Falha: Usuário não autenticado no momento do salvamento.");
      toast.error("Erro de autenticação. Recarregue a página.");
      return;
    }

    const toastId = toast.loading("Salvando rotina...");

    try {
      const updatedRoutines = savedRoutines.map(r => r.id === activeRoutineId ? { ...r, events } : r);
      setSavedRoutines(updatedRoutines);
      onSaveTemplates(updatedRoutines, activeRoutineId);

      const payload = {
        savedRoutines: updatedRoutines,
        activeRoutineId: activeRoutineId
      };
      console.log("Payload de Salvamento:", payload);

      await updateDoc(doc(db, "users", auth.currentUser.uid), payload);
      toast.success("Rotina salva com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao salvar no banco de dados:", error);
      toast.error("Erro ao salvar no banco de dados.", { id: toastId });
    }
  };

  const handleDeleteRoutine = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Executando: handleDeleteRoutine");
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!auth.currentUser || !auth.currentUser.uid) {
      toast.error("Erro de autenticação.");
      return;
    }

    // 1. Filtra a lista removendo a rotina ativa
    const updatedRoutines = savedRoutines.filter(r => String(r.id) !== String(activeRoutineId));
    
    // 2. Define qual será a nova rotina ativa (a primeira da lista restante)
    let nextActiveId = updatedRoutines.length > 0 ? updatedRoutines[0].id : "";
    
    // 3. Fallback: Se não sobrar nenhuma, cria uma nova vazia
    if (updatedRoutines.length === 0) {
        const defaultRoutine = { id: 'default-1', name: 'MINHA ROTINA 1', events: [] };
        updatedRoutines.push(defaultRoutine);
        nextActiveId = 'default-1';
    }

    // 4. Persistência no Banco de Dados
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            savedRoutines: updatedRoutines,
            activeRoutineId: nextActiveId
        });
        
        // 5. Atualiza o estado local e fecha o modal
        setSavedRoutines(updatedRoutines);
        setActiveRoutineId(nextActiveId);
        onSaveTemplates(updatedRoutines, nextActiveId);
        setShowDeleteConfirm(false);
        toast.success("Rotina excluída com sucesso!");
    } catch (error) {
        console.error("Erro ao excluir:", error);
        toast.error("Erro ao excluir no banco de dados.");
    }
  };

  const calculateRoutine = () => {
    const routineMinutes: Record<number, number> = {};
    DAYS.forEach(day => routineMinutes[day.id] = 0);
    
    events.forEach(event => {
      // Somente contabiliza como capacidade regular se for estudo e NÃO for livre
      if (event.isStudy && !event.isFreeStudy) {
        const start = timeToMinutes(event.startTime);
        const end = timeToMinutes(event.endTime);
        const duration = end - start;
        event.days.forEach(dayId => {
          routineMinutes[dayId] = (routineMinutes[dayId] || 0) + duration;
        });
      }
    });
    
    onSave(routineMinutes);
    onClose();
  };

  const handleRoutineChange = (id: string) => {
    setActiveRoutineId(id);
    const routine = savedRoutines.find(r => r.id === id);
    if (routine) setEvents(routine.events);
  };

  const handleGridClick = (dayId: number, hour: number) => {
    setEditingEvent(null);
    setFormTitle('');
    setFormColor(COLORS[0].value);
    setFormStart(`${hour.toString().padStart(2, '0')}:00`);
    setFormEnd(`${(hour + 1).toString().padStart(2, '0')}:00`);
    setFormIsStudy(false);
    setFormIsFreeStudy(false);
    setFormDays([dayId]);
    setShowForm(true);
  };

  const handleEditClick = (event: PlannerEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormColor(event.color);
    setFormStart(event.startTime);
    setFormEnd(event.endTime);
    setFormIsStudy(event.isStudy);
    setFormIsFreeStudy(!!event.isFreeStudy);
    setFormDays(event.days);
    setShowForm(true);
  };

  const handleToggleDay = (dayId: number) => {
    setFormDays(prev => prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]);
  };

  const handleSaveEvent = () => {
    const newEvent: PlannerEvent = {
      id: editingEvent ? editingEvent.id : Math.random().toString(36).substr(2, 9),
      title: formIsStudy ? (formIsFreeStudy ? 'ESTUDO LIVRE' : 'ESTUDOS') : formTitle,
      color: formIsStudy ? (formIsFreeStudy ? '#10b981' : '#ef4444') : formColor,
      startTime: formStart,
      endTime: formEnd,
      isStudy: formIsStudy,
      isFreeStudy: formIsFreeStudy,
      days: formDays
    };

    const newEvents = editingEvent 
      ? events.map(e => e.id === editingEvent.id ? newEvent : e)
      : [...events, newEvent];
      
    setEvents(newEvents);
    const updatedRoutines = savedRoutines.map(r => r.id === activeRoutineId ? { ...r, events: newEvents } : r);
    setSavedRoutines(updatedRoutines);
    onSaveTemplates(updatedRoutines, activeRoutineId);
    setShowForm(false);
  };

  const handleDeleteEvent = (id: string) => {
    const newEvents = events.filter(e => e.id !== id);
    setEvents(newEvents);
    const updatedRoutines = savedRoutines.map(r => r.id === activeRoutineId ? { ...r, events: newEvents } : r);
    setSavedRoutines(updatedRoutines);
    onSaveTemplates(updatedRoutines, activeRoutineId);
    setShowForm(false);
  };

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // ... (rest of the component logic remains the same, just need to update the header)


  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 w-screen h-screen bg-zinc-950 flex flex-col overflow-hidden"
      style={{ zIndex: 999999 }}
    >
      <Toaster position="top-right" />
      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-700">
            <h2 className="mb-4 text-lg font-bold text-white uppercase tracking-widest">Excluir Rotina?</h2>
            <p className="mb-6 text-zinc-400 text-sm">
              Você tem certeza que deseja apagar a <strong>{activeRoutine?.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-zinc-400 hover:text-white border border-zinc-700"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="rounded-lg bg-brand-red px-4 py-2 font-bold text-white hover:bg-red-600"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-700">
            <h2 className="mb-4 text-lg font-bold text-white uppercase tracking-widest">Renomear Rotina</h2>
            <input
              type="text"
              value={newRoutineName}
              onChange={(e) => setNewRoutineName(e.target.value)}
              className="mb-6 w-full rounded-lg bg-zinc-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
              placeholder="Novo nome da rotina"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowRenameModal(false)}
                className="rounded-lg px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmRename}
                className="rounded-lg bg-brand-red px-4 py-2 font-bold text-white hover:bg-red-600"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6 shrink-0">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors font-black text-xs uppercase tracking-widest"
        >
          <ChevronLeft size={20} /> Voltar
        </button>
        
        <div className="flex items-center gap-4">
          <select 
            value={activeRoutineId}
            onChange={(e) => handleRoutineChange(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-black text-white px-3 py-2 uppercase tracking-widest"
          >
            {savedRoutines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="flex items-center gap-2 border-l border-white/10 pl-4 ml-4">
            <button onClick={handleRenameRoutine} type="button" className="p-2 text-gray-400 bg-white/5 border border-white/10 rounded-md hover:text-white hover:bg-white/10 hover:border-white/20 transition-all focus:outline-none" title="Renomear Rotina"><Pencil size={18} /></button>
            <button onClick={handleAddRoutine} type="button" className="p-2 text-gray-400 bg-white/5 border border-white/10 rounded-md hover:text-white hover:bg-white/10 hover:border-white/20 transition-all focus:outline-none" title="Nova Rotina"><Plus size={18} /></button>
            <button 
              onClick={handleSaveRoutine} 
              disabled={savedRoutines.length === 0}
              type="button" 
              className={`p-2 text-gray-400 bg-white/5 border border-white/10 rounded-md hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all focus:outline-none ${savedRoutines.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} 
              title="Salvar Rotina"
            >
              <Save size={18} />
            </button>
            <button onClick={handleDeleteRoutine} type="button" className="p-2 text-gray-400 bg-white/5 border border-white/10 rounded-md hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/30 transition-all focus:outline-none" title="Excluir Rotina"><Trash2 size={18} /></button>
          </div>
        </div>

        <button 
          onClick={calculateRoutine}
          className="bg-brand-red hover:bg-red-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-brand-red/20 flex items-center gap-2"
        >
          <Check size={16} /> Salvar Planejamento
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Time Grid Container - Scrollable */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto custom-scrollbar relative w-full"
        >
          {/* Days Header - Sticky */}
          <div className="sticky top-0 z-20 flex w-full bg-zinc-900 border-b border-zinc-800 shrink-0">
            <div className="w-16 border-r border-zinc-800 shrink-0" /> {/* Time column spacer */}
            <div className="flex-1 grid grid-cols-7">
              {DAYS.map(day => (
                <div key={day.id} className="py-4 text-center border-r border-zinc-800 last:border-r-0">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">{day.full}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grid Body */}
          <div className="flex w-full" style={{ height: HOURS.length * HOUR_HEIGHT }}>
            {/* Time Column */}
            <div className="w-16 border-r border-zinc-800 bg-zinc-900/10 shrink-0 relative">
              {HOURS.map(hour => (
                <div 
                  key={hour} 
                  className="absolute w-full text-right pr-2 text-[9px] font-bold text-zinc-600 uppercase"
                  style={{ top: hour * HOUR_HEIGHT + 24 }} // Offset for header height
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day Columns */}
            <div className="flex-1 grid grid-cols-7 relative">
              {DAYS.map(day => (
                <div 
                  key={day.id} 
                  className="relative border-r border-zinc-800 last:border-r-0 group"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const hour = Math.floor(y / HOUR_HEIGHT);
                    handleGridClick(day.id, hour);
                  }}
                >
                  {/* Horizontal Lines */}
                  {HOURS.map(hour => (
                    <div 
                      key={hour}
                      className="absolute w-full border-b border-white/5 pointer-events-none"
                      style={{ top: (hour + 1) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Events in this day */}
                  {events.filter(ev => ev.days.includes(day.id)).map(event => {
                    const startMin = timeToMinutes(event.startTime);
                    const endMin = timeToMinutes(event.endTime);
                    const top = (startMin / 60) * HOUR_HEIGHT;
                    const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;

                    return (
                      <div
                        key={`${event.id}-${day.id}`}
                        onClick={(e) => handleEditClick(event, e)}
                        className={`absolute inset-x-1 rounded-lg border-l-4 p-2 shadow-xl cursor-pointer hover:brightness-125 transition-all overflow-hidden z-10 ${event.isFreeStudy ? 'animate-pulse ring-1 ring-emerald-500/50' : ''}`}
                        style={{ 
                          top: top + 2, 
                          height: height - 4,
                          backgroundColor: `${event.color}25`,
                          borderColor: event.color
                        }}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[9px] font-black uppercase tracking-tighter truncate" style={{ color: event.color }}>
                            {event.startTime} - {event.endTime}
                          </span>
                          {event.isStudy && (
                            event.isFreeStudy ? <Trophy size={10} className="text-emerald-500 shrink-0" /> : <BookOpen size={10} className="text-brand-red shrink-0" />
                          )}
                        </div>
                        <h4 className="text-[10px] font-black text-white leading-tight break-words uppercase tracking-tighter">
                          {event.title}
                        </h4>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Form Overlay */}
        <AnimatePresence>
          {showForm && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowForm(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="absolute right-0 top-0 bottom-0 w-96 bg-zinc-900 border-l border-zinc-800 z-50 p-8 flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-widest">
                      {editingEvent ? 'Editar Atividade' : 'Nova Atividade'}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Configure os detalhes do bloco</p>
                  </div>
                  <button onClick={() => setShowForm(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2">
                  {/* Study Toggle */}
                  <div className="space-y-4">
                    <button 
                      onClick={() => {
                        const nextValue = !formIsStudy;
                        setFormIsStudy(nextValue);
                        if (!nextValue) setFormIsFreeStudy(false);
                      }}
                      className={`
                        w-full p-5 rounded-2xl border flex items-center justify-between transition-all
                        ${formIsStudy ? 'bg-brand-red/10 border-brand-red' : 'bg-zinc-950 border-zinc-800'}
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${formIsStudy ? 'bg-brand-red text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                          <BookOpen size={20} />
                        </div>
                        <div className="text-left">
                          <span className={`text-xs font-black uppercase block tracking-widest ${formIsStudy ? 'text-brand-red' : 'text-zinc-400'}`}>É ESTUDO?</span>
                          <span className="text-[10px] text-zinc-500 font-medium">Contabiliza na disponibilidade</span>
                        </div>
                      </div>
                      <div className={`w-12 h-6 rounded-full relative transition-colors ${formIsStudy ? 'bg-brand-red' : 'bg-zinc-800'}`}>
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formIsStudy ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                    </button>

                    {formIsStudy && (
                      <button 
                        onClick={() => setFormIsFreeStudy(!formIsFreeStudy)}
                        className={`
                          w-full p-5 rounded-2xl border flex items-center justify-between transition-all animate-in slide-in-from-top-2
                          ${formIsFreeStudy ? 'bg-emerald-500/10 border-emerald-500' : 'bg-zinc-950 border-zinc-800'}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${formIsFreeStudy ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                            <Trophy size={20} />
                          </div>
                          <div className="text-left">
                            <span className={`text-xs font-black uppercase block tracking-widest ${formIsFreeStudy ? 'text-emerald-500' : 'text-zinc-400'}`}>ESTUDO LIVRE?</span>
                            <span className="text-[10px] text-zinc-500 font-medium">Não avança o ciclo de metas</span>
                          </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full relative transition-colors ${formIsFreeStudy ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formIsFreeStudy ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Título da Atividade</label>
                    <input 
                      type="text"
                      value={formIsStudy ? (formIsFreeStudy ? 'ESTUDO LIVRE' : 'ESTUDOS') : formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      disabled={formIsStudy}
                      placeholder="Ex: Trabalho, Academia, Sono..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:border-brand-red outline-none disabled:opacity-50 transition-all font-bold uppercase"
                    />
                  </div>

                  {/* Times */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Início</label>
                      <div className="relative">
                        <Clock size={16} className="absolute left-4 top-4 text-zinc-600" />
                        <input 
                          type="time"
                          value={formStart}
                          onChange={e => setFormStart(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 pl-12 text-sm text-white focus:border-brand-red outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Término</label>
                      <div className="relative">
                        <Clock size={16} className="absolute left-4 top-4 text-zinc-600" />
                        <input 
                          type="time"
                          value={formEnd}
                          onChange={e => setFormEnd(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 pl-12 text-sm text-white focus:border-brand-red outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Color Picker */}
                  {!formIsStudy && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Cor do Bloco</label>
                      <div className="flex flex-wrap gap-3">
                        {COLORS.map(color => (
                          <button 
                            key={color.value}
                            onClick={() => setFormColor(color.value)}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${formColor === color.value ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            style={{ backgroundColor: color.value }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Days Selection */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Repetir nos dias</label>
                    <div className="grid grid-cols-4 gap-2">
                      {DAYS.map(day => (
                        <button 
                          key={day.id}
                          onClick={() => handleToggleDay(day.id)}
                          className={`
                            py-3 rounded-xl text-[10px] font-black uppercase transition-all border
                            ${formDays.includes(day.id) 
                              ? 'bg-brand-red border-brand-red text-white shadow-lg shadow-brand-red/20' 
                              : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-600'}
                          `}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 flex flex-col gap-3">
                  {editingEvent && (
                    <button 
                      onClick={() => handleDeleteEvent(editingEvent.id)}
                      className="w-full py-4 rounded-xl border border-red-500/30 text-red-500 text-xs font-black uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Excluir Bloco
                    </button>
                  )}
                  <button 
                    onClick={handleSaveEvent}
                    className="w-full py-5 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-xl"
                  >
                    <Check size={18} /> {editingEvent ? 'Salvar Alterações' : 'Adicionar à Grade'}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Summary Bar */}
      <footer className="h-14 border-t border-zinc-800 bg-zinc-900/80 px-6 flex items-center justify-between shrink-0">
        <Toaster position="top-right" toastOptions={{ style: { zIndex: 99999 } }} />
        <div className="flex items-center gap-8">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Resumo Semanal:</span>
          <div className="flex gap-6">
            {DAYS.map(day => {
              const dayStudyMin = events
                .filter(e => e.isStudy && e.days.includes(day.id))
                .reduce((acc, curr) => acc + (timeToMinutes(curr.endTime) - timeToMinutes(curr.startTime)), 0);
              
              return (
                <div key={day.id} className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-zinc-600 uppercase">{day.label}</span>
                  <span className={`text-[10px] font-black ${dayStudyMin > 0 ? 'text-brand-red' : 'text-zinc-800'}`}>
                    {(dayStudyMin / 60).toFixed(1)}h
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-brand-red" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">
            Total: <span className="text-brand-red">
              {(events.filter(e => e.isStudy).reduce((acc, curr) => {
                const duration = timeToMinutes(curr.endTime) - timeToMinutes(curr.startTime);
                return acc + (duration * curr.days.length);
              }, 0) / 60).toFixed(1)}h
            </span> / semana
          </span>
        </div>
      </footer>
    </div>,
    document.body
  );
};

export default WeeklyPlannerModal;
