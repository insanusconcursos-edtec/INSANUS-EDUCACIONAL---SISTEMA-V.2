
import React from 'react';
import { ZoomIn, ZoomOut, Check, LogOut, RotateCcw } from 'lucide-react';

interface BottomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onSave: () => void;
  onClose: () => void;
  scale: number;
}

const BottomControls: React.FC<BottomControlsProps> = ({ 
  onZoomIn, onZoomOut, onReset, onSave, onClose, scale 
}) => {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 p-2 bg-zinc-950/90 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-md">
       
       <div className="flex items-center gap-1 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
           <button onClick={onZoomOut} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
               <ZoomOut size={16} />
           </button>
           <span className="w-12 text-center text-xs font-mono text-zinc-500 select-none">
               {Math.round(scale * 100)}%
           </span>
           <button onClick={onZoomIn} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
               <ZoomIn size={16} />
           </button>
       </div>

       <div className="w-px h-6 bg-zinc-800"></div>

       <button 
            onClick={onReset}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors tooltip"
            title="Centralizar"
       >
           <RotateCcw size={16} />
       </button>

       <div className="w-px h-6 bg-zinc-800"></div>

       <button 
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl border border-zinc-800 transition-all text-xs font-bold uppercase tracking-wider"
       >
           <LogOut size={14} /> Sair
       </button>
       
       <button 
            onClick={onSave}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg shadow-purple-900/50 transition-all text-xs font-black uppercase tracking-wider"
       >
           <Check size={14} /> Salvar
       </button>

    </div>
  );
};

export default BottomControls;
