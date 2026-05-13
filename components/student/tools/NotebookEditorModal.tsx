
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { TipTapEditor } from '../../ui/TipTapEditor';

interface NotebookEditorModalProps {
  initialData: string;
  title: string;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
  readOnly?: boolean;
}

export const NotebookEditorModal: React.FC<NotebookEditorModalProps> = ({
  initialData,
  title,
  onSave,
  onClose,
  readOnly = false
}) => {
  const [content, setContent] = useState(initialData || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync initialData if it changes from outside
  useEffect(() => {
    setContent(initialData || '');
  }, [initialData]);

  // Autosave logic
  useEffect(() => {
    if (readOnly || content === initialData) return;

    const timeoutId = setTimeout(() => {
      handleAutosave();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [content]);

  const handleAutosave = async () => {
    setSaveStatus('saving');
    try {
      await onSave(content);
      setSaveStatus('saved');
    } catch (error) {
      console.error("Erro no autosave:", error);
      setSaveStatus('error');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-5xl h-[85vh] bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#121214]">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">{title}</h2>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-0.5">Editor de Caderno Personalizado</p>
            </div>
            {saveStatus !== 'idle' && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10 animate-in fade-in duration-300">
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-zinc-500" />
                    <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Salvando...</span>
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black uppercase text-emerald-500 tracking-wider">Salvo</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-[9px] font-black uppercase text-red-500 tracking-wider">Erro</span>
                  </>
                )}
              </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-all outline-none"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col bg-[#09090b]">
           <TipTapEditor 
             content={content} 
             onChange={setContent}
             placeholder="Digite suas anotações aqui..."
           />
        </div>

        {/* Footer Removed for Clean UI Autosave */}
      </div>
    </div>,
    document.body
  );
};
