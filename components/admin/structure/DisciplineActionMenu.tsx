import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Folder, Box } from 'lucide-react';
import { Folder as FolderType } from '../../../services/planService';
import { Discipline } from '../../../services/structureService';

interface DisciplineActionMenuProps {
  discipline: Discipline;
  allFolders: FolderType[];
  onMove: (discipline: Discipline, targetFolderId: string | null) => void;
}

const DisciplineActionMenu: React.FC<DisciplineActionMenuProps> = ({ 
  discipline, 
  allFolders, 
  onMove 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on scroll or resize to prevent floating issues
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (isOpen) setIsOpen(false);
    };

    if (isOpen) {
      window.addEventListener('scroll', handleScrollOrResize, true); // Capture phase for inner scrolls
      window.addEventListener('resize', handleScrollOrResize);
    }

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const MENU_WIDTH = 192; // w-48 is approx 192px
      
      // Calculate position (Align Right Edge)
      let left = rect.right - MENU_WIDTH;
      const top = rect.bottom + 5;

      // Boundary check (Prevent going off-screen left)
      if (left < 10) left = rect.left;

      setMenuPos({ top, left });
      setIsOpen(true);
    }
  };

  const handleMove = (folderId: string | null) => {
    onMove(discipline, folderId);
    setIsOpen(false);
  };

  // Filter folders: exclude current folder
  const availableFolders = allFolders.filter(f => f.id !== discipline.folderId);
  const showRootOption = discipline.folderId !== null && discipline.folderId !== undefined;

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={toggleMenu}
        className={`p-1.5 rounded transition-all ${isOpen ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
        title="Mover Disciplina"
      >
        <MoreVertical size={14} />
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col" onClick={() => setIsOpen(false)}>
          {/* Invisible Backdrop handled by container click */}
          
          <div 
            className="fixed w-48 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()} // Prevent click inside menu from closing it
          >
            <div className="px-3 py-2 bg-zinc-900/50 border-b border-zinc-800">
              <span className="text-[9px] font-black text-zinc-500 tracking-widest">Mover para...</span>
            </div>
            
            <div className="p-1 max-h-64 overflow-y-auto custom-scrollbar">
              {/* Option: Move to Root */}
              {showRootOption && (
                  <button
                      onClick={() => handleMove(null)}
                      className="w-full flex items-center gap-2 px-2 py-2 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors group text-left"
                  >
                      <Box size={14} className="text-zinc-500 group-hover:text-brand-red" />
                      <span>Raiz (Sem Pasta)</span>
                  </button>
              )}

              {/* List Folders */}
              {availableFolders.map(folder => (
                  <button
                      key={folder.id}
                      onClick={() => handleMove(folder.id)}
                      className="w-full flex items-center gap-2 px-2 py-2 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors group text-left"
                  >
                      <Folder size={14} className="text-zinc-500 group-hover:text-purple-400 fill-zinc-800 group-hover:fill-purple-500/20" />
                      <span className="truncate">{folder.name}</span>
                  </button>
              ))}

              {availableFolders.length === 0 && !showRootOption && (
                  <div className="px-2 py-2 text-center">
                      <span className="text-[10px] text-zinc-600 font-medium">Sem destinos disponíveis</span>
                  </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default DisciplineActionMenu;