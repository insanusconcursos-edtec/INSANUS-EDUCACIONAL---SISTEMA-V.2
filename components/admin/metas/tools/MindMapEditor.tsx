import React, { useState } from 'react';
import { MindMapNode } from '../../../../services/metaService';
import { Plus, Wand2, Trash2 } from 'lucide-react';

interface MindMapEditorProps {
  nodes: MindMapNode[];
  onChange: (nodes: MindMapNode[]) => void;
}

const MindMapEditor: React.FC<MindMapEditorProps> = ({ nodes, onChange }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Mock AI Generation
  const handleGenerateAI = () => {
    // Simulating a generated structure
    const mockNodes: MindMapNode[] = [
      { id: '1', label: 'Conceito Central', x: 300, y: 200, color: '#a855f7', type: 'root' },
      { id: '2', label: 'Ramificação A', x: 150, y: 100, color: '#3b82f6', type: 'child', parentId: '1' },
      { id: '3', label: 'Ramificação B', x: 450, y: 100, color: '#3b82f6', type: 'child', parentId: '1' },
      { id: '4', label: 'Detalhe Importante', x: 150, y: 300, color: '#22c55e', type: 'child', parentId: '1' },
      { id: '5', label: 'Exceção', x: 450, y: 300, color: '#ef4444', type: 'note', parentId: '3' },
    ];
    onChange(mockNodes);
  };

  const handleAddNode = () => {
    const newNode: MindMapNode = {
      id: `node-${Date.now()}`,
      label: 'Novo Tópico',
      x: 300,
      y: 200,
      color: '#3b82f6',
      type: 'child'
    };
    onChange([...nodes, newNode]);
  };

  const handleDeleteNode = (id: string) => {
    onChange(nodes.filter(n => n.id !== id));
    setSelectedNodeId(null);
  };

  const updateNodeLabel = (id: string, label: string) => {
    onChange(nodes.map(n => n.id === id ? { ...n, label } : n));
  };

  // Simple Drag Logic (Visual only for now, updating coordinates on end)
  // For a robust implementation, we would use a library like react-draggable, but for MVP pure CSS/JS is lighter.
  // Note: This is a simplified "Click to Teleport" logic for the MVP to avoid complex drag implementation without libraries.
  // Future: Implement proper Drag and Drop.

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[10px] font-black text-purple-400 uppercase tracking-widest">
              Editor de Mapa Mental
          </label>
          <div className="flex gap-2">
            <button 
                type="button"
                onClick={handleGenerateAI}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/30 border border-purple-500/30 rounded text-[10px] font-bold text-purple-300 hover:bg-purple-900/50 transition-colors uppercase"
            >
                <Wand2 size={12} /> Gerar com IA
            </button>
            <button 
                type="button"
                onClick={handleAddNode}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded text-[10px] font-bold text-zinc-300 hover:bg-zinc-700 transition-colors uppercase"
            >
                <Plus size={12} /> Adicionar Nó
            </button>
          </div>
      </div>

      <div className="relative w-full h-[300px] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden shadow-inner group">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-10" style={{ 
            backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', 
            backgroundSize: '20px 20px' 
        }}></div>

        <p className="absolute top-2 left-2 text-[9px] text-zinc-600 uppercase font-mono pointer-events-none">
            Canvas Interativo (Beta)
        </p>

        {/* Nodes */}
        {nodes.map(node => (
            <div 
                key={node.id}
                style={{ 
                    left: node.x, 
                    top: node.y, 
                    borderColor: node.color,
                    boxShadow: selectedNodeId === node.id ? `0 0 15px ${node.color}40` : 'none'
                }}
                className={`
                    absolute p-3 rounded-lg border-2 bg-zinc-900 min-w-[120px] max-w-[200px] cursor-pointer transition-all hover:z-10
                    ${node.type === 'root' ? 'border-4 font-black text-sm' : 'text-xs font-bold'}
                `}
                onClick={() => setSelectedNodeId(node.id)}
            >
                {/* Connector Lines would be rendered as SVGs behind nodes in a full implementation */}
                
                {selectedNodeId === node.id ? (
                    <div className="flex flex-col gap-2">
                         <input 
                            value={node.label}
                            onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                            className="bg-transparent text-white focus:outline-none w-full text-center"
                            autoFocus
                         />
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                            className="self-center p-1 bg-red-900/50 text-red-500 rounded hover:bg-red-900"
                         >
                            <Trash2 size={10} />
                         </button>
                    </div>
                ) : (
                    <div className="text-center text-white break-words">
                        {node.label}
                    </div>
                )}
            </div>
        ))}

        {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-zinc-700 text-xs font-bold uppercase">Nenhum nó criado</span>
            </div>
        )}
      </div>
      <p className="text-[9px] text-zinc-500">* Clique em um nó para editar ou excluir.</p>
    </div>
  );
};

export default MindMapEditor;