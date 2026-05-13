import React, { useState, useEffect } from 'react';
import { Plus, Video } from 'lucide-react';
import { LiveEvent } from '../../types/liveEvent';
import { liveEventService } from '../../services/liveEventService';
import { LiveEventsList } from '../../components/admin/liveEvents/LiveEventsList';
import { LiveEventFormModal } from '../../components/admin/liveEvents/LiveEventFormModal';
import { LiveEventManageModal } from '../../components/admin/liveEvents/LiveEventManageModal';

export const AdminLiveEvents: React.FC = () => {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LiveEvent | null>(null);
  const [managingEventId, setManagingEventId] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await liveEventService.getLiveEvents();
      setEvents(data);
    } catch (error) {
      console.error("Error loading live events:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async (data: LiveEvent, thumbnailFile?: File) => {
    try {
      if (data.id) {
        await liveEventService.updateLiveEvent(data.id, data, thumbnailFile);
      } else {
        await liveEventService.createLiveEvent(data, thumbnailFile);
      }
      await loadEvents();
    } catch (error) {
      console.error("Error saving live event:", error);
      throw error;
    }
  };

  const openNewEventModal = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const openEditEventModal = (event: LiveEvent) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const openManageModal = (event: LiveEvent) => {
    if (event.id) {
      setManagingEventId(event.id);
      setIsManageModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-600/10 rounded-lg">
            <Video className="text-red-500" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Eventos ao Vivo</h1>
            <p className="text-zinc-400 text-sm">Gerencie as transmissões ao vivo da plataforma</p>
          </div>
        </div>
        <button
          onClick={openNewEventModal}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-900/20"
        >
          <Plus size={20} />
          AGENDAR EVENTO
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      ) : (
        <LiveEventsList 
          events={events} 
          onEdit={openEditEventModal} 
          onDeleteSuccess={loadEvents} 
          onManage={openManageModal}
        />
      )}

      {/* Modals */}
      <LiveEventFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        initialData={editingEvent}
      />

      <LiveEventManageModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        eventId={managingEventId}
      />
    </div>
  );
};
