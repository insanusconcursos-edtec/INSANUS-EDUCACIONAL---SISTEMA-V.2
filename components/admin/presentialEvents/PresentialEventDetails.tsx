import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Users, Ticket, 
  Search, Download, Plus, 
  Trash2, Mail, Phone, 
  CheckCircle2, AlertCircle, TrendingUp, ShieldCheck,
  UserCheck, UserPlus, Filter, Layers
} from 'lucide-react';
import { PresentialEvent, PresentialEventRegistration } from '../../../types/presentialEvent';
import { presentialEventService } from '../../../services/presentialEventService';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PresentialEventDetailsProps {
  event: PresentialEvent;
  onBack: () => void;
}

export const PresentialEventDetails: React.FC<PresentialEventDetailsProps> = ({ event, onBack }) => {
  const [registrations, setRegistrations] = useState<PresentialEventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PAYING' | 'SCHOLARSHIP'>('ALL');

  useEffect(() => {
    loadRegistrations();
  }, [event.id]);

  const loadRegistrations = async () => {
    if (!event.id) return;
    setLoading(true);
    try {
      const data = await presentialEventService.getRegistrationsByEvent(event.id);
      setRegistrations(data);
    } catch (error) {
      console.error("Error loading registrations:", error);
      toast.error('Erro ao carregar inscritos');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = registrations.length;
    const paying = registrations.filter(r => r.type === 'PAYING').length;
    const scholarship = registrations.filter(r => r.type === 'SCHOLARSHIP').length;
    const remaining = Math.max(0, event.totalTickets - total);
    const occupancy = event.totalTickets > 0 ? (total / event.totalTickets) * 100 : 0;

    return { total, paying, scholarship, remaining, occupancy };
  }, [registrations, event.totalTickets]);

  const filteredRegistrations = useMemo(() => {
    return registrations.filter(reg => {
      const matchesSearch = reg.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           reg.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'ALL' || reg.type === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [registrations, searchTerm, filterType]);

  const handleExportCSV = () => {
    const headers = ['Nome', 'Email', 'CPF', 'WhatsApp', 'Tipo', 'Lote', 'Data de Inscrição'];
    const rows = filteredRegistrations.map(r => [
      r.userName,
      r.userEmail,
      r.userCpf || 'N/A',
      r.userPhone || 'N/A',
      r.type === 'PAYING' ? 'Pagante' : 'Bolsista',
      r.lotId || 'N/A',
      format(r.registeredAt instanceof Date ? r.registeredAt : (r.registeredAt as any).toDate(), 'dd/MM/yyyy HH:mm')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inscritos_${event.title.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white hover:border-zinc-700 transition-all group"
          >
            <ArrowLeft className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-brand-red uppercase tracking-[0.2em]">Área do Evento</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{event.status}</span>
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight leading-none">{event.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <Download size={16} /> Exportar Lista
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Registered */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-24 h-24 bg-brand-red/5 blur-3xl rounded-full" />
           <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-brand-red/10 rounded-xl">
                 <Users className="text-brand-red" size={24} />
              </div>
              <div className="text-right">
                 <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Total Inscritos</p>
                 <h3 className="text-3xl font-black text-white tracking-tighter">{stats.total}</h3>
              </div>
           </div>
           <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-red transition-all duration-1000" 
                style={{ width: `${stats.occupancy}%` }}
              />
           </div>
           <p className="mt-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
             {stats.occupancy.toFixed(1)}% de ocupação das cadeiras
           </p>
        </div>

        {/* Paying */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full" />
           <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                 <TrendingUp className="text-emerald-500" size={24} />
              </div>
              <div className="text-right">
                 <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Pagantes</p>
                 <h3 className="text-3xl font-black text-white tracking-tighter">{stats.paying}</h3>
              </div>
           </div>
           <p className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider flex items-center gap-1">
             <CheckCircle2 size={12} /> Faturamento Real
           </p>
        </div>

        {/* Scholarship */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
           <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                 <UserCheck className="text-blue-500" size={24} />
              </div>
              <div className="text-right">
                 <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Bolsistas</p>
                 <h3 className="text-3xl font-black text-white tracking-tighter">{stats.scholarship}</h3>
              </div>
           </div>
           <p className="text-[10px] text-blue-500/70 font-bold uppercase tracking-wider flex items-center gap-1">
             <Plus size={12} /> Acessos Cortesia
           </p>
        </div>

        {/* Remaining Seats */}
        <div className="bg-zinc-900 border-2 border-brand-red/30 p-6 rounded-2xl relative overflow-hidden group shadow-[0_0_30px_rgba(239,68,68,0.1)]">
           <div className="absolute top-0 right-0 w-24 h-24 bg-brand-red/10 blur-3xl rounded-full" />
           <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-brand-red rounded-xl shadow-lg shadow-brand-red/20">
                 <Ticket className="text-white" size={24} />
              </div>
              <div className="text-right">
                 <p className="text-[10px] text-brand-red font-black uppercase tracking-widest">Vagas Restantes</p>
                 <h3 className="text-3xl font-black text-white tracking-tighter">{stats.remaining}</h3>
              </div>
           </div>
           <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
             De um total de {event.totalTickets} cadeiras
           </p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-zinc-800 bg-zinc-900/50 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-red/10 rounded-lg">
                <Users className="text-brand-red" size={20} />
             </div>
             <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Lista de Alunos</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Controle de acessos e ingressos vendidos</p>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Search */}
            <div className="relative group w-full sm:w-80">
              <Search className="absolute left-4 top-3.5 text-zinc-600 group-focus-within:text-brand-red transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-brand-red transition-all"
              />
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-2xl border border-zinc-800">
              {[
                { id: 'ALL', label: 'Tudo' },
                { id: 'PAYING', label: 'Pagantes' },
                { id: 'SCHOLARSHIP', label: 'Bolsistas' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFilterType(opt.id as any)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    filterType === opt.id 
                      ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-950/50 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                <th className="px-8 py-5">Aluno</th>
                <th className="px-8 py-5">Documentos</th>
                <th className="px-8 py-5">Categoria</th>
                <th className="px-8 py-5">Lote</th>
                <th className="px-8 py-5">Data Inscrição</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-red mx-auto" />
                  </td>
                </tr>
              ) : filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <AlertCircle className="mx-auto text-zinc-700 mb-4" size={32} />
                    <p className="text-zinc-500 font-bold uppercase tracking-widest">Nenhum aluno localizado</p>
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 font-black group-hover:bg-brand-red group-hover:text-white transition-all">
                            {reg.userName.charAt(0).toUpperCase()}
                         </div>
                         <div>
                            <p className="text-sm font-black text-white uppercase group-hover:text-brand-red transition-colors">{reg.userName}</p>
                            <p className="text-xs text-zinc-500">{reg.userEmail}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                             <ShieldCheck size={12} className="text-zinc-600" /> {reg.userCpf || 'N/A'}
                          </p>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                             <Phone size={12} className="text-zinc-600" /> {reg.userPhone || 'N/A'}
                          </p>
                       </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        reg.type === 'PAYING' 
                          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' 
                          : 'border-blue-500/20 bg-blue-500/5 text-blue-500'
                      }`}>
                        {reg.type === 'PAYING' ? 'Pagante' : 'Bolsista'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <Layers className="text-zinc-600" size={14} />
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-tight">
                          {reg.lotId ? `Lote: ${reg.lotId}` : 'Venda Direta'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">
                        {format(reg.registeredAt instanceof Date ? reg.registeredAt : (reg.registeredAt as any).toDate(), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <button className="p-2 text-zinc-600 hover:text-brand-red transition-colors">
                          <Trash2 size={18} />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
