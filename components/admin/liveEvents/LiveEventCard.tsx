import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveEvent } from '../../../types/liveEvent';
import { Edit, Settings, Trash2, Video } from 'lucide-react';
import { liveEventService } from '../../../services/liveEventService';

interface LiveEventCardProps {
  event: LiveEvent;
  onEdit: (event: LiveEvent) => void;
  onDeleteSuccess?: () => void;
  onManage: (event: LiveEvent) => void;
}

export const LiveEventCard: React.FC<LiveEventCardProps> = ({ event, onEdit, onDeleteSuccess, onManage }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!event.id) return;
    setIsDeleting(true);
    try {
      await liveEventService.deleteLiveEvent(event.id, event.thumbnailUrl);
      setShowDeleteConfirm(false);
      if (onDeleteSuccess) onDeleteSuccess(); 
    } catch (error) {
      console.error("Erro ao excluir evento:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-lg transition-transform hover:scale-[1.02]">
      {/* Thumbnail */}
      <div className="w-full h-48 bg-zinc-800 relative">
        {event.thumbnailUrl ? (
          <img 
            src={event.thumbnailUrl} 
            alt={event.title} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <Video size={48} />
          </div>
        )}
        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white">
          {event.status === 'live' ? (
            <span className="text-red-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              AO VIVO
            </span>
          ) : event.status === 'scheduled' ? (
            <span className="text-blue-400">AGENDADO</span>
          ) : (
            <span className="text-gray-400">ENCERRADO</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-lg font-bold text-white line-clamp-2 mb-1">{event.title}</h3>
        {event.subtitle && (
          <p className="text-sm text-zinc-400 line-clamp-1 mb-3">{event.subtitle}</p>
        )}
        
        <div className="mt-auto pt-4 flex flex-col gap-2 text-sm text-zinc-300">
          <div className="flex items-center justify-between">
            <span>Data:</span>
            <span className="font-medium text-white">{event.eventDate.split('-').reverse().join('/')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Horário:</span>
            <span className="font-medium text-white">{event.startTime} {event.timezoneLocation ? `- ${event.timezoneLocation}` : ''}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-zinc-800 grid grid-cols-2 gap-2">
        <button 
          onClick={() => onEdit(event)}
          className="flex items-center justify-center gap-2 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Edit size={14} />
          EDITAR
        </button>
        <button 
          onClick={() => onManage(event)}
          className="flex items-center justify-center gap-2 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Settings size={14} />
          GERENCIAR
        </button>
        <button 
          onClick={() => navigate(`/admin/eventos-ao-vivo/sala/${event.id}`)}
          className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors col-span-2"
        >
          <Video size={14} />
          SALA DE TRANSMISSÃO
        </button>
        <button 
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center justify-center gap-2 py-2 px-3 bg-red-900/30 hover:bg-red-900/50 text-red-500 rounded-lg text-xs font-medium transition-colors col-span-2"
        >
          <Trash2 size={14} />
          EXCLUIR
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 flex flex-col gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Trash2 className="text-red-500" size={24} />
                Excluir Evento ao Vivo?
              </h2>
              <p className="text-gray-400 text-sm">
                Você está prestes a excluir o evento <strong className="text-white">{event.title}</strong>. Esta ação removerá a transmissão e desconectará o evento de todos os recursos vinculados.
              </p>
              <p className="text-gray-300 text-sm font-semibold">
                Esta ação não pode ser desfeita. Deseja continuar?
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800 bg-gray-900/50">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir Evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
