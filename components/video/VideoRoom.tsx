import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, User, Shield, VolumeX, EyeOff, LogIn, Check, X, Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  subscribeToCall, addSignal, subscribeToSignals, updateCallStatus, 
  updateHostControls, clearSignals, requestEntry, approveEntry, rejectEntry 
} from '../../services/videoCallService';
import { ScheduledCall } from '../../types/videoCall';
import { toast } from 'react-hot-toast';

const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10,
};

export const VideoRoom: React.FC = () => {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { currentUser, userRole } = useAuth();
  
  const [call, setCall] = useState<ScheduledCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState<'lobby' | 'requesting' | 'accepted'>('lobby');
  const [needsPlayInteraction, setNeedsPlayInteraction] = useState(false);
  const [iceState, setIceState] = useState<RTCIceConnectionState>('new');
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const processedSignals = useRef<Set<string>>(new Set());

  const isAdmin = userRole === 'ADMIN' || userRole === 'COLLABORATOR';

  // Binding local stream to video element
  useEffect(() => {
    if (!loading && localVideoRef.current && localStream) {
      console.log("Binding local stream to video element");
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, loading]);

  // Binding remote stream to video element
  useEffect(() => {
    if (!loading && remoteVideoRef.current && remoteStream) {
      console.log("Binding remote stream to video element");
      remoteVideoRef.current.srcObject = remoteStream;
      
      // Handle mobile autoplay policy
      remoteVideoRef.current.play().catch(error => {
        console.warn("Autoplay blocked by browser. Showing interaction button.", error);
        setNeedsPlayInteraction(true);
      });
    }
  }, [remoteStream, loading]);

  useEffect(() => {
    if (!callId || !currentUser) return;

    let unsubscribeSignals: (() => void) | null = null;

    const unsubscribeCall = subscribeToCall(callId, (data) => {
      if (data) {
        setCall(data);
        
        // Update access status based on call status
        if (data.status === 'accepted' || isAdmin) {
          setAccessStatus('accepted');
        } else if (data.studentStatus === 'waiting') {
          setAccessStatus('requesting');
        }

        // Handle remote controls for students
        if (!isAdmin && localStreamRef.current) {
          if (data.forceMute) {
            localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
            setIsMicOn(false);
            toast.error("O mentor desativou seu microfone.");
          }
          if (data.forceHideCamera) {
            localStreamRef.current.getVideoTracks().forEach(track => track.enabled = false);
            setIsCamOn(false);
            toast.error("O mentor desativou sua câmera.");
          }
        }

        if (data.status === 'completed') {
          toast.success("Chamada encerrada.");
          navigate('/dashboard');
        }
      }
    });

    const startWebRTC = async () => {
      // Only start WebRTC if call is accepted or user is admin
      if (!isAdmin && accessStatus !== 'accepted') {
        console.log("Waiting for mentor to accept entry...");
        
        // Still need local stream for lobby preview
        if (!localStreamRef.current) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, 
              audio: true 
            });
            setLocalStream(stream);
            localStreamRef.current = stream;
          } catch (err) {
            console.error("Lobby media error:", err);
          }
        }
        setLoading(false);
        return;
      }

      try {
        console.log("Starting WebRTC session...");
        
        if (isAdmin) {
          console.log("Admin clearing old signals...");
          await clearSignals(callId);
        }

        // Initialize PeerConnection
        pc.current = new RTCPeerConnection(servers);
        console.log("RTCPeerConnection initialized");

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          }, 
          audio: true 
        });
        
        setLocalStream(stream);
        localStreamRef.current = stream;

        stream.getTracks().forEach((track) => {
          pc.current?.addTrack(track, stream);
        });

        pc.current.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            console.log("Remote stream received:", event.streams[0].id);
            setRemoteStream(event.streams[0]);
          }
        };

        pc.current.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("Local ICE candidate generated");
            addSignal(callId, 'candidate', event.candidate.toJSON(), currentUser.uid);
          }
        };

        pc.current.oniceconnectionstatechange = () => {
          if (pc.current) {
            const state = pc.current.iceConnectionState;
            console.log("ICE Connection State:", state);
            setIceState(state);
            
            if (state === 'failed') {
              toast.error("Falha na conexão de rede. Tente atualizar a página.");
            }
          }
        };

        unsubscribeSignals = subscribeToSignals(callId, async (signals) => {
          if (!pc.current) return;

          for (const signal of signals) {
            if (signal.senderId === currentUser.uid) continue;
            if (processedSignals.current.has(signal.id)) continue;
            
            processedSignals.current.add(signal.id);
            console.log(`Processing signal: ${signal.type}`);

            if (signal.type === 'offer' && !isAdmin) {
              await pc.current.setRemoteDescription(new RTCSessionDescription(signal.data));
              const answerDescription = await pc.current.createAnswer();
              await pc.current.setLocalDescription(answerDescription);
              await addSignal(callId, 'answer', answerDescription, currentUser.uid);
              
              // Process queued candidates
              while (iceCandidatesQueue.current.length > 0) {
                const candidate = iceCandidatesQueue.current.shift();
                if (candidate) await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
              }
            } else if (signal.type === 'answer' && isAdmin) {
              if (!pc.current.currentRemoteDescription) {
                await pc.current.setRemoteDescription(new RTCSessionDescription(signal.data));
                
                // Process queued candidates
                while (iceCandidatesQueue.current.length > 0) {
                  const candidate = iceCandidatesQueue.current.shift();
                  if (candidate) await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
              }
            } else if (signal.type === 'candidate') {
              const candidate = signal.data;
              if (pc.current.remoteDescription) {
                try {
                  await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                  console.error("Error adding ice candidate", e);
                }
              } else {
                iceCandidatesQueue.current.push(candidate);
              }
            }
          }
        });

        if (isAdmin) {
          // Admin creates offer
          const offerDescription = await pc.current.createOffer();
          await pc.current.setLocalDescription(offerDescription);
          await addSignal(callId, 'offer', offerDescription, currentUser.uid);
        }

        setLoading(false);
      } catch (error) {
        console.error("WebRTC Error:", error);
        toast.error("Erro ao acessar câmera/microfone.");
        setLoading(false);
      }
    };

    startWebRTC();

    return () => {
      unsubscribeCall();
      if (unsubscribeSignals) unsubscribeSignals();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (pc.current) {
        pc.current.close();
      }
    };
  }, [callId, currentUser, isAdmin, navigate]);

  const toggleMic = () => {
    if (localStream) {
      const newState = !isMicOn;
      localStream.getAudioTracks().forEach(track => track.enabled = newState);
      setIsMicOn(newState);
    }
  };

  const toggleCam = () => {
    if (localStream) {
      const newState = !isCamOn;
      localStream.getVideoTracks().forEach(track => track.enabled = newState);
      setIsCamOn(newState);
    }
  };

  const handleRequestEntry = async () => {
    if (callId) {
      try {
        await requestEntry(callId);
        setAccessStatus('requesting');
        toast.success("Solicitação enviada!");
      } catch (error) {
        toast.error("Erro ao enviar solicitação.");
      }
    }
  };

  const handleApproveEntry = async () => {
    if (callId) {
      try {
        await approveEntry(callId);
        toast.success("Aluno autorizado!");
      } catch (error) {
        toast.error("Erro ao autorizar aluno.");
      }
    }
  };

  const handleRejectEntry = async () => {
    if (callId) {
      try {
        await rejectEntry(callId);
        toast.success("Solicitação recusada.");
      } catch (error) {
        toast.error("Erro ao recusar solicitação.");
      }
    }
  };

  const endCall = async () => {
    if (isAdmin && callId) {
      await updateCallStatus(callId, 'completed');
    }
    window.close();
  };

  const handleForceMute = async () => {
    if (callId) await updateHostControls(callId, { forceMute: true });
  };

  const handleForceHideCamera = async () => {
    if (callId) await updateHostControls(callId, { forceHideCamera: true });
  };

  const handleForcePlay = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.play().then(() => {
        setNeedsPlayInteraction(false);
      }).catch(err => {
        console.error("Force play failed:", err);
      });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-4 z-[9999]">
        <Loader2 className="animate-spin text-[var(--plan-theme)]" size={48} />
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Iniciando Sala Virtual...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#09090b] overflow-hidden z-[9999] fixed inset-0">
      {/* Mentor Approval Banner */}
      {isAdmin && call?.requestEntry && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-zinc-900 border border-[var(--plan-theme)]/30 rounded-2xl p-4 shadow-2xl z-[100] flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--plan-theme)]/10 flex items-center justify-center">
              <User className="text-[var(--plan-theme)]" size={20} />
            </div>
            <div>
              <p className="text-white text-xs font-black uppercase tracking-widest">{call.studentName}</p>
              <p className="text-zinc-500 text-[10px] font-bold">Solicitando entrada...</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleRejectEntry}
              className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-zinc-700 flex items-center justify-center transition-all"
            >
              <X size={20} />
            </button>
            <button 
              onClick={handleApproveEntry}
              className="px-4 h-10 rounded-xl bg-[var(--plan-theme)] text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <Check size={16} />
              Aceitar
            </button>
          </div>
        </div>
      )}

      {/* Main Video Area */}
      <div className="flex-1 min-h-0 w-full p-2 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
        {/* Remote Video / Lobby Placeholder */}
        <div className="relative w-full h-full rounded-xl md:rounded-2xl overflow-hidden bg-black/50 flex items-center justify-center border border-zinc-800">
          {(!remoteStream || (!isAdmin && accessStatus !== 'accepted')) ? (
            <div className="flex flex-col items-center gap-6 p-8 text-center">
              <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-600 relative">
                <User size={48} />
                {!isAdmin && accessStatus === 'requesting' && (
                  <div className="absolute inset-0 border-2 border-[var(--plan-theme)] border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              
              <div className="space-y-2">
                <p className="text-white text-xs font-black uppercase tracking-widest">
                  {!isAdmin && accessStatus === 'lobby' ? 'Sala de Espera' : 
                   !isAdmin && accessStatus === 'requesting' ? 'Aguardando Autorização' : 
                   'Aguardando participante...'}
                </p>
                <p className="text-zinc-500 text-[10px] font-bold max-w-[200px] leading-relaxed">
                  {!isAdmin && accessStatus === 'lobby' ? 'Prepare-se para a mentoria. Teste sua câmera e microfone antes de entrar.' : 
                   !isAdmin && accessStatus === 'requesting' ? 'O mentor foi notificado. Por favor, aguarde um momento.' : 
                   'O link está ativo. O outro participante entrará em breve.'}
                </p>
              </div>

              {!isAdmin && accessStatus === 'lobby' && (
                <button 
                  onClick={handleRequestEntry}
                  className="px-8 py-4 bg-[var(--plan-theme)] text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[var(--plan-theme)]/20 hover:scale-105 transition-all flex items-center gap-3"
                >
                  <LogIn size={18} />
                  Pedir para Entrar
                </button>
              )}

              {!isAdmin && accessStatus === 'requesting' && (
                <div className="flex items-center gap-2 text-[var(--plan-theme)] text-[10px] font-black uppercase tracking-widest">
                  <Clock size={14} className="animate-pulse" />
                  Solicitação Pendente
                </div>
              )}
            </div>
          ) : (
            <>
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />

              {/* Autoplay Fallback Overlay */}
              {needsPlayInteraction && remoteStream && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
                  <button 
                    onClick={handleForcePlay}
                    className="px-6 py-3 bg-[var(--plan-theme)] text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[var(--plan-theme)]/40 flex items-center gap-2 animate-bounce"
                  >
                    <Mic size={16} />
                    Conectar Áudio e Vídeo
                  </button>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Clique para habilitar a mídia</p>
                </div>
              )}

              {/* ICE Failure Warning */}
              {(iceState === 'failed' || iceState === 'disconnected') && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl z-20 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                  Instabilidade na Rede
                </div>
              )}
              
              {/* Remote Info Overlay */}
              <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-white text-xs font-bold uppercase tracking-tight">
                  {isAdmin ? call?.studentName : 'Mentor'}
                </span>
              </div>

              {/* Admin Controls over Remote Video */}
              {isAdmin && remoteStream && (
                <div className="absolute top-6 right-6 flex gap-2">
                  <button 
                    onClick={handleForceMute}
                    className="w-10 h-10 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-[var(--plan-theme)] transition-all"
                    title="Mutar Aluno"
                  >
                    <VolumeX size={18} />
                  </button>
                  <button 
                    onClick={handleForceHideCamera}
                    className="w-10 h-10 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-[var(--plan-theme)] transition-all"
                    title="Ocultar Câmera do Aluno"
                  >
                    <EyeOff size={18} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Local Video */}
        <div className="relative w-full h-full rounded-xl md:rounded-2xl overflow-hidden bg-black/50 flex items-center justify-center border border-zinc-800">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
            <span className="text-white text-xs font-bold uppercase tracking-tight">Você (Local)</span>
          </div>
          {!isCamOn && (
            <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-600">
                <VideoOff size={48} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="shrink-0 w-full p-4 md:p-6 flex items-center justify-center gap-4 bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800 z-10 safe-area-pb">
        <button 
          onClick={toggleMic}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            isMicOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-[var(--plan-theme)] text-white'
          }`}
        >
          {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        <button 
          onClick={toggleCam}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            isCamOn ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-[var(--plan-theme)] text-white'
          }`}
        >
          {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
        </button>

        <div className="w-px h-8 bg-zinc-800 mx-2" />

        <button 
          onClick={endCall}
          className="w-14 h-14 rounded-2xl bg-[var(--plan-theme)] hover:brightness-110 text-white flex items-center justify-center transition-all shadow-lg shadow-[var(--plan-theme)]/20"
        >
          <PhoneOff size={24} />
        </button>

        {isAdmin && (
          <div className="absolute right-8 flex items-center gap-2 bg-[var(--plan-theme)]/10 border border-[var(--plan-theme)]/20 px-4 py-2 rounded-xl">
            <Shield size={14} className="text-[var(--plan-theme)]" />
            <span className="text-[var(--plan-theme)] text-[10px] font-black uppercase tracking-widest">Modo Mentor</span>
          </div>
        )}
      </div>
    </div>
  );
};
