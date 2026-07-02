import React from 'react';
import { Edit2, Trash2, Users, MapPin, Calendar, Clock, Ticket } from 'lucide-react';
import { PresentialEvent } from '../../../types/presentialEvent';
import { presentialEventService } from '../../../services/presentialEventService';
import { toast } from 'react-hot-toast';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

interface PresentialEventsListProps {
  events: PresentialEvent[];
  onEdit: (event: PresentialEvent) => void;
  onView: (event: PresentialEvent) => void;
  onDeleteSuccess: () => void;
}

export const PresentialEventsList: React.FC<PresentialEventsListProps> = ({ 
  events, 
  onEdit, 
  onView,
  onDeleteSuccess 
}) => {
  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este evento?')) return;
    try {
      await presentialEventService.deleteEvent(id);
      toast.success('Evento excluído com sucesso!');
      onDeleteSuccess();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error('Erro ao excluir evento');
    }
  };

  const getLocationLabel = (event: PresentialEvent) => {
    if (event.locationType === 'POLO_RI') return 'Polo INSANUS CONCURSOS (Rio Branco/AC)';
    if (event.locationType === 'POLO_PV') return 'Polo GABARITO CONCURSOS (Porto Velho/RO)';
    return event.customLocation || 'Outro';
  };

  if (events.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
        <MapPin className="mx-auto text-zinc-700 mb-4" size={48} />
        <h3 className="text-xl font-bold text-white mb-2">Nenhum evento agendado</h3>
        <p className="text-zinc-500">Comece agendando seu primeiro evento presencial.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {events.map((event) => (
        <div key={event.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col group hover:border-brand-red/50 transition-all duration-300">
          {/* Cover Image */}
          <div className="relative aspect-video bg-zinc-800 overflow-hidden">
            {event.coverImage ? (
              <img 
                src={event.coverImage} 
                alt={event.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <MapPin size={48} />
              </div>
            )}
            <div className="absolute top-3 right-3 flex gap-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                event.status === 'ACTIVE' ? 'bg-emerald-500 text-white' : 'bg-zinc-700 text-zinc-300'
              }`}>
                {event.status === 'ACTIVE' ? 'Ativo' : 'Finalizado'}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="p-5 flex-1 flex flex-col">
            <div className="flex-1">
              <h3 className="text-lg font-black text-white uppercase leading-tight mb-1">{event.title}</h3>
              {event.subtitle && <p className="text-zinc-500 text-xs mb-4 line-clamp-1 italic">{event.subtitle}</p>}

              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                  <Calendar size={14} className="text-brand-red" />
                  <span className="font-bold uppercase tracking-wider">
                    {formatInTimeZone(event.date instanceof Date ? event.date : (event.date as any).toDate(), 'UTC', "dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                  <Clock size={14} className="text-brand-red" />
                  <span className="font-bold tracking-wider">{event.startTime}h</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                  <MapPin size={14} className="text-brand-red" />
                  <span className="font-bold tracking-tight truncate" title={getLocationLabel(event)}>
                    {getLocationLabel(event)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                  <Ticket size={14} className="text-brand-red" />
                  <span className="font-bold tracking-wider">{event.totalTickets} Ingressos (Cadeiras)</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-5 border-t border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => onView(event)}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest bg-zinc-800 px-3 py-2 rounded-lg"
              >
                <Users size={14} />
                Ver Alunos
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEdit(event)}
                  className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                  title="Editar Evento"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => event.id && handleDelete(event.id)}
                  className="p-2 text-zinc-500 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-all"
                  title="Excluir Evento"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
