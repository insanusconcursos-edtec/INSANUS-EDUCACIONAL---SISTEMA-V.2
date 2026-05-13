import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MindMapNode } from '../../../../../services/metaService';
import VisualNode, { TreeNode } from './VisualNode';
import NodeToolbar from './NodeToolbar';
import BottomControls from './BottomControls';
import { PostItEditor, PostItViewer, PostItNote } from './PostItComponents';
import { CheckCircle2 } from 'lucide-react';

interface MindMapFullscreenProps {
  nodes: MindMapNode[];
  onChange: (nodes: MindMapNode[], isManualSave?: boolean) => void;
  onClose: () => void;
  readOnly?: boolean;
}

// Helper: Flat List -> Tree
const buildTree = (flatNodes: MindMapNode[]): TreeNode | null => {
  if (!flatNodes || flatNodes.length === 0) return null;

  const nodeMap = new Map<string, TreeNode>();
  let root: TreeNode | null = null;

  // 1. Create all TreeNodes
  flatNodes.forEach(node => {
    // Cast notes to PostItNote[] (structural compatible) to match TreeNode definition
    nodeMap.set(node.id, { 
        ...node, 
        children: [], 
        collapsed: node.collapsed ?? false, 
        notes: (node.notes || []) as unknown as PostItNote[] 
    });
  });

  // 2. Link children
  flatNodes.forEach(node => {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      parent.children = parent.children || [];
      parent.children.push(treeNode);
    } else {
      if (!root) root = treeNode; // Assume first root found is the main one
    }
  });

  return root;
};

// Helper: Tree -> Flat List
const flattenTree = (root: TreeNode): MindMapNode[] => {
  const flat: MindMapNode[] = [];
  const traverse = (node: TreeNode) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, ...rest } = node;
    // Cast notes back to MindMapNote[] if needed, but structure matches
    flat.push(rest as unknown as MindMapNode);
    if (children) {
      children.forEach(traverse);
    }
  };
  traverse(root);
  return flat;
};

// Helper: Update specific node in tree immutably
const modifyTree = (node: TreeNode, targetId: string, updateFn: (n: TreeNode) => TreeNode): TreeNode => {
  if (node.id === targetId) {
    return updateFn(node);
  }
  if (node.children) {
    return {
      ...node,
      children: node.children.map(child => modifyTree(child, targetId, updateFn))
    };
  }
  return node;
};

// Helper: Find Node in Tree
const findNode = (root: TreeNode, id: string): TreeNode | null => {
    if (root.id === id) return root;
    if (root.children) {
        for (const child of root.children) {
            const found = findNode(child, id);
            if (found) return found;
        }
    }
    return null;
};

