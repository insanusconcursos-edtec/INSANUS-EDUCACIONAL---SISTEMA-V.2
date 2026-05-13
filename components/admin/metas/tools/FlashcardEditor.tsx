import React, { useState, useRef } from 'react';
import { 
  Plus, Trash2, Loader2, Sparkles, AlertTriangle, 
  CheckCircle2, Maximize2, FileText, X, UploadCloud, BrainCircuit
} from 'lucide-react';

import { Flashcard } from '../../../../services/metaService';
import { generateFlashcardsFromDocuments } from '../../../../services/ai/flashcardGenerator';

// IMPORTAÇÃO REAL
import FlashcardFullscreenEditor from './FlashcardFullscreenEditor';

// === MAIN EDITOR WIDGET ===
interface FlashcardEditorProps {
  cards: Flashcard[];
  onChange: (cards: Flashcard[]) => void;
}

const FlashcardEditor: React.FC<FlashcardEditorProps> = ({ cards, onChange }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  
  // Staging area for files
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Estado para Modal de Reset
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ACTIONS ---

  const handleManualAdd = () => {
    const newCard: Flashcard = {
      id: `manual-${Date.now()}`,
      front: '',
      back: ''
    };
    // Abre o fullscreen com o novo card já na lista
    onChange([...cards, newCard]);
    setIsFullscreenOpen(true); 
  };

  const handleResetRequest = () => {
    setIsResetModalOpen(true);
  };

  const confirmReset = () => {
    onChange([]);
    setSelectedFiles([]);
    setErrorMsg('');
    setIsResetModalOpen(false);
  };

  // --- FILE HANDLING (STAGING) ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      // Evitar duplicatas simples por nome e tamanho
      const uniqueNewFiles = newFiles.filter((nf: File) => 
        !selectedFiles.some((sf: File) => sf.name === nf.name && sf.size === nf.size)
      );
      
      setSelectedFiles(prev => [...prev, ...uniqueNewFiles]);
    }
    // Reset input to allow selecting same file again if deleted
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- AI GENERATION ---

  const handleGenerate = async () => {
    if (selectedFiles.length === 0) return;

    setIsGenerating(true);
    setErrorMsg('');

    try {
      const generatedCards = await generateFlashcardsFromDocuments(selectedFiles);
      
      // Adiciona aos existentes (Append strategy)
      onChange([...cards, ...generatedCards]);
      
      // Limpa staging após sucesso
      setSelectedFiles([]);

    } catch (err: unknown) {
      console.error("Erro na geração de flashcards:", err);
      const error = err as { message?: string };
      setErrorMsg(error.message || "Erro desconhecido ao processar documentos.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- RENDER STATES ---

  const hasCards = cards && cards.length > 0;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[10px] font-black text-pink-500 uppercase tracking-widest">
              <Sparkles size={14} /> Flashcards (IA)
          </label>
      </div>

      <div className="relative w-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden group min-h-[200px] flex flex-col">
        
        {/* ERROR MESSAGE OVERLAY */}
        {errorMsg && (
             <div className="absolute top-0 left-0 right-0 bg-red-900/90 text-white text-[10px] font-bold p-2 flex items-center justify-between z-50 animate-in slide-in-from-top-2">
                 <div className="flex items-center gap-2">
                    <AlertTriangle size={12} /> {errorMsg}
                 </div>
                 <button onClick={() => setErrorMsg('')}><X size={12}/></button>
             </div>
        )}

        {/* === STATE: PROCESSING === */}
        {isGenerating && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 animate-in fade-in duration-300 min-h-[300px]">
                <div className="relative">
                    <div className="absolute inset-0 bg-pink-500/20 blur-xl rounded-full"></div>
                    <Loader2 size={40} className="text-pink-500 animate-spin relative z-10" />
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-tighter animate-pulse">
                        Lendo {selectedFiles.length} Documentos...
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono">
                        A IA está analisando o conteúdo para criar perguntas e respostas.
                    </p>
                </div>
            </div>
        )}

        {/* === STATE: IDLE (NO CARDS) === */}
        {!isGenerating && !hasCards && (
            <div className="p-6 flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-pink-900/20 border border-pink-500/30 rounded-full flex items-center justify-center mx-auto mb-2">
                        <FileText size={20} className="text-pink-400" />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Gerador de Flashcards</h3>
                    <p className="text-[10px] text-zinc-500 max-w-xs mx-auto">
                        Envie apostilas ou leis (PDF) e a IA criará automaticamente os flashcards.
                    </p>
                </div>

                {/* Staging Area (Lista de Arquivos) */}
                {selectedFiles.length > 0 && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Arquivos Selecionados</span>
                            <span className="text-[9px] text-pink-500 font-bold">{selectedFiles.length} arquivos</span>
                        </div>
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg max-h-[150px] overflow-y-auto custom-scrollbar p-1">
                            {selectedFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 hover:bg-zinc-900 rounded group transition-colors">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <FileText size={12} className="text-zinc-500 shrink-0" />
                                        <span className="text-[10px] text-zinc-300 font-medium truncate">{file.name}</span>
                                        <span className="text-[9px] text-zinc-600 font-mono shrink-0">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveFile(idx)}
                                        className="text-zinc-600 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept=".pdf"
                        multiple // Permite múltiplos arquivos
                        onChange={handleFileSelect}
                    />
                    
                    {selectedFiles.length === 0 ? (
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="col-span-1 py-4 bg-pink-900/20 border border-pink-500/30 hover:bg-pink-900/40 hover:border-pink-500/50 text-pink-200 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest flex flex-col items-center justify-center gap-2"
                        >
                            <UploadCloud size={16} /> 
                            <span>Selecionar PDFs</span>
                        </button>
                    ) : (
                        <button 
                            type="button"
                            onClick={handleGenerate}
                            className="col-span-1 py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-xl shadow-[0_0_20px_rgba(219,39,119,0.2)] hover:shadow-[0_0_30px_rgba(219,39,119,0.4)] transition-all font-black uppercase text-[10px] tracking-widest flex flex-col items-center justify-center gap-2"
                        >
                            <BrainCircuit size={16} /> 
                            <span>Processar {selectedFiles.length} Arqs</span>
                        </button>
                    )}

                    <div className="col-span-1 flex flex-col gap-2">
                        {/* Botão para adicionar mais arquivos se já tiver selecionado */}
                        {selectedFiles.length > 0 && (
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg transition-all font-bold uppercase text-[9px] tracking-widest flex items-center justify-center gap-2"
                            >
                                <Plus size={12} /> Add Mais
                            </button>
                        )}
                        
                        <button 
                            type="button"
                            onClick={handleManualAdd}
                            className={`flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg transition-all font-bold uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 ${selectedFiles.length === 0 ? 'h-full rounded-xl py-4' : ''}`}
                        >
                            <Plus size={12} /> 
                            <span>Manual</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* === STATE: SUCCESS (HAS CARDS) === */}
        {!isGenerating && hasCards && (
            <div className="relative w-full flex flex-col items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-8 gap-6 animate-in zoom-in-95 duration-300 min-h-[320px]">
                
                <div className="relative bg-zinc-950 border border-emerald-500/30 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-sm w-full">
                    
                    {/* Botão Reset */}
                    <button 
                        type="button"
                        onClick={handleResetRequest}
                        className="absolute top-4 right-4 rounded-full p-2 text-zinc-600 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title="Apagar Cards"
                    >
                        <Trash2 size={14} />
                    </button>

                    <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                        <CheckCircle2 size={28} className="text-emerald-500" />
                    </div>
                    
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-1">
                        Flashcard Pronto
                    </h3>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-6 border px-3 py-1 rounded-full border-zinc-800 bg-zinc-900">
                        {cards.length} flashcards gerados
                    </p>

                    <button 
                        type="button"
                        onClick={() => setIsFullscreenOpen(true)}
                        className="w-full px-6 py-4 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:scale-[1.02]"
                    >
                        <Maximize2 size={14} /> Visualizar & Editar
                    </button>
                    
                    <div className="mt-4 text-[9px] text-zinc-600 font-mono">
                        Clique para organizar, editar ou adicionar mais.
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* FULLSCREEN EDITOR MODAL */}
      {isFullscreenOpen && (
        <FlashcardFullscreenEditor 
            cards={cards} 
            onChange={onChange} 
            onClose={() => setIsFullscreenOpen(false)} 
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE RESET */}
      {isResetModalOpen && (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div 
                className="w-[350px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-3 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Reiniciar Flashcard?</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                        Isso apagará todos os flashcards gerados até o momento. Deseja continuar?
                    </p>
                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setIsResetModalOpen(false)} 
                            className="flex-1 py-2.5 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 font-bold uppercase text-[10px] tracking-widest transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmReset} 
                            className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/40"
                        >
                            Sim, Reiniciar
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default FlashcardEditor;
