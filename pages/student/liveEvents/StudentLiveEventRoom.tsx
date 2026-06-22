import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Users, VideoOff, FileText, ShieldAlert } from 'lucide-react';
import { doc, onSnapshot, getDoc, collection } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { LiveEvent, LiveActiveUser } from '../../../types/liveEvent';
import { useAuth } from '../../../contexts/AuthContext';
import { StudentLiveChat } from '../../../components/student/lives/room/StudentLiveChat';
import { StudentLiveWaitingRoom } from '../../../components/student/lives/room/StudentLiveWaitingRoom';
import { AdminLivePlayer } from '../../../components/admin/liveEvents/room/AdminLivePlayer';
import { StudentLiveRecording } from '../../../components/student/lives/room/StudentLiveRecording';
import { joinLiveEvent, leaveLiveEvent } from '../../../services/liveChatService';
import toast from 'react-hot-toast';
import { useStudyContext } from '../../../contexts/StudyContext';

export const StudentLiveEventRoom: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userData, loading: authLoading } = useAuth();
  const { setCurrentProduct } = useStudyContext();
  
  const returnPath = location.state?.returnPath || '/app/eventos-ao-vivo';
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAccess, setUserAccess] = useState<{
    plans: string[];
    courses: string[];
    classes: string[];
    simulated: string[];
    isolatedProducts: string[];
  }>({ plans: [], courses: [], classes: [], simulated: [], isolatedProducts: [] });
  const [viewerCount, setViewerCount] = useState(0);
  const [isChatBlocked, setIsChatBlocked] = useState(false);

  // Update current product for support
  useEffect(() => {
    if (event) {
      setCurrentProduct({
        type: 'evento_ao_vivo',
        id: event.id!,
        name: event.title
      });
    }
    return () => {
      setCurrentProduct(null);
    };
  }, [event, setCurrentProduct]);

  const formatShortName = (fullName?: string | null) => {
    if (!fullName) return 'Aluno';
    const nameParts = fullName.trim().split(' ');
    return nameParts.slice(0, 2).join(' '); // Pega apenas o 1º e 2º nome
  };

  const resolvedName = formatShortName(userData?.name || currentUser?.displayName || currentUser?.email);

  // Heartbeat de Presença
  useEffect(() => {
    // A Trava: Bloqueia a execução se o contexto ainda estiver carregando os dados do Firestore
    if (authLoading || !currentUser || !eventId) return;

    const userPresence = {
      uid: currentUser.uid,
      name: resolvedName,
      email: currentUser.email || userData?.email || '',
      photoUrl: userData?.photoUrl || currentUser.photoURL || ''
    };

    joinLiveEvent(eventId, userPresence);

    return () => {
      leaveLiveEvent(eventId, currentUser.uid);
    };
  }, [eventId, currentUser, resolvedName, userData, authLoading]);

  // Listener de Usuários Online e Contagem
  useEffect(() => {
    if (!eventId) return;

    const presenceRef = collection(db, 'live_events', eventId, 'presence');
    const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
      setViewerCount(snapshot.size);
    }, (error) => {
      console.error("Error listening to presence:", error);
    });

    return () => unsubscribe();
  }, [eventId]);

  // Listener de Moderação em Tempo Real (Banimento e Bloqueio de Chat)
  useEffect(() => {
    if (!eventId || !currentUser) return;

    const myPresenceRef = doc(db, 'live_events', eventId, 'presence', currentUser.uid);
    const unsubscribe = onSnapshot(myPresenceRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Bloqueio de Chat
        setIsChatBlocked(!!data.isChatBlocked);

        // Banimento
        if (data.isBanned) {
          toast.error("Você foi removido deste evento pelo administrador.", {
            icon: <ShieldAlert className="text-red-500" />,
            duration: 5000
          });
          navigate(returnPath);
        }
      }
    }, (error) => {
      console.error("Error listening to personal presence:", error);
    });

    return () => unsubscribe();
  }, [eventId, currentUser, navigate]);

  useEffect(() => {
    if (!currentUser) return;
    const loadUserAccess = async () => {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        const plans: string[] = [];
        const courses: string[] = [];
        const classes: string[] = [];
        const simulated: string[] = [];
        const isolatedProducts: string[] = [];

        if (userData?.access) {
          userData.access.forEach((item: any) => {
            if (!item.isActive) return;
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

        // Legacy courses
        if (userData?.courses) {
          userData.courses.forEach((c: any) => {
            if (c.active) {
              if (c.expiresAt && new Date(c.expiresAt) < new Date()) return;
              if (!courses.includes(c.courseId)) courses.push(c.courseId);
            }
          });
        }

        setUserAccess({ plans, courses, classes, simulated, isolatedProducts });
      }
    };
    loadUserAccess();
  }, [currentUser]);

  const hasAccess = () => {
    if (!event) return false;
    if (event.isPublic) return true;
    
    const isIsolatedForUser = event.isIsolatedProduct && userAccess.isolatedProducts.includes(event.id!);
    if (isIsolatedForUser) return true;

    const { plans, onlineCourses, presentialClasses, simulated } = event.accessControl;
    
    if (plans.length === 0 && onlineCourses.length === 0 && presentialClasses.length === 0 && simulated.length === 0) {
      return true;
    }

    const hasPlanAccess = plans.some(id => userAccess.plans.includes(id));
    const hasCourseAccess = onlineCourses.some(id => userAccess.courses.includes(id));
    const hasClassAccess = presentialClasses.some(id => userAccess.classes.includes(id));
    const hasSimulatedAccess = simulated.some(id => userAccess.simulated.includes(id));

    return hasPlanAccess || hasCourseAccess || hasClassAccess || hasSimulatedAccess;
  };

  useEffect(() => {
    if (!eventId || !currentUser) return;

    // Listen to event changes in real-time
    const eventRef = doc(db, 'live_events', eventId);
    const unsubscribe = onSnapshot(eventRef, (docSnap) => {
      if (docSnap.exists()) {
        setEvent({ id: docSnap.id, ...docSnap.data() } as LiveEvent);
      } else {
        setEvent(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to event:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [eventId, currentUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-red"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-zinc-400">
        <VideoOff size={48} className="mb-4 opacity-20" />
        <h2 className="text-xl font-bold text-white mb-2">Evento não encontrado</h2>
        <button 
          onClick={() => navigate(returnPath)}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors mt-4"
        >
          Voltar para a lista
        </button>
      </div>
    );
  }

  if (event.status === 'ended') {
    // Se o usuário possui acesso, mostra a Gravação
    if (hasAccess()) {
      return (
         <div className="max-w-7xl mx-auto py-6 px-4">
            <button 
              onClick={() => navigate(returnPath)}
              className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white transition-colors mb-6 uppercase tracking-wider"
            >
              <ArrowLeft size={18} />
              Voltar para a lista
            </button>
            <h1 className="text-2xl font-bold text-white mb-6">{event.title} - GRAVAÇÃO</h1>
            <StudentLiveRecording event={event} />
         </div>
      );
    }
    
    // Aluno comum (sem produto isolado)
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <div className="text-center">
          <VideoOff size={48} className="mx-auto text-zinc-600 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Evento Encerrado</h2>
          <p className="text-gray-400 mb-6">Esta transmissão ao vivo já foi finalizada.</p>
          <button 
            onClick={() => navigate(returnPath)}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-bold uppercase text-sm"
          >
            Voltar para a lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-zinc-950 p-3 lg:p-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(returnPath)}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">{event.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${event.status === 'live' ? 'bg-brand-red animate-pulse' : event.status === 'scheduled' ? 'bg-blue-500' : 'bg-zinc-500'}`}></span>
                <span className="text-xs font-medium text-zinc-400">
                  {event.status === 'live' ? 'AO VIVO' : event.status === 'scheduled' ? 'AGENDADO' : 'ENCERRADO'}
                </span>
              </div>
              
              {event.showViewers && event.status === 'live' && (
                <>
                  <div className="w-1 h-1 bg-zinc-700 rounded-full"></div>
                  <div className="flex items-center gap-1 text-xs text-zinc-400">
                    <Users size={12} />
                    <span>{viewerCount} assistindo</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
        {/* Left Column: Video Player AREA */}
        <div className="w-full lg:w-2/3 xl:w-3/4 flex flex-col bg-black overflow-hidden shrink-0 lg:shrink">
          {/* Action Area: Player or Waiting Room */}
          <div className="flex-1 relative bg-zinc-950 overflow-hidden min-h-[40vh] md:min-h-0">
            {event.status === 'scheduled' && (
              <div className="absolute inset-0 z-[100] animate-in fade-in duration-700">
                <StudentLiveWaitingRoom 
                  thumbnailUrl={event.thumbnailUrl} 
                  eventDate={event.eventDate} 
                  startTime={event.startTime} 
                  timezoneLocation={event.timezoneLocation}
                />
              </div>
            )}
            
            {event.status === 'live' && (
              <div className="w-full h-full bg-black">
                <AdminLivePlayer event={event} />
              </div>
            )}
            
            {event.status === 'ended' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
                <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 border border-zinc-800 shadow-2xl">
                  <VideoOff size={40} className="text-zinc-600" />
                </div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Evento Encerrado</h2>
                <p className="text-zinc-500 font-medium tracking-wide">A transmissão ao vivo já terminou.</p>
                <button 
                  onClick={() => navigate(returnPath)}
                  className="mt-8 px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all font-black uppercase text-xs tracking-widest border border-zinc-700"
                >
                  Voltar para a lista
                </button>
              </div>
            )}
          </div>

          {/* Mobile Chat Trigger or Info (Optional) */}
          <div className="lg:hidden p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <Users size={16} className="text-zinc-500" />
                <span className="text-xs font-bold text-zinc-400">{viewerCount} online</span>
             </div>
             {event.status === 'live' && (
               <span className="flex items-center gap-2 px-2 py-1 bg-brand-red font-black text-[9px] text-white rounded-full animate-pulse">
                 AO VIVO
               </span>
             )}
          </div>

          {/* Materials Section - Desktop only Scroll area if chat takes space */}
          {event.materials && event.materials.length > 0 && (
            <div className="hidden lg:block p-4 lg:p-6 bg-zinc-950 border-t border-zinc-800 overflow-y-auto max-h-[25%] shrink-0">
              <h3 className="text-[10px] font-black text-zinc-500 mb-4 flex items-center gap-3 uppercase tracking-[0.3em]">
                <FileText size={18} className="text-yellow-400" />
                Materiais de Apoio
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {event.materials.map((material) => (
                  <a
                    key={material.id}
                    href={material.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800 hover:border-yellow-400/50 hover:bg-zinc-900 transition-all flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-yellow-400 transition-colors">
                      <FileText size={20} className="text-zinc-400 group-hover:text-black transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-white font-bold truncate text-sm uppercase tracking-tight" title={material.title}>
                        {material.title}
                      </h4>
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1 block">Download Disponível</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Chat */}
        <div className="w-full lg:w-1/3 xl:w-1/4 bg-zinc-950 flex flex-col flex-1 lg:h-auto border-t lg:border-t-0 lg:border-l border-zinc-800 overflow-hidden">
          {event.isChatEnabled && event.status === 'live' ? (
            <StudentLiveChat 
              eventId={event.id!} 
              status={event.status} 
              isChatBlocked={isChatBlocked} 
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800 shadow-xl">
                <VideoOff size={32} className="text-zinc-500" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Chat Desativado</h3>
              <p className="text-zinc-500 text-sm max-w-[200px] mx-auto font-medium">
                {event.status === 'scheduled' 
                  ? 'O chat será liberado automaticamente assim que a transmissão iniciar.' 
                  : 'O chat não está disponível para este evento.'}
              </p>
              
              {event.status === 'scheduled' && (
                <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800 animate-pulse">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Aguardando Início</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


    </div>
  );
};
