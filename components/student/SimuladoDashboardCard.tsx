import React from 'react';
import { Trophy, Clock, Calendar, Lock, CheckCircle } from 'lucide-react';

export interface ComputedSimulado {
    id: string;
    title: string;
    duration: number;
    status: 'blocked' | 'released' | 'scheduled';
    cycleIndex: number;
    cycleName?: string;
    itemIndex: number;
    date?: Date;
    bookletUrl?: string; // Campo necessário para passar o PDF ao agendamento
}

interface SimuladoDashboardCardProps {
    simulado: ComputedSimulado;
    onSchedule?: (id: string) => void;
}

export const SimuladoDashboardCard: React.FC<SimuladoDashboardCardProps> = ({ simulado, onSchedule }) => {
    const isReleased = simulado.status === 'released';
    const isScheduled = simulado.status === 'scheduled';
    const isBlocked = simulado.status === 'blocked';

    // Format date if scheduled
    const scheduledDateStr = simulado.date ? simulado.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : '';

    return (
        <div className={`
            relative overflow-hidden rounded-xl border p-5 transition-all duration-300
            ${isBlocked 
                ? 'bg-[#15171b] border-zinc-800 opacity-70 grayscale' 
                : isScheduled
                    ? 'bg-zinc-900 border-green-500/30 shadow-lg shadow-green-900/10'
                    : 'bg-gradient-to-br from-zinc-900 to-black border-yellow-600/50 shadow-lg shadow-yellow-900/10 hover:border-yellow-500 hover:shadow-yellow-500/20'}
        `}>
            {/* Faixa Lateral */}
            {isReleased && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-yellow-600 to-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
            )}
            {isScheduled && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-green-600 to-green-400 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pl-2">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl border 
                        ${isBlocked ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 
                          isScheduled ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                          'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                        {isBlocked ? <Lock size={24} /> : <Trophy size={24} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border 
                                ${isBlocked ? 'bg-zinc-800 text-zinc-500 border-zinc-700' : 
                                  isScheduled ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                  'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                                {isBlocked ? 'BLOQUEADO' : isScheduled ? 'AGENDADO' : 'AGUARDANDO AGENDAMENTO'}
                            </span>
                            {!isBlocked && !isScheduled && (
                                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                                    Ciclo {simulado.cycleIndex + 1}
                                </span>
                            )}
                        </div>
                        <h3 className={`text-lg font-black uppercase leading-tight ${isBlocked ? 'text-zinc-500' : 'text-white'}`}>
                            {simulado.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 flex items-center gap-1">
                                <Clock size={12} /> {Math.floor(simulado.duration / 60)}h {simulado.duration % 60 > 0 ? `${simulado.duration % 60}min` : ''} de Prova
                            </span>
                        </div>
                        {isBlocked && (
                            <p className="text-[10px] text-zinc-500 mt-2 italic">
                                Complete todas as metas do ciclo {simulado.cycleName || simulado.cycleIndex + 1} para liberar esse simulado.
                            </p>
                        )}
                        {!isBlocked && !isScheduled && (
                            <p className="text-[10px] text-yellow-500/70 mt-2 italic font-bold">
                                Simulado liberado! Escolha uma data para realizar a prova.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex-shrink-0">
                    {isBlocked && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                            <Lock className="w-4 h-4 text-zinc-600" />
                            <span className="text-xs font-bold text-zinc-600 uppercase">Bloqueado</span>
                        </div>
                    )}

                    {isReleased && !isScheduled && onSchedule && (
                        <button 
                            onClick={() => onSchedule(simulado.id)}
                            className="group relative px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-black text-xs rounded-xl uppercase tracking-wider transition-all transform hover:scale-105 shadow-lg shadow-yellow-900/40 flex items-center justify-center gap-2"
                        >
                            <span>AGENDAR</span>
                            <Calendar size={14} className="transition-transform group-hover:translate-x-1" />
                        </button>
                    )}

                    {isScheduled && (
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2 px-5 py-2 bg-green-900/20 border border-green-500/30 rounded-lg text-green-400 mb-1">
                                <CheckCircle size={14} />
                                <span className="text-xs font-black uppercase tracking-wider">Confirmado</span>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-bold uppercase">
                                Para: {scheduledDateStr}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};