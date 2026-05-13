import React, { useRef, useEffect, useState } from 'react';
import { Upload, Video, FileText, Type, X, Filter, Layers, Building2, Image as ImageIcon, Smartphone, Monitor } from 'lucide-react';
import { Class } from '../../../../../types/class';
import { classMetadataService, MetadataItem } from '../../../../../services/classMetadataService';
import { getSimulatedClasses, SimulatedClass } from '../../../../../services/simulatedService';

interface ClassIdentityFormProps {
  data: Partial<Class>;
  onChange: (updates: Partial<Class>) => void;
  onBannerDesktopChange?: (file: File) => void;
  onBannerTabletChange?: (file: File) => void;
  onBannerMobileChange?: (file: File) => void;
}

export const ClassIdentityForm: React.FC<ClassIdentityFormProps> = ({ 
  data, 
  onChange,
  onBannerDesktopChange,
  onBannerTabletChange,
  onBannerMobileChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerDesktopRef = useRef<HTMLInputElement>(null);
  const bannerTabletRef = useRef<HTMLInputElement>(null);
  const bannerMobileRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<MetadataItem[]>([]);
  const [subcategories, setSubcategories] = useState<MetadataItem[]>([]);
  const [organizations, setOrganizations] = useState<MetadataItem[]>([]);
  const [simulatedClasses, setSimulatedClasses] = useState<SimulatedClass[]>([]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [cats, subs, orgs, simClasses] = await Promise.all([
          classMetadataService.getCategories(),
          classMetadataService.getSubcategories(),
          classMetadataService.getOrganizations(),
          getSimulatedClasses()
        ]);
        setCategories(cats);
        setSubcategories(subs);
        setOrganizations(orgs);
        setSimulatedClasses(simClasses);
      } catch (error) {
        console.error("Error fetching metadata:", error);
      }
    };
    fetchMetadata();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({ coverImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerDesktopUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (onBannerDesktopChange) onBannerDesktopChange(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({ bannerUrlDesktop: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerMobileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (onBannerMobileChange) onBannerMobileChange(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({ bannerUrlMobile: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerTabletUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (onBannerTabletChange) onBannerTabletChange(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({ bannerUrlTablet: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ coverImage: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveBannerDesktop = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ bannerUrlDesktop: '' });
    if (onBannerDesktopChange) onBannerDesktopChange(undefined as any);
    if (bannerDesktopRef.current) bannerDesktopRef.current.value = '';
  };

  const handleRemoveBannerTablet = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ bannerUrlTablet: '' });
    if (onBannerTabletChange) onBannerTabletChange(undefined as any);
    if (bannerTabletRef.current) bannerTabletRef.current.value = '';
  };

  const handleRemoveBannerMobile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ bannerUrlMobile: '' });
    if (onBannerMobileChange) onBannerMobileChange(undefined as any);
    if (bannerMobileRef.current) bannerMobileRef.current.value = '';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800">
        <FileText className="w-5 h-5 text-brand-red" />
        <h3 className="text-lg font-bold text-white uppercase">Identidade da Turma</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nome da Turma */}
        <div className="col-span-2">
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Nome da Turma *</label>
          <input
            type="text"
            value={data.name || ''}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors placeholder-zinc-600"
            placeholder="Ex: Turma Elite PC-AC 2026"
          />
        </div>

        {/* Capa da Turma */}
        <div className="col-span-2">
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Imagem de Capa (474x1000)</label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer group overflow-hidden ${
              data.coverImage 
                ? 'border-brand-red/50 bg-zinc-900' 
                : 'border-zinc-700 text-zinc-500 hover:border-brand-red/50 hover:bg-zinc-800/50'
            }`}
            style={{ minHeight: '200px' }}
          >
            {data.coverImage ? (
              <>
                <img 
                  src={data.coverImage} 
                  alt="Capa da Turma" 
                  className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity"
                />
                <div className="relative z-10 flex flex-col items-center">
                  <button 
                    onClick={handleRemoveImage}
                    className="mb-2 p-2 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Alterar Imagem</span>
                </div>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 mb-2 group-hover:text-brand-red transition-colors" />
                <span className="text-xs font-medium">Clique para fazer upload ou arraste a imagem</span>
                <span className="text-[10px] mt-1 text-zinc-600">Formatos: JPG, PNG (Max 2MB)</span>
              </>
            )}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
            />
          </div>
        </div>

        {/* Banners Section */}
        <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-zinc-800">
           {/* Banner Desktop */}
           <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Banner Desktop (Horizontal)
            </label>
            <div 
              onClick={() => bannerDesktopRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all cursor-pointer group overflow-hidden h-40 ${
                data.bannerUrlDesktop 
                  ? 'border-brand-red/50 bg-zinc-900' 
                  : 'border-zinc-700 text-zinc-500 hover:border-brand-red/50 hover:bg-zinc-800/50'
              }`}
            >
              {data.bannerUrlDesktop ? (
                <>
                  <img 
                    src={data.bannerUrlDesktop} 
                    alt="Banner Desktop" 
                    className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity"
                  />
                  <div className="relative z-10 flex flex-col items-center">
                    <button 
                      onClick={handleRemoveBannerDesktop}
                      className="mb-1 p-1.5 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Alterar</span>
                  </div>
                </>
              ) : (
                <>
                  <ImageIcon className="w-6 h-6 mb-2 group-hover:text-brand-red transition-colors" />
                  <span className="text-[10px] font-medium text-center">Upload Banner Horizontal</span>
                  <span className="text-[9px] text-zinc-600 mt-1 uppercase font-bold">Recomendado: 1920x1080 (16:9)</span>
                </>
              )}
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={bannerDesktopRef} 
                onChange={handleBannerDesktopUpload} 
              />
            </div>
          </div>

          {/* Banner Tablet */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Banner Tablet (Horizontal)
            </label>
            <div 
              onClick={() => bannerTabletRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all cursor-pointer group overflow-hidden h-40 ${
                data.bannerUrlTablet 
                  ? 'border-brand-red/50 bg-zinc-900' 
                  : 'border-zinc-700 text-zinc-500 hover:border-brand-red/50 hover:bg-zinc-800/50'
              }`}
            >
              {data.bannerUrlTablet ? (
                <>
                  <img 
                    src={data.bannerUrlTablet} 
                    alt="Banner Tablet" 
                    className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity"
                  />
                  <div className="relative z-10 flex flex-col items-center">
                    <button 
                      onClick={handleRemoveBannerTablet}
                      className="mb-1 p-1.5 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Alterar</span>
                  </div>
                </>
              ) : (
                <>
                  <ImageIcon className="w-6 h-6 mb-2 group-hover:text-brand-red transition-colors" />
                  <span className="text-[10px] font-medium text-center">Upload Banner Tablet</span>
                  <span className="text-[9px] text-zinc-600 mt-1 uppercase font-bold">Recomendado: 1920x1080 (16:9)</span>
                </>
              )}
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={bannerTabletRef} 
                onChange={handleBannerTabletUpload} 
              />
            </div>
          </div>

          {/* Banner Mobile */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Banner Mobile (Vertical)
            </label>
            <div 
              onClick={() => bannerMobileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all cursor-pointer group overflow-hidden h-40 ${
                data.bannerUrlMobile 
                  ? 'border-brand-red/50 bg-zinc-900' 
                  : 'border-zinc-700 text-zinc-500 hover:border-brand-red/50 hover:bg-zinc-800/50'
              }`}
            >
              {data.bannerUrlMobile ? (
                <>
                  <img 
                    src={data.bannerUrlMobile} 
                    alt="Banner Mobile" 
                    className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity"
                  />
                  <div className="relative z-10 flex flex-col items-center">
                    <button 
                      onClick={handleRemoveBannerMobile}
                      className="mb-1 p-1.5 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Alterar</span>
                  </div>
                </>
              ) : (
                <>
                  <ImageIcon className="w-6 h-6 mb-2 group-hover:text-brand-red transition-colors" />
                  <span className="text-[10px] font-medium text-center">Upload Banner Vertical</span>
                  <span className="text-[9px] text-zinc-600 mt-1 uppercase font-bold">Recomendado: 1080x1350 (4:5)</span>
                </>
              )}
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={bannerMobileRef} 
                onChange={handleBannerMobileUpload} 
              />
            </div>
          </div>
        </div>

        {/* Tipo da Turma */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Tipo da Turma *</label>
          <div className="grid grid-cols-2 gap-2 bg-zinc-800 p-1 rounded-lg border border-zinc-700">
            <button
              type="button"
              onClick={() => onChange({ type: 'PRE_EDITAL' })}
              className={`py-2 px-4 rounded-md text-xs font-bold uppercase transition-all ${
                data.type === 'PRE_EDITAL'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              Pré-Edital
            </button>
            <button
              type="button"
              onClick={() => onChange({ type: 'POS_EDITAL' })}
              className={`py-2 px-4 rounded-md text-xs font-bold uppercase transition-all ${
                data.type === 'POS_EDITAL'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              Pós-Edital
            </button>
          </div>
        </div>

        {/* Modalidade */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Modalidade *</label>
          <div className="grid grid-cols-2 gap-2 bg-zinc-800 p-1 rounded-lg border border-zinc-700">
            <button
              type="button"
              onClick={() => onChange({ modality: 'REGULAR' })}
              className={`py-2 px-4 rounded-md text-xs font-bold uppercase transition-all ${
                data.modality === 'REGULAR'
                  ? 'bg-zinc-600 text-white shadow-lg'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              Regular
            </button>
            <button
              type="button"
              onClick={() => onChange({ modality: 'INTENSIVO' })}
              className={`py-2 px-4 rounded-md text-xs font-bold uppercase transition-all ${
                data.modality === 'INTENSIVO'
                  ? 'bg-brand-red text-white shadow-lg shadow-red-900/20'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              Intensivo
            </button>
          </div>
        </div>

        {/* Status do Concurso */}
        <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-800 pt-6 mt-2">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Status do Concurso</label>
            <select 
              value={data.concursoStatus || 'SEM_PREVISAO'} 
              onChange={(e) => {
                const newStatus = e.target.value as any;
                const updates: Partial<Class> = { concursoStatus: newStatus };
                
                // Limpar dados residuais
                if (newStatus !== 'BANCA_CONTRATADA') {
                  updates.bancaName = '';
                }
                if (newStatus !== 'EDITAL_ABERTO') {
                  updates.examDate = '';
                  updates.examShift = undefined;
                }
                
                onChange(updates);
              }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red transition-colors appearance-none"
            >
              <option value="SEM_PREVISAO">Sem Previsão</option>
              <option value="COMISSAO_FORMADA">Comissão Formada</option>
              <option value="AUTORIZADO">Autorizado</option>
              <option value="BANCA_CONTRATADA">Banca Contratada</option>
              <option value="EDITAL_ABERTO">Edital Aberto</option>
              <option value="CONCURSO_SUSPENSO">Concurso Suspenso</option>
            </select>
          </div>

          {data.concursoStatus === 'BANCA_CONTRATADA' && (
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Nome da Banca</label>
              <input 
                type="text" 
                placeholder="Ex: CEBRASPE, FGV..."
                value={data.bancaName || ''}
                onChange={(e) => onChange({ bancaName: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red transition-colors placeholder-zinc-600"
              />
            </div>
          )}

          {data.concursoStatus === 'EDITAL_ABERTO' && (
            <div className="col-span-2 md:col-span-1 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Data da Prova</label>
                <input 
                  type="date" 
                  value={data.examDate || ''}
                  onChange={(e) => onChange({ examDate: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Turno da Prova</label>
                <select 
                  value={data.examShift || 'MANHÃ'}
                  onChange={(e) => onChange({ examShift: e.target.value as any })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red transition-colors appearance-none"
                >
                  <option value="MANHÃ">Manhã</option>
                  <option value="TARDE">Tarde</option>
                  <option value="NOITE">Noite</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Classificação da Turma */}
        <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-zinc-800 pt-6 mt-2">
          {/* Categoria */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Categoria
            </label>
            <select
              value={data.category || ''}
              onChange={(e) => onChange({ category: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red transition-colors appearance-none"
            >
              <option value="">Selecione...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Subcategoria */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1">
              <Layers className="w-3 h-3" /> Subcategoria
            </label>
            <select
              value={data.subcategory || ''}
              onChange={(e) => onChange({ subcategory: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red transition-colors appearance-none"
            >
              <option value="">Selecione...</option>
              {subcategories.map((sub) => (
                <option key={sub.id} value={sub.name}>{sub.name}</option>
              ))}
            </select>
          </div>

          {/* Órgão */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Órgão
            </label>
            <select
              value={data.organization || ''}
              onChange={(e) => onChange({ organization: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red transition-colors appearance-none"
            >
              <option value="">Selecione...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.name}>{org.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Gravações */}
        <div className="col-span-2">
          <div 
            onClick={() => onChange({ hasRecordings: !data.hasRecordings })}
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
              data.hasRecordings 
                ? 'bg-brand-red/10 border-brand-red/30' 
                : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${data.hasRecordings ? 'bg-brand-red text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                <Video className="w-5 h-5" />
              </div>
              <div>
                <span className={`block text-sm font-bold uppercase ${data.hasRecordings ? 'text-white' : 'text-zinc-300'}`}>
                  Gravações da Sala de Aula
                </span>
                <span className="text-xs text-zinc-500">
                  Habilita pagamento de comissão extra para professores
                </span>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${data.hasRecordings ? 'bg-brand-red' : 'bg-zinc-600'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${data.hasRecordings ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
          </div>
        </div>

        {/* Cruzamento de Produtos */}
        <div className="col-span-2 border-t border-zinc-800 pt-6">
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-yellow-500" />
            Turma de Simulados Vinculada
          </label>
          <select
            value={data.linkedSimulatedId || ''}
            onChange={(e) => onChange({ linkedSimulatedId: e.target.value || null })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-red transition-colors appearance-none"
          >
            <option value="">Nenhum simulado vinculado</option>
            {simulatedClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.title}</option>
            ))}
          </select>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase">
            Ao vincular, uma aba &quot;SIMULADOS&quot; será ativada na área do aluno desta turma.
          </p>
        </div>
      </div>
    </div>
  );
};
