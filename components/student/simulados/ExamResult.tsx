
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  BarChart2, ArrowLeft, Trophy, Search, ChevronDown, Brain, ListChecks, Check, X, Minus, Medal, AlertCircle, FileText, SwitchCamera, BarChart
} from 'lucide-react';
import { 
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList
} from 'recharts';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { SimulatedExam } from '../../../services/simulatedService';
import { SimulatedAttempt } from '../../../services/simulatedAttemptService';
import { StudentAutoDiagnosis } from './StudentAutoDiagnosis';
import { updateStudent } from '../../../services/userService';

// Helper Component para Linha do Ranking
const RankingRow: React.FC<{ rank: SimulatedAttempt & { originalRank: number }, currentUserId?: string }> = ({ rank, currentUserId }) => {
    const isCurrentUser = rank.userId === currentUserId;
    return (
        <tr className={`transition-colors hover:bg-zinc-800/30 ${isCurrentUser ? 'bg-zinc-800/50 border-l-2 border-l-brand-red' : ''}`}>
            <td className="p-4 text-center font-mono text-zinc-400 font-bold text-sm">
                {/* Ícones de Pódio para Top 3 Global */}
                {rank.originalRank === 1 ? <Medal size={20} className="text-yellow-500 mx-auto" /> : 
                 rank.originalRank === 2 ? <Medal size={20} className="text-zinc-400 mx-auto" /> : 
                 rank.originalRank === 3 ? <Medal size={20} className="text-amber-700 mx-auto" /> : 
                 `${rank.originalRank}º`}
            </td>
            <td className="p-4">
                <div className="flex items-center gap-3">
                    {/* Avatar ou Inicial */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border border-zinc-700 overflow-hidden ${isCurrentUser ? 'bg-brand-red text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                        {rank.userPhoto ? (
                            <img src={rank.userPhoto} alt={rank.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            rank.userName ? rank.userName[0].toUpperCase() : 'A'
                        )}
                    </div>
                    <div>
                        <span className={`block font-bold uppercase ${isCurrentUser ? 'text-white' : 'text-zinc-300'}`}>
                            {rank.userName} {isCurrentUser && '(Você)'}
                        </span>
                        {rank.completedAt && (
                            <span className="text-[9px] text-zinc-500 font-mono">
                                {new Date(rank.completedAt?.seconds * 1000).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            </td>
            <td className="p-4 text-center text-emerald-500 font-bold">{rank.correctCount}</td>
            <td className="p-4 text-center text-red-500 font-bold">{rank.wrongCount}</td>
            <td className="p-4 text-center">
                <span className={`text-sm font-black ${rank.isApproved ? 'text-emerald-400' : 'text-red-400'}`}>
                    {rank.score.toFixed(1)}
                </span>
            </td>
        </tr>
    );
};

interface ExamResultProps {
    exam: SimulatedExam;
    attemptData: SimulatedAttempt;
    onBack: () => void;
}

export const ExamResult: React.FC<ExamResultProps> = ({ exam, attemptData, onBack }) => {
    const { currentUser, userData } = useAuth();
    
    // Sincronização de Nível (se for simulado de nivelamento)
    useEffect(() => {
        if (currentUser && exam.isLeveling && exam.levelingRanges) {
            const percent = (attemptData.score / attemptData.totalQuestions) * 100;
            let identifiedLevel: 'beginner' | 'intermediate' | 'advanced' | 'insane' = 'beginner';
            
            if (percent > exam.levelingRanges.advanced) identifiedLevel = 'insane';
            else if (percent > exam.levelingRanges.intermediate) identifiedLevel = 'advanced';
            else if (percent > exam.levelingRanges.beginner) identifiedLevel = 'intermediate';

            const currentLevel = (userData as any)?.studentLevel;
            if (currentLevel !== identifiedLevel) {
                console.log(`[ExamResult] Atualizando nível para: ${identifiedLevel}`);
                updateStudent(currentUser.uid, {
                    studentLevel: identifiedLevel,
                    studyProfile: {
                        ...(userData?.studyProfile || {}),
                        level: identifiedLevel
                    } as any
                }).catch(err => console.error("Erro ao atualizar nível:", err));
            }
        }
    }, [currentUser, userData, exam, attemptData]);
    
    // Estado para controlar as Abas
    const [activeTab, setActiveTab] = useState<'PERFORMANCE' | 'RANKING' | 'AUTODIAGNOSIS'>('PERFORMANCE'); 
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);    
    const [chartMode, setChartMode] = useState<'quantity' | 'percentage' | 'autodiagnosis'>('quantity');

    // Estilização dinâmica para o Selo de Nivelamento
    const levelStyle = useMemo(() => {
        if (!exam.levelingRanges) return null;
        const percent = (attemptData.score / attemptData.totalQuestions) * 100;
        
        if (percent > exam.levelingRanges.advanced) return {
            label: 'Insano',
            color: 'text-[#FF0000]',
            border: 'border-[#FF0000]/30',
            bg: 'bg-[#FF0000]/5',
            glow: 'shadow-[0_0_30px_rgba(255,0,0,0.2)]',
            textGlow: 'drop-shadow-[0_0_20px_rgba(255,0,0,0.5)]',
            iconBg: 'bg-[#FF0000]/20'
        };
        if (percent > exam.levelingRanges.intermediate) return {
            label: 'Avançado',
            color: 'text-[#FFD700]',
            border: 'border-[#FFD700]/30',
            bg: 'bg-[#FFD700]/5',
            glow: 'shadow-[0_0_30px_rgba(255,215,0,0.15)]',
            textGlow: 'drop-shadow-[0_0_20px_rgba(255,215,0,0.4)]',
            iconBg: 'bg-[#FFD700]/20'
        };
        if (percent > exam.levelingRanges.beginner) return {
            label: 'Intermediário',
            color: 'text-[#50C878]',
            border: 'border-[#50C878]/30',
            bg: 'bg-[#50C878]/5',
            glow: 'shadow-[0_0_30px_rgba(80,200,120,0.15)]',
            textGlow: 'drop-shadow-[0_0_20px_rgba(80,200,120,0.3)]',
            iconBg: 'bg-[#50C878]/20'
        };
        return {
            label: 'Iniciante',
            color: 'text-[#00FFFF]',
            border: 'border-[#00FFFF]/30',
            bg: 'bg-[#00FFFF]/5',
            glow: 'shadow-[0_0_30px_rgba(0,255,255,0.15)]',
            textGlow: 'drop-shadow-[0_0_20px_rgba(0,255,255,0.3)]',
            iconBg: 'bg-[#00FFFF]/20'
        };
    }, [exam.levelingRanges, attemptData.score, attemptData.totalQuestions]);

    // Cálculo do Desempenho por Disciplina
    const disciplineStats = useMemo(() => {
        if (!exam.hasBlocks || !exam.blocks) return [];
        
        let currentStart = 1;
        const stats: any[] = [];
        const autodiagnosisData = (attemptData as any).autodiagnosis?.analysis || {};
        
        exam.blocks.forEach(block => {
            (block.disciplines || []).forEach(disc => {
                const start = currentStart;
                const end = currentStart + (Number(disc.questionCount) || 0) - 1;
                
                let hits = 0;
                let misses = 0;
                let blank = 0;

                // Autodiagnosis category counts
                let dominio = 0;      // Verde (Domínio Real)
                let revisao = 0;      // Amarelo (Revisão Necessária)
                let lacuna = 0;       // Vermelho (Lacuna de Conhecimento)
                
                for (let i = start; i <= end; i++) {
                    const userAns = attemptData.userAnswers[i] || attemptData.userAnswers[String(i)];
                    const questionData = exam.questions?.find(q => q.index === i);
                    const correctAns = questionData?.answer;
                    const isAnnulled = questionData?.isAnnulled;
                    
                    const reason = (attemptData as any).autodiagnosis?.rawAnswers?.[i] || (attemptData as any).autodiagnosis?.rawAnswers?.[String(i)];
                    const isCorrect = isAnnulled || (userAns === correctAns);

                    if (isAnnulled) {
                        hits++;
                        dominio++; // Anuladas contam como domínio real por padrão
                        continue;
                    }
                    
                    if (!userAns) {
                        blank++;
                        // Blank + Insegurança = Amarelo
                        if (reason === 'INSEGURANCA') revisao++;
                        // Blank + Falta de conteúdo = Vermelho
                        else if (reason === 'FALTA_CONTEUDO') lacuna++;
                        else lacuna++; // Default for blank if no reason
                    } else if (isCorrect) {
                        hits++;
                        // Correct + Domínio = Verde
                        if (reason === 'DOMINIO') dominio++;
                        // Correct + Chute Consciente = Amarelo
                        else if (reason === 'CHUTE_CONSCIENTE') revisao++;
                        // Correct + Chute Sorte = Vermelho
                        else if (reason === 'CHUTE_SORTE') lacuna++;
                        else dominio++; // Default for correct if no reason
                    } else {
                        misses++;
                        // Wrong + Falta Atenção = Amarelo
                        if (reason === 'FALTA_ATENCAO') revisao++;
                        // Wrong + Falta Conteúdo = Vermelho
                        else if (reason === 'FALTA_CONTEUDO') lacuna++;
                        else lacuna++; // Default for wrong if no reason
                    }
                }
                
                const total = Number(disc.questionCount) || (hits + misses + blank);
                const rate = total > 0 ? (hits / total) * 100 : 0;
                
                stats.push({
                    name: disc.name,
                    hits,
                    misses,
                    blank,
                    realMastery: dominio,
                    revisao: revisao,
                    knowledgeGap: lacuna,
                    total,
                    rate: Number(rate.toFixed(1))
                });
                
                currentStart = end + 1;
            });
        });
        
        return stats;
    }, [exam, attemptData]);

    const sortedStats = useMemo(() => {
        const stats = [...disciplineStats];
        if (chartMode === 'percentage') {
            return stats.sort((a, b) => b.rate - a.rate);
        }
        return stats;
    }, [disciplineStats, chartMode]);

    // Estados do Ranking
    const [rankingData, setRankingData] = useState<SimulatedAttempt[]>([]);
    const [loadingRanking, setLoadingRanking] = useState(false);
    
    // Estado de Busca no Ranking
    const [rankingSearch, setRankingSearch] = useState('');

    // Função para buscar o Ranking (só executa se o usuário clicar na aba)
    useEffect(() => {
        if (activeTab === 'RANKING' && rankingData.length === 0 && exam.id) {
            const fetchRanking = async () => {
                setLoadingRanking(true);
                try {
                    // Busca todas as tentativas deste simulado
                    // Ordena por SCORE (Decrescente) -> Maior nota primeiro
                    const q = query(
                        collection(db, 'simulated_attempts'),
                        where('simulatedId', '==', exam.id),
                        orderBy('score', 'desc'),
                        orderBy('completedAt', 'asc'), // Desempate: quem fez primeiro
                        limit(100) // Limite de segurança
                    );
                    
                    const snapshot = await getDocs(q);
                    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimulatedAttempt));
                    setRankingData(results);
                } catch (error) {
                    console.error("Erro ao carregar ranking:", error);
                } finally {
                    setLoadingRanking(false);
                }
            };
            fetchRanking();
        }
    }, [activeTab, exam.id, rankingData.length]);

    // Lógica de Filtro + Separação Aprovados/Reprovados
    const { approvedList, reprovedList } = useMemo(() => {
        // 1. Calcula Rank Global e Filtra por Busca
        const processedList = rankingData
            .map((item, index) => ({ ...item, originalRank: index + 1 })) // 1º Passo: Fixar a posição real global
            .filter(item => 
                item.userName?.toLowerCase().includes(rankingSearch.toLowerCase()) // 2º Passo: Filtrar pelo nome
            );

        // 2. Separa as listas
        return {
            approvedList: processedList.filter(i => i.isApproved),
            reprovedList: processedList.filter(i => !i.isApproved)
        };
    }, [rankingData, rankingSearch]);

    return createPortal(
        <div className="fixed inset-0 z-[100000] w-screen h-screen bg-[#0a0a0a] flex flex-col animate-in fade-in slide-in-from-right-8 duration-500 overflow-hidden">
            
            {/* CABEÇALHO DO RESULTADO */}
            <div className="flex-none p-4 md:p-8 border-b border-zinc-800 bg-zinc-900/50 pt-8 md:pt-10">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">{exam.title}</h2>
                        <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Painel de Performance Final</span>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        {exam.files?.bookletUrl && (
                            <button 
                                onClick={() => window.open(exam.files.bookletUrl, '_blank')}
                                className="hidden lg:flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5"
                            >
                                <FileText size={16} />
                                Baixar Caderno
                            </button>
                        )}
                        <button 
                            onClick={onBack} 
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center gap-2 transition-all px-4 py-3 rounded-xl border border-zinc-700 font-black text-[10px] uppercase tracking-widest shadow-lg"
                        >
                            <ArrowLeft size={16} />
                            <span>VOLTAR</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* BARRA DE NAVEGAÇÃO DE ABAS */}
            <div className="flex-none bg-zinc-900/30 border-b border-zinc-800">
                <div className="max-w-7xl mx-auto px-6">
                    {/* NAVEGAÇÃO EM ABAS (TABS) - DESKTOP */}
                    <div className="hidden md:flex items-center gap-8 overflow-x-auto">
                        {/* Aba 1: Desempenho */}
                        <button
                            onClick={() => setActiveTab('PERFORMANCE')}
                            className={`py-4 px-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'PERFORMANCE' ? 'border-red-600 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            Meu Desempenho
                        </button>

                        {/* Aba 2: Autodiagnóstico (NOVO) */}
                        {exam.isAutoDiagnosisEnabled && (
                            <button
                                onClick={() => setActiveTab('AUTODIAGNOSIS')}
                                className={`py-4 px-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${activeTab === 'AUTODIAGNOSIS' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                <Brain className="w-4 h-4" />
                                Autodiagnóstico
                            </button>
                        )}

                        {/* Aba 3: Ranking */}
                        <button
                            onClick={() => setActiveTab('RANKING')}
                            className={`py-4 px-2 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'RANKING' ? 'border-red-600 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            Ranking Geral
                        </button>
                    </div>

                    {/* NAVEGAÇÃO EM ABAS (DROPDOWN) - MOBILE */}
                    <div className="flex md:hidden py-4">
                        <div className="relative w-full">
                            <button 
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="flex items-center justify-between w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-[10px] font-black uppercase tracking-widest"
                            >
                                <div className="flex items-center gap-3">
                                    {activeTab === 'PERFORMANCE' && <BarChart2 size={16} className="text-red-500" />}
                                    {activeTab === 'AUTODIAGNOSIS' && <Brain size={16} className="text-yellow-500" />}
                                    {activeTab === 'RANKING' && <Trophy size={16} className="text-emerald-500" />}
                                    <span>
                                        {activeTab === 'PERFORMANCE' ? 'Meu Desempenho' : 
                                         activeTab === 'AUTODIAGNOSIS' ? 'Autodiagnóstico' : 'Ranking Geral'}
                                    </span>
                                </div>
                                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A1A] border border-zinc-800 rounded-xl shadow-2xl z-[210] overflow-hidden">
                                    <button 
                                        onClick={() => { setActiveTab('PERFORMANCE'); setIsDropdownOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-colors border-b border-zinc-800/50 ${activeTab === 'PERFORMANCE' ? 'text-red-500 bg-red-500/5' : 'text-zinc-500 hover:bg-zinc-800'}`}
                                    >
                                        <BarChart2 size={16} />
                                        Meu Desempenho
                                    </button>
                                    {exam.isAutoDiagnosisEnabled && (
                                        <button 
                                            onClick={() => { setActiveTab('AUTODIAGNOSIS'); setIsDropdownOpen(false); }}
                                            className={`w-full flex items-center gap-3 px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-colors border-b border-zinc-800/50 ${activeTab === 'AUTODIAGNOSIS' ? 'text-yellow-500 bg-yellow-500/5' : 'text-zinc-500 hover:bg-zinc-800'}`}
                                        >
                                            <Brain size={16} />
                                            Autodiagnóstico
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => { setActiveTab('RANKING'); setIsDropdownOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'RANKING' ? 'text-emerald-500 bg-emerald-500/5' : 'text-zinc-500 hover:bg-zinc-800'}`}
                                    >
                                        <Trophy size={16} />
                                        Ranking Geral
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTEÚDO DAS ABAS */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-10 md:pt-20">
                <div className="max-w-7xl mx-auto">
                    
                    {/* --- ABA 1: DESEMPENHO (Cards + Gabarito) --- */}
                    {activeTab === 'PERFORMANCE' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            
                            {/* SELO DE NIVELAMENTO (Se for simulado de nivelamento) */}
                            {exam.isLeveling && levelStyle && (
                                <div className={`bg-black/40 border ${levelStyle.border} p-8 rounded-3xl flex flex-col items-center text-center animate-in zoom-in-95 duration-700`}>
                                    <div className={`w-16 h-16 ${levelStyle.iconBg} rounded-2xl flex items-center justify-center ${levelStyle.color} mb-4 ${levelStyle.glow}`}>
                                        <Trophy size={32} />
                                    </div>
                                    <h4 className="text-zinc-500 text-[11px] font-black uppercase tracking-[0.3em] mb-2">Nível de Preparação Identificado</h4>
                                    <p className={`text-6xl font-black uppercase tracking-tighter ${levelStyle.color} ${levelStyle.textGlow}`}>
                                        {levelStyle.label}
                                    </p>
                                    <div className="mt-6 flex flex-col items-center gap-2">
                                        <div className="h-1.5 w-64 bg-zinc-800 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-1000`} 
                                                style={{ 
                                                    width: `${(attemptData.score / attemptData.totalQuestions) * 100}%`,
                                                    backgroundColor: levelStyle.color.match(/\[(.*?)\]/)?.[1] || '#DC2626',
                                                    boxShadow: `0 0 10px ${levelStyle.color.match(/\[(.*?)\]/)?.[1] || '#DC2626'}`
                                                }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                            Aproveitamento de {((attemptData.score / attemptData.totalQuestions) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 font-medium mt-6 max-w-lg leading-relaxed">
                                        Seu perfil de estudos foi recalibrado. Este nível define a velocidade de liberação dos seus materiais e a complexidade das metas diárias.
                                    </p>
                                </div>
                            )}

                            {/* CARDS DE PLACAR */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Nota Final */}
                                <div className={`p-6 rounded-xl border flex flex-col items-center justify-center relative overflow-hidden ${attemptData.isApproved ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-red-500/30 bg-red-900/10'}`}>
                                    <span className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest">Nota Final</span>
                                    <span className="text-5xl font-black text-white tracking-tighter">{attemptData.score}</span>
                                    <div className={`mt-2 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${attemptData.isApproved ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                                        {attemptData.isApproved ? 'APROVADO' : 'REPROVADO'}
                                    </div>
                                </div>

                                {/* Estatísticas Rápidas */}
                                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-emerald-500">{attemptData.correctCount}</span>
                                    <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Acertos</span>
                                </div>
                                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-red-500">{attemptData.wrongCount}</span>
                                    <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Erros</span>
                                </div>
                                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-zinc-400">{attemptData.blankCount}</span>
                                    <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Em Branco</span>
                                </div>
                            </div>

                            {/* GRÁFICO DE DESEMPENHO POR DISCIPLINA */}
                            {disciplineStats.length > 0 && (
                                <div className="bg-zinc-900/40 rounded-3xl border border-zinc-800/60 p-6 md:p-8 animate-in slide-in-from-bottom-4 duration-700">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                        <div>
                                            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                                <BarChart className="text-brand-red w-6 h-6" />
                                                Performance por Disciplina
                                            </h3>
                                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                                                Análise detalhada do seu aproveitamento por matéria
                                            </p>
                                        </div>

                                        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit self-end md:self-auto">
                                            <button 
                                                onClick={() => setChartMode('quantity')}
                                                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${chartMode === 'quantity' ? 'bg-zinc-800 text-white shadow-lg shadow-black/50' : 'text-zinc-600 hover:text-zinc-400'}`}
                                            >
                                                Quantidade
                                            </button>
                                            <button 
                                                onClick={() => setChartMode('percentage')}
                                                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${chartMode === 'percentage' ? 'bg-zinc-800 text-white shadow-lg shadow-black/50' : 'text-zinc-600 hover:text-zinc-400'}`}
                                            >
                                                Porcentagem
                                            </button>
                                            {(attemptData as any).autodiagnosis?.analysis && (
                                                <button 
                                                    onClick={() => setChartMode('autodiagnosis')}
                                                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${chartMode === 'autodiagnosis' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-zinc-600 hover:text-zinc-400'}`}
                                                >
                                                    Autodiagnóstico
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="h-[400px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ReBarChart
                                                data={sortedStats}
                                                layout="vertical"
                                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                                                <XAxis 
                                                    type="number" 
                                                    hide 
                                                    domain={chartMode === 'percentage' ? [0, 100] : [0, 'dataMax']} 
                                                />
                                                <YAxis 
                                                    dataKey="name" 
                                                    type="category" 
                                                    width={150} 
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold' }}
                                                />
                                                <Tooltip 
                                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const data = payload[0].payload;
                                                            return (
                                                                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl shadow-2xl">
                                                                    <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2 pb-1 border-b border-zinc-900">{data.name}</p>
                                                                    <div className="space-y-1">
                                                                        {chartMode === 'autodiagnosis' ? (
                                                                            <>
                                                                                <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                                    <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" /> Domínio Real:</span>
                                                                                    <span className="text-emerald-500">{data.realMastery}</span>
                                                                                </div>
                                                                                <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                                    <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#FFFF00] block" /> Revisar:</span>
                                                                                    <span className="text-yellow-500">{data.revisao}</span>
                                                                                </div>
                                                                                <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                                    <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500 block" /> Lacuna Conhec.:</span>
                                                                                    <span className="text-red-500">{data.knowledgeGap}</span>
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                                    <span>Acertos:</span>
                                                                                    <span className="text-emerald-500">{data.hits}</span>
                                                                                </div>
                                                                                <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                                    <span>Erros:</span>
                                                                                    <span className="text-red-500">{data.misses}</span>
                                                                                </div>
                                                                                <div className="text-[10px] font-bold text-zinc-400 flex items-center justify-between gap-4 uppercase">
                                                                                    <span>Branco:</span>
                                                                                    <span className="text-zinc-600">{data.blank}</span>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                        <div className="pt-1 mt-1 border-t border-zinc-900">
                                                                            <div className="text-[10px] font-black text-white flex items-center justify-between uppercase">
                                                                                <span>Aproveitamento:</span>
                                                                                <span className="text-brand-red">{data.rate}%</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                {chartMode === 'quantity' ? (
                                                    <>
                                                        <Bar 
                                                            dataKey="hits" 
                                                            stackId="a" 
                                                            fill="#10b981" 
                                                            radius={[0, 0, 0, 0]} 
                                                            barSize={20}
                                                        />
                                                        <Bar 
                                                            dataKey="misses" 
                                                            stackId="a" 
                                                            fill="#ef4444" 
                                                            radius={[0, 4, 4, 0]} 
                                                            barSize={20}
                                                        />
                                                    </>
                                                ) : chartMode === 'percentage' ? (
                                                    <Bar 
                                                        dataKey="rate" 
                                                        radius={[0, 4, 4, 0]} 
                                                        barSize={20}
                                                    >
                                                        {sortedStats.map((entry, index) => (
                                                            <Cell 
                                                                key={`cell-${index}`} 
                                                                fill={entry.rate >= 70 ? '#10b981' : entry.rate >= 50 ? '#eab308' : '#ef4444'} 
                                                            />
                                                        ))}
                                                        <LabelList 
                                                            dataKey="rate" 
                                                            position="right" 
                                                            style={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 'bold' }} 
                                                            formatter={(v: number) => `${v}%`} 
                                                        />
                                                    </Bar>
                                                ) : (
                                                    <>
                                                        <Bar 
                                                            dataKey="realMastery" 
                                                            stackId="a" 
                                                            fill="#10b981" 
                                                            radius={[0, 0, 0, 0]} 
                                                            barSize={20}
                                                            name="Domínio Real"
                                                        />
                                                        <Bar 
                                                            dataKey="revisao" 
                                                            stackId="a" 
                                                            fill="#FFFF00" 
                                                            radius={[0, 0, 0, 0]} 
                                                            barSize={20}
                                                            name="Revisar"
                                                        />
                                                        <Bar 
                                                            dataKey="knowledgeGap" 
                                                            stackId="a" 
                                                            fill="#ef4444" 
                                                            radius={[0, 4, 4, 0]} 
                                                            barSize={20}
                                                            name="Lacuna de Conhecimento"
                                                        />
                                                    </>
                                                )}
                                            </ReBarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    
                                    {chartMode === 'quantity' && (
                                        <div className="flex items-center justify-center gap-6 mt-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Acertos</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Erros</span>
                                            </div>
                                        </div>
                                    )}

                                    {chartMode === 'autodiagnosis' && (
                                        <div className="flex flex-wrap items-center justify-center gap-6 mt-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Domínio Real</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Revisão Nec.</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Lacuna de Conteúdo</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* --- SEÇÃO DE MATERIAIS DA PROVA (PDFs) --- */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                                
                                {/* 1. CADERNO DE QUESTÕES */}
                                {exam.files?.bookletUrl ? (
                                    <div className="bg-[#1a1d24] border border-gray-800 p-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-gray-600 transition-all shadow-lg gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gray-800 rounded-lg text-gray-400 group-hover:text-white group-hover:bg-gray-700 transition-all">
                                                {/* Ícone de Documento */}
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold text-sm uppercase tracking-wide group-hover:text-red-500 transition-colors">Caderno de Questões</h4>
                                                <p className="text-gray-500 text-xs">Baixar arquivo da prova</p>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-auto flex justify-center mt-2 md:mt-0">
                                            <button 
                                                onClick={() => window.open(exam.files.bookletUrl, '_blank')}
                                                className="w-full md:w-auto px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-lg border border-gray-700 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                                            >
                                                Visualizar
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Estado vazio caso não tenha PDF cadastrado */
                                    <div className="bg-[#1a1d24] border border-gray-800/50 p-5 rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gray-800/50 rounded-lg text-gray-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                                            <div><h4 className="text-gray-500 font-bold text-sm uppercase">Caderno Indisponível</h4></div>
                                        </div>
                                    </div>
                                )}

                                {/* 2. GABARITO COMENTADO */}
                                {exam.files?.answerKeyUrl ? (
                                    <div className="bg-[#1a1d24] border border-gray-800 p-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-green-900/50 transition-all shadow-lg gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gray-800 rounded-lg text-gray-400 group-hover:text-green-400 group-hover:bg-green-900/20 transition-all">
                                                {/* Ícone de Check/Gabarito */}
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold text-sm uppercase tracking-wide group-hover:text-green-400 transition-colors">Gabarito Comentado</h4>
                                                <p className="text-gray-500 text-xs">Baixar gabarito oficial</p>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-auto flex justify-center mt-2 md:mt-0">
                                            <button 
                                                onClick={() => window.open(exam.files.answerKeyUrl, '_blank')}
                                                className="w-full md:w-auto px-4 py-2 bg-gray-800 hover:bg-green-600 text-white text-xs font-bold rounded-lg border border-gray-700 hover:border-green-500 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                                            >
                                                Visualizar
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Estado vazio */
                                    <div className="bg-[#1a1d24] border border-gray-800/50 p-5 rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gray-800/50 rounded-lg text-gray-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg></div>
                                            <div><h4 className="text-gray-500 font-bold text-sm uppercase">Gabarito Indisponível</h4></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* GABARITO DETALHADO */}
                            <div className="bg-zinc-900/30 rounded-xl border border-zinc-800 p-6">
                                <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 uppercase tracking-tighter">
                                    <ListChecks className="w-5 h-5 text-brand-red" />
                                    Gabarito Detalhado
                                </h3>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                                    {Array.from({ length: exam.questionCount }).map((_, i) => {
                                        const qNum = i + 1;
                                        // Normaliza chaves e busca dados da questão
                                        const userAns = attemptData.userAnswers[qNum] || attemptData.userAnswers[String(qNum)];
                                        const questionData = exam.questions?.find(q => q.index === qNum);
                                        const correctAns = questionData?.answer;
                                        const isAnnulled = questionData?.isAnnulled;
                                        
                                        let statusClass = 'border-zinc-800 bg-zinc-900 text-zinc-500'; // Branco
                                        let icon = <Minus size={12} />;
                                        
                                        if (isAnnulled) {
                                            statusClass = 'border-zinc-800 bg-zinc-800/50 text-zinc-600 opacity-50';
                                        } else if (userAns) {
                                            if (userAns === correctAns) {
                                                statusClass = 'border-emerald-500/30 bg-emerald-900/20 text-emerald-400'; // Acerto
                                                icon = <Check size={12} />;
                                            } else {
                                                statusClass = 'border-red-500/30 bg-red-900/20 text-red-400'; // Erro
                                                icon = <X size={12} />;
                                            }
                                        }

                                        return (
                                            <div key={qNum} className={`relative p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${statusClass}`}>
                                                <span className="text-[8px] font-mono mb-1 opacity-60">Q{qNum}</span>
                                                <div className="flex gap-1 items-center font-black text-sm">
                                                    {isAnnulled ? (
                                                        <span className="text-[10px] text-zinc-500">ANULADA</span>
                                                    ) : (
                                                        <>
                                                            <span className="uppercase">{userAns || '-'}</span>
                                                            {userAns !== correctAns && userAns && correctAns && (
                                                                <>
                                                                    <span className="text-zinc-600 text-[10px]">➜</span>
                                                                    <span className="text-emerald-500">{correctAns}</span>
                                                                </>
                                                            )}
                                                            {!userAns && correctAns && (
                                                                <span className="text-[10px] text-zinc-600">({correctAns})</span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                {/* Icon Indicator */}
                                                {!isAnnulled && userAns && (
                                                    <div className="absolute top-1 right-1 opacity-50">
                                                        {icon}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-6 flex gap-4 text-[10px] font-bold text-zinc-500 justify-end uppercase tracking-widest border-t border-zinc-800 pt-4">
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Acerto</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Erro</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-zinc-700 rounded-full"></div> Branco</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- CONTEÚDO DA ABA AUTODIAGNÓSTICO (NOVO) --- */}
                    {activeTab === 'AUTODIAGNOSIS' && (
                        <StudentAutoDiagnosis 
                            exam={exam} 
                            attempt={attemptData} 
                        />
                    )}

                    {/* --- ABA 3: RANKING GERAL (DIVIDIDO) --- */}
                    {activeTab === 'RANKING' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            
                            {/* CABEÇALHO E BUSCA */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest">
                                        <Trophy size={16} className="text-yellow-500" />
                                        Classificação Geral
                                    </h3>
                                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">
                                        Ranking ordenado pela maior nota líquida. 
                                    </p>
                                </div>

                                {/* BARRA DE PESQUISA */}
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-2.5 text-zinc-500" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="BUSCAR ALUNO..." 
                                        value={rankingSearch}
                                        onChange={(e) => setRankingSearch(e.target.value)}
                                        className="w-full bg-zinc-950 text-white text-xs font-bold py-2 pl-9 pr-4 rounded-lg border border-zinc-800 focus:border-brand-red focus:outline-none placeholder-zinc-600 uppercase"
                                    />
                                </div>
                            </div>

                            {loadingRanking ? (
                                <div className="p-12 text-center text-zinc-500 animate-pulse uppercase font-bold tracking-widest">
                                    Carregando classificações...
                                </div>
                            ) : (
                                <>
                                    {/* --- TABELA 1: APROVADOS --- */}
                                    <div className="bg-zinc-900 border border-emerald-900/30 rounded-xl overflow-hidden">
                                        <div className="p-3 bg-emerald-950/20 border-b border-emerald-900/30 flex justify-between items-center">
                                            <h4 className="font-bold text-emerald-500 flex items-center gap-2 text-xs uppercase tracking-widest">
                                                <Medal size={14} />
                                                LISTA DE APROVADOS
                                            </h4>
                                            <span className="text-[10px] font-bold bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800">{approvedList.length}</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-500 font-black tracking-widest border-b border-zinc-800">
                                                    <tr>
                                                        <th className="p-4 w-16 text-center">#</th>
                                                        <th className="p-4">Aluno</th>
                                                        <th className="p-4 text-center">Acertos</th>
                                                        <th className="p-4 text-center">Erros</th>
                                                        <th className="p-4 text-center text-white text-xs">NOTA</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800 text-xs">
                                                    {approvedList.length > 0 ? (
                                                        approvedList.map(rank => <RankingRow key={rank.id} rank={rank} currentUserId={currentUser?.uid} />)
                                                    ) : (
                                                        <tr><td colSpan={5} className="p-8 text-center text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Nenhum aprovado neste filtro.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* --- TABELA 2: REPROVADOS --- */}
                                    <div className="bg-zinc-900 border border-red-900/30 rounded-xl overflow-hidden opacity-90">
                                        <div className="p-3 bg-red-950/20 border-b border-red-900/30 flex justify-between items-center">
                                            <h4 className="font-bold text-red-500 flex items-center gap-2 text-xs uppercase tracking-widest">
                                                <AlertCircle size={14} />
                                                LISTA DE REPROVADOS
                                            </h4>
                                            <span className="text-[10px] font-bold bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full border border-red-800">{reprovedList.length}</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-500 font-black tracking-widest border-b border-zinc-800">
                                                    <tr>
                                                        <th className="p-4 w-16 text-center">#</th>
                                                        <th className="p-4">Aluno</th>
                                                        <th className="p-4 text-center">Acertos</th>
                                                        <th className="p-4 text-center">Erros</th>
                                                        <th className="p-4 text-center text-white text-xs">NOTA</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800 text-xs">
                                                    {reprovedList.length > 0 ? (
                                                        reprovedList.map(rank => <RankingRow key={rank.id} rank={rank} currentUserId={currentUser?.uid} />)
                                                    ) : (
                                                        <tr><td colSpan={5} className="p-8 text-center text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Nenhum reprovado neste filtro.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
