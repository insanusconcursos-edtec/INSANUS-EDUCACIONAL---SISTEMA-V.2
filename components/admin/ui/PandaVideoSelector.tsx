import React, { useState, useEffect } from 'react';
import { X, Search, Folder, ChevronLeft, PlayCircle, Loader2 } from 'lucide-react';
import { pandaService } from '../../../services/pandaService';
import { extractPandaVideoId } from '../../../utils/pandaUtils';

interface PandaVideoSelectorProps {
  onSelect: (video: any) => void;
  onClose: () => void;
  initialFolderId?: string | null;
}

export const PandaVideoSelector: React.FC<PandaVideoSelectorProps> = ({ onSelect, onClose, initialFolderId }) => {
  const [pandaVideos, setPandaVideos] = useState<{id: string, title: string, video_player_url?: string, length?: number, folder_id?: string | null}[]>([]);
  const [pandaFolders, setPandaFolders] = useState<{id: string, name: string}[]>([]);
  const [loadingPanda, setLoadingPanda] = useState(false);
  const [pandaSearch, setPandaSearch] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId || null);
  const [folderHistory, setFolderHistory] = useState<string[]>(initialFolderId ? ['root'] : []);

  useEffect(() => {
    if (pandaSearch) {
        const timer = setTimeout(() => {
            fetchPandaVideos(pandaSearch);
        }, 500);
        return () => clearTimeout(timer);
    } else {
        fetchPandaExplorer(currentFolderId);
    }
  }, [pandaSearch, currentFolderId]);

  const fetchPandaVideos = async (search: string = '') => {
    setLoadingPanda(true);
    try {
      const videos = await pandaService.listVideos(search);
      setPandaVideos(videos);
      setPandaFolders([]);
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
    setPandaSearch('');
  };

  const handleGoBack = () => {
    const newHistory = [...folderHistory];
    const lastFolder = newHistory.pop();
    setFolderHistory(newHistory);
    setCurrentFolderId(lastFolder === 'root' ? null : (lastFolder || null));
    setPandaSearch('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in zoom-in-95">
      <div className="bg-[#0a0b0d] border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-zinc-900/50">
          <div>
            <h3 className="text-lg font-bold text-white">Selecionar Vídeo do Panda</h3>
            <p className="text-xs text-gray-500">Escolha um vídeo da sua conta Panda Video</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
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
              {folderHistory.length > 0 && !pandaSearch && (
                <button
                  onClick={handleGoBack}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all border border-transparent hover:border-zinc-800 mb-2"
                >
                  <ChevronLeft size={18} />
                  <span className="text-sm font-bold uppercase tracking-wider">Voltar pasta</span>
                </button>
              )}

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

                  {pandaVideos.length > 0 ? (
                    pandaVideos.map((video) => {
                      const displayId = extractPandaVideoId(video) || "ID indisponível";
                      return (
                        <button
                          key={video.id}
                          type="button"
                          onClick={() => onSelect(video)}
                          className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:bg-red-600/10 group-hover:text-red-500 transition-colors">
                            <PlayCircle size={20} />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="font-bold text-white group-hover:text-red-500 transition-colors">{video.title}</div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-tighter">{displayId}</div>
                          </div>
                        </button>
                      );
                    })
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
            onClick={() => pandaSearch ? fetchPandaVideos(pandaSearch) : fetchPandaExplorer(currentFolderId)}
            className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
          >
            Atualizar Lista
          </button>
        </div>
      </div>
    </div>
  );
};

export default PandaVideoSelector;
