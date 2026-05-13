import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Folder as FolderIcon, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  FolderInput,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EditalNote } from '../../../services/notebookService';

interface DraggableNotesListProps {
  notes: EditalNote[];
  selectedNote: EditalNote | null;
  onSelectNote: (note: EditalNote) => void;
  onDeleteNote: (noteId: string) => void;
  onMoveNote: (note: EditalNote) => void;
  onRenameNote: (noteId: string, newTitle: string) => void;
  onUpdatePositions: (updates: {id: string, position: number, folderId?: string | null}[]) => void;
}

// ---------------------------------------------
// Note Item Component
// ---------------------------------------------
function NoteItem({ 
  note, 
  isSelected, 
  onClick, 
  onDelete, 
  onMove, 
  onRename,
  canMoveUp, 
  canMoveDown, 
  onMoveUp, 
  onMoveDown 
}: { 
  note: EditalNote, 
  isSelected: boolean, 
  onClick: () => void, 
  onDelete: (id: string) => void,
  onMove: (note: EditalNote) => void,
  onRename: (id: string, title: string) => void,
  canMoveUp: boolean,
  canMoveDown: boolean,
  onMoveUp: () => void,
  onMoveDown: () => void
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title || '');

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim() && editTitle !== note.title) {
      onRename(note.id!, editTitle);
    }
    setIsEditing(false);
  };

  return (
    <div 
      onClick={onClick}
      className={`group flex flex-col gap-1 p-2 rounded-xl border transition-all cursor-pointer ${
        isSelected ? 'bg-white/10 border-white/20' : 'bg-[#121214] border-white/5 hover:bg-white/5'
      }`}
    >
      <div className="flex items-center gap-2">
        <FileText size={14} className={isSelected ? 'text-white' : 'text-zinc-500'} />
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input 
                autoFocus
                className="flex-1 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white outline-none focus:border-red-500/50"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename(e as any);
                  if (e.key === 'Escape') { setIsEditing(false); setEditTitle(note.title || ''); }
                }}
              />
              <button onClick={handleRename} className="text-emerald-500 p-0.5 hover:bg-emerald-500/10 rounded"><Check size={10} /></button>
            </div>
          ) : (
            <div className="relative group/tooltip flex-1 min-w-0">
              <p className={`text-[11px] font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                {note.title || 'Sem título'}
              </p>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block z-[9999] w-max max-w-[200px] p-2 bg-zinc-800 text-white text-[10px] rounded shadow-xl leading-tight border border-white/10 whitespace-normal break-words">
                {note.title || 'Sem título'}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isEditing && (
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="p-1 text-zinc-600 hover:text-white rounded"
              title="Renomear"
            >
              <Edit2 size={12} />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onMove(note); }}
            className="p-1 text-zinc-600 hover:text-blue-400 rounded"
            title="Mover para pasta"
          >
            <FolderInput size={12} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(note.id!); }}
            className="p-1 text-zinc-600 hover:text-red-500 rounded"
            title="Excluir"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Movement Arrows */}
      <div className="flex items-center gap-2 pl-5">
        <button 
          disabled={!canMoveUp}
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          className={`p-0.5 rounded transition-all ${canMoveUp ? 'text-zinc-600 hover:text-white hover:bg-white/10' : 'text-zinc-800 cursor-not-allowed opacity-20'}`}
        >
          <ChevronUp size={12} />
        </button>
        <button 
          disabled={!canMoveDown}
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          className={`p-0.5 rounded transition-all ${canMoveDown ? 'text-zinc-600 hover:text-white hover:bg-white/10' : 'text-zinc-800 cursor-not-allowed opacity-20'}`}
        >
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------
// Folder Item Component
// ---------------------------------------------
function FolderItem({ 
    folder, 
    notesInside, 
    isSelected, 
    selectedNote,
    onSelectNote, 
    onDeleteFolder, 
    onDeleteNote,
    onMoveNote,
    onRenameNote,
    isOpen,
    onToggleOpen,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
    onUpdateInternalPositions
}: { 
    folder: EditalNote, 
    notesInside: EditalNote[], 
    isSelected: boolean,
    selectedNote: EditalNote | null,
    onSelectNote: (n: EditalNote) => void,
    onDeleteFolder: (id: string) => void,
    onDeleteNote: (id: string) => void,
    onMoveNote: (note: EditalNote) => void,
    onRenameNote: (id: string, title: string) => void,
    isOpen: boolean,
    onToggleOpen: () => void,
    canMoveUp: boolean,
    canMoveDown: boolean,
    onMoveUp: () => void,
    onMoveDown: () => void,
    onUpdateInternalPositions: (updates: {id: string, position: number, folderId?: string | null}[]) => void
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(folder.title || '');

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim() && editTitle !== folder.title) {
      onRenameNote(folder.id!, editTitle);
    }
    setIsEditing(false);
  };

  const moveInternal = (noteId: string, direction: 'up' | 'down') => {
    const idx = notesInside.findIndex(n => n.id === noteId);
    if (idx === -1) return;
    
    const newArr = [...notesInside];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    
    if (targetIdx >= 0 && targetIdx < newArr.length) {
      const temp = newArr[idx];
      newArr[idx] = newArr[targetIdx];
      newArr[targetIdx] = temp;
      
      onUpdateInternalPositions(newArr.map((n, i) => ({ id: n.id!, position: i, folderId: folder.id })));
    }
  };

  return (
    <div className={`border rounded-xl transition-all ${isOpen ? 'bg-[#0f0f12] border-white/10 shadow-lg' : 'bg-[#121214] border-white/5 hover:border-white/10'}`}>
      <div className={`group flex items-center gap-2 p-2.5 transition-all cursor-pointer ${isSelected ? 'bg-white/10 border border-white/20' : ''}`} 
           onClick={() => { onSelectNote(folder); onToggleOpen(); }}>
        
        <FolderIcon size={14} className={isOpen ? 'text-amber-500' : 'text-zinc-500'} />
        
        <div className="flex-1 min-w-0 flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input 
                  autoFocus
                  className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white uppercase font-black outline-none focus:border-amber-500/50 w-full"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename(e as any);
                    if (e.key === 'Escape') { setIsEditing(false); setEditTitle(folder.title || ''); }
                  }}
                />
                <button onClick={handleRename} className="text-emerald-500 p-0.5 hover:bg-emerald-500/10 rounded"><Check size={10} /></button>
              </div>
            ) : (
              <div className="relative group/tooltip flex-1 min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-widest truncate ${isOpen ? 'text-amber-500' : (isSelected ? 'text-white' : 'text-zinc-400')}`}>
                  {folder.title || 'Nova Pasta'}
                </p>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block z-[9999] w-max max-w-[200px] p-2 bg-zinc-800 text-white text-[10px] font-bold rounded shadow-xl leading-tight border border-white/10 uppercase tracking-widest whitespace-normal break-words">
                  {folder.title || 'Nova Pasta'}
                </div>
              </div>
            )}
            <span className="text-[9px] px-1.5 py-0.5 bg-black/40 text-zinc-500 rounded font-black">{notesInside.length}</span>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           {/* Sorting arrows for folder in root */}
          <button 
            disabled={!canMoveUp}
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            className={`p-1 rounded ${canMoveUp ? 'text-zinc-600 hover:text-white' : 'text-zinc-800'}`}
          >
            <ChevronUp size={12} />
          </button>
          <button 
            disabled={!canMoveDown}
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            className={`p-1 rounded ${canMoveDown ? 'text-zinc-600 hover:text-white' : 'text-zinc-800'}`}
          >
            <ChevronDown size={12} />
          </button>

          {!isEditing && (
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="p-1.5 text-zinc-600 hover:text-white hover:bg-white/5 rounded transition-all"
            >
              <Edit2 size={12} />
            </button>
          )}

          <button 
            onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id!); }}
            className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
          >
            <Trash2 size={12} />
          </button>
        </div>

        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
            <motion.div 
               initial={{ height: 0, opacity: 0 }}
               animate={{ height: 'auto', opacity: 1 }}
               exit={{ height: 0, opacity: 0 }}
               className="overflow-hidden"
            >
               <div className="p-3 pl-8 pt-0 flex flex-col gap-2 bg-black/20 border-t border-white/5">
                   {notesInside.length === 0 && (
                     <div className="text-[9px] text-zinc-700 font-black p-4 text-center uppercase tracking-[0.2em] border-2 border-dashed border-white/5 rounded-xl">
                        Nenhuma nota nesta pasta
                     </div>
                   )}
                   {notesInside.map((note, idx) => (
                       <NoteItem 
                          key={note.id} 
                          note={note} 
                          isSelected={selectedNote?.id === note.id} 
                          onClick={() => onSelectNote(note)} 
                          onDelete={onDeleteNote}
                          onMove={onMoveNote}
                          onRename={onRenameNote}
                          canMoveUp={idx > 0}
                          canMoveDown={idx < notesInside.length - 1}
                          onMoveUp={() => moveInternal(note.id!, 'up')}
                          onMoveDown={() => moveInternal(note.id!, 'down')}
                       />
                   ))}
               </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------
