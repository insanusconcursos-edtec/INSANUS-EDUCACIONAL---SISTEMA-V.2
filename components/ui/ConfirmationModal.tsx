import React from 'react';
import { AlertTriangle, Loader2, Info } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isLoading?: boolean;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary'; // danger = red, primary = blue/brand
}

// Alterado para export const (Named Export) para atender ao requisito
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isLoading = false,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-[160px] overflow-y-auto scrollbar-hide">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={!isLoading ? onClose : undefined}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 mb-8">
        {/* Top Strip */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isDanger ? 'from-red-600 to-red-900' : 'from-blue-600 to-blue-900'}`}></div>

        <div className="p-6 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-full border flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(0,0,0,0.2)] ${
              isDanger 
                ? 'bg-red-900/20 border-red-900/50 text-red-500' 
                : 'bg-blue-900/20 border-blue-900/50 text-blue-500'
          }`}>
            {isDanger ? <AlertTriangle size={32} strokeWidth={1.5} /> : <Info size={32} strokeWidth={1.5} />}
          </div>

          <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">
            {title}
          </h3>
          
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
            {message}
          </p>

          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {cancelText}
            </button>
            
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-3 rounded-xl text-white font-bold text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
                  isDanger 
                    ? 'bg-red-600 hover:bg-red-700 border border-red-500 hover:border-red-600 shadow-red-900/20' 
                    : 'bg-blue-600 hover:bg-blue-700 border border-blue-500 hover:border-blue-600 shadow-blue-900/20'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Processando...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mantém default export para compatibilidade com outros arquivos
export default ConfirmationModal;