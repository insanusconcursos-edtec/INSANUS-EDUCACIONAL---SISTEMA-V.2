import React from 'react';
import { LiveEvent } from '../../../types/liveEvent';
import { LiveEventCard } from './LiveEventCard';

interface LiveEventsListProps {
  events: LiveEvent[];
  onEdit: (event: LiveEvent) => void;
  onDeleteSuccess?: () => void;
  onManage: (event: LiveEvent) => void;
}

export const LiveEventsList: React.FC<LiveEventsListProps> = ({ events, onEdit, onDeleteSuccess, onManage }) => {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <p className="text-lg">Nenhum evento ao vivo agendado.</p>
        <p className="text-sm mt-2">Clique em &quot;+ AGENDAR EVENTO&quot; para criar um novo.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {events.map((event) => (
        <LiveEventCard 
          key={event.id} 
          event={event} 
          onEdit={onEdit} 
          onDeleteSuccess={onDeleteSuccess} 
          onManage={onManage}
        />
      ))}
    </div>
  );
};
