import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { Announcement } from '../../types/announcement';
import { markAnnouncementAsRead } from '../../services/announcementService';

interface AnnouncementPopUpProps {
  announcement: Announcement;
  userId: string;
  onClose: () => void;
}

const AnnouncementPopUp: React.FC<AnnouncementPopUpProps> = ({ announcement, userId, onClose }) => {
  const [loading, setLoading] = useState(false);

  const handleConfirmRead = async () => {
    setLoading(true);
    try {
      await markAnnouncementAsRead(announcement.id, userId);
      onClose();
    } catch (error) {
      console.error("Erro ao marcar comunicado como lido:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-500">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative"
      >
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-red/10 blur-[100px] rounded-full"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 blur-[100px] rounded-full"></div>

        {/* Decorative Header */}
        <div className="h-2 w-full bg-gradient-to-r from-brand-red via-brand-red to-amber-500"></div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-red/10 rounded-2xl flex items-center justify-center text-brand-red border border-brand-red/20 shadow-lg shadow-red-950/20">
                <Bell size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Aviso Importante</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Comunicado Obrigatório</p>
              </div>
            </div>
            {!announcement.forcePopUp && (
               <button 
                 onClick={onClose}
                 className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-xl transition-all"
               >
                 <X size={20} />
               </button>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight">
              {announcement.title}
            </h2>
            
            <div className="prose prose-invert prose-zinc max-w-none prose-p:text-zinc-400 prose-p:text-sm prose-p:leading-relaxed prose-strong:text-white">
              {announcement.content.split('\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3">
            <button
              onClick={handleConfirmRead}
              disabled={loading}
              className="w-full bg-brand-red hover:bg-red-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-red-950/20 active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <CheckCircle size={20} />
                  Entendido e Concordo
                </>
              )}
            </button>
            <p className="text-[10px] text-zinc-600 text-center font-bold uppercase tracking-widest mt-2 flex items-center justify-center gap-2">
              <AlertTriangle size={12} />
              Este comunicado deve ser lido para continuar
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AnnouncementPopUp;
