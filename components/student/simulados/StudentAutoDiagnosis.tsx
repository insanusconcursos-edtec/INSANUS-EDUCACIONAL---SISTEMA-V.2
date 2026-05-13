import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { SimulatedExam } from '../../../services/simulatedService';
import { SimulatedAttempt } from '../../../services/simulatedAttemptService';

// --- CONFIGURAÇÃO DOS MOTIVOS ---
const REASONS = {
    CORRECT: [
        { id: 'DOMINIO', label: 'Domínio do Conteúdo', type: 'STRONG', action: 'MANTER', desc: 'Ponto Forte' },
        { id: 'CHUTE_CONSCIENTE', label: 'Chute Consciente (Dúvida)', type: 'REVIEW', action: 'REVISAR', desc: 'Revisar' },
        { id: 'CHUTE_SORTE', label: 'Chute na Sorte', type: 'WEAK', action: 'ESTUDAR', desc: 'Falha na Preparação' }
    ],
    WRONG: [
        { id: 'FALTA_CONTEUDO', label: 'Falta de Conteúdo (Não sabia)', type: 'WEAK', action: 'ESTUDAR', desc: 'Falha na Preparação' },
        { id: 'FALTA_ATENCAO', label: 'Falta de Atenção', type: 'REVIEW', action: 'REVISAR', desc: 'Atenção aos Detalhes' }
    ],
    BLANK: [
        { id: 'FALTA_CONTEUDO', label: 'Falta de Conteúdo (Medo de errar)', type: 'WEAK', action: 'ESTUDAR', desc: 'Falha na Preparação' },
        { id: 'INSEGURANCA', label: 'Insegurança (Dúvida)', type: 'REVIEW', action: 'REVISAR', desc: 'Revisar' }
    ]
};

// --- SUBCOMPONENTE 1: ACORDEÃO DA DISCIPLINA ---
const SubjectAccordion: React.FC<{ subject: string; data: any }> = ({ subject, data }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-[#1a1d24] rounded-xl border border-gray-800 overflow-hidden mb-3 shadow-lg hover:border-gray-600 transition-all">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-5 flex items-center justify-between bg-gray-900/50 hover:bg-gray-800 transition-colors"
            >
                <div className="flex items-center gap-4 overflow-hidden">
                    <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${isOpen ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-500'}`}>
                        <svg className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <div className="text-left overflow-hidden">
                        <h3 className="font-bold text-white text-lg uppercase tracking-wide truncate">{subject}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {data.strong > 0 && <span className="text-[9px] font-bold text-green-400 bg-green-900/20 px-2 py-0.5 rounded border border-green-900/40">+{data.strong} FORTES</span>}
                            {data.weak > 0 && <span className="text-[9px] font-bold text-red-400 bg-red-900/20 px-2 py-0.5 rounded border border-red-900/40">-{data.weak} FRACOS</span>}
                            {data.review > 0 && <span className="text-[9px] font-bold text-yellow-400 bg-yellow-900/20 px-2 py-0.5 rounded border border-yellow-900/40">! {data.review} FLASHCARD</span>}
                        </div>
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="p-4 border-t border-gray-800 space-y-3 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                    {data.weak > 0 && <ActionAccordion type="WEAK" count={data.weak} topics={data.topicsToStudy} title="AÇÃO: ESTUDAR DO ZERO" desc="Conteúdo não dominado ou chutes na sorte." />}
                    {data.review > 0 && <ActionAccordion type="REVIEW" count={data.review} topics={data.topicsToReview} title="AÇÃO: REVISAR / FLASHCARDS" desc="Dúvidas pontuais ou falta de atenção." />}
                    {data.strong > 0 && <ActionAccordion type="STRONG" count={data.strong} topics={data.topicsStrong} title="DOMÍNIO: MANTER CONSTÂNCIA" desc="Excelente desempenho. Mantenha com questões." />}
                </div>
            )}
        </div>
    );
};

