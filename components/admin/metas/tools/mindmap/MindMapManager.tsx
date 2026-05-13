import React, { useState } from 'react';
import { Wand2, Maximize2, BrainCircuit, Loader2, Sparkles, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { MindMapNode } from '../../../../../services/metaService';
import MindMapFullscreen from './MindMapFullscreen';
import MetaFilesUploader, { FileItem } from '../../shared/MetaFilesUploader';
import { generateMindMapStructure, AIMindMapNode } from '../../../../../services/aiService';

interface MindMapManagerProps {
  nodes: MindMapNode[];
  onChange: (nodes: MindMapNode[], isManualSave?: boolean) => void;
  planId?: string;
}

type ViewState = 'idle' | 'processing' | 'done' | 'error';

const MindMapManager: React.FC<MindMapManagerProps> = ({ nodes, onChange, planId }) => {
  const hasNodes = nodes && nodes.length > 0;
  const [viewState, setViewState] = useState<ViewState>(hasNodes ? 'done' : 'idle');
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Local state for "Knowledge Sources"
  const [sourceFiles, setSourceFiles] = useState<FileItem[]>([]);
  
  // Confirmation Modal State
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Processing Animation State
  const [processStep, setProcessStep] = useState(0);
  const processMessages = [
    "Enviando arquivos para o Gemini...",
    "Analisando contexto semântico...",
    "Estruturando hierarquia de conceitos...",
    "Finalizando árvore de conhecimento..."
  ];

  // Helper: Flatten Recursive JSON to Flat List with UUIDs
  const flattenAIResponse = (root: AIMindMapNode): MindMapNode[] => {
    const flatList: MindMapNode[] = [];
    
    // Função recursiva para percorrer e achatar a árvore
    const traverse = (node: AIMindMapNode, parentId?: string, level: number = 0) => {
      const currentId = crypto.randomUUID(); // Gera ID único real
      
      // Define cores baseadas no nível (apenas para inicialização, o VisualNode recalcula)
      let color = '#a855f7'; // Root (Purple)
      if (level === 1) color = '#ec4899'; // Pink
      if (level === 2) color = '#3b82f6'; // Blue
      if (level >= 3) color = '#10b981'; // Emerald

      const newNode: MindMapNode = {
        id: currentId,
        label: node.label.replace(/<[^>]*>?/gm, ''), // Remove HTML tags for raw label (VisualNode can re-apply if needed)
        // Mantém as tags HTML dentro de uma propriedade customizada se quisermos renderizar rich text no futuro, 
        // mas por enquanto o VisualNode usa contentEditable text. 
        // Vamos passar o label limpo e usar styles array se detectarmos <b>
        styles: node.label.includes('<b>') ? ['bold'] : [],
        x: 0, // Posição será gerenciada pelo Flexbox/VisualNode
        y: 0,
        color: color,
        type: level === 0 ? 'root' : 'child',
        parentId: parentId
      };

      flatList.push(newNode);

      if (node.children && node.children.length > 0) {
        node.children.forEach(child => traverse(child, currentId, level + 1));
      }
    };

    traverse(root);
    return flatList;
  };

  const handleGenerateAI = async () => {
    if (sourceFiles.length === 0) return;

    setViewState('processing');
    setProcessStep(0);
    setErrorMessage('');

    try {
      // Simulation of progress steps while waiting for promise
      const interval = setInterval(() => {
        setProcessStep(prev => prev < processMessages.length - 1 ? prev + 1 : prev);
      }, 2500);

      // Extract raw JS Files from FileItems
      const filesToProcess = sourceFiles
        .map(f => f.file)
        .filter((f): f is File => f !== undefined);

      if (filesToProcess.length === 0) {
        throw new Error("Nenhum arquivo válido encontrado para processar.");
      }

      // Call AI Service (Now accepts a single file for better reliability in this version)
      const aiRootNode = await generateMindMapStructure(filesToProcess[0]);
      
      clearInterval(interval);
      setProcessStep(3); // Final step

      // Parse and Update
      const flatNodes = flattenAIResponse(aiRootNode);
      onChange(flatNodes);
      
      // Small delay for UX
      setTimeout(() => {
        setViewState('done');
      }, 500);

    } catch (error: any) {
      console.error("AI Generation Error:", error);
      setViewState('error');
      setErrorMessage(error.message || "Falha ao gerar mapa mental.");
    }
  };

  const handleResetRequest = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    onChange([]);
    setViewState('idle');
    setSourceFiles([]);
    setErrorMessage('');
    setShowResetConfirm(false);
  };

  // Sync view state if props change externally (e.g. load from DB)
  if (hasNodes && viewState === 'idle') {
      setViewState('done');
  } else if (!hasNodes && viewState === 'done') {
      setViewState('idle');
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[10px] font-black text-purple-500 uppercase tracking-widest">
              <BrainCircuit size={14} /> Mapa Mental (IA)
          </label>
      </div>

      <div className="relative w-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden group min-h-[250px] flex flex-col">
        
        {/* === STATE: IDLE (Upload & Start) === */}
        {viewState === 'idle' && (
            <div className="p-6 flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-purple-900/20 border border-purple-500/30 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Sparkles size={20} className="text-purple-400" />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">NotebookLM Generator</h3>
                    <p className="text-[10px] text-zinc-500 max-w-xs mx-auto">
                        A IA irá ler seus PDFs e estruturar automaticamente todo o conhecimento em tópicos hierárquicos.
                    </p>
                </div>

                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                    <MetaFilesUploader 
                        files={sourceFiles} 
                        onChange={setSourceFiles} 
                        colorClass="text-purple-500"
                    />
                </div>

                <button 
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={sourceFiles.length === 0}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                >
                    <Wand2 size={16} /> Gerar Estrutura com IA
                </button>
            </div>
        )}

        {/* === STATE: PROCESSING === */}
        {viewState === 'processing' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 animate-in fade-in duration-300">
                <div className="relative">
                    <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
                    <Loader2 size={48} className="text-purple-500 animate-spin relative z-10" />
                </div>
                
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter animate-pulse">
                        Analisando Documentos...
                    </h3>
                    <p className="text-xs text-purple-400 font-mono">
                        {processMessages[processStep]}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="w-64 h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-purple-500 transition-all duration-700 ease-out"
                        style={{ width: `${((processStep + 1) / processMessages.length) * 100}%` }}
                    ></div>
                </div>
            </div>
        )}

        {/* === STATE: ERROR === */}
        {viewState === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-red-900/20 border border-red-500/30 rounded-full flex items-center justify-center mb-2">
                    <AlertTriangle size={32} className="text-red-500" />
                </div>
                
                <div className="text-center space-y-2 max-w-xs">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                        Erro na Geração
                    </h3>
                    <p className="text-xs text-red-400 font-mono break-words">
                        {errorMessage}
                    </p>
                </div>

                <button 
                    type="button"
                    onClick={() => setViewState('idle')}
                    className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold uppercase"
                >
                    Tentar Novamente
                </button>
            </div>
        )}

        {/* === STATE: DONE (Preview & Actions) === */}
        {viewState === 'done' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/30 backdrop-blur-md p-6 gap-6 animate-in zoom-in-95 duration-300">
                
                <div className="relative bg-zinc-950 border border-purple-500/30 p-6 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-sm w-full">
                    
                    {/* Botão de Exclusão / Reset */}
                    <button 
                        type="button"
                        onClick={handleResetRequest}
                        className="absolute top-4 right-4 rounded-full p-2 text-zinc-400 hover:bg-red-500/20 hover:text-red-500 transition-colors"
                        title="Excluir Mapa e Reiniciar"
                    >
                        <Trash2 size={18} />
                    </button>

                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4 border border-green-500/20">
                        <CheckCircle2 size={32} className="text-green-500" />
                    </div>
                    
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-1">
                        Mapa Gerado com Sucesso
                    </h3>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-6">
                        {nodes?.length || 0} tópicos estruturados hierarquicamente.
                    </p>

                    <button 
                        type="button"
                        onClick={() => setIsFullscreenOpen(true)}
                        className="w-full px-6 py-3 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 mb-3 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                    >
                        <Maximize2 size={14} /> Visualizar & Editar
                    </button>
                </div>
            </div>
        )}
      </div>

      {isFullscreenOpen && (
        <MindMapFullscreen 
            nodes={nodes} 
            onChange={onChange} 
            onClose={() => setIsFullscreenOpen(false)} 
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE RESET */}
      {showResetConfirm && (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div 
                className="w-[400px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-3 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Excluir Mapa Mental?</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        Todo o mapa mental gerado e suas edições serão perdidos. Deseja continuar?
                    </p>
                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setShowResetConfirm(false)} 
                            className="flex-1 py-3 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 font-bold uppercase text-xs tracking-widest transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmReset} 
                            className="flex-1 py-3 rounded-lg bg-red-600 text-white font-black uppercase text-xs tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/40"
                        >
                            Sim, Excluir
                        </button>
                    </div>
                </div>
            </div>
        </div>
       )}
    </div>
  );
};

export default MindMapManager;