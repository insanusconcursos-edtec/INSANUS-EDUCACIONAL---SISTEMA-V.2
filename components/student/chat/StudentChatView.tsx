import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User, MessageSquare, Loader2, CheckCheck, Headphones, ArrowLeft, Smile, Paperclip, Reply, Edit2, X, MoreVertical, Trash2, Video, Calendar, ExternalLink, Ban, Image as ImageIcon
} from 'lucide-react';
import { getOrCreateCall, subscribeToMessages, sendMessage, editMessage, deleteMessage } from '../../../services/chatService';
import { subscribeToScheduledCalls } from '../../../services/videoCallService';
import { ScheduledCall } from '../../../types/videoCall';
import { getMentorById } from '../../../services/mentorService';
import { Mentor, Message } from '../../../types/chat';
import { useAuth } from '../../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { doc, getDoc } from 'firebase/firestore';
import { db, storage } from '../../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-hot-toast';
import EmojiPicker, { Theme } from 'emoji-picker-react';

interface StudentChatViewProps {
  planId: string;
  linkedMentorIds: string[];
}

const StudentChatView: React.FC<StudentChatViewProps> = ({ planId, linkedMentorIds }) => {
  const { currentUser, userData } = useAuth();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeVideoCalls, setActiveVideoCalls] = useState<ScheduledCall[]>([]);
  
  // Advanced Chat States
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Image Upload Preview Flow
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCaption, setPreviewCaption] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close emoji picker and menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch linked mentors
  useEffect(() => {
    const fetchMentors = async () => {
      setLoading(true);
      try {
        const mentorPromises = linkedMentorIds.map(id => getMentorById(id));
        const results = await Promise.all(mentorPromises);
        setMentors(results.filter((m): m is Mentor => m !== null));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (linkedMentorIds.length > 0) {
      fetchMentors();
    } else {
      setLoading(false);
    }
  }, [linkedMentorIds]);

  // Subscribe to Video Calls
  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = subscribeToScheduledCalls({ studentId: currentUser.uid }, (calls) => {
      // Filter only scheduled or active calls
      const relevant = calls.filter(c => c.status === 'scheduled' || c.status === 'active');
      setActiveVideoCalls(relevant);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Handle mentor selection and call creation
  const handleSelectMentor = async (mentor: Mentor) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let studentName = userData?.name || currentUser.displayName || 'Aluno';
      let studentPhoto = userData?.photoURL || userData?.photoUrl || userData?.photo || currentUser.photoURL || '';

      // Fallback: if name is still 'Aluno' or empty, try fetching directly from Firestore
      if (studentName === 'Aluno' || !studentName) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          studentName = data.name || studentName;
          studentPhoto = data.photoURL || data.photoUrl || data.photo || studentPhoto;
        }
      }

      const id = await getOrCreateCall(
        planId,
        currentUser.uid,
        studentName,
        mentor.id,
        mentor.name,
        studentPhoto,
        mentor.photoUrl
      );
      setCallId(id);
      setSelectedMentor(mentor);
    } catch (error) {
      console.error(error);
      alert("Erro ao abrir conversa.");
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to messages
  useEffect(() => {
    if (!callId) return;

    const unsubscribe = subscribeToMessages(callId, (updatedMessages) => {
      setMessages(updatedMessages);
    });
    return () => unsubscribe();
  }, [callId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!callId || !currentUser || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      if (editingMessage) {
        await editMessage(callId, editingMessage.id, newMessage.trim());
        setEditingMessage(null);
      } else {
        await sendMessage(
          callId, 
          currentUser.uid, 
          'student', 
          newMessage.trim(),
          replyingTo?.id,
          replyToPreviewText(replyingTo)
        );
        setReplyingTo(null);
      }
      setNewMessage('');
    } catch (error) {
      console.error(error);
      toast.error("Erro ao processar mensagem.");
    } finally {
      setSending(false);
    }
  };

  const replyToPreviewText = (msg: Message | null) => {
    if (!msg) return undefined;
    const text = msg.text.length > 50 ? msg.text.substring(0, 50) + '...' : msg.text;
    return text;
  };

  const onEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  const cancelPreview = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewCaption('');
  };

  const confirmImageUpload = async () => {
    if (!previewFile || !callId || !currentUser) return;

    setIsUploadingImage(true);
    try {
      const storageRef = ref(storage, `chat_images/${callId}/${Date.now()}_${previewFile.name}`);
      await uploadBytes(storageRef, previewFile);
      const imageUrl = await getDownloadURL(storageRef);

      await sendMessage(
        callId,
        currentUser.uid,
        'student',
        previewCaption.trim(),
        undefined,
        undefined,
        imageUrl
      );
      toast.success("Imagem enviada!");
      setPreviewFile(null);
      setPreviewUrl(null);
      setPreviewCaption('');
      setNewMessage('');
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar imagem.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
                setPreviewFile(file);
                setPreviewUrl(URL.createObjectURL(file));
                setPreviewCaption(newMessage);
                break;
            }
        }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        handleSendMessage(e as any);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !callId || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione uma imagem.");
      return;
    }

    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewCaption(newMessage);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-brand-red', 'ring-offset-2', 'ring-offset-zinc-950', 'transition-all', 'duration-500');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-brand-red', 'ring-offset-2', 'ring-offset-zinc-950');
      }, 2000);
    } else {
      toast.error("Mensagem original não encontrada.");
    }
  };

  const handleDeleteMessage = async () => {
    if (!callId || !messageToDelete) return;
    setIsDeletingMessage(true);
    try {
      await deleteMessage(callId, messageToDelete.id);
      setMessageToDelete(null);
      toast.success("Mensagem excluída.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir mensagem.");
    } finally {
      setIsDeletingMessage(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'HH:mm', { locale: ptBR });
  };

  if (loading && !selectedMentor) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-brand-red" size={32} />
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Carregando mentores...</p>
      </div>
    );
  }

  if (!selectedMentor) {
    return (
      <div className="w-full h-full overflow-y-auto py-10 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500 custom-scrollbar">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
            <Headphones size={32} className="text-blue-500" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Central de Dúvidas</h2>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest mt-2">Escolha um mentor para iniciar seu atendimento</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {mentors.map(mentor => (
            <div 
              key={mentor.id}
              onClick={() => handleSelectMentor(mentor)}
              className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex items-center gap-6 cursor-pointer hover:border-brand-red hover:bg-zinc-800 transition-all group shadow-lg"
            >
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-zinc-800 group-hover:border-brand-red/50 transition-colors">
                <img src={mentor.photoUrl} alt={mentor.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-brand-red transition-colors">{mentor.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Disponível agora</span>
                </div>
                <button className="mt-4 text-[10px] font-black text-white bg-zinc-800 px-4 py-2 rounded-lg uppercase tracking-widest group-hover:bg-brand-red transition-all">
                  Iniciar Chat
                </button>
              </div>
            </div>
          ))}
          {mentors.length === 0 && (
            <div className="col-span-full text-center py-20 border-2 border-dashed border-zinc-800 rounded-3xl">
              <p className="text-zinc-500 text-xs font-bold uppercase">Nenhum mentor vinculado a este plano.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden rounded-md relative bg-zinc-950 border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
      
      {/* Video Call Banner */}
      {activeVideoCalls.length > 0 && (
        <div className="bg-zinc-900 border-b border-zinc-800 p-3 space-y-2">
          {activeVideoCalls.map(call => {
            const isActive = call.status === 'active';
            return (
              <div 
                key={call.id}
                className={`flex items-center justify-between p-3 rounded-xl border animate-in slide-in-from-top-2 duration-500 ${
                  isActive ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-900/10' : 'bg-zinc-950 border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-emerald-500 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>
                    <Video size={20} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">
                      {isActive ? 'Mentoria Iniciada!' : 'Mentoria Agendada'}
                    </h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                      {isActive 
                        ? 'O mentor já está na sala aguardando você.' 
                        : `Agendada para ${format(call.scheduledAt.toDate(), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                    </p>
                  </div>
                </div>

                {isActive ? (
                  <button 
                    onClick={() => window.open(`/video-room/${call.id}`, '_blank')}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-2 animate-bounce shadow-lg shadow-emerald-900/40"
                  >
                    <ExternalLink size={14} />
                    Entrar Agora
                  </button>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    <Calendar size={14} />
                    Em breve
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Chat Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedMentor(null)}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
            <img src={selectedMentor.photoUrl} alt={selectedMentor.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tight">{selectedMentor.name}</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Mentor Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
        {messages.map((msg, idx) => {
          const isMe = msg.senderRole === 'student';
          const isMenuOpen = activeMenuId === msg.id;

          return (
            <div 
              key={msg.id || idx}
              id={`message-${msg.id}`}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative animate-in fade-in slide-in-from-bottom-1 duration-300`}
            >
              <div className={`max-w-[80%] relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                
                {/* Reply Context */}
                {msg.replyToText && (
                  <div 
                    onClick={() => msg.replyToId && scrollToMessage(msg.replyToId)}
                    className={`mb-[-8px] px-3 py-2 pb-4 rounded-t-2xl text-[10px] opacity-50 border-x border-t cursor-pointer hover:opacity-100 transition-opacity ${
                      isMe ? 'bg-red-900/20 border-red-800/30' : 'bg-zinc-800/50 border-zinc-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-1 font-bold uppercase tracking-wider">
                      <Reply size={10} /> Resposta
                    </div>
                    <p className="italic line-clamp-1">{msg.replyToText}</p>
                  </div>
                )}

                <div className={`rounded-2xl p-3 shadow-lg group-hover:shadow-xl transition-all relative ${
                  msg.isDeleted
                    ? 'bg-zinc-900/50 border border-zinc-800 text-zinc-500 italic flex items-center gap-2'
                    : isMe 
                      ? 'bg-brand-red text-white rounded-tr-none' 
                      : 'bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700'
                }`}>
                  {msg.isDeleted ? (
                    <>
                      <Ban size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Mensagem apagada</span>
                    </>
                  ) : (
                    <>
                      {msg.imageUrl && (
                        <img 
                          src={msg.imageUrl} 
                          alt="Imagem enviada" 
                          className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedImage(msg.imageUrl!)}
                        />
                      )}
                      {msg.text && <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                      
                      <div className="flex items-center justify-end gap-1 mt-1 opacity-60">
                        {msg.isEdited && <span className="text-[8px] font-bold uppercase tracking-tighter">(editado)</span>}
                        <span className="text-[9px] font-mono">{formatTime(msg.timestamp)}</span>
                        {isMe && <CheckCheck size={12} />}
                      </div>

                      {/* Action Trigger */}
                      <button 
                        onClick={() => setActiveMenuId(isMenuOpen ? null : msg.id)}
                        className={`absolute top-2 ${isMe ? '-left-8' : '-right-8'} p-1 rounded-full bg-zinc-900/50 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white`}
                      >
                        <MoreVertical size={14} />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div 
                          ref={menuRef}
                          className={`absolute z-10 top-8 ${isMe ? 'left-0' : 'right-0'} bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 min-w-[120px] animate-in fade-in zoom-in-95 duration-200`}
                        >
                          <button 
                            onClick={() => { setReplyingTo(msg); setActiveMenuId(null); }}
                            className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                          >
                            <Reply size={12} /> Responder
                          </button>
                          {isMe && (
                            <>
                              <button 
                                onClick={() => { setEditingMessage(msg); setNewMessage(msg.text); setActiveMenuId(null); }}
                                className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                              >
                                <Edit2 size={12} /> Editar
                              </button>
                              <button 
                                onClick={() => { setMessageToDelete(msg); setActiveMenuId(null); }}
                                className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                              >
                                <Trash2 size={12} /> Excluir
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 shrink-0 relative">
        
        {/* Reply Preview */}
        {replyingTo && (
          <div className="absolute bottom-full left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-3 flex items-center justify-between animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3 border-l-4 border-brand-red pl-3">
              <Reply size={14} className="text-brand-red" />
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-tighter">Respondendo a {replyingTo.senderRole === 'student' ? 'Você' : selectedMentor.name}</p>
                <p className="text-[10px] text-zinc-500 truncate max-w-md italic">{replyingTo.text}</p>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Edit Preview */}
        {editingMessage && (
          <div className="absolute bottom-full left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-3 flex items-center justify-between animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3 border-l-4 border-amber-500 pl-3">
              <Edit2 size={14} className="text-amber-500" />
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-tighter">Editando Mensagem</p>
                <p className="text-[10px] text-zinc-500 truncate max-w-md italic">{editingMessage.text}</p>
              </div>
            </div>
            <button onClick={() => { setEditingMessage(null); setNewMessage(''); }} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <div className="relative">
            <button 
              type="button" 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`text-zinc-500 hover:text-white transition-colors ${showEmojiPicker ? 'text-brand-red' : ''}`}
            >
              <Smile size={20} />
            </button>
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="absolute bottom-full left-0 mb-4 z-50 shadow-2xl">
                <EmojiPicker 
                  onEmojiClick={onEmojiClick}
                  theme={Theme.DARK}
                  width={300}
                  height={400}
                />
              </div>
            )}
          </div>
          <div className="relative">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
            >
              {isUploadingImage ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
            </button>
          </div>
          <div className="flex-1 relative flex items-center">
            <textarea 
              value={newMessage}
              onChange={e => {
                setNewMessage(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={editingMessage ? "Edite sua mensagem..." : "Descreva sua dúvida... (Shift + Enter para nova linha)"}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none resize-none custom-scrollbar min-h-[46px]"
              rows={1}
            />
          </div>
          <button 
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all disabled:opacity-50 disabled:scale-95 ${
              editingMessage ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20' : 'bg-brand-red hover:bg-red-600 shadow-red-900/20'
            }`}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : editingMessage ? <CheckCheck size={18} /> : <Send size={18} />}
          </button>
        </form>
      </div>

      {/* Delete Message Modal */}
      {messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter text-center mb-2">Apagar Mensagem?</h3>
            <p className="text-zinc-400 text-xs text-center leading-relaxed mb-6">
              Deseja apagar esta mensagem para todos? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setMessageToDelete(null)}
                disabled={isDeletingMessage}
                className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteMessage}
                disabled={isDeletingMessage}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingMessage ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Apagar para todos"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
              <h3 className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <ImageIcon size={16} className="text-brand-red" />
                Anexar Imagem
              </h3>
              <button 
                onClick={cancelPreview} 
                disabled={isUploadingImage} 
                className="text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed" style={{ maxHeight: '60vh' }}>
              <img src={previewUrl} alt="Preview" className="max-w-full max-h-[50vh] rounded-lg shadow-2xl ring-1 ring-white/10" />
            </div>
            
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 space-y-4 shrink-0">
              <textarea
                value={previewCaption}
                onChange={(e) => {
                    setPreviewCaption(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isUploadingImage) confirmImageUpload();
                    }
                }}
                placeholder="Adicione uma legenda... (opcional)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none resize-none custom-scrollbar min-h-[46px]"
                rows={1}
                disabled={isUploadingImage}
              />
              
              <div className="flex gap-3">
                <button 
                  onClick={cancelPreview}
                  disabled={isUploadingImage}
                  className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmImageUpload}
                  disabled={isUploadingImage}
                  className="flex-[2] py-3 px-4 bg-brand-red hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Enviar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
            <X size={32} />
          </button>
          <img 
            src={selectedImage} 
            alt="Visualização" 
            className="max-w-full max-h-full rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default StudentChatView;
