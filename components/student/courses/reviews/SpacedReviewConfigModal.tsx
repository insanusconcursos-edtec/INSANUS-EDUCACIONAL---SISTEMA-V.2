
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarClock, RotateCw, Trophy } from 'lucide-react';

interface SpacedReviewConfigModalProps {
  isOpen: boolean;
  topicName: string;
  onClose: () => void;
  onSave: (intervals: number[], repeatLast: boolean) => void;
  isAutoTriggered?: boolean;
  clearConfig?: boolean;
  customMessage?: string;
  initialConfig?: number[];
}

export function SpacedReviewConfigModal({ 
  isOpen, 
  topicName, 
  onClose, 
  onSave, 
  isAutoTriggered, 
  customMessage,
  initialConfig 
}: SpacedReviewConfigModalProps) {
  const [inputValue, setInputValue] = useState(
    initialConfig && initialConfig.length > 0 
      ? initialConfig.join(', ') 
      : '1, 7, 15, 30'
  );
  const [repeatLast, setRepeatLast] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    // Validação estrita para garantir que só existam números e vírgulas
    // Permite espaços opcionais entre vírgulas
    const isValid = /^(\d+\s*,\s*)*\d+$/.test(inputValue.trim());
    
    if (!isValid) {
      setError('Formato inválido. Use apenas números separados por vírgula. Ex: 1, 7, 15');
      return;
    }

    const intervals = inputValue.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    
    if (intervals.length === 0) {
      setError('Insira pelo menos um intervalo válido.');
      return;
    }

    onSave(intervals, repeatLast);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#121418] border border-gray-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-[#1a1d24]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-900/20 text-blue-500 flex items-center justify-center border border-blue-500/30">
              <CalendarClock size={18} />
            </div>
            <h2 className="text-white font-black uppercase tracking-wide text-sm">Agendar Revisões?</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-6">
          {isAutoTriggered && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center gap-4 animate-in slide-in-from-top-2 duration-500">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/20">
                    <Trophy size={20} />
                </div>
                <div>
                    <h4 className="text-emerald-400 font-black uppercase text-xs tracking-widest">🎉 PARABÉNS!</h4>
                    <p className="text-[10px] text-emerald-500/80 uppercase font-bold leading-tight">
                        {customMessage || `Você concluiu todas as metas do tópico [${topicName}]. Deseja agendar suas revisões espaçadas agora?`}
                    </p>
                </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-2 font-bold uppercase tracking-wider">Tópico:</p>
            <p className="text-sm font-black text-white uppercase bg-black p-3 rounded border border-gray-800 leading-tight">
                {topicName}
            </p>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Intervalos de Revisão (em dias)</label>
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setError(''); }}
              placeholder="Ex: 1, 7, 15, 30"
              className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none font-mono"
            />
            {error && <p className="text-red-500 text-[10px] mt-2 font-black uppercase">{error}</p>}
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                Digite os dias separados por vírgula. Ex: &quot;1&quot; cria uma revisão para amanhã.
            </p>
          </div>

          <label className="flex items-center gap-3 p-4 border border-gray-800 rounded-lg cursor-pointer hover:bg-[#1a1d24] transition-colors group bg-black/20">
            <div className="relative flex items-center justify-center">
              <input 
                type="checkbox" 
                checked={repeatLast}
                onChange={(e) => setRepeatLast(e.target.checked)}
                className="peer appearance-none w-5 h-5 border-2 border-gray-600 rounded bg-black checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
              />
              <RotateCw size={12} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none font-bold" />
            </div>
            <div>
              <span className="text-sm font-bold text-gray-300 group-hover:text-white uppercase block tracking-wide">Repetir o Último Intervalo</span>
              <span className="text-[10px] text-gray-500">
                  Cria um ciclo infinito baseado no último dia digitado.
              </span>
            </div>
          </label>
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-800 bg-[#1a1d24]">
          <button 
            onClick={onClose} 
            className="px-5 py-3 text-xs font-bold text-gray-400 hover:text-white uppercase transition-colors rounded-lg hover:bg-white/5"
          >
            Não, Obrigado
          </button>
          <button 
            onClick={handleSave} 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase rounded-lg transition-all shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            Salvar e Agendar
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
