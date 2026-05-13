import React from 'react';
import { Calendar, Clock } from 'lucide-react';

interface StudentLiveWaitingRoomProps {
  thumbnailUrl?: string;
  eventDate: string;
  startTime: string;
  timezoneLocation?: string;
}

export const StudentLiveWaitingRoom: React.FC<StudentLiveWaitingRoomProps> = ({
  thumbnailUrl,
  eventDate,
  startTime,
  timezoneLocation
}) => {
  return (
    <div className="relative w-full h-full bg-zinc-950 rounded-2xl overflow-hidden flex items-center justify-center border border-zinc-800 shadow-2xl">
      {/* Background Section (Thumbnail) */}
      <div className="absolute inset-0 z-0">
        {thumbnailUrl ? (
          <>
            <img 
              src={thumbnailUrl} 
              alt="Background" 
              className="w-full h-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-black/30"></div>
          </>
        ) : (
          <div className="w-full h-full bg-zinc-900"></div>
        )}
      </div>
      
      {/* Central Waiting Card */}
      <div className="relative z-[100] flex flex-col items-center justify-center text-center p-8 md:p-12 bg-black/80 backdrop-blur-xl rounded-[40px] border border-white/10 max-w-lg mx-auto shadow-[0_40px_100px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-700">
        {/* Red Clock Icon */}
        <div className="mb-8 w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center border border-brand-red/20">
          <div className="w-12 h-12 bg-brand-red rounded-full flex items-center justify-center shadow-lg shadow-brand-red/20">
            <Clock className="text-white w-6 h-6" strokeWidth={3} />
          </div>
        </div>
        
        <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-3">
          Evento Agendado
        </h2>
        
        <p className="text-zinc-400 text-sm font-medium mb-10 max-w-xs leading-relaxed">
          A transmissão ainda não começou. Aguarde o início do evento.
        </p>
        
        {/* Date/Time Info Bar */}
        <div className="flex flex-col md:flex-row items-center gap-4 bg-zinc-900/60 px-8 py-4 rounded-2xl border border-zinc-800/50 w-full">
          <div className="flex items-center gap-3 text-white">
            <Calendar size={18} className="text-brand-red" />
            <span className="text-base font-bold">
              {eventDate ? eventDate.split('-').reverse().join('/') : '--/--/----'}
            </span>
          </div>
          
          <div className="hidden md:block w-px h-6 bg-zinc-700"></div>
          
          <div className="flex items-center gap-3 text-white">
            <Clock size={18} className="text-brand-red" />
            <span className="text-base font-bold">
              {startTime || '--:--'} {timezoneLocation ? `- ${timezoneLocation}` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