// --- SUBCOMPONENTE 2: ACORDEÃO DO PLANO DE AÇÃO ---
const ActionAccordion: React.FC<{ type: 'WEAK' | 'REVIEW' | 'STRONG'; count: number; topics: string[]; title: string; desc: string }> = ({ type, count, topics, title, desc }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const styles = {
        WEAK: { border: 'border-red-500/20', bg: 'bg-red-900/5', text: 'text-red-400', icon: 'text-red-500' },
        REVIEW: { border: 'border-yellow-500/20', bg: 'bg-yellow-900/5', text: 'text-yellow-400', icon: 'text-yellow-500' },
        STRONG: { border: 'border-green-500/20', bg: 'bg-green-900/5', text: 'text-green-400', icon: 'text-green-500' }
    }[type];

    return (
        <div className={`rounded-lg border ${styles.border} ${styles.bg} overflow-hidden transition-all`}>
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left">
                <div className="flex-1">
                    <h4 className={`font-black text-xs uppercase flex items-center gap-2 ${styles.text}`}>
                        <svg className={`w-3 h-3 ${styles.icon}`} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
                        {title}
                    </h4>
                    <p className="text-gray-500 text-[10px] mt-1 ml-5 uppercase tracking-wide">{desc}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                    <span className={`text-[10px] font-bold ${styles.text} bg-black/30 px-2 py-1 rounded`}>{count} QUESTÕES</span>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
            </button>
            {isExpanded && (
                <div className="px-4 pb-4 pl-9 animate-in fade-in duration-200">
                    <div className="h-px w-full bg-white/5 mb-3"></div>
                    <p className="text-[10px] font-bold text-gray-600 uppercase mb-2">Assuntos Identificados:</p>
                    {topics && topics.length > 0 ? (
                        <ul className="grid grid-cols-1 gap-1.5">
                            {topics.map((topic, idx) => (
                                <li key={idx} className={`text-xs font-medium ${styles.text} flex items-start gap-2`}>
                                    <span className="opacity-50 mt-0.5">•</span> {topic}
                                </li>
                            ))}
                        </ul>
                    ) : <span className="text-xs text-gray-600 italic">Detalhes não disponíveis.</span>}
                </div>
            )}
        </div>
    );
};

