import React, { useRef, useState, useCallback } from 'react';
import { Camera, Upload, X, ZoomIn, ZoomOut, Check } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { Teacher } from '../../../../../types/teacher';

interface BasicInfoFormProps {
  data: Partial<Teacher>;
  onChange: (data: Partial<Teacher>) => void;
  onPhotoUpload: (file: File) => Promise<string>;
}

// Helper function to create the cropped image
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas is empty'));
      }
    }, 'image/jpeg');
  });
};

export const BasicInfoForm: React.FC<BasicInfoFormProps> = ({ data, onChange, onPhotoUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  
  // Crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropper, setShowCropper] = useState(false);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
        setShowCropper(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setUploading(true);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const file = new File([croppedBlob], "profile_photo.jpg", { type: "image/jpeg" });
      
      const url = await onPhotoUpload(file);
      onChange({ ...data, photoUrl: url });
      
      // Reset cropper
      setShowCropper(false);
      setImageSrc(null);
    } catch (error) {
      console.error("Error cropping/uploading photo:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageSrc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = () => {
    onChange({ ...data, photoUrl: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white mb-4">Informações Básicas</h3>
      
      {/* Image Cropper Modal */}
      {showCropper && imageSrc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-white font-bold uppercase">Ajustar Foto</h3>
              <button onClick={handleCropCancel} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="relative h-80 bg-black w-full">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                cropShape="round"
                showGrid={false}
              />
            </div>

            <div className="p-6 space-y-6 bg-zinc-900">
              <div className="flex items-center gap-4">
                <ZoomOut className="w-4 h-4 text-zinc-500" />
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-brand-red"
                />
                <ZoomIn className="w-4 h-4 text-zinc-500" />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCropCancel}
                  className="flex-1 py-3 rounded-xl font-bold uppercase text-xs tracking-wider border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCropConfirm}
                  disabled={uploading}
                  className="flex-1 py-3 bg-brand-red hover:bg-red-600 text-white rounded-xl font-bold uppercase text-xs tracking-wider shadow-lg shadow-brand-red/20 transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? 'Salvando...' : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirmar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        {/* Photo Upload Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <div className={`w-32 h-32 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden ${
              data.photoUrl ? 'border-brand-red' : 'border-zinc-700 bg-zinc-900'
            }`}>
              {data.photoUrl ? (
                <img src={data.photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-10 h-10 text-zinc-600" />
              )}
              
              {/* Overlay for upload */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full cursor-pointer"
                   onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-8 h-8 text-white" />
              </div>
            </div>
            
            {data.photoUrl && (
              <button 
                onClick={removePhoto}
                className="absolute -top-2 -right-2 p-1 bg-zinc-800 rounded-full border border-zinc-700 text-zinc-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />
          <span className="text-xs text-zinc-500 text-center">
            {uploading ? 'Processando...' : 'Clique para alterar a foto'}
          </span>
        </div>

        {/* Form Fields */}
        <div className="flex-1 space-y-4 w-full">
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Nome Completo *</label>
            <input
              type="text"
              value={data.name || ''}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-brand-red transition-colors"
              placeholder="Ex: João da Silva"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">E-mail *</label>
              <input
                type="email"
                value={data.email || ''}
                onChange={(e) => onChange({ ...data, email: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-brand-red transition-colors"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">WhatsApp *</label>
              <input
                type="tel"
                value={data.whatsapp || ''}
                onChange={(e) => onChange({ ...data, whatsapp: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-brand-red transition-colors"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
