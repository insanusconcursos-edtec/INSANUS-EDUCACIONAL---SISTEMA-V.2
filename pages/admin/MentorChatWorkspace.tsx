import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Send, User, MessageSquare, Loader2, CheckCheck, Clock, Phone, Video, MoreVertical, Paperclip, Smile, Trash2, Reply, Edit2, X, Ban, Image as ImageIcon
} from 'lucide-react';
import { subscribeToCalls, subscribeToMessages, sendMessage, markAsRead, editMessage, deleteMessage } from '../../services/chatService';
import { Call, Message } from '../../types/chat';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-hot-toast';
import EmojiPicker, { Theme } from 'emoji-picker-react';

interface MentorChatWorkspaceProps {
  planId?: string;
}

const MentorChatWorkspace: React.FC<MentorChatWorkspaceProps> = ({ planId }) => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mentorFilter, setMentorFilter] = useState<'all' | 'kelsen' | 'borges'>('all');
  
  // Advanced Chat States
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Preview Image Flow
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

  // Subscribe to all calls (for admin/mentor workspace)
  useEffect(() => {
    const unsubscribe = subscribeToCalls('', (updatedCalls) => {
      setCalls(updatedCalls);
      setLoading(false);
    }, planId);
    return () => unsubscribe();
  }, [planId]);

  // Subscribe to messages when a call is selected
  useEffect(() => {
    if (!selectedCall) {
      setMessages([]);
      return;
    }

    const unsubscribe = subscribeToMessages(selectedCall.id, (updatedMessages) => {
      setMessages(updatedMessages);
      markAsRead(selectedCall.id);
    });
    return () => unsubscribe();
  }, [selectedCall]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCall || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      if (editingMessage) {
        await editMessage(selectedCall.id, editingMessage.id, newMessage.trim());
        setEditingMessage(null);
      } else {
        await sendMessage(
          selectedCall.id, 
          selectedCall.mentorId, 
          'mentor', 
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

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione uma imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewCaption(newMessage);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
                handleImageSelect(file);
                break;
            }
        }
    }
  };

  const cancelPreview = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImageUpload = async () => {
    if (!previewFile || !selectedCall) return;

    setIsUploadingImage(true);
    try {
      const storageRef = ref(storage, `chat_images/${selectedCall.id}/${Date.now()}_${previewFile.name}`);
      await uploadBytes(storageRef, previewFile);
      const imageUrl = await getDownloadURL(storageRef);

      await sendMessage(
        selectedCall.id,
        selectedCall.mentorId,
        'mentor',
        previewCaption.trim(),
        undefined,
        undefined,
        imageUrl
      );

      toast.success("Imagem enviada!");
      cancelPreview();
      setNewMessage('');
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar imagem");
    } finally {
      setIsUploadingImage(false);
    }
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
    if (!selectedCall || !messageToDelete) return;
    setIsDeletingMessage(true);
    try {
      await deleteMessage(selectedCall.id, messageToDelete.id);
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

  const handleDeleteChat = () => {
    if (!selectedCall) return;
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteChat = async () => {
    if (!selectedCall || isDeleting) return;
    
    setIsDeleting(true);
    try {
      // 1. Pegar referência da subcoleção de mensagens
      const messagesRef = collection(db, 'calls', selectedCall.id, 'messages');
      const messagesSnap = await getDocs(messagesRef);
      
      // 2. Apagar todas as mensagens (usando Batch para eficiência)
      const batch = writeBatch(db);
      messagesSnap.forEach((doc) => {
          batch.delete(doc.ref);
      });
      await batch.commit();

      // 3. Apagar o documento principal da Call
      const callRef = doc(db, 'calls', selectedCall.id);
      await deleteDoc(callRef);

      // 4. Limpeza de Estado
      setIsDeleteModalOpen(false);
      setSelectedCall(null);
      toast.success("Conversa excluída com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir conversa:", error);
      toast.error("Erro ao excluir conversa.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCalls = calls
    .filter(call => call.lastMessage && call.lastMessage.trim() !== '')
    .filter(call => {
      if (mentorFilter === 'all') return true;
      return call.assignedMentor === mentorFilter;
    })
    .filter(call => {
      if (!searchTerm) return true;
      return call.studentName?.toLowerCase().includes(searchTerm.toLowerCase());
    });

  return (
    <div className="h-full flex bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-500">
      
      {/* Sidebar - Call List */}
      <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-900/30">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
          <h2 className="text-lg font-black text-white uppercase tracking-tighter mb-4">Central de Dúvidas</h2>
          
          {/* Tabs de Mentores */}
          <div className="flex border border-zinc-800 bg-zinc-950 p-1 gap-1 rounded-xl mb-4">
            <button 
              onClick={() => setMentorFilter('all')}
              className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${mentorFilter === 'all' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setMentorFilter('kelsen')}
              className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${mentorFilter === 'kelsen' ? 'bg-red-500/20 text-red-500 shadow-lg border border-red-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Kelsen
            </button>
            <button 
              onClick={() => setMentorFilter('borges')}
              className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${mentorFilter === 'borges' ? 'bg-blue-500/20 text-blue-500 shadow-lg border border-blue-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Borges
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-zinc-600" />
            <input 
              placeholder="Buscar conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-brand-red" />
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-10 px-4">
              <MessageSquare size={32} className="mx-auto text-zinc-800 mb-2" />
              <p className="text-zinc-600 text-[10px] font-bold uppercase">Nenhuma conversa ativa</p>
            </div>
          ) : (
            filteredCalls.map(call => (
              <div 
                key={call.id}
                onClick={() => setSelectedCall(call)}
                className={`p-4 flex items-center gap-3 cursor-pointer transition-all border-b border-zinc-800/50 hover:bg-zinc-800/30 ${
                  selectedCall?.id === call.id ? 'bg-zinc-800/50 border-l-4 border-l-brand-red' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
                    {call.studentPhotoUrl ? (
                      <img src={call.studentPhotoUrl} alt={call.studentName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 font-black">
                        {call.studentName ? call.studentName.substring(0, 2).toUpperCase() : 'AL'}
                      </div>
                    )}
                  </div>
                  {call.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand-red text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg">
                      {call.unreadCount}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-xs font-black text-white uppercase truncate">{call.studentName || 'Aluno Sem Nome'}</h3>
                    <span className="text-[9px] text-zinc-600 font-mono">{formatTime(call.lastMessageTime)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-1">
                    {call.assignedMentor && (
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                        call.assignedMentor === 'kelsen' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      }`}>
                        {call.assignedMentor}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-zinc-500 truncate font-medium">
                    {call.lastMessage || 'Inicie uma conversa...'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-zinc-950 relative">
        {selectedCall ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
                  {selectedCall.studentPhotoUrl ? (
                    <img src={selectedCall.studentPhotoUrl} alt={selectedCall.studentName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 font-black text-xs">
                      {selectedCall.studentName ? selectedCall.studentName.substring(0, 2).toUpperCase() : 'AL'}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">{selectedCall.studentName || 'Aluno Sem Nome'}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-zinc-500">
                <button 
                  onClick={handleDeleteChat}
                  className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  title="Excluir Conversa"
                >
                  <Trash2 size={18} />
                </button>
                <button className="hover:text-white transition-colors"><Phone size={18} /></button>
                <button className="hover:text-white transition-colors"><Video size={18} /></button>
                <button className="hover:text-white transition-colors"><Search size={18} /></button>
                <button className="hover:text-white transition-colors"><MoreVertical size={18} /></button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
              {messages.map((msg, idx) => {
                const isMentor = msg.senderRole === 'mentor';
                const isMenuOpen = activeMenuId === msg.id;

                return (
                  <div 
                    key={msg.id || idx}
                    id={`message-${msg.id}`}
                    className={`flex ${isMentor ? 'justify-end' : 'justify-start'} group relative animate-in fade-in slide-in-from-bottom-1 duration-300`}
                  >
                    <div className={`max-w-[70%] relative flex flex-col ${isMentor ? 'items-end' : 'items-start'}`}>
                      
                      {/* Reply Context */}
                      {msg.replyToText && (
                        <div 
                          onClick={() => msg.replyToId && scrollToMessage(msg.replyToId)}
                          className={`mb-[-8px] px-3 py-2 pb-4 rounded-t-2xl text-[10px] opacity-50 border-x border-t cursor-pointer hover:opacity-100 transition-opacity ${
                            isMentor ? 'bg-red-900/20 border-red-800/30' : 'bg-zinc-800/50 border-zinc-700/50'
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
                          : isMentor 
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
                              {isMentor && <CheckCheck size={12} />}
                            </div>

                            {/* Action Trigger */}
                            <button 
                              onClick={() => setActiveMenuId(isMenuOpen ? null : msg.id)}
                              className={`absolute top-2 ${isMentor ? '-left-8' : '-right-8'} p-1 rounded-full bg-zinc-900/50 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white`}
                            >
                              <MoreVertical size={14} />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div 
                                ref={menuRef}
                                className={`absolute z-10 top-8 ${isMentor ? 'left-0' : 'right-0'} bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 min-w-[120px] animate-in fade-in zoom-in-95 duration-200`}
                              >
                                <button 
                                  onClick={() => { setReplyingTo(msg); setActiveMenuId(null); }}
                                  className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                                >
                                  <Reply size={12} /> Responder
                                </button>
                                {isMentor && (
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
            <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 relative">
              
              {/* Reply Preview */}
              {replyingTo && (
                <div className="absolute bottom-full left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-3 flex items-center justify-between animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 border-l-4 border-brand-red pl-3">
                    <Reply size={14} className="text-brand-red" />
                    <div>
                      <p className="text-[10px] font-black text-white uppercase tracking-tighter">Respondendo a {replyingTo.senderRole === 'mentor' ? 'Você' : selectedCall.studentName}</p>
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
                    onChange={handleFileInputChange}
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
                <div className="flex-1 relative">
                  <textarea 
                    rows={1}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                    }}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={editingMessage ? "Edite sua mensagem..." : "Digite sua resposta..."}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none resize-none custom-scrollbar min-h-[44px] max-h-32"
                  />
                </div>
                <button 
                  type="button"
                  onClick={(e) => handleSendMessage(e)}
                  disabled={!newMessage.trim() || sending}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all disabled:opacity-50 disabled:scale-95 shrink-0 self-stretch min-h-[44px] ${
                    editingMessage ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20' : 'bg-brand-red hover:bg-red-600 shadow-red-900/20'
                  }`}
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : editingMessage ? <CheckCheck size={18} /> : <Send size={18} />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800 shadow-inner">
              <MessageSquare size={40} className="text-zinc-700" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Selecione uma conversa</h2>
            <p className="text-zinc-500 text-xs max-w-xs font-medium">
              Escolha um aluno na lista ao lado para iniciar o atendimento em tempo real.
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter text-center mb-2">Excluir Conversa</h3>
            <p className="text-zinc-400 text-xs text-center leading-relaxed mb-6">
              Tem certeza que deseja apagar permanentemente esta conversa? Todas as mensagens serão deletadas do banco de dados. Esta ação é irreversível.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteChat}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Sim, Excluir"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Upload Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
              <h3 className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Paperclip size={16} className="text-brand-red" />
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
    </div>
  );
};

export default MentorChatWorkspace;
