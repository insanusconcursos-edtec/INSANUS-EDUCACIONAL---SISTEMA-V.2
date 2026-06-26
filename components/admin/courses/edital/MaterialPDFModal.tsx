import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Save, FileText, AlertCircle, Gavel } from 'lucide-react';
import { courseService } from '../../../../services/courseService';
import { MaterialPDF } from '../../../../types/courseEdital';
import { toast } from 'react-hot-toast';

interface MaterialPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pdf: MaterialPDF) => Promise<void>;
  courseId: string;
  topicId: string;
  initialData?: MaterialPDF;
}

export function MaterialPDFModal({ isOpen, onClose, onSave, courseId, topicId, initialData }: MaterialPDFModalProps) {
  const [title, setTitle] = useState('');
  const [pdfType, setPdfType] = useState<'TEORIA' | 'QUESTOES' | 'LEI_SECA'>('TEORIA');
  const [loading, setLoading] = useState(false);
  
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState('');
  const [existingStoragePath, setExistingStoragePath] = useState('');
  
  const [commentedAnswerKeyFile, setCommentedAnswerKeyFile] = useState<File | null>(null);
  const [existingCommentedUrl, setExistingCommentedUrl] = useState('');
  const [existingCommentedName, setExistingCommentedName] = useState('');

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const commentedInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setPdfType(initialData.pdfType || 'TEORIA');
        setExistingPdfUrl(initialData.url);
        setExistingStoragePath(initialData.storagePath || '');
        setExistingCommentedUrl(initialData.commentedAnswerKeyUrl || '');
        setExistingCommentedName(initialData.commentedAnswerKeyName || '');
        setPdfFile(null);
        setCommentedAnswerKeyFile(null);
      } else {
        setTitle('');
        setPdfType('TEORIA');
        setExistingPdfUrl('');
        setExistingStoragePath('');
        setExistingCommentedUrl('');
        setExistingCommentedName('');
        setPdfFile(null);
        setCommentedAnswerKeyFile(null);
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
        toast.error('Informe o título do material');
        return;
    }
    if (!pdfFile && !existingPdfUrl) {
        toast.error('Selecione um arquivo PDF');
        return;
    }

    setLoading(true);
    try {
        let finalUrl = existingPdfUrl;
        let finalPath = existingStoragePath;
        let finalCommentedUrl = existingCommentedUrl;
        let finalCommentedName = existingCommentedName;

        // Upload PDF Principal se alterado
        if (pdfFile) {
            const result = await courseService.uploadEditalFile(pdfFile, courseId, topicId);
            finalUrl = result.url;
            finalPath = result.path;
        }

        // Upload Gabarito se QUESTÕES e alterado
        if (pdfType === 'QUESTOES') {
            if (commentedAnswerKeyFile) {
                const result = await courseService.uploadEditalFile(commentedAnswerKeyFile, courseId, topicId);
                finalCommentedUrl = result.url;
                finalCommentedName = commentedAnswerKeyFile.name;
            }
        } else {
            // Se mudou de QUESTOES para TEORIA, limpa o gabarito
            finalCommentedUrl = '';
            finalCommentedName = '';
        }

        const newPdf: MaterialPDF = {
            title,
            url: finalUrl,
            storagePath: finalPath,
            pdfType,
            commentedAnswerKeyUrl: finalCommentedUrl || null,
            commentedAnswerKeyName: finalCommentedName || null
        };

        await onSave(newPdf);
        onClose();
    } catch (error) {
        console.error(error);
        toast.error('Erro ao salvar material');
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 bg-zinc-900/50 flex justify-between items-center shrink-0">
            <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <FileText size={20} className="text-orange-500" />
                {initialData ? 'Editar Material' : 'Adicionar Conteúdo'}
            </h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            
            {/* Título */}
            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    Título do Conteúdo <span className="text-red-500">*</span>
                </label>
                <input 
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Teoria de Direito Administrativo ou Lista de Questões"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"
                    required
                />
            </div>

            {/* Upload PDF Principal */}
            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    Arquivo .PDF <span className="text-red-500">*</span>
                </label>
                <div 
                    onClick={() => pdfInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 hover:border-orange-500/50 transition-all cursor-pointer group"
                >
                    <input 
                        type="file"
                        ref={pdfInputRef}
                        accept="application/pdf"
                        onChange={(e) => {
                            if (e.target.files?.[0]) setPdfFile(e.target.files[0]);
                        }}
                        className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Upload size={20} className="text-zinc-400 group-hover:text-orange-500" />
                    </div>
                    <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200">
                        {pdfFile ? pdfFile.name : (existingPdfUrl ? 'Alterar Arquivo PDF' : 'SELECIONAR PDF')}
                    </span>
                    {!pdfFile && existingPdfUrl && (
                        <span className="text-[10px] text-zinc-600 mt-1 italic">Arquivo atual já salvo</span>
                    )}
                </div>
            </div>

            {/* Classificação */}
            <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Classificação do PDF:</label>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={() => setPdfType('TEORIA')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                            pdfType === 'TEORIA' 
                            ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                    >
                        <FileText size={20} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Teoria</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setPdfType('QUESTOES')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                            pdfType === 'QUESTOES' 
                            ? 'bg-red-500/10 border-red-500/50 text-red-500' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                    >
                        <AlertCircle size={20} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Questões</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setPdfType('LEI_SECA')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                            pdfType === 'LEI_SECA' 
                            ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                    >
                        <Gavel size={20} />
                        <span className="text-[10px] font-black uppercase tracking-wider text-center">Lei Seca</span>
                    </button>
                </div>
            </div>

            {/* Gabarito Comentado (Apenas para QUESTÕES) */}
            {pdfType === 'QUESTOES' && (
                <div className="p-4 bg-blue-900/5 border border-blue-900/20 rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">Gabarito Comentado (.PDF):</label>
                    
                    <div 
                        onClick={() => commentedInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-4 border border-dashed border-blue-900/30 rounded-xl bg-black/20 hover:bg-black/30 hover:border-blue-500/50 cursor-pointer transition-all group"
                    >
                        <input 
                            type="file" 
                            ref={commentedInputRef}
                            accept="application/pdf"
                            onChange={(e) => {
                                if (e.target.files?.[0]) setCommentedAnswerKeyFile(e.target.files[0]);
                            }}
                            className="hidden"
                        />
                        <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Upload size={14} className="text-blue-400" />
                        </div>
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                            {commentedAnswerKeyFile ? commentedAnswerKeyFile.name : (existingCommentedUrl ? 'Alterar Gabarito' : 'Selecionar Gabarito')}
                        </span>
                        {!commentedAnswerKeyFile && existingCommentedUrl && (
                            <span className="text-[9px] text-zinc-600 mt-1 italic">{existingCommentedName || 'Arquivo salvo'}</span>
                        )}
                        {!commentedAnswerKeyFile && !existingCommentedUrl && (
                            <span className="text-[9px] text-zinc-600 mt-1 italic">Opcional</span>
                        )}
                    </div>
                </div>
            )}

            {/* Preview da Identificação Visual */}
            <div className="pt-4 border-t border-zinc-900">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-3">Preview na Lista:</span>
                <div className="p-3 bg-[#121418] border border-zinc-800 rounded-xl flex items-center gap-3">
                    <div className={`p-2 rounded bg-zinc-800 ${
                        pdfType === 'TEORIA' ? 'text-yellow-500' : 
                        pdfType === 'QUESTOES' ? 'text-red-500' : 'text-blue-500'
                    }`}>
                        {pdfType === 'LEI_SECA' ? <Gavel size={16} /> : <FileText size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-xs truncate">{title || 'Título do Material'}</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                pdfType === 'TEORIA' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 
                                pdfType === 'QUESTOES' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            }`}>
                                {pdfType}
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-500">PDF</p>
                    </div>
                </div>
                {pdfType === 'QUESTOES' && (commentedAnswerKeyFile || existingCommentedUrl) && (
                    <div className="relative ml-8 mt-1 animate-in slide-in-from-left-2 duration-300">
                        <div className="absolute -left-5 top-0 h-1/2 w-4 border-b-2 border-l-2 border-blue-500/30 rounded-bl-lg"></div>
                        <div className="flex items-center gap-2 p-1.5 px-3 bg-blue-900/10 border border-blue-900/20 rounded-lg w-fit">
                            <FileText size={12} className="text-blue-500" />
                            <span className="text-[9px] text-blue-400 font-black uppercase tracking-wider">
                                Gabarito Comentado
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-[10px] text-zinc-600 italic text-center">
                * O arquivo receberá marca d&apos;água com CPF/Email do aluno automaticamente ao ser baixado.
            </p>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-900 bg-zinc-900/50 flex justify-end gap-3 shrink-0">
            <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
            >
                Cancelar
            </button>
            <button 
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50"
            >
                {loading ? (
                    <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Enviando...
                    </>
                ) : (
                    <>
                        <Save size={16} /> Salvar Conteúdo
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
}
