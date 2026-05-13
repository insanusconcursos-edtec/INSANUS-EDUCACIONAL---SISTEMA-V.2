import React, { useState, useRef, useEffect } from 'react';
import { MentorshipLesson, MentorshipContent, ContentType } from '../../../../types/mentorship';
import { mentorshipService } from '../../../../services/mentorshipService';
import { ConfirmationModal } from '../../ui/ConfirmationModal';

// Função auxiliar simples para gerar ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

interface MentorshipContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: MentorshipLesson; // A aula que estamos editando
  planId: string;
  onSaveLesson: (updatedLesson: MentorshipLesson) => Promise<void>;
}

export function MentorshipContentModal({ isOpen, onClose, lesson, planId, onSaveLesson }: MentorshipContentModalProps) {
  // Sincroniza o estado local com a prop lesson
  const [contents, setContents] = useState<MentorshipContent[]>(lesson.contents || []);
  
  useEffect(() => {
    setContents(lesson.contents || []);
  }, [lesson]);

  const [activeTab, setActiveTab] = useState<ContentType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- ESTADOS DE EDIÇÃO ---
  const [editingContentId, setEditingContentId] = useState<string | null>(null);

  // --- ESTADOS DE EXCLUSÃO ---
  const [contentToDelete, setContentToDelete] = useState<string | null>(null);

  // --- ESTADOS DO FORMULÁRIO ---
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // --- HANDLERS AUXILIARES ---

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setText('');
    setPdfFile(null);
    setActiveTab(null);
    setEditingContentId(null); // Sai do modo de edição
  };

  // --- PREPARAR PARA EDIÇÃO ---
  const handleStartEdit = (content: MentorshipContent) => {
    setEditingContentId(content.id);
    setActiveTab(content.type);
    setTitle(content.title);
    
    // Preenche os campos baseados no tipo
    if (content.type === 'video') setUrl(content.videoUrl || '');
    if (content.type === 'link') setUrl(content.linkUrl || '');
    if (content.type === 'text') setText(content.textContent || '');
    
    // PDF: Não podemos setar o arquivo, mas limpamos o input para indicar que
    // se o usuário não selecionar nada, manteremos o antigo.
    setPdfFile(null);
  };

  // --- SALVAR (CRIAR OU ATUALIZAR) ---
  const handleSaveContent = async () => {
    if (!title.trim()) return alert('O título é obrigatório.');
    if (!activeTab) return;

    setIsSaving(true);
    try {
      let finalFileUrl = undefined;

      // Lógica de Upload de PDF
      if (activeTab === 'pdf') {
        if (pdfFile) {
            // Se tem arquivo novo selecionado, faz upload
            finalFileUrl = await mentorshipService.uploadLessonMaterial(pdfFile, planId);
        } else if (editingContentId) {
            // Se está editando e NÃO selecionou arquivo novo, mantém o antigo
            const existingContent = contents.find(c => c.id === editingContentId);
            finalFileUrl = existingContent?.fileUrl;
        }
      }

      // Cria o objeto base
      const contentData: Partial<MentorshipContent> = {
        title,
        type: activeTab,
        // Spread Condicional Seguro
        ...(activeTab === 'video' && { videoUrl: url }),
        ...(activeTab === 'link' && { linkUrl: url }),
        ...(activeTab === 'pdf' && { fileUrl: finalFileUrl }),
        ...(activeTab === 'text' && { textContent: text }),
      };

      let updatedContents = [...contents];

      if (editingContentId) {
        // --- MODO EDIÇÃO: Atualiza o item existente ---
        updatedContents = updatedContents.map(c => 
            c.id === editingContentId 
                ? { ...c, ...contentData } as MentorshipContent // Mantém ID e CreatedAt originais, sobrescreve dados
                : c
        );
      } else {
        // --- MODO CRIAÇÃO: Adiciona novo item ---
        const newContent: MentorshipContent = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            title: contentData.title!,
            type: contentData.type!,
            videoUrl: contentData.videoUrl,
            linkUrl: contentData.linkUrl,
            fileUrl: contentData.fileUrl,
            textContent: contentData.textContent
        };
        updatedContents.push(newContent);
      }

      setContents(updatedContents);
      await onSaveLesson({ ...lesson, contents: updatedContents });
      
      resetForm();

    } catch (error) {
      console.error(error);
      alert('Erro ao salvar conteúdo.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- REORDENAR ---
  const handleMoveContent = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === contents.length - 1) return;

    const newContents = [...contents];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newContents[index], newContents[targetIndex]] = [newContents[targetIndex], newContents[index]];

    setContents(newContents);
    await onSaveLesson({ ...lesson, contents: newContents });
  };

