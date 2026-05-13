
import React from 'react';
import { MindMapNode } from '../../../../../services/metaService';

interface MindNodeProps {
  node: MindMapNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onClick: (e: React.MouseEvent, nodeId: string) => void;
}

const MindNode: React.FC<MindNodeProps> = ({ node, isSelected, onMouseDown, onClick }) => {
  
  // Style calculations
  const isRoot = node.type === 'root';
  const isNote = node.type === 'note';
  
  const baseClasses = "absolute flex items-center justify-center p-4 rounded-xl cursor-move transition-shadow select-none backdrop-blur-md";
  
  const typeClasses = isRoot 
    ? "min-w-[150px] min-h-[60px] border-2 z-20 text-sm font-black uppercase tracking-tight" 
    : isNote
      ? "min-w-[100px] min-h-[100px] border border-yellow-500/30 bg-yellow-900/20 z-10 text-xs font-medium text-yellow-100 shadow-[0_4px_10px_rgba(0,0,0,0.3)] rotate-1"
      : "min-w-[120px] min-h-[50px] border bg-zinc-900/80 z-10 text-xs font-bold text-zinc-200";

  const selectionClasses = isSelected 
    ? `ring-2 ring-white shadow-[0_0_25px_${node.color}60]` 
    : `shadow-[0_4px_15px_rgba(0,0,0,0.5)]`;

  const textStyles = node.styles || [];
  const textClass = `
    text-center pointer-events-none
    ${textStyles.includes('bold') ? 'font-black' : ''}
    ${textStyles.includes('italic') ? 'italic' : ''}
    ${textStyles.includes('underline') ? 'underline' : ''}
    ${textStyles.includes('strikethrough') ? 'line-through' : ''}
  `;

  return (
    <div
      style={{
        left: node.x,
        top: node.y,
        borderColor: isNote ? undefined : node.color,
        backgroundColor: isRoot ? `${node.color}20` : undefined, // Transparent bg for root
        color: isNote ? undefined : (isRoot ? '#fff' : '#e4e4e7')
      }}
      className={`${baseClasses} ${typeClasses} ${selectionClasses}`}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onClick={(e) => onClick(e, node.id)}
    >
      <span className={textClass}>
        {node.label}
      </span>
    </div>
  );
};

export default MindNode;
