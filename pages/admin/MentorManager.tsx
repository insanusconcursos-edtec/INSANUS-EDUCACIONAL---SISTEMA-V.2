import React, { useEffect, useState } from 'react';
import { 
  Plus, Trash2, User, XCircle, CheckCircle2, Loader2, Pencil, Camera, Upload
} from 'lucide-react';
import { 
  subscribeToMentors, 
  createMentor, 
  updateMentor, 
  deleteMentor, 
  uploadMentorPhoto 
} from '../../services/mentorService';
import { Mentor } from '../../types/chat';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

const CreateMentorModal = ({ 
  isOpen, 
  onClose, 
  onSave,
  editingMentor = null
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (name: string, photoUrl: string) => Promise<void>; 
  editingMentor?: Mentor | null;
}) => {
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingMentor) {
      setName(editingMentor.name);
      setPhotoUrl(editingMentor.photoUrl);
    } else {
      setName('');
      setPhotoUrl('');
    }
  }, [editingMentor, isOpen]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadMentorPhoto(file);
      setPhotoUrl(url);
    } catch (error) {
      console.error(error);
      alert("Erro ao fazer upload da foto.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !photoUrl) return alert("Preencha o nome e faça upload da foto.");

    setLoading(true);
    try {
      await onSave(name, photoUrl);
      onClose();
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-900 bg-zinc-900/50 flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">
            {editingMentor ? 'Editar Mentor' : 'Novo Mentor'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><XCircle size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden">
                {photoUrl ? (
                  <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Camera size={32} className="text-zinc-700" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-brand-red text-white rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase">Foto do Mentor</span>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase">Nome do Mentor</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-3 text-zinc-600" />
              <input 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="EX: MENTOR BRUNO"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none font-bold uppercase"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || uploading}
            className="w-full bg-brand-red hover:bg-red-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={16} />}
            {editingMentor ? 'Salvar Alterações' : 'Criar Mentor'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface MentorManagerProps {
  hideHeader?: boolean;
}

const MentorManager: React.FC<MentorManagerProps> = ({ hideHeader = false }) => {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMentor, setEditingMentor] = useState<Mentor | null>(null);
  const [mentorToDelete, setMentorToDelete] = useState<Mentor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToMentors((data) => {
      setMentors(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (name: string, photoUrl: string) => {
    if (editingMentor) {
      await updateMentor(editingMentor.id, { name, photoUrl });
    } else {
      await createMentor(name, photoUrl);
    }
  };

  const handleDelete = async () => {
    if (!mentorToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMentor(mentorToDelete.id);
      setMentors(prev => prev.filter(m => m.id !== mentorToDelete.id));
      setMentorToDelete(null);
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 ${hideHeader ? '' : ''}`}>
      {!hideHeader && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Gestão de Mentores</h2>
            <div className="w-12 h-1 bg-brand-red shadow-[0_0_15px_rgba(255,0,0,0.5)]"></div>
          </div>
          
          <button 
            onClick={() => { setEditingMentor(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-8 py-3 bg-zinc-100 hover:bg-white text-black rounded-lg text-[10px] font-black uppercase shadow-lg shadow-white/10 hover:scale-[1.02] transition-all tracking-widest"
          >
            <Plus size={14} strokeWidth={3} />
            Novo Mentor
          </button>
        </div>
      )}

      {hideHeader && (
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => { setEditingMentor(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-8 py-3 bg-zinc-100 hover:bg-white text-black rounded-lg text-[10px] font-black uppercase shadow-lg shadow-white/10 hover:scale-[1.02] transition-all tracking-widest"
          >
            <Plus size={14} strokeWidth={3} />
            Novo Mentor
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-20">
            <Loader2 className="animate-spin text-brand-red" size={32} />
          </div>
        ) : mentors.length === 0 ? (
          <div className="col-span-full text-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl">
            <p className="text-zinc-500 text-xs font-bold uppercase">Nenhum mentor encontrado</p>
          </div>
        ) : (
          mentors.map(mentor => (
            <div key={mentor.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center gap-4 group hover:border-zinc-700 transition-all shadow-sm hover:shadow-xl">
              <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
                <img src={mentor.photoUrl} alt={mentor.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-black text-white uppercase tracking-tight">{mentor.name}</h3>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button 
                  onClick={() => { setEditingMentor(mentor); setIsModalOpen(true); }}
                  className="p-2 text-zinc-600 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button 
                  onClick={() => setMentorToDelete(mentor)}
                  className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-900/10 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <CreateMentorModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editingMentor={editingMentor}
      />

      <ConfirmationModal 
        isOpen={!!mentorToDelete}
        onClose={() => setMentorToDelete(null)}
        onConfirm={handleDelete}
        title="Excluir Mentor"
        message={`Tem certeza que deseja remover ${mentorToDelete?.name}?`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default MentorManager;
