
import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { MentorshipModule, MentorshipLesson, MentorshipContent } from '../../../../types/mentorship';
import { MentorshipContentModal } from './MentorshipContentModal';
import { ConfirmationModal } from '../../ui/ConfirmationModal';

// Função auxiliar simples para gerar ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Tipo auxiliar para itens mistos na lista
type MixedItem = 
  | { type: 'submodule'; data: any; order: number }
  | { type: 'lesson'; data: MentorshipLesson; order: number };

interface MentorshipModuleDetailProps {
  planId: string;
  module: MentorshipModule;
  onBack: () => void;
  onEdit: () => void; // NOVO PROP
  onUpdateModule: (updatedModule: MentorshipModule) => Promise<void>;
}

export function MentorshipModuleDetail({ planId, module, onBack, onEdit, onUpdateModule }: MentorshipModuleDetailProps) {
  // --- NAVEGAÇÃO (Breadcrumbs) ---
  const [navigationPath, setNavigationPath] = useState<{id: string, title: string}[]>([]);

  // --- CONTROLE DE ACORDEÃO (Pastas Abertas) ---
  // Armazena quais pastas estão expandidas visualmente (Key: ID da pasta, Value: true)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // --- ESTADOS DE CRIAÇÃO ---
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const [isCreatingSubmodule, setIsCreatingSubmodule] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');

  // --- ESTADOS DE EDIÇÃO (RENOMEAR) ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleTemp, setEditTitleTemp] = useState('');

  // --- ESTADOS DE EXCLUSÃO ---
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'lesson' | 'submodule'} | null>(null);

  // --- MODAL DE CONTEÚDOS ---
  const [selectedLessonForContent, setSelectedLessonForContent] = useState<MentorshipLesson | null>(null);

  // --- HELPER: ENCONTRAR CONTAINER ATUAL (Recursividade) ---
  const getCurrentContainer = () => {
    let current: any = module;
    for (const pathItem of navigationPath) {
        if (current.subModules) {
            current = current.subModules.find((sub: any) => sub.id === pathItem.id);
        }
    }
    return current;
  };
  
  const currentContainer = getCurrentContainer();

  // --- HELPER: ATUALIZAR ÁRVORE DE DADOS ---
  const updateTree = (root: MentorshipModule, targetId: string | null, updateFn: (node: any) => any): MentorshipModule => {
    if (targetId === null && navigationPath.length === 0) return updateFn(root);
    if (root.id === targetId) return updateFn(root);

    if (root.subModules) {
        return {
            ...root,
            subModules: root.subModules.map(sub => 
                (sub.id === targetId || isNodeInPath(sub.id)) 
                    ? updateTree(sub, targetId, updateFn)
                    : sub
            )
        } as MentorshipModule;
    }
    return root;
  };

  const isNodeInPath = (id: string) => {
     // Otimização simples: se o ID está no path atual, precisamos descer nele
     return navigationPath.some(p => p.id === id) || id === navigationPath[navigationPath.length - 1]?.id;
  };

  const handleSaveTree = async (updatedNode: any) => {
    const targetId = navigationPath.length > 0 ? navigationPath[navigationPath.length - 1].id : module.id;
    // Se targetId for igual ao module.id, passamos null para indicar raiz
    const newRoot = updateTree(module, targetId === module.id ? null : targetId, () => updatedNode);
    await onUpdateModule(newRoot);
  };

  // --- HELPER: MIXAR E ORDENAR LISTA ---
  const getSortedMixedItems = (container: any): MixedItem[] => {
    const lessons = (container.lessons || []).map((l: any) => ({ type: 'lesson', data: l, order: l.order || 0 }));
    const submodules = (container.subModules || []).map((s: any) => ({ type: 'submodule', data: s, order: s.order || 0 }));
    
    return [...lessons, ...submodules].sort((a, b) => a.order - b.order) as MixedItem[];
  };

  // --- AÇÕES DE CRIAÇÃO ---
  const handleCreateItem = async () => {
    if (!newItemTitle.trim()) return;

    // Pega o maior order atual para adicionar no final
    const currentItems = getSortedMixedItems(currentContainer);
    const maxOrder = currentItems.length > 0 ? Math.max(...currentItems.map(i => i.order)) : -1;
    const newOrder = maxOrder + 1;

    const updatedContainer = { ...currentContainer };

    if (isCreatingSubmodule) {
        const newSub = {
            id: generateId(),
            title: newItemTitle,
            lessons: [],
            subModules: [],
            order: newOrder
        };
        updatedContainer.subModules = [...(updatedContainer.subModules || []), newSub];
    } else {
        const newLesson = {
            id: generateId(),
            title: newItemTitle,
            contents: [],
            order: newOrder
        };
        updatedContainer.lessons = [...(updatedContainer.lessons || []), newLesson];
    }

    await handleSaveTree(updatedContainer);
    setNewItemTitle('');
    setIsCreatingLesson(false);
    setIsCreatingSubmodule(false);
  };

  // --- AÇÕES DE REORDENAÇÃO (MOVER CIMA/BAIXO) ---
  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    const items = getSortedMixedItems(currentContainer);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    const itemA = items[index];
    const itemB = items[targetIndex];
