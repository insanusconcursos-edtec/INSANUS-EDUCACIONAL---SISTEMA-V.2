import React, { useState } from 'react';
import { Upload, Image as ImageIcon, Smartphone, Settings } from 'lucide-react';
import { uploadSystemLogo, uploadPWALogo, uploadFavicon } from '../../services/settingsService';

const Maintenance: React.FC = () => {
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingPWA, setIsUploadingPWA] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);

  const handleUpload = async (file: File, type: 'logo' | 'pwa' | 'favicon') => {
    try {
      if (type === 'logo') {
        setIsUploadingLogo(true);
        await uploadSystemLogo(file);
        alert("Logo principal atualizada!");
      } else if (type === 'pwa') {
        setIsUploadingPWA(true);
        await uploadPWALogo(file);
        alert("Logo Mobile (PWA) atualizada!");
      } else {
        setIsUploadingFavicon(true);
        await uploadFavicon(file);
        alert("Favicon atualizado!");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar imagem.");
    } finally {
      if (type === 'logo') setIsUploadingLogo(false);
      else if (type === 'pwa') setIsUploadingPWA(false);
      else setIsUploadingFavicon(false);
    }
  };

  return (
    <div className="p-10 text-center animate-in fade-in duration-500">
      <h1 className="text-3xl font-black text-white mb-4 uppercase">Manutenção do Sistema</h1>
      <p className="text-zinc-500 mb-10">Gerencie a identidade visual e configurações globais.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto text-left">
        {/* Bloco de Identidade Visual - Logo Principal */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ImageIcon className="text-red-500" /> Logo Principal
          </h3>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-400">
              Cabelalho (250x60px).
            </p>
            <label className="relative inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg cursor-pointer transition border border-gray-700">
              {isUploadingLogo ? 'Enviando...' : <><Upload size={16} /> Upload Logo</>}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file, 'logo');
              }} disabled={isUploadingLogo} />
            </label>
          </div>
        </div>

        {/* Favicon */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="text-red-500 w-5 h-5" /> Favicon (Aba)
          </h3>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-400">
              Aba do navegador (32x32px).
            </p>
            <label className="relative inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg cursor-pointer transition border border-gray-700">
              {isUploadingFavicon ? 'Enviando...' : <><Upload size={16} /> Upload Favicon</>}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file, 'favicon');
              }} disabled={isUploadingFavicon} />
            </label>
          </div>
        </div>

        {/* Bloco de Identidade Visual - Logo Mobile (PWA) */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Smartphone className="text-red-500" /> Logo Mobile (PWA)
          </h3>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-400">
              Ícone App (512x512px, PNG).
            </p>
            <label className="relative inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg cursor-pointer transition border border-gray-700">
              {isUploadingPWA ? 'Enviando...' : <><Upload size={16} /> Upload PWA</>}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file, 'pwa');
              }} disabled={isUploadingPWA} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
