import React, { useEffect, useState } from 'react';
import { courseReviewService, CourseReview } from '../../../../services/courseReviewService';
import { courseService } from '../../../../services/courseService';
import { getEdict } from '../../../../services/edictService';
import { useAuth } from '../../../../contexts/AuthContext';
import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';

export function CourseReviewDashboard({ courseId, planId, onReviewNow }: { courseId?: string, planId?: string, onReviewNow: (disciplineId: string, topicId: string, goalId?: string) => void }) {
    const { currentUser: user } = useAuth();
    const [reviews, setReviews] = useState<CourseReview[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReviews = async () => {
        if (!user) return;
        try {
            // 1. Busca as revisões pendentes filtradas por plano ou curso se fornecidos
            const reviewsData = await courseReviewService.getPendingReviews(
                user.uid, 
                planId || courseId, 
                planId ? 'plan' : 'course'
            );

            // 2. Busca a estrutura oficial para validação de integridade (Cross-Reference)
            const validTopicIds = new Set<string>();
            
            if (planId) {
                const planEdict = await getEdict(planId);
                const extractIds = (items: any[]) => {
                    items.forEach(item => {
                        validTopicIds.add(String(item.id));
                        if (item.topics) extractIds(item.topics);
                        if (item.subtopics) extractIds(item.subtopics);
                    });
                };
                extractIds(planEdict.disciplines || []);
            } else if (courseId) {
                const courseEdital = await courseService.getCourseEdital(courseId);
                const extractIds = (items: any[]) => {
                    items.forEach(item => {
                        validTopicIds.add(String(item.id));
                        if (item.topics) extractIds(item.topics);
                        if (item.subtopics) extractIds(item.subtopics);
                    });
                };
                extractIds(courseEdital.disciplines || []);
            }

            // 3. Filtro de Integridade e Preparação do Self-Healing
            const validReviews: CourseReview[] = [];
            const orphanedReviews: CourseReview[] = [];

            if (validTopicIds.size > 0) {
                reviewsData.forEach(review => {
                    if (validTopicIds.has(String(review.topicId))) {
                        validReviews.push(review);
                    } else {
                        orphanedReviews.push(review);
                    }
                });

                // 4. Self-Healing: Limpeza silenciosa em background
                if (orphanedReviews.length > 0) {
                    console.warn(`[Self-Healing] Detectadas ${orphanedReviews.length} revisões órfãs. Limpando banco...`);
                    courseReviewService.cleanupOrphanedReviews(orphanedReviews)
                        .catch(err => console.error("Erro no self-healing das revisões:", err));
                }

                setReviews(validReviews);
            } else {
                // Se não conseguimos validar a estrutura (ex: edital vazio), mantemos as revisões originais
                // mas apenas se realmente não houver estrutura. Se houver estrutura e o Set estiver vazio,
                // então todas seriam órfãs.
                setReviews(reviewsData);
            }
            
        } catch (error) {
            console.error("Erro ao buscar revisões:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [courseId, planId, user]);

    const handleComplete = async (review: CourseReview) => {
        if (!user) return;
        // Atualização Otimista: Desaparece do ecrã na hora em que clica
        setReviews(prev => prev.filter(r => r.id !== review.id));
        try {
            await courseReviewService.completeReview(user.uid, review);
        } catch (error) {
            console.error("Erro ao concluir revisão:", error);
            fetchReviews(); // Reverte caso dê erro no banco de dados
        }
    };

    if (loading || reviews.length === 0) return null;

    // Garante a formatação da data baseada no fuso horário local do utilizador (YYYY-MM-DD)
    const getLocalDateStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const todayStr = getLocalDateStr();

    // 1. Normalização do Ponto de Corte (Hoje)
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 2. Filtragem Rigorosa: Apenas Hoje ou Atrasadas (Trava Temporal)
    const pendingAndDueRevisions = reviews.filter(rev => {
        // scheduledDate é string YYYY-MM-DD. Convertemos para Date local para comparação segura.
        const revDate = new Date(rev.scheduledDate + 'T00:00:00');
        return revDate <= endOfToday;
    });

    // 3. Lógica de Agrupamento Dinâmico (GroupBy)
    const groupedReviews = pendingAndDueRevisions.reduce((acc, review) => {
        let key = 'topic_revision';
        if (review.type === 'goal_revision') {
            if (review.goalType === 'LEI SECA') key = 'goal_lei_seca';
            else if (review.goalType === 'QUESTÕES') key = 'goal_questoes';
            else if (review.goalType === 'RESUMO') key = 'goal_resumo';
            else if (review.goalType === 'FLASHCARD') key = 'goal_flashcard';
        }
        if (!acc[key]) acc[key] = [];
        acc[key].push(review);
        return acc;
    }, {} as Record<string, CourseReview[]>);

    const CATEGORIES_CONFIG: Record<string, { title: string; icon: any; theme: string }> = {
        topic_revision: { title: "REVISÕES DE TÓPICOS", icon: CalendarClock, theme: "blue" },
        goal_lei_seca: { title: "REVISÕES DE LEI SECA", icon: AlertCircle, theme: "yellow" },
        goal_questoes: { title: "REVISÕES DE QUESTÕES", icon: AlertCircle, theme: "red" },
        goal_resumo: { title: "REVISÕES DE RESUMOS", icon: AlertCircle, theme: "purple" },
        goal_flashcard: { title: "REVISÕES DE FLASHCARDS", icon: AlertCircle, theme: "pink" },
    };

    // Filtra apenas as categorias que possuem itens
    const activeCategories = Object.keys(CATEGORIES_CONFIG).filter(key => groupedReviews[key]?.length > 0);

    if (activeCategories.length === 0) return null;

    return (
        <div className="flex flex-col gap-6 mb-8 animate-in fade-in slide-in-from-top-4">
            {activeCategories.map(key => {
                const config = CATEGORIES_CONFIG[key];
                const categoryReviews = groupedReviews[key];
                
                return (
                    <ReviewSection 
                        key={key}
                        title={config.title} 
                        count={categoryReviews.length} 
                        theme={config.theme} 
                        icon={config.icon}
                        defaultOpen={true}
                    >
                        {categoryReviews.map(review => (
                            <ReviewCard 
                                key={review.id} 
                                review={review} 
                                onReviewNow={onReviewNow} 
                                onComplete={handleComplete} 
                                isOverdue={review.scheduledDate < todayStr} 
                            />
                        ))}
                    </ReviewSection>
                );
            })}
        </div>
    );
}

// ====================================================
// COMPONENTE: Acordeão Inteligente (ReviewSection)
// ====================================================
function ReviewSection({ title, count, theme, defaultOpen = true, icon: Icon, children }: any) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    const getThemeColors = (t: string) => {
        switch (t) {
            case 'red': return { bg: 'bg-red-900/20', border: 'border-red-900/50', text: 'text-red-500', badge: 'bg-red-500/20 text-red-400' };
            case 'yellow': return { bg: 'bg-yellow-900/20', border: 'border-yellow-900/50', text: 'text-yellow-500', badge: 'bg-yellow-500/20 text-yellow-500' };
            case 'blue': return { bg: 'bg-blue-900/20', border: 'border-blue-900/50', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400' };
            case 'purple': return { bg: 'bg-purple-900/20', border: 'border-purple-900/50', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-400' };
            case 'pink': return { bg: 'bg-pink-900/20', border: 'border-pink-900/50', text: 'text-pink-400', badge: 'bg-pink-500/20 text-pink-400' };
            default: return { bg: 'bg-gray-900/20', border: 'border-gray-900/50', text: 'text-gray-400', badge: 'bg-gray-500/20 text-gray-400' };
        }
    };

    const colors = getThemeColors(theme);

    if (count === 0) return null;

    return (
        <div className={`border rounded-xl overflow-hidden shadow-lg transition-all ${colors.border}`}>
            {/* Cabeçalho Clicável do Acordeão */}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-4 ${colors.bg} hover:opacity-80 transition-opacity cursor-pointer select-none`}
            >
                <div className="flex items-center gap-3">
                    <Icon size={18} className={colors.text} />
                    <h3 className={`${colors.text} font-black uppercase text-sm tracking-widest`}>{title}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                        {count}
                    </span>
                </div>
                <ChevronDown size={18} className={`${colors.text} transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            
            {/* Corpo do Acordeão */}
            {isOpen && (
                <div className={`p-4 bg-[#121418] flex flex-col gap-2 border-t ${colors.border} animate-in fade-in slide-in-from-top-2`}>
                    {children}
                </div>
            )}
        </div>
    );
}

// ====================================================
// COMPONENTE: Cartão de Revisão Isolado (ReviewCard)
// ====================================================
interface ReviewCardProps {
    review: CourseReview;
    onReviewNow: (disciplineId: string, topicId: string, goalId?: string) => void;
    onComplete: (r: CourseReview) => void;
    isOverdue: boolean;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, onReviewNow, onComplete, isOverdue }) => {
    const isGoalRevision = review.type === 'goal_revision';
    
    // Mapeamento de cores para tipos de metas
    const getGoalTypeColor = (type?: string) => {
        switch (type) {
            case 'LEI SECA': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'QUESTÕES': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'FLASHCARD': return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
            case 'RESUMO': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        }
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#1a1d24] border border-gray-800 rounded-lg p-3 gap-4 hover:border-gray-700 transition-colors group">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                        {review.label}
                    </span>
                    {/* Exibição da Disciplina em destaque sutil */}
                    <span className="text-[10px] text-gray-500 font-bold uppercase truncate">
                        {review.disciplineName || 'GERAL'}
                    </span>
                    {isGoalRevision && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${getGoalTypeColor(review.goalType)}`}>
                            {review.goalType}
                        </span>
                    )}
                </div>
                {/* Nome do Tópico / Meta */}
                <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                    {isGoalRevision ? (review.metaTitle || review.topicName) : review.topicName}
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onComplete(review)} className="flex items-center gap-2 px-3 py-1.5 bg-transparent hover:bg-green-900/20 text-green-500 border border-green-900/50 rounded text-xs font-bold uppercase transition-colors">
                    <CheckCircle2 size={14} /> Concluir
                </button>
                <button onClick={() => onReviewNow(review.disciplineId, review.topicId, review.goalId)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold uppercase transition-colors shadow-md shadow-blue-900/20">
                    Revisar <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
};
