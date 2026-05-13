import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, 
  Highlighter, List, Type, 
  Plus, StickyNote, Trash2, X, Droplet, Eraser,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { MindMapNode } from '../../../../../services/metaService';
import { ImageToolbarControl } from './ImageToolbarControl';

// Cores Padrão (Neon Palette) para acesso rápido
const PRESET_COLORS = [
  '#a855f7', // Roxo (Padrão)
  '#ec4899', // Rosa
  '#3b82f6', // Azul
  '#10b981', // Verde
  '#f59e0b', // Amarelo
  '#ef4444', // Vermelho
  '#64748b', // Cinza
  '#000000', // Preto
];

interface NodeToolbarProps {
  node: MindMapNode;
  onUpdate: (id: string, data: Partial<MindMapNode>) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onAddNote: (nodeId: string) => void; // New Prop
}

export default function NodeToolbar({ node, onUpdate, onAddChild, onDelete, onClose, onReorder, onAddNote }: NodeToolbarProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [customNodeColor, setCustomNodeColor] = useState(node.color || '#a855f7');
  const [hiliteColor, setHiliteColor] = useState('#facc15'); // Cor padrão do marca-texto (Amarelo)

  // Sincroniza conteúdo
  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== node.label) {
      contentRef.current.innerHTML = node.label;
    }
  }, [node.id]);

  const handleAction = (e: React.MouseEvent, action?: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (action) action();
  };

  const applyFormat = (command: string, value: string | null = null) => {
    document.execCommand(command, false, value ?? undefined);
    if (contentRef.current) contentRef.current.focus();
    saveContent();
  };

  const saveContent = () => {
    if (contentRef.current) {
      onUpdate(node.id, { label: contentRef.current.innerHTML });
    }
  };

  const handleNodeColorChange = (hex: string) => {
    setCustomNodeColor(hex);
    onUpdate(node.id, { color: hex });
  };

  return (
    <div 
      className="fixed z-[120] top-[50%] right-8 -translate-y-1/2 flex flex-col gap-3 rounded-xl border border-zinc-700 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-right-8 duration-200 w-[340px] max-h-[90vh] overflow-y-auto custom-scrollbar"
      onMouseDown={(e) => e.stopPropagation()} 
      onClick={(e) => e.stopPropagation()}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Type size={12} /> Editor
        </span>
        <button type="button" onClick={(e) => handleAction(e, onClose)} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white">
          <X size={14} />
        </button>
      </div>

      {/* BARRA DE FORMATAÇÃO */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-950/50 rounded-lg border border-zinc-800">
        <FormatBtn icon={Bold} onClick={() => applyFormat('bold')} title="Negrito" />
        <FormatBtn icon={Italic} onClick={() => applyFormat('italic')} title="Itálico" />
        <FormatBtn icon={Underline} onClick={() => applyFormat('underline')} title="Sublinhado" />
        <FormatBtn icon={Strikethrough} onClick={() => applyFormat('strikeThrough')} title="Taxado" />
        
        <div className="w-px bg-zinc-700 mx-1 h-5" />
        
        {/* Lista (Fix Visual) */}
        <FormatBtn icon={List} onClick={() => applyFormat('insertUnorderedList')} title="Lista" />
        
        <div className="w-px bg-zinc-700 mx-1 h-5" />

        {/* Marca Texto Avançado */}
        <div className="flex items-center gap-1 bg-zinc-900 rounded border border-zinc-700 px-1">
          <FormatBtn 
            icon={Highlighter} 
            onClick={() => applyFormat('hiliteColor', hiliteColor)} 
            className="text-zinc-300 hover:text-white"
            title="Aplicar Marca-Texto"
          />
          {/* Picker Marca Texto */}
          <div className="relative w-4 h-4 rounded-full overflow-hidden border border-zinc-600 cursor-pointer">
            <input 
              type="color" 
              value={hiliteColor}
              onChange={(e) => setHiliteColor(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Cor do Marca-Texto"
            />
            <div className="w-full h-full" style={{ backgroundColor: hiliteColor }} />
          </div>
          {/* Remover Cor */}
          <FormatBtn 
            icon={Eraser} 
            onClick={() => applyFormat('hiliteColor', 'transparent')} 
            className="text-zinc-500 hover:text-red-400"
            title="Remover Marca-Texto"
          />
        </div>

        {/* Cor da Fonte */}
        <div className="relative flex items-center justify-center w-7 h-7 ml-1">
          <label className="cursor-pointer p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white">
             <Droplet size={14} />
          </label>
          <input 
            type="color" 
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            onChange={(e) => applyFormat('foreColor', e.target.value)}
            title="Cor da Letra"
          />
        </div>
      </div>

      {/* ÁREA DE EDIÇÃO (Com CSS para Listas) */}
      <style>{`
        .rich-editor ul { list-style-type: disc !important; padding-left: 20px !important; margin: 4px 0; }
        .rich-editor ol { list-style-type: decimal !important; padding-left: 20px !important; margin: 4px 0; }
        .rich-editor li { display: list-item !important; }
      `}</style>
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={saveContent}
        onInput={saveContent}
        className="rich-editor min-h-[100px] max-h-[250px] w-full overflow-y-auto bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 leading-relaxed custom-scrollbar cursor-text"
        style={{ whiteSpace: 'pre-wrap', outline: 'none' }}
        onKeyDown={(e) => e.stopPropagation()} 
      />

      {/* COR DO NÓ (Presets + Custom) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
        <span className="text-[10px] text-zinc-500 font-bold uppercase">Estilo do Tópico:</span>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cores Predefinidas */}
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={(e) => { handleAction(e); handleNodeColorChange(color); }}
              className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${customNodeColor === color ? 'border-white scale-110 shadow-lg' : 'border-zinc-600'}`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          
          {/* Custom Hex Picker (Salva como 'Recente' visualmente ao ser selecionado) */}
          <div className="relative w-6 h-6 rounded-full overflow-hidden border border-zinc-500 ml-1 group">
             <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-white text-[8px] pointer-events-none">+</div>
             <input 
               type="color" 
               value={customNodeColor}
               onChange={(e) => handleNodeColorChange(e.target.value)}
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
               title="Cor Personalizada"
             />
             {/* Mostra a cor custom se não estiver nos presets */}
             {!PRESET_COLORS.includes(customNodeColor) && (
               <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ backgroundColor: customNodeColor }} />
             )}
          </div>
        </div>
      </div>
      
      {/* IMAGE TOOLBAR CONTROL */}
      <ImageToolbarControl 
         nodeData={node} 
         onUpdateNode={onUpdate} 
      />

      {/* AÇÕES ESTRUTURAIS */}
      <div className="grid grid-cols-5 gap-2 mt-2 pt-2 border-t border-zinc-700">
        <button
           type="button"
           onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReorder(node.id, 'up'); }}
           className="col-span-1 flex items-center justify-center rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-600 transition-colors"
           title="Mover para Cima"
        >
          <ArrowUp size={14} />
        </button>
        <button
           type="button"
           onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReorder(node.id, 'down'); }}
           className="col-span-1 flex items-center justify-center rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-600 transition-colors"
           title="Mover para Baixo"
        >
          <ArrowDown size={14} />
        </button>
        
        <ActionButton onClick={() => onAddChild(node.id)} icon={Plus} label="Sub" color="blue" />
        <ActionButton onClick={() => onAddNote(node.id)} icon={StickyNote} label="Note" color="yellow" />
        <ActionButton onClick={() => onDelete(node.id)} icon={Trash2} label="Del" color="red" />
      </div>
    </div>
  );
}

// Helpers
interface FormatBtnProps {
  icon: React.ElementType;
  onClick: () => void;
  className?: string;
  title: string;
}

function FormatBtn({ icon: Icon, onClick, className = "", title }: FormatBtnProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors ${className}`}
      title={title}
    >
      <Icon size={14} />
    </button>
  );
}

interface ActionButtonProps {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  color: 'blue' | 'yellow' | 'red';
}

function ActionButton({ onClick, icon: Icon, label, color }: ActionButtonProps) {
  const colors = {
    blue: "bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 border-blue-600/30",
    yellow: "bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40 border-yellow-600/30",
    red: "bg-red-600/20 text-red-400 hover:bg-red-600/40 border-red-600/30",
  };
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={`col-span-1 flex items-center justify-center gap-1 rounded px-1 py-2 text-xs font-medium border transition-colors ${colors[color]}`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}