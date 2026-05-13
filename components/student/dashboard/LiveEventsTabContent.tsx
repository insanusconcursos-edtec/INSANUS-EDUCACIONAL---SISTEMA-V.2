
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Radio, 
  User, 
  Calendar, 
  Clock, 
  ExternalLink,
  PlayCircle,
  AlertCircle,
  Video
} from 'lucide-react';
import { liveEventService } from '../../../services/liveEventService';
import { LiveEvent } from '../../../types/liveEvent';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LiveEventsTabContentProps {
  planId: string;
}

export const LiveEventsTabContent: React.FC<LiveEventsTabContentProps> = ({ planId }) => {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const allEvents = await liveEventService.getLiveEvents();
        // Filter by plan access and status
        const planEvents = allEvents.filter(event => {
          const hasPlanAccess = event.accessControl?.plans?.includes(planId);
          if (!hasPlanAccess) return false;
          
          // Show live, scheduled, or ended events with recordings
          return event.status === 'live' || 
                 event.status === 'scheduled' || 
                 (event.status === 'ended' && event.recordings && event.recordings.length > 0);
        });
        
        // Sort: Live events first, then by date/time
        const sorted = planEvents.sort((a, b) => {
          if (a.status === 'live' && b.status !== 'live') return -1;
          if (a.status !== 'live' && b.status === 'live') return 1;
          
          const dateA = new Date(`${a.eventDate}T${a.startTime}`);
          const dateB = new Date(`${b.eventDate}T${b.startTime}`);
          return dateA.getTime() - dateB.getTime();
        });

        setEvents(sorted);
      } catch (error) {
        console.error("Error fetching live events for plan:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [planId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <Radio className="w-10 h-10 animate-pulse mb-4 text-[var(--plan-theme)]" />
        <p className="text-[10px] font-black uppercase tracking-widest">Buscando transmissões...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-900/20 border border-dashed border-zinc-800 rounded-3xl">
        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl mb-6">
          <Radio className="w-10 h-10 text-zinc-700" />
        </div>
        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Sem Eventos Programados</h3>
        <p className="text-zinc-500 text-xs font-medium max-w-xs mx-auto">
          Não há eventos ao vivo ou transmissões agendadas para o seu plano no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
            <Radio className="w-5 h-5 text-[var(--plan-theme)]" />
          </div>
          Próximas Transmissões
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {events.map((event) => {
          const isLive = event.status === 'live';
          const isScheduled = event.status === 'scheduled';
          const isEnded = event.status === 'ended';
          const eventDateTime = new Date(`${event.eventDate}T${event.startTime}`);
          
          return (
            <div 
              key={event.id}
              className={`
                bg-zinc-900/40 border p-0 rounded-[32px] flex flex-col group transition-all duration-500 relative overflow-hidden
                ${isLive 
                  ? 'border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.15)] ring-1 ring-yellow-400/50' 
                  : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                }
              `}
            >
              {/* Thumbnail Section */}
              <div className="relative aspect-video w-full overflow-hidden rounded-t-[31px]">
                {event.thumbnailUrl ? (
                  <img 
                    src={event.thumbnailUrl} 
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <Video className="w-12 h-12 text-zinc-700" />
                  </div>
                )}
                
                {/* Status Badge Overlay */}
                <div className="absolute top-4 left-4">
                  {isLive && (
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-yellow-400 rounded-full shadow-lg shadow-yellow-400/20">
                      <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-black uppercase tracking-[0.15em]">AO VIVO AGORA</span>
                    </div>
                  )}
                  {isScheduled && (
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-500 rounded-full shadow-lg shadow-blue-500/20">
                      <Calendar size={12} className="text-white" />
                      <span className="text-[10px] font-black text-white uppercase tracking-[0.15em]">AGENDADO</span>
                    </div>
                  )}
                  {isEnded && (
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-zinc-600 rounded-full">
                      <Clock size={12} className="text-white" />
                      <span className="text-[10px] font-black text-white uppercase tracking-[0.15em]">ENCERRADO</span>
                    </div>
                  )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60" />
              </div>

              {/* Content Section */}
              <div className="p-8 flex flex-col flex-1">
                <div className="mb-6">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 leading-[0.95] group-hover:text-yellow-400 transition-colors">
                    {event.title}
                  </h3>
                  {event.subtitle && (
                    <p className="text-zinc-500 text-[13px] font-medium line-clamp-1">
                      {event.subtitle}
                    </p>
                  )}
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-zinc-400 group-hover:text-zinc-300 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                      <User size={14} className="text-zinc-500" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest">InSAnuS Concursos</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Calendar size={16} className="text-zinc-600" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        {format(eventDateTime, "dd MMM", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Clock size={16} className="text-zinc-600" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        {event.startTime}h
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto">
                  <Link 
                    to={isScheduled || isLive || (isEnded && event.recordings?.length) ? `/app/eventos-ao-vivo/sala/${event.id}` : '#'}
                    state={{ returnPath: `/app/dashboard?tab=live` }}
                    onClick={(e) => {
                      if (isEnded && !event.recordings?.length) {
                        e.preventDefault();
                      }
                    }}
                    className={`
                      w-full py-5 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all duration-300
                      ${isLive 
                        ? 'bg-yellow-400 text-black hover:bg-yellow-500 shadow-xl shadow-yellow-400/20 active:scale-95' 
                        : isScheduled
                          ? 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700 active:scale-95'
                          : isEnded && event.recordings?.length
                            ? 'bg-zinc-100 text-black hover:bg-white active:scale-95'
                            : 'bg-zinc-900 text-zinc-700 cursor-not-allowed border border-zinc-800'
                      }
                    `}
                  >
                    {isLive ? (
                      <>
                        <PlayCircle size={20} fill="currentColor" fillOpacity={0.2} />
                        ACESSAR AGORA
                      </>
                    ) : isScheduled ? (
                      <>
                        <Clock size={20} />
                        AGUARDANDO INÍCIO
                      </>
                    ) : isEnded && event.recordings?.length ? (
                      <>
                        <Video size={20} />
                        ASSISTIR GRAVAÇÃO
                      </>
                    ) : (
                      <>
                        <Video size={20} className="grayscale" />
                        EVENTO ENCERRADO
                      </>
                    )}
                  </Link>
                  
                  {isScheduled && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-zinc-600 animate-pulse">
                      <div className="w-1 h-1 bg-zinc-600 rounded-full" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Sala de espera liberada</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