// --- EXCLUIR ---
  const handleConfirmDelete = (contentId: string) => {
    setContentToDelete(contentId);
  };

  const executeDeleteContent = async () => {
    if (!contentToDelete) return;
    const updatedContents = contents.filter(c => c.id !== contentToDelete);
    setContents(updatedContents);
    await onSaveLesson({ ...lesson, contents: updatedContents });
    setContentToDelete(null);
    
    // Se apagou o item que estava editando, limpa o form
    if (editingContentId === contentToDelete) {
        resetForm();
    }
  };

  const getIcon = (type: ContentType) => {
    switch(type) {
        case 'video': return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
        case 'pdf': return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
        case 'link': return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
        case 'text': return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#1a1d24] p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <span className="text-gray-500 font-normal">Editando Aula:</span> 
                {lesson.title}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* ESQUERDA: LISTA DE CONTEÚDOS */}
            <div className="w-1/2 border-r border-gray-800 p-6 overflow-y-auto custom-scrollbar bg-black/20">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-[#121418]/95 backdrop-blur py-2 z-10 border-b border-gray-800/50">
                    <h4 className="text-xs font-bold text-gray-500 uppercase">Conteúdos ({contents.length})</h4>
                    <span className="text-[10px] text-gray-600">Arraste ou use as setas</span>
                </div>
                
                <div className="space-y-3">
                    {contents.length === 0 && (
                        <div className="text-center py-12 border border-dashed border-gray-800 rounded-lg">
                            <p className="text-gray-500 text-sm">Nenhum conteúdo.</p>
                            <p className="text-gray-600 text-xs mt-1">Use o painel à direita.</p>
                        </div>
                    )}

                    {contents.map((content, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === contents.length - 1;
                        const isEditingThis = editingContentId === content.id;

                        return (
                            <div key={content.id} className={`p-3 rounded-lg border flex items-center gap-3 transition-all ${isEditingThis ? 'bg-[#1a1d24] border-red-500 shadow-lg shadow-red-900/10' : 'bg-[#1a1d24] border-gray-700 hover:border-gray-500'}`}>
                                {/* Ordenação */}
                                <div className="flex flex-col gap-1">
                                    <button onClick={() => handleMoveContent(idx, 'up')} disabled={isFirst} className={`p-1 rounded bg-black border border-gray-700 hover:border-gray-500 transition-colors ${isFirst ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-white'}`}>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                    </button>
                                    <button onClick={() => handleMoveContent(idx, 'down')} disabled={isLast} className={`p-1 rounded bg-black border border-gray-700 hover:border-gray-500 transition-colors ${isLast ? 'opacity-30 cursor-not-allowed' : 'text-gray-400 hover:text-white'}`}>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7 7" /></svg>
                                    </button>
                                </div>

                                <div className="p-2 bg-black/50 rounded text-red-500 shrink-0 border border-gray-800">
                                    {getIcon(content.type)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h5 className={`font-bold text-sm truncate ${isEditingThis ? 'text-red-500' : 'text-white'}`}>{content.title}</h5>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-gray-500 uppercase font-mono bg-black px-1.5 rounded border border-gray-800">{content.type}</span>
                                        {isEditingThis && <span className="text-[10px] bg-red-900/50 text-white px-2 rounded-full animate-pulse">Editando</span>}
                                    </div>
                                </div>

                                <div className="flex gap-1">
                                    {/* Botão EDITAR (Lápis) */}
                                    <button 
                                        onClick={() => handleStartEdit(content)}
                                        className={`p-2 rounded transition-all ${isEditingThis ? 'bg-red-600 text-white' : 'text-gray-600 hover:text-white hover:bg-gray-700'}`}
                                        title="Editar Conteúdo"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>

                                    {/* Botão EXCLUIR */}
                                    <button 
                                        onClick={() => handleConfirmDelete(content.id)}
                                        className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                                        title="Remover Conteúdo"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* DIREITA: FORMULÁRIO (ADD / EDIT) */}
            <div className="w-1/2 p-6 overflow-y-auto custom-scrollbar bg-[#15181e]">
                <div className="flex justify-between items-center mb-4">
                    <h4 className={`text-xs font-bold uppercase ${editingContentId ? 'text-red-500' : 'text-gray-500'}`}>
                        {editingContentId ? 'Editando Conteúdo Selecionado' : 'Adicionar Novo Conteúdo'}
                    </h4>
                    {editingContentId && (
                        <button onClick={resetForm} className="text-xs text-gray-400 hover:text-white underline">
                            Cancelar Edição
                        </button>
                    )}
                </div>
                
                {/* Seletores de Tipo */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                    {(['video', 'pdf', 'link', 'text'] as ContentType[]).map(type => (
                        <button
                            key={type}
                            onClick={() => { if(!editingContentId || confirm("Trocar o tipo de conteúdo pode perder dados não salvos. Continuar?")) { setActiveTab(type); } }}
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                                ${activeTab === type 
                                    ? 'bg-red-600 border-red-500 text-white shadow-lg' 
                                    : 'bg-[#1a1d24] border-gray-700 text-gray-400 hover:bg-[#252830] hover:text-white'
                                }
                            `}
                        >
                            {getIcon(type)}
                            <span className="text-[10px] uppercase font-bold mt-1">{type}</span>
                        </button>
                    ))}
                </div>

                {/* Formulários Condicionais */}
                {activeTab && (
                    <div className={`animate-in slide-in-from-bottom-2 fade-in bg-[#1a1d24] p-5 rounded-xl border ${editingContentId ? 'border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.1)]' : 'border-gray-700'} shadow-lg`}>
                        <div className="space-y-4">
                            
                            {/* Título */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Título</label>
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-red-500 focus:outline-none transition-colors"
                                    placeholder={activeTab === 'video' ? 'Ex: Aula 01 - Introdução' : 'Título...'}
                                />
                            </div>

                            {/* VÍDEO */}
                            {activeTab === 'video' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Link do Vídeo</label>
                                    <input 
                                        type="text" 
                                        value={url}
                                        onChange={e => setUrl(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-red-500 focus:outline-none transition-colors"
                                        placeholder="https://..."
                                    />
                                </div>
                            )}

                            {/* LINK */}
                            {activeTab === 'link' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">URL</label>
                                    <input 
                                        type="text" 
                                        value={url}
                                        onChange={e => setUrl(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-red-500 focus:outline-none transition-colors"
                                        placeholder="https://..."
                                    />
                                </div>
                            )}

                            {/* PDF */}
                            {activeTab === 'pdf' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Arquivo PDF</label>
                                    
                                    {/* Aviso se já existe PDF e estamos editando */}
                                    {editingContentId && !pdfFile && (
                                        <div className="mb-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-500 text-xs flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            O arquivo atual será mantido se você não selecionar um novo.
                                        </div>
                                    )}

                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
                                            ${pdfFile ? 'border-green-500/50 bg-green-500/10' : 'border-gray-700 hover:bg-black/40 hover:border-red-500'}
                                        `}
                                    >
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept="application/pdf"
                                            onChange={e => setPdfFile(e.target.files?.[0] || null)}
                                        />
                                        {pdfFile ? (
                                            <div className="text-green-500 font-bold text-sm flex flex-col items-center justify-center gap-2">
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                <span>{pdfFile.name}</span>
                                                <span className="text-xs font-normal opacity-75">Clique para trocar</span>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 text-sm flex flex-col items-center">
                                                <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                                {editingContentId ? 'Clique para substituir o PDF' : 'Clique para selecionar o PDF'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TEXTO */}
                            {activeTab === 'text' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Mensagem</label>
                                    <textarea 
                                        value={text}
                                        onChange={e => setText(e.target.value)}
                                        rows={4}
                                        className="w-full bg-black border border-gray-700 rounded p-3 text-white focus:border-red-500 focus:outline-none resize-none transition-colors"
                                        placeholder="Digite o aviso para os alunos..."
                                    />
                                </div>
                            )}

                            {/* Botões de Ação */}
                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-700 mt-2">
                                <button 
                                    onClick={resetForm}
                                    className="px-4 py-2 text-gray-400 hover:text-white text-xs font-bold uppercase transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSaveContent}
                                    disabled={isSaving}
                                    className={`px-6 py-2 text-white text-xs font-bold uppercase rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg ${editingContentId ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20' : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'}`}
                                >
                                    {isSaving ? 'Salvando...' : (editingContentId ? 'Salvar Alterações' : 'Adicionar Conteúdo')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* PopUp de Confirmação de Exclusão */}
        <ConfirmationModal 
            isOpen={!!contentToDelete}
            title="Excluir Conteúdo?"
            message="Tem certeza? Esta ação não pode ser desfeita."
            confirmText="Sim, Excluir"
            cancelText="Cancelar"
            isDanger={true}
            onConfirm={executeDeleteContent}
            onCancel={() => setContentToDelete(null)}
        />
      </div>
    </div>
  );
}