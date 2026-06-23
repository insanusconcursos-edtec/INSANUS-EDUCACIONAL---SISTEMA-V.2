import React, { useState, useEffect } from 'react';
import { CourseGroup } from '../../../../../types/course';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, publishDate: string | null, groupId?: string | null, parentId?: string | null, isRecording?: boolean) => Promise<void>;
  initialTitle?: string;
  initialPublishDate?: string | null;
  initialGroupId?: string | null;
  initialParentId?: string | null;
  initialIsRecording?: boolean;
  groups?: CourseGroup[];
}

export function FolderModal({ isOpen, onClose, onSave, initialTitle, initialPublishDate, initialGroupId, initialParentId, initialIsRecording, groups = [] }: FolderModalProps) {
  const [title, setTitle] = useState('');
  const [publishDate, setPublishDate] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle || '');
      setPublishDate(initialPublishDate || null);
      setGroupId(initialGroupId || null);
      setParentId(initialParentId || null);
      setIsRecording(initialIsRecording || false);
    }
  }, [isOpen, initialTitle, initialPublishDate, initialGroupId, initialParentId, initialIsRecording]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onSave(title, publishDate, groupId, parentId, isRecording);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-white font-bold">{initialTitle ? 'Editar Pasta' : 'Nova Pasta'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Título da Pasta</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none"
              autoFocus
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

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Data de Liberação (Opcional)</label>
            <input 
              type="datetime-local" 
              value={publishDate || ''}
              onChange={e => setPublishDate(e.target.value || null)}
              className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none"
            />
            <p className="text-[10px] text-gray-500 mt-1">Se vazio, a pasta será liberada imediatamente.</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg group">
            <div className="flex flex-col">
              <label className="text-xs font-bold text-blue-400 uppercase">Em Gravação</label>
              <span className="text-[10px] text-zinc-500 font-medium">Bloqueia o acesso de alunos</span>
            </div>
            <button
              type="button"
              onClick={() => setIsRecording(!isRecording)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isRecording ? 'bg-blue-600' : 'bg-zinc-800'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isRecording ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white font-bold text-xs uppercase">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase rounded disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}