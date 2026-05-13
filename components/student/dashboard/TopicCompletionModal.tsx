
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, CheckCircle2, X } from 'lucide-react';

interface TopicCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  topicName: string;
}

export const TopicCompletionModal: React.FC<TopicCompletionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  topicName
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-8 shadow-[0_0_50px_rgba(255,255,255,0.05)] overflow-hidden"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[var(--plan-theme)]/10 blur-[80px] rounded-full -z-10" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Icon Container */}
              <div className="relative mb-8">
                <motion.div
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="w-24 h-24 bg-gradient-to-br from-[var(--plan-theme)] to-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(var(--plan-theme-rgb),0.3)]"
                >
                  <Trophy size={48} className="text-white" />
                </motion.div>
                
                {/* Checkmark Badge */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-2 border-4 border-[#0a0a0a]"
                >
                  <CheckCircle2 size={16} className="text-white" />
                </motion.div>
              </div>

              {/* Text Content */}
              <div className="space-y-3 mb-10">
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-tight italic">
                  PARABÉNS, <br />
                  <span className="text-[var(--plan-theme)]">VOCÊ VENCEU</span> MAIS UM TÓPICO!
                </h2>
                
                <div className="inline-block px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                    TÓPICO CONCLUÍDO: <span className="text-white">{topicName}</span>
                  </p>
                </div>

                <p className="text-zinc-400 text-sm font-medium pt-4 px-6">
                  Para garantir a sua aprovação, deseja agendar as revisões espaçadas (24h, 7d, 30d) agora?
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col w-full gap-4">
                <button
                  onClick={onConfirm}
                  className="w-full py-4 bg-white text-black font-black uppercase text-xs tracking-[0.2em] rounded-2xl 
                           shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-zinc-200 transition-all active:scale-[0.98]
                           relative overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    SIM, AGENDAR REVISÕES
                  </span>
                  {/* Neon Glow Hover Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-4 bg-transparent text-zinc-500 hover:text-zinc-300 font-black uppercase text-[10px] tracking-widest transition-all"
                >
                  AGORA NÃO
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
