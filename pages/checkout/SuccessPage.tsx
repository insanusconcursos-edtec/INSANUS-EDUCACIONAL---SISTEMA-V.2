import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SuccessPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-6"
      >
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center"
          >
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </motion.div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">
            Pagamento Aprovado!
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Parabéns! Sua vaga está garantida. As instruções de acesso e sua senha temporária acabaram de ser enviadas para o seu e-mail.
          </p>
        </div>

        <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50 text-left">
          <p className="text-[10px] font-black text-zinc-500 uppercase mb-2">Próximos passos:</p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="mt-1 w-4 h-4 bg-zinc-700 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0">1</div>
              <p className="text-xs text-zinc-300">Confira sua caixa de entrada (e spam) pelo e-mail de Boas-vindas.</p>
            </li>
            <li className="flex items-start gap-3">
              <div className="mt-1 w-4 h-4 bg-zinc-700 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0">2</div>
              <p className="text-xs text-zinc-300">Use os dados enviados para entrar na sua nova conta.</p>
            </li>
          </ul>
        </div>

        <div className="pt-4 space-y-3">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-white text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors uppercase text-sm"
          >
            Acessar Plataforma
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => navigate('/perfil')}
            className="w-full bg-transparent text-zinc-500 font-bold py-2 rounded-xl flex items-center justify-center gap-2 hover:text-white transition-colors text-xs"
          >
            <User className="w-3 h-3" />
            Ver meu Perfil
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SuccessPage;
