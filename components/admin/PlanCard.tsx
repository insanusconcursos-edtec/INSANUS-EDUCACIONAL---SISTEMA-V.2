
import React from 'react';
import { Edit, Trash2, Copy, ExternalLink, Layers } from 'lucide-react';
import { Plan } from '../../services/planService';
import { useNavigate } from 'react-router-dom';

interface PlanCardProps {
  plan: Plan;
  onEdit: (plan: Plan) => void;
  onDelete: (plan: Plan) => void;
  onDuplicate: (plan: Plan, e: React.MouseEvent) => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onEdit, onDelete, onDuplicate }) => {
  const navigate = useNavigate();

  return (
    <div className="group flex flex-col bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden transition-all duration-300 hover:border-brand-red/50 hover:shadow-[0_0_20px_rgba(255,0,0,0.15)] h-full">
      {/* Image Section - Clickable to enter editor */}
      <div 
        className="relative aspect-square overflow-hidden bg-zinc-950 cursor-pointer"
        onClick={() => navigate(`/admin/plans/${plan.id}`)}
      >
        {plan.imageUrl ? (
            <img 
            src={plan.imageUrl} 
            alt={plan.title} 
            className="w-full h-full object-cover transition-all duration-700 scale-100 group-hover:scale-110 opacity-70 group-hover:opacity-100 grayscale-[0.3] group-hover:grayscale-0" 
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700">
                <span className="text-[10px] font-black uppercase">Sem Imagem</span>
            </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent"></div>
        
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
            <span className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg transform scale-95 group-hover:scale-100 transition-transform">
                <Layers size={14} /> Gerenciar Conteúdo
            </span>
        </div>

        {/* Badges */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 pointer-events-none">
            <span className="bg-brand-black/90 backdrop-blur-md text-[8px] font-black text-zinc-300 px-2 py-1 rounded border border-zinc-700 uppercase tracking-tighter">
                {plan.category}
            </span>
            {plan.subcategory && (
                 <span className="bg-brand-red text-[8px] font-black text-white px-2 py-1 rounded uppercase tracking-tighter shadow-lg shadow-brand-red/20">
                    {plan.subcategory}
                 </span>
            )}
        </div>

        {/* Info Overlay */}
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
             <h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none mb-1 group-hover:text-brand-red transition-colors line-clamp-2">{plan.title}</h3>
             <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{plan.organ}</p>
        </div>
      </div>

      {/* Actions Section */}
      <div className="p-3 bg-zinc-950/80 flex gap-2 border-t border-zinc-800/50 mt-auto">
        <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(plan);
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-bold py-2 rounded-lg text-[10px] uppercase transition-all tracking-widest"
        >
            <Edit size={12} />
            Metadados
        </button>
        
        <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(plan, e);
            }}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-all"
            title="Duplicar"
        >
            <Copy size={14} />
        </button>
        
        {plan.purchaseLink && (
            <a 
                href={plan.purchaseLink} 
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
              if (plan.id) onDelete(plan);
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

export default PlanCard;