const MindMapFullscreen: React.FC<MindMapFullscreenProps> = ({ nodes, onChange, onClose, readOnly = false }) => {
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Pan offset
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Canvas Drag State (Pan)
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Toolbar State
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Notes State
  const [editingNote, setEditingNote] = useState<PostItNote | undefined>(undefined); // If set, editor open
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [viewingNotesId, setViewingNotesId] = useState<string | null>(null); // Node ID whose notes we are viewing
  const [targetNodeForNote, setTargetNodeForNote] = useState<string | null>(null);

  // Feedback State (Novo)
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // --- CUSTOM FIT VIEW SIMULATION ---
  // Reset position to (0,0) relative to the start-aligned container
  const fitView = useCallback(() => {
    setPosition({ x: 0, y: 0 }); 
    setScale(1);
  }, []);

  // --- INITIALIZATION EFFECT ---
  useEffect(() => {
    let tree = buildTree(nodes);
    
    // LÓGICA DE INICIALIZAÇÃO SEGURA (Modo Aluno)
    // 1. Identificar Raiz e Filhos
    // 2. Ocultar (Collapse) níveis profundos para "Expansão Gradual"
    if (readOnly && tree && nodes.length > 0) {
        const setInitialCollapsedState = (node: TreeNode, depth: number): TreeNode => {
            // Regra de Visibilidade Inicial:
            // Depth 0 (Raiz): Expandida (collapsed = false)
            // Depth 1 (Filhos): Colapsados (collapsed = true) -> Isso oculta os Netos (Depth 2)
            const shouldCollapse = depth >= 1;
            
            let newChildren = node.children;
            if (newChildren) {
                newChildren = newChildren.map(child => setInitialCollapsedState(child, depth + 1));
            }

            return { ...node, collapsed: shouldCollapse, children: newChildren };
        };

        tree = setInitialCollapsedState(tree, 0);
    }

    setTreeData(tree);
    
    // 3. Centralização da Câmera (Delay para aguardar renderização do DOM)
    if (nodes.length > 0) {
        setTimeout(() => {
            fitView();
        }, 300);
    }
  }, [nodes, readOnly, fitView]);

  // --- PAN & ZOOM ---
  const handleWheel = (e: React.WheelEvent) => {
    // Zoom logic to focus on mouse pointer
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const nextScale = Math.min(Math.max(scale * delta, 0.1), 5);
    
    // Mouse position relative to viewport (container is fixed inset-0)
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Calculate new position to keep the point under cursor stable
    // Formula: newPos = mouse - (mouse - oldPos) * (newScale / oldScale)
    const ratio = nextScale / scale;
    const nextX = mouseX - (mouseX - position.x) * ratio;
    const nextY = mouseY - (mouseY - position.y) * ratio;

    setPosition({ x: nextX, y: nextY });
    setScale(nextScale);
  };

  // --- MOUSE DRAG HANDLERS (Manual Pan Implementation) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    // Left Click (0) or Middle Click (1) on background triggers pan
    // Ignora se clicar em botões ou interativos (handled by stopPropagation downstream)
    if (e.button === 0 || e.button === 1) {
        setIsDraggingCanvas(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        // REMOVIDO: if (!readOnly) setSelectedId(null); // Mantém painel aberto ao clicar no fundo
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  // --- NODE UPDATES ---

  const handleUpdateNode = (nodeId: string, changes: Partial<TreeNode>) => {
    if (readOnly && changes.collapsed === undefined) return; 
    
    setTreeData(prevTree => {
        if (!prevTree) return null;

        // Se expandir no modo leitura, forçar fechamento dos filhos (Expansão Gradual no Clique)
        if (readOnly && changes.collapsed === false) {
            return modifyTree(prevTree, nodeId, (node) => {
                const updatedNode = { ...node, ...changes };
                if (updatedNode.children && updatedNode.children.length > 0) {
                    updatedNode.children = updatedNode.children.map(child => ({
                        ...child,
                        collapsed: true // Fecha os netos ao abrir o filho
                    }));
                }
                return updatedNode;
            });
        }

        return modifyTree(prevTree, nodeId, (node) => ({ ...node, ...changes }));
    });
  };

  const handleSave = () => {
    if (treeData && !readOnly) {
        const flat = flattenTree(treeData);
        onChange(flat, true);
        
        // Ativar notificação de sucesso
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
    }
  };

  const handleCloseWrapper = () => {
    onClose();
  };

  const handleSelectNode = (nodeId: string) => {
    setSelectedId(nodeId);
  };

  // --- ACTIONS ---

  const handleAddChild = (parentId: string) => {
    if(readOnly) return;
    const newNode: TreeNode = {
        id: crypto.randomUUID(),
        label: 'Novo Tópico',
        x: 0, y: 0,
        color: '#3b82f6',
        type: 'child',
        parentId: parentId,
        collapsed: false,
        children: []
    };

    setTreeData(prev => {
        if(!prev) return newNode; 
        return modifyTree(prev, parentId, (node) => ({
            ...node,
            children: [...(node.children || []), newNode],
            collapsed: false // Expand parent to show new child
        }));
    });

    // Auto-focus on the new subtopic
    setSelectedId(newNode.id);
  };

  const handleReorder = (id: string, direction: 'up' | 'down') => {
    if (readOnly || !treeData) return;
    
    const nodeToMove = findNode(treeData, id);
    if (!nodeToMove || !nodeToMove.parentId) return;

    const parentId = nodeToMove.parentId;

    setTreeData(prev => {
        if (!prev) return null;
        return modifyTree(prev, parentId, (parent) => {
            if (!parent.children) return parent;
            const newChildren = [...parent.children];
            const index = newChildren.findIndex(c => c.id === id);
            if (index === -1) return parent;

            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= newChildren.length) return parent;

            // Swap imutável
            const temp = newChildren[index];
            newChildren[index] = newChildren[targetIndex];
            newChildren[targetIndex] = temp;

            return { ...parent, children: newChildren };
        });
    });
  };

  const handleMoveNode = (draggedId: string, targetId: string) => {
    if (readOnly || !treeData || draggedId === targetId) return;

    // 1. Validação: Impedir ciclos (não pode soltar em si mesmo ou descendente)
    const draggedNode = findNode(treeData, draggedId);
    if (!draggedNode) return;

    const isDescendant = (parent: TreeNode, id: string): boolean => {
      if (!parent.children) return false;
      return parent.children.some(child => child.id === id || isDescendant(child, id));
    };

    if (isDescendant(draggedNode, targetId)) return;

    // 2. Re-parenting Imutável
    setTreeData(prev => {
      if (!prev) return null;

      // Se tentar mover a raiz, ignorar (raiz não tem pai)
      if (prev.id === draggedId) return prev;

      let extractedNode: TreeNode | null = null;

      // Função para remover o nó e capturá-lo
      const removeAndCapture = (node: TreeNode): TreeNode => {
        if (node.children) {
          const foundIndex = node.children.findIndex(c => c.id === draggedId);
          if (foundIndex !== -1) {
            extractedNode = node.children[foundIndex];
            const newChildren = [...node.children];
            newChildren.splice(foundIndex, 1);
            return { ...node, children: newChildren };
          }
          return {
            ...node,
            children: node.children.map(removeAndCapture)
          };
        }
        return node;
      };

      const treeWithoutNode = removeAndCapture(prev);
      if (!extractedNode) return prev;

      // Inserir no novo pai
      const nodeWithNewParent = { ...extractedNode, parentId: targetId };
      return modifyTree(treeWithoutNode, targetId, (parent) => ({
        ...parent,
        children: [...(parent.children || []), nodeWithNewParent],
        collapsed: false // Expandir para mostrar o novo filho
      }));
    });
  };

  const handleDeleteNode = (id: string) => {
    if(readOnly) return;
    if (treeData?.id === id) {
        setTreeData(null);
        return;
    }
    
    const deleteFromTree = (node: TreeNode): TreeNode => {
        if (!node.children) return node;
        return {
            ...node,
            children: node.children.filter(c => c.id !== id).map(deleteFromTree)
        };
    };
    
    if (treeData) {
        setTreeData(deleteFromTree(treeData));
    }
    setSelectedId(null);
  };

  const handleAddNote = (nodeId: string) => {
      setTargetNodeForNote(nodeId);
      setEditingNote(undefined);
      setIsNoteEditorOpen(true);
  };

  const handleSaveNote = (note: PostItNote) => {
      if (!targetNodeForNote) return;
      
      setTreeData(prev => {
          if (!prev) return null;
          return modifyTree(prev, targetNodeForNote, (node) => ({
              ...node,
              notes: [...(node.notes || []), note]
          }));
      });

      setIsNoteEditorOpen(false);
  };

  const handleEditNote = (note: PostItNote) => {
      if (viewingNotesId) {
          setTargetNodeForNote(viewingNotesId);
          setEditingNote(note);
          setIsNoteEditorOpen(true);
      }
  };

  const handleDeleteNote = (noteId: string) => {
      if (!viewingNotesId) return;
      setTreeData(prev => {
          if (!prev) return null;
          return modifyTree(prev, viewingNotesId, (node) => ({
              ...node,
              notes: (node.notes || []).filter(n => n.id !== noteId)
          }));
      });
  };



  // Get current notes being viewed
  const viewingNode = viewingNotesId && treeData ? findNode(treeData, viewingNotesId) : null;
  
  return (
    <div 
        className="fixed inset-0 z-[100] bg-zinc-950 overflow-hidden text-white" 
        ref={containerRef} 
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDraggingCanvas ? 'grabbing' : 'grab' }}
    >
        
        <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
                backgroundImage: 'radial-gradient(#444 1px, transparent 1px)',
                backgroundSize: `${20 * scale}px ${20 * scale}px`,
                backgroundPosition: `${position.x}px ${position.y}px`
            }}
        />

        <div 
            className="absolute origin-top-left transition-transform duration-500 ease-out w-full h-full flex items-center justify-start pl-32"
            style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
            }}
        >
            {treeData ? (
                <VisualNode 
                    node={treeData}
                    depth={0}
                    selectedId={selectedId}
                    onSelect={handleSelectNode}
                    onToggle={(id) => handleUpdateNode(id, { collapsed: !findNode(treeData, id)?.collapsed })}
                    onEdit={handleUpdateNode}
                    onMoveNode={handleMoveNode}
                    onViewNotes={setViewingNotesId}
                    readOnly={readOnly}
                />
            ) : (
                <div className="text-zinc-500 pointer-events-none ml-20">Mapa vazio</div>
            )}
        </div>

        {!readOnly && selectedId && treeData && findNode(treeData, selectedId) && (
            <NodeToolbar 
                node={findNode(treeData, selectedId)!}
                onUpdate={(id, data) => handleUpdateNode(id, data)}
                onAddChild={handleAddChild}
                onDelete={handleDeleteNode}
                onClose={() => setSelectedId(null)}
                onReorder={handleReorder} 
                onAddNote={handleAddNote}
            />
        )}

        {/* Success Toast Notification */}
        {showSuccessToast && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400/50 animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-none">
                <CheckCircle2 size={20} className="text-white" />
                <span className="text-sm font-bold uppercase tracking-wide">Mapa salvo com sucesso!</span>
            </div>
        )}

        <BottomControls 
            onZoomIn={() => setScale(s => Math.min(s + 0.1, 5))}
            onZoomOut={() => setScale(s => Math.max(s - 0.1, 0.1))}
            onReset={fitView}
            onSave={handleSave}
            onClose={handleCloseWrapper}
            scale={scale}
        />

        {isNoteEditorOpen && (
            <PostItEditor 
                initialNote={editingNote}
                onSave={handleSaveNote}
                onCancel={() => setIsNoteEditorOpen(false)}
            />
        )}

        {viewingNode && (
            <PostItViewer 
                notes={viewingNode.notes || []}
                nodeLabel={viewingNode.label}
                onClose={() => setViewingNotesId(null)}
                onEdit={handleEditNote}
                onDelete={handleDeleteNote}
                onAdd={() => handleAddNote(viewingNode.id)}
                readOnly={readOnly}
            />
        )}

    </div>
  );
};

export default MindMapFullscreen;