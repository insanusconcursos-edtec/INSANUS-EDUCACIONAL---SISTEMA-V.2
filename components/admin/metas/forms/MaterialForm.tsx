
import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Loader2 } from 'lucide-react';
import { Meta, uploadBatchMetaFiles, MaterialLink, MaterialFile } from '../../../../services/metaService';
import { MetaColorSelector } from '../shared/MetaColorSelector';
import MetaFilesUploader, { FileItem } from '../shared/MetaFilesUploader';
import MetaLinksEditor from '../shared/MetaLinksEditor';

interface MaterialFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: Meta | null;
  loading: boolean;
  planId: string;
}

const MaterialForm: React.FC<MaterialFormProps> = ({ isOpen, onClose, onSave, initialData, loading, planId }) => {
  // Basic Info
  const [title, setTitle] = useState('');
  const [pageCount, setPageCount] = useState<number | ''>('');
  const [color, setColor] = useState('#f97316'); // Default Orange
  
  // Lists
  const [links, setLinks] = useState<MaterialLink[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [observation, setObservation] = useState('');
  
  // Upload State
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setPageCount(initialData.pageCount || '');
        setColor(initialData.color || '#f97316');
        setLinks(initialData.links || []);
        setObservation(initialData.observation || '');
        
        // Map existing files to UI structure
        const mappedFiles = (initialData.files || []).map((f: MaterialFile, i: number) => ({
            id: `existing-${i}`,
            name: f.name,
            url: f.url
        }));
        setFiles(mappedFiles);
      } else {
        setTitle('');
        setPageCount('');
        setColor('#f97316');
        setLinks([]);
        setFiles([]);
        setObservation('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  // === SUBMIT ===

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      // 1. Upload new files and consolidate existing ones
      const processedFiles = await uploadBatchMetaFiles(planId, files);

      // 2. Save Meta
      await onSave({
        title,
        type: 'material',
        pageCount: Number(pageCount),
        color,
        files: processedFiles,
        links: links,
        observation
      });
      
    } catch (error) {
      console.error("Operation failed", error);
      alert("Erro ao processar materiais. Verifique a conexão.");
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
                <FileText size={20} />
             </div>
             <h2 className="text-xl font-black text-white tracking-tighter">
                {initialData ? 'Editar Material' : 'Nova Meta de Leitura'}
             </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Section 1: Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 tracking-widest">Título da Meta</label>
                <input 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Apostila de Direito Penal"
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none font-bold"
                    style={{ caretColor: color }}
                    onFocus={(e) => e.target.style.borderColor = color}
                    onBlur={(e) => e.target.style.borderColor = '#27272a'}
                />
            </div>
            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 tracking-widest">Páginas Totais</label>
                <input 
                    type="number"
                    value={pageCount}
                    onChange={(e) => setPageCount(Number(e.target.value))}
                    placeholder="0"
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 focus:outline-none text-center font-bold"
                    onFocus={(e) => e.target.style.borderColor = color}
                    onBlur={(e) => e.target.style.borderColor = '#27272a'}
                />
            </div>
          </div>

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

          <MetaColorSelector color={color} onChange={setColor} />

          <div className="h-px bg-zinc-900"></div>

          {/* Section 2: PDF Files */}
          <MetaFilesUploader 
            files={files} 
            onChange={setFiles} 
            customColor={color}
          />

          <div className="h-px bg-zinc-900"></div>

          {/* Section 3: Links */}
          <MetaLinksEditor 
            links={links} 
            onChange={setLinks} 
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
                    <><Save size={16} /> Salvar Material</>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default MaterialForm;
