import React, { useState, useEffect, useRef } from 'react';
import { courseService } from '../../../../../services/courseService';

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, coverUrl: string, type: 'video' | 'pdf', groupId?: string | null) => Promise<void>;
  initialTitle?: string;
  initialCover?: string;
  initialType?: 'video' | 'pdf';
  initialGroupId?: string | null;
  groups?: CourseGroup[];
}

export function LessonModal({ isOpen, onClose, onSave, initialTitle, initialCover, initialType, initialGroupId, groups = [] }: LessonModalProps) {
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [type, setType] = useState<'video' | 'pdf'>('video');
  const [groupId, setGroupId] = useState<string | null>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle || '');
      setCoverUrl(initialCover || '');
      setPreviewUrl(initialCover || '');
      setType(initialType || 'video');
      setGroupId(initialGroupId || null);
      setSelectedFile(null);
    }
  }, [isOpen, initialTitle, initialCover, initialType, initialGroupId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    
    let finalUrl = coverUrl;
    if (selectedFile) {
        try {
            finalUrl = await courseService.uploadCover(selectedFile);
        } catch {
            alert("Erro no upload da capa");
            setLoading(false);
            return;
        }
    }

    await onSave(title, finalUrl, type, groupId);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-md shadow-2xl">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-white font-bold">{initialTitle ? 'Editar Aula' : 'Nova Aula'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Título da Aula</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none"
              required
            />
          </div>

          {/* Seleção de Grupo */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Vincular a um Grupo (Título)</label>
            <select 
              value={groupId || ''}
              onChange={e => setGroupId(e.target.value || null)}
              className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none text-xs"
            >
              <option value="">Nenhum Grupo (Raiz)</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.title}</option>
              ))}
            </select>
          </div>

          {/* --- SELETOR DE TIPO DE AULA (NOVO) --- */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Identificação Visual (Tipo)</label>
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => setType('video')}
                    className={`p-3 rounded border flex items-center justify-center gap-2 transition-all ${type === 'video' ? 'bg-red-600/20 border-red-600 text-white' : 'bg-black border-gray-800 text-gray-500 hover:border-gray-600'}`}
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                    <span className="text-xs font-bold uppercase">Vídeo Aula</span>
                </button>
                <button
                    type="button"
                    onClick={() => setType('pdf')}
                    className={`p-3 rounded border flex items-center justify-center gap-2 transition-all ${type === 'pdf' ? 'bg-yellow-600/20 border-yellow-600 text-white' : 'bg-black border-gray-800 text-gray-500 hover:border-gray-600'}`}
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                    <span className="text-xs font-bold uppercase">Material PDF</span>
                </button>
            </div>
          </div>

          {/* Upload de Capa */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Capa da Aula (Horizontal 341x194)</label>
            <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                    relative w-full aspect-[341/194] rounded-lg border-2 border-dashed 
                    flex flex-col items-center justify-center cursor-pointer overflow-hidden group transition-all
                    ${previewUrl ? 'border-red-600/50' : 'border-gray-700 hover:border-gray-500 hover:bg-white/5'}
                `}
            >
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                {previewUrl ? (
                    <img src={previewUrl} alt="Capa" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                ) : (
                    <div className="text-center p-4">
                        <span className="text-gray-400 text-xs font-bold">ENVIAR IMAGEM</span>
                        <p className="text-gray-600 text-[10px]">Opcional</p>
                    </div>
                )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white font-bold text-xs uppercase">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase rounded disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}