import React, { useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Type, List, ListOrdered
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  // Referência direta ao elemento DOM editável
  const editorRef = useRef<HTMLDivElement>(null);

  // CORREÇÃO TÉCNICA: Sincronização via useEffect
  // Isso garante que o HTML só seja atualizado se vier de fora (ex: carregamento inicial)
  // e não interfere enquanto o usuário está digitando (preservando o cursor).
  useEffect(() => {
    if (editorRef.current) {
      // Só atualiza o DOM se o conteúdo for diferente para evitar loop de renderização
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value]);

  // Função para executar comandos de formatação (Bold, Italic, etc)
  const execCommand = (command: string, arg: string | undefined = undefined) => {
    document.execCommand(command, false, arg);
    // Força atualização do estado após o comando
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    // Mantém o foco no editor
    editorRef.current?.focus();
  };

  const handleLink = () => {
    const url = prompt('Insira a URL do link:');
    if (url) execCommand('createLink', url);
  };

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-black flex flex-col h-full">
      
      {/* --- BARRA DE FERRAMENTAS --- */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-700 bg-[#1a1d24]">
        
        {/* Estilos de Texto */}
        <ToolbarButton onClick={() => execCommand('bold')} icon={<Bold size={16} />} title="Negrito" />
        <ToolbarButton onClick={() => execCommand('italic')} icon={<Italic size={16} />} title="Itálico" />
        <ToolbarButton onClick={() => execCommand('underline')} icon={<Underline size={16} />} title="Sublinhado" />
        <ToolbarButton onClick={() => execCommand('strikeThrough')} icon={<Strikethrough size={16} />} title="Tachado" />
        
        <div className="w-px h-4 bg-gray-600 mx-1"></div>

        {/* Alinhamento */}
        <ToolbarButton onClick={() => execCommand('justifyLeft')} icon={<AlignLeft size={16} />} title="Esquerda" />
        <ToolbarButton onClick={() => execCommand('justifyCenter')} icon={<AlignCenter size={16} />} title="Centro" />
        <ToolbarButton onClick={() => execCommand('justifyRight')} icon={<AlignRight size={16} />} title="Direita" />
        <ToolbarButton onClick={() => execCommand('justifyFull')} icon={<AlignJustify size={16} />} title="Justificado" />

        <div className="w-px h-4 bg-gray-600 mx-1"></div>
        
        {/* Listas */}
        <ToolbarButton onClick={() => execCommand('insertUnorderedList')} icon={<List size={16} />} title="Lista com Marcadores" />
        <ToolbarButton onClick={() => execCommand('insertOrderedList')} icon={<ListOrdered size={16} />} title="Lista Numerada" />

        <div className="w-px h-4 bg-gray-600 mx-1"></div>

        {/* Formatação Avançada */}
        <select 
          onChange={(e) => execCommand('formatBlock', e.target.value)}
          className="bg-black border border-gray-600 text-gray-300 text-xs rounded px-2 py-1 outline-none focus:border-red-600"
          defaultValue="p"
        >
          <option value="p">Normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
          <option value="blockquote">Citação</option>
        </select>

        {/* Cor do Texto (Input nativo escondido com label customizada) */}
        <div className="relative flex items-center justify-center w-7 h-7 hover:bg-gray-700 rounded cursor-pointer group">
            <input 
                type="color" 
                onChange={(e) => execCommand('foreColor', e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                title="Cor do Texto"
            />
            <Type size={16} className="text-gray-300" />
            <div className="absolute bottom-1 w-4 h-0.5 bg-red-600"></div>
        </div>

        <div className="w-px h-4 bg-gray-600 mx-1"></div>

        {/* Extras */}
        <ToolbarButton onClick={handleLink} icon={<LinkIcon size={16} />} title="Inserir Link" />
      
      </div>

      {/* --- ÁREA EDITÁVEL (CORRIGIDA) --- */}
      {/* Adicionado suporte CSS para listas visuais dentro do editor */}
      <style>{`
        .rich-content ul { list-style-type: disc; padding-left: 1.5em; }
        .rich-content ol { list-style-type: decimal; padding-left: 1.5em; }
        .rich-content blockquote { border-left: 4px solid #4b5563; padding-left: 1em; font-style: italic; color: #9ca3af; }
      `}</style>
      <div
        ref={editorRef}
        className="rich-content flex-1 p-4 text-gray-300 outline-none focus:bg-[#0f1114] transition-colors overflow-y-auto min-h-[150px] max-w-none text-sm"
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        placeholder={placeholder}
        style={{ whiteSpace: 'pre-wrap' }} // Preserva quebras de linha
      />
    </div>
  );
}

// Botão auxiliar da Toolbar
const ToolbarButton = ({ onClick, icon, title }: { onClick: () => void, icon: React.ReactNode, title: string }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
  >
    {icon}
  </button>
);
