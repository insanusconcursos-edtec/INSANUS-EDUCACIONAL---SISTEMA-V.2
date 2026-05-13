import React, { useState, useEffect, useRef } from 'react';
import { X, Video, MessageSquare, FileText, Upload, Trash2, Plus, ChevronUp, ChevronDown, Save } from 'lucide-react';
import { LiveEvent, LiveEventMaterial, LiveEventRecording } from '../../../types/liveEvent';
import { liveEventService } from '../../../services/liveEventService';
import toast from 'react-hot-toast';

interface LiveEventManageModalProps {
  eventId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LiveEventManageModal: React.FC<LiveEventManageModalProps> = ({ eventId, isOpen, onClose }) => {
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [videoLink, setVideoLink] = useState('');
  const [useAlternativePlayer, setUseAlternativePlayer] = useState(false);
  const [isChatEnabled, setIsChatEnabled] = useState(true);
  const [showViewers, setShowViewers] = useState(true);
  const [recordings, setRecordings] = useState<LiveEventRecording[]>([]);

  useEffect(() => {
    if (isOpen && eventId) {
      loadEvent(eventId);
    } else {
      setEvent(null);
    }
  }, [isOpen, eventId]);

  const loadEvent = async (id: string) => {
    setLoading(true);
    try {
      const data = await liveEventService.getLiveEventById(id);
      if (data) {
        setEvent(data);
        setVideoLink(data.videoLink || data.videoUrl || '');
        setUseAlternativePlayer(data.useAlternativePlayer || false);
        setIsChatEnabled(data.isChatEnabled ?? true);
        setShowViewers(data.showViewers ?? true);
        setRecordings(data.recordings || []);
      }
    } catch (error) {
      console.error("Error loading event:", error);
      toast.error("Erro ao carregar evento.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!event?.id) return;
    setSaving(true);
    try {
      await liveEventService.updateLiveEventSettings(event.id, {
        videoLink,
        useAlternativePlayer,
        isChatEnabled,
        showViewers,
        recordings
      });
      toast.success("Configurações salvas com sucesso!");
      await loadEvent(event.id);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event?.id) return;

    setIsUploadingMaterial(true);
    try {
      const title = file.name.replace(/\.[^/.]+$/, "");
      await liveEventService.uploadLiveMaterial(event.id, file, title);
      toast.success("Material enviado com sucesso!");
      await loadEvent(event.id);
    } catch (error) {
      console.error("Error uploading material:", error);
      toast.error("Erro ao fazer upload do material.");
    } finally {
      setIsUploadingMaterial(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteMaterial = async (material: LiveEventMaterial) => {
    if (!event?.id) return;
    
    if (window.confirm(`Tem certeza que deseja excluir o material "${material.title}"?`)) {
      try {
        await liveEventService.deleteLiveMaterial(event.id, material.id, material.url);
        toast.success("Material excluído com sucesso!");
        await loadEvent(event.id);
      } catch (error) {
        console.error("Error deleting material:", error);
        toast.error("Erro ao excluir o material.");
      }
    }
  };

  const addRecording = () => {
    setRecordings([...recordings, { id: Date.now().toString(), title: '', url: '' }]);
  };

  const updateRecording = (id: string, field: keyof LiveEventRecording, value: string) => {
    setRecordings(recordings.map(rec => rec.id === id ? { ...rec, [field]: value } : rec));
  };

  const removeRecording = (id: string) => {
    setRecordings(recordings.filter(rec => rec.id !== id));
  };

  const handleRenameMaterial = async (materialId: string, newTitle: string) => {
    if (!event?.id) return;
    try {
      const updatedMaterials = event.materials?.map(m => 
        m.id === materialId ? { ...m, title: newTitle } : m
      ) || [];
      
      await liveEventService.updateLiveEventSettings(event.id, {
        materials: updatedMaterials
      });
      await loadEvent(event.id);
      toast.success("Material renomeado com sucesso!");
    } catch (error) {
      console.error("Error renaming material:", error);
      toast.error("Erro ao renomear material.");
    }
  };

  const handleReorderMaterial = async (materialId: string, direction: 'up' | 'down') => {
    if (!event?.id || !event.materials) return;
    
    const currentIndex = event.materials.findIndex(m => m.id === materialId);
    if (
      (direction === 'up' && currentIndex === 0) || 
      (direction === 'down' && currentIndex === event.materials.length - 1)
    ) return;

    const newMaterials = [...event.materials];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Swap
    [newMaterials[currentIndex], newMaterials[targetIndex]] = [newMaterials[targetIndex], newMaterials[currentIndex]];
    
    // Update order property
    const updatedMaterials = newMaterials.map((m, idx) => ({ ...m, order: idx }));

    try {
      await liveEventService.updateLiveEventSettings(event.id, {
        materials: updatedMaterials
      });
      await loadEvent(event.id);
    } catch (error) {
      console.error("Error reordering material:", error);
      toast.error("Erro ao reordenar material.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-[120px] inset-x-0 bottom-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl max-h-full flex flex-col shadow-2xl">
        
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Gerenciar Evento</h2>
            {event && <p className="text-sm text-zinc-400 mt-1">{event.title}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
            </div>
          ) : !event ? (
            <div className="text-center py-20 text-zinc-400">Evento não encontrado.</div>
          ) : (
            <>
              {/* 1. Bloco de Transmissão */}
              <div className="bg-black border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Video size={20} className="text-red-500" />
                  Transmissão
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Link de Transmissão (Panda ou YouTube)</label>
                    <input
                      type="url"
                      value={videoLink}
                      onChange={(e) => setVideoLink(e.target.value)}
                      placeholder="Ex: https://www.youtube.com/watch?v=..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={useAlternativePlayer}
                      onChange={(e) => setUseAlternativePlayer(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-zinc-600 text-red-600 focus:ring-red-600 bg-black"
                    />
                    <div>
                      <span className="block text-white font-medium">Utilizar Player Alternativo (Apenas YouTube)</span>
                      <span className="block text-xs text-zinc-500 mt-1">Máscara de segurança que remove os controles nativos e impede o compartilhamento do link original do YouTube.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 2. Bloco de Interação */}
              <div className="bg-black border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <MessageSquare size={20} className="text-blue-500" />
                  Interação
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={isChatEnabled}
                      onChange={(e) => setIsChatEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 text-red-600 focus:ring-red-600 bg-black"
                    />
                    <span className="text-white font-medium">Habilitar Chat ao Vivo</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={showViewers}
                      onChange={(e) => setShowViewers(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 text-red-600 focus:ring-red-600 bg-black"
                    />
                    <span className="text-white font-medium">Exibir Viewers (Quantidade ao vivo)</span>
                  </label>
                </div>
              </div>

              {/* 3. Bloco de Gravação (Produto Isolado) */}
              {event.isIsolatedProduct && (
                <div className="bg-black border border-zinc-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Video size={20} className="text-purple-500" />
                      Gravações (Produto Isolado)
                    </h3>
                    <button
                      onClick={addRecording}
                      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <Plus size={14} />
                      ADICIONAR GRAVAÇÃO
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {recordings.length === 0 ? (
                      <p className="text-sm text-zinc-500 italic">Nenhuma gravação adicionada.</p>
                    ) : (
                      recordings.map((rec, index) => (
                        <div key={rec.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                          <span className="text-zinc-500 font-bold text-xs w-6 text-center">{index + 1}</span>
                          <input
                            type="text"
                            value={rec.title}
                            onChange={(e) => updateRecording(rec.id, 'title', e.target.value)}
                            placeholder="Título da Aula"
                            className="flex-1 bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                          />
                          <input
                            type="text"
                            value={rec.url}
                            onChange={(e) => updateRecording(rec.id, 'url', e.target.value)}
                            placeholder="Link do Vídeo ou Iframe (Panda/YouTube)"
                            className="flex-1 bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                          />
                          <button
                            onClick={() => removeRecording(rec.id)}
                            className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remover gravação"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* 4. Bloco de Materiais (PDF) */}
              <div className="bg-black border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileText size={20} className="text-emerald-500" />
                    Materiais de Apoio (PDF)
                  </h3>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingMaterial}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {isUploadingMaterial ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          ENVIANDO...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          UPLOAD PDF
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {(!event.materials || event.materials.length === 0) ? (
                  <div className="text-center py-8 bg-zinc-900/50 rounded-lg border border-zinc-800 border-dashed">
                    <FileText size={32} className="mx-auto text-zinc-600 mb-3" />
                    <p className="text-sm text-zinc-400">Nenhum material adicionado.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {event.materials.sort((a, b) => (a.order || 0) - (b.order || 0)).map((material, index) => (
                      <div key={material.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 flex items-center justify-between group">
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          <div className="flex flex-col gap-1">
                            <button 
                              onClick={() => handleReorderMaterial(material.id, 'up')}
                              disabled={index === 0}
                              className="text-zinc-600 hover:text-white disabled:opacity-30 transition-colors"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button 
                              onClick={() => handleReorderMaterial(material.id, 'down')}
                              disabled={index === event.materials!.length - 1}
                              className="text-zinc-600 hover:text-white disabled:opacity-30 transition-colors"
                            >
                              <ChevronDown size={16} />
                            </button>
                          </div>
                          <div className="p-2 bg-zinc-800 rounded-lg shrink-0">
                            <FileText size={16} className="text-emerald-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <input
                              type="text"
                              value={material.title}
                              onChange={(e) => {
                                const newMaterials = [...event.materials!];
                                const idx = newMaterials.findIndex(m => m.id === material.id);
                                if (idx > -1) {
                                  newMaterials[idx].title = e.target.value;
                                  setEvent({ ...event, materials: newMaterials });
                                }
                              }}
                              onBlur={(e) => handleRenameMaterial(material.id, e.target.value)}
                              className="bg-transparent border-none text-white font-medium text-sm truncate w-full focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1"
                              title={material.title}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <a 
                            href={material.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-blue-400 hover:text-blue-300 px-3 py-1.5 bg-blue-400/10 rounded-lg transition-colors"
                          >
                            VER
                          </a>
                          <button
                            onClick={() => handleDeleteMaterial(material)}
                            className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir material"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-zinc-800 shrink-0 flex justify-end gap-4 bg-black/50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-zinc-400 hover:text-white transition-colors"
            disabled={saving}
          >
            FECHAR
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={saving || !event}
            className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                SALVANDO...
              </>
            ) : (
              <>
                <Save size={18} />
                SALVAR CONFIGURAÇÕES
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
