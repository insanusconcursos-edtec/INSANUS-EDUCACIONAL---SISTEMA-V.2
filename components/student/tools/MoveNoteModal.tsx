import React from 'react';
import { EditalNote } from '../../../services/notebookService';
import { Folder, X, FolderMinus, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MoveNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: EditalNote | null;
  folders: EditalNote[];
  onMove: (noteId: string, folderId: string | null) => void;
}

export const MoveNoteModal: React.FC<MoveNoteModalProps> = ({ isOpen, onClose, note, folders, onMove }) => {
  if (!note) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm bg-[#09090b] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Mover Nota</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase truncate max-w-[200px]">{note.title}</p>
              </div>
              <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
              <div className="flex flex-col gap-1">
                {/* ROOT OPTION */}
                <button
                  onClick={() => { onMove(note.id!, null); onClose(); }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    !note.folderId ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent hover:bg-white/5'
                  }`}
                >
                  <FolderMinus size={16} className={!note.folderId ? 'text-white' : 'text-zinc-600'} />
                  <div className="flex-1">
                    <p className={`text-[11px] font-bold uppercase tracking-widest ${!note.folderId ? 'text-white' : 'text-zinc-500'}`}>Remover de Pasta</p>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase mt-0.5">Mover para a raiz</p>
                  </div>
                  {!note.folderId && <ChevronRight size={14} className="text-white" />}
                </button>

                <div className="h-px bg-white/5 my-1" />

                {/* FOLDERS */}
                {folders.filter(f => f.id !== note.id).map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => { onMove(note.id!, folder.id!); onClose(); }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      note.folderId === folder.id ? 'bg-amber-500/10 border-amber-500/30' : 'bg-transparent border-transparent hover:bg-white/5'
                    }`}
                  >
                    <Folder size={16} className={note.folderId === folder.id ? 'text-amber-500' : 'text-zinc-600'} />
                    <div className="flex-1">
                      <p className={`text-[11px] font-bold uppercase tracking-widest ${note.folderId === folder.id ? 'text-amber-500' : 'text-white'}`}>
                        {folder.title || 'Pasta sem nome'}
                      </p>
                    </div>
                    {note.folderId === folder.id && <ChevronRight size={14} className="text-amber-500" />}
                  </button>
                ))}

                {folders.length === 0 && (
                  <div className="p-8 text-center text-zinc-600">
                    <Folder size={24} className="mx-auto mb-2 opacity-20" />
                    <p className="text-[10px] font-bold uppercase">Nenhuma pasta disponível</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
                <button 
                  onClick={onClose}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