// --- SUBCOMPONENTE 3: SELETOR CUSTOMIZADO ---
const CustomReasonSelect: React.FC<{
    options: any[];
    value: string;
    onChange: (val: string) => void;
}> = ({ options, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => opt.id === value);

    return (
        <div className="relative w-full">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                    value 
                        ? 'bg-red-500/10 border-red-500/40 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
                        : 'bg-[#0F1115] border-gray-800 text-gray-500 hover:border-gray-600 hover:bg-[#16191F]'
                }`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {value && <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] flex-shrink-0" />}
                    <span className={`text-sm whitespace-normal break-words ${value ? 'font-bold' : 'font-medium'}`}>
                        {selectedOption ? selectedOption.label : 'Qual o motivo desse resultado?'}
                    </span>
                </div>
                <svg 
                    className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-red-500' : 'text-gray-600'}`} 
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
                    <div className="absolute z-[110] w-full mt-2 bg-[#1A1D24] border border-gray-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-1.5 space-y-1">
                            {options.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        onChange(opt.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-sm rounded-lg transition-all ${
                                        value === opt.id 
                                            ? 'bg-red-500 text-white font-bold shadow-lg' 
                                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// --- SUBCOMPONENTE 4: PAINEL DE INSTRUÇÕES (STICKY) ---
const InstructionPanel: React.FC<{ hasPenalty: boolean }> = ({ hasPenalty }) => (
    <div className="w-full lg:w-1/3 sticky top-24 bg-[#1A1A1A] border border-gray-800 rounded-lg p-5 shadow-2xl">
        <h3 className="text-white font-bold text-lg mb-4 uppercase tracking-wider border-b border-gray-800 pb-2">Entenda os Motivos</h3>
        
        <div className="space-y-6">
            {/* Motivos de Acerto */}
            <div>
                <h4 className="text-green-500 font-bold text-[10px] uppercase mb-3 tracking-widest bg-green-500/10 px-2 py-1 rounded w-fit">Motivos de Acerto</h4>
                <div className="space-y-4">
                    <div>
                        <p className="text-green-400 text-[10px] font-black uppercase mb-1">DOMÍNIO DO CONTEÚDO</p>
                        <p className="text-gray-400 text-xs leading-relaxed">Marque essa opção se você acertou a questão porque de fato tem conhecimento do assunto e sabia com certeza a resposta.</p>
                    </div>
                    <div>
                        <p className="text-green-400 text-[10px] font-black uppercase mb-1">CHUTE CONSCIENTE</p>
                        <p className="text-gray-400 text-xs leading-relaxed">Marque essa opção se você acertou a questão, porém, ficou na dúvida (indeciso) entre uma e outra alternativa.</p>
                    </div>
                    <div>
                        <p className="text-green-400 text-[10px] font-black uppercase mb-1">CHUTE NA SORTE</p>
                        <p className="text-gray-400 text-xs leading-relaxed">Marque essa opção se você não fazia ideia do assunto, chutou, contou com a sorte e acertou.</p>
                    </div>
                </div>
            </div>

            {/* Motivos de Erro */}
            <div>
                <h4 className="text-red-500 font-bold text-[10px] uppercase mb-3 tracking-widest bg-red-500/10 px-2 py-1 rounded w-fit">Motivos de Erro</h4>
                <div className="space-y-4">
                    <div>
                        <p className="text-red-400 text-[10px] font-black uppercase mb-1">FALTA DE CONTEÚDO</p>
                        <p className="text-gray-400 text-xs leading-relaxed">Marque essa opção se você errou a questão porque não conhecia o assunto tratado, ou seja, não fazia ideia do que se tratava a questão.</p>
                    </div>
                    <div>
                        <p className="text-red-400 text-[10px] font-black uppercase mb-1">FALTA DE ATENÇÃO</p>
                        <p className="text-gray-400 text-xs leading-relaxed">Marque essa opção se você até possuía conhecimento do assunto, pois já estudou, porém, por algum singelo detalhe que passou despercebido, acabou errando a questão.</p>
                    </div>
                </div>
            </div>

            {/* Motivo de Questão em Branco (Condicional) */}
            {hasPenalty && (
                <div>
                    <h4 className="text-yellow-500 font-bold text-[10px] uppercase mb-3 tracking-widest bg-yellow-500/10 px-2 py-1 rounded w-fit">Motivo de Questão em Branco</h4>
                    <div className="space-y-4">
                        <div>
                            <p className="text-yellow-400 text-[10px] font-black uppercase mb-1">FALTA DE CONTEÚDO</p>
                            <p className="text-gray-400 text-xs leading-relaxed">Marque se tratava de um assunto do qual ainda não estudou e não possui domínio, e, para não ser penalizado ao errar, optou por deixar em branco.</p>
                        </div>
                        <div>
                            <p className="text-yellow-400 text-[10px] font-black uppercase mb-1">INSEGURANÇA</p>
                            <p className="text-gray-400 text-xs leading-relaxed">Marque se você até tem conhecimento do assunto, já estudou, porém, ficou inseguro (na dúvida) de responder e ser penalizado ao errar.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);

// --- COMPONENTE PRINCIPAL (MODO ABA) ---
export const StudentAutoDiagnosis: React.FC<{ exam: SimulatedExam, attempt: SimulatedAttempt }> = ({ exam, attempt }) => {
    const [step, setStep] = useState<'FORM' | 'REPORT'>('FORM');
    const [answersMap, setAnswersMap] = useState<Record<string, string>>({}); 
    const [loading, setLoading] = useState(false);

    // 1. MAPA DE DISCIPLINAS
    const disciplineMap = useMemo(() => {
        const map: Record<string, string> = {};
        // Use autodiagnosisDisciplines from schema or fallback to questions mapping
        const list = exam.autodiagnosisDisciplines || [];
        list.forEach((disc) => {
            if (disc.id) {
                map[disc.id] = disc.name;
            }
        });
        return map;
    }, [exam]);

    // 2. RECUPERAÇÃO DE RESPOSTAS
    useEffect(() => {
        const anyAttempt = attempt as any;
        if (anyAttempt.autodiagnosis) {
            let savedAnswers = anyAttempt.autodiagnosis.rawAnswers || anyAttempt.autodiagnosis;
            if (savedAnswers.analysis) savedAnswers = savedAnswers.rawAnswers || {}; 
            if (savedAnswers && typeof savedAnswers === 'object') {
                setAnswersMap(savedAnswers);
                setStep('REPORT');
            }
        }
    }, [attempt]);

    // 3. EXTRATOR DE DADOS
    const getQuestionMeta = (idx: number) => {
        const qData = exam.questions?.find(q => q.index === idx);

        if (qData) {
            let subjectName = null;
            if (qData.disciplineId && disciplineMap[qData.disciplineId]) {
                subjectName = disciplineMap[qData.disciplineId];
            } else {
                subjectName = "Disciplina não identificada";
            }

            const rawTopic = qData.topic || "";
            // Handle if topic is array (legacy) or string
            const topicName = Array.isArray(rawTopic) ? rawTopic.join(", ") : rawTopic;

            return { subject: subjectName || "Conteúdo Geral", topic: topicName };
        }
        return { subject: "Conteúdo Geral", topic: "" };
    };

    // 4. MOTOR DE CÁLCULO
    const calculatedReport = useMemo(() => {
        if (Object.keys(answersMap).length === 0) return null;
        const analysisBySubject: any = {};
        
        const getQuestionStatus = (qIndex: number) => {
            const userAns = attempt.userAnswers[qIndex] || attempt.userAnswers[String(qIndex)];
            const questionData = exam.questions?.find(q => q.index === qIndex);
            const correctAns = questionData?.answer;
            
            if (!userAns) return 'BLANK';
            return userAns === correctAns ? 'CORRECT' : 'WRONG';
        };

        for (let i = 1; i <= exam.questionCount; i++) {
            const reasonId = answersMap[i];
            if (!reasonId) continue;
            const { subject, topic } = getQuestionMeta(i);
            const displayTopic = topic && topic.trim() !== "" ? topic : `Questão ${i}`;
            if (!analysisBySubject[subject]) analysisBySubject[subject] = { strong: 0, weak: 0, review: 0, topicsToStudy: [], topicsToReview: [], topicsStrong: [] };
            
            const status = getQuestionStatus(i);
            let reasonDef;
            if (status === 'CORRECT') reasonDef = REASONS.CORRECT.find(r => r.id === reasonId);
            else if (status === 'WRONG') reasonDef = REASONS.WRONG.find(r => r.id === reasonId);
            else reasonDef = REASONS.BLANK.find(r => r.id === reasonId);

            if (reasonDef) {
                const pushUnique = (arr: any[], item: any) => { if (!arr.includes(item)) arr.push(item); };
                if (reasonDef.type === 'STRONG') { analysisBySubject[subject].strong++; pushUnique(analysisBySubject[subject].topicsStrong, displayTopic); }
                if (reasonDef.type === 'WEAK') { analysisBySubject[subject].weak++; pushUnique(analysisBySubject[subject].topicsToStudy, displayTopic); }
                if (reasonDef.type === 'REVIEW') { analysisBySubject[subject].review++; pushUnique(analysisBySubject[subject].topicsToReview, displayTopic); }
            }
        }
        return analysisBySubject;
    }, [answersMap, exam, disciplineMap, attempt]);

    const handleFinishDiagnosis = async () => {
        setLoading(true);
        try {
            const diagnosisPayload = { rawAnswers: answersMap, analysis: calculatedReport, completedAt: new Date().toISOString() };
            if (attempt.id) {
                const attemptRef = doc(db, 'simulated_attempts', attempt.id);
                await updateDoc(attemptRef, { autodiagnosis: diagnosisPayload });
                setStep('REPORT');
            } else {
                alert("Erro: ID da tentativa não encontrado.");
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao processar diagnóstico.");
        } finally {
            setLoading(false);
        }
    };

    // --- RENDERIZAÇÃO: MODO ABA (SEM MODAL) ---
    return (
        <div className="w-full animate-in fade-in duration-500">
            {/* TÍTULO E CABEÇALHO */}
            <div className="mb-6 p-6 rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-yellow-900/10 to-transparent flex flex-col items-center justify-center text-center w-full">
                <div className="flex flex-col items-center justify-center text-center w-full mb-2">
                    <span className="text-2xl mb-2">🧠</span>
                    <h2 
                        className="w-full whitespace-normal text-center font-black text-white uppercase tracking-wider text-lg md:text-3xl"
                        style={{ fontFamily: "'Orbitron', sans-serif" }}
                    >
                        <span className="block">AUTODIAGNÓSTICO</span>
                        <span className="block">DE PERFORMANCE</span>
                    </h2>
                </div>
                <p className="text-gray-400 text-sm max-w-2xl text-center">
                    {step === 'FORM' 
                        ? 'Identifique o motivo dos seus erros e acertos para gerar um plano de ação personalizado.' 
                        : 'Aqui está o seu mapeamento estratégico dividido por disciplina. Expanda os itens para ver os planos de ação.'}
                </p>
            </div>

            {/* CONTEÚDO: FORMULÁRIO */}
            {step === 'FORM' && (
                <div className="flex flex-col-reverse lg:flex-row gap-6 items-start">
                    {/* Coluna Esquerda: Questões (Flex-1) */}
                    <div className="flex-1 w-full flex flex-col gap-4">
                        <div className="bg-[#121418] rounded-2xl border border-gray-800 p-1">
                            <div className="p-4 bg-[#1a1d24] border-b border-gray-800 rounded-t-xl flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Preenchimento</span>
                                <span className="text-xl font-black text-white">
                                    {Math.round((Object.keys(answersMap).length / exam.questionCount) * 100)}%
                                </span>
                            </div>
                            <div className="max-h-[600px] overflow-y-auto p-6 pb-48 space-y-3 scrollbar-thin scrollbar-thumb-gray-700">
                                {Array.from({ length: exam.questionCount }).map((_, idx) => {
                                    const qNum = idx + 1;
                                    const status = (() => {
                                        const userAns = attempt.userAnswers[qNum] || attempt.userAnswers[String(qNum)];
                                        const questionData = exam.questions?.find(q => q.index === qNum);
                                        const correctAns = questionData?.answer;
                                        
                                        if (!userAns) return 'BLANK';
                                        return userAns === correctAns ? 'CORRECT' : 'WRONG';
                                    })();
                                    const currentReason = answersMap[qNum];
                                    const { subject, topic } = getQuestionMeta(qNum);
                                    let theme = { color: 'gray', label: 'BRANCO', options: REASONS.BLANK };
                                    if (status === 'CORRECT') theme = { color: 'green', label: 'ACERTO', options: REASONS.CORRECT };
                                    else if (status === 'WRONG') theme = { color: 'red', label: 'ERRO', options: REASONS.WRONG };

                                    return (
                                        <div key={qNum} className={`flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-gray-800 bg-[#1A1D24]/50 ${currentReason ? 'opacity-60' : 'opacity-100'} transition-all hover:opacity-100 hover:border-gray-700 group`}>
                                            <div className="flex flex-col items-center md:justify-center gap-1 md:min-w-[180px] md:border-r border-gray-800 md:pr-4 w-full md:w-auto">
                                                {/* Tag de Status no Topo */}
                                                <div className="flex w-full justify-center mb-3 md:mb-2">
                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase bg-${theme.color}-500/10 text-${theme.color}-500 border border-${theme.color}-500/20 whitespace-normal text-center`}>
                                                        {theme.label}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex flex-col items-center text-center w-full">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Questão {qNum}</span>
                                                    <span className="text-[11px] text-yellow-500/90 font-bold uppercase whitespace-normal break-words w-full">{subject}</span>
                                                    <span className="text-[10px] text-gray-400 font-medium whitespace-normal break-words w-full leading-tight">{topic || "-"}</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 flex items-center w-full">
                                                <CustomReasonSelect 
                                                    options={theme.options} 
                                                    value={currentReason} 
                                                    onChange={(val) => setAnswersMap(prev => ({...prev, [qNum]: val}))}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button 
                                onClick={handleFinishDiagnosis} 
                                disabled={Object.keys(answersMap).length < exam.questionCount} 
                                className={`px-8 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center gap-3 shadow-xl ${Object.keys(answersMap).length < exam.questionCount ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-400 text-black transform hover:scale-105'}`}
                            >
                                {loading ? 'PROCESSANDO...' : 'GERAR RELATÓRIO DE INTELIGÊNCIA'}
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Coluna Direita: Painel Fixo de Instruções */}
                    <InstructionPanel hasPenalty={exam.hasPenalty} />
                </div>
            )}

            {/* CONTEÚDO: RELATÓRIO EM LISTA */}
            {step === 'REPORT' && calculatedReport && (
                <div className="space-y-4 max-w-5xl mx-auto">
                    {Object.entries(calculatedReport).map(([subject, data]: [string, any]) => (
                        <SubjectAccordion key={subject} subject={subject} data={data} />
                    ))}
                    <div className="pt-8 text-center">
                        <button onClick={() => setStep('FORM')} className="text-xs text-gray-500 hover:text-white underline decoration-gray-700 underline-offset-4">
                            Refazer Autodiagnóstico
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
