import React, { useMemo, useEffect } from 'react';
import { 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { SimulatedAttempt } from '../../../services/simulatedAttemptService';
import { SimulatedExam } from '../../../services/simulatedService';
import { Trophy } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { updateStudent } from '../../../services/userService';

interface ConsolidatedData {
    strong: number;
    weak: number;
    review: number;
    topicsToStudy: string[];
    topicsToReview: string[];
}

// --- SUBCOMPONENTE: CARD DE DISCIPLINA CONSOLIDADA ---
const ConsolidatedSubjectCard: React.FC<{ subject: string; data: ConsolidatedData }> = ({ subject, data }) => {
    // Calcula a porcentagem de domínio na disciplina
    const totalItems = data.strong + data.weak + data.review;
    const performance = totalItems > 0 ? Math.round((data.strong / totalItems) * 100) : 0;

    return (
        <div className="bg-[#1a1d24] rounded-xl border border-gray-800 overflow-hidden flex flex-col hover:border-gray-600 transition-all">
            <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                <h4 className="font-bold text-white text-sm uppercase tracking-wide truncate max-w-[70%]">{subject}</h4>
                <span className={`text-xs font-black px-2 py-1 rounded ${performance >= 70 ? 'bg-green-500 text-black' : performance >= 40 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'}`}>
                    {performance}% DOMÍNIO
                </span>
            </div>
            
            <div className="p-4 space-y-3 flex-1">
                {/* BARRA DE PROGRESSO VISUAL */}
                <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
                    <div style={{ width: `${(data.strong / totalItems) * 100}%` }} className="bg-green-500" />
                    <div style={{ width: `${(data.review / totalItems) * 100}%` }} className="bg-yellow-500" />
                    <div style={{ width: `${(data.weak / totalItems) * 100}%` }} className="bg-red-500" />
                </div>
                <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500">
                    <span>{data.strong} Fortes</span>
                    <span>{data.review} Flashcard</span>
                    <span>{data.weak} Fracos</span>
                </div>

                {/* TÓPICOS CRÍTICOS (ACUMULADOS) */}
                {data.topicsToStudy.length > 0 && (
                    <div className="mt-3 bg-red-900/10 border border-red-500/20 p-3 rounded">
                        <p className="text-[9px] font-bold text-red-400 uppercase mb-1">Tópicos Críticos (Recorrentes):</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {data.topicsToStudy.slice(0, 3).map((t, i) => (
                                <li key={i} className="text-[10px] text-gray-400 truncate">{t}</li>
                            ))}
                            {data.topicsToStudy.length > 3 && <li className="text-[9px] text-gray-500">e mais {data.topicsToStudy.length - 3}...</li>}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
export const StudentPerformanceDashboard: React.FC<{ 
    attempts: SimulatedAttempt[];
    exams: SimulatedExam[];
}> = ({ attempts, exams }) => {
    const { currentUser, userData } = useAuth();
    
    // 1. PROCESSAMENTO DE DADOS (MEMOIZADO)
    const dashboardData = useMemo(() => {
        if (!attempts || attempts.length === 0) return null;

        // B. DADOS DO GRÁFICO
        const sortedAttempts = [...attempts].sort((a, b) => 
            (a.completedAt?.seconds || 0) - (b.completedAt?.seconds || 0)
        );

        // C. NIVELAMENTO RETROATIVO
        const levelingExam = exams.find(e => e.isLeveling && e.levelingRanges);
        let identifiedLevel: 'beginner' | 'intermediate' | 'advanced' | 'insane' | null = null;
        let levelingAttempt: SimulatedAttempt | null = null;

        if (levelingExam) {
            levelingAttempt = attempts.find(a => a.simulatedId === levelingExam.id) || null;
            if (levelingAttempt && levelingExam.levelingRanges) {
                const percent = (levelingAttempt.score / levelingAttempt.totalQuestions) * 100;
                
                if (percent > levelingExam.levelingRanges.advanced) identifiedLevel = 'insane';
                else if (percent > levelingExam.levelingRanges.intermediate) identifiedLevel = 'advanced';
                else if (percent > levelingExam.levelingRanges.beginner) identifiedLevel = 'intermediate';
                else identifiedLevel = 'beginner';
            }
        }

        // D. DADOS GERAIS
        const totalSimulados = sortedAttempts.length;
        const totalScore = sortedAttempts.reduce((acc, curr) => acc + (curr.score || 0), 0);
        const averageScore = totalSimulados > 0 ? Math.round(totalScore / totalSimulados) : 0;
        const approvedCount = sortedAttempts.filter(a => a.isApproved).length;
        const approvalRate = totalSimulados > 0 ? Math.round((approvedCount / totalSimulados) * 100) : 0;

        // ... chartData and consolidatedMap logic remains ...
        const chartData = sortedAttempts.map((att, index) => ({
            name: `Simulado ${index + 1}`,
            nota: att.score,
            data: att.completedAt ? new Date(att.completedAt.seconds * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-'
        }));

        const consolidatedMap: Record<string, ConsolidatedData> = {};
        sortedAttempts.forEach(att => {
            // @ts-expect-error: Autodiagnosis might not be in interface yet
            const autodiagnosis = att.autodiagnosis;
            const analysis = autodiagnosis?.analysis;
            if (analysis) {
                Object.entries(analysis).forEach(([subject, data]: [string, any]) => {
                    if (!consolidatedMap[subject]) {
                        consolidatedMap[subject] = { strong: 0, weak: 0, review: 0, topicsToStudy: [], topicsToReview: [] };
                    }
                    consolidatedMap[subject].strong += (data.strong || 0);
                    consolidatedMap[subject].weak += (data.weak || 0);
                    consolidatedMap[subject].review += (data.review || 0);
                    if (data.topicsToStudy) {
                        data.topicsToStudy.forEach((t: string) => {
                            if (!consolidatedMap[subject].topicsToStudy.includes(t)) consolidatedMap[subject].topicsToStudy.push(t);
                        });
                    }
                    if (data.topicsToReview) {
                        data.topicsToReview.forEach((t: string) => {
                            if (!consolidatedMap[subject].topicsToReview.includes(t)) consolidatedMap[subject].topicsToReview.push(t);
                        });
                    }
                });
            }
        });

        return {
            kpis: { totalSimulados, averageScore, approvalRate, identifiedLevel, levelingAttempt },
            chartData,
            consolidatedMap
        };
    }, [attempts, exams]);

    // 2. SINCRONIZAÇÃO COM PERFIL
    useEffect(() => {
        if (currentUser && dashboardData?.kpis.identifiedLevel) {
            const currentLevel = (userData as any)?.studentLevel;
            const newLevel = dashboardData.kpis.identifiedLevel;
            
            // Sincroniza apenas se o nível mudou ou não existe
            if (currentLevel !== newLevel) {
                console.log(`[Dashboard] Sincronizando nível: ${newLevel}`);
                updateStudent(currentUser.uid, {
                    studentLevel: newLevel,
                    studyProfile: {
                        ...(userData?.studyProfile || {}),
                        level: newLevel
                    } as any
                }).catch(err => console.error("Erro ao sincronizar nível:", err));
            }
        }
    }, [currentUser, userData, dashboardData?.kpis.identifiedLevel]);

    const levelStyle = useMemo(() => {
        if (!dashboardData?.kpis.identifiedLevel) return null;
        const level = dashboardData.kpis.identifiedLevel;
        
        const styles: any = {
            insane: { 
                label: 'Insano', 
                color: 'text-[#FF0000]', 
                border: 'border-[#FF0000]/40', 
                glow: 'drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]',
                iconBg: 'bg-[#FF0000]/10',
                iconColor: 'text-[#FF0000]'
            },
            advanced: { 
                label: 'Avançado', 
                color: 'text-[#FFD700]', 
                border: 'border-[#FFD700]/40', 
                glow: 'drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]',
                iconBg: 'bg-[#FFD700]/10',
                iconColor: 'text-[#FFD700]'
            },
            intermediate: { 
                label: 'Intermediário', 
                color: 'text-[#50C878]', 
                border: 'border-[#50C878]/40', 
                glow: 'drop-shadow-[0_0_15px_rgba(80,200,120,0.5)]',
                iconBg: 'bg-[#50C878]/10',
                iconColor: 'text-[#50C878]'
            },
            beginner: { 
                label: 'Iniciante', 
                color: 'text-[#00FFFF]', 
                border: 'border-[#00FFFF]/40', 
                glow: 'drop-shadow-[0_0_15px_rgba(0,255,255,0.5)]',
                iconBg: 'bg-[#00FFFF]/10',
                iconColor: 'text-[#00FFFF]'
            }
        };
        
        return styles[level];
    }, [dashboardData?.kpis.identifiedLevel]);

    if (!dashboardData) return (
        <div className="p-8 text-center text-gray-500 bg-[#1a1d24] rounded-2xl border border-gray-800">
            <p>Realize seu primeiro simulado para desbloquear o dashboard de inteligência.</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* CARD DE NÍVEL IDENTIFICADO (RETROATIVO) */}
            {levelStyle && (
                <div className={`bg-[#0a0a0a] border ${levelStyle.border} p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500`}>
                    <div className="flex items-center gap-5">
                        <div className={`w-16 h-16 ${levelStyle.iconBg} rounded-2xl flex items-center justify-center ${levelStyle.iconColor} shadow-2xl`}>
                            <Trophy size={32} />
                        </div>
                        <div>
                            <h4 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Nível de Preparação Identificado:</h4>
                            <p className={`text-3xl font-black uppercase tracking-tight ${levelStyle.color} ${levelStyle.glow}`}>
                                {levelStyle.label}
                            </p>
                        </div>
                    </div>
                    <div className="bg-black/40 backdrop-blur-md px-5 py-3 rounded-xl border border-zinc-800 text-center md:text-right">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Baseado no Simulado:</p>
                        <p className="text-white text-xs font-black uppercase truncate max-w-[200px]">{dashboardData.kpis.levelingAttempt?.simulatedTitle}</p>
                    </div>
                </div>
            )}
            
            {/* 1. CARDS DE KPI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1a1d24] p-5 rounded-2xl border border-gray-800 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold">Média Geral</p>
                        <h3 className="text-2xl font-black text-white">{dashboardData.kpis.averageScore} Pts</h3>
                    </div>
                </div>
                <div className="bg-[#1a1d24] p-5 rounded-2xl border border-gray-800 flex items-center gap-4">
                    <div className="p-3 bg-green-500/10 rounded-lg text-green-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold">Taxa de Aprovação</p>
                        <h3 className="text-2xl font-black text-white">{dashboardData.kpis.approvalRate}%</h3>
                    </div>
                </div>
                <div className="bg-[#1a1d24] p-5 rounded-2xl border border-gray-800 flex items-center gap-4">
                    <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold">Simulados Feitos</p>
                        <h3 className="text-2xl font-black text-white">{dashboardData.kpis.totalSimulados}</h3>
                    </div>
                </div>
            </div>

            {/* 2. GRÁFICO DE EVOLUÇÃO */}
            <div className="bg-[#1a1d24] p-6 rounded-2xl border border-gray-800 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-red-600 rounded-full"></span>
                    Evolução de Notas
                </h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardData.chartData}>
                            <defs>
                                <linearGradient id="colorNota" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="name" stroke="#666" fontSize={10} tickMargin={10} />
                            <YAxis stroke="#666" fontSize={10} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="nota" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorNota)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. RELATÓRIO CONSOLIDADO (SUPER DIAGNÓSTICO) */}
            <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-yellow-500 rounded-full"></span>
                    Diagnóstico Global (Acumulado)
                </h3>
                <p className="text-gray-400 text-sm mb-6">Mapeamento de pontos fortes e fracos considerando <strong>todos</strong> os simulados realizados nesta turma.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(dashboardData.consolidatedMap).map(([subject, data]) => (
                        <ConsolidatedSubjectCard key={subject} subject={subject} data={data} />
                    ))}
                </div>
            </div>
        </div>
    );
};