import React, { useRef } from 'react';
import { Image, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2, ZoomIn } from 'lucide-react';
import { MindMapNode } from '../../../../../services/metaService';

interface ImageToolbarControlProps {
  nodeData: MindMapNode;
  onUpdateNode: (id: string, data: Partial<MindMapNode>) => void;
}

export const ImageToolbarControl: React.FC<ImageToolbarControlProps> = ({ nodeData, onUpdateNode }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 1. Criar URL local para preview instantâneo
      const objectUrl = URL.createObjectURL(file);
      
      // 2. Atualizar nó com valores padrão harmônicos
      onUpdateNode(nodeData.id, {
        media: {
          url: objectUrl,
          file: file, // File object for future upload logic
          position: 'top',
          width: 150, // Base width
          scale: 1
        }
      });
    }
    // Reset input to allow re-selecting same file if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateMedia = (updates: Partial<NonNullable<MindMapNode['media']>>) => {
    if (!nodeData.media) return;
    onUpdateNode(nodeData.id, {
      media: { ...nodeData.media, ...updates }
    });
  };

  const removeMedia = () => {
     onUpdateNode(nodeData.id, { media: undefined });
  };

  // Case 1: No Media -> Show Upload Button
  if (!nodeData.media?.url) {
    return (
      <div className="pt-2 mt-2 border-t border-zinc-800">
         <button
           type="button"
           onClick={() => fileInputRef.current?.click()}
           className="w-full flex items-center justify-center gap-2 p-2 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-wide"
         >
            <Image size={14} /> Adicionar Imagem
         </button>
         <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/png, image/jpeg, image/gif, image/webp"
            onChange={handleImageUpload}
         />
      </div>
    );
  }

  // Case 2: Media Exists -> Show Controls
  const { position, scale } = nodeData.media;

  return (
    <div className="flex flex-col gap-2 pt-2 mt-2 border-t border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                Imagem Anexada
            </span>
            <button
                type="button"
                onClick={removeMedia}
                className="text-zinc-600 hover:text-red-500 transition-colors p-1 hover:bg-red-500/10 rounded"
                title="Remover Imagem"
            >
                <Trash2 size={12} />
            </button>
        </div>

        {/* Controls Container */}
        <div className="bg-zinc-950/50 rounded-lg p-2 border border-zinc-800 flex flex-col gap-2">
            
            {/* Position Row */}
            <div className="flex gap-1">
                <PosButton 
                    active={position === 'top'} 
                    onClick={() => updateMedia({ position: 'top' })}
                    icon={ArrowUp}
                    title="Acima do Texto"
                />
                <PosButton 
                    active={position === 'bottom'} 
                    onClick={() => updateMedia({ position: 'bottom' })}
                    icon={ArrowDown}
                    title="Abaixo do Texto"
                />
                <PosButton 
                    active={position === 'left'} 
                    onClick={() => updateMedia({ position: 'left' })}
                    icon={ArrowLeft}
                    title="Esquerda do Texto"
                />
                <PosButton 
                    active={position === 'right'} 
                    onClick={() => updateMedia({ position: 'right' })}
                    icon={ArrowRight}
                    title="Direita do Texto"
                />
            </div>

            {/* Scale Row */}
            <div className="flex items-center gap-2 px-1">
                <ZoomIn size={12} className="text-zinc-500" />
                <input 
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={scale}
                    onChange={(e) => updateMedia({ scale: parseFloat(e.target.value) })}
                    className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-600 hover:accent-purple-500"
                />
                <span className="text-[9px] font-mono text-zinc-400 w-8 text-right">
                    {Math.round(scale * 100)}%
                </span>
            </div>
        </div>
    </div>
  );
};

// Helper Component for Position Buttons
interface PosButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ElementType;
    title: string;
}

const PosButton: React.FC<PosButtonProps> = ({ active, onClick, icon: Icon, title }) => (
    <button
        type="button"
        onClick={(e) => { e.preventDefault(); onClick(); }}
        title={title}
        className={`
            flex-1 p-1.5 flex items-center justify-center rounded transition-all
            ${active 
                ? 'bg-purple-600 text-white shadow-sm' 
                : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-white'}
        `}
    >
        <Icon size={14} />
    </button>
);