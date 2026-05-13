
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Save, Trash2, Edit2, Plus, 
  Bold, Italic, Underline, Strikethrough, 
  Highlighter, Eraser, Type 
} from 'lucide-react';

// Cores de Fundo do Post-It (Papel)
const PAPER_COLORS = [
  '#fef3c7', // Amarelo (Padrão)
  '#dbeafe', // Azul
  '#dcfce7', // Verde
  '#fce7f3', // Rosa
  '#f3e8ff', // Lilás
  '#27272a', // Dark Mode (Preto Suave)
];

export interface PostItNote {
  id: string;
  text: string;
  color: string;
  date: string;
}

interface PostItEditorProps {
  initialNote?: PostItNote;
  onSave: (note: PostItNote) => void;
  onCancel: () => void;
}

// --- COMPONENTE 1: EDITOR DE POST-IT (CORRIGIDO) ---
export function PostItEditor({ initialNote, onSave, onCancel }: PostItEditorProps) {
  const [paperColor, setPaperColor] = useState(initialNote?.color || '#fef3c7');
  const [hiliteColor, setHiliteColor] = useState('#facc15'); // Amarelo marca-texto
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Inicialização do conteúdo
  useEffect(() => {
    if (editorRef.current && initialNote?.text) {
      editorRef.current.innerHTML = initialNote.text;
    }
  }, [initialNote]);

  // Aplicação de Formato Segura (Sem perder seleção)
  const applyFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    // Mantém o foco no editor
    if (editorRef.current) editorRef.current.focus();
  };

  const handleSave = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    if (!html.trim()) return alert("A nota não pode estar vazia.");
    
    onSave({
      id: initialNote?.id || crypto.randomUUID(),
      text: html,
      color: paperColor,
      date: new Date().toISOString()
    });
  };

  // Previne propagação de teclas (especialmente Enter) para o form pai
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); 
    // O Enter natural do contentEditable já cria divs/br, não precisamos interceptar
    // a menos que quiséssemos comportamento específico.
  };

  // Helper para Botões de Formatação (Evita perda de foco com onMouseDown)
  const FormatBtn = ({ icon: Icon, cmd, val, title, className = "" }: any) => (
    <button
      type="button" // CRÍTICO
      onMouseDown={(e) => {
        e.preventDefault(); // Impede perda de foco
        applyFormat(cmd, val);
      }}
      className={`p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition-colors ${className}`}
      title={title}
    >
      <Icon size={16} />
    </button>
  );

  const isDarkPaper = paperColor === '#27272a';

  return (
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel} // Fecha ao clicar no backdrop
    >
      <div 
        className="w-[450px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()} // Impede fechamento ao clicar no conteúdo
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <span className="font-bold text-zinc-700 dark:text-zinc-200 text-xs uppercase tracking-wider flex items-center gap-2">
            <Edit2 size={12} /> {initialNote ? 'Editar Nota' : 'Nova Nota'}
          </span>
          <button type="button" onClick={onCancel} className="text-zinc-400 hover:text-red-500"><X size={18}/></button>
        </div>

        {/* Toolbar de Formatação */}
        <div className="flex flex-wrap items-center gap-1 p-2 bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
          <FormatBtn icon={Bold} cmd="bold" title="Negrito" />
          <FormatBtn icon={Italic} cmd="italic" title="Itálico" />
          <FormatBtn icon={Underline} cmd="underline" title="Sublinhado" />
          <FormatBtn icon={Strikethrough} cmd="strikeThrough" title="Taxado" />
          
          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />
          
          {/* Cor da Fonte */}
          <div className="relative w-7 h-7 flex items-center justify-center group">
             <Type size={16} className="text-zinc-600 dark:text-zinc-300 pointer-events-none" />
             <input 
               type="color" 
               className="absolute inset-0 opacity-0 cursor-pointer"
               onChange={(e) => applyFormat('foreColor', e.target.value)}
               title="Cor do Texto"
             />
          </div>

          <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1" />

          {/* Marca Texto */}
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded px-1">
             <FormatBtn 
               icon={Highlighter} 
               cmd="hiliteColor" 
               val={hiliteColor} 
               title="Aplicar Marca-Texto"
               className="text-yellow-600 dark:text-yellow-400"
             />
             <div className="relative w-4 h-4 rounded-full border border-zinc-300 overflow-hidden">
                <input 
                  type="color" 
                  value={hiliteColor}
                  onChange={(e) => setHiliteColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-full h-full" style={{ backgroundColor: hiliteColor }} />
             </div>
             <FormatBtn 
               icon={Eraser} 
               cmd="hiliteColor" 
               val="transparent" 
               title="Remover Marcação"
               className="hover:text-red-500"
             />
          </div>
        </div>

        {/* Área de Edição (O Papel) */}
        <div className="flex-1 bg-zinc-200 dark:bg-zinc-950 p-6 overflow-y-auto">
          <div 
            className="w-full min-h-[300px] shadow-lg rounded p-5 text-sm leading-relaxed outline-none transition-colors duration-300"
            style={{ 
              backgroundColor: paperColor,
              color: isDarkPaper ? '#e4e4e7' : '#18181b' // Texto claro se papel escuro
            }}
          >
            <div 
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onKeyDown={handleKeyDown} // BLINDAGEM CONTRA FECHAMENTO
              className="w-full h-full min-h-[250px] outline-none whitespace-pre-wrap break-words rich-editor-content"
              style={{ minHeight: '250px' }}
            />
          </div>
        </div>

        {/* Footer: Cores do Papel e Salvar */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
          
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-zinc-400">Cor do Papel:</span>
            <div className="flex gap-2">
              {PAPER_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPaperColor(c)}
                  className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${paperColor === c ? 'border-zinc-500 scale-110 ring-1 ring-zinc-400' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              {/* Custom Hex Paper */}
              <div className="relative w-6 h-6 rounded-full border border-zinc-300 overflow-hidden group">
                 <input type="color" value={paperColor} onChange={e => setPaperColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                 <div className="w-full h-full flex items-center justify-center bg-zinc-200 text-[8px] text-zinc-500">+</div>
                 <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: !PAPER_COLORS.includes(paperColor) ? paperColor : 'transparent' }} />
              </div>
            </div>
          </div>

          <button 
            type="button" // CRÍTICO
            onClick={handleSave}
            className="w-full py-3 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold rounded-lg transition-all shadow-lg active:scale-95"
          >
            SALVAR NOTA
          </button>
        </div>
      </div>
    </div>
  );
}

