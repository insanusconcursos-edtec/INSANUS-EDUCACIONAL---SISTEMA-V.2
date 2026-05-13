import React, { useState } from 'react';
import { Upload, Image as ImageIcon, Settings, Smartphone } from 'lucide-react';
import { uploadSystemLogo, uploadPWALogo } from '../../services/settingsService';

export const BrandingSettings = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingPWA, setIsUploadingPWA] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'system' | 'pwa') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação básica
    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione um arquivo de imagem (PNG, JPG, SVG).");
      return;
    }

    if (type === 'system') {
      setIsUploading(true);
      try {
        await uploadSystemLogo(file);
        alert("Logo principal atualizada com sucesso!");
      } catch (error) {
        console.error("Erro ao enviar logo:", error);
        alert("Erro ao atualizar a logo.");
      } finally {
        setIsUploading(false);
      }
    } else {
      setIsUploadingPWA(true);
      try {
        await uploadPWALogo(file);
        alert("Logo Mobile (PWA) atualizada com sucesso!");
      } catch (error) {
        console.error("Erro ao enviar logo PWA:", error);
        alert("Erro ao atualizar a logo PWA.");
      } finally {
        setIsUploadingPWA(false);
      }
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <ImageIcon className="text-brand-red" /> Identidade Visual
      </h3>
      
      <div className="space-y-8">
        {/* Logo Principal */}
        <div className="flex flex-col md:flex-row md:items-center gap-6 pb-6 border-b border-zinc-800">
          <div className="flex-1">
            <h4 className="text-white font-bold mb-2">Logo Principal (Desktop/Geral)</h4>
            <p className="text-sm text-zinc-400 mb-2">
              Faça o upload da logo principal do sistema. Ela será exibida no cabeçalho para todos os administradores e alunos.
            </p>
            <ul className="text-xs text-zinc-500 list-disc list-inside mb-4">
              <li>Tamanho recomendado: Máx. 250px de largura e 60px de altura.</li>
              <li>Formato ideal: PNG transparente ou SVG.</li>
            </ul>
            
            <label className="relative inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold rounded-lg cursor-pointer transition border border-zinc-700">
              {isUploading ? 'Enviando...' : <><Upload size={16} /> Enviar Nova Logo</>}
              <input 
                type="file" 
                accept="image/png, image/jpeg, image/svg+xml" 
                className="hidden" 
                onChange={(e) => handleFileChange(e, 'system')}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        {/* Logo Mobile / PWA */}
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h4 className="text-white font-bold mb-2">Logo Mobile (Ícone PWA)</h4>
            <p className="text-sm text-zinc-400 mb-2">
              Este ícone será usado quando o usuário instalar o aplicativo no celular (Android/iOS).
            </p>
            <ul className="text-xs text-zinc-500 list-disc list-inside mb-4">
              <li>Tamanho recomendado: 512x512px (formato quadrado).</li>
              <li>Formato ideal: PNG com fundo sólido ou transparente.</li>
            </ul>
            
            <label className="relative inline-flex items-center gap-2 px-4 py-2 bg-brand-red/10 border border-brand-red/20 hover:bg-brand-red/20 text-brand-red text-sm font-bold rounded-lg cursor-pointer transition">
              {isUploadingPWA ? 'Enviando...' : <><Smartphone size={16} /> Enviar Logo Mobile</>}
              <input 
                type="file" 
                accept="image/png, image/jpeg" 
                className="hidden" 
                onChange={(e) => handleFileChange(e, 'pwa')}
                disabled={isUploadingPWA}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

const MaintenancePage: React.FC = () => {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-brand-red/10 rounded-xl">
          <Settings className="w-6 h-6 text-brand-red" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Manutenção</h1>
          <p className="text-zinc-500 text-sm">Configurações globais e identidade visual do sistema.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <BrandingSettings />
        
        {/* Outras seções de manutenção podem ser adicionadas aqui */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-10 text-center">
            <p className="text-zinc-500 italic">Mais módulos de manutenção em breve.</p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
