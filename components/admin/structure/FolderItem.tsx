import React, { useState } from 'react';
import { 
  Folder, ChevronRight, Edit2, Trash2, Save, X 
} from 'lucide-react';
import { Folder as FolderType } from '../../../services/planService';

interface FolderItemProps {
  folder: FolderType;
  onRenameFolder: (id: string, newName: string) => void;
  onDeleteFolder: (id: string) => void;
  children?: React.ReactNode; 
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  onRenameFolder,
  onDeleteFolder,
  children
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const handleSaveRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editName.trim()) {
      onRenameFolder(folder.id, editName);
      setIsEditing(false);
    }
  };

  return (
    <div className="group mb-2 bg-zinc-950/50 border border-zinc-800 rounded-xl overflow-hidden transition-all hover:border-zinc-700">
      {/* Folder Header */}
      <div 
        className={`
          flex items-center justify-between p-2 cursor-pointer transition-colors
          ${isOpen ? 'bg-zinc-900 border-b border-zinc-800' : 'hover:bg-zinc-900'}
        `}
        onClick={() => !isEditing && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          <button 
            className={`p-1 text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          >
            <ChevronRight size={14} />
          </button>
          
          {/* New Solid Icon Style */}
          <Folder size={14} className="text-zinc-400 fill-zinc-700 shrink-0" />
          
          {isEditing ? (
            <form 
              onSubmit={handleSaveRename} 
              onClick={e => e.stopPropagation()}
              className="flex-1 flex gap-1 mr-2"
            >
              <input 
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-brand-red outline-none font-bold"
                autoFocus
              />
              <button type="submit" className="p-1 text-green-500 hover:bg-zinc-800 rounded"><Save size={12}/></button>
              <button type="button" onClick={() => setIsEditing(false)} className="p-1 text-zinc-500 hover:bg-zinc-800 rounded"><X size={12}/></button>
            </form>
          ) : (
            <span className="text-xs font-bold text-zinc-300 truncate select-none tracking-wide">
              {folder.name}
            </span>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="p-1.5 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded"
              title="Renomear Pasta"
            >
              <Edit2 size={12} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
              className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-900/20 rounded transition-colors"
              title="Excluir Pasta"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Folder Body (Disciplines List) */}
      {isOpen && (
        <div className="bg-zinc-950/30">
          <div className="flex flex-col">
             {children}
             {(!children || React.Children.count(children) === 0) && (
                 <div className="p-3 text-center border-t border-dashed border-zinc-800/50">
                    <span className="text-[9px] text-zinc-600 font-bold">Pasta vazia</span>
                 </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderItem;