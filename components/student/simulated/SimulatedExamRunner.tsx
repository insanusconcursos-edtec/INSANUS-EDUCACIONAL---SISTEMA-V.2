
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, FileText, CheckCircle2, AlertTriangle, LogOut, Check, ArrowLeft, Layers } from 'lucide-react';
import { SimulatedExam } from '../../../services/simulatedService';
import { useAuth } from '../../../contexts/AuthContext';
import { submitExamAttempt, SimulatedAttempt } from '../../../services/simulatedAttemptService';
import { updateStudent } from '../../../services/userService';

interface SimulatedExamRunnerProps {
  exam: SimulatedExam;
  onClose: () => void;
  onComplete: (result: SimulatedAttempt) => void;
  classId?: string;
}

const SimulatedExamRunner: React.FC<SimulatedExamRunnerProps> = ({ exam, onClose, onComplete, classId }) => {
  const { currentUser, userData } = useAuth();
  
  // States
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [missingQuestions, setMissingQuestions] = useState<number[]>([]);
  
  // Modal States
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false); 

  // Discipline Headers Support
  const headers = React.useMemo(() => {
    if (!exam.hasBlocks || !exam.blocks) return {};
    const h: Record<number, { name: string; range: string }> = {};
    let currentStart = 1;
    exam.blocks.forEach(block => {
      (block.disciplines || []).forEach(disc => {
        const qStart = currentStart;
        const qEnd = currentStart + (Number(disc.questionCount) || 0) - 1;
        h[qStart] = { 
          name: disc.name, 
          range: `Questões ${String(qStart).padStart(2, '0')} a ${String(qEnd).padStart(2, '0')}` 
        };
        currentStart = qEnd + 1;
      });
    });
    return h;
  }, [exam]);

  // Handlers
  const handleOptionSelect = (questionIndex: number, option: string) => {
    setAnswers(prev => {
        const current = prev[questionIndex];
        // Toggle logic: Desmarcar se clicar na mesma (útil para provas estilo Cespe/Penalidade)
        if (current === option && exam.hasPenalty) {
            const next = { ...prev };
            delete next[questionIndex];
            return next;
        }
        return { ...prev, [questionIndex]: option };
    });

    // Remove da lista de erros visualmente assim que marca uma opção
    if (missingQuestions.includes(questionIndex)) {
        setMissingQuestions(prevMissing => prevMissing.filter(q => q !== questionIndex));
    }
  };

  // PASSO 2 (PARTE A): Validação e Abertura do Modal
  const handleFinish = () => {
    console.log("%c 🚀 INICIANDO VALIDAÇÃO", "color: green; font-weight: bold;");

    // 0. VERIFICAÇÃO DE INTEGRIDADE
    if (!exam.questions || exam.questions.length === 0) {
        alert("ERRO TÉCNICO: Este simulado está em modo RASCUNHO ou não possui gabarito cadastrado.");
        return;
    }

    // 1. VALIDAÇÃO DE OBRIGATORIEDADE (Regra: Sem penalidade = Obrigatório preencher tudo)
    if (!exam.hasPenalty) {
        const missing: number[] = [];
        
        for (let i = 1; i <= exam.questionCount; i++) {
            const val = answers[i] || answers[String(i)];
            const hasAnswer = val !== undefined && val !== null && val !== "";
            if (!hasAnswer) missing.push(i);
        }

        if (missing.length > 0) {
            console.warn(`⛔ BLOQUEIO: Faltam ${missing.length} questões.`);
            setMissingQuestions(missing); 
            setShowIncompleteModal(true); 
            return; 
        }
    }

    // 2. TUDO CERTO -> ABRE O MODAL (Não usa mais window.confirm)
    setShowFinishModal(true);
  };

  // PASSO 2 (PARTE B): Envio Real
  const handleConfirmSubmission = async () => {
    if (!currentUser) return;
    
    // Fecha o modal visualmente mas mantém loading no botão se necessário, 
    // ou podemos manter o modal aberto com estado de loading (melhor UX)
    setIsSubmitting(true);

    try {
        console.log("🔄 Enviando respostas para cálculo...");

        // Chama o serviço que encapsula a lógica de cálculo e salvamento no Firestore
        const result = await submitExamAttempt(
            {
                uid: currentUser.uid,
                name: userData?.name || 'Aluno',
                nickname: (userData as any)?.nickname, 
                photoURL: currentUser.photoURL || undefined
            },
            exam,
            answers,
            classId
        );
        
        console.log("✅ Tentativa salva com sucesso:", result);
        
        // --- NIVELAMENTO AUTOMÁTICO ---
        if (exam.isLeveling && exam.levelingRanges) {
            const percent = (result.score / result.totalQuestions) * 100;
            let detectedLevel: 'beginner' | 'intermediate' | 'advanced' | 'insane' = 'beginner';
            
            if (percent > exam.levelingRanges.advanced) detectedLevel = 'insane';
            else if (percent > exam.levelingRanges.intermediate) detectedLevel = 'advanced';
            else if (percent > exam.levelingRanges.beginner) detectedLevel = 'intermediate';
            else detectedLevel = 'beginner';
            
            console.log(`[Leveling] Aluno identificado como: ${detectedLevel} (${percent.toFixed(2)}%)`);
            
            try {
                // Atualiza o studentLevel e o level dentro do profile
                await updateStudent(currentUser.uid, {
                    studentLevel: detectedLevel,
                    // Também atualizamos no objeto studyProfile para compatibilidade com o cronograma
                    studyProfile: {
                        ...(userData?.studyProfile || {}),
                        level: detectedLevel
                    } as any
                });
            } catch (pError) {
                console.error("Erro ao atualizar perfil do aluno:", pError);
            }
        }

        setShowFinishModal(false);

        // Pequeno delay para garantir UI update antes do alert/redirect
        setTimeout(() => {
             // Feedback visual ou sonoro opcional aqui
             onComplete(result); // Redireciona para o Ranking/Resultado
        }, 300);

    } catch (error: any) {
        console.error("🔥 Erro ao salvar tentativa:", error);
        alert(`Erro técnico ao salvar sua nota: ${error.message}`);
        setShowFinishModal(false); 
    } finally {
        setIsSubmitting(false);
    }
  };

  // Renderização via Portal para garantir sobreposição correta
  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-950 text-white font-sans animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex-none h-20 bg-zinc-900 border-b border-zinc-800 px-6 flex items-center justify-between shadow-2xl relative z-50">
          <button 
             onClick={() => {
                // Aqui podemos manter um confirm simples pois é saída destrutiva, 
                // ou implementar outro modal se desejar consistência total.
                if(Object.keys(answers).length === 0 || confirm("Deseja sair do simulado? Seu progresso será perdido.")) {
                    onClose();
                }
             }}
             className="flex items-center gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800 px-4 py-2 rounded-lg transition-all group"
          >
             <LogOut size={20} className="group-hover:text-red-500 transition-colors" />
             <span className="text-sm font-bold uppercase tracking-wider">Sair</span>
          </button>

          <div className="absolute left-1/2 transform -translate-x-1/2 text-center hidden md:block">
             <h2 className="text-lg font-black text-white uppercase tracking-tighter">{exam.title}</h2>
             <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Em Andamento</span>
          </div>

          <button 
              onClick={() => {
                  const pdfLink = exam.files?.bookletUrl;
                  if (pdfLink) window.open(pdfLink, '_blank');
                  else alert("Link do PDF não encontrado.");
              }}
              className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
              <FileText size={18} />
              Baixar Caderno
          </button>
      </div>

      {/* BODY: GRID DE QUESTÕES */}
      <div className="flex-1 overflow-y-auto p-6 bg-black/40 scrollbar-thin scrollbar-thumb-zinc-800">
          <div className="max-w-[1800px] mx-auto pb-10">
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {Array.from({ length: exam.questionCount }).map((_, i) => {
                      const qNum = i + 1;
                      const isAnswered = answers[qNum] !== undefined && answers[qNum] !== "";
                      const currentAnswer = answers[qNum];
                      const isError = missingQuestions.includes(qNum);
                      const discHeader = headers[qNum];

                      return (
                          <React.Fragment key={qNum}>
                            {discHeader && (
                                <div className="col-span-full mt-8 first:mt-2 mb-4 border-l-4 border-purple-600 bg-zinc-900/50 p-4 rounded-r-xl flex items-center justify-between shadow-[0_10px_20px_rgba(0,0,0,0.3)] border-y border-r border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
                                            <Layers size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">{discHeader.name}</h3>
                                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{discHeader.range}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${
                                isError 
                                    ? 'border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-pulse bg-red-900/10' 
                                    : isAnswered ? 'border-zinc-700 bg-zinc-900 shadow-lg' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                            }`}>
                                <div className="flex items-center justify-between w-full">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isError ? 'text-red-500' : isAnswered ? 'text-emerald-500' : 'text-zinc-600'}`}>
                                        Questão {qNum.toString().padStart(2, '0')}
                                    </span>
                                    {isError && <AlertTriangle size={12} className="text-red-500" />}
                                    {isAnswered && !isError && <CheckCircle2 size={12} className="text-emerald-500" />}
                                </div>
                                
                                <div className="flex gap-1.5 justify-center w-full">
                                    {exam.type === 'multiple_choice' ? (
                                        ['A','B','C','D', (exam.alternativesCount === 5 ? 'E' : null)].filter(Boolean).map((opt: any) => (
                                            <button
                                                key={opt}
                                                onClick={() => handleOptionSelect(qNum, opt)}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                                                    currentAnswer === opt 
                                                    ? 'bg-brand-red text-white shadow-lg shadow-red-900/50 scale-110' 
                                                    : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))
                                    ) : (
                                        ['C', 'E'].map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => handleOptionSelect(qNum, opt)}
                                                className={`w-10 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                                                    currentAnswer === opt 
                                                    ? (opt === 'C' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') + ' shadow-lg scale-110' 
                                                    : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                          </React.Fragment>
                      );
                  })}
               </div>
          </div>
      </div>

      {/* FOOTER */}
      <div className="flex-none h-24 bg-zinc-900 border-t border-zinc-800 px-8 flex items-center justify-between z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Respondidas: <b className="text-white text-lg mx-1">{Object.keys(answers).length}</b> / {exam.questionCount}
          </div>

          <button 
              onClick={handleFinish}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl hover:shadow-emerald-500/20 transition-all transform hover:-translate-y-1 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              {isSubmitting ? 'Calculando...' : 'Finalizar Simulado'}
          </button>
      </div>

      {/* MODAL: QUESTÕES EM BRANCO */}
      {showIncompleteModal && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-red-500/50 rounded-2xl p-8 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="bg-red-500/10 p-4 rounded-full mb-6 border border-red-500/20">
                        <AlertTriangle className="w-10 h-10 text-red-500" />
                    </div>
                    <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Simulado Incompleto</h3>
                    <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
                        Este simulado não possui penalidade, portanto é <strong>obrigatório</strong> responder todas as questões.
                        <br/><br/>
                        Você ainda precisa responder <span className="text-red-400 font-bold">{missingQuestions.length} questões</span>.
                    </p>
                    <button 
                        onClick={() => setShowIncompleteModal(false)}
                        className="bg-red-600 hover:bg-red-500 text-white w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-lg shadow-red-900/20"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* PASSO 3: MODAL DE CONFIRMAÇÃO DE ENVIO */}
      {showFinishModal && (
        <div className="fixed inset-0 z-[400] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="bg-emerald-500/10 p-4 rounded-full mb-6 border border-emerald-500/20">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Finalizar Simulado?</h3>
                    <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
                        Tem certeza que deseja enviar suas respostas? 
                        <br/>
                        Ao confirmar, sua nota será calculada automaticamente e você não poderá mais alterar as respostas.
                    </p>
                    
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setShowFinishModal(false)}
                            className="flex-1 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                        >
                            Revisar
                        </button>
                        <button 
                            onClick={handleConfirmSubmission}
                            disabled={isSubmitting}
                            className="flex-1 py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : <Check size={16} />}
                            {isSubmitting ? 'Enviando...' : 'Sim, Finalizar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>,
    document.body
  );
};

export default SimulatedExamRunner;
