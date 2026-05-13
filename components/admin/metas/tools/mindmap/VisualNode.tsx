
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { MindMapNode } from '../../../../../services/metaService';
import { PostItNote } from './PostItComponents';

// Extensão da interface para suportar estrutura de árvore (filhos aninhados)
export interface TreeNode extends MindMapNode {
  children?: TreeNode[];
  collapsed?: boolean;
  notes?: PostItNote[]; // Adicionado suporte a notas
}

interface VisualNodeProps {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
  onEdit?: (nodeId: string, changes: Partial<TreeNode>) => void;
  onMoveNode?: (draggedId: string, targetId: string) => void;
  onViewNotes?: (nodeId: string) => void;
  readOnly?: boolean;
}

export default function VisualNode({ node, depth, selectedId, onSelect, onToggle, onEdit, onMoveNode, onViewNotes, readOnly }: VisualNodeProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  // Cores baseadas no nível de profundidade (Fallback se não tiver cor definida)
  const getNodeColorClass = (d: number) => {
    const level = d % 6;
    switch (level) {
      case 0: return 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-purple-500/30';
      case 1: return 'border-pink-500 bg-pink-500/10 shadow-pink-500/20 ring-pink-500/30';
      case 2: return 'border-blue-500 bg-blue-500/10 shadow-blue-500/20 ring-blue-500/30';
      case 3: return 'border-emerald-500 bg-emerald-500/10 shadow-emerald-500/20 ring-emerald-500/30';
      case 4: return 'border-yellow-500 bg-yellow-500/10 shadow-yellow-500/20 ring-yellow-500/30';
      case 5: return 'border-red-500 bg-red-500/10 shadow-red-500/20 ring-red-500/30';
      default: return 'border-zinc-500 bg-zinc-500/10';
    }
  };

  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const notesCount = node.notes ? node.notes.length : 0;
  
  const customColorStyle = node.color ? {
    borderColor: node.color,
    boxShadow: isSelected 
        ? `0 0 20px ${node.color}60` 
        : `0 0 15px ${node.color}30`,
    backgroundColor: `${node.color}15`
  } : {};

  // --- FLEX LAYOUT LOGIC FOR MEDIA ---
  const { media } = node;
  
  const getFlexDirection = () => {
    if (!media) return 'flex-col';
    switch (media.position) {
      case 'top': return 'flex-col-reverse'; // Imagem (2º filho no DOM) fica no Topo
      case 'bottom': return 'flex-col';      // Imagem (2º filho no DOM) fica em Baixo
      case 'left': return 'flex-row-reverse'; // Imagem (2º filho no DOM) fica na Esquerda
      case 'right': return 'flex-row';       // Imagem (2º filho no DOM) fica na Direita
      default: return 'flex-col';
    }
  };
  
  const alignItems = 'items-center'; // Centraliza sempre (Horizontal ou Verticalmente dependendo do eixo)

  // Handlers
  const handleSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // LÓGICA DE CLIQUE PARA ALUNO (READONLY)
    if (readOnly) {
        // Se for aluno, clicar no card alterna a expansão (se tiver filhos)
        if (hasChildren && onToggle) {
            onToggle(node.id);
        }
        // Mantém seleção visual apenas para feedback (opcional)
        onSelect(node.id);
    } else {
        // Lógica Admin: Seleciona para edição
        onSelect(node.id);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggle) onToggle(node.id);
  };

  // --- DRAG & DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    e.dataTransfer.setData('nodeId', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const draggedId = e.dataTransfer.getData('nodeId');
    if (draggedId && onMoveNode) {
      onMoveNode(draggedId, node.id);
    }
  };

  return (
    <div className="flex items-center">
      
      {/* WRAPPER DO NÓ (Imagem + Texto) */}
      <div 
        id={`node-${node.id}`}
        onClick={handleSelect}
        
        // DRAG ATTRIBUTES
        draggable={!readOnly}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}

        className={`
           relative group flex ${getFlexDirection()} ${alignItems} gap-2
           ${!readOnly ? 'cursor-pointer' : (hasChildren ? 'cursor-pointer' : 'cursor-default')} select-none
           ${isDragOver ? 'scale-110 z-20' : (!readOnly ? 'hover:scale-105' : 'hover:scale-[1.02]')}
           transition-transform duration-200
        `}
      >
        
        {/* TEXT CONTAINER (Conteúdo Principal - DOM Child 1) */}
        <div 
          className={`
            min-w-[140px] max-w-[300px] p-3 rounded-xl border backdrop-blur-md transition-all duration-200
            ${!node.color ? getNodeColorClass(depth) : ''}
            ${isSelected ? 'ring-2 ring-white z-10' : ''}
            ${isDragOver ? 'ring-4 ring-green-500 bg-green-500/20' : (!readOnly ? 'hover:brightness-110' : '')}
            relative
          `}
          style={customColorStyle}
        >
             {/* Marcador de Nó (Bolinha/Listra) */}
             <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-white/20" style={{ backgroundColor: node.color }} />
             
             {/* Conteúdo HTML (com padding left para não sobrepor o marcador) */}
             <div className="pl-2">
                 <div 
                   className="rich-content text-sm font-medium text-white break-words leading-tight pointer-events-none"
                   dangerouslySetInnerHTML={{ __html: node.label || 'Sem título' }} 
                 />
             </div>

             {/* BADGE DE NOTAS (POST-IT) */}
             {notesCount > 0 && (
               <button
                 type="button"
                 onClick={(e) => { 
                   e.preventDefault(); 
                   e.stopPropagation(); 
                   if (onViewNotes) onViewNotes(node.id); 
                 }}
                 className="absolute -top-3 -right-2 bg-yellow-400 text-black text-[10px] font-bold w-6 h-6 rounded-md shadow-lg flex items-center justify-center hover:scale-110 hover:rotate-6 transition-transform z-30 border border-yellow-600 animate-in zoom-in duration-300 cursor-pointer"
                 title={`${notesCount} notas adesivas. Clique para ver.`}
               >
                 {notesCount}
               </button>
             )}
        </div>

        {/* IMAGE RENDER (DOM Child 2) */}
        {media && media.url && (
            <div className="relative z-20 transition-all duration-75 ease-linear pointer-events-none">
                <img 
                    src={media.url} 
                    alt="Node attachment" 
                    className="object-contain bg-transparent pointer-events-none"
                    style={{ 
                        width: `${media.width * media.scale}px`,
                        maxWidth: 'none',
                        display: 'block' // Remove extra space
                    }}
                />
            </div>
        )}
        
        <style>{`
          .rich-content ul { list-style-type: disc; padding-left: 1.2em; margin-top: 0.2em; }
          .rich-content ol { list-style-type: decimal; padding-left: 1.2em; }
        `}</style>
      </div>

      {/* BOTÃO EXPANDER */}
      {hasChildren && (
        <button
          type="button"
          onClick={handleToggle}
          className={`
            ml-[-12px] z-20 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-zinc-400 transition-all hover:bg-zinc-800 hover:text-white shadow-lg cursor-pointer
            ${node.collapsed ? '-rotate-90' : 'rotate-0'}
          `}
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* RENDERIZAÇÃO RECURSIVA DOS FILHOS */}
      {hasChildren && !node.collapsed && (
        <div className="flex flex-col justify-center ml-10 relative animate-in fade-in slide-in-from-left-2 duration-300">
          
          <div className="absolute left-[-40px] top-1/2 h-px w-10 bg-zinc-700 pointer-events-none" />
          
          {node.children!.map((child, index) => {
            const isFirst = index === 0;
            const isLast = index === node.children!.length - 1;
            
            return (
              <div key={child.id} className="relative flex items-center py-2">
                
                <div className="absolute left-0 top-1/2 h-px w-8 bg-zinc-700 pointer-events-none" />

                {!isFirst && (
                  <div className="absolute left-0 top-0 h-1/2 w-px bg-zinc-700 pointer-events-none" />
                )}

                {!isLast && (
                  <div className="absolute left-0 bottom-0 h-1/2 w-px bg-zinc-700 pointer-events-none" />
                )}
                
                <VisualNode 
                  node={child} 
                  depth={depth + 1} 
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onMoveNode={onMoveNode}
                  onViewNotes={onViewNotes}
                  readOnly={readOnly}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
