import React, { useState, useEffect, useRef } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import { 
  ChevronLeft, ChevronRight, Minus, Plus, Loader2, AlertCircle,
  MousePointer2, Highlighter, StickyNote, Eraser, Trash2, BookOpen
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useStudyContext } from '../../../contexts/StudyContext';
import { notebookService } from '../../../services/notebookService';
import { applyWatermarkToPdf } from '../../../utils/pdfSecurityService';
import toast from 'react-hot-toast';

// Import CSS for annotations and text layers
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Helper function for contrast
const getContrastColor = (hexcolor: string) => {
    if (!hexcolor) return '#ffffff';
    const r = parseInt(hexcolor.slice(1, 3), 16);
    const g = parseInt(hexcolor.slice(3, 5), 16);
    const b = parseInt(hexcolor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
};

interface InsanusPdfViewerProps {
    url: string;
}

type ToolType = 'select' | 'highlight' | 'note' | 'eraser';

const HIGHLIGHT_COLORS = [
    { name: 'Amarelo', value: '#eaff00' },
    { name: 'Verde', value: '#00ffcc' },
    { name: 'Rosa', value: '#ff007f' }
];

export const InsanusPdfViewer: React.FC<InsanusPdfViewerProps> = ({ url }) => {
    const { currentUser, userData } = useAuth();
    const { setIsMaterialActive } = useStudyContext();

    // Material active state management
    useEffect(() => {
        setIsMaterialActive(true);
        return () => setIsMaterialActive(false);
    }, [setIsMaterialActive]);
    
    // PDF Data & Loading State
    const [numPages, setNumPages] = useState<number>();
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [isDocumentLoading, setIsDocumentLoading] = useState(true);
    
    // Tools State
    const [activeTool, setActiveTool] = useState<ToolType>('select');
    const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value);
    const [preferredNoteColor, setPreferredNoteColor] = useState(localStorage.getItem('insanus-pref-note-color') || '#10b981'); // Emerald default
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);
    
    // Annotations State
    const [highlights, setHighlights] = useState<any[]>([]);
    const [notes, setNotes] = useState<any[]>([]);
    const [readingCursor, setReadingCursor] = useState<{ x: number, y: number, page: number } | null>(null);
    
    // UI State
    const [activeNote, setActiveNote] = useState<any>(null);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
    const dragStarted = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastSavedRef = useRef({ highlights: [] as any[], notes: [] as any[] });

    // Load Annotations
    useEffect(() => {
        if (currentUser && url) {
            setIsDocumentLoading(true);
            loadAnnotations();
        }
    }, [currentUser, url]);

    // Autosave logic
    useEffect(() => {
        if (!currentUser || isLoadingAnnotations) return;
        
        // Deep equal check to avoid redundant saves
        const currentData = JSON.stringify({ highlights, notes });
        const lastData = JSON.stringify(lastSavedRef.current);
        
        if (currentData === lastData) return;

        const timeoutId = setTimeout(() => {
            handleAutosave();
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [highlights, notes, isLoadingAnnotations]);

    const handleAutosave = async () => {
        if (!currentUser) return;
        setSaveStatus('saving');
        try {
            const materialId = getMaterialId(url);
            await notebookService.savePdfAnnotations({
                userId: currentUser.uid,
                materialId,
                highlights,
                notes
            });
            lastSavedRef.current = { highlights: [...highlights], notes: [...notes] };
            setSaveStatus('saved');
            // Hide success message after 3 seconds
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            console.error("Erro no autosave do PDF:", error);
            setSaveStatus('error');
        }
    };

    const getMaterialId = (rawUrl: string) => {
        try {
            // Remove token from FB Storage URL for a stable ID
            const urlObj = new URL(rawUrl);
            return urlObj.pathname;
        } catch {
            return rawUrl;
        }
    };

    const loadAnnotations = async () => {
        if (!currentUser) return;
        setIsLoadingAnnotations(true);
        try {
            const materialId = getMaterialId(url);
            const data = await notebookService.getPdfAnnotations(currentUser.uid, materialId);
            if (data) {
                const loadedHighlights = data.highlights || [];
                const loadedNotes = data.notes || [];
                setHighlights(loadedHighlights);
                setNotes(loadedNotes);
                lastSavedRef.current = { highlights: loadedHighlights, notes: loadedNotes };
            } else {
                setHighlights([]);
                setNotes([]);
                lastSavedRef.current = { highlights: [], notes: [] };
            }
        } catch (error) {
            console.error("Erro ao carregar marcações:", error);
        } finally {
            setIsLoadingAnnotations(false);
        }
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setPageNumber(1);
        setIsDocumentLoading(false);
    }

    const handleMouseUp = () => {
        setIsMouseDown(false);
        // Delay resetting dragStarted to allow the onClick handler to see it
        setTimeout(() => {
            dragStarted.current = false;
        }, 50);
        setDraggedNoteId(null);
        if (activeTool !== 'highlight') return;
        
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        
        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();
        
        if (rects.length === 0) return;
        
        // Find the page container
        const pageElement = document.querySelector(`.react-pdf__Page[data-page-number="${pageNumber}"]`);
        if (!pageElement) return;
        
        const pageRect = pageElement.getBoundingClientRect();
        
        const newRects = Array.from(rects).map(rect => ({
            top: ((rect.top - pageRect.top) / pageRect.height) * 100,
            left: ((rect.left - pageRect.left) / pageRect.width) * 100,
            width: (rect.width / pageRect.width) * 100,
            height: (rect.height / pageRect.height) * 100
        }));
        
        const newHighlight = {
            id: crypto.randomUUID(),
            page: pageNumber,
            rects: newRects,
            color: selectedColor,
            createdAt: Date.now()
        };
        
        setHighlights(prev => [...prev, newHighlight]);
        
        // Clear selection
        selection.removeAllRanges();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isMouseDown) return;

        // Note Drag & Drop Logic
        if (draggedNoteId) {
            dragStarted.current = true;
            const pageElement = document.querySelector(`.react-pdf__Page[data-page-number="${pageNumber}"]`);
            if (!pageElement) return;

            const pageRect = pageElement.getBoundingClientRect();
            const x = ((e.clientX - pageRect.left) / pageRect.width) * 100;
            const y = ((e.clientY - pageRect.top) / pageRect.height) * 100;

            // Constrain within page bounds (0-100)
            const clampedX = Math.max(0, Math.min(100, x));
            const clampedY = Math.max(0, Math.min(100, y));

            setNotes(prev => prev.map(n => n.id === draggedNoteId ? { ...n, x: clampedX, y: clampedY } : n));
            return;
        }

        // Eraser logic
        if (activeTool !== 'eraser') return;
        
        const pageElement = (e.target as HTMLElement).closest('.react-pdf__Page');
        if (!pageElement) return;
        
        const pageRect = pageElement.getBoundingClientRect();
        const x = ((e.clientX - pageRect.left) / pageRect.width) * 100;
        const y = ((e.clientY - pageRect.top) / pageRect.height) * 100;

        // Detector de colisão com grifos
        setHighlights(prev => prev.filter(h => {
            if (h.page !== pageNumber) return true;
            
            // Verifica se o mouse está dentro de algum dos retângulos do grifo
            const isColliding = h.rects.some((rect: any) => {
                // Buffer de colisão para facilitar o uso da borracha (2%)
                const buffer = 1.5;
                return (
                    x >= rect.left - buffer && 
                    x <= rect.left + rect.width + buffer &&
                    y >= rect.top - buffer && 
                    y <= rect.top + rect.height + buffer
                );
            });

            return !isColliding;
        }));
    };

    const handleMouseDown = () => {
        setIsMouseDown(true);
    };

    const handleContainerClick = (e: React.MouseEvent) => {
        const pageElement = (e.target as HTMLElement).closest('.react-pdf__Page');
        if (!pageElement) return;
        
        const pageRect = pageElement.getBoundingClientRect();
        const x = ((e.clientX - pageRect.left) / pageRect.width) * 100;
        const y = ((e.clientY - pageRect.top) / pageRect.height) * 100;

        // Reading Orientation Cursor (Focus Caret)
        setReadingCursor({ x, y, page: pageNumber });

        if (activeTool !== 'note') return;
        
        const newNote = {
            id: crypto.randomUUID(),
            page: pageNumber,
            x,
            y,
            text: '',
            color: preferredNoteColor,
            createdAt: Date.now()
        };
        
        setNotes(prev => [...prev, newNote]);
        setActiveNote(newNote);
        setActiveTool('select'); // Switch to select to allow typing
    };

    const clearAll = () => {
        if (window.confirm("Deseja limpar todas as marcações deste PDF?")) {
            setHighlights([]);
            setNotes([]);
        }
    };

    if (!url) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#09090b] text-zinc-600 gap-4">
                <BookOpen size={48} className="opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhum material selecionado</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full bg-[#18181b] overflow-hidden">
            {/* Topbar do PDF com Controles */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-[#121214] px-4 py-2 shrink-0 border-b border-white/10 gap-2">
                
                {/* Navigation Tools */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/5">
                        <button 
                            onClick={() => setPageNumber(p => Math.max(p - 1, 1))} 
                            disabled={pageNumber <= 1} 
                            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-[10px] font-black uppercase text-zinc-400 min-w-[60px] text-center tracking-widest">
                            {pageNumber} / {numPages || '--'}
                        </span>
                        <button 
                            onClick={() => setPageNumber(p => Math.min(p + 1, numPages || 1))} 
                            disabled={pageNumber >= (numPages || 1)} 
                            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="hidden sm:flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/5 ml-2">
                        <button 
                            onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} 
                            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all"
                        >
                            <Minus size={16} />
                        </button>
                        <span className="text-[10px] font-black uppercase text-zinc-400 w-12 text-center tracking-widest">
                            {Math.round(scale * 100)}%
                        </span>
                        <button 
                            onClick={() => setScale(s => Math.min(s + 0.2, 2.5))} 
                            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>

                {/* STUDY TOOLS - TOOLBAR */}
                <div className="flex items-center gap-1 bg-zinc-900 border border-white/10 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTool('select')}
                        className={`p-2 rounded-lg flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider transition-all ${activeTool === 'select' ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                        title="Selecionar Texto"
                    >
                        <MousePointer2 size={14} />
                        <span className="hidden lg:inline">Selecionar</span>
                    </button>

                    <div className="flex items-center gap-1 ml-1 pr-1 border-r border-white/5">
                        <button 
                            onClick={() => setActiveTool('highlight')}
                            className={`p-2 rounded-lg flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider transition-all ${activeTool === 'highlight' ? 'bg-amber-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                            title="Marca-Texto"
                        >
                            <Highlighter size={14} />
                            <span className="hidden lg:inline">Grifar</span>
                        </button>
                        
                        {/* Color Selector */}
                        <div className="flex items-center gap-1 px-1">
                            {HIGHLIGHT_COLORS.map(color => (
                                <button
                                    key={color.value}
                                    onClick={() => {
                                        setSelectedColor(color.value);
                                        setActiveTool('highlight');
                                    }}
                                    className={`w-4 h-4 rounded-full border border-white/20 transition-all hover:scale-125 ${selectedColor === color.value && activeTool === 'highlight' ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121214]' : 'opacity-60 hover:opacity-100'}`}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={() => setActiveTool('note')}
                        className={`p-2 rounded-lg flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider transition-all ${activeTool === 'note' ? 'bg-emerald-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                        title="Adicionar Comentário"
                    >
                        <StickyNote size={14} />
                        <span className="hidden lg:inline">Nota</span>
                    </button>
                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                    <button 
                        onClick={() => setActiveTool('eraser')}
                        className={`p-2 rounded-lg flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider transition-all ${activeTool === 'eraser' ? 'bg-zinc-100 text-zinc-900 shadow-lg' : 'text-zinc-500 hover:text-red-500 hover:bg-red-500/10'}`}
                        title="Borracha de Grifos"
                    >
                        <Eraser size={14} />
                    </button>
                </div>

                {/* Manual Save Removed for Autosave */}
                {saveStatus !== 'idle' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 animate-in fade-in duration-300">
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

            {/* Área de Renderização do Canvas (Scrollable) */}
            <div 
                ref={containerRef}
                className={`flex-1 overflow-auto bg-[#09090b] p-4 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700 relative ${activeTool === 'highlight' ? 'cursor-text' : activeTool === 'note' ? 'cursor-crosshair' : activeTool === 'eraser' ? 'cursor-cell' : 'cursor-default'}`}
                onMouseUp={handleMouseUp}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onClick={handleContainerClick}
            >
                {(isLoadingAnnotations || isDocumentLoading) && (
                    <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-red-600" size={32} />
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Carregando Material...</span>
                        </div>
                    </div>
                )}
                
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={null}
                    error={
                        <div className="flex flex-col items-center justify-center mt-20 gap-4 text-center p-6 bg-red-500/5 rounded-2xl border border-red-500/10 mx-auto max-w-sm">
                            <AlertCircle className="text-red-500" size={32} />
                            <div>
                                <p className="text-sm font-bold text-red-500 mb-1">Erro ao carregar o PDF</p>
                                <p className="text-[10px] text-zinc-500 font-medium">Isso pode ocorrer devido a restrições de segurança ou falha na conexão.</p>
                            </div>
                            <a 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-5 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                            >
                                Abrir em nova aba
                            </a>
                        </div>
                    }
                >
                    <div className="w-max min-w-full flex justify-center">
                        <div className="relative shadow-2xl border border-white/5">
                            {/* Annotation Overlay Layer */}
                            <div 
                                className="absolute inset-0 z-[5] pointer-events-none"
                                style={{ width: '100%', height: '100%' }}
                            >
                                {/* Highlights */}
                                {highlights
                                    .filter(h => h.page === pageNumber)
                                    .map((h, i) => (
                                        <div key={i}>
                                            {h.rects.map((rect: any, j: number) => (
                                                <div 
                                                    key={j}
                                                    className="absolute mix-blend-multiply transition-opacity duration-200"
                                                    style={{
                                                        top: `${rect.top}%`,
                                                        left: `${rect.left}%`,
                                                        width: `${rect.width}%`,
                                                        height: `${rect.height}%`,
                                                        backgroundColor: h.color,
                                                        opacity: 0.4 // Opacidade fixa anti-sobreposição
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    ))
                                }

                                {/* Sticky Notes Icons */}
                                {notes
                                    .filter(n => n.page === pageNumber)
                                    .map((n) => (
                                        <button
                                            key={n.id}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setIsMouseDown(true);
                                                setDraggedNoteId(n.id);
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (dragStarted.current) return; // Don't open if dragged
                                                setActiveNote(n);
                                            }}
                                            className="absolute p-1 text-white rounded shadow-lg transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto hover:scale-125 transition-transform cursor-move"
                                            style={{ 
                                                top: `${n.y}%`, 
                                                left: `${n.x}%`, 
                                                backgroundColor: n.color || '#10b981' 
                                            }}
                                        >
                                            <StickyNote size={14} fill={n.text ? 'currentColor' : 'none'} />
                                        </button>
                                    ))
                                }

                                {/* Reading Focus Cursor */}
                                {readingCursor && readingCursor.page === pageNumber && (
                                    <div 
                                        className="absolute w-0.5 h-4 bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse z-10 pointer-events-none transition-all duration-300"
                                        style={{ top: `${readingCursor.y}%`, left: `${readingCursor.x}%`, transform: 'translateY(-50%)' }}
                                    />
                                )}
                            </div>

                            <Page 
                                pageNumber={pageNumber} 
                                scale={scale} 
                                renderTextLayer={true} 
                                renderAnnotationLayer={false}
                            />
                        </div>
                    </div>
                </Document>

                {/* Note Editor Popup */}
                {activeNote && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                             <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
                                  <div className="flex items-center gap-2" style={{ color: activeNote.color || '#10b981' }}>
                                      <StickyNote size={16} />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Nota Adesiva</span>
                                  </div>
                                  <button onClick={() => setActiveNote(null)} className="text-zinc-500 hover:text-white transition-colors">
                                      <Minus size={20} />
                                  </button>
                             </div>
                              <div className="p-4 space-y-4">
                                 {/* Color Selection for Notes */}
                                 <div className="flex items-center justify-between mb-2">
                                     <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Cor da Nota</span>
                                     <div className="flex items-center gap-2">
                                        {['#10b981', '#f59e0b', '#ef4444'].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => {
                                                    const updatedNote = { ...activeNote, color };
                                                    setNotes(prev => prev.map(n => n.id === activeNote.id ? updatedNote : n));
                                                    setActiveNote(updatedNote);
                                                    setPreferredNoteColor(color);
                                                    localStorage.setItem('insanus-pref-note-color', color);
                                                }}
                                                className={`w-4 h-4 rounded-full border border-white/20 transition-all ${activeNote.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121214]' : 'opacity-60'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                        
                                        {/* Visual Color Picker */}
                                        <div className="relative group">
                                            <input 
                                                type="color"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                value={activeNote.color || '#10b981'}
                                                onChange={(e) => {
                                                    const color = e.target.value;
                                                    const updatedNote = { ...activeNote, color };
                                                    setNotes(prev => prev.map(n => n.id === activeNote.id ? updatedNote : n));
                                                    setActiveNote(updatedNote);
                                                    setPreferredNoteColor(color);
                                                    localStorage.setItem('insanus-pref-note-color', color);
                                                }}
                                            />
                                            <div 
                                                className="w-4 h-4 rounded shadow-lg border border-white/20 flex items-center justify-center transition-all group-hover:scale-110"
                                                style={{ backgroundColor: activeNote.color || '#10b981' }}
                                            >
                                                <Plus size={8} className="text-white mix-blend-difference" />
                                            </div>
                                        </div>
                                     </div>
                                 </div>

                                 <textarea 
                                    className="w-full h-32 bg-black/40 border border-white/5 rounded-xl p-3 text-sm text-zinc-300 focus:outline-none transition-all resize-none shadow-inner"
                                    style={{ borderColor: `${activeNote.color}33` }}
                                    placeholder="Escreva seu comentário aqui..."
                                    value={activeNote.text}
                                    onChange={(e) => {
                                        const newText = e.target.value;
                                        setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, text: newText } : n));
                                        setActiveNote({ ...activeNote, text: newText });
                                    }}
                                    autoFocus
                                 />
                             </div>
                             <div className="p-3 bg-black/20 flex justify-between gap-2">
                                 <button 
                                    onClick={() => {
                                        setNotes(prev => prev.filter(n => n.id !== activeNote.id));
                                        setActiveNote(null);
                                    }}
                                    className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                                    title="Excluir Nota"
                                 >
                                     <Trash2 size={16} />
                                 </button>
                                 <button 
                                    onClick={() => setActiveNote(null)}
                                    className="flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                                    style={{ 
                                        backgroundColor: activeNote.color || '#10b981',
                                        color: getContrastColor(activeNote.color || '#10b981')
                                    }}
                                 >
                                     Concluído
                                 </button>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
