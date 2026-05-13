import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, ShieldAlert, Edit2, Check, Smile, User, Reply, X } from 'lucide-react';
import { liveChatService } from '../../../../services/liveChatService';
import { LiveChatMessage } from '../../../../types/liveEvent';
import { useAuth } from '../../../../contexts/AuthContext';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import toast from 'react-hot-toast';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';

interface AdminLiveChatProps {
  eventId: string;
}

export const AdminLiveChat: React.FC<AdminLiveChatProps> = ({ eventId }) => {
  const { currentUser, userData } = useAuth();
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [replyingTo, setReplyingTo] = useState<LiveChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const formatShortName = (fullName?: string | null) => {
    if (!fullName) return 'Administrador';
    const nameParts = fullName.trim().split(' ');
    return nameParts.slice(0, 2).join(' '); // Pega apenas o 1º e 2º nome
  };

  const resolvedName = formatShortName(userData?.name || currentUser?.displayName);

  const handleEditSubmit = async (messageId: string) => {
    if (!editText.trim()) return;
    try {
      await liveChatService.editMessage(eventId, messageId, editText);
      setEditingMessageId(null);
      setEditText('');
    } catch (error) {
      console.error("Error editing message:", error);
      toast.error("Erro ao editar mensagem.");
    }
  };

  useEffect(() => {
    if (!eventId) return;

    const unsubscribe = liveChatService.subscribeToMessages(eventId, (msgs) => {
      setMessages(msgs);
      scrollToBottom();
    });

    return () => unsubscribe();
  }, [eventId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !currentUser || isSending) return;

    setIsSending(true);
    try {
      await liveChatService.sendMessage(eventId, {
        userId: currentUser.uid,
        userName: resolvedName,
        senderName: resolvedName,
        userEmail: currentUser.email || userData?.email || '',
        userPhoto: userData?.photoUrl || userData?.photoURL || userData?.photo || currentUser.photoURL || null,
        senderPhoto: userData?.photoUrl || userData?.photoURL || userData?.photo || currentUser.photoURL || null,
        text: newMessage.trim(),
        isAdmin: true,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          userName: replyingTo.userName,
          text: replyingTo.text
        } : null
      });
      setNewMessage('');
      setReplyingTo(null);
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem.");
    } finally {
      setIsSending(false);
      // Recupera o foco após re-ativar o input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.style.height = 'auto';
        }
      }, 0);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    // Magia do auto-resize: reseta para auto e depois pega a altura real
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sem Shift envia a mensagem
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Evita quebra de linha extra
      if (newMessage.trim() !== '' && !isSending) {
        handleSendMessage(); 
      }
    }
    // Shift + Enter o comportamento nativo (quebrar linha) atua normalmente
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    // Não fecha o picker para permitir múltiplos emojis, mas foca no input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      await liveChatService.deleteMessage(eventId, messageToDelete);
      toast.success("Mensagem apagada.");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Erro ao apagar mensagem.");
    } finally {
      setMessageToDelete(null);
    }
  };

  const handleClearChat = async () => {
    setIsClearing(true);
    try {
      await liveChatService.clearChat(eventId);
      toast.success("Chat limpo.");
    } catch (error) {
      console.error("Error clearing chat:", error);
      toast.error("Erro ao limpar chat.");
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-red-500" />
          <h2 className="font-bold text-white text-sm uppercase tracking-wider">Moderação de Chat</h2>
        </div>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-widest px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
        >
          Limpar Chat
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-center">
            <ShieldAlert size={32} className="mb-3 opacity-20" />
            <p className="text-sm">Nenhuma mensagem enviada.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isAdmin = msg.isAdmin;
            const isMine = currentUser?.uid === msg.userId;
            const isFirstInSequence = index === 0 || messages[index - 1].userId !== msg.userId;
            const isLastInSequence = index === messages.length - 1 || messages[index + 1].userId !== msg.userId;

            return (
              <div key={msg.id} className={`flex items-start gap-2 group ${isLastInSequence ? 'mb-4' : 'mb-1'} ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar Container */}
                <div className="flex-shrink-0 flex flex-col justify-start">
                  {isFirstInSequence ? (
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700/50">
                      {(msg.senderPhoto || msg.userPhoto) ? (
                        <img 
                          src={msg.senderPhoto || msg.userPhoto} 
                          alt={msg.senderName || msg.userName} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User size={16} className="text-zinc-500" />
                      )}
                    </div>
                  ) : (
                    <div className="w-8 h-8" />
                  )}
                </div>

                <div className={`group flex flex-col max-w-[85%] ${isMine ? 'items-end' : 'items-start'}`}>
                  {/* Message Header (Name, Time) - Only for first in sequence */}
                  {isFirstInSequence && (
                    <div className={`flex items-center gap-2 mb-1.5 w-full ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isAdmin 
                          ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                          : 'text-zinc-400'
                      }`}>
                        {isAdmin ? 'MODERADOR' : (msg.senderName || msg.userName || 'Aluno')}
                      </span>
                      <span className="text-[9px] text-zinc-600 font-medium">
                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  )}

                  <div className={`relative group/bubble flex items-center gap-2 w-full ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`max-w-full w-full rounded-2xl px-3 py-2.5 shadow-sm ${
                      msg.isDeleted
                        ? 'bg-zinc-800/30 text-zinc-500 italic border border-zinc-800/50'
                        : isAdmin
                          ? 'bg-red-600/10 border border-red-500/20 text-white'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
                    }`}>
                      {/* Reply Reference */}
                      {!msg.isDeleted && msg.replyTo && (
                        <div className="bg-black/20 border-l-4 border-red-500 p-2 rounded text-xs mb-2 opacity-80">
                          <p className="font-bold text-red-400 mb-0.5">{msg.replyTo.userName}</p>
                          <p className="text-zinc-400 line-clamp-1">{msg.replyTo.text}</p>
                        </div>
                      )}

                      <div className="flex-1">
                        {/* Lógica de Exibição ou Edição de Texto */}
                        {editingMessageId === msg.id ? (
                          <div className="flex flex-col gap-2 w-full py-1">
                            <textarea 
                              value={editText} 
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full bg-black/40 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-500/50 resize-none min-h-[60px]"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleEditSubmit(msg.id);
                                }
                                if (e.key === 'Escape') {
                                  setEditingMessageId(null);
                                }
                              }}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => setEditingMessageId(null)} 
                                className="px-2 py-1 text-[10px] font-bold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors"
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={() => handleEditSubmit(msg.id)} 
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded uppercase tracking-wider transition-colors flex items-center gap-1"
                              >
                                <Check size={12} />
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm break-words">
                            {msg.text} 
                            {msg.isEdited && !msg.isDeleted && <span className="text-[10px] text-zinc-500 ml-2 italic">(editado)</span>}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação (Apenas para o Administrador) - Now on hover of the bubble */}
                    {!msg.isDeleted && (
                      <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Botão de Responder */}
                        <button 
                          onClick={() => { setReplyingTo(msg); inputRef.current?.focus(); }}
                          className="p-1 text-zinc-500 hover:text-emerald-400 transition-colors rounded hover:bg-zinc-800"
                          title="Responder"
                        >
                          <Reply size={12} />
                        </button>

                        {/* Botão de Editar (Apenas para mensagens do próprio Admin) */}
                        {msg.userId === currentUser?.uid && (
                          <button 
                            onClick={() => { setEditingMessageId(msg.id); setEditText(msg.text); }}
                            className="p-1 text-zinc-500 hover:text-blue-400 transition-colors rounded hover:bg-zinc-800"
                            title="Editar mensagem"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        {/* Botão de Apagar (Admin pode apagar QUALQUER mensagem agora) */}
                        <button 
                          onClick={() => setMessageToDelete(msg.id)}
                          className="p-1 text-zinc-500 hover:text-red-500 transition-colors rounded hover:bg-zinc-800"
                          title="Apagar mensagem"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
          )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800 shrink-0 relative">
        {/* Reply Preview */}
        {replyingTo && (
          <div className="mb-2 bg-zinc-950 border-l-4 border-red-500 p-3 rounded-lg flex items-start justify-between animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">
                Respondendo a {replyingTo.userName}
              </p>
              <p className="text-xs text-zinc-400 truncate">
                {replyingTo.text}
              </p>
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="p-1 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <div className="absolute bottom-20 left-4 z-50 shadow-2xl">
            <EmojiPicker 
              theme={Theme.DARK}
              onEmojiClick={onEmojiClick}
              width={320}
              height={400}
            />
          </div>
        )}
        <div className="relative flex items-end gap-2 p-2 bg-black border border-zinc-800 rounded-lg">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2 transition-colors flex items-center justify-center shrink-0 ${
              showEmojiPicker ? 'text-red-500' : 'text-zinc-400 hover:text-white'
            }`}
            title="Inserir Emoji"
          >
            <Smile size={24} />
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enviar como moderador..."
            className="flex-1 bg-transparent border-none focus:ring-0 px-1 py-2 text-sm text-white placeholder:text-zinc-600 resize-none overflow-y-auto max-h-24 focus:outline-none"
          />

          <button 
            type="submit"
            onClick={(e) => handleSendMessage(e)}
            disabled={!newMessage.trim() || isSending} 
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
            title="Enviar mensagem"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* Modals */}
      <ConfirmationModal
        isOpen={showClearConfirm}
        title="Limpar Chat"
        message="Tem certeza que deseja apagar todas as mensagens deste chat? Esta ação não pode ser desfeita."
        onConfirm={handleClearChat}
        onCancel={() => setShowClearConfirm(false)}
        confirmText={isClearing ? "Limpando..." : "Limpar Tudo"}
        isDanger={true}
      />

      <ConfirmationModal
        isOpen={!!messageToDelete}
        title="Apagar Mensagem"
        message="Deseja realmente apagar esta mensagem?"
        onConfirm={handleDeleteMessage}
        onCancel={() => setMessageToDelete(null)}
        confirmText="Apagar"
        isDanger={true}
      />
    </div>
  );
};
