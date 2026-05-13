import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, MessageSquare, Play, Square } from 'lucide-react';
import { liveEventService } from '../../services/liveEventService';
import { LiveEvent } from '../../types/liveEvent';
import { AdminLivePlayer } from '../../components/admin/liveEvents/room/AdminLivePlayer';
import { AdminLiveChat } from '../../components/admin/liveEvents/room/AdminLiveChat';
import { AdminLiveUserList } from '../../components/admin/liveEvents/room/AdminLiveUserList';
import { joinLiveEvent, leaveLiveEvent } from '../../services/liveChatService';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

export const AdminLiveRoom: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, userData, loading: authLoading } = useAuth();
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [isEventLoading, setIsEventLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'users'>('chat');
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  const formatShortName = (fullName?: string | null) => {
    if (!fullName) return 'Administrador';
    const nameParts = fullName.trim().split(' ');
    return nameParts.slice(0, 2).join(' '); // Pega apenas o 1º e 2º nome
  };

  const resolvedName = formatShortName(userData?.name || currentUser?.displayName || currentUser?.email);

  // Heartbeat de Presença (Admin também conta como presente)
  useEffect(() => {
    // A Trava: Bloqueia a execução se o contexto ainda estiver carregando os dados do Firestore
    if (authLoading || !currentUser || !id) return;

    const userPresence = {
      uid: currentUser.uid,
      name: resolvedName,
      email: currentUser.email || userData?.email || '',
      photoUrl: userData?.photoUrl || currentUser.photoURL || ''
    };

    joinLiveEvent(id, userPresence);

    return () => {
      leaveLiveEvent(id, currentUser.uid);
    };
  }, [id, currentUser, resolvedName, userData, authLoading]);

  // Listener de Contagem de Viewers
  useEffect(() => {
    if (!id) return;

    const presenceRef = collection(db, 'live_events', id, 'presence');
    const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
      setViewerCount(snapshot.size);
    }, (error) => {
      console.error("Error listening to presence:", error);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (id) {
      loadEvent(id);
    }
  }, [id]);

  const loadEvent = async (eventId: string) => {
    setIsEventLoading(true);
    try {
      const data = await liveEventService.getLiveEventById(eventId);
      setEvent(data);
    } catch (error) {
      console.error("Error loading event:", error);
    } finally {
      setIsEventLoading(false);
    }
  };

  const handleStartEvent = async () => {
    if (!event?.id) return;
    setIsProcessing(true);
    try {
      await liveEventService.startLiveEvent(event.id);
      await loadEvent(event.id);
    } catch (error) {
      console.error("Error starting event:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndEvent = async () => {
    if (!event?.id) return;
    if (window.confirm("Tem certeza que deseja encerrar este evento? Esta ação não pode ser desfeita.")) {
      setIsProcessing(true);
      try {
        await liveEventService.endLiveEvent(event.id);
        await loadEvent(event.id);
      } catch (error) {
        console.error("Error ending event:", error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  if (isEventLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-500">
        <p className="text-xl">Evento não encontrado.</p>
        <button 
          onClick={() => navigate('/admin/eventos-ao-vivo')}
          className="mt-4 text-red-500 hover:text-red-400 flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/eventos-ao-vivo')}
            className="flex items-center gap-2 px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-wider">Voltar ao Painel</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{event.title}</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                event.status === 'live' ? 'bg-red-500/20 text-red-500' :
                event.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                'bg-zinc-500/20 text-zinc-400'
              }`}>
                {event.status === 'live' ? 'AO VIVO' : event.status === 'scheduled' ? 'AGENDADO' : 'ENCERRADO'}
              </span>
              {event.showViewers && (
                <span className="text-zinc-400 flex items-center gap-1">
                  <Users size={14} /> Viewers: {viewerCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Player */}
        <div className="flex-[2] p-4 flex flex-col overflow-y-auto bg-black/20">
          <AdminLivePlayer event={event} />
        </div>

        {/* Right Column: Chat & Users */}
        <div className="flex-[1] flex flex-col border-l border-zinc-800 bg-zinc-900 min-w-[350px]">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800 shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'chat' ? 'text-white border-b-2 border-red-500' : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <MessageSquare size={16} />
              CHAT
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'users' ? 'text-white border-b-2 border-red-500' : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <Users size={16} />
              USUÁRIOS
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden p-4">
            {activeTab === 'chat' ? (
              <AdminLiveChat eventId={event.id} />
            ) : (
              <AdminLiveUserList eventId={event.id} />
            )}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-zinc-900 border-t border-zinc-800 p-4 flex items-center justify-center shrink-0">
        {event.status === 'scheduled' && (
          <button
            onClick={handleStartEvent}
            disabled={isProcessing}
            className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-green-900/20 disabled:opacity-50"
          >
            <Play size={20} />
            {isProcessing ? 'INICIANDO...' : 'INICIAR O EVENTO'}
          </button>
        )}
        
        {event.status === 'live' && (
          <button
            onClick={handleEndEvent}
            disabled={isProcessing}
            className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-900/20 animate-pulse disabled:opacity-50 disabled:animate-none"
          >
            <Square size={20} />
            {isProcessing ? 'ENCERRANDO...' : 'ENCERRAR O EVENTO'}
          </button>
        )}

        {event.status === 'ended' && (
          <div className="px-8 py-3 bg-zinc-800 text-zinc-400 font-bold rounded-lg">
            Evento Encerrado
          </div>
        )}
      </div>
    </div>
  );
};
