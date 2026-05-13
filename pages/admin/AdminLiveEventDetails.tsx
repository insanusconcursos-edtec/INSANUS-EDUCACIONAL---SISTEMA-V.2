import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, FileText, MessageSquare, Video, Trash2, Upload, Plus } from 'lucide-react';
import { LiveEvent, LiveEventMaterial } from '../../types/liveEvent';
import { liveEventService } from '../../services/liveEventService';
import { LiveEventFormModal } from '../../components/admin/liveEvents/LiveEventFormModal';

type TabType = 'info' | 'materials' | 'chat';

export const AdminLiveEventDetails: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (eventId) {
      loadEvent(eventId);
    }
  }, [eventId]);

  const loadEvent = async (id: string) => {
    setLoading(true);
    try {
      const data = await liveEventService.getLiveEventById(id);
      setEvent(data);
    } catch (error) {
      console.error("Error loading live event:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async (data: LiveEvent, thumbnailFile?: File) => {
    try {
      if (data.id) {
        await liveEventService.updateLiveEvent(data.id, data, thumbnailFile);
        await loadEvent(data.id);
        setIsEditModalOpen(false);
      }
    } catch (error) {
      console.error("Error saving live event:", error);
      throw error;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event?.id) return;

    setIsUploadingMaterial(true);
    try {
      const title = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      await liveEventService.uploadMaterial(event.id, file, title);
      await loadEvent(event.id); // Reload to get the new material
    } catch (error) {
      console.error("Error uploading material:", error);
      alert("Erro ao fazer upload do material.");
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
        await liveEventService.deleteMaterial(event.id, material);
        await loadEvent(event.id); // Reload to update the list
      } catch (error) {
        console.error("Error deleting material:", error);
        alert("Erro ao excluir o material.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20 text-zinc-400">
        Evento não encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/eventos-ao-vivo')}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="p-3 bg-red-600/10 rounded-lg">
            <Video className="text-red-500" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white uppercase tracking-tight">{event.title}</h1>
            <p className="text-zinc-400 text-sm">{event.eventDate.split('-').reverse().join('/')} às {event.startTime} {event.timezoneLocation ? `- ${event.timezoneLocation}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            event.status === 'live' ? 'bg-red-500/20 text-red-500' :
            event.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
            'bg-zinc-800 text-zinc-400'
          }`}>
            {event.status === 'live' ? 'AO VIVO' : event.status === 'scheduled' ? 'AGENDADO' : 'ENCERRADO'}
          </span>
          <button
            onClick={() => window.open(`/admin/eventos-ao-vivo/sala/${event.id}`, '_blank')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            <Video size={20} />
            SALA DE TRANSMISSÃO
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors relative ${
            activeTab === 'info' ? 'text-white' : 'text-zinc-400 hover:text-zinc-300'
          }`}
        >
          <Info size={18} />
          INFORMAÇÕES
          {activeTab === 'info' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors relative ${
            activeTab === 'materials' ? 'text-white' : 'text-zinc-400 hover:text-zinc-300'
          }`}
        >
          <FileText size={18} />
          MATERIAIS DE APOIO
          {activeTab === 'materials' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors relative ${
            activeTab === 'chat' ? 'text-white' : 'text-zinc-400 hover:text-zinc-300'
          }`}
        >
          <MessageSquare size={18} />
          CHAT AO VIVO
          {activeTab === 'chat' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Detalhes do Evento</h2>
                <p className="text-zinc-400 text-sm">Informações gerais sobre a transmissão.</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                EDITAR INFORMAÇÕES
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold mb-1">Título</span>
                  <p className="text-white">{event.title}</p>
                </div>
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold mb-1">Subtítulo</span>
                  <p className="text-white">{event.subtitle || '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs text-zinc-500 uppercase font-bold mb-1">Data</span>
                    <p className="text-white">{event.eventDate.split('-').reverse().join('/')}</p>
                  </div>
                  <div>
                    <span className="block text-xs text-zinc-500 uppercase font-bold mb-1">Horário</span>
                    <p className="text-white">{event.startTime} {event.timezoneLocation ? `- ${event.timezoneLocation}` : ''}</p>
                  </div>
                </div>
                <div>
                  <span className="block text-xs text-zinc-500 uppercase font-bold mb-1">Produto Isolado</span>
                  <p className="text-white">{event.isIsolatedProduct ? 'Sim' : 'Não'}</p>
                </div>
              </div>
              
              <div>
                <span className="block text-xs text-zinc-500 uppercase font-bold mb-2">Capa do Evento</span>
                {event.thumbnailUrl ? (
                  <img 
                    src={event.thumbnailUrl} 
                    alt={event.title} 
                    className="w-full max-w-sm rounded-lg border border-zinc-800 aspect-video object-cover"
                  />
                ) : (
                  <div className="w-full max-w-sm aspect-video bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-600 border border-zinc-700">
                    <Video size={48} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Materiais de Apoio</h2>
                <p className="text-zinc-400 text-sm">Faça o upload de arquivos para os alunos baixarem durante a transmissão.</p>
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingMaterial}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {isUploadingMaterial ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      ENVIANDO...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      ADICIONAR MATERIAL
                    </>
                  )}
                </button>
              </div>
            </div>

            {(!event.materials || event.materials.length === 0) ? (
              <div className="text-center py-12 bg-zinc-800/50 rounded-lg border border-zinc-800 border-dashed">
                <FileText size={48} className="mx-auto text-zinc-600 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Nenhum material adicionado</h3>
                <p className="text-zinc-400">Clique no botão acima para adicionar o primeiro material.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {event.materials.map((material) => (
                  <div key={material.id} className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 flex items-start justify-between group">
                    <div className="flex items-start gap-3 overflow-hidden">
                      <div className="p-2 bg-zinc-700 rounded-lg shrink-0">
                        <FileText size={20} className="text-zinc-300" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-white font-medium truncate" title={material.title}>
                          {material.title}
                        </h4>
                        <a 
                          href={material.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 hover:underline mt-1 inline-block"
                        >
                          Visualizar arquivo
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteMaterial(material)}
                      className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Excluir material"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="text-center py-10">
            <MessageSquare size={48} className="mx-auto text-zinc-600 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Moderação do Chat</h3>
            <p className="text-zinc-400 mb-6">Acompanhe e modere as mensagens dos alunos durante a transmissão.</p>
            <button 
              onClick={() => window.open(`/admin/eventos-ao-vivo/sala/${event.id}`, '_blank')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2 mx-auto"
            >
              <Video size={18} />
              IR PARA A SALA DE TRANSMISSÃO
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <LiveEventFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEvent}
        initialData={event}
      />
    </div>
  );
};
