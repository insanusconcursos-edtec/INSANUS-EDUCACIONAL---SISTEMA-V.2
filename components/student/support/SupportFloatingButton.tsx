import React, { useState } from 'react';
import { MessageSquare, Headset, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SupportTicketModal } from './SupportTicketModal';
import { FeedbackModal } from './FeedbackModal';
import { ProductType } from '../../../types/support';

import { useStudyContext } from '../../../contexts/StudyContext';

interface SupportFloatingButtonProps {
  productInfo: {
    type: ProductType;
    id: string;
    name: string;
  };
}

export const SupportFloatingButton: React.FC<SupportFloatingButtonProps> = ({ productInfo }) => {
  const { isFloating } = useStudyContext();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('support_buttons_minimized');
      if (saved !== null) return JSON.parse(saved);
      return window.innerWidth < 768; 
    }
    return false;
  });

  const toggleMinimized = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    localStorage.setItem('support_buttons_minimized', JSON.stringify(newState));
  };

  // Mapear ProductType para o tipo esperado pelo FeedbackModal
  const feedbackProductType = productInfo.type as 'plano' | 'curso_online' | 'turma_presencial' | 'simulado' | 'evento_ao_vivo';

  return (
    <>
      <div 
        className={`fixed z-[9999] flex flex-col items-end gap-3 transition-all duration-500 ease-in-out ${
          isFloating ? 'right-6 bottom-[340px] md:right-80 md:bottom-6' : 'right-6 bottom-6'
        } ${!isHovered ? 'opacity-40' : 'opacity-100'}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
      >
        <AnimatePresence mode="wait">
          {isMinimized ? (
            <motion.button
              key="minimized"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMinimized}
              className="w-10 h-10 bg-[#2a2a2a] hover:bg-[#333333] text-orange-500 rounded-full flex items-center justify-center shadow-xl border border-white/10"
              title="Expandir suporte"
            >
              <Headset size={20} />
            </motion.button>
          ) : (
            <motion.div
              key="maximized"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col items-end gap-3"
            >
              {/* Close/Minimize Button */}
              <button
                onClick={toggleMinimized}
                className="p-1 text-zinc-500 hover:text-white transition-colors bg-black/20 rounded-full mb-1"
                title="Minimizar"
              >
                <div className="w-6 h-1 bg-zinc-600 rounded-full" />
              </button>

              {/* Feedback Button */}
              <div className="relative flex items-center justify-end gap-3 group/feedback">
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, x: 20, scale: 0.8 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 20, scale: 0.8 }}
                      className="bg-[#2a2a2a] text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl border border-white/10 whitespace-nowrap"
                    >
                      Deixe seu Feedback
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsFeedbackOpen(true)}
                  className="w-12 h-12 bg-[#2a2a2a] hover:bg-[#333333] text-orange-500 rounded-full flex items-center justify-center shadow-xl border border-white/10"
                >
                  <Megaphone size={24} />
                </motion.button>
              </div>

              {/* Support Button */}
              <div className="relative flex items-center justify-end gap-3 group/support">
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, x: 20, scale: 0.8 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 20, scale: 0.8 }}
                      className="bg-orange-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl border border-orange-500/50 whitespace-nowrap"
                    >
                      Precisa de ajuda?
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsSupportOpen(true)}
                  className="w-14 h-14 bg-orange-600 hover:bg-orange-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-orange-900/40 border border-orange-500/50 group relative"
                >
                  <div className="absolute inset-0 rounded-full bg-orange-400 group-hover:scale-150 group-hover:opacity-0 transition-all duration-700 opacity-20 animate-ping" />
                  <Headset size={28} className="relative z-10" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SupportTicketModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        productInfo={productInfo}
      />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        productInfo={{
          ...productInfo,
          type: feedbackProductType
        }}
      />
    </>
  );
};
