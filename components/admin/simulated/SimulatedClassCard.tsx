import React from 'react';
import { Edit, Trash2, ExternalLink, Layers, GraduationCap } from 'lucide-react';
import { SimulatedClass } from '../../../services/simulatedService';

interface SimulatedClassCardProps {
  data: SimulatedClass;
  onManage: (cls: SimulatedClass) => void;
  onEdit: (cls: SimulatedClass) => void;
  onDelete: (cls: SimulatedClass) => void;
}

const SimulatedClassCard: React.FC<SimulatedClassCardProps> = ({ data, onManage, onEdit, onDelete }) => {
  return (
    <div className="group flex flex-col bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden transition-all duration-300 hover:border-brand-red/50 hover:shadow-[0_0_20px_rgba(255,0,0,0.15)] h-full">
      {/* Image Section - Clickable to enter management */}
      <div 
        className="relative aspect-video overflow-hidden bg-zinc-950 cursor-pointer"
        onClick={() => onManage(data)}
      >
        {data.coverUrl ? (
            <img 
            src={data.coverUrl} 
            alt={data.title} 
            className="w-full h-full object-cover transition-all duration-700 scale-100 group-hover:scale-110 opacity-80 group-hover:opacity-100 grayscale-[0.2] group-hover:grayscale-0" 
            />
        ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-zinc-900/50">
                <GraduationCap size={32} className="mb-2 opacity-50"/>
                <span className="text-[10px] font-black uppercase tracking-widest">Sem Capa</span>
            </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent"></div>
        
        {/* Hover Action Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
            <span className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg transform scale-95 group-hover:scale-100 transition-transform">
                <Layers size={14} /> Gerenciar Simulados
            </span>
        </div>

        {/* Organ Badge */}
        <div className="absolute top-3 left-3">
             <span className="bg-brand-red text-[8px] font-black text-white px-2 py-1 rounded uppercase tracking-tighter shadow-lg shadow-brand-red/20 border border-red-500">
                {data.organization}
             </span>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 flex flex-col gap-2 flex-1">
         <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter leading-tight group-hover:text-brand-red transition-colors line-clamp-2">
                {data.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-bold text-zinc-500 uppercase bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 rounded">
                    {/* Placeholder para contagem real futuramente */}
                    Simulados Disponíveis
                </span>
            </div>
         </div>
      </div>

      {/* Actions Footer */}
      <div className="p-3 bg-zinc-950/80 flex gap-2 border-t border-zinc-800/50 mt-auto">
        <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onManage(data);
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-bold py-2 rounded-lg text-[10px] uppercase transition-all tracking-widest"
        >
            <Layers size={12} />
            Gerenciar
        </button>
        
        <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(data);
            }}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-all"
            title="Editar Turma"
        >
            <Edit size={14} />
        </button>
        
        {data.buyLink && (
            <a 
                href={data.buyLink} 
                onClick={(e) => e.stopPropagation()}
                target="_blank" 
                rel="noreferrer"
                className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-500 hover:text-brand-red transition-all"
                title="Link de Venda"
            >
                <ExternalLink size={14} />
            </a>
        )}

        <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(data);
            }}
            className="p-2 bg-zinc-900 hover:bg-red-900/20 border border-zinc-800 hover:border-red-900 rounded-lg text-zinc-500 hover:text-red-500 transition-all"
            title="Excluir"
        >
            <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default SimulatedClassCard;