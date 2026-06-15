
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Plus, FileText, Trash2, 
  Loader2, AlertCircle, BookOpen, AlertTriangle, StickyNote,
  PanelLeftClose, PanelLeftOpen, ExternalLink, Link as LinkIcon,
  ChevronDown, Maximize2, Minimize2, MonitorUp, Download, PenTool
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { notebookService, EditalNote, NoteType } from '../../../services/notebookService';
// ... in EditalNotebookModal.tsx ...
import { TipTapEditor } from '../../ui/TipTapEditor';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { InsanusPdfViewer } from './InsanusPdfViewer';
import { EdictDiscipline, EdictTopic, EdictSubtopic } from '../../../services/edictService';
import { Meta } from '../../../services/metaService';
import toast from 'react-hot-toast';
import { DraggableNotesList } from './DraggableNotesList';
import { MoveNoteModal } from './MoveNoteModal';
import { useStudyContext } from '../../../contexts/StudyContext';
import { toPlainObject } from '../../../services/firestoreUtils';

export interface NotebookEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  editalNodeId: string;
  type: NoteType;
  topicTitle: string;
  materials?: any[];
  editalNode?: EdictDiscipline | EdictTopic | EdictSubtopic;
  metaLookup?: Record<string, Meta>;
  initialPdfUrl?: string | null;
  isEmbedded?: boolean;
  isPopoutMode?: boolean;
}

type QuestionNode = {
  id: string;
  title: string;
  type: 'topic' | 'subtopic';
  links: Array<{ title: string; url: string }>;
  children: QuestionNode[];
};

