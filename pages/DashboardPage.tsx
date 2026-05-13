
import React from 'react';

const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Planos de Estudo</h2>
          <div className="w-12 h-1 bg-brand-red"></div>
        </div>
        
        <div className="flex items-center gap-3">
            <button className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-black uppercase text-zinc-400 hover:text-white hover:border-zinc-600 transition-all tracking-widest">
                Gerenciar Categorias
            </button>
            <button className="px-8 py-2.5 bg-brand-red rounded-lg text-[10px] font-black uppercase text-white shadow-lg shadow-brand-red/40 hover:bg-red-600 hover:scale-[1.02] transition-all tracking-widest">
                + Novo Plano
            </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-1 bg-zinc-900/30 border border-zinc-800/50 rounded-lg flex flex-wrap items-center gap-2 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/></svg>
            <span>Filtros:</span>
        </div>
        
        <select className="bg-brand-black border border-zinc-800 rounded-md text-[10px] font-bold text-white px-4 py-2 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[180px]">
            <option>TODAS AS CATEGORIAS</option>
        </select>
        
        <select className="bg-brand-black border border-zinc-800 rounded-md text-[10px] font-bold text-white px-4 py-2 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[180px]">
            <option>TODAS AS SUBCATEGORIAS</option>
        </select>
        
        <div className="relative flex-1 min-w-[200px]">
            <input 
                type="text" 
                placeholder="FILTRAR POR ÓRGÃO..."
                className="w-full bg-brand-black border border-zinc-800 rounded-md text-[10px] font-bold text-white px-4 py-2 placeholder-zinc-700 focus:outline-none focus:border-brand-red transition-all uppercase"
            />
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {[
          { title: 'ICPOL', subtitle: '5 Disciplinas • 1 Ciclos', image: 'https://images.unsplash.com/photo-1595152772835-219674b2a8a6?q=80&w=400&auto=format&fit=crop', tag: 'CARREIRAS_POLICIAIS', tags: [] },
          { title: 'POLÍCIA CIVIL ACRE', subtitle: '1 Disciplinas • 0 Ciclos', image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=400&auto=format&fit=crop', tag: 'CARREIRAS_POLICIAIS', tags: ['POLÍCIAS CIVIS', 'PC/AC'], isUrgente: true },
        ].map((plan, i) => (
          <div key={i} className="group flex flex-col bg-brand-black border border-zinc-800/80 rounded-2xl overflow-hidden transition-all duration-300 hover:border-brand-red/50 hover:shadow-[0_0_20px_rgba(255,0,0,0.15)]">
            {/* Image Section */}
            <div className="relative aspect-[4/5] overflow-hidden">
                <img src={plan.image} alt={plan.title} className="w-full h-full object-cover transition-all duration-700 scale-100 group-hover:scale-110 opacity-60 group-hover:opacity-100 grayscale-[0.5] group-hover:grayscale-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/20 to-transparent"></div>
                
                {/* Badges */}
                <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
                    <span className="bg-brand-black/90 backdrop-blur-md text-[8px] font-black text-white px-2 py-1 rounded border border-zinc-700 uppercase tracking-tighter">
                        {plan.tag}
                    </span>
                    {plan.tags.map((t, idx) => (
                         <span key={idx} className={`${idx === 0 ? 'bg-red-600' : 'bg-blue-600'} text-[8px] font-black text-white px-2 py-1 rounded uppercase tracking-tighter`}>
                            {t}
                         </span>
                    ))}
                </div>

                {/* Info Overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                     <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-1 group-hover:text-brand-red transition-colors">{plan.title}</h3>
                     <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{plan.subtitle}</p>
                </div>
            </div>

            {/* Actions Section */}
            <div className="p-4 bg-zinc-950/50 flex gap-2">
              <button className="flex-1 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/50 text-white font-black py-2.5 rounded-xl text-[10px] uppercase transition-all tracking-widest">
                Editar
              </button>
              <button className="p-2.5 bg-zinc-900/80 border border-zinc-800/50 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
              </button>
              <button className="p-2.5 bg-zinc-900/80 border border-zinc-800/50 rounded-xl text-zinc-500 hover:text-brand-red hover:bg-zinc-800 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
              </button>
            </div>
          </div>
        ))}

        {/* Create Card */}
        <button className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800/50 rounded-2xl p-8 hover:border-brand-red/30 hover:bg-zinc-900/10 transition-all group min-h-[400px]">
            <div className="w-14 h-14 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600 group-hover:text-brand-red group-hover:border-brand-red/30 group-hover:shadow-[0_0_20px_rgba(255,0,0,0.1)] transition-all mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/></svg>
            </div>
            <span className="text-[10px] font-black uppercase text-zinc-500 group-hover:text-white transition-colors tracking-[0.2em]">Criar Novo Plano</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
