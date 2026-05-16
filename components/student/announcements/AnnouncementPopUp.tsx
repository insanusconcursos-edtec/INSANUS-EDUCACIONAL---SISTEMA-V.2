import React from 'react';
import { Megaphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Announcement, markAnnouncementAsRead } from '../../../services/announcementService';

interface AnnouncementPopUpProps {
  announcement: Announcement;
  userId: string;
  onClose: () => void;
}

export const AnnouncementPopUp: React.FC<AnnouncementPopUpProps> = ({ announcement, userId, onClose }) => {
  const handleConfirm = async () => {
    try {
      await markAnnouncementAsRead(announcement.id, userId);
      onClose();
    } catch (error) {
      console.error(error);
      onClose(); // Fecha de qualquer forma para não travar o usuário
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative"
      >
        {/* Header Visual */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600"></div>
        
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-500 border border-red-500/20 shrink-0">
              <Megaphone size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ring-4 ring-red-600/10">Importante</span>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                   {new Date(announcement.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight leading-tight">{announcement.title}</h2>
            </div>
          </div>

          <div className="max-h-[40vh] overflow-y-auto mb-8 pr-2 scrollbar-hide">
            <p className="text-zinc-400 text-sm font-medium leading-relaxed whitespace-pre-wrap">
              {announcement.content}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleConfirm}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-red-900/40 group active:scale-95"
            >
              <CheckCircle2 size={20} className="group-hover:scale-110 transition-transform" />
              Entendo, Marcar como Lido
            </button>
            
            {!announcement.forcePopUp && (
              <button 
                onClick={onClose}
                className="w-full text-zinc-500 hover:text-zinc-300 text-[10px] font-black uppercase tracking-widest transition-all p-2"
              >
                Fechar
              </button>
            )}
          </div>
        </div>

        {/* Info Footer */}
        <div className="bg-zinc-900/50 border-t border-zinc-900 px-8 py-4 flex items-center gap-2">
           <AlertCircle size={14} className="text-zinc-600" />
           <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Aviso oficial da equipe de mentoria</p>
        </div>
      </motion.div>
    </div>
  );
};
