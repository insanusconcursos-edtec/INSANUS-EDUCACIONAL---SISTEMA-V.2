
import React, { useRef } from 'react';
import { Upload, FileText, Trash2, CheckCircle, File as FileIcon } from 'lucide-react';

export interface FileItem {
  id: string; 
  name: string; 
  file?: File; 
  url?: string; 
}

interface MetaFilesUploaderProps {
  files: FileItem[];
  onChange: (files: FileItem[]) => void;
  customColor?: string; // Hex
}

const MetaFilesUploader: React.FC<MetaFilesUploaderProps> = ({ 
  files, 
  onChange,
  customColor = '#f97316'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((file: File) => ({
        id: `new-${Date.now()}-${Math.random()}`,
        name: file.name.replace('.pdf', ''),
        file: file
      }));
      onChange([...files, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileNameChange = (id: string, newName: string) => {
    onChange(files.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  const handleRemoveFile = (id: string) => {
    onChange(files.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              <FileIcon size={14} style={{ color: customColor }} /> Arquivos PDF
          </label>
          <span className="text-[10px] font-bold text-zinc-600">{files.length} arquivos selecionados</span>
      </div>

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf"
        multiple
        className="hidden"
      />
      
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={`w-full py-4 border-2 border-dashed border-zinc-800 hover:bg-zinc-900/50 rounded-xl flex items-center justify-center gap-3 transition-all group`}
        style={{ borderColor: '#27272a' }} // Default border, override on hover manually via CSS or simple style
        onMouseEnter={(e) => e.currentTarget.style.borderColor = customColor}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#27272a'}
      >
          <div 
            className="p-2 bg-zinc-900 rounded-full transition-colors"
            style={{ color: '#71717a' /* zinc-500 */ }}
          >
              <Upload size={18} />
          </div>
          <span className="text-xs font-bold text-zinc-500 group-hover:text-white uppercase">Clique para adicionar PDFs</span>
      </button>

      <div className="space-y-2">
          {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50">
                  <div className="p-2 bg-zinc-950 rounded border border-zinc-800">
                       {file.url ? (
                           <CheckCircle size={16} className="text-green-500" /> 
                        ) : (
                           <FileText size={16} style={{ color: customColor }} />
                        )}
                  </div>
                  
                  <div className="flex-1">
                      <label className="text-[9px] text-zinc-600 font-bold uppercase block mb-1">Nome de Exibição</label>
                      <input 
                          value={file.name}
                          onChange={(e) => handleFileNameChange(file.id, e.target.value)}
                          className="w-full bg-transparent border-b border-zinc-800 text-xs text-white font-bold py-1 focus:outline-none transition-colors"
                          style={{ caretColor: customColor }}
                          onFocus={(e) => e.target.style.borderColor = customColor}
                          onBlur={(e) => e.target.style.borderColor = '#27272a'}
                          placeholder="Nome do arquivo"
                      />
                  </div>

                  <div className="text-right">
                       {file.file && <span className="text-[9px] text-zinc-500 uppercase font-mono block mb-1">{(file.file.size / 1024 / 1024).toFixed(2)} MB</span>}
                       <button 
                          type="button" 
                          onClick={() => handleRemoveFile(file.id)}
                          className="p-1.5 hover:bg-red-900/20 text-zinc-600 hover:text-red-500 rounded transition-colors"
                       >
                          <Trash2 size={14} />
                       </button>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};

export default MetaFilesUploader;
