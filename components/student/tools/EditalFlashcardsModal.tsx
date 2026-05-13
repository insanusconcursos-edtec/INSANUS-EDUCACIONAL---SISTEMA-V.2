
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Plus, Layers, Trash2, Edit3, Play, 
  Loader2, AlertTriangle, TextCursor, CheckCircle2,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  getUserContent, 
  createUserContent, 
  deleteUserContent, 
  updateUserContent,
  UserContentItem 
} from '../../../services/userContentService';
import FlashcardFullscreenEditor from '../../admin/metas/tools/FlashcardFullscreenEditor';
import FlashcardPlayerModal from '../FlashcardPlayerModal';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import toast from 'react-hot-toast';

interface EditalFlashcardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  editalNodeId: string;
  topicTitle: string;
}

export const EditalFlashcardsModal: React.FC<EditalFlashcardsModalProps> = ({
  isOpen,
  onClose,
  planId,
  editalNodeId,
  topicTitle
}) => {
  const { currentUser } = useAuth();
  
  // Data State
  const [items, setItems] = useState<UserContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<UserContentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editorMode, setEditorMode] = useState<'VIEW' | 'EDIT' | 'NONE'>('NONE');
  
  // Creation/Rename State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const [itemToRename, setItemToRename] = useState<UserContentItem | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Deletion State
  const [itemToDelete, setItemToDelete] = useState<UserContentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // Load items on mount/open
  useEffect(() => {
    if (isOpen && currentUser) {
      loadItems();
    }
  }, [isOpen, currentUser, editalNodeId]);

  const loadItems = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const data = await getUserContent(currentUser.uid, planId, editalNodeId, 'FLASHCARD');
      setItems(data);
      if (data.length > 0 && !selectedItem) {
          // Don't auto-select to avoid accidental play/edit
      }
    } catch (error) {
      console.error("Erro ao carregar flashcards:", error);
      toast.error("Erro ao carregar flashcards");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectItem = (item: UserContentItem, mode: 'VIEW' | 'EDIT') => {
    setSelectedItem(item);
    setEditorMode(mode);
  };

  const handleCreateConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newItemTitle.trim()) return;

    setIsCreating(true);
    try {
      await createUserContent(currentUser.uid, planId, editalNodeId, 'FLASHCARD', newItemTitle);
      toast.success("Deck criado com sucesso");
      setNewItemTitle('');
      setIsCreateModalOpen(false);
      await loadItems();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar deck");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRenameConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !itemToRename || !renameTitle.trim()) return;

    setIsRenaming(true);
    try {
      await updateUserContent(currentUser.uid, planId, itemToRename.id, { title: renameTitle.toUpperCase() });
      toast.success("Deck renomeado");
      setItemToRename(null);
      await loadItems();
      
      // Update selected item if it's the one renamed
      if (selectedItem?.id === itemToRename.id) {
          setSelectedItem(prev => prev ? { ...prev, title: renameTitle.toUpperCase() } : null);
      }
    } catch (error) {
      toast.error("Erro ao renomear");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteUserContent(currentUser.uid, planId, itemToDelete.id);
      toast.success("Deck excluído");
      if (selectedItem?.id === itemToDelete.id) {
          setSelectedItem(null);
          setEditorMode('NONE');
      }
      setItemToDelete(null);
      await loadItems();
    } catch (error) {
      toast.error("Erro ao excluir");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveData = async (data: any) => {
    if (!currentUser || !selectedItem) return;
    setSaveStatus('saving');
    try {
      await updateUserContent(currentUser.uid, planId, selectedItem.id, { data });
      
      // Update local state to maintain persistence without reloading everything
      setSelectedItem(prev => prev ? { ...prev, data } : null);
      setItems(prev => prev.map(item => item.id === selectedItem.id ? { ...item, data } : item));
      
      setSaveStatus('success');
      toast.success("Conteúdo salvo");
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      toast.error("Erro ao salvar");
      setSaveStatus('idle');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-zinc-950 flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-300">
      
      {/* Sidebar */}
      <div className={`relative flex flex-col h-full bg-[#0c0c0e] border-r border-white/10 transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
        isSidebarOpen ? 'w-full md:w-[320px] opacity-100' : 'w-0 opacity-0 border-r-0'
      }`}>
        <div className="w-[320px] h-full flex flex-col shrink-0">
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#121214]">
            <div className="flex items-center gap-3">
              <Layers className="text-pink-500" size={20} />
              <h2 className="text-sm font-black text-white uppercase tracking-tight">Meus Decks</h2>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
              <PanelLeftClose size={18} />
            </button>
          </div>

          <div className="p-4 border-b border-white/5">
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              disabled={items.length >= 10}
              className="w-full py-2.5 flex items-center justify-center gap-2 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-xl text-pink-500 font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
            >
              <Plus size={16} />
              Novo Deck
            </button>
            <p className="text-[9px] text-zinc-600 mt-2 text-center uppercase font-bold">
               {items.length}/10 Decks Criados
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="animate-spin text-zinc-600" size={20} />
                <span className="text-[10px] text-zinc-600 font-bold uppercase">Carregando...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-10 opacity-50 px-4">
                <Layers size={32} className="mx-auto mb-3 text-zinc-700" />
                <p className="text-[10px] text-zinc-600 font-bold uppercase">Nenhum deck criado para este tópico.</p>
              </div>
            ) : (
              items.map(item => (
                <div 
                  key={item.id}
                  className={`group flex flex-col p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedItem?.id === item.id 
                      ? 'bg-pink-500/5 border-pink-500/20' 
                      : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'
                  }`}
                  onClick={() => handleSelectItem(item, 'VIEW')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-xs font-bold truncate ${selectedItem?.id === item.id ? 'text-white' : 'text-zinc-500'}`}>
                      {item.title}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setItemToRename(item); setRenameTitle(item.title); }}
                        className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-white"
                      >
                        <TextCursor size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                        className="p-1 hover:bg-red-500/10 rounded text-zinc-500 hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleSelectItem(item, 'VIEW'); }}
                        className="flex-1 py-1 bg-zinc-900 hover:bg-zinc-800 text-[9px] font-bold uppercase text-zinc-400 rounded-md border border-white/5 transition-all flex items-center justify-center gap-1"
                    >
                        <Play size={10} /> Jogar
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleSelectItem(item, 'EDIT'); }}
                        className="flex-1 py-1 bg-zinc-900 hover:bg-zinc-800 text-[9px] font-bold uppercase text-zinc-400 rounded-md border border-white/5 transition-all flex items-center justify-center gap-1"
                    >
                        <Edit3 size={10} /> Editar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative bg-[#09090b]">
        
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 bg-[#121214] shrink-0">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/5 border border-white/10 rounded-lg text-zinc-400 hover:text-white transition-all">
                <PanelLeftOpen size={20} />
              </button>
            )}
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight leading-tight">Flashcards Interativos</h2>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-0.5">Tópico: {topicTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {editorMode === 'NONE' ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-full bg-pink-500/5 flex items-center justify-center mb-6 border border-pink-500/10">
                <Layers size={40} className="text-zinc-700" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Selecione um Deck</h3>
              <p className="text-zinc-500 text-sm max-w-sm">Escolha um deck na barra lateral para começar a estudar ou editar o conteúdo.</p>
            </div>
          ) : editorMode === 'EDIT' && selectedItem ? (
             <div className="h-full flex flex-col animate-in fade-in duration-300">
                <FlashcardFullscreenEditor 
                    cards={selectedItem.data || []}
                    onChange={handleSaveData}
                    onClose={() => setEditorMode('NONE')}
                    accentColor="#ec4899"
                />
             </div>
          ) : editorMode === 'VIEW' && selectedItem ? (
            <div className="h-full flex flex-col animate-in fade-in duration-300">
                <FlashcardPlayerModal 
                    isOpen={true}
                    onClose={() => setEditorMode('NONE')}
                    flashcards={selectedItem.data || []}
                    title={selectedItem.title}
                    accentColor="#ec4899"
                />
            </div>
          ) : null}
        </div>
      </div>

      {/* Auxiliary Modals */}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsCreateModalOpen(false)}>
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4">Novo Deck de Flashcards</h3>
                <form onSubmit={handleCreateConfirm}>
                    <input 
                        value={newItemTitle}
                        onChange={e => setNewItemTitle(e.target.value)}
                        placeholder="Ex: Tópico 01 - Revisão"
                        autoFocus
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 font-bold uppercase mb-4"
                    />
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Cancelar</button>
                        <button type="submit" disabled={isCreating || !newItemTitle.trim()} className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2">
                             {isCreating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                             Criar
                        </button>
                    </div>
                </form>
            </div>
        </div>, document.body
      )}

      {itemToRename && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setItemToRename(null)}>
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-4">Renomear Deck</h3>
                <form onSubmit={handleRenameConfirm}>
                    <input 
                        value={renameTitle}
                        onChange={e => setRenameTitle(e.target.value)}
                        placeholder="Novo título..."
                        autoFocus
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-bold uppercase mb-4"
                    />
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setItemToRename(null)} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Cancelar</button>
                        <button type="submit" disabled={isRenaming || !renameTitle.trim()} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg">
                             {isRenaming ? <Loader2 size={14} className="animate-spin" /> : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>, document.body
      )}

      <ConfirmationModal 
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDelete}
        title="Excluir Deck?"
        message={`Tem certeza que deseja excluir permanentemente o deck "${itemToDelete?.title}"? Esta ação não pode ser desfeita.`}
        isLoading={isDeleting}
        confirmText="Sim, Excluir"
        variant="danger"
      />

    </div>,
    document.body
  );
};