// Main Component
// ---------------------------------------------
export function DraggableNotesList({ 
  notes, 
  selectedNote, 
  onSelectNote, 
  onDeleteNote, 
  onMoveNote,
  onRenameNote,
  onUpdatePositions 
}: DraggableNotesListProps) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  // Grouping notes
  const itemsMap = useMemo(() => {
     const folders = notes.filter(n => n.isFolder);
     const map: Record<string, EditalNote[]> = { root: [] };
     folders.forEach(f => map[f.id!] = []);
     
     notes.forEach(note => {
         if (note.isFolder) {
             map.root.push(note);
         } else {
             if (note.folderId && map[note.folderId]) {
                 map[note.folderId].push(note);
             } else {
                 map.root.push(note);
             }
         }
     });

     // Root items should be sorted by a local order?
     // Actually, let's just use their array order for now.
     return map;
  }, [notes]);

  const toggleFolder = (folderId: string) => {
      setOpenFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const moveInRoot = (noteId: string, direction: 'up' | 'down') => {
    const rootItems = [...itemsMap.root];
    const idx = rootItems.findIndex(n => n.id === noteId);
    if (idx === -1) return;
    
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < rootItems.length) {
      const updatedArr = [...rootItems];
      const temp = updatedArr[idx];
      updatedArr[idx] = updatedArr[targetIdx];
      updatedArr[targetIdx] = temp;
      
      onUpdatePositions(updatedArr.map((n, i) => ({ id: n.id!, position: i, folderId: null })));
    }
  };

  return (
    <div className="flex flex-col gap-2 p-1">
      {itemsMap.root.map((item, idx) => {
          const canMoveUp = idx > 0;
          const canMoveDown = idx < itemsMap.root.length - 1;

          if (item.isFolder) {
              return (
                  <FolderItem 
                    key={item.id} 
                    folder={item} 
                    notesInside={itemsMap[item.id!] || []} 
                    selectedNote={selectedNote}
                    onSelectNote={onSelectNote}
                    onDeleteFolder={onDeleteNote}
                    onDeleteNote={onDeleteNote}
                    onMoveNote={onMoveNote}
                    onRenameNote={onRenameNote}
                    isOpen={!!openFolders[item.id!]}
                    onToggleOpen={() => toggleFolder(item.id!)}
                    isSelected={selectedNote?.id === item.id}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    onMoveUp={() => moveInRoot(item.id!, 'up')}
                    onMoveDown={() => moveInRoot(item.id!, 'down')}
                    onUpdateInternalPositions={onUpdatePositions}
                  />
              );
          } else {
              return (
                <NoteItem 
                  key={item.id} 
                  note={item} 
                  isSelected={selectedNote?.id === item.id} 
                  onClick={() => onSelectNote(item)} 
                  onDelete={onDeleteNote}
                  onMove={onMoveNote}
                  onRename={onRenameNote}
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                  onMoveUp={() => moveInRoot(item.id!, 'up')}
                  onMoveDown={() => moveInRoot(item.id!, 'down')}
                />
              );
          }
      })}
    </div>
  );
}
