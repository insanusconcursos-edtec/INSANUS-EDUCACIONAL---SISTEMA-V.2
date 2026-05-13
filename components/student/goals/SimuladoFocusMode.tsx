import React, { useState, useEffect } from 'react';

interface SimuladoFocusModeProps {
    simulado: {
        id: string; 
        title: string;
        duration: number; // em minutos
        pdfUrl?: string; // Garantido pelo StudentDashboard
    };
    onClose: () => void;
    onComplete: () => void;
}

export const SimuladoFocusMode = ({ simulado, onClose, onComplete }: SimuladoFocusModeProps) => {
    const [timeLeft, setTimeLeft] = useState(simulado.duration * 60);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // NOVO: Estado para controlar o PopUp customizado de conclusão
    const [showFinishConfirmation, setShowFinishConfirmation] = useState(false);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleAutoFinish(); 
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        document.body.style.overflow = 'hidden';
        return () => {
            clearInterval(timer);
            document.body.style.overflow = 'auto';
        };
    }, []);

    const handleAutoFinish = async () => {
        alert("TEMPO ESGOTADO! Sua prova foi concluída automaticamente.");
        await finishExam();
    };

    // CORREÇÃO: Em vez de window.confirm, abre o nosso PopUp
    const handleManualFinish = () => {
        setShowFinishConfirmation(true);
    };

    // CORREÇÃO: Função chamada pelo botão "Sim, Entregar" do PopUp
    const confirmFinish = async () => {
        setShowFinishConfirmation(false);
        await finishExam();
    };

    const finishExam = async () => {
        setIsSubmitting(true);
        try {
            onComplete(); 
        } catch (error) {
            console.error("Erro ao finalizar:", error);
        } finally {
            setIsSubmitting(false);
            onClose(); // Fecha o modo foco
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0f1115] flex flex-col items-center justify-center animate-in fade-in duration-300">
            
            {/* HEADER COM BOTÃO DO PDF VISÍVEL */}
            <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-black/80 backdrop-blur-md border-b border-gray-800">
                <div className="flex items-center gap-4">
                    <div className="w-3 h-3 bg-[var(--plan-theme)] rounded-full animate-pulse shadow-[0_0_10px_var(--plan-theme)]"></div>
                    <h2 className="text-white font-bold text-sm md:text-lg uppercase tracking-wider">MODO PROVA - SEM PAUSA</h2>
                </div>
                
                {/* BOTÃO DO CADERNO */}
                <div className="flex flex-wrap justify-center items-center gap-4">
                    {simulado.pdfUrl && (
                        <button 
                            onClick={() => window.open(simulado.pdfUrl, '_blank')}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded border border-gray-600 flex items-center gap-2 transition-colors shadow-lg"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            ABRIR CADERNO DE PROVA
                        </button>
                    )}
                    <div className="text-gray-500 text-xs font-mono border-l border-gray-700 pl-4 hidden md:block">
                        ID: {simulado.id?.slice(0,8) || "N/A"}
                    </div>
                </div>
            </div>

            {/* CRONÔMETRO */}
            <div className="text-center space-y-4 pt-16">
                <h1 className={`text-[15vw] md:text-[8rem] leading-none font-black font-mono tabular-nums tracking-tighter
                    ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-white'}
                `}>
                    {formatTime(timeLeft)}
                </h1>
                <p className="text-gray-400 text-sm uppercase tracking-[0.2em]">Tempo Restante</p>
            </div>

            {/* AVISOS DE SEGURANÇA */}
            <div className="mt-8 md:mt-12 flex flex-col md:flex-row gap-4 md:gap-8 text-center px-4">
                <div className="flex items-center justify-center gap-3 text-yellow-500/50">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span className="text-xs uppercase font-bold">Não feche esta janela</span>
                </div>
                <div className="flex items-center justify-center gap-3 text-yellow-500/50">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    <span className="text-xs uppercase font-bold">Pausa Desabilitada</span>
                </div>
            </div>

            {/* AÇÃO PRINCIPAL */}
            <div className="absolute bottom-6 md:bottom-10 left-0 right-0 flex justify-center px-4">
                <button 
                    onClick={handleManualFinish}
                    disabled={isSubmitting}
                    className="w-full max-w-md px-12 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xl rounded-xl uppercase tracking-widest transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(234,179,8,0.3)]"
                >
                    {isSubmitting ? 'ENVIANDO...' : 'CONCLUIR PROVA'}
                </button>
            </div>

            {/* POPUP CUSTOMIZADO DE CONFIRMAÇÃO (O FIX DO DIAGNÓSTICO) */}
            {showFinishConfirmation && (
                <div className="fixed inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#1a1d24] p-6 md:p-8 rounded-2xl w-full max-w-md border border-yellow-600/30 shadow-[0_0_50px_rgba(234,179,8,0.15)] text-center">
                        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-500 border border-yellow-500/20">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h3 className="text-white font-black text-2xl uppercase mb-2">Entregar Prova?</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-8">
                            Você tem certeza que deseja finalizar a prova agora? 
                            O cronômetro será encerrado e essa ação <strong>não poderá ser desfeita</strong>.
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={confirmFinish}
                                className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm rounded-xl uppercase tracking-wider transition-all shadow-lg"
                            >
                                Sim, Entregar Prova
                            </button>
                            <button 
                                onClick={() => setShowFinishConfirmation(false)}
                                className="w-full py-3 bg-transparent border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white font-bold text-sm rounded-xl uppercase tracking-wider transition-all"
                            >
                                Cancelar e Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};