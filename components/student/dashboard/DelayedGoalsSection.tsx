
import React from 'react';
import { AlertTriangle, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { StudentGoalCard, StudentGoal } from '../StudentGoalCard';

interface DelayedGoalsSectionProps {
  overdueReviews: StudentGoal[];
  overdueGeneral: StudentGoal[];
  onReplan: () => Promise<void>;
  isReplanning: boolean;
  onToggleComplete: (goal: StudentGoal) => Promise<void>;
  onRefresh: () => Promise<void>;
  onPdfClick?: (goal: StudentGoal, fileUrl: string, index: number) => void;
  renderNotebookNode?: (goal: StudentGoal) => React.ReactNode;
}

export const DelayedGoalsSection: React.FC<DelayedGoalsSectionProps> = ({
  overdueReviews,
  overdueGeneral,
  onReplan,
  isReplanning,
  onToggleComplete,
  onRefresh,
  onPdfClick,
  renderNotebookNode
}) => {
  const hasDelays = overdueReviews.length > 0 || overdueGeneral.length > 0;

  if (!hasDelays) return null;

  return (
    <section className="mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-zinc-950/50 border border-red-500/20 rounded-2xl overflow-hidden shadow-lg max-h-[500px] overflow-y-auto custom-scrollbar">
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 text-red-500 rounded-2xl">
              <AlertTriangle size={32} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-red-500 font-bold tracking-wide uppercase text-2xl">Metas em Atraso</h3>
              <p className="text-zinc-400 text-sm font-medium mt-1">
                Você possui <span className="text-red-500 font-bold">{overdueReviews.length + overdueGeneral.length}</span> metas acumuladas de dias anteriores.
              </p>
            </div>
          </div>
          
          <button 
            onClick={onReplan}
            disabled={isReplanning}
            className="w-full md:w-auto px-8 py-4 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 font-black text-sm rounded-2xl uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 group hover:scale-[1.02] active:scale-95"
          >
            {isReplanning ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Replanejando...</>
            ) : (
              <><RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" /> Replanejar Atrasos</>
            )}
          </button>
        </div>

        <div className="p-6 md:p-8 pt-0 space-y-8">
          {overdueReviews.length > 0 && (
            <div>
              <h4 className="text-red-500/80 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Clock size={12} /> Revisões Espaçadas Acumuladas
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {overdueReviews.map(goal => (
                  <StudentGoalCard 
                    key={goal.id} 
                    goal={goal} 
                    onToggleComplete={onToggleComplete}
                    onRefresh={onRefresh}
                    onPdfClick={onPdfClick}
                    renderNotebookNode={renderNotebookNode}
                    isDelayed={true}
                  />
                ))}
              </div>
            </div>
          )}

          {overdueGeneral.length > 0 && (
            <div>
              <h4 className="text-red-500/80 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Clock size={12} /> Metas de Conteúdo em Atraso
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {overdueGeneral.map(goal => (
                  <StudentGoalCard 
                    key={goal.id} 
                    goal={goal} 
                    onToggleComplete={onToggleComplete}
                    onRefresh={onRefresh}
                    onPdfClick={onPdfClick}
                    renderNotebookNode={renderNotebookNode}
                    isDelayed={true}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-red-500/5 p-4 text-center border-t border-red-500/10">
          <p className="text-[10px] text-red-400/50 font-bold uppercase tracking-widest">
            O replanejamento moverá todas as metas acima para hoje, empurrando o cronograma futuro.
          </p>
        </div>
      </div>
    </section>
  );
};
