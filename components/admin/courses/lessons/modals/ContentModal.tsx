import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { X, Save, Loader2, Upload, Search, Folder, ChevronLeft, PlayCircle, FileText, FileQuestion, Layers } from 'lucide-react';
import { CourseContent, ContentType } from '../../../../../types/course';
import { courseService } from '../../../../../services/courseService';
import { RichTextEditor } from '../../../../ui/RichTextEditor';
import { pandaService } from '../../../../../services/pandaService';
import { extractPandaVideoId, getPandaEmbedUrl, PandaVideo } from '../../../../../utils/pandaUtils';

interface ContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CourseContent>) => Promise<void>;
  initialData?: CourseContent | null;
  lessonId: string;
  contents: CourseContent[];
}

export function ContentModal({ isOpen, onClose, onSave, initialData, lessonId, contents }: ContentModalProps) {
  // Estado base
  const [type, setType] = useState<ContentType>('video');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados específicos
  const [videoUrl, setVideoUrl] = useState('');
  const [videoPlatform, setVideoPlatform] = useState<'panda' | 'youtube'>('youtube');
  const [useAlternativePlayer, setUseAlternativePlayer] = useState(false);
  
  const [linkUrl, setLinkUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');
  const [textContent, setTextContent] = useState('');
  
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState('');
  const [pdfClassification, setPdfClassification] = useState<'TEORIA' | 'QUESTÕES' | 'TEORIA_QUESTÕES'>('TEORIA');
  const [isLinkedToPreviousTheory, setIsLinkedToPreviousTheory] = useState(false);
  const [selectingVideo, setSelectingVideo] = useState(false);
  
  // Panda Media Picker
  const [showPandaPicker, setShowPandaPicker] = useState(false);
  const [pandaVideos, setPandaVideos] = useState<{id: string, title: string, video_player_url?: string}[]>([]);
  const [pandaFolders, setPandaFolders] = useState<{id: string, name: string}[]>([]);
  const [loadingPanda, setLoadingPanda] = useState(false);
  const [pandaSearch, setPandaSearch] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<string[]>([]);

  // Debounce para busca no Panda (ou navegação)
  useEffect(() => {
    if (!showPandaPicker) return;

    if (pandaSearch) {
        const timer = setTimeout(() => {
            fetchPandaVideos(pandaSearch);
        }, 500);
        return () => clearTimeout(timer);
    } else {
        fetchPandaExplorer(currentFolderId);
    }
  }, [pandaSearch, showPandaPicker, currentFolderId]);

  const fetchPandaVideos = async (search: string = '') => {
    setLoadingPanda(true);
    try {
      const videos = await pandaService.listVideos(search);
      setPandaVideos(videos);
      setPandaFolders([]); // Limpa pastas na busca por texto
    } catch (error) {
      console.error("Erro ao carregar vídeos do Panda:", error);
    } finally {
      setLoadingPanda(false);
    }
  };

  const fetchPandaExplorer = async (folderId: string | null = null) => {
    setLoadingPanda(true);
    try {
      const { folders, videos } = await pandaService.explorer(folderId);
      setPandaVideos(videos);
      setPandaFolders(folders);
    } catch (error) {
      console.error("Erro no explorer do Panda:", error);
    } finally {
      setLoadingPanda(false);
    }
  };

  const handleFolderClick = (folderId: string) => {
    if (currentFolderId) {
        setFolderHistory(prev => [...prev, currentFolderId]);
    } else {
        setFolderHistory(['root']);
    }
    setCurrentFolderId(folderId);
    setPandaSearch(''); // Limpa busca ao navegar
  };

  const handleGoBack = () => {
    const newHistory = [...folderHistory];
    const lastFolder = newHistory.pop();
    setFolderHistory(newHistory);
    setCurrentFolderId(lastFolder === 'root' ? null : (lastFolder || null));
    setPandaSearch('');
  };

  const handleSelectPandaVideo = async (video: PandaVideo) => {
    if (selectingVideo) return;
    
    const toastId = toast.loading("Buscando link do vídeo...");
    try {
      setSelectingVideo(true);
      
      // 1. Busca os detalhes completos do vídeo para garantir o Playback ID
      const videoDetails = await pandaService.getVideoDetails(video.id);
      
      if (!videoDetails) {
        throw new Error("Não foi possível carregar os detalhes do vídeo.");
      }

      // 2. Extração rigorosa (Parser de URL via utilitário)
      const playbackId = extractPandaVideoId(videoDetails);

      // 3. Trava de Segurança Definitiva (Fail-Fast)
      if (!playbackId) {
        toast.error("Falha Crítica: Playback ID não encontrado.", { id: toastId });
        console.error("Falha Crítica: Playback ID não encontrado nas URLs. Objeto:", videoDetails);
        alert("Erro: Este vídeo não possui uma URL de embed pública válida no Panda. O vídeo pode estar processando ou com o embed desativado no painel do Panda Vídeo.");
        return; // Impede a montagem de um player quebrado
      }

      // 4. Montagem Estrita da URL Ticto
      const tictoEmbedUrl = getPandaEmbedUrl(videoDetails, playbackId);

      // 5. Injeção no formulário
      setVideoUrl(tictoEmbedUrl);
      
      // Injeta o título do vídeo automaticamente
      if (videoDetails.title || videoDetails.name) {
          setTitle(videoDetails.title || videoDetails.name);
      }

      setVideoPlatform('panda');
      setShowPandaPicker(false);
      toast.success("Vídeo selecionado com sucesso!", { id: toastId });
    } catch (error) {
      console.error("Erro ao selecionar vídeo do Panda:", error);
      toast.error("Erro ao carregar os detalhes do vídeo.", { id: toastId });
    } finally {
      setSelectingVideo(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setType(initialData.type);
        setTitle(initialData.title);
        setVideoUrl(initialData.videoUrl || '');
        setVideoPlatform(initialData.videoPlatform || 'youtube');
        setUseAlternativePlayer(initialData.useAlternativePlayer || false);
        setLinkUrl(initialData.linkUrl || '');
        setEmbedCode(initialData.embedCode || '');
        setTextContent(initialData.textContent || '');
        setExistingPdfUrl(initialData.fileUrl || '');
        setPdfClassification(initialData.pdfClassification || 'TEORIA');
        setIsLinkedToPreviousTheory(initialData.isLinkedToPreviousTheory || false);
      } else {
        // Reset
        setType('video');
        setTitle('');
        setVideoUrl('');
        setVideoPlatform('youtube');
        setUseAlternativePlayer(false);
        setLinkUrl('');
        setEmbedCode('');
        setTextContent('');
        setExistingPdfUrl('');
        setPdfFile(null);
        setPdfClassification('TEORIA');
        setIsLinkedToPreviousTheory(false);
      }
    }
  }, [isOpen, initialData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setLoading(true);

    const isActuallyLinked = type === 'pdf' && pdfClassification === 'QUESTÕES' && isLinkedToPreviousTheory;

    try {
      const data: Partial<CourseContent> = {
        title,
        type,
        lessonId,
        isLinkedToPreviousTheory: isActuallyLinked
      };

      if (type === 'video') {
        data.videoUrl = videoUrl;
        data.videoPlatform = videoPlatform;
        if (videoPlatform === 'youtube') {
            data.useAlternativePlayer = useAlternativePlayer;
        }
      } 
      else if (type === 'link') {
        data.linkUrl = linkUrl;
      }
      else if (type === 'text') {
        data.textContent = textContent;
      }
      else if (type === 'embed') {
        data.embedCode = embedCode;
      }
      else if (type === 'pdf') {
        let finalPdfUrl = existingPdfUrl;
        if (pdfFile) {
            finalPdfUrl = await courseService.uploadPDF(pdfFile);
        }
        data.fileUrl = finalPdfUrl;
        data.pdfClassification = pdfClassification;

        // Lógica de Identificação do "Pai" (Teoria Imediatamente Acima)
        if (isActuallyLinked) {
            const currentIndex = initialData ? contents.findIndex(c => c.id === initialData.id) : contents.length;
            let foundTheoryId = null;
            // Loop reverso para encontrar a teoria mais próxima
            for (let i = currentIndex - 1; i >= 0; i--) {
                const item = contents[i];
                if (item.pdfClassification === 'TEORIA' || item.pdfClassification === 'TEORIA_QUESTÕES') {
                    foundTheoryId = item.id;
                    break;
                }
            }
            data.linkedTheoryId = foundTheoryId;
        } else {
            data.linkedTheoryId = null;
        }
      }

      await onSave(data);
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar conteúdo.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-gray-800 flex justify-between items-center shrink-0 bg-zinc-900/50">
          <h2 className="text-xl font-bold text-white">
            {initialData ? 'Editar Conteúdo' : 'Adicionar Conteúdo'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Seleção de Tipo (Apenas na criação) */}
          {!initialData && (
            <div className="grid grid-cols-5 gap-2">
                {(['video', 'pdf', 'link', 'text', 'embed'] as ContentType[]).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`py-2 px-1 rounded text-[10px] font-bold uppercase transition-colors border ${type === t ? 'bg-red-600 border-red-600 text-white' : 'bg-black border-gray-800 text-gray-400 hover:border-gray-600'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>
          )}

          {/* Título Geral */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Título do Conteúdo <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none"
              placeholder="Ex: Videoaula 01 ou Material de Apoio"
              required
            />
          </div>

          {/* --- CAMPOS ESPECÍFICOS POR TIPO --- */}

          {/* VÍDEO */}
          {type === 'video' && (
            <div className="space-y-4 bg-black/20 p-4 rounded border border-gray-800">
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={videoPlatform === 'youtube'} onChange={() => setVideoPlatform('youtube')} className="accent-red-600" />
                        <span className="text-sm text-gray-300">YouTube</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={videoPlatform === 'panda'} onChange={() => setVideoPlatform('panda')} className="accent-red-600" />
                        <span className="text-sm text-gray-300">Panda Vídeo</span>
                    </label>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Link do Vídeo / Embed URL</label>
                    <div className="space-y-2">
                        <input 
                            type="url" 
                            value={videoUrl}
                            onChange={e => setVideoUrl(e.target.value)}
                            className="w-full bg-[#121418] border border-gray-700 rounded p-3 text-white focus:border-red-600 outline-none"
                            placeholder="https://..."
                        />
                        {videoPlatform === 'panda' && (
                            <button
                                type="button"
                                onClick={() => setShowPandaPicker(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold uppercase transition-colors"
                            >
                                <Search size={14} /> Buscar no Panda Video
                            </button>
                        )}
                    </div>
                </div>

                {videoPlatform === 'youtube' && (
                    <div className="flex items-center gap-3 p-3 bg-yellow-900/10 border border-yellow-900/30 rounded">
                        <input 
                            type="checkbox" 
                            id="altPlayer"
                            checked={useAlternativePlayer}
                            onChange={e => setUseAlternativePlayer(e.target.checked)}
                            className="w-4 h-4 accent-yellow-500 cursor-pointer"
                        />
                        <label htmlFor="altPlayer" className="text-sm text-yellow-500 font-bold cursor-pointer">
                            Ativar Player Alternativo (Segurança Anti-Cópia)
                        </label>
                    </div>
                )}
            </div>
          )}

          {/* PDF */}
          {type === 'pdf' && (
            <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center bg-black/20">
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept="application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs font-bold uppercase mb-2 flex items-center gap-2 transition-colors"
                    >
                        <Upload size={14} /> Selecionar PDF
                    </button>
                    {pdfFile ? (
                        <span className="text-green-500 text-sm font-bold">{pdfFile.name}</span>
                    ) : existingPdfUrl ? (
                        <span className="text-blue-400 text-sm">Arquivo atual cadastrado</span>
                    ) : (
                        <span className="text-gray-500 text-xs">Nenhum arquivo selecionado</span>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Classificação do PDF:</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'TEORIA', label: 'TEORIA', icon: FileText },
                            { id: 'QUESTÕES', label: 'QUESTÕES', icon: FileQuestion },
                            { id: 'TEORIA_QUESTÕES', label: 'AMBOS', icon: Layers }
                        ].map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setPdfClassification(option.id as any)}
                                className={`flex flex-col items-center gap-2 py-3 px-1 rounded text-[9px] font-bold uppercase transition-all border ${pdfClassification === option.id ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-black border-gray-800 text-gray-400 hover:border-gray-600'}`}
                            >
                                <option.icon size={18} />
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {pdfClassification === 'QUESTÕES' && (
                    <div className="flex items-center gap-3 p-3 bg-orange-900/10 border border-orange-900/30 rounded">
                        <input 
                            type="checkbox" 
                            id="linkTheory"
                            checked={isLinkedToPreviousTheory}
                            onChange={e => setIsLinkedToPreviousTheory(e.target.checked)}
                            className="w-4 h-4 accent-orange-500 cursor-pointer"
                        />
                        <label htmlFor="linkTheory" className="text-sm text-orange-500 font-bold cursor-pointer">
                            Vincular à Teoria imediatamente acima?
                        </label>
                    </div>
                )}

                {/* Preview da Identificação Visual */}
                <div className="p-4 bg-black/40 rounded-lg border border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Preview na Lista</span>
                        <div className="h-px flex-1 bg-gray-800 mx-4"></div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-[#1a1d24] border border-gray-700 rounded shadow-inner">
                        <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center border border-gray-700">
                            <FileText size={16} className="text-yellow-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="text-sm font-bold text-gray-200 truncate">{title || 'Título do Material'}</h4>
                                {(() => {
                                    let icon = <FileText size={10} />;
                                    let label = 'TEORIA';
                                    let colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';

                                    if (pdfClassification === 'QUESTÕES') {
                                        icon = <FileQuestion size={10} />;
                                        label = 'QUESTÕES';
                                        colorClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                                    } else if (pdfClassification === 'TEORIA_QUESTÕES') {
                                        icon = <Layers size={10} />;
                                        label = 'TEORIA + QUESTÕES';
                                        colorClass = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                                    }

                                    return (
                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-tighter ${colorClass}`}>
                                            {icon}
                                            {label}
                                        </div>
                                    );
                                })()}
                            </div>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">pdf</span>
                        </div>
                    </div>
                </div>

                <p className="text-[10px] text-gray-500 text-center">
                    * O arquivo receberá marca d&apos;água com CPF/Email do aluno automaticamente ao ser baixado.
                </p>
            </div>
          )}

          {/* LINK */}
          {type === 'link' && (
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">URL de Redirecionamento</label>
                <input 
                    type="url" 
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none"
                    placeholder="https://..."
                />
            </div>
          )}

          {/* TEXTO */}
          {type === 'text' && (
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Conteúdo do Texto</label>
                <RichTextEditor 
                    value={textContent} 
                    onChange={setTextContent} 
                />
            </div>
          )}

          {/* EMBED */}
          {type === 'embed' && (
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Código Embed (Iframe)</label>
                <textarea 
                    value={embedCode}
                    onChange={e => setEmbedCode(e.target.value)}
                    className="w-full h-32 bg-black border border-gray-800 rounded p-3 text-white focus:border-red-600 outline-none font-mono text-xs"
                    placeholder="<iframe src='...'></iframe>"
                />
            </div>
          )}

        </form>

        <div className="p-6 border-t border-gray-800 flex justify-end gap-3 shrink-0 bg-zinc-900/30">
            <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2 text-gray-400 hover:text-white font-bold uppercase text-xs"
            >
                Cancelar
            </button>
            <button 
                type="button" 
                onClick={handleSubmit} 
                disabled={loading} 
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-xs rounded disabled:opacity-50 flex items-center gap-2"
            >
                {loading ? (
                    <>
                        <Loader2 size={14} className="animate-spin" /> Salvando...
                    </>
                ) : (
                    <>
                        <Save size={14} /> Salvar Conteúdo
                    </>
                )}
            </button>
        </div>
      </div>

      {/* Modal do Panda Media Picker */}
      {showPandaPicker && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in zoom-in-95">
          <div className="bg-[#0a0b0d] border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-zinc-900/50">
              <div>
                <h3 className="text-lg font-bold text-white">Selecionar Vídeo do Panda</h3>
                <p className="text-xs text-gray-500">Escolha um vídeo da sua conta Panda Video</p>
              </div>
              <button onClick={() => setShowPandaPicker(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type="text"
                  placeholder="Pesquisar por título ou ID..."
                  value={pandaSearch}
                  onChange={e => setPandaSearch(e.target.value)}
                  className="w-full bg-black border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-red-600 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {loadingPanda ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="animate-spin text-red-600" size={32} />
                  <span className="text-gray-400 text-sm font-medium">Carregando...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Botão Voltar */}
                  {folderHistory.length > 0 && !pandaSearch && (
                    <button
                      onClick={handleGoBack}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all border border-transparent hover:border-zinc-800 mb-2"
                    >
                      <ChevronLeft size={18} />
                      <span className="text-sm font-bold uppercase tracking-wider">Voltar pasta</span>
                    </button>
                  )}

                  {/* Listagem de Pastas */}
                  {!pandaSearch && pandaFolders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => handleFolderClick(folder.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:bg-red-600/10 group-hover:text-red-500 transition-colors">
                        <Folder size={20} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-bold text-white group-hover:text-red-500 transition-colors">{folder.name}</div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Pasta de Vídeos</div>
                      </div>
                    </button>
                  ))}

                  {/* Listagem de Vídeos */}
                  {pandaVideos.length > 0 ? (
                    pandaVideos.map((video) => (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => handleSelectPandaVideo(video)}
                        className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:bg-red-600/10 group-hover:text-red-500 transition-colors">
                          <PlayCircle size={20} />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-bold text-white group-hover:text-red-500 transition-colors">{video.title}</div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-tighter">{video.id}</div>
                        </div>
                      </button>
                    ))
                  ) : !pandaFolders.length && (
                    <div className="text-center py-12">
                      <p className="text-gray-500 text-sm">Nenhum item encontrado.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-800 bg-zinc-900/20 text-center">
              <button 
                onClick={fetchPandaVideos}
                className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
              >
                Atualizar Lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}