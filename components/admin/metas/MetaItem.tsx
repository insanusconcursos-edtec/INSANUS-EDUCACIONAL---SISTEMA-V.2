
import React from 'react';
import { 
  PlayCircle, FileText, ListChecks, Book, Edit3, RefreshCw, 
  ChevronUp, ChevronDown, Trash2, Edit, Link as LinkIcon,
  BrainCircuit, Layers
} from 'lucide-react';
import { Meta, MetaType } from '../../../services/metaService';

interface MetaItemProps {
  meta: Meta;
  onEdit: (meta: Meta) => void;
  onDelete: (meta: Meta) => void;
  onMove: (direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}

// Cores padrão para Fallback (Hex)
const TYPE_COLORS: Record<string, string> = {
  lesson: '#3b82f6',    // Blue
  material: '#f97316',  // Orange
  questions: '#22c55e', // Green
  law: '#eab308',       // Yellow
  summary: '#a855f7',   // Purple
  review: '#ec4899',    // Pink
  default: '#52525b'    // Zinc
};

const MetaItem: React.FC<MetaItemProps> = ({ meta, onEdit, onDelete, onMove, isFirst, isLast }) => {
  
  const getMetaColor = (m: Meta) => {
    // Se existir cor personalizada e não for nula, usa. Se não, usa fallback do tipo.
    if (m.color && m.color !== '#000000') return m.color;
    return TYPE_COLORS[m.type] || TYPE_COLORS.default;
  };

  const metaColor = getMetaColor(meta);

  const getIcon = (type: MetaType) => {
    switch (type) {
      case 'lesson': return <PlayCircle size={18} />;
      case 'material': return <FileText size={18} />;
      case 'questions': return <ListChecks size={18} />;
      case 'law': return <Book size={18} />;
      case 'summary': return <Edit3 size={18} />;
      case 'review': return <RefreshCw size={18} />;
      default: return <FileText size={18} />;
    }
  };

  const getDetails = () => {
    const fileCount = meta.files?.length || 0;
    const linkCount = meta.links?.length || 0;

    // Helper para renderizar badges de arquivos e links (comum a vários tipos)
    const renderCommonBadges = () => (
      <>
        {fileCount > 0 && (
          <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-zinc-700">
              <FileText size={8} /> {fileCount}
          </span>
        )}
        {linkCount > 0 && (
          <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-zinc-700">
              <LinkIcon size={8} /> {linkCount}
          </span>
        )}
      </>
    );

    switch (meta.type) {
      case 'lesson': {
        const count = meta.videos?.length || 0;
        const duration = meta.videos?.reduce((acc, v) => acc + (Number(v.duration) || 0), 0) || 0;
        return (
          <div className="flex gap-2">
            <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">{count} Aulas</span>
            <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">{duration} min</span>
          </div>
        );
      }
      
      case 'material':
        return (
           <div className="flex gap-2">
              <span className="text-[9px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20">
                {meta.pageCount || 0} Págs
              </span>
              {renderCommonBadges()}
           </div>
        );

      case 'questions':
        return (
           <div className="flex gap-2">
              {/* Opcional: Se houver campo de qtd questões no futuro, adicionar aqui */}
              {renderCommonBadges()}
           </div>
        );

      case 'law':
         return (
            <div className="flex gap-2">
               {meta.lawConfig?.pages ? (
                   <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20">
                     {meta.lawConfig.pages} Págs
                   </span>
               ) : null}
               {renderCommonBadges()}
            </div>
         );

      case 'summary': {
        const hasMindMap = meta.summaryConfig?.mindMap && meta.summaryConfig.mindMap.length > 0;
        return (
           <div className="flex gap-2">
              {hasMindMap && (
                 <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                    <BrainCircuit size={10} /> Mapa Mental
                 </span>
              )}
              {renderCommonBadges()}
           </div>
        );
      }

      case 'review': {
        const flashcardCount = meta.flashcardConfig?.cards?.length || 0;
        return (
           <div className="flex gap-2">
              {flashcardCount > 0 && (
                 <span className="text-[9px] bg-pink-500/10 text-pink-400 px-1.5 py-0.5 rounded border border-pink-500/20 flex items-center gap-1">
                    <Layers size={10} /> {flashcardCount} Cards
                 </span>
              )}
              {renderCommonBadges()}
           </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div 
        className="group bg-zinc-950 border border-zinc-800 hover:border-zinc-700 p-3 rounded-xl flex items-center justify-between transition-all hover:translate-x-1"
        style={{ borderLeft: `4px solid ${metaColor}` }}
    >
      <div className="flex items-center gap-4 flex-1 overflow-hidden">
        <div 
            className="p-2 rounded-lg border border-zinc-800/50"
            style={{ 
                color: metaColor, 
                backgroundColor: `${metaColor}1A` // 10% opacity hex code
            }}
        >
          {getIcon(meta.type)}
        </div>
        
        <div className="flex flex-col gap-1 overflow-hidden">
          <span className="text-xs font-bold text-zinc-200 truncate">{meta.title}</span>
          {getDetails()}
        </div>
      </div>

      <div className="flex items-center gap-2 pl-2">
        {/* Reorder Buttons */}
        <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button
                onClick={() => onMove('up')}
                disabled={isFirst}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            >
                <ChevronUp size={12} />
            </button>
            <button
                onClick={() => onMove('down')}
                disabled={isLast}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            >
                <ChevronDown size={12} />
            </button>
        </div>

        <button 
            onClick={() => onEdit(meta)}
            className="p-2 hover:bg-zinc-900 text-zinc-500 hover:text-white rounded transition-colors"
            title="Editar"
        >
            <Edit size={14} />
        </button>

        <button 
            onClick={() => onDelete(meta)}
            className="p-2 hover:bg-red-900/20 text-zinc-600 hover:text-red-500 rounded transition-colors"
            title="Excluir"
        >
            <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default MetaItem;
