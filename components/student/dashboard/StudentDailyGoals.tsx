import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext'; 
import { SimuladoDashboardCard as SimuladoGoalCard } from '../SimuladoDashboardCard';
import { SimuladoFocusMode } from '../goals/SimuladoFocusMode'; 
import { scheduleUserSimulado } from '../../../services/scheduleService';
import { collection, query, where, getDocs, documentId, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

interface ComputedSimulado {
    id: string;
    title: string;
    duration: number;
    status: 'blocked' | 'released' | 'scheduled';
    date?: Date;
    pdfUrl?: string; 
}

export const StudentDailyGoals = ({ planData, userData }: { planData: any, userData: any }) => {
    const { currentUser: user } = useAuth();
    const [schedule, setSchedule] = useState<any[]>([]); 
    const [computedSimulados, setComputedSimulados] = useState<{ blocked: ComputedSimulado[], released: ComputedSimulado[] }>({ blocked: [], released: [] });
    const [showScheduleModal, setShowScheduleModal] = useState<string | null>(null);
    const [simuladosDetails, setSimuladosDetails] = useState<Record<string, any>>({}); 
    
    // Estados do Modo Foco e Acordeão
    const [isExamMode, setIsExamMode] = useState(false);
    const [activeSimulado, setActiveSimulado] = useState<any>(null);
    const [expandedSimulado, setExpandedSimulado] = useState<string | null>(null);
    
    // SOLICITAÇÃO 2: ESTADO PARA O POPUP DE CONFIRMAÇÃO
    const [showStartConfirmation, setShowStartConfirmation] = useState<any>(null);

    // 1. BUSCA AGENDAMENTO REAL
    useEffect(() => {
        const fetchSchedule = async () => {
            if (!user || !planData?.id) return;
            // CORREÇÃO: Usa a subcoleção correta do usuário
            const schedulesRef = collection(db, 'users', user.uid, 'schedules');
            const snap = await getDocs(schedulesRef);
            
            // Achata todos os itens de todos os dias em um único array
            const allItems: any[] = [];
            snap.docs.forEach(docSnap => {
                const data = docSnap.data();
                const items = (data.items || []) as any[];
                // Filtra apenas os itens deste plano
                const planItems = items.filter(i => i.planId === planData.id);
                allItems.push(...planItems.map(i => ({ ...i, date: data.date })));
            });
            
            setSchedule(allItems);
        };
        fetchSchedule();
    }, [user, planData]);

    // 2. BUSCA DETALHES REAIS (Incluindo PDF)
    useEffect(() => {
        const fetchSimuladoDetails = async () => {
            if (!planData || !planData.cycles) return;
            const ids = new Set<string>();
            planData.cycles.forEach((c: any) => c.items?.forEach((i: any) => {
                if (i.type === 'simulado') ids.add(i.simuladoId || i.id);
            }));
            if (ids.size === 0) return;

            try {
                // Adaptação para chunks de 10
                const idsArray = Array.from(ids);
                const chunks = [];
                for (let i = 0; i < idsArray.length; i += 10) {
                    chunks.push(idsArray.slice(i, i + 10));
                }

                const details: Record<string, any> = {};
                for (const chunk of chunks) {
                    const q = query(collection(db, 'simulados_exams'), where(documentId(), 'in', chunk));
                    const snap = await getDocs(q);
                    snap.forEach(doc => details[doc.id] = doc.data());
                }
                setSimuladosDetails(details);
            } catch (error) {
                console.error("Erro ao buscar detalhes:", error);
            }
        };
        fetchSimuladoDetails();
    }, [planData]);

    // 3. CÁLCULO DE STATUS
    useEffect(() => {
        if (!planData || !planData.cycles) return;

        const blocked: ComputedSimulado[] = [];
        const released: ComputedSimulado[] = [];
        const completedMetaIds = new Set(
            schedule.filter((s: any) => s.status === 'completed').map((s: any) => s.metaId)
        );
        let accumulatedPrerequisites: string[] = [];

        planData.cycles.forEach((cycle: any, cIndex: number) => {
            if (!cycle.items) return;
            cycle.items.forEach((item: any) => {
                if (item.type === 'simulado') {
                    const simuladoId = item.simuladoId || item.id;
                    const realData = simuladosDetails[simuladoId];
                    const realDuration = realData?.duration ? Number(realData.duration) : (item.duration ? Number(item.duration) : 240);
                    const realPdfUrl = realData?.arquivoProvaUrl || realData?.pdfUrl;
                    const scheduledItem = schedule.find((s: any) => s.metaId === simuladoId && s.type === 'simulado' && s.status !== 'completed');
                    const allPrerequisitesMet = accumulatedPrerequisites.every(id => completedMetaIds.has(id));

                    const simuladoObj: ComputedSimulado = {
                        id: simuladoId,
                        title: item.simuladoTitle || item.title || 'Simulado Oficial',
                        duration: realDuration,
                        status: 'blocked',
                        pdfUrl: realPdfUrl,
                        date: scheduledItem ? (scheduledItem.date.toDate ? scheduledItem.date.toDate() : new Date(scheduledItem.date)) : undefined
                    };

                    if (scheduledItem) {
                        simuladoObj.status = 'scheduled';
                        released.push(simuladoObj); 
                    } else if (allPrerequisitesMet) {
                        simuladoObj.status = 'released';
                        released.push(simuladoObj);
                    } else {
                        simuladoObj.status = 'blocked';
                        blocked.push(simuladoObj);
                    }
                } else {
                    const metasInItem = extractMetaIdsFromItem(item);
                    accumulatedPrerequisites = [...accumulatedPrerequisites, ...metasInItem];
                }
            });
        });
        released.sort((a, b) => (a.status === 'scheduled' ? -1 : 1));
        setComputedSimulados({ blocked, released });
    }, [planData, schedule, simuladosDetails, userData]);

    const extractMetaIdsFromItem = (item: any): string[] => {
        const ids: string[] = [];
        if (!planData?.disciplines) return ids;

        let targetDisciplines = [];
        if (item.type === 'discipline') {
            targetDisciplines = planData.disciplines.filter((d: any) => d.id === item.referenceId);
        } else if (item.type === 'folder') {
            targetDisciplines = planData.disciplines.filter((d: any) => d.folderId === item.referenceId);
        }

        targetDisciplines.forEach((disc: any) => {
            disc.topics?.forEach((topic: any) => {
                topic.metas?.forEach((meta: any) => {
                    ids.push(meta.id);
                });
            });
        });

        return ids;
    };

    const handleScheduleSimulado = async (date: Date) => {
        if (!showScheduleModal || !user || !planData) return;
        const simuladoToSchedule = computedSimulados.released.find(s => s.id === showScheduleModal);
        if (!simuladoToSchedule) return;
        try {
            await scheduleUserSimulado(user.uid, planData.id, simuladoToSchedule, date);
            // Removido reload para evitar refresh visual desnecessário
            // O estado deve ser atualizado via props ou context se necessário, 
            // ou o usuário pode navegar para outra aba.
        } catch (error) {
            console.error("Erro ao agendar:", error);
            alert("Erro ao agendar simulado.");
        }
    };

    const handleCompleteSimulado = async (docId: string) => {
        try {
            const goalRef = doc(db, 'student_schedule', docId);
            await updateDoc(goalRef, { status: 'completed', completedAt: new Date() });
            setSchedule(prev => prev.map((item: any) => item.docId === docId ? { ...item, status: 'completed' } : item));
            setIsExamMode(false);
            setActiveSimulado(null);
        } catch (error) {
            console.error("Erro ao concluir:", error);
        }
    };

    // NOVA FUNÇÃO: Iniciar Prova (Após confirmação)
    const confirmStartExam = () => {
        if (showStartConfirmation) {
            setActiveSimulado(showStartConfirmation);
            setIsExamMode(true);
            setShowStartConfirmation(null);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
            
            {/* --- MODO FOCO --- */}
            {isExamMode && activeSimulado && (
                <SimuladoFocusMode 
                    simulado={{
                        id: activeSimulado.docId, 
                        title: activeSimulado.title,
                        duration: activeSimulado.duration || 60,
                        pdfUrl: activeSimulado.pdfUrl // Passando PDF para o modo foco
                    }}
                    onClose={() => setIsExamMode(false)}
                    onComplete={() => handleCompleteSimulado(activeSimulado.docId)}
                />
            )}

            {/* SEÇÃO DE SIMULADOS (DISPONÍVEIS/BLOQUEADOS) */}
            {(computedSimulados.released.length > 0 || computedSimulados.blocked.length > 0) && (
                <div className="mb-10 space-y-8 border-b border-gray-800 pb-8">
                    {computedSimulados.released.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.6)]"></span>
                                <h2 className="text-white font-black text-2xl uppercase tracking-wider">Simulados</h2>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {computedSimulados.released.map(sim => (
                                    <SimuladoGoalCard key={sim.id} simulado={sim} onSchedule={(id) => setShowScheduleModal(id)} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- METAS AGENDADAS PARA HOJE (LAYOUT CORRIGIDO) --- */}
            <div className="mb-8">
                {schedule.some((s:any) => s.type === 'simulado' && s.status === 'pending') && (
                    <h3 className="text-gray-400 font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Metas de Prova (Hoje)
                    </h3>
                )}

                <div className="space-y-6">
                    {schedule.filter((s: any) => s.type === 'simulado' && s.status === 'pending').map((simulado: any, idx) => {
                        // Resgata o PDF
                        const pdfFile = simulado.files?.[0];
                        const pdfUrl = pdfFile?.url || simuladosDetails[simulado.metaId]?.pdfUrl;

                        return (
                            <div key={idx} className="bg-black border border-yellow-600/50 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(234,179,8,0.1)]">
                                
                                {/* CONTEÚDO PRINCIPAL */}
                                <div className="p-6 md:p-8 relative">
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-500"></div>
                                    
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                                        <div className="p-4 bg-yellow-500/10 rounded-xl text-yellow-500 border border-yellow-500/20 shrink-0">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h4 className="text-yellow-500 font-black text-xs uppercase tracking-widest">META DE SIMULADO</h4>
                                                <span className="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded border border-gray-700 font-mono">ID: {simulado.metaId.slice(0,6)}</span>
                                            </div>
                                            <h3 className="text-white font-bold text-2xl leading-tight">{simulado.title}</h3>
                                            <div className="flex items-center gap-4 mt-3">
                                                <span className="text-gray-400 text-sm flex items-center gap-1.5">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    {Math.floor(simulado.duration / 60)}h Duração
                                                </span>
                                                <span className={`text-sm flex items-center gap-1.5 ${pdfUrl ? 'text-green-500' : 'text-red-500'}`}>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    {pdfUrl ? 'Caderno Disponível' : 'Caderno Pendente'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SOLICITAÇÃO 1: RODAPÉ COM BOTÕES CENTRALIZADOS */}
                                <div className="bg-[#15171b] p-4 border-t border-gray-800 flex flex-col sm:flex-row justify-center items-center gap-4">
                                    <button 
                                        onClick={() => setExpandedSimulado(expandedSimulado === simulado.metaId ? null : simulado.metaId)}
                                        className={`w-full sm:w-auto px-6 py-3 rounded-lg font-bold text-xs uppercase tracking-wider border transition-all flex justify-center items-center gap-2
                                            ${expandedSimulado === simulado.metaId ? 'bg-gray-800 border-gray-600 text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'}
                                        `}
                                    >
                                        {expandedSimulado === simulado.metaId ? 'Ocultar Materiais' : 'Ver Materiais'}
                                        <svg className={`w-4 h-4 transition-transform ${expandedSimulado === simulado.metaId ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7 7" /></svg>
                                    </button>

                                    {/* SOLICITAÇÃO 2: ABRE POPUP DE CONFIRMAÇÃO AO INVÉS DE INICIAR DIRETO */}
                                    <button 
                                        onClick={() => setShowStartConfirmation({ ...simulado, pdfUrl })}
                                        className="w-full sm:w-auto px-10 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm rounded-lg uppercase tracking-wider transition-all shadow-lg shadow-yellow-900/30 flex justify-center items-center gap-2 transform hover:scale-105"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                        INICIAR PROVA
                                    </button>
                                </div>

                                {/* ACORDEÃO INTELIGENTE (PDF) */}
                                {expandedSimulado === simulado.metaId && (
                                    <div className="border-t border-gray-800 bg-[#0f1115] p-6 animate-in slide-in-from-top-2">
                                        <h4 className="text-gray-400 font-bold text-xs uppercase mb-3">Material de Apoio</h4>
                                        
                                        {pdfUrl ? (
                                            <div className="flex items-center justify-between p-4 rounded-lg bg-[#1a1d24] border border-gray-700 hover:border-gray-500 transition-colors group">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-red-500/10 text-red-500 rounded">
                                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-bold text-sm">Caderno de Questões Oficial</p>
                                                        <p className="text-gray-500 text-xs">PDF • Clique para abrir</p>
                                                    </div>
                                                </div>
                                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded uppercase transition-colors">
                                                    Abrir PDF
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="text-gray-600 text-sm italic p-4 text-center border border-gray-800 border-dashed rounded">
                                                Nenhum caderno PDF encontrado.
                                            </div>
                                        )}
                                        
                                        <div className="mt-4 p-4 bg-yellow-900/10 border border-yellow-500/20 rounded-lg flex gap-3">
                                            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <p className="text-xs text-yellow-200/80 leading-relaxed">
                                                <strong>Dica:</strong> Abra o PDF antes de iniciar a prova. O modo foco bloqueará outras ações na tela.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal de Agendamento */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
                    <div className="bg-[#1a1d24] p-8 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl">
                        <div className="text-center mb-6">
                            <h3 className="text-white font-black text-xl uppercase">Agendar Simulado</h3>
                            <p className="text-gray-400 text-sm mt-2">Escolha um dia exclusivo.</p>
                        </div>
                        <input type="date" className="w-full bg-black text-white p-4 rounded-xl border border-gray-600 mb-6 focus:border-yellow-500 outline-none text-center font-bold" onChange={(e) => handleScheduleSimulado(new Date(e.target.value))} />
                        <button onClick={() => setShowScheduleModal(null)} className="w-full py-3 text-gray-500 hover:text-white text-sm font-bold uppercase tracking-wider">Cancelar</button>
                    </div>
                </div>
            )}

            {/* SOLICITAÇÃO 2: POPUP DE CONFIRMAÇÃO DE INÍCIO */}
            {showStartConfirmation && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#1a1d24] p-8 rounded-2xl w-full max-w-lg border border-red-600/30 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mb-6 text-red-500 border border-red-500/20">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <h3 className="text-white font-black text-2xl uppercase mb-2">Atenção!</h3>
                            <p className="text-gray-300 text-sm leading-relaxed mb-6">
                                Você está prestes a iniciar o simulado <strong>{showStartConfirmation.title}</strong>.
                                <br/><br/>
                                <span className="text-red-400 font-bold block bg-red-900/10 p-2 rounded">
                                    O cronômetro iniciará imediatamente e NÃO poderá ser pausado.
                                </span>
                            </p>
                            
                            <div className="flex flex-col w-full gap-3">
                                <button 
                                    onClick={confirmStartExam}
                                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl uppercase tracking-wider transition-all shadow-lg"
                                >
                                    Estou pronto, Iniciar Agora
                                </button>
                                <button 
                                    onClick={() => setShowStartConfirmation(null)}
                                    className="w-full py-3 bg-transparent border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white font-bold text-sm rounded-xl uppercase tracking-wider transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};