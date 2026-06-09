
import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Pause, Play, CheckCircle2, 
  Timer, Maximize2, ExternalLink 
} from 'lucide-react';
import { useStudyContext } from '../../../contexts/StudyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

export const FloatingStudyTimer: React.FC = () => {
  const { 
    activeGoal, status, formattedTime, 
    pause, resume, finish,
    isFloating, setIsFloating
  } = useStudyContext();
  
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Basic Page Check
  const isPublicPage = window.location.pathname === '/login' || window.location.pathname === '/';
  
  useEffect(() => {
    if (!currentUser) {
      setIsFloating(false);
      return;
    }

    const shouldFloat = (status === 'running' || status === 'paused');
    
    if (shouldFloat) {
      setIsFloating(true);
    } else {
      setIsFloating(false);
    }
  }, [status, setIsFloating, currentUser]);

  if (!currentUser || isPublicPage) return null;
  if (!activeGoal || status === 'idle' || status === 'completed') return null;
  if (!isFloating) return null;

  const handleFinish = async () => {
    await finish();
    setIsFloating(false);
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className="fixed bottom-3 right-3 z-[9999] w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden group"
    >
      {/* ProgressBar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
        <motion.div 
           className="h-full bg-brand-red"
           initial={{ width: 0 }}
           animate={{ width: `${Math.min(100, (formattedTime.split(':').reduce((acc, time) => (60 * acc) + +time, 0) / (activeGoal.duration * 60)) * 100)}%` }}
        />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-brand-red/10 flex items-center justify-center text-brand-red shrink-0">
              <Timer size={16} className={status === 'running' ? 'animate-pulse' : ''} />
            </div>
            <div className="overflow-hidden">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest truncate">
                {activeGoal.title}
              </h4>
              <p className="text-[9px] text-zinc-500 font-bold uppercase truncate">
                {activeGoal.discipline}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsFloating(false)}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {/* Timer Display */}
        <div className="flex items-center justify-center py-4 bg-zinc-950/50 rounded-xl border border-white/5 mb-4">
          <span className="text-3xl font-mono font-black text-white tabular-nums tracking-tighter">
            {formattedTime}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {status === 'running' ? (
            <button
              onClick={pause}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-700"
            >
              <Pause size={14} fill="currentColor" /> Pausar
            </button>
          ) : (
            <button
              onClick={resume}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-red hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-900/20"
            >
              <Play size={14} fill="currentColor" /> Retomar
            </button>
          )}
          
          <button
            onClick={handleFinish}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20"
          >
            <CheckCircle2 size={14} /> Concluir
          </button>
        </div>
        
        {/* Navigation Link */}
        <button
          onClick={() => {
            setIsFloating(false);
            navigate('/app/dashboard');
          }}
          className="w-full mt-3 py-2 text-[8px] font-black text-zinc-500 hover:text-white uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2"
        >
          Voltar para a Meta <ExternalLink size={10} />
        </button>
      </div>

      {/* Floating Drag Handle Hint */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-zinc-800/50 opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>,
    document.body
  );
};