const QuestionAccordion: React.FC<{ node: QuestionNode; level?: number }> = ({ node, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(level === 0);

  return (
    <div className="flex flex-col border border-white/5 bg-[#0c0c0e] overflow-hidden rounded-lg mb-2">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-3 bg-[#18181b] hover:bg-[#1e1e24] cursor-pointer transition-colors"
      >
        <span className={`text-[11px] font-bold uppercase tracking-tight leading-tight flex-1 pr-4 ${level === 0 ? 'text-zinc-100' : 'text-zinc-400'}`}>
          {node.title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {node.links.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded border border-amber-500/20 font-black">
              {node.links.length}
            </span>
          )}
          <ChevronDown 
            size={14} 
            className={`text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </div>
      </div>
      
      {isOpen && (
        <div className="p-2 bg-[#09090b] flex flex-col gap-2">
          {/* Render children subtopics first */}
          {node.children.map(child => (
            <QuestionAccordion key={child.id} node={child} level={level + 1} />
          ))}

          {/* Render direct links */}
          {node.links.map((link, idx) => (
            <a 
              key={idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1 p-3 rounded-xl border border-transparent bg-zinc-900/50 hover:bg-zinc-900 hover:border-white/10 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Plus size={10} />
                  Questões
                </span>
                <ExternalLink size={12} className="text-zinc-600 group-hover:text-white transition-colors" />
              </div>
              <p className="text-xs font-black text-zinc-300 group-hover:text-white transition-colors line-clamp-2">
                {link.title}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export const EditalNotebookModal: React.FC<NotebookEditorModalProps> = ({
  isOpen,
  onClose,
  planId,
  editalNodeId,
  type,
  topicTitle,
  materials = [],
  editalNode,
  metaLookup,
  initialPdfUrl,
  isEmbedded,
  isPopoutMode
}) => {
  const { currentUser } = useAuth();
  const { isFloating, setIsMaterialActive } = useStudyContext();
  
  // Data State
  const [notes, setNotes] = useState<EditalNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<EditalNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Questions Links State
  const [hierarchicalLinks, setHierarchicalLinks] = useState<QuestionNode[]>([]);
  
  // UI State
  const [sidebarTab, setSidebarTab] = useState<'notes' | 'materials'>('notes');
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotebookMinimized, setIsNotebookMinimized] = useState(false);
  
  // Popout State
  const [isPopoutOpen, setIsPopoutOpen] = useState(false);
  const popoutChannelRef = React.useRef<BroadcastChannel | null>(null);

  // Editor State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const lastSavedRef = React.useRef({ title: '', content: '' });
  
  // Modals & Actions State
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [noteToMove, setNoteToMove] = useState<EditalNote | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const folders = useMemo(() => notes.filter(n => n.isFolder), [notes]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load notes on mount/open
  useEffect(() => {
    if (isOpen) {
      setIsMaterialActive(true);
    } else {
      setIsMaterialActive(false);
    }
  }, [isOpen, setIsMaterialActive]);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadNotes();

      // Se houver PDF inicial, foca nele
      if (initialPdfUrl) {
          handleSetActivePdf(initialPdfUrl);
          setSidebarTab('materials');
          setIsNotebookMinimized(false);
      }
      
      // Se for caderno de questões, extrai os links recursivamente de forma hierárquica
      if (type === 'questions' && editalNode && metaLookup) {
          const results: QuestionNode[] = [];
          const disc = editalNode as EdictDiscipline;
          
          if (disc.topics) {
            disc.topics.forEach(t => {
              const res = extractHierarchicalLinks(t);
              if (res) results.push(res);
            });
          } else {
            const res = extractHierarchicalLinks(editalNode);
            if (res) results.push(res);
          }
          
          setHierarchicalLinks(results);
      }
    }
  }, [isOpen, currentUser, editalNodeId, type, initialPdfUrl]); // Adicionado initialPdfUrl aqui

  const extractHierarchicalLinks = (node: EdictDiscipline | EdictTopic | EdictSubtopic): QuestionNode | null => {
    const directLinks: { title: string; url: string }[] = [];
    
    // Extract direct links from this node
    if (node.linkedGoals?.questions && metaLookup) {
      node.linkedGoals.questions.forEach((goalId: string) => {
        const goal = metaLookup[goalId];
        if (goal && goal.type === 'questions' && goal.links) {
          goal.links.forEach((l) => {
            directLinks.push({ title: l.name || goal.title, url: l.url });
          });
        }
      });
    }

    const children: QuestionNode[] = [];
    
    // Check nested topics (if it's a discipline we normally don't handle it here but for resilience)
    const disc = node as EdictDiscipline;
    if (disc.topics) {
      disc.topics.forEach((t) => {
        const result = extractHierarchicalLinks(t);
        if (result) children.push(result);
      });
    }

    // Check nested subtopics (Topic/Subtopic)
    const top = node as EdictTopic;
    if (top.subtopics) {
      top.subtopics.forEach((s) => {
        const result = extractHierarchicalLinks(s);
        if (result) children.push(result);
      });
    }

    // Pruning: Só retorna o nó se ele tiver links diretos OU filhos com links
    if (directLinks.length === 0 && children.length === 0) {
      return null;
    }

    return {
      id: node.id,
      title: node.name,
      type: disc.topics ? 'topic' : 'subtopic',
      links: directLinks,
      children: children
    };
  };

  const countTotalLinks = (nodes: QuestionNode[]): number => {
    return nodes.reduce((acc, node) => acc + node.links.length + countTotalLinks(node.children), 0);
  };

  // Autosave logic
  useEffect(() => {
    // Prevent autosave if data hasn't finished loading yet OR if it's the initial load for this specific note
    if (!currentUser || isLoading || !isDataLoaded) return;
    
    // Don't save if content is identical to last known state (either from DB or last successful save)
    if (title === lastSavedRef.current.title && content === lastSavedRef.current.content) {
      return;
    }

    // Only save if there's at least a title
    if (!title.trim()) return;

    const timeoutId = setTimeout(() => {
      handleAutosave();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [title, content, isDataLoaded, isLoading]);

  const handleUpdatePositions = async (updates: {id: string, position: number, folderId?: string | null}[]) => {
     try {
         await notebookService.updatePositions(updates);
         // Update local state smoothly
         setNotes(prev => {
             const map = new Map(prev.map(n => [n.id!, n]));
             updates.forEach(u => {
                 const n = map.get(u.id);
                 if (n) {
                     n.position = u.position;
                     n.folderId = u.folderId;
                 }
             });
             return [...prev].sort((a, b) => {
                 const pA = a.position ?? 999999;
                 const pB = b.position ?? 999999;
                 return pA - pB;
             });
         });
     } catch (err) {
         toast.error("Erro ao reordenar pastas");
     }
  };

  const handleNewFolder = async () => {
    try {
      const newFolder: Omit<EditalNote, 'id'> = {
        userId: currentUser!.uid,
        planId,
        editalNodeId,
        type,
        title: 'Nova Pasta',
        content: '',
        isFolder: true,
        position: notes.length
      };

      const id = await notebookService.saveNote(newFolder);
      const savedFolder = { ...newFolder, id, createdAt: { toDate: () => new Date() }, updatedAt: { toDate: () => new Date() } };
      
      setNotes(prev => [...prev, savedFolder]);
      toast.success("Pasta criada");
    } catch (err) {
      toast.error('Erro ao criar pasta');
    }
  };

  const handleMoveNote = (note: EditalNote) => {
    setNoteToMove(note);
    setIsMoveModalOpen(true);
  };

  const executeMove = async (noteId: string, folderId: string | null) => {
    try {
      await notebookService.updatePositions([{ id: noteId, position: 0, folderId }]);
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, folderId } : n));
      toast.success("Nota movida");
    } catch (err) {
      toast.error("Erro ao mover nota");
    }
  };

  const handleRenameNote = async (noteId: string, newTitle: string) => {
    try {
      await notebookService.updateNote(noteId, { title: newTitle });
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title: newTitle } : n));
      if (selectedNote?.id === noteId) {
        setTitle(newTitle);
      }
      toast.success("Renomeado com sucesso");
    } catch (err) {
      toast.error("Erro ao renomear");
    }
  };

  const handleAutosave = async () => {
    if (!currentUser || !title.trim()) return;

    // Local check to avoid unnecessary network calls
    if (title === lastSavedRef.current.title && content === lastSavedRef.current.content) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    try {
      if (selectedNote?.id) {
        // Fetch latest version before update to check for remote changes (Timestamp check)
        const currentNotes = await notebookService.getNotes(currentUser.uid, planId, editalNodeId, type);
        const remoteVersion = currentNotes.find(n => n.id === selectedNote.id);
        
        if (remoteVersion && remoteVersion.updatedAt?.toDate) {
          const remoteTime = remoteVersion.updatedAt.toDate().getTime();
          const localTime = selectedNote.updatedAt?.toDate?.()?.getTime() || 0;
          
          // If remote is significantly newer, we might want to warn or merge, 
          // but for now, we'll just ensure we don't overwrite if it was changed elsewhere
          if (remoteTime > localTime + 5000) { // 5 second buffer
             console.warn("Versão remota é mais recente. Possível conflito.");
             // For consistency in this studying context, we'll force update but you could handle merge here
          }
        }

        await notebookService.updateNote(selectedNote.id, { 
          title: title.trim(), 
          content 
        });
        
        // Update local ref to current state
        lastSavedRef.current = { title: title.trim(), content };
        
        const updatedVersion = { ...selectedNote, title: title.trim(), content, updatedAt: { toDate: () => new Date() } as any };
        // Update selectedNote's content without triggering full reload
        setSelectedNote(updatedVersion);
        
        // Update it in the notes array as well
        setNotes(prev => prev.map(n => n.id === selectedNote.id ? updatedVersion : n));
      } else {
        const newNoteId = await notebookService.saveNote({
          userId: currentUser.uid,
          planId,
          editalNodeId,
          type,
          title: title.trim(),
          content
        });
        
        const newNote: EditalNote = {
          id: newNoteId,
          userId: currentUser.uid,
          planId,
          editalNodeId,
          type,
          title: title.trim(),
          content,
          createdAt: { toDate: () => new Date() } as any,
          updatedAt: { toDate: () => new Date() } as any
        };

        lastSavedRef.current = { title: title.trim(), content };
        setSelectedNote(newNote);
        // Refresh list
        const updatedNotes = await notebookService.getNotes(currentUser.uid, planId, editalNodeId, type);
        setNotes(updatedNotes);
      }
      setSaveStatus('saved');
    } catch (error) {
      console.error("Erro no autosave:", error);
      setSaveStatus('error');
    }
  };

  const loadNotes = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setIsDataLoaded(false); 
    try {
      const data = await notebookService.getNotes(currentUser.uid, planId, editalNodeId, type);
      setNotes(data);
      if (data.length > 0) {
        // If we already had a selected note, try to maintain selection or take the first one
        const currentlySelectedId = selectedNote?.id;
        const matchingNote = currentlySelectedId ? data.find(n => n.id === currentlySelectedId) : data[0];
        
        if (matchingNote) {
          setSelectedNote(matchingNote);
          setTitle(matchingNote.title);
          setContent(matchingNote.content);
          lastSavedRef.current = { title: matchingNote.title, content: matchingNote.content };
        }
      } else {
        await handleNewNote();
      }
      // Force status to idle/saved for initial state
      setSaveStatus('idle');
      // Mark as ready for autosave
      setTimeout(() => setIsDataLoaded(true), 150);
    } catch (error) {
      console.error("Erro ao carregar cadernos:", error);
      toast.error("Erro ao carregar anotações");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectNote = async (note: EditalNote) => {
    // 1. Idempotency Check: Don't do anything if this note is already active
    if (selectedNote?.id === note.id) return;

    // 2. Proteção de Carregamento (Dirty State Check)
    const isDirty = title !== lastSavedRef.current.title || content !== lastSavedRef.current.content;
    if (saveStatus === 'saving' || isDirty) {
      await handleAutosave();
    }

    setIsDataLoaded(false); 
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    lastSavedRef.current = { title: note.title, content: note.content };
    
    // Ensure we mark as loaded after the state update has propagated to the editor
    setTimeout(() => setIsDataLoaded(true), 100);
  };

  const titleRef = React.useRef(title);
  const contentRef = React.useRef(content);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { contentRef.current = content; }, [content]);

  const handleOpenPopout = () => {
    setIsPopoutOpen(true);
    
    // Create a local session cache for complex data
    const sessionId = `popout_${Date.now()}`;
    const pData = {
        materials,
        editalNode,
        metaLookup
    };
    // Salvar no localStorage temporariamente com proteção contra estrutura circular
    localStorage.setItem(sessionId, JSON.stringify(toPlainObject(pData)));
    
    // Ocultar a janela principal do caderno de aula
    if (isEmbedded) {
        window.dispatchEvent(new CustomEvent('TOGGLE_NOTEBOOK', { detail: { open: false } }));
    }
    
    const params = new URLSearchParams({
        sessionId,
        planId,
        editalNodeId,
        type,
        topicTitle,
        initialPdfUrl: activePdfUrl || ''
    });
    
    const popoutUrl = `/notebook-popout?${params.toString()}`;
    window.open(popoutUrl, 'notebookPopout', 'width=1200,height=800');
  };

  useEffect(() => {
    const handlePopoutClosed = (e: any) => {
        if (e.detail?.sessionId) {
            setIsPopoutOpen(false);
        }
    };
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'REQUEST_SESSION_DATA') {
          // Responder com os dados caso o localStorage tenha falhado no popout
          const pData = {
              materials,
              editalNode,
              metaLookup
          };
          if (event.source) {
             (event.source as Window).postMessage({ 
                 type: 'SYNC_SESSION_DATA', 
                 sessionId: event.data.sessionId,
                 pData 
             }, '*');
          }
      }
    };
    
    window.addEventListener('POPOUT_CLOSED', handlePopoutClosed);
    window.addEventListener('message', handleMessage);
    
    return () => {
        window.removeEventListener('POPOUT_CLOSED', handlePopoutClosed);
        window.removeEventListener('message', handleMessage);
    };
  }, [materials, editalNode, metaLookup]);

  const handleSetActivePdf = async (url: string) => {
    if (activePdfUrl === url) return;

    // Antes de trocar o PDF, garante que as anotações atuais foram salvas se houver alterações
    const isDirty = title !== lastSavedRef.current.title || content !== lastSavedRef.current.content;
    if (saveStatus === 'saving' || isDirty) {
      if (title.trim()) {
        await handleAutosave();
      }
    }

    setActivePdfUrl(url);
  };

  const handleNewNote = async () => {
    // 2. Proteção de Carregamento (Dirty State Check)
    const isDirty = title !== lastSavedRef.current.title || content !== lastSavedRef.current.content;
    if (saveStatus === 'saving' || isDirty) {
      if (title.trim()) await handleAutosave();
    }

    setSelectedNote(null);
    setTitle('');
    setContent('');
    lastSavedRef.current = { title: '', content: '' };
  };

  const handleDelete = async () => {
    if (!noteToDelete) return;
    setIsDeleting(true);
    try {
      await notebookService.deleteNote(noteToDelete);
      toast.success("Anotação excluída");
      setNoteToDelete(null);
      await loadNotes();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadMaterial = async () => {
    if (!activePdfUrl || !currentUser) return;
    setIsDownloadingPdf(true);
    const toastId = toast.loading("Aplicando marca d'água de segurança...");
    
    try {
        const res = await fetch('/api/download-watermarked-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: { type: 'url', url: activePdfUrl }, uid: currentUser.uid })
        });
        
        if (!res.ok) throw new Error("Falha ao gerar");
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Material_${topicTitle.replace(/[^a-zA-Z0-9]/gi, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success("Download Concluído", { id: toastId });
    } catch (e) {
        toast.error("Erro no download seguro do PDF", { id: toastId });
    } finally {
        setIsDownloadingPdf(false);
    }
  };

  const handleDownloadNotes = async () => {
    // If we're generating notes PDF, we create a temporary hidden div
    if (!content || !currentUser) {
        toast.error("Você precisa ter anotações para exportar.");
        return;
    }
    
    setIsDownloadingPdf(true);
    const toastId = toast.loading("Gerando PDF em alta definição...");

    try {
        const printContainer = document.createElement('div');
        printContainer.innerHTML = `
            <div style="font-family: sans-serif; color: black; padding: 40px; text-align: left;">
                <h1 style="color: #ed3237; font-size: 24px; text-transform: uppercase;">${topicTitle}</h1>
                <h2 style="color: #333; font-size: 18px; margin-bottom: 30px;">Anotações do Aluno${title ? ` - ${title}` : ''}</h2>
                <div style="font-size: 14px; line-height: 1.6;">
                    ${content}
                </div>
            </div>
        `;
        document.body.appendChild(printContainer);

        // Dynamically import html2pdf to prevent hydration errors and keep initial chunk small
        const html2pdf = (await import('html2pdf.js')).default;
        
        const opt = {
          margin:       0.5,
          filename:     'notes.pdf',
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2 },
          jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        
        const pdfBase64 = await html2pdf().from(printContainer).set(opt).outputPdf('datauristring');
        document.body.removeChild(printContainer);
        
        toast.loading("Aplicando proteção ao material...", { id: toastId });
        
        const res = await fetch('/api/download-watermarked-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: { type: 'base64', base64: pdfBase64 }, uid: currentUser.uid })
        });
        
        if (!res.ok) throw new Error("Falha ao gerar PDF final");
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Anotacoes_${topicTitle.replace(/[^a-zA-Z0-9]/gi, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success("Download de Anotações Concluído!", { id: toastId });
    } catch (e) {
        toast.error("Erro na exportação do PDF. Verifique se possui anotações.", { id: toastId });
    } finally {
        setIsDownloadingPdf(false);
    }
  };

  if (!isOpen && !isEmbedded) return null;

  const isErrorNotebook = type === 'error';
  const isQuestionsNotebook = type === 'questions';

  const containerClass = isEmbedded 
    ? "relative w-full h-full bg-[#09090b] flex flex-col md:flex-row overflow-hidden shadow-2xl"
    : "fixed inset-0 z-[110] bg-[#09090b] flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-300";

  const contentAsModal = (
    <div className={containerClass}>
      
      <div className="relative w-full h-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 transition-all">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 bg-[#121214] shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isErrorNotebook ? 'bg-orange-500/10 text-orange-500' : isQuestionsNotebook ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
              {isQuestionsNotebook ? <AlertCircle size={24} /> : isErrorNotebook ? <AlertTriangle size={24} /> : <BookOpen size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white uppercase tracking-tight leading-tight">
                  {isQuestionsNotebook ? 'Caderno de Questões' : isErrorNotebook ? 'Caderno de Erros' : 'Caderno de Anotações'}
                </h2>
                {saveStatus !== 'idle' && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 animate-in fade-in duration-300">
                    {saveStatus === 'saving' ? (
                      <>
                        <Loader2 size={10} className="animate-spin text-zinc-500" />
                        <span className="text-[8px] font-black uppercase text-zinc-500 tracking-tighter">Salvando...</span>
                      </>
                    ) : saveStatus === 'saved' ? (
                      <>
                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                        <span className="text-[8px] font-black uppercase text-emerald-500 tracking-tighter">Salvo</span>
                      </>
                    ) : (
                      <>
                        <div className="w-1 h-1 rounded-full bg-red-500" />
                        <span className="text-[8px] font-black uppercase text-red-500 tracking-tighter">Erro</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-0.5">
                Tópico: {topicTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isPopoutOpen && (
              <button
                onClick={handleOpenPopout}
                className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                title="Modo Segundo Monitor"
              >
                <MonitorUp size={16} />
                <span className="hidden md:inline">2º Monitor</span>
              </button>
            )}
            {!isEmbedded && (
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-all"
              >
                <X size={24} />
              </button>
            )}
          </div>
        </div>

        {/* Main Content (Split Layout) */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {isPopoutOpen ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#09090b]">
              <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <MonitorUp size={40} className="text-blue-500" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter font-orbitron mb-2">Caderno Desacoplado</h3>
              <p className="text-sm text-zinc-400 max-w-md">
                O caderno está aberto no <strong>Modo Segundo Monitor</strong>. O conteúdo digitado lá está sendo salvo automaticamente.
              </p>
              <button 
                onClick={() => {
                  setIsPopoutOpen(false);
                  if (isEmbedded) {
                     window.dispatchEvent(new CustomEvent('TOGGLE_NOTEBOOK', { detail: { open: true } }));
                  }
                }}
                className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-white/10"
              >
                Forçar Retorno
              </button>
            </div>
          ) : (
            <>
              {/* Sidebar Toggle (Open) - Only visible when sidebar is closed */}
              {!isSidebarOpen && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="absolute left-4 top-4 z-40 p-2 bg-[#121214] border border-white/10 rounded-lg text-zinc-400 hover:text-white shadow-xl transition-all animate-in fade-in slide-in-from-left-4 duration-300"
                  title="Abrir Menu"
                >
                  <PanelLeftOpen size={20} />
                </button>
              )}


          {/* Sidebar (List) */}
          <div className={`relative flex flex-col h-full bg-[#0c0c0e] border-r border-white/10 transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
            isSidebarOpen 
              ? 'w-full md:w-[280px] lg:w-[320px] opacity-100' 
              : 'w-0 opacity-0 border-r-0'
          } ${activePdfUrl && !isSidebarOpen ? 'hidden md:flex' : 'flex'}`}>
            
            {/* Inner Fixed-Width Container to prevent layout break during animation */}
            <div className="w-full md:w-[280px] lg:w-[320px] h-full flex flex-col shrink-0">
              {/* TABS HEADER */}
              <div className="flex items-center border-b border-white/10 bg-[#0f0f11]">
                <div className="flex-1 flex">
                  <button 
                    onClick={() => setSidebarTab('notes')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'notes' ? 'text-white border-b-2 border-red-600' : 'text-zinc-600 hover:text-zinc-400'}`}
                  >
                    {isQuestionsNotebook ? 'Questões' : 'Anotações'}
                  </button>
                  <button 
                    onClick={() => setSidebarTab('materials')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'materials' ? 'text-white border-b-2 border-red-600' : 'text-zinc-600 hover:text-zinc-400'}`}
                  >
                    {isQuestionsNotebook ? `Links (${countTotalLinks(hierarchicalLinks)})` : `Materiais (${materials.length})`}
                  </button>
                </div>
                
                {/* Close Sidebar Button */}
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-3 text-zinc-600 hover:text-white transition-colors"
                  title="Esconder Menu"
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>

              {sidebarTab === 'notes' ? (
              <>
                <div className="p-4 border-b border-white/5 flex gap-2">
                  <button 
                    onClick={handleNewNote}
                    className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    <Plus size={16} />
                    Nota
                  </button>
                  <button 
                    onClick={handleNewFolder}
                    className="flex-1 py-2.5 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    <Plus size={16} />
                    Pasta
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Loader2 className="animate-spin text-zinc-600" size={20} />
                      <span className="text-[10px] text-zinc-600 font-bold uppercase">Carregando...</span>
                    </div>
                  ) : notes.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-[10px] text-zinc-600 font-bold uppercase">Nenhuma anotação vinculada.</p>
                    </div>
                  ) : (
                    <DraggableNotesList 
                       notes={notes}
                       selectedNote={selectedNote}
                       onSelectNote={handleSelectNote}
                       onDeleteNote={(id) => setNoteToDelete(id)}
                       onMoveNote={handleMoveNote}
                       onRenameNote={handleRenameNote}
                       onUpdatePositions={handleUpdatePositions}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
                {isQuestionsNotebook ? (
                  hierarchicalLinks.length === 0 ? (
                    <div className="text-center py-10 px-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-3">
                            <LinkIcon size={20} className="text-zinc-700" />
                        </div>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase leading-tight">Nenhum link de questões encontrado nesta disciplina.</p>
                    </div>
                  ) : (
                    hierarchicalLinks.map((node) => (
                      <QuestionAccordion key={node.id} node={node} />
                    ))
                  )
                ) : materials.length === 0 ? (
                    <div className="text-center py-10 px-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-3">
                            <AlertCircle size={20} className="text-zinc-700" />
                        </div>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase leading-tight">Nenhum material PDF vinculado a este tópico.</p>
                    </div>
                ) : (
                    materials.map((mat, idx) => (
                        <div 
                            key={idx}
                            onClick={() => handleSetActivePdf(mat.url)}
                            className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                activePdfUrl === mat.url 
                                  ? 'bg-red-500/10 border-red-500/30' 
                                  : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'
                            }`}
                        >
                            <div className="p-1.5 bg-zinc-900 rounded border border-white/5">
                                <BookOpen size={14} className={activePdfUrl === mat.url ? 'text-red-500' : 'text-zinc-500'} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold truncate ${activePdfUrl === mat.url ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                                    {mat.name}
                                </p>
                                <p className="text-[9px] text-zinc-600 font-mono truncate">
                                    {mat.goalContext || 'PDF DOCUMENT'}
                                </p>
                            </div>
                        </div>
                    ))
                )}
              </div>
            )}
          </div>
        </div>

          {/* Editor Area / PDF View Area */}
          <div className="flex-1 flex overflow-hidden bg-[#09090b] transition-all duration-300 relative">
             
             {/* PDF Viewer Column (Desktop Side-by-Side) */}
             {activePdfUrl && !isQuestionsNotebook && (
                <div className={`flex-1 flex flex-col border-r border-white/5 bg-[#121214] animate-in slide-in-from-left duration-300 shrink-0 ${
                  isNotebookMinimized ? 'w-full' : 'w-full md:w-1/2'
                }`}>
                    <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/40">
                         <div className="flex items-center gap-2">
                             <FileText size={14} className="text-red-500" />
                             <span className="text-[10px] font-black uppercase text-zinc-400">Visualizador de Material</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <button 
                                onClick={handleDownloadMaterial}
                                disabled={isDownloadingPdf}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-blue-500 hover:text-blue-400 transition-all flex items-center gap-1.5 text-[9px] font-bold uppercase border border-blue-500/20 disabled:opacity-50"
                                title="Baixar Material (PDF Original)"
                            >
                                {isDownloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                <span className="hidden sm:inline">Baixar Material</span>
                            </button>

                            {isNotebookMinimized && (
                              <button 
                                onClick={() => setIsNotebookMinimized(false)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-amber-500 hover:text-amber-400 transition-all flex items-center gap-1.5 text-[9px] font-bold uppercase border border-amber-500/20"
                              >
                                <StickyNote size={14} />
                                Abrir Anotações
                              </button>
                            )}
                            <button 
                                onClick={() => {
                                  setActivePdfUrl(null);
                                  setIsNotebookMinimized(false);
                                }}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-all flex items-center gap-1.5 text-[9px] font-bold uppercase"
                            >
                                <X size={14} />
                                Fechar
                            </button>
                         </div>
                    </div>
                    <div className="flex-1 bg-zinc-900 relative overflow-hidden">
                        <InsanusPdfViewer url={activePdfUrl} />
                    </div>
                </div>
             )}

             {/* Editor Column */}
             <div className={`flex-1 flex flex-col relative transition-all ${
               activePdfUrl && !isQuestionsNotebook 
                 ? (isNotebookMinimized ? 'hidden' : 'w-full md:w-1/2 hidden md:flex') 
                 : 'w-full flex'
             }`}>
                {/* Editor Header Actions */}
                <div className="flex items-center justify-end px-6 pt-4 shrink-0 gap-2">
                   <button 
                      onClick={handleDownloadNotes}
                      disabled={isDownloadingPdf}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-emerald-500/20 rounded-lg text-emerald-500 hover:text-emerald-400 transition-all text-[9px] font-black uppercase tracking-widest group"
                      title="Baixar minhas anotações em PDF"
                   >
                     {isDownloadingPdf ? <Loader2 size={12} className="animate-spin" /> : <PenTool size={12} className="group-hover:scale-110 transition-transform" />}
                     <span>Baixar Anotações</span>
                   </button>

                   {activePdfUrl && !isQuestionsNotebook && !isNotebookMinimized && (
                      <button 
                        onClick={() => setIsNotebookMinimized(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest group"
                        title="Focar no PDF (Minimizar Editor)"
                      >
                        <Minimize2 size={14} className="group-hover:scale-110 transition-transform" />
                        Minimizar Editor
                      </button>
                   )}
                </div>

                {/* Title Input */}
                <div className="p-6 pb-2 shrink-0">
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Título da sua anotação..."
                      className="w-full bg-transparent border-none text-2xl font-black text-white focus:outline-none placeholder:text-zinc-800 tracking-tight"
                    />
                </div>

                {/* Editor */}
                <div className="flex-1 p-6 pt-2 overflow-hidden flex flex-col">
                    <TipTapEditor 
                      content={content} 
                      onChange={setContent}
                      placeholder="Comece a escrever aqui..."
                    />
                </div>

                {/* Footer Actions Removed for Clean UI Autosave */}
             </div>

             {/* Mobile Float Switch Button */}
             {activePdfUrl && !isQuestionsNotebook && !isNotebookMinimized && (
                <button 
                    onClick={() => setActivePdfUrl(null)}
                    className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] bg-zinc-950 border border-white/10 px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl text-white animate-in slide-in-from-bottom-8 duration-300"
                >
                    <StickyNote size={18} className="text-red-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Voltar para Anotação</span>
                </button>
             )}

             {/* Floating Restore Button (Focus Mode) - Desktop & Tablet */}
             {activePdfUrl && !isQuestionsNotebook && isNotebookMinimized && (
                <button 
                  onClick={() => setIsNotebookMinimized(false)}
                  className={`fixed right-6 z-[130] bg-[#1a1a1e] hover:bg-[#252529] border border-amber-500/30 hover:border-amber-500/50 px-5 py-3 rounded-2xl hidden md:flex items-center gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white animate-in slide-in-from-right-12 duration-500 transition-all group ${
                    isFloating ? 'bottom-[280px]' : 'bottom-6'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-black transition-all">
                    <Maximize2 size={18} />
                  </div>
                  <div className="flex flex-col items-start leading-none text-left">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-500">Anotações</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">Restaurar Editor</span>
                  </div>
                </button>
             )}
          </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={!!noteToDelete}
        onClose={() => setNoteToDelete(null)}
        onConfirm={handleDelete}
        title="Excluir Anotação?"
        message="Esta ação é permanente e não pode ser desfeita. Deseja continuar?"
        isLoading={isDeleting}
        confirmText="Sim, Excluir"
        variant="danger"
      />

      <MoveNoteModal 
         isOpen={isMoveModalOpen}
         onClose={() => setIsMoveModalOpen(false)}
         note={noteToMove}
         folders={folders}
         onMove={executeMove}
      />
    </div>
  );

  if (isEmbedded) {
    return contentAsModal;
  }

  return createPortal(contentAsModal, document.body);
};
