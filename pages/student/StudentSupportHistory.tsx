import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Clock, ArrowLeft, Search, Loader2, Send,
  Paperclip, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supportService } from '../../services/supportService';
import { uploadSupportImage } from '../../services/storageService';
import { SupportTicket, TicketMessage } from '../../types/support';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Loading from '../../components/ui/Loading';

export const StudentSupportHistory: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentUser, userProfile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [loading, setLoading] = useState(true);

  // Preview Flow
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCaption, setPreviewCaption] = useState('');

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = supportService.subscribeToUserTickets(currentUser.uid, (data) => {
      setTickets(data);
      setLoading(false);
      if (selectedTicket) {
        const updated = data.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      return;
    }
    const unsubscribe = supportService.subscribeToMessages(selectedTicket.id, (data) => {
      setMessages(data);
      supportService.resetUnread(selectedTicket.id, false);
    });
    return () => unsubscribe();
  }, [selectedTicket?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !selectedTicket || !currentUser || isSending || isUploadingImage) return;

    setIsSending(true);

    try {
      await supportService.sendMessage(selectedTicket.id, {
        senderId: currentUser.uid,
        senderRole: 'student',
        senderName: userProfile?.name || currentUser.displayName || 'Aluno',
        text: newMessage,
        imageUrl: '',
      }, false);

      setNewMessage('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const cancelPreview = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImageUpload = async () => {
    if (!previewFile || !selectedTicket || !currentUser) return;

    setIsUploadingImage(true);
    try {
      const imageUrl = await uploadSupportImage(selectedTicket.id, previewFile);

      await supportService.sendMessage(selectedTicket.id, {
        senderId: currentUser.uid,
        senderRole: 'student',
        senderName: userProfile?.name || currentUser.displayName || 'Aluno',
        text: previewCaption.trim(),
        imageUrl,
      }, false);

      cancelPreview();
      setNewMessage('');
    } catch (error) {
      console.error(error);
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
                if (file.size > 5 * 1024 * 1024) {
                    alert('A imagem deve ter no máximo 5MB');
                    return;
                }
                setPreviewFile(file);
                setPreviewUrl(URL.createObjectURL(file));
                setPreviewCaption(newMessage);
                break;
            }
        }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB');
        return;
      }
      setPreviewFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setPreviewCaption(newMessage);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-black">
      {/* Mobile-friendly overlay/view */}
      <div className="max-w-6xl mx-auto h-screen flex flex-col p-4 md:p-8">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all transform active:scale-90"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Meus Chamados</h1>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Suporte Educacional Insanus</p>
          </div>
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Ticket List */}
          <div className={`w-full md:w-[380px] flex flex-col bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-6 border-b border-zinc-800">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                 <input 
                   type="text" 
                   placeholder="Buscar nos meus chamados..."
                   className="w-full bg-black/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/30 transition-all font-medium"
                 />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {tickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`w-full p-5 rounded-2xl mb-2 text-left transition-all group relative overflow-hidden ${
                    selectedTicket?.id === ticket.id ? 'bg-orange-600/10 border border-orange-500/20' : 'hover:bg-zinc-800/30 border border-transparent'
                  }`}
                >
                  {ticket.unreadCountUser > 0 && (
                    <div className="absolute top-4 right-4 w-5 h-5 bg-orange-600 rounded-full flex items-center justify-center text-[10px] font-black text-white animate-pulse">
                      {ticket.unreadCountUser}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                      ticket.status === 'open' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                      ticket.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                      'bg-green-500/10 text-green-500 border border-green-500/20'
                    }`}>
                      {ticket.status === 'open' ? 'Em Aberto' : ticket.status === 'in_progress' ? 'Em Atendimento' : 'Concluído'}
                    </span>
                    <span className="text-zinc-600 text-[10px] font-bold">•</span>
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-tight">{ticket.productName}</span>
                  </div>

                  <p className={`text-sm font-bold mb-1 truncate ${selectedTicket?.id === ticket.id ? 'text-white' : 'text-zinc-300'}`}>
                    {ticket.lastMessageSnippet}
                  </p>
                  <p className="text-[10px] text-zinc-600 font-bold uppercase">
                    Última atualização: {format(ticket.updatedAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </button>
              ))}

              {tickets.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-4 text-zinc-600">
                    <MessageSquare size={32} />
                  </div>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest leading-loose">
                    Você ainda não abriu nenhum chamado de suporte.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className={`flex-1 flex flex-col bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden ${!selectedTicket ? 'hidden md:flex' : 'flex'}`}>
            <AnimatePresence mode="wait">
              {selectedTicket ? (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col h-full"
                >
                  {/* Header */}
                  <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedTicket(null)}
                        className="md:hidden p-2 -ml-2 text-zinc-500"
                      >
                        <ArrowLeft size={20} />
                      </button>
                      <div>
                        <h4 className="text-white font-black text-sm uppercase tracking-tight">{selectedTicket.productName}</h4>
                        <div className="flex items-center gap-2">
                           <Clock size={10} className="text-zinc-600" />
                           <span className="text-zinc-600 text-[9px] uppercase font-black tracking-widest">Aberto em {format(selectedTicket.createdAt, "dd/MM/yyyy")}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                    {messages.map((msg, index) => {
                      const isMe = msg.senderId === currentUser?.uid;
                      const isPrevSameAuthor = index > 0 && messages[index-1].senderId === msg.senderId;

                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isPrevSameAuthor ? '-mt-4' : ''}`}>
                          {!isPrevSameAuthor && (
                            <span className="text-[10px] font-black uppercase text-zinc-600 mb-1.5 px-2">
                              {isMe ? 'VOCÊ' : (msg.senderRole === 'student' ? msg.senderName.toUpperCase() : msg.senderName)}
                            </span>
                          )}
                          <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                            isMe ? 'bg-orange-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-200 rounded-tl-none'
                          }`}>
                            {msg.imageUrl && (
                              <div className="mb-2">
                                <img 
                                  src={msg.imageUrl} 
                                  alt="Anexo" 
                                  className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-white/10"
                                  onClick={() => window.open(msg.imageUrl, '_blank')}
                                />
                              </div>
                            )}
                            {msg.text && <div>{msg.text}</div>}
                            <div className="text-[9px] mt-1.5 opacity-50 font-bold text-right">
                              {format(msg.createdAt, 'HH:mm')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-zinc-800">
                    {selectedTicket.status === 'resolved' ? (
                      <div className="py-4 px-6 bg-green-500/5 border border-green-500/10 rounded-2xl text-center">
                        <p className="text-green-500 text-[10px] font-black uppercase tracking-widest">
                          Este atendimento foi concluído pela nossa equipe.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                          <input 
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageSelect}
                            accept="image/png, image/jpeg, image/webp"
                            className="hidden"
                          />
                          <div className="flex-1 relative flex items-center">
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
                              placeholder="Digite aqui sua mensagem..."
                              className="w-full bg-black/50 border border-zinc-800 rounded-2xl pl-5 pr-12 py-4 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/30 transition-all font-medium resize-none custom-scrollbar min-h-[52px] max-h-32"
                            />
                            <button 
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="absolute right-3 p-2 text-zinc-600 hover:text-zinc-400 transition-colors"
                            >
                              <Paperclip size={20} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSendMessage()}
                            disabled={!newMessage.trim() || isSending || isUploadingImage}
                            className="w-14 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center transition-all shadow-xl shadow-orange-950/20 shrink-0 self-stretch min-h-[52px]"
                          >
                            {isSending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-zinc-800 flex items-center justify-center mb-6 text-zinc-700">
                    <MessageSquare size={40} />
                  </div>
                  <h3 className="text-zinc-400 font-black text-xs uppercase tracking-widest leading-loose">
                    Selecione um chamado ao lado<br/>para ver o histórico
                  </h3>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Upload Preview Modal */}
      <AnimatePresence>
        {previewUrl && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isUploadingImage && cancelPreview()}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
                <h3 className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Paperclip size={16} className="text-orange-500" />
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
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-xs text-white placeholder-zinc-700 focus:border-orange-500 focus:outline-none resize-none custom-scrollbar min-h-[46px]"
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
                    className="flex-[2] py-3 px-4 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-orange-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
