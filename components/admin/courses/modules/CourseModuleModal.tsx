import React, { useState, useEffect, useRef } from 'react';
import { CourseModule } from '../../../../types/course';
import { courseService } from '../../../../services/courseService';

interface CourseModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CourseModule>) => Promise<void>;
  initialData?: CourseModule | null;
}

export function CourseModuleModal({ isOpen, onClose, onSave, initialData }: CourseModuleModalProps) {
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [releaseDate, setReleaseDate] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setCoverUrl(initialData.coverUrl);
        setPreviewUrl(initialData.coverUrl);
        setIsLocked(initialData.isLocked);
        setReleaseDate(initialData.releaseDate || '');
      } else {
        // Reset
        setTitle('');
        setCoverUrl('');
        setPreviewUrl('');
        setSelectedFile(null);
        setIsLocked(false);
        setReleaseDate('');
      }
    }
  }, [isOpen, initialData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    if (!selectedFile && !coverUrl) {
      alert("Por favor, selecione uma capa.");
      return;
    }

    setLoading(true);
    try {
      let finalCoverUrl = coverUrl;
      
      // Upload da imagem se houver novo arquivo
      if (selectedFile) {
        finalCoverUrl = await courseService.uploadCover(selectedFile);
      }

      // CORREÇÃO CRÍTICA AQUI:
      // Firestore não aceita 'undefined'.
      // Se estiver bloqueado E tiver data, manda a data.
      // Se não, manda NULL (que remove o valor no banco ou deixa vazio).
      const finalReleaseDate = (isLocked && releaseDate) ? releaseDate : null;

      await onSave({
        title,
        coverUrl: finalCoverUrl,
        isLocked,
        releaseDate: finalReleaseDate
      });
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar módulo.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">
            {initialData ? 'Editar Módulo' : 'Novo Módulo'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome do Módulo</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none"
              required
            />
          </div>

          {/* Capa */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Capa do Módulo</label>
            <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                    relative w-full aspect-[474/200] rounded-lg border-2 border-dashed 
                    flex flex-col items-center justify-center cursor-pointer overflow-hidden group
                    ${previewUrl ? 'border-red-600/50' : 'border-gray-700 hover:border-gray-500 hover:bg-white/5'}
                `}
            >
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                {previewUrl ? (
                    <img src={previewUrl} alt="Capa" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                ) : (
                    <div className="text-center p-4">
                        <span className="text-gray-400 text-xs font-bold">ENVIAR IMAGEM</span>
                        <p className="text-gray-600 text-[10px]">474x1000px</p>
                    </div>
                )}
            </div>
          </div>

          {/* --- BLOQUEIO --- */}
          <div className="bg-black/40 border border-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-300">Bloquear módulo?</span>
                <button
                    type="button"
                    onClick={() => setIsLocked(!isLocked)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isLocked ? 'bg-red-600' : 'bg-gray-700'}`}
                >
                    <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${isLocked ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
            </div>

            {isLocked && (
                <div className="mt-4 animate-in slide-in-from-top-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Data de Liberação</label>
                    <input 
                        type="date" 
                        value={releaseDate}
                        onChange={(e) => setReleaseDate(e.target.value)}
                        className="w-full bg-[#121418] border border-gray-700 rounded p-2 text-white focus:border-red-600 outline-none"
                    />
                </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white font-bold uppercase text-xs">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs rounded transition-colors disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar Módulo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}