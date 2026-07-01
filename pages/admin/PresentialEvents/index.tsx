import React, { useState, useEffect } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { PresentialEvent } from '../../../types/presentialEvent';
import { presentialEventService } from '../../../services/presentialEventService';
import { PresentialEventsList } from '../../../components/admin/presentialEvents/PresentialEventsList';
import { PresentialEventFormModal } from '../../../components/admin/presentialEvents/PresentialEventFormModal';
import { PresentialEventDetails } from '../../../components/admin/presentialEvents/PresentialEventDetails';

const AdminPresentialEvents: React.FC = () => {
  const [events, setEvents] = useState<PresentialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PresentialEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<PresentialEvent | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await presentialEventService.getEvents();
      setEvents(data);
    } catch (error) {
      console.error("Error loading presential events:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async () => {
    await loadEvents();
    setIsModalOpen(false);
  };

  const openNewEventModal = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const openEditEventModal = (event: PresentialEvent) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleViewDetails = (event: PresentialEvent) => {
    setViewingEvent(event);
  };

  if (viewingEvent) {
    return (
      <PresentialEventDetails 
        event={viewingEvent} 
        onBack={() => {
          setViewingEvent(null);
          loadEvents();
        }} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-red/10 rounded-lg">
            <MapPin className="text-brand-red" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Eventos Presenciais</h1>
            <p className="text-zinc-400 text-sm">Gerencie eventos presenciais e venda de ingressos</p>
          </div>
        </div>
        <button
          onClick={openNewEventModal}
          className="flex items-center gap-2 px-6 py-3 bg-brand-red hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-900/20 uppercase tracking-wider text-sm"
        >
          <Plus size={20} />
          AGENDAR EVENTO
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-red"></div>
        </div>
      ) : (
        <PresentialEventsList 
          events={events} 
          onEdit={openEditEventModal} 
          onView={handleViewDetails}
          onDeleteSuccess={loadEvents} 
        />
      )}

      {/* Modals */}
      {isModalOpen && (
        <PresentialEventFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveEvent}
          initialData={editingEvent}
        />
      )}
    </div>
  );
};

export default AdminPresentialEvents;
