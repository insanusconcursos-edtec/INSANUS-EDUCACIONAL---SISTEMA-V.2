import React from 'react';
import { FileText, FileQuestion, Layers, Video, Link as LinkIcon, Type, Code, ChevronUp, ChevronDown, Edit2, Trash2 } from 'lucide-react';
import { CourseContent } from '../../../../../types/course';

interface ContentItemProps {
  content: CourseContent;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const ContentItem: React.FC<ContentItemProps> = ({ content, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const getMaterialStyles = (classification?: string) => {
    const upperClass = classification?.toUpperCase();
    switch (upperClass) {
      case 'TEORIA':
        return {
          Icon: FileText,
          colorClass: 'text-yellow-500',
          borderClass: 'border-yellow-500/20',
          bgClass: 'bg-yellow-500/10'
        };
      case 'QUESTÕES':
        return {
          Icon: FileQuestion,
          colorClass: 'text-orange-500',
          borderClass: 'border-orange-500/20',
          bgClass: 'bg-orange-500/10'
        };
      case 'TEORIA_QUESTÕES':
      case 'AMBOS':
      case 'HÍBRIDO':
        return {
          Icon: Layers,
          colorClass: 'text-blue-500',
          borderClass: 'border-blue-500/20',
          bgClass: 'bg-blue-500/10'
        };
      default:
        return {
          Icon: FileText,
          colorClass: 'text-yellow-500',
          borderClass: 'border-yellow-500/20',
          bgClass: 'bg-yellow-500/10'
        };
    }
  };

  const getIcon = () => {
    if (content.type === 'pdf') {
      const styles = getMaterialStyles(content.pdfClassification);
      return <styles.Icon size={16} className={styles.colorClass} />;
    }

    switch (content.type) {
      case 'video': return <Video size={16} className="text-red-500" />;
      case 'link': return <LinkIcon size={16} className="text-blue-500" />;
      case 'text': return <Type size={16} className="text-gray-300" />;
      case 'embed': return <Code size={16} className="text-green-500" />;
      default: return null;
    }
  };

  const renderClassificationBadge = () => {
    if (content.type !== 'pdf') return null;

    const styles = getMaterialStyles(content.pdfClassification);
    const label = content.pdfClassification === 'TEORIA_QUESTÕES' ? 'TEORIA + QUESTÕES' : (content.pdfClassification || 'TEORIA');

    return (
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-tighter ${styles.bgClass} ${styles.colorClass} ${styles.borderClass}`}>
        <styles.Icon size={10} />
        {label}
      </div>
    );
  };

  const isLinked = content.type === 'pdf' && content.pdfClassification === 'QUESTÕES' && content.linkedTheoryId;

  return (
    <div className={`relative ${isLinked ? 'ml-8 mt-1' : 'mt-3'}`}>
      {/* Linha Conectora (apenas se for vinculado) */}
      {isLinked && (
        <div className="absolute -left-6 top-0 h-1/2 w-4 border-b-2 border-l-2 border-zinc-700 rounded-bl-lg"></div>
      )}

      <div className="flex items-center gap-3 p-3 bg-black/40 border border-gray-800 rounded hover:bg-[#1a1d24] transition-colors group">
        
        {/* Ícone do Tipo */}
        <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center shrink-0 border border-gray-800 group-hover:border-gray-700 transition-colors">
          {getIcon()}
        </div>

        {/* Título e Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-bold text-gray-200 truncate">{content.title}</h4>
            {renderClassificationBadge()}
          </div>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{content.type}</span>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1">
          <div className="flex flex-col gap-0.5 mr-2">
              <button onClick={onMoveUp} disabled={isFirst} title="Mover para cima" className="text-gray-600 hover:text-white disabled:opacity-30 transition-colors">
                <ChevronUp size={14} />
              </button>
              <button onClick={onMoveDown} disabled={isLast} title="Mover para baixo" className="text-gray-600 hover:text-white disabled:opacity-30 transition-colors">
                <ChevronDown size={14} />
              </button>
          </div>
          <button onClick={onEdit} title="Editar" className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded transition-all">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} title="Excluir" className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-800 rounded transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Gabarito Comentado (Admin View) */}
      {content.commentedAnswerKeyUrl && (
        <div className="relative ml-8 mt-1">
          <div className="absolute -left-6 top-0 h-1/2 w-4 border-b-2 border-l-2 border-blue-500/30 rounded-bl-lg"></div>
          <div className="flex items-center gap-2 p-1.5 px-3 bg-blue-900/10 border border-blue-900/20 rounded-lg w-fit">
            <FileText size={12} className="text-blue-500" />
            <span className="text-[10px] text-blue-400 font-black uppercase tracking-wider">
              Possui Gabarito Comentado
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
