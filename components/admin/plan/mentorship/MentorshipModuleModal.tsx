
import React, { useState, useRef, useEffect } from 'react';
import { MentorshipModule } from '../../../../types/mentorship';
import { Lock, Calendar } from 'lucide-react';

interface MentorshipModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, coverFile: File | null, isLocked: boolean, releaseDate: string) => Promise<void>;
  isSaving: boolean;
  moduleToEdit?: MentorshipModule | null;
}

export function MentorshipModuleModal({ isOpen, onClose, onSave, isSaving, moduleToEdit }: MentorshipModuleModalProps) {
  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [releaseDate, setReleaseDate] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (moduleToEdit) {
        setTitle(moduleToEdit.title);
        setPreviewUrl(moduleToEdit.coverUrl);
        setCoverFile(null);
        setIsLocked(!!moduleToEdit.isLocked);
        setReleaseDate(moduleToEdit.releaseDate || '');
      } else {
        setTitle('');
        setPreviewUrl(null);
        setCoverFile(null);
        setIsLocked(false);
        setReleaseDate('');
      }
    }
  }, [isOpen, moduleToEdit]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return alert('Digite o título do módulo');
    
    if (!moduleToEdit && !coverFile) return alert('Selecione uma imagem de capa');
    if (!moduleToEdit && !previewUrl) return alert('Selecione uma imagem de capa');

    await onSave(title, coverFile, isLocked, releaseDate);
    
    if (!isSaving) {
        setTitle('');
        setCoverFile(null);
        setPreviewUrl(null);
        setIsLocked(false);
        setReleaseDate('');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
        
        <div className="bg-[#1a1d24] p-4 border-b border-gray-800 flex justify-between items-center">
          <h3 className="text-white font-bold text-lg">
            {moduleToEdit ? 'Editar Módulo' : 'Novo Módulo de Mentoria'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Capa (474x1000)</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`aspect-[474/1000] rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition-colors bg-black relative overflow-hidden group
                ${!previewUrl ? 'hover:bg-[#1a1d24]' : ''}`}
            >
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-bold uppercase">Alterar Capa</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-4">
                  <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-gray-500 text-xs block">Clique para Upload</span>
                  <span className="text-gray-600 text-[10px] block mt-1">474 x 1000 px</span>
                </div>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange}
            />
          </div>

          <div className="flex-1 flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Título do Módulo</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Comece por Aqui"
                className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:outline-none"
              />
            </div>

            {/* Configuração de Bloqueio */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
               <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <Lock size={16} className={isLocked ? "text-red-500" : "text-gray-500"} />
                       <span className="text-xs font-bold text-gray-300 uppercase">Bloquear Módulo</span>
                   </div>
                   <div 
                       onClick={() => setIsLocked(!isLocked)}
                       className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isLocked ? 'bg-red-600' : 'bg-zinc-700'}`}
                   >
                       <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isLocked ? 'translate-x-5' : ''}`} />
                   </div>
               </div>

               {isLocked && (
                   <div className="pt-2 border-t border-zinc-800 animate-in slide-in-from-top-1">
                       <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Liberar Automaticamente em:</label>
                       <div className="relative">
                           <Calendar size={14} className="absolute left-3 top-2.5 text-gray-500" />
                           <input 
                               type="date"
                               value={releaseDate}
                               onChange={(e) => setReleaseDate(e.target.value)}
                               className="w-full bg-black border border-gray-700 rounded px-3 py-2 pl-9 text-xs text-white focus:border-red-500 focus:outline-none uppercase"
                           />
                       </div>
                       <p className="text-[9px] text-gray-600 mt-1">
                           * Se definido, o módulo será desbloqueado nesta data.
                       </p>
                   </div>
               )}
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
              <p className="text-yellow-500 text-xs">
                <strong>Nota:</strong> {moduleToEdit 
                    ? 'Ao salvar, as alterações serão aplicadas imediatamente.' 
                    : 'Este módulo aparecerá na seção selecionada.'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1d24] p-4 border-t border-gray-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm font-bold uppercase transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold uppercase rounded transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? 'Salvando...' : (moduleToEdit ? 'Salvar Alterações' : 'Criar Módulo')}
          </button>
        </div>
      </div>
    </div>
  );
}