interface PostItViewerProps {
  notes: PostItNote[];
  nodeLabel: string;
  onClose: () => void;
  onEdit: (note: PostItNote) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  readOnly?: boolean;
}

// --- COMPONENTE 2: VISUALIZADOR (LIGHTBOX) ---
export function PostItViewer({ notes, nodeLabel, onClose, onEdit, onDelete, onAdd, readOnly }: PostItViewerProps) {
  return (
    <div 
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose} // Fecha ao clicar no backdrop (ou em espaços vazios do layout)
    >
      <div 
        className="relative w-full max-w-6xl h-[85vh] flex flex-col"
        // NOTA: Removido stopPropagation daqui para permitir fechar clicando nos gaps
      >
        {/* Header Flutuante */}
        <div 
            className="text-center mb-6 animate-in slide-in-from-top-10 duration-500 z-10"
            onClick={e => e.stopPropagation()} // Protege o header de fechar o modal
        >
           <div className="inline-flex items-center gap-4 bg-zinc-900/80 backdrop-blur rounded-full px-6 py-2 border border-zinc-700 shadow-xl">
              <h2 className="text-lg font-bold text-white">Notas de:</h2>
              <span className="text-purple-300 font-mono text-sm truncate max-w-[300px]" dangerouslySetInnerHTML={{ __html: nodeLabel }} />
              <button onClick={onClose} className="ml-4 p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"><X size={16}/></button>
           </div>
        </div>

        {/* Grid Scrollável */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="flex flex-wrap justify-center gap-8 pb-20">
            
            {/* Card de Nova Nota */}
            {!readOnly && (
              <button 
                type="button"
                onClick={(e) => {
                    e.stopPropagation(); // Protege o botão
                    onAdd();
                }}
                className="group w-[260px] h-[260px] rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/60 flex flex-col items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95"
              >
                <div className="p-4 rounded-full bg-zinc-800 group-hover:bg-purple-600 text-zinc-400 group-hover:text-white transition-colors shadow-lg">
                  <Plus size={32} />
                </div>
                <span className="text-zinc-500 font-medium group-hover:text-purple-300 uppercase tracking-widest text-xs">Adicionar Nota</span>
              </button>
            )}

            {/* Lista de Notas */}
            {notes.map((note, index) => {
              const isDark = note.color === '#27272a';
              return (
                <div 
                  key={note.id}
                  onClick={(e) => e.stopPropagation()} // Protege o card da nota
                  className="relative group w-[260px] min-h-[260px] p-6 shadow-2xl flex flex-col justify-between transition-all hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] animate-in zoom-in duration-500 cursor-default"
                  style={{ 
                    backgroundColor: note.color,
                    color: isDark ? '#e4e4e7' : '#18181b',
                    animationDelay: `${index * 50}ms`,
                    transform: `rotate(${index % 2 === 0 ? '-1deg' : '1deg'})` 
                  }}
                >
                  {/* Conteúdo HTML */}
                  <div 
                    className="text-sm leading-relaxed font-medium break-words mb-4 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: note.text }}
                  />
                  
                  {/* Rodapé */}
                  <div className={`border-t pt-2 flex justify-between items-center ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                    <span className={`text-[10px] font-mono ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                      {new Date(note.date).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Ações (Hover) */}
                  {!readOnly && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => onEdit(note)} className="p-1.5 bg-white/20 hover:bg-white/80 rounded-full text-zinc-700 shadow-sm backdrop-blur-sm transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button type="button" onClick={() => onDelete(note.id)} className="p-1.5 bg-white/20 hover:bg-red-500 rounded-full text-red-600 hover:text-white shadow-sm backdrop-blur-sm transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  
                  {/* Tape Effect */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-8 bg-white/20 rotate-1 blur-[1px]" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
