import React, { useState } from 'react';
import { X, Send, Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supportService } from '../../../services/supportService';
import { useAuth } from '../../../contexts/AuthContext';
import { auth } from '../../../services/firebase';
import { ProductType } from '../../../types/support';
import toast from 'react-hot-toast';

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  productInfo: {
    type: ProductType;
    id: string;
    name: string;
  };
}

export const SupportTicketModal: React.FC<SupportTicketModalProps> = ({ 
  isOpen, 
  onClose, 
  productInfo 
}) => {
  const { currentUser: user, userData: userProfile } = useAuth();
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleConfirmSubmit = async () => {
    // 1. Validações prévias com feedback
    const activeUser = user || auth.currentUser;

    if (!activeUser) {
      toast.error("Erro de Autenticação: Usuário não identificado.");
      return;
    }
    if (!message.trim()) {
      toast.error("A mensagem não pode estar vazia.");
      setIsConfirmOpen(false);
      return;
    }

    setIsSubmitting(true); // Inicia o Loading

    try {
      // 2. Chamada ao Firestore via Serviço Importado
      await supportService.openTicket({
        userId: activeUser.uid,
        userProfile: {
          name: userProfile?.name || activeUser.displayName || 'Aluno',
          email: userProfile?.email || activeUser.email || '',
          photoUrl: userProfile?.photoUrl || activeUser.photoURL || ''
        },
        productType: productInfo.type,
        productId: productInfo.id,
        productName: productInfo.name,
        initialMessage: message.trim()
      });

      // 3. Sucesso e Limpeza
      toast.success("Solicitação enviada com sucesso!");
      setIsConfirmOpen(false);
      onClose(); // Fecha o modal principal

    } catch (error) {
      // 4. Captura e exibição de erro
      console.error("Erro ao enviar suporte:", error);
      toast.error("Ocorreu um erro ao enviar sua solicitação. Tente novamente.");
    } finally {
      setIsSubmitting(false); // Remove o Loading independentemente do resultado
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length > 0) {
      setIsConfirmOpen(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                    <MessageSquare size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">Suporte ao Aluno</h3>
                    <p className="text-zinc-500 text-xs">Informe seu problema sobre: {productInfo.name}</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
                      Como podemos te ajudar?
                    </label>
                    <textarea
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Descreva sua dúvida, problema ou sugestão aqui..."
                      className="w-full h-32 bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 transition-all resize-none text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-xl border border-zinc-800">
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <p className="text-[11px] text-zinc-400 leading-tight">
                      Nossa equipe responderá o mais breve possível. Você será notificado assim que tivermos uma resposta.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!message.trim()}
                    className="flex-[2] px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-orange-600 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20"
                  >
                    <Send size={18} />
                    Enviar Solicitação
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl shadow-black/50"
            >
              <h4 className="text-white font-bold text-lg mb-2 text-center">Confirmar Envio</h4>
              <p className="text-zinc-400 text-sm text-center mb-6">
                Tem certeza que deseja enviar esta solicitação de suporte para a nossa equipe?
              </p>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    'Sim, Enviar'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
