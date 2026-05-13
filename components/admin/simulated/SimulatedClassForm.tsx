import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { SimulatedClass } from '../../../services/simulatedService';
import { Category } from '../../../services/planService';

interface SimulatedClassFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<SimulatedClass, 'id' | 'createdAt'>, coverFile?: File) => Promise<void>;
  initialData?: SimulatedClass | null;
  categories: Category[];
  loading?: boolean;
}

const SimulatedClassForm: React.FC<SimulatedClassFormProps> = ({ 
  isOpen, onClose, onSave, initialData, categories, loading = false 
}) => {
  const [formData, setFormData] = useState({
    title: '',
    categoryId: '',
    subcategoryId: '',
    organization: '',
    buyLink: '',
    presentationVideoUrl: '',
    coverUrl: '' // URL existente
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          title: initialData.title,
          categoryId: initialData.categoryId,
          subcategoryId: initialData.subcategoryId,
          organization: initialData.organization,
          buyLink: initialData.buyLink,
          presentationVideoUrl: initialData.presentationVideoUrl || '',
          coverUrl: initialData.coverUrl
        });
        setPreviewUrl(initialData.coverUrl);
      } else {
        // Reset
        setFormData({
          title: '',
          categoryId: '',
          subcategoryId: '',
          organization: '',
          buyLink: '',
          presentationVideoUrl: '',
          coverUrl: ''
        });
        setPreviewUrl('');
      }
      setSelectedFile(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
        ...formData,
        // Se não houver arquivo novo, o service usará o coverUrl antigo se necessário
        // mas aqui passamos coverUrl como string caso não haja upload no service
    }, selectedFile || undefined);
  };

  // Subcategories logic
  const activeCategory = categories.find(c => c.id === formData.categoryId); // Note: Assuming planService categories use ID or Name consistently. Based on previous implementation, category select usually used Name, but here schema says categoryId.
  // Adapting based on PlanService which used Names for category/subcategory in schema, but Simulated schema asked for IDs.
  // Assuming we use names as IDs for simplicity or matching existing structure if possible. 
  // Let's assume we store the ID here but display Name.
  
  const subcategories = activeCategory ? activeCategory.subcategories : [];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">
            {initialData ? 'Editar Turma' : 'Nova Turma de Simulados'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          
          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Capa da Turma</label>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`group relative w-full h-40 border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all ${
                previewUrl ? 'border-zinc-800 hover:border-brand-red/50' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/50'
              }`}
            >
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest">
                      <Upload size={16} /> Trocar Imagem
                    </span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-brand-red/30 transition-colors">
                    <ImageIcon size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">Selecionar Capa</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Nome da Turma</label>
            <input 
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="EX: TURMA ELITE - POLÍCIA FEDERAL"
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red uppercase font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Categoria</label>
                <select 
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleChange}
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-red uppercase"
                >
                    <option value="">Selecione</option>
                    {categories.map(cat => (
                        // Usando ID se disponível, ou Name como fallback conforme arquitetura
                        <option key={cat.id} value={cat.id || cat.name}>{cat.name}</option>
                    ))}
                </select>
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subcategoria</label>
                <select 
                    name="subcategoryId"
                    value={formData.subcategoryId}
                    onChange={handleChange}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-red uppercase"
                >
                    <option value="">Selecione</option>
                    {subcategories.map((sub, idx) => (
                        <option key={idx} value={sub}>{sub}</option>
                    ))}
                </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Órgão / Instituição</label>
            <input 
                name="organization"
                value={formData.organization}
                onChange={handleChange}
                placeholder="EX: PF, PRF, PC-SP"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red uppercase font-bold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Link de Venda (Opcional)</label>
            <input 
                name="buyLink"
                value={formData.buyLink}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Vídeo de Apresentação (Panda Video - Opcional)</label>
            <input 
                type="url"
                name="presentationVideoUrl"
                value={formData.presentationVideoUrl}
                onChange={handleChange}
                placeholder="https://player-vz-...tv.pandavideo.com.br/embed/?v=..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red"
            />
          </div>

          <div className="pt-4">
            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-brand-red hover:bg-red-600 text-white font-black py-4 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-900/20"
            >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> 
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} /> Salvar Turma
                  </>
                )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SimulatedClassForm;