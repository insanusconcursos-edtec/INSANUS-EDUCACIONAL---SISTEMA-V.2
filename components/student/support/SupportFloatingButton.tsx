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

  // Mapear ProductType para o tipo esperado pelo FeedbackModal
  const feedbackProductType = productInfo.type as 'plano' | 'curso_online' | 'turma_presencial' | 'simulado' | 'evento_ao_vivo';

  return (
    <>
      <div 
        className={`fixed right-6 z-[9999] flex flex-col items-end gap-3 transition-all duration-500 ease-in-out ${
          isFloating ? 'bottom-[340px]' : 'bottom-6'
        }`}
      >
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
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
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
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="w-14 h-14 bg-orange-600 hover:bg-orange-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-orange-900/40 border border-orange-500/50 group relative"
          >
            <div className="absolute inset-0 rounded-full bg-orange-400 group-hover:scale-150 group-hover:opacity-0 transition-all duration-700 opacity-20 animate-ping" />
            <Headset size={28} className="relative z-10" />
          </motion.button>
        </div>
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
