
import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { courseService } from '../../../services/courseService';
import { getCategories, Category } from '../../../services/planService';
import { OnlineCourse, CourseFormData, ContestStatus, CONTEST_STATUS_LABELS } from '../../../types/course';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CourseFormData, bannerDesktopFile?: File, bannerMobileFile?: File) => Promise<void>;
  initialData?: OnlineCourse | null;
}

export function CourseModal({ isOpen, onClose, onSave, initialData }: CourseModalProps) {
  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    description: '',
    coverUrl: '',
    categoryId: '',
    subcategoryId: '',
    organization: '',
    contestStatus: 'SEM_PREVISAO',
    examBoard: '',
    examDate: '',
    type: 'REGULAR',
    welcomeButtonTitle: '',
    welcomeVideoUrl: ''
  });
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados para Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para Banners (Netflix Style)
  const [bannerDesktopFile, setBannerDesktopFile] = useState<File | null>(null);
  const [bannerMobileFile, setBannerMobileFile] = useState<File | null>(null);
  const [bannerDesktopPreview, setBannerDesktopPreview] = useState<string>('');
  const [bannerMobilePreview, setBannerMobilePreview] = useState<string>('');

  // Carregar categorias
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (error) {
        console.error("Erro ao carregar categorias", error);
      }
    };
    if (isOpen) loadCategories();
  }, [isOpen]);

  // Preencher dados na edição
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title,
        description: initialData.description || '',
        coverUrl: initialData.coverUrl,
        categoryId: initialData.categoryId,
        subcategoryId: initialData.subcategoryId || '',
        organization: initialData.organization || '',
        contestStatus: initialData.contestStatus || 'SEM_PREVISAO',
        examBoard: initialData.examBoard || '',
        examDate: initialData.examDate || '',
        type: initialData.type || 'REGULAR',
        bannerUrlDesktop: initialData.bannerUrlDesktop,
        bannerUrlMobile: initialData.bannerUrlMobile,
        welcomeButtonTitle: initialData.welcomeButtonTitle || '',
        welcomeVideoUrl: initialData.welcomeVideoUrl || ''
      });
      setPreviewUrl(initialData.coverUrl); // Mostra a capa atual
      setBannerDesktopPreview(initialData.bannerUrlDesktop || '');
      setBannerMobilePreview(initialData.bannerUrlMobile || '');
    } else {
      // Reset
      setFormData({ 
          title: '', 
          description: '',
          coverUrl: '', 
          categoryId: '', 
          subcategoryId: '', 
          organization: '',
          contestStatus: 'SEM_PREVISAO',
          examBoard: '',
          examDate: '',
          type: 'REGULAR',
          welcomeButtonTitle: '',
          welcomeVideoUrl: ''
      });
      setPreviewUrl('');
      setSelectedFile(null);
      setBannerDesktopPreview('');
      setBannerMobilePreview('');
    }
    // Reset banner files on open/change
    setBannerDesktopFile(null);
    setBannerMobileFile(null);
  }, [initialData, isOpen]);

  // Handler de Seleção de Arquivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Cria URL temporária para preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleBannerDesktopSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBannerDesktopFile(file);
      setBannerDesktopPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerMobileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBannerMobileFile(file);
      setBannerMobilePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação: Precisa ter capa (ou uma nova selecionada, ou uma já existente na URL)
    if (!formData.title || !formData.categoryId || (!selectedFile && !formData.coverUrl)) {
      alert("Preencha os campos obrigatórios e adicione uma capa.");
      return;
    }
    
    setLoading(true);
    try {
      let finalCoverUrl = formData.coverUrl;

      // Se houver novo arquivo, faz o upload primeiro
      if (selectedFile) {
        finalCoverUrl = await courseService.uploadCover(selectedFile);
      }

      // Prepara objeto final (limpando campos condicionais)
      const finalData = { ...formData };
      
      if (finalData.contestStatus !== 'BANCA_CONTRATADA') {
          delete finalData.examBoard;
      }
      if (finalData.contestStatus !== 'EDITAL_PUBLICADO') {
          delete finalData.examDate;
      }

      // Salva os dados do curso com a URL da imagem (nova ou antiga)
      // Passa os arquivos de banner para o componente pai (AdminCoursesTab -> courseService)
      await onSave({
        ...finalData,
        coverUrl: finalCoverUrl
      }, bannerDesktopFile || undefined, bannerMobileFile || undefined);
      
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar curso");
    } finally {
      setLoading(false);
    }
  };

  // Helper para subcategorias
  const activeCategory = categories.find(c => c.id === formData.categoryId);
  const currentSubcategories = activeCategory ? activeCategory.subcategories : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center shrink-0 bg-zinc-900/50">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {initialData ? 'Editar Curso' : 'Novo Curso Online'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form com Scroll se necessário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome do Curso */}
            <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Nome do Curso <span className="text-red-500">*</span></label>
                <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-brand-red outline-none font-bold uppercase transition-colors"
                placeholder="Ex: Curso de Direito Penal Completo"
                required
                />
            </div>
            
            {/* Categorias */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Categoria <span className="text-red-500">*</span></label>
              <select 
                value={formData.categoryId}
                onChange={e => setFormData({...formData, categoryId: e.target.value, subcategoryId: ''})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-brand-red outline-none appearance-none cursor-pointer uppercase font-bold"
                required
              >
                <option value="">Selecione...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Subcategoria</label>
              <select 
                value={formData.subcategoryId}
                onChange={e => setFormData({...formData, subcategoryId: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-brand-red outline-none appearance-none cursor-pointer uppercase"
                disabled={currentSubcategories.length === 0}
              >
                <option value="">{currentSubcategories.length === 0 ? 'Sem opções' : 'Selecione...'}</option>
                {currentSubcategories.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            
            {/* Organização e Status */}
            <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Órgão (Opcional)</label>
                <input 
                type="text" 
                value={formData.organization}
                onChange={e => setFormData({...formData, organization: e.target.value})}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-brand-red outline-none font-bold uppercase transition-colors placeholder-zinc-700"
                placeholder="Ex: Polícia Federal"
                />
            </div>

            <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Status do Concurso</label>
                <select 
                    value={formData.contestStatus}
                    onChange={e => setFormData({...formData, contestStatus: e.target.value as ContestStatus})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-brand-red outline-none cursor-pointer uppercase"
                >
                    {Object.entries(CONTEST_STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Tipo de Curso <span className="text-red-500">*</span></label>
                <select 
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as 'REGULAR' | 'ISOLADO'})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-brand-red outline-none cursor-pointer uppercase font-bold"
                    required
                >
                    <option value="REGULAR">Curso Regular</option>
                    <option value="ISOLADO">Curso Isolado</option>
                </select>
            </div>
          </div>

          {/* CAMPOS CONDICIONAIS DE STATUS */}
          <div className="grid grid-cols-1 gap-4 bg-[#1a1d24] p-4 rounded-lg border border-gray-800 transition-all">
             {/* Condicional: Banca Contratada */}
             {formData.contestStatus === 'BANCA_CONTRATADA' && (
                <div className="animate-in slide-in-from-top-2 fade-in">
                    <label className="block text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-1">Nome da Banca Examinadora</label>
                    <input 
                        type="text" 
                        value={formData.examBoard || ''}
                        onChange={e => setFormData({...formData, examBoard: e.target.value})}
                        className="w-full bg-black border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-yellow-500 outline-none uppercase font-bold"
                        placeholder="Ex: CEBRASPE, FGV, VUNESP..."
                        autoFocus
                    />
                </div>
             )}

             {/* Condicional: Edital Publicado */}
             {formData.contestStatus === 'EDITAL_PUBLICADO' && (
                <div className="animate-in slide-in-from-top-2 fade-in">
                    <label className="block text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Data da Prova</label>
                    <input 
                        type="date" 
                        value={formData.examDate || ''}
                        onChange={e => setFormData({...formData, examDate: e.target.value})}
                        className="w-full bg-black border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none uppercase font-bold"
                        autoFocus
                    />
                    <p className="text-[9px] text-gray-500 mt-1 pl-1">
                        * Isso ativará o contador regressivo na área do aluno.
                    </p>
                </div>
             )}

             {/* Outros status apenas informativos */}
             {['SEM_PREVISAO', 'COMISSAO_FORMADA', 'AUTORIZADO'].includes(formData.contestStatus || '') && (
                 <div className="text-center text-gray-500 text-xs italic py-2">
                    O status &quot;{CONTEST_STATUS_LABELS[formData.contestStatus as ContestStatus]}&quot; será exibido como um aviso simples para o aluno.
                 </div>
             )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Descrição do Curso</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-brand-red outline-none h-24 resize-none transition-colors"
              placeholder="Descreva o conteúdo do curso..."
            />
          </div>

          {/* VÍDEO DE BOAS-VINDAS */}
          <div className="bg-[#1a1d24] p-4 rounded-lg border border-gray-800 space-y-4">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Vídeo de Boas-Vindas (Opcional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Título do Botão</label>
                <input 
                  type="text" 
                  value={formData.welcomeButtonTitle}
                  onChange={e => setFormData({...formData, welcomeButtonTitle: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-brand-red outline-none font-bold uppercase"
                  placeholder="Ex: BOAS VINDAS"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">URL do Vídeo (YouTube/Panda)</label>
                <input 
                  type="text" 
                  value={formData.welcomeVideoUrl}
                  onChange={e => setFormData({...formData, welcomeVideoUrl: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-brand-red outline-none"
                  placeholder="Link do vídeo..."
                />
              </div>
            </div>
          </div>

          {/* --- UPLOAD DE CAPA --- */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Capa do Curso <span className="text-red-500">*</span></label>
            
            {/* Área de Visualização/Upload */}
            <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                    relative w-full aspect-[474/200] rounded-xl border-2 border-dashed 
                    flex flex-col items-center justify-center cursor-pointer overflow-hidden group transition-all
                    ${previewUrl ? 'border-brand-red/50' : 'border-zinc-700 hover:border-zinc-500 hover:bg-white/5'}
                `}
            >
                {/* Input Invisível */}
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                />

                {/* Preview da Imagem */}
                {previewUrl ? (
                    <>
                        <img src={previewUrl} alt="Capa" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="flex items-center gap-2 bg-black/80 text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide">
                                <Upload size={14} /> Trocar Imagem
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="text-center p-4 flex flex-col items-center gap-2">
                        <div className="p-3 bg-zinc-900 rounded-full text-zinc-500 group-hover:text-zinc-300 transition-colors">
                            <ImageIcon size={24} />
                        </div>
                        <div>
                            <p className="text-zinc-400 text-xs font-bold uppercase">Clique para enviar imagem</p>
                            <p className="text-zinc-600 text-[10px] mt-0.5">Recomendado: 474x1000px (Vertical)</p>
                        </div>
                    </div>
                )}
            </div>
          </div>

          {/* NOVA SEÇÃO: BANNERS (Estilo Netflix) */}
          <div className="border-t border-gray-800 pt-4 mt-2">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Personalização Visual (Banners)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Banner Desktop */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Banner Horizontal (PC/TV)</label>
                    <div 
                      onClick={() => document.getElementById('banner-desktop-input')?.click()}
                      className="relative aspect-video rounded-lg border border-zinc-800 bg-black overflow-hidden cursor-pointer group hover:border-zinc-600 transition-all flex items-center justify-center"
                    >
                      {bannerDesktopPreview ? (
                        <img src={bannerDesktopPreview} alt="Banner Desktop" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                          <p className="text-[10px] text-zinc-600 font-bold uppercase">Clique para enviar</p>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-black/80 text-white px-3 py-1 rounded text-[10px] font-bold uppercase">Trocar Banner</span>
                      </div>
                    </div>
                    <input 
                        id="banner-desktop-input"
                        type="file" 
                        accept="image/*"
                        onChange={handleBannerDesktopSelect}
                        className="hidden"
                    />
                    <p className="text-[10px] text-gray-600">Proporção ideal: 1920x1080px (16:9)</p>
                </div>

                {/* Upload Banner Mobile */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Banner Vertical (Celular)</label>
                    <div 
                      onClick={() => document.getElementById('banner-mobile-input')?.click()}
                      className="relative aspect-[4/5] h-48 rounded-lg border border-zinc-800 bg-black overflow-hidden cursor-pointer group hover:border-zinc-600 transition-all flex items-center justify-center mx-auto"
                    >
                      {bannerMobilePreview ? (
                        <img src={bannerMobilePreview} alt="Banner Mobile" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                          <p className="text-[10px] text-zinc-600 font-bold uppercase">Clique para enviar</p>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-black/80 text-white px-3 py-1 rounded text-[10px] font-bold uppercase">Trocar Banner</span>
                      </div>
                    </div>
                    <input 
                        id="banner-mobile-input"
                        type="file" 
                        accept="image/*"
                        onChange={handleBannerMobileSelect}
                        className="hidden"
                    />
                    <p className="text-[10px] text-gray-600">Proporção ideal: 1080x1350px (4:5)</p>
                </div>
            </div>
          </div>

        </form>
        
        {/* Footer */}
        <div className="p-6 pt-4 border-t border-zinc-900 bg-zinc-900/30 flex justify-end gap-3 shrink-0">
            <button 
                type="button" 
                onClick={onClose} 
                className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold uppercase text-xs tracking-widest transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={loading}
              className="px-8 py-3 bg-brand-red hover:bg-red-600 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-red-900/20 flex items-center gap-2"
            >
              {loading ? (
                <>
                    <Loader2 size={16} className="animate-spin" />
                    Salvando...
                </>
              ) : 'Salvar Curso'}
            </button>
        </div>

      </div>
    </div>
  );
}
