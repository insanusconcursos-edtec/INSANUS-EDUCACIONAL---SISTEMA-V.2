
import React from 'react';
import { Check } from 'lucide-react';

const PRESET_COLORS = [
  '#3b82f6', // Azul
  '#22c55e', // Verde
  '#eab308', // Amarelo
  '#f97316', // Laranja
  '#ef4444', // Vermelho
  '#a855f7', // Roxo
  '#ec4899', // Rosa
  '#52525b', // Padrão (Cinza)
];

interface MetaColorSelectorProps {
  color: string;
  onChange: (color: string) => void;
}

export const MetaColorSelector: React.FC<MetaColorSelectorProps> = ({ color, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Cor de Destaque</label>
      <div className="flex items-center gap-3 flex-wrap">
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${color === preset ? 'ring-2 ring-offset-2 ring-offset-zinc-950 ring-white scale-110' : 'hover:scale-110'}`}
            style={{ backgroundColor: preset }}
            title={preset}
          >
            {color === preset && <Check size={12} className="text-white drop-shadow-md" />}
          </button>
        ))}
        
        <div className="w-px h-6 bg-zinc-800 mx-2"></div>
        
        <div className="relative group">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-white to-zinc-500 flex items-center justify-center cursor-pointer border border-zinc-700 group-hover:scale-110 transition-transform">
                <span className="text-[8px] font-bold text-black">+</span>
            </div>
            <input 
                type="color" 
                value={color}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Cor Personalizada"
            />
        </div>
      </div>
    </div>
  );
};
