import React, { useState } from 'react';
import { 
  ChevronRight, ChevronDown, Plus, Trash2, 
  Edit2, Check, X, ChevronUp, Link as LinkIcon,
  PlayCircle, FileText, ListChecks, Book, Edit3, RefreshCw, Unlink,
  StickyNote
} from 'lucide-react';
import { EdictLinkedGoals, EdictStudyLevel } from '../../../services/edictService';
import { Meta, MetaType } from '../../../services/metaService';
import { RichTextEditor } from '../../ui/RichTextEditor';

export type EdictItemType = 'discipline' | 'topic' | 'subtopic';

interface VerticalEdictItemProps {
  id: string;
  name: string;
  type: EdictItemType;
  isExpanded?: boolean;
  linkedGoals?: EdictLinkedGoals;
  metaLookup?: Record<string, Meta>; 
  observation?: string;
  
  // Study Level Props
  studyLevels?: EdictStudyLevel[];
  currentLevelId?: string | null;
  onLevelChange?: (levelId: string) => void;

  onToggleExpand?: () => void;
  onRename: (newName: string) => void;
  onUpdateObservation?: (newObservation: string) => void;
  onDelete: () => void;
  onAddChild?: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onLinkGoals?: () => void; 
  onUnlinkGoal?: (goalId: string, type: MetaType) => void;
  isFirst: boolean;
  isLast: boolean;
  children?: React.ReactNode;
}

