
import React from 'react';
import { createPortal } from 'react-dom';
import MindMapFullscreen from '../admin/metas/tools/mindmap/MindMapFullscreen';
import { MindMapNode } from '../../services/metaService';
import { Clock } from 'lucide-react';

interface TimerState {
  formattedTime: string;
  status: 'idle' | 'running' | 'paused' | 'completed';
}

interface MindMapViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: MindMapNode[]; // Usando o tipo de domínio correto agora
  edges: any[]; // Não usado no novo viewer
  timerState: TimerState;
  title?: string;
}

const MindMapViewerModal: React.FC<MindMapViewerModalProps> = ({ 
  isOpen, 
  onClose, 
  nodes, 
  timerState,
  title = "Mapa Mental"
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* Visualizador Fullscreen (Reutilizado do Admin em modo ReadOnly) */}
      <MindMapFullscreen 
        nodes={nodes}
        onChange={() => {}} // No-op
        onClose={onClose}
        readOnly={true}
      />

      {/* TIMER OVERLAY (Canto Inferior Direito - Acima do visualizador) */}
      {timerState.status === 'running' && (
        <div className="fixed bottom-8 right-8 z-[210] pointer-events-none animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-red-600 blur-lg opacity-50 animate-pulse"></div>
                    <div className="relative p-2 bg-red-600 rounded-lg text-white">
                        <Clock size={20} />
                    </div>
                </div>
                <div>
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">Estudando...</span>
                    <div className="text-2xl font-mono font-bold text-white leading-none tracking-wider">
                        {timerState.formattedTime}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default MindMapViewerModal;
