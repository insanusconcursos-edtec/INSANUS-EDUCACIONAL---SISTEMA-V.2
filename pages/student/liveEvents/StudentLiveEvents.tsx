import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Calendar, Clock, Lock, Play } from 'lucide-react';
import { LiveEvent } from '../../../types/liveEvent';
import { liveEventService } from '../../../services/liveEventService';
import { useAuth } from '../../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Student } from '../../../services/userService';

export const StudentLiveEvents: React.FC = () => {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userAccess, setUserAccess] = useState<{
    plans: string[];
    courses: string[];
    classes: string[];
    simulated: string[];
    isolatedProducts: string[];
  }>({ plans: [], courses: [], classes: [], simulated: [], isolatedProducts: [] });
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      loadUserDataAndEvents();
    }
  }, [currentUser]);

  const loadUserDataAndEvents = async () => {
    setLoading(true);
    try {
      const plans: string[] = [];
      const courses: string[] = [];
      const classes: string[] = [];
      const simulated: string[] = [];
      const isolatedProducts: string[] = [];

      // 1. Load user data to determine access
      const userDoc = await getDoc(doc(db, 'users', currentUser!.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as Student;
        
        // Build access lists based on user data
        if (userData.access) {
          userData.access.forEach(item => {
            if (!item.isActive) return;
            
            // Check if access is still valid by date
            const now = new Date();
            const endDate = item.endDate?.toDate ? item.endDate.toDate() : new Date(item.endDate);
            if (endDate < now) return;

            if (item.type === 'plan') plans.push(item.targetId);
            if (item.type === 'course') courses.push(item.targetId);
            if (item.type === 'presential_class') classes.push(item.targetId);
            if (item.type === 'simulated_class') simulated.push(item.targetId);
            if (item.type === 'isolated_product' || item.type === 'live_event') isolatedProducts.push(item.targetId);
          });
        }

        // Also check legacy courses array
        if (userData.courses) {
          userData.courses.forEach(c => {
            if (c.active) {
              if (c.expiresAt) {
                const expires = new Date(c.expiresAt);
                if (expires < new Date()) return;
              }
              if (!courses.includes(c.courseId)) {
                courses.push(c.courseId);
              }
            }
          });
        }

        setUserAccess({ plans, courses, classes, simulated, isolatedProducts });
      }

      // 2. Load all events
      const allEvents = await liveEventService.getLiveEvents();
      
      // 3. Filter events based on access rules
      const allowedEvents = allEvents.filter(event => {
        const userHasAccess = hasAccess(event, { plans, courses, classes, simulated, isolatedProducts });

        // Se o evento está encerrado, só aparece se o usuário tiver acesso (via qualquer método)
        if (event.status === 'ended') {
          return userHasAccess;
        }

        // Para eventos futuros ou ao vivo, mostramos se o usuário tiver acesso (ou for público)
        return userHasAccess;
      });
      setEvents(allowedEvents);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasAccess = (event: LiveEvent, access: { plans: string[], courses: string[], classes: string[], simulated: string[], isolatedProducts: string[] }) => {
    if (event.isPublic) return true;
    
    const isIsolatedForUser = event.isIsolatedProduct && access.isolatedProducts.includes(event.id);
    if (isIsolatedForUser) return true;

    const { plans, onlineCourses, presentialClasses, simulated } = event.accessControl;
    
    // If no specific access control is set, it might be open to everyone, or closed to everyone.
    // Let's assume if it's not isolated and has no restrictions, it's open.
    if (plans.length === 0 && onlineCourses.length === 0 && presentialClasses.length === 0 && simulated.length === 0) {
      return true; 
    }

    // Check if user has any of the required access
    const hasPlanAccess = plans.some(id => access.plans.includes(id));
    const hasCourseAccess = onlineCourses.some(id => access.courses.includes(id));
    const hasClassAccess = presentialClasses.some(id => access.classes.includes(id));
    const hasSimulatedAccess = simulated.some(id => access.simulated.includes(id));

    return hasPlanAccess || hasCourseAccess || hasClassAccess || hasSimulatedAccess;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-purple-600/20 rounded-xl">
          <Video className="text-purple-500" size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Eventos ao Vivo</h1>
          <p className="text-zinc-400 text-sm">Acompanhe as transmissões ao vivo e interaja em tempo real.</p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
          <Video size={48} className="mx-auto text-zinc-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Nenhum evento agendado</h3>
          <p className="text-zinc-400">Fique de olho, em breve teremos novas transmissões.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const userHasAccess = hasAccess(event, userAccess);
            
            return (
              <div 
                key={event.id} 
                className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col group hover:border-zinc-700 transition-colors"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-zinc-800">
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
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg ${
                      event.status === 'live' ? 'bg-red-600 text-white animate-pulse' :
                      event.status === 'scheduled' ? 'bg-blue-600 text-white' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {event.status === 'live' ? 'AO VIVO AGORA' : event.status === 'scheduled' ? 'AGENDADO' : 'ENCERRADO'}
                    </span>
                  </div>

                  {/* Access Overlay */}
                  {!userHasAccess && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="bg-zinc-900/90 p-4 rounded-xl flex flex-col items-center text-center border border-zinc-700">
                        <Lock className="text-zinc-400 mb-2" size={24} />
                        <span className="text-white font-bold text-sm">Acesso Restrito</span>
                        {event.isIsolatedProduct && (
                          <button className="mt-3 px-4 py-2 bg-brand-red hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors">
                            COMPRAR ACESSO
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">{event.title}</h3>
                  {event.subtitle && (
                    <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{event.subtitle}</p>
                  )}
                  
                  <div className="mt-auto space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-zinc-300 text-sm">
                      <Calendar size={16} className="text-zinc-500" />
                      <span>{event.eventDate.split('-').reverse().join('/')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300 text-sm">
                      <Clock size={16} className="text-zinc-500" />
                      <span>{event.startTime} {event.timezoneLocation ? `- ${event.timezoneLocation}` : ''}</span>
                    </div>
                  </div>

                  {userHasAccess && (
                    <button
                      onClick={() => navigate(`/app/eventos-ao-vivo/sala/${event.id}`)}
                      disabled={event.status === 'ended' && (!event.recordings || event.recordings.length === 0)}
                      className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        event.status === 'live' 
                          ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20' 
                          : event.status === 'scheduled'
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                            : (event.recordings && event.recordings.length > 0)
                              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20'
                              : 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {event.status === 'live' ? (
                        <>
                          <Play size={18} fill="currentColor" />
                          ENTRAR NA SALA
                        </>
                      ) : event.status === 'scheduled' ? (
                        'AGUARDANDO INÍCIO'
                      ) : (event.recordings && event.recordings.length > 0) ? (
                        <>
                          <Play size={18} fill="currentColor" />
                          ASSISTIR GRAVAÇÃO
                        </>
                      ) : (
                        'EVENTO ENCERRADO'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
