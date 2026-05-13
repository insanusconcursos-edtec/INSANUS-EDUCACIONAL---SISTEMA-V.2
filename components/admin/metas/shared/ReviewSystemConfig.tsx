
import React from 'react';
import { Repeat } from 'lucide-react';
import { SpacedReviewConfig } from '../../../../services/metaService';

interface ReviewSystemConfigProps {
  config: SpacedReviewConfig;
  onChange: (config: SpacedReviewConfig) => void;
  customColor?: string;
}

const ReviewSystemConfig: React.FC<ReviewSystemConfigProps> = ({ 
  config, 
  onChange,
  customColor = '#22c55e'
}) => {
  
  const updateConfig = (key: keyof SpacedReviewConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div 
        className="p-4 rounded-xl border transition-all"
        style={{ 
            backgroundColor: config.active ? `${customColor}10` : 'rgba(24, 24, 27, 0.2)', // zinc-900/20
            borderColor: config.active ? `${customColor}40` : '#27272a' // zinc-800
        }}
    >
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div 
                    className="p-2 rounded-full"
                    style={{ 
                        backgroundColor: config.active ? customColor : '#27272a',
                        color: config.active ? '#000' : '#71717a'
                    }}
                >
                    <Repeat size={16} />
                </div>
                <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">Sistema de Revisões Espaçadas</h4>
                    <p className="text-[10px] text-zinc-500">Agendar revisões automáticas desta meta.</p>
                </div>
            </div>
            
            <button
                type="button"
                onClick={() => updateConfig('active', !config.active)}
                className="relative w-12 h-6 rounded-full transition-colors"
                style={{ backgroundColor: config.active ? customColor : '#27272a' }}
            >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${config.active ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
        </div>

        {config.active && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Intervalos (em dias)</label>
                    <input 
                        value={config.intervals}
                        onChange={(e) => {
                            if (/^[\d,\s]*$/.test(e.target.value)) {
                                updateConfig('intervals', e.target.value);
                            }
                        }}
                        placeholder="1, 7, 15, 30"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-xs text-white placeholder-zinc-700 outline-none font-mono tracking-widest"
                        onFocus={(e) => e.target.style.borderColor = customColor}
                        onBlur={(e) => e.target.style.borderColor = '#27272a'}
                    />
                    <p className="text-[9px] text-zinc-600">Separe os dias por vírgula. Ex: 1 dia depois, 7 dias depois, etc.</p>
                </div>

                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        id={`repeatLast`}
                        checked={config.repeatLast}
                        onChange={(e) => updateConfig('repeatLast', e.target.checked)}
                        className="w-4 h-4 rounded bg-zinc-950 border-zinc-800 focus:ring-0 cursor-pointer"
                        style={{ accentColor: customColor }}
                    />
                    <label htmlFor={`repeatLast`} className="text-xs text-zinc-300 font-bold uppercase select-none cursor-pointer">
                        Repetir último intervalo indefinidamente?
                    </label>
                </div>
            </div>
        )}
    </div>
  );
};

export default ReviewSystemConfig;
