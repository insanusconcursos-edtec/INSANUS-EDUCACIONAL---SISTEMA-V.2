import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatNotifications } from '../../../hooks/useChatNotifications';

export const ChatNotificationToast: React.FC = () => {
  const { unreadCount, recentNotifications } = useChatNotifications();
  const [show, setShow] = useState(false);
  const [lastCount, setLastCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    // Só mostra se o contador subiu (chegou mensagem nova)
    if (unreadCount > lastCount) {
      setShow(true);
      // Opcional: auto fechar após 6 segundos
      const timer = setTimeout(() => setShow(false), 6000);
      return () => clearTimeout(timer);
    }
    setLastCount(unreadCount);
  }, [unreadCount, lastCount]);

  if (recentNotifications.length === 0) return null;

  const latest = recentNotifications[0];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-[200] max-w-xs w-full bg-zinc-950 border-2 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)] rounded-2xl p-4 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500"></div>
          
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-red-500/10 rounded-xl overflow-hidden shrink-0 border border-red-500/20">
              {latest.mentorPhotoUrl ? (
                <img src={latest.mentorPhotoUrl} alt={latest.mentorName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-red-500">
                  <MessageSquare size={20} />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-white uppercase tracking-tighter mb-0.5">
                {latest.mentorName || 'Seu mentor'} enviou uma mensagem!
              </h4>
              <p className="text-[10px] text-zinc-400 font-medium line-clamp-2 italic mb-3">
                &quot;{latest.lastMessage}&quot;
              </p>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    console.log(`🚀 [InAppNotification] Redirecionando para chat com mentor: ${latest.mentorId}`);
                    navigate(`/app/dashboard?tab=call&mentorId=${latest.mentorId}`);
                    setShow(false);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-lg shadow-red-900/40"
                >
                  <ExternalLink size={10} />
                  Abrir Chat
                </button>
                <button
                  onClick={() => setShow(false)}
                  className="text-zinc-500 hover:text-white text-[9px] font-black uppercase tracking-widest px-2 py-1.5 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>

            <button 
              onClick={() => setShow(false)}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-red-500/5 blur-2xl rounded-full"></div>
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-500/5 blur-2xl rounded-full"></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
