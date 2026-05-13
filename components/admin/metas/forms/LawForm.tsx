
import React, { useState, useEffect } from 'react';
import { X, Save, Book, Loader2, FileText, Scale } from 'lucide-react';
import { Meta, uploadBatchMetaFiles, MaterialLink, MaterialFile, SpacedReviewConfig } from '../../../../services/metaService';
import MetaLinksEditor from '../shared/MetaLinksEditor';
import MetaFilesUploader, { FileItem } from '../shared/MetaFilesUploader';
import ReviewSystemConfig from '../shared/ReviewSystemConfig';
import { MetaColorSelector } from '../shared/MetaColorSelector';

interface LawFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: Meta | null;
  loading: boolean;
  planId: string;
}

const LawForm: React.FC<LawFormProps> = ({ isOpen, onClose, onSave, initialData, loading, planId }) => {
  // Fields
  const [title, setTitle] = useState('');
  const [articles, setArticles] = useState('');
  const [pages, setPages] = useState<number | ''>('');
  const [multiplier, setMultiplier] = useState(1);
  const [color, setColor] = useState('#eab308'); // Default Yellow
  
  // Resources
  const [links, setLinks] = useState<MaterialLink[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  
  // Spaced Review
  const [reviewConfig, setReviewConfig] = useState<SpacedReviewConfig>({
    active: false,
    intervals: '1, 7, 15, 30',
    repeatLast: false
  });
  const [observation, setObservation] = useState('');

  // UI State
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setArticles(initialData.lawConfig?.articles || '');
        setPages(initialData.lawConfig?.pages || '');
        setMultiplier(initialData.lawConfig?.multiplier || initialData.lawConfig?.speedFactor || 1);
        setColor(initialData.color || '#eab308');
        setObservation(initialData.observation || '');
        
        setLinks(initialData.links || []);
        
        const mappedFiles = (initialData.files || []).map((f: MaterialFile, i: number) => ({
            id: `existing-${i}`,
            name: f.name,
            url: f.url
        }));
        setFiles(mappedFiles);

        if (initialData.reviewConfig) {
            setReviewConfig(initialData.reviewConfig);
        } else {
            setReviewConfig({ active: false, intervals: '1, 7, 15, 30', repeatLast: false });
        }

      } else {
        setTitle('');
        setArticles('');
        setPages('');
        setMultiplier(1);
        setColor('#eab308');
        setLinks([]);
        setFiles([]);
        setObservation('');
        setReviewConfig({ active: false, intervals: '1, 7, 15, 30', repeatLast: false });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      const processedFiles = await uploadBatchMetaFiles(planId, files);

      await onSave({
        title,
        type: 'law',
        color,
        lawConfig: {
            articles,
            pages: Number(pages),
            multiplier: Number(multiplier)
        },
        reviewConfig,
        files: processedFiles,
        links: links,
        observation
      });
      
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar meta de Lei Seca.");
    } finally {
      setUploading(false);
    }
  };

  const isBusy = loading || uploading;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Dynamic */}
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
             <div 
                className="p-2 rounded-lg border"
                style={{ 
                    backgroundColor: `${color}20`, 
                    color: color,
                    borderColor: `${color}30`
                }}
             >
                <Book size={20} />
             </div>
             <h2 className="text-xl font-black text-white tracking-tighter">
                {initialData ? 'Editar Lei Seca' : 'Nova Meta de Lei Seca'}
             </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Main Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 tracking-widest">Título / Lei</label>
                <input 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Código Penal"
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none font-bold"
                    style={{ caretColor: color }}
                    onFocus={(e) => e.target.style.borderColor = color}
                    onBlur={(e) => e.target.style.borderColor = '#27272a'}
                />
            </div>
            
            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                    <Scale size={12} /> Artigos
                </label>
                <input 
                    value={articles}
                    onChange={(e) => setArticles(e.target.value)}
                    placeholder="Ex: Arts. 1º ao 121"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none uppercase font-bold"
                    onFocus={(e) => e.target.style.borderColor = color}
                    onBlur={(e) => e.target.style.borderColor = '#27272a'}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 tracking-widest flex items-center gap-1">
                        <FileText size={12} /> Páginas
                    </label>
                    <input 
                        type="number"
                        value={pages}
                        onChange={(e) => setPages(Number(e.target.value))}
                        placeholder="0"
                        required
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none text-center font-bold"
                        onFocus={(e) => e.target.style.borderColor = color}
                        onBlur={(e) => e.target.style.borderColor = '#27272a'}
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 tracking-widest">Fator Multiplicativo</label>
                    <select 
                        value={multiplier}
                        onChange={(e) => setMultiplier(Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white focus:outline-none"
                        onFocus={(e) => e.target.style.borderColor = color}
                        onBlur={(e) => e.target.style.borderColor = '#27272a'}
                    >
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={3}>3x</option>
                        <option value={4}>4x</option>
                        <option value={5}>5x</option>
                    </select>
                </div>
            </div>
          </div>

          <MetaColorSelector color={color} onChange={setColor} />

          <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 tracking-widest">Aviso / Dica / Observação (Opcional)</label>
              <textarea 
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder="Ex: Foco total no Artigo 5º..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none font-bold"
                  style={{ caretColor: color }}
                  onFocus={(e) => e.target.style.borderColor = color}
                  onBlur={(e) => e.target.style.borderColor = '#27272a'}
                  rows={3}
              />
          </div>

          <div className="h-px bg-zinc-900"></div>

          {/* Resources */}
          <MetaFilesUploader 
            files={files} 
            onChange={setFiles} 
            customColor={color}
          />
          
          <MetaLinksEditor 
            links={links} 
            onChange={setLinks} 
            customColor={color}
          />

          <div className="h-px bg-zinc-900"></div>

          {/* Spaced Review System */}
          <ReviewSystemConfig 
            config={reviewConfig}
            onChange={setReviewConfig}
            customColor={color}
          />

        </form>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-900 bg-zinc-950">
            <button 
                onClick={handleSubmit}
                disabled={isBusy}
                className="w-full text-white font-black py-4 rounded-xl transition-all tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-110 shadow-lg"
                style={{ backgroundColor: color, boxShadow: `0 0 20px ${color}40` }}
            >
                {isBusy ? (
                    <><Loader2 size={16} className="animate-spin" /> {uploading ? 'Enviando Arquivos...' : 'Salvando...'}</>
                ) : (
                    <><Save size={16} /> Salvar Lei Seca</>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default LawForm;