const VerticalEdictItem: React.FC<VerticalEdictItemProps> = ({
  name, type, isExpanded, linkedGoals, metaLookup, observation,
  studyLevels, currentLevelId, onLevelChange,
  onToggleExpand, onRename, onUpdateObservation, onDelete, onAddChild, onMove, 
  onLinkGoals, onUnlinkGoal,
  isFirst, isLast, children
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [isEditingObservation, setIsEditingObservation] = useState(false);

  const handleSave = () => {
    if (editName.trim()) {
      onRename(editName);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditName(name);
  };

  // Helper para ícones de meta
  const getMetaIcon = (type: MetaType) => {
    switch(type) {
      case 'lesson': return <PlayCircle size={12} className="text-blue-500" />;
      case 'material': return <FileText size={12} className="text-orange-500" />;
      case 'questions': return <ListChecks size={12} className="text-green-500" />;
      case 'law': return <Book size={12} className="text-yellow-500" />;
      case 'summary': return <Edit3 size={12} className="text-purple-500" />;
      case 'review': return <RefreshCw size={12} className="text-pink-500" />;
      default: return <FileText size={12} />;
    }
  };

  // Helper para calcular revisões
  const getReviewBadge = (meta: Meta) => {
    if (!meta.reviewConfig?.active) return null;
    const count = meta.reviewConfig.intervals.split(',').length;
    return (
      <span className="text-[8px] font-mono text-zinc-500 border border-zinc-800 bg-zinc-950 px-1 rounded ml-2">
        0/{count} Rev
      </span>
    );
  };

  // Coleta de Metas Vinculadas para Renderização
  const renderLinkedMetas = () => {
    if (!linkedGoals || !metaLookup) return null;
    const types: MetaType[] = ['lesson', 'material', 'questions', 'law', 'summary', 'review'];
    const metasToRender: Meta[] = [];

    types.forEach(t => {
      if (linkedGoals[t]) {
        linkedGoals[t].forEach(goalId => {
          const meta = metaLookup[goalId];
          if (meta) metasToRender.push(meta);
        });
      }
    });

    if (metasToRender.length === 0) return null;

    return (
      <div className="mt-2 pl-2 space-y-1">
        {metasToRender.map(meta => (
          <div key={meta.id} className="flex items-center justify-between group/meta bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-1.5 pl-2 hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-2 overflow-hidden">
              {getMetaIcon(meta.type)}
              <span className="text-[10px] font-bold text-zinc-300 uppercase truncate max-w-[200px]">{meta.title}</span>
              {getReviewBadge(meta)}
            </div>
            
            {onUnlinkGoal && (
              <button 
                onClick={() => onUnlinkGoal(meta.id!, meta.type)}
                className="p-1 text-zinc-700 hover:text-red-500 transition-all"
                title="Desvincular Meta"
              >
                <Unlink size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Estilos baseados no nível hierárquico
  const getStyles = () => {
    switch (type) {
      case 'discipline':
        return {
          container: 'bg-zinc-950 border border-zinc-800 mb-4 rounded-xl',
          header: 'p-3 bg-zinc-900/50 hover:bg-zinc-900 border-b border-zinc-800/50',
          text: 'text-sm font-black text-white tracking-tight',
          hoverText: 'hover:text-brand-red',
          iconColor: 'text-brand-red',
          indent: ''
        };
      case 'topic':
        return {
          container: 'border-l-2 border-zinc-800 ml-4 mt-2',
          header: 'py-2 px-3 hover:bg-zinc-900/30 rounded-r-lg transition-colors flex items-center',
          text: 'text-xs font-bold text-zinc-300',
          hoverText: 'hover:text-white',
          iconColor: 'text-purple-500',
          indent: 'pl-2'
        };
      case 'subtopic':
        return {
          container: 'ml-8 mt-1 border-l border-zinc-800 border-dashed',
          header: 'py-1.5 px-3 hover:bg-zinc-900/30 rounded-r-lg transition-colors flex items-center',
          text: 'text-[11px] font-medium text-zinc-500',
          hoverText: 'hover:text-zinc-300',
          iconColor: 'text-zinc-600',
          indent: 'pl-4'
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={styles.container}>
      <div className={`group flex items-center justify-between ${styles.header} cursor-default`}>
        
        {/* Esquerda: Expander + Nome */}
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          {type !== 'subtopic' && (
            <button 
              onClick={onToggleExpand}
              className="p-1 text-zinc-500 hover:text-white transition-colors"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          
          {isEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <input 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-black border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-brand-red outline-none w-full font-bold"
                autoFocus
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancel();
                }}
                onBlur={handleCancel} 
              />
              <button onClick={handleSave} className="p-1 text-green-500 hover:bg-zinc-800 rounded"><Check size={14}/></button>
              <button onClick={handleCancel} className="p-1 text-zinc-500 hover:bg-zinc-800 rounded"><X size={14}/></button>
            </div>
          ) : (
            <div className="flex flex-col">
              <span 
                  onClick={() => setIsEditing(true)}
                  className={`${styles.text} ${styles.hoverText} truncate cursor-text transition-colors`}
                  title="Clique para editar"
              >
                  {name}
              </span>
            </div>
          )}
        </div>

        {/* Direita: Ações (Sempre Visíveis) */}
        <div className="flex items-center gap-1">
          
          {/* SELETOR DE NÍVEL (Apenas Tópicos) */}
          {type === 'topic' && studyLevels && onLevelChange && (
            <div className="mr-2">
              <select
                value={currentLevelId || ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onLevelChange(e.target.value || '')}
                className="bg-zinc-950 border border-zinc-800 text-[9px] font-bold text-zinc-400 uppercase rounded-md px-2 py-1 focus:outline-none focus:border-brand-red/50 focus:text-white hover:border-zinc-700 cursor-pointer min-w-[80px]"
              >
                <option value="">Nível...</option>
                {studyLevels.map(level => (
                  <option key={level.id} value={level.id}>{level.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reorder */}
          <div className="flex flex-col mr-1">
            <button 
                onClick={() => onMove('up')} 
                disabled={isFirst}
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
            >
                <ChevronUp size={10} />
            </button>
            <button 
                onClick={() => onMove('down')} 
                disabled={isLast}
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
            >
                <ChevronDown size={10} />
            </button>
          </div>

          {/* Link Action (Only Topics and Subtopics) */}
          {(type === 'topic' || type === 'subtopic') && onLinkGoals && (
            <button 
              onClick={onLinkGoals}
              className="p-1.5 text-zinc-600 hover:text-brand-red hover:bg-zinc-800 rounded"
              title="Vincular Metas"
            >
              <LinkIcon size={12} />
            </button>
          )}

          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded"
              title="Renomear"
            >
              <Edit2 size={12} />
            </button>
          )}

          {onUpdateObservation && (
            <button 
              onClick={() => {
                setIsEditingObservation(!isEditingObservation);
                if (!isExpanded && onToggleExpand) onToggleExpand();
              }}
              className={`p-1.5 rounded transition-colors ${isEditingObservation || (observation && observation !== '<p><br></p>' && observation !== '') ? 'text-yellow-500 bg-yellow-500/10' : 'text-zinc-600 hover:text-yellow-500 hover:bg-yellow-500/10'}`}
              title="Adicionar/Editar Observação"
            >
              <StickyNote size={12} />
            </button>
          )}

          {onAddChild && (
            <button 
              onClick={onAddChild}
              className={`p-1.5 ${styles.iconColor} hover:bg-zinc-800 rounded`}
              title={type === 'discipline' ? "Adicionar Tópico" : "Adicionar Subtópico"}
            >
              <Plus size={14} />
            </button>
          )}

          <button 
            onClick={onDelete}
            className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-900/20 rounded"
            title="Excluir"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Linked Metas List */}
      {(isExpanded || type === 'subtopic') && (
        <div className="px-3 pb-2">
          {/* Observation Editor/Viewer */}
          {(isEditingObservation || (observation && observation !== '<p><br></p>' && observation !== '')) && (
            <div className="mb-3 mt-1">
              {isEditingObservation ? (
                <div className="space-y-2 animate-in fade-in">
                  <RichTextEditor 
                    value={observation || ''} 
                    onChange={(val) => onUpdateObservation?.(val)}
                    placeholder="Digite observações para este item..."
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={() => setIsEditingObservation(false)} 
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-[9px] uppercase font-bold rounded transition-colors"
                    >
                      Concluir Observação
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="p-2 bg-yellow-900/5 border-l-2 border-yellow-600/50 rounded-r-lg group/obs relative cursor-pointer hover:bg-yellow-900/10 transition-colors"
                  onClick={() => setIsEditingObservation(true)}
                  title="Clique para editar"
                >
                  <span className="text-[8px] font-bold text-yellow-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <StickyNote size={10} /> Observação
                  </span>
                  <div 
                    className="prose prose-invert prose-xs max-w-none text-zinc-400 text-[10px] leading-relaxed" 
                    dangerouslySetInnerHTML={{ __html: observation || '' }} 
                  />
                </div>
              )}
            </div>
          )}

          {renderLinkedMetas()}
        </div>
      )}

      {/* Renderização dos Filhos */}
      {(isExpanded || type === 'subtopic') && children && (
        <div className={type === 'discipline' ? 'p-2 pt-0' : ''}>
          {children}
        </div>
      )}
    </div>
  );
};

export default VerticalEdictItem;