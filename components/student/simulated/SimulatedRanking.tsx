
import React, { useEffect, useState } from 'react';
import { Trophy, Medal, User } from 'lucide-react';
import { getExamRanking, SimulatedAttempt } from '../../../services/simulatedAttemptService';
import { useAuth } from '../../../contexts/AuthContext';

interface SimulatedRankingProps {
  simulatedId: string;
}

const SimulatedRanking: React.FC<SimulatedRankingProps> = ({ simulatedId }) => {
  const { currentUser } = useAuth();
  const [ranking, setRanking] = useState<SimulatedAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        const data = await getExamRanking(simulatedId);
        setRanking(data);
      } catch (error) {
        console.error("Erro ao carregar ranking", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [simulatedId]);

  if (loading) {
    return (
        <div className="p-8 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
            Carregando Classificação...
        </div>
    );
  }

  if (ranking.length === 0) {
    return (
        <div className="p-8 text-center text-zinc-600 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-zinc-800 rounded-xl">
            Seja o primeiro a completar este simulado!
        </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" />
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Ranking Geral</h3>
        </div>
        
        <div className="divide-y divide-zinc-800">
            {ranking.map((attempt, index) => {
                const isMe = attempt.userId === currentUser?.uid;
                const position = index + 1;
                
                let badgeColor = "text-zinc-500";
                if (position === 1) badgeColor = "text-yellow-500";
                if (position === 2) badgeColor = "text-zinc-300";
                if (position === 3) badgeColor = "text-amber-700";

                return (
                    <div key={attempt.id} className={`flex items-center justify-between p-4 ${isMe ? 'bg-brand-red/10 border-l-2 border-l-brand-red' : 'hover:bg-zinc-900/50'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-8 text-center font-black text-lg ${badgeColor}`}>
                                {position <= 3 ? <Medal size={20} className="mx-auto" /> : position}
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 overflow-hidden">
                                    {attempt.userPhoto ? (
                                        <img src={attempt.userPhoto} alt="User" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={14} className="text-zinc-500" />
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-xs font-bold uppercase ${isMe ? 'text-white' : 'text-zinc-300'}`}>
                                        {attempt.userName} {isMe && '(Você)'}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                        {new Date(attempt.completedAt?.toDate()).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            <div className="text-lg font-black text-white tabular-nums">
                                {attempt.score} <span className="text-xs text-zinc-600 font-bold">pts</span>
                            </div>
                            <div className={`text-[9px] font-bold uppercase tracking-widest ${attempt.isApproved ? 'text-emerald-500' : 'text-red-500'}`}>
                                {attempt.isApproved ? 'Aprovado' : 'Reprovado'}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default SimulatedRanking;