// Troca os orders
    const tempOrder = itemA.order;
    itemA.order = itemB.order;
    itemB.order = tempOrder;

    // Atualiza o container
    const updatedContainer = { ...currentContainer };
    
    // Atualiza arrays originais com os novos orders
    const updateOrderInList = (list: any[], item: MixedItem) => {
        return list.map(x => x.id === item.data.id ? { ...x, order: item.order } : x);
    };

    if (itemA.type === 'lesson') updatedContainer.lessons = updateOrderInList(updatedContainer.lessons, itemA);
    else updatedContainer.subModules = updateOrderInList(updatedContainer.subModules, itemA);

    if (itemB.type === 'lesson') updatedContainer.lessons = updateOrderInList(updatedContainer.lessons, itemB);
    else updatedContainer.subModules = updateOrderInList(updatedContainer.subModules, itemB);

    await handleSaveTree(updatedContainer);
  };

  // --- OUTRAS AÇÕES (Renomear, Excluir, Navegar) ---
  const handleRename = async () => {
    if (!editTitleTemp.trim() || !editingId) return;
    const updatedContainer = { ...currentContainer };

    // Procura nas aulas
    if (updatedContainer.lessons) {
        updatedContainer.lessons = updatedContainer.lessons.map((l:any) => l.id === editingId ? {...l, title: editTitleTemp} : l);
    }
    // Procura nas pastas
    if (updatedContainer.subModules) {
        updatedContainer.subModules = updatedContainer.subModules.map((s:any) => s.id === editingId ? {...s, title: editTitleTemp} : s);
    }

    await handleSaveTree(updatedContainer);
    setEditingId(null);
  };

  const handleExecuteDelete = async () => {
    if (!itemToDelete) return;
    const updatedContainer = { ...currentContainer };

    if (itemToDelete.type === 'submodule') {
        updatedContainer.subModules = updatedContainer.subModules.filter((s:any) => s.id !== itemToDelete.id);
    } else {
        updatedContainer.lessons = updatedContainer.lessons.filter((l:any) => l.id !== itemToDelete.id);
    }

    await handleSaveTree(updatedContainer);
    setItemToDelete(null);
  };

  // Callback para atualização de conteúdos da aula
  const handleUpdateLessonContents = async (updatedLesson: MentorshipLesson) => {
    // Aqui precisamos percorrer a árvore para achar a aula, pois ela pode estar
    // dentro de um submódulo que não é o currentContainer se viermos via expansão de acordeão.
    // Porem, para simplificar e dado que o modal bloqueia a tela, podemos assumir que
    // só editamos aulas visíveis. 
    // Melhor: usar a função updateTree global buscando pelo ID da aula.
    
    // Função recursiva para achar e atualizar a aula em qualquer lugar da árvore
    const updateLessonInTree = (node: MentorshipModule): MentorshipModule => {
        const newNode = { ...node };
        
        // Tenta atualizar na lista de lições deste nó
        if (newNode.lessons) {
            newNode.lessons = newNode.lessons.map(l => l.id === updatedLesson.id ? updatedLesson : l);
        }

        // Recursividade para subpastas
        if (newNode.subModules) {
            newNode.subModules = newNode.subModules.map(sub => updateLessonInTree(sub as MentorshipModule));
        }

        return newNode;
    };

    const newRoot = updateLessonInTree(module);
    await onUpdateModule(newRoot);
    setSelectedLessonForContent(updatedLesson);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
        ...prev,
        [folderId]: !prev[folderId]
    }));
  };

  // --- NAVEGAÇÃO HANDLERS ---
  const handleBreadcrumbClick = (index: number) => {
    setNavigationPath(prev => prev.slice(0, index + 1));
  };

  const handleNavigateUp = () => {
    if (navigationPath.length > 0) {
        setNavigationPath(prev => prev.slice(0, -1));
    } else {
        onBack();
    }
  };

  // --- RENDERIZADOR DA LISTA MISTA ---
  const renderMixedList = (container: any) => {
    const items = getSortedMixedItems(container);

    if (items.length === 0) {
        return (
            <div className="text-center py-8 border border-dashed border-gray-800 rounded bg-black/20 text-gray-500 text-sm">
                Esta pasta está vazia. Adicione aulas ou subpastas.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {items.map((item, index) => {
                const isFirst = index === 0;
                const isLast = index === items.length - 1;
                const isEditing = editingId === item.data.id;

                // --- RENDERIZAR PASTA (SUBMÓDULO) ---
                if (item.type === 'submodule') {
                    const isOpen = expandedFolders[item.data.id];
                    return (
                        <div key={item.data.id} className="border border-gray-800 rounded-lg overflow-hidden bg-[#15171b] transition-all hover:border-gray-700">
                            {/* Cabeçalho da Pasta */}
                            <div 
                                className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#1a1d24]"
                                onClick={() => toggleFolder(item.data.id)}
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    {/* Ícone Chevron */}
                                    <div className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                    
                                    {/* Ícone Pasta */}
                                    <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                                    
                                    {/* Título ou Input de Edição */}
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 flex-1 mr-4" onClick={e => e.stopPropagation()}>
                                            <input value={editTitleTemp} onChange={e => setEditTitleTemp(e.target.value)} className="w-full bg-black border border-yellow-600 rounded px-2 py-1 text-white text-sm focus:outline-none" autoFocus />
                                            <button onClick={handleRename} className="text-green-500 hover:text-green-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                                            <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                        </div>
                                    ) : (
                                        <div className="flex-1">
                                            <h4 className="text-white font-bold text-sm">{item.data.title}</h4>
                                            <p className="text-[10px] text-gray-500">{(item.data.lessons?.length || 0) + (item.data.subModules?.length || 0)} itens</p>
                                        </div>
                                    )}
                                </div>

                                {/* Botões de Ação (Só aparecem se não estiver editando) */}
                                {!isEditing && (
                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                        {/* Ordenação */}
                                        <div className="flex flex-col mr-2">
                                            <button disabled={isFirst} onClick={() => handleMoveItem(index, 'up')} className={`text-gray-600 hover:text-white ${isFirst ? 'opacity-30 cursor-not-allowed' : ''}`}><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                                            <button disabled={isLast} onClick={() => handleMoveItem(index, 'down')} className={`text-gray-600 hover:text-white ${isLast ? 'opacity-30 cursor-not-allowed' : ''}`}><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7 7" /></svg></button>
                                        </div>

                                        <button onClick={() => { setEditingId(item.data.id); setEditTitleTemp(item.data.title); }} className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                        <button onClick={() => setItemToDelete({id: item.data.id, type: 'submodule'})} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        
                                        {/* Entrar na Pasta (Drill-down) */}
                                        <button 
                                            onClick={() => setNavigationPath([...navigationPath, { id: item.data.id, title: item.data.title }])}
                                            className="ml-2 px-3 py-1 bg-gray-800 text-xs font-bold text-gray-300 rounded border border-gray-600 hover:bg-gray-700 hover:border-gray-500 transition-colors"
                                        >
                                            ENTRAR
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Conteúdo do Acordeão (Recursivo) */}
                            {isOpen && (
                                <div className="p-4 border-t border-gray-800 bg-black/30 ml-4 border-l pl-4 relative">
                                    {/* Linha guia visual */}
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-800"></div>
                                    {/* Renderiza a lista de dentro da pasta. 
                                        Nota: Aqui apenas visualizamos. Para reordenar itens DENTRO da pasta, 
                                        o ideal é "Entrar" nela via breadcrumb para ter o contexto do currentContainer correto. 
                                        Mas podemos listar para visualização rápida. */}
                                    <div className="text-xs text-gray-500 mb-2 italic flex justify-between">
                                        <span>Conteúdo de: {item.data.title}</span>
                                        <button 
                                            onClick={() => setNavigationPath([...navigationPath, { id: item.data.id, title: item.data.title }])}
                                            className="text-yellow-600 hover:underline"
                                        >
                                            Gerenciar esta pasta &rarr;
                                        </button>
                                    </div>
                                    
                                    {/* Lista simplificada apenas para leitura rápida */}
                                    <div className="space-y-2 opacity-75">
                                        {(item.data.subModules || []).map((s:any) => (
                                            <div key={s.id} className="flex items-center gap-2 text-gray-400 pl-2">
                                                <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                                                <span>{s.title}</span>
                                            </div>
                                        ))}
                                        {(item.data.lessons || []).map((l:any) => (
                                            <div key={l.id} className="flex items-center gap-2 text-gray-300 pl-2">
                                                 <span className="w-1.5 h-1.5 bg-gray-600 rounded-full"></span>
                                                <span>{l.title}</span>
                                            </div>
                                        ))}
                                        {(!item.data.subModules?.length && !item.data.lessons?.length) && (
                                            <span className="text-gray-600">Pasta vazia.</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                }
// --- RENDERIZAR AULA ---
                if (item.type === 'lesson') {
                    return (
                        <div key={item.data.id} className={`bg-[#1a1d24] border rounded-lg p-3 flex items-center justify-between transition-all group ${isEditing ? 'border-red-500' : 'border-gray-800 hover:border-gray-600'}`}>
                            <div className="flex items-center gap-3 flex-1">
                                {/* Marcador de Aula */}
                                <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-gray-500 shrink-0">
                                    <span className="font-bold text-xs">{index + 1}</span>
                                </div>

                                {isEditing ? (
                                    <div className="flex items-center gap-2 flex-1 mr-4">
                                        <input value={editTitleTemp} onChange={e => setEditTitleTemp(e.target.value)} className="w-full bg-black border border-red-500 rounded px-2 py-1 text-white text-sm focus:outline-none" autoFocus />
                                        <button onClick={handleRename} className="p-2 bg-green-600 hover:bg-green-500 rounded text-white"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                                        <button onClick={() => setEditingId(null)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                    </div>
                                ) : (
                                    <div className="flex-1">
                                        <h4 className="text-white font-bold text-lg">{item.data.title}</h4>
                                        <div className="flex gap-2 mt-1">
                                            {item.data.contents?.some(c => c.type === 'video') && <span className="text-[9px] bg-red-900/30 text-red-500 px-1.5 py-0.5 rounded border border-red-900/50">VÍDEO</span>}
                                            {item.data.contents?.some(c => c.type === 'pdf') && <span className="text-[9px] bg-blue-900/30 text-blue-500 px-1.5 py-0.5 rounded border border-blue-900/50">PDF</span>}
                                            <span className="text-xs text-gray-500">{item.data.contents?.length || 0} itens</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!isEditing && (
                                <div className="flex items-center gap-2">
                                     {/* Ordenação */}
                                     <div className="flex flex-col mr-2">
                                        <button disabled={isFirst} onClick={() => handleMoveItem(index, 'up')} className={`text-gray-600 hover:text-white ${isFirst ? 'opacity-30 cursor-not-allowed' : ''}`}><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                                        <button disabled={isLast} onClick={() => handleMoveItem(index, 'down')} className={`text-gray-600 hover:text-white ${isLast ? 'opacity-30 cursor-not-allowed' : ''}`}><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7 7" /></svg></button>
                                    </div>

                                    <button onClick={() => setSelectedLessonForContent(item.data)} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold uppercase rounded border border-gray-700 hover:border-white transition-all flex items-center gap-2 mr-2">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        Gerenciar
                                    </button>
                                    <button onClick={() => { setEditingId(item.data.id); setEditTitleTemp(item.data.title); }} className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                    <button onClick={() => setItemToDelete({id: item.data.id, type: 'lesson'})} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            )}
                        </div>
                    );
                }
                return null;
            })}
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1115] p-6 rounded-b-xl animate-in slide-in-from-right overflow-y-auto custom-scrollbar">
      
      {/* --- HEADER E NAVEGAÇÃO --- */}
      <div className="flex flex-col gap-4 mb-8 border-b border-gray-800 pb-6">
        
        {/* Breadcrumbs (Trilha) */}
        <div className="flex items-center gap-2 text-sm text-gray-400 overflow-x-auto">
            <button onClick={() => setNavigationPath([])} className="hover:text-white hover:underline flex items-center gap-1 font-bold">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Raiz
            </button>
            {navigationPath.map((item, index) => (
                <React.Fragment key={item.id}>
                    <span className="text-gray-600">/</span>
                    <button 
                        onClick={() => handleBreadcrumbClick(index)}
                        className={`hover:text-white hover:underline whitespace-nowrap ${index === navigationPath.length - 1 ? 'text-white font-bold' : ''}`}
                    >
                        {item.title}
                    </button>
                </React.Fragment>
            ))}
        </div>

        <div className="flex justify-between items-end">
            <div className="flex items-center gap-4">
                <button 
                    onClick={handleNavigateUp}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                    title="Voltar"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        {navigationPath.length > 0 
                            ? <><svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg> {currentContainer.title}</>
                            : module.title
                        }
                    </h2>
                    <p className="text-gray-400 text-sm">
                        {navigationPath.length === 0 ? 'Gerencie as pastas e aulas deste módulo.' : 'Gerencie o conteúdo desta subpasta.'}
                    </p>
                </div>
            </div>

            {/* Botões de Ação Principais */}
            <div className="flex gap-3">
                {/* BOTÃO DE CONFIGURAÇÕES (NOVO) */}
                <button 
                    onClick={onEdit}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 px-4 py-2 rounded font-bold text-sm uppercase transition-colors flex items-center gap-2"
                >
                    <Settings size={16} /> Configurações
                </button>

                {!isCreatingSubmodule && !isCreatingLesson && (
                    <>
                        <button 
                            onClick={() => setIsCreatingSubmodule(true)}
                            className="bg-[#1a1d24] hover:bg-gray-700 text-white border border-gray-600 px-4 py-2 rounded font-bold text-sm uppercase transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                            Nova Pasta
                        </button>
                        <button 
                            onClick={() => setIsCreatingLesson(true)}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold text-sm uppercase transition-colors flex items-center gap-2 shadow-lg shadow-red-900/20"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Nova Aula
                        </button>
                    </>
                )}
            </div>
        </div>
      </div>

      {/* --- ÁREA DE INPUT DE CRIAÇÃO --- */}
      {(isCreatingLesson || isCreatingSubmodule) && (
        <div className="bg-[#1a1d24] p-4 rounded-lg border border-gray-600 mb-6 animate-in fade-in max-w-3xl mx-auto w-full shadow-xl">
            <label className={`text-xs font-bold uppercase mb-2 block ${isCreatingSubmodule ? 'text-yellow-500' : 'text-red-500'}`}>
                {isCreatingSubmodule ? 'Nome da Nova Pasta (Submódulo)' : 'Título da Nova Aula'}
            </label>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    placeholder={isCreatingSubmodule ? "Ex: Materiais Complementares..." : "Ex: Aula 01 - Introdução..."}
                    className="flex-1 bg-black border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()}
                />
                <button 
                    onClick={handleCreateItem}
                    className="bg-white text-black px-4 py-2 rounded font-bold text-sm uppercase hover:bg-gray-200"
                >
                    Salvar
                </button>
                <button 
                    onClick={() => { setIsCreatingLesson(false); setIsCreatingSubmodule(false); setNewItemTitle(''); }}
                    className="text-gray-400 px-4 py-2 rounded font-bold text-sm uppercase hover:text-white"
                >
                    Cancelar
                </button>
            </div>
        </div>
      )}
{/* --- CONTEÚDO PRINCIPAL --- */}
      <div className="max-w-5xl mx-auto w-full pb-20">
        {renderMixedList(currentContainer)}
      </div>

      {/* Modal de Gestão de Conteúdos */}
      {selectedLessonForContent && (
        <MentorshipContentModal 
            isOpen={!!selectedLessonForContent}
            onClose={() => setSelectedLessonForContent(null)}
            lesson={selectedLessonForContent}
            planId={planId}
            onSaveLesson={handleUpdateLessonContents}
        />
      )}

      {/* PopUp de Confirmação de Exclusão */}
      <ConfirmationModal 
        isOpen={!!itemToDelete}
        title={itemToDelete?.type === 'submodule' ? "Excluir Pasta?" : "Excluir Aula?"}
        message={itemToDelete?.type === 'submodule' 
            ? "Tem certeza? Todo o conteúdo (aulas e subpastas) dentro desta pasta será perdido." 
            : "Tem certeza que deseja excluir esta aula?"}
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        isDanger={true}
        onConfirm={handleExecuteDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
