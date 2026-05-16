import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, ArrowRight, ShieldCheck, 
  Layout, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { planService } from '../../services/planService';
import { userService } from '../../services/userService';
import { Plan } from '../../types/plan';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const PlanSelectionPage: React.FC = () => {
  const { currentUser, userData, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      if (!currentUser) return;
      try {
        setLoading(true);
        // Get plans specific to this user (from their enrollment/purchases)
        const myPlans = await planService.getStudentPlans(currentUser.uid);
        setPlans(myPlans);
      } catch (error) {
        console.error('Error loading plans:', error);
        toast.error('Erro ao carregar seus planos.');
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, [currentUser]);

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setIsConfirming(true);
  };

  const handleConfirmActivation = async () => {
    if (!currentUser || !selectedPlan) return;

    try {
      setLoading(true);
      await userService.updateUserActivePlan(currentUser.uid, selectedPlan.id);
      await refreshUserData();
      
      toast.success(`Plano "${selectedPlan.title}" ativado com sucesso!`);
      setIsConfirming(false);
      
      // Redirect to dashboard or config
      navigate('/app/dashboard');
    } catch (error) {
      console.error('Error activating plan:', error);
      toast.error('Erro ao ativar o plano.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !plans.length) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 text-amber-500"
          >
            <ShieldCheck size={20} />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Ambiente Seguro</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-white tracking-tighter"
          >
            MEUS <span className="text-amber-500">PLANOS</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-500 max-w-2xl font-medium leading-relaxed"
          >
            Selecione o plano de estudos que deseja seguir agora. Você pode trocar de plano a qualquer momento, e seu progresso será preservado.
          </motion.p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 md:gap-10">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              className="flex flex-col h-full gap-5"
            >
              {/* Poster Image Card */}
              <div 
                onClick={() => userData?.activePlanId !== plan.id && handleSelectPlan(plan)}
                className={`group relative aspect-square overflow-hidden rounded-2xl md:rounded-3xl transition-all duration-700 cursor-pointer shadow-2xl bg-black shrink-0 ${
                  userData?.activePlanId === plan.id 
                    ? 'ring-4 ring-red-600 ring-offset-4 ring-offset-black scale-[0.98]' 
                    : 'hover:scale-105 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-0 hover:z-10'
                }`}
              >
                {/* Poster Image */}
                <img 
                  src={plan.imageUrl || 'https://images.unsplash.com/photo-1544377193-33dcf4d68fb5?q=80&w=1000&auto=format&fit=crop'}
                  alt={plan.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://images.unsplash.com/photo-1544377193-33dcf4d68fb5?q=80&w=1000&auto=format&fit=crop';
                  }}
                />
                
                {/* Status Overlay for Active Plan */}
                {userData?.activePlanId === plan.id && (
                  <div className="absolute inset-0 bg-red-600/20 backdrop-blur-[2px] flex items-center justify-center z-10 animate-in fade-in duration-500">
                    <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.8)] border-4 border-white/20">
                      <CheckCircle2 size={48} className="text-white" />
                    </div>
                  </div>
                )}

                {/* Subtle overlay for contrast if needed, but keeping it clean */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Status Badge */}
                {userData?.activePlanId === plan.id && (
                  <div className="absolute top-4 right-4 px-3 py-1.5 bg-red-600 rounded-xl flex items-center gap-2 shadow-xl shadow-black/50">
                    <CheckCircle2 size={12} className="text-white" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Plano Atual</span>
                  </div>
                )}

                {/* Active Indicator Backdrop */}
                {userData?.activePlanId === plan.id && (
                  <div className="absolute inset-0 bg-amber-500/10 pointer-events-none" />
                )}
              </div>

              {/* Info BELOW the image - flex-1 and justify-between to push button down */}
              <div className="flex-1 flex flex-col justify-between space-y-6 px-1">
                <div className="space-y-3">
                  <h3 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase leading-tight line-clamp-2 min-h-[3.5rem]">
                    {plan.title}
                  </h3>
                  <div className="h-1 w-12 bg-amber-500/20 rounded-full" />
                </div>
                
                <button
                  disabled={userData?.activePlanId === plan.id}
                  onClick={() => handleSelectPlan(plan)}
                  className={`group/btn relative w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-all duration-500 overflow-hidden ${
                    userData?.activePlanId === plan.id
                      ? 'bg-zinc-900/50 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                      : 'bg-[#0a0a0c] text-amber-500 border border-amber-500/30 hover:border-amber-400 hover:text-white hover:bg-amber-500 transition-all shadow-[0_0_15px_rgba(245,158,11,0.05)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] shadow-black/50'
                  }`}
                >
                  {/* Neon Cyan edge detail on hover */}
                  <div className="absolute right-0 top-0 bottom-0 w-[4px] bg-cyan-400 opacity-0 group-hover/btn:opacity-100 group-hover/btn:shadow-[0_0_15px_#22d3ee] transition-all duration-300" />
                  
                  {userData?.activePlanId === plan.id ? 'PLANO ATUAL' : 'PERTENCER'}
                  {userData?.activePlanId !== plan.id && (
                    <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
          
          {plans.length === 0 && (
            <div className="col-span-full py-20 bg-zinc-900/10 border-2 border-dashed border-zinc-800 rounded-[40px] flex flex-col items-center justify-center gap-6">
              <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700">
                <Layout size={40} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-white font-black text-xl uppercase tracking-tight">Nenhum plano encontrado</p>
                <p className="text-zinc-500 text-sm font-medium">Você ainda não possui planos de estudos vinculados à sua conta.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirming && selectedPlan && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirming(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0c] border-2 border-amber-500/30 rounded-[40px] p-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-700 animate-shimmer"></div>
              
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center text-amber-500">
                  <AlertCircle size={40} />
                </div>
                
                <div className="space-y-4">
                  {userData?.activePlanId ? (
                    <>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                        TROCAR DE <span className="text-amber-500">PLANO</span>?
                      </h3>
                      <p className="text-zinc-500 font-medium leading-relaxed italic">
                        Você já está estudando com o plano <strong>{plans.find(p => p.id === userData.activePlanId)?.title}</strong>. Deseja pausar ele e ativar o <strong>{selectedPlan.title}</strong> agora?
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                        ATIVAR <span className="text-amber-500">ESTUDOS</span>?
                      </h3>
                      <p className="text-zinc-500 font-medium leading-relaxed italic">
                        Tem certeza que deseja ativar o plano <strong>{selectedPlan.title}</strong> para iniciar seu cronograma?
                      </p>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 w-full pt-4">
                  <button
                    onClick={() => setIsConfirming(false)}
                    className="py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                  >
                    CANCELAR
                  </button>
                  <button
                    onClick={handleConfirmActivation}
                    className="py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-amber-500/20 transition-all"
                  >
                    SIM, PERTENCER
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
