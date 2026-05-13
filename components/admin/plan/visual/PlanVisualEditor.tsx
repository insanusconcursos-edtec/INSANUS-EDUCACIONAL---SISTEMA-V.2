import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Trash2, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Plan } from '../../../services/planService';
import { storage } from '../../../../services/firebase';

interface PlanVisualEditorProps {
  plan: Plan;
  onUpdate: (updates: Partial<Plan>) => void;
}

const BannerInput = ({ 
  label, 
  value, 
  planId,
  tab,
  device,
  onUpdate
}: { 
  label: string; 
  value: string; 
  planId: string;
  tab: string;
  device: string;
  onUpdate: (url: string) => void;
}) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `plans/${planId}/banners/${tab}_${device}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      onUpdate(url);
      toast.success('Imagem enviada e salva com sucesso!');
    } catch (error) {
      console.error("Upload failed", error);
      alert("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-zinc-400 uppercase">{label}</label>
      <div className="flex gap-2 items-center">
        {uploading ? (
          <div className="flex-1 flex items-center justify-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400">
            <Loader2 className="animate-spin" size={16} /> Enviando...
          </div>
        ) : value ? (
          <div className="flex items-center gap-4 p-2 bg-white/5 border border-white/10 rounded-md">
            <img src={value} alt="Preview" className="h-16 w-auto object-cover rounded-md" />
            <button onClick={() => onUpdate('')} className="text-red-500 hover:text-red-400 p-2">
              <Trash2 size={18} />
            </button>
          </div>
        ) : (
          <label className="flex-1 flex items-center justify-center gap-2 bg-zinc-950 border border-dashed border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:border-zinc-500 cursor-pointer transition">
            <Upload size={16} /> Escolher Imagem
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        )}
      </div>
    </div>
  );
};

export const PlanVisualEditor: React.FC<PlanVisualEditorProps> = ({ plan, onUpdate }) => {
  const updateBanner = (tab: 'today' | 'calendar' | 'edict' | 'mentorship', device: 'desktop' | 'tablet' | 'mobile', url: string) => {
    const newBanners = {
      ...(plan.banners || {
        today: { desktop: '', tablet: '', mobile: '' },
        calendar: { desktop: '', tablet: '', mobile: '' },
        edict: { desktop: '', tablet: '', mobile: '' },
        mentorship: { desktop: '', tablet: '', mobile: '' },
      }),
      [tab]: {
        ...(plan.banners?.[tab] || { desktop: '', tablet: '', mobile: '' }),
        [device]: url,
      },
    };
    onUpdate({ banners: newBanners });
  };

  const sections = [
    { id: 'today', title: 'Metas de Hoje' },
    { id: 'calendar', title: 'Calendário' },
    { id: 'edict', title: 'Edital' },
    { id: 'mentorship', title: 'Mentoria' },
  ] as const;

  return (
    <div className="p-6 space-y-8">
      {/* SEÇÃO DE CORES (NOVO) */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl overflow-hidden relative">
          {/* Subtle Glow based on theme */}
          <div 
              className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[100px] opacity-20 pointer-events-none transition-colors duration-500"
              style={{ backgroundColor: plan.themeColor || '#EF4444' }}
          ></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-1">Identidade Visual</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Defina a cor temática deste plano para a visão do aluno.</p>
              </div>

              <div className="flex items-center gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800 shadow-inner">
                  <div className="relative group">
                    <input 
                        type="color" 
                        value={plan.themeColor || '#EF4444'} 
                        onChange={(e) => onUpdate({ themeColor: e.target.value.toUpperCase() })}
                        className="w-12 h-12 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg shadow-lg group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Código HEX</span>
                      <input 
                          type="text" 
                          value={plan.themeColor || '#EF4444'} 
                          onChange={(e) => onUpdate({ themeColor: e.target.value.toUpperCase() })}
                          placeholder="#EF4444"
                          className="bg-transparent border-b border-zinc-800 text-sm font-mono font-bold text-white uppercase focus:outline-none focus:border-white transition-colors w-24"
                      />
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => (
        <div key={section.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col gap-4">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">{section.title}</h3>
          <BannerInput 
            label="Desktop (2560x595)" 
            value={plan.banners?.[section.id]?.desktop || ''}
            planId={plan.id!}
            tab={section.id}
            device="desktop"
            onUpdate={(url) => updateBanner(section.id, 'desktop', url)} 
          />
          <BannerInput 
            label="Tablet (2560x595)" 
            value={plan.banners?.[section.id]?.tablet || ''}
            planId={plan.id!}
            tab={section.id}
            device="tablet"
            onUpdate={(url) => updateBanner(section.id, 'tablet', url)} 
          />
          <BannerInput 
            label="Mobile (1080x1350)" 
            value={plan.banners?.[section.id]?.mobile || ''}
            planId={plan.id!}
            tab={section.id}
            device="mobile"
            onUpdate={(url) => updateBanner(section.id, 'mobile', url)} 
          />
        </div>
      ))}
      </div>
    </div>
  );
};
