import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Lightbulb, 
  Heart, 
  AlertCircle, 
  UserPlus, 
  Clock,
  User,
  LucideIcon,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Feedback, FeedbackCategory } from '../../../types/feedback';
import { feedbackService } from '../../../services/feedbackService';
import { teacherService } from '../../../services/teacherService';
import { Teacher } from '../../../types/teacher';
import Loading from '../../ui/Loading';

interface FeedbackPanelProps {
  productId: string;
  productName: string;
  productType: string;
}

const CATEGORIES: { id: FeedbackCategory, label: string, icon: LucideIcon, color: string }[] = [
  { id: 'idea', label: 'Ideias / Sugestões', icon: Lightbulb, color: 'text-blue-500' },
  { id: 'compliment', label: 'Elogios', icon: Heart, color: 'text-emerald-500' },
  { id: 'complaint', label: 'Reclamações', icon: AlertCircle, color: 'text-red-500' },
  { id: 'teacher_evaluation', label: 'Avaliação de Professores', icon: UserPlus, color: 'text-purple-500' },
];

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ productId, productName, productType }) => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FeedbackCategory>('idea');

  useEffect(() => {
    loadData();
  }, [productId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [feedbackData, teacherData] = await Promise.all([
        feedbackService.getFeedbacksByProduct(productId),
        teacherService.getTeachers()
      ]);
      setFeedbacks(feedbackData);
      setTeachers(teacherData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFeedbacks = feedbacks.filter(f => f.category === activeTab);

  const rankedTeachers = React.useMemo(() => {
    if (activeTab !== 'teacher_evaluation') return [];

    const grouped = filteredFeedbacks.reduce((acc, curr) => {
      const tId = curr.teacherId || 'unknown';
      if (!acc[tId]) {
        // Tenta hidratar dados do professor se faltarem no feedback
        const matchedTeacher = teachers.find(t => t.id === tId);
        
        acc[tId] = {
          teacherId: tId,
          teacherName: curr.teacherName || matchedTeacher?.name || 'Professor(a) Desconhecido(a)',
          teacherPhotoUrl: curr.teacherPhotoUrl || matchedTeacher?.photoUrl || null,
          feedbacks: [],
          sumRatings: 0,
          totalEvaluations: 0,
        };
      }
      
      // Atualiza foto se encontrarmos uma em feedbacks ou no matchedTeacher
      if (!acc[tId].teacherPhotoUrl) {
        if (curr.teacherPhotoUrl) {
          acc[tId].teacherPhotoUrl = curr.teacherPhotoUrl;
        } else {
          const matchedTeacher = teachers.find(t => t.id === tId);
          if (matchedTeacher?.photoUrl) acc[tId].teacherPhotoUrl = matchedTeacher.photoUrl;
        }
      }

      acc[tId].feedbacks.push(curr);
      acc[tId].sumRatings += (curr.rating || 0);
      acc[tId].totalEvaluations += 1;
      return acc;
    }, {} as Record<string, any>);

    const rankedArray = Object.values(grouped).map(t => ({
      ...t,
      totalScore: t.sumRatings
    }));

    return rankedArray.sort((a, b) => b.totalScore - a.totalScore);
  }, [filteredFeedbacks, activeTab, teachers]);

  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);

  const getRatingColor = (score: number) => {
    if (score > 0) return 'text-emerald-400';
    if (score < 0) return 'text-red-400';
    return 'text-zinc-500';
  };

  const getRatingBg = (score: number) => {
    if (score > 0) return 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400';
    if (score < 0) return 'bg-red-400/10 border-red-400/20 text-red-400';
    return 'bg-zinc-800 border-white/5 text-zinc-500';
  };

  if (loading) return <Loading />;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter flex items-center gap-2">
            <Megaphone className="text-orange-500" size={20} />
            Ouvidoria: {productName}
          </h2>
          <p className="text-zinc-500 text-xs mt-1 uppercase font-bold tracking-widest">{productType.replace('_', ' ')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveTab(cat.id);
              setExpandedTeacherId(null);
            }}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 flex flex-col items-center gap-1 ${
              activeTab === cat.id 
                ? `${cat.color} border-current bg-white/5` 
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            <cat.icon size={18} />
            {cat.label}
            <span className="text-[10px] opacity-60">
              ({feedbacks.filter(f => f.category === cat.id).length})
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
        {activeTab === 'teacher_evaluation' ? (
          <div className="space-y-4">
            {rankedTeachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                <div className="p-4 bg-zinc-800/50 rounded-2xl mb-4">
                  <UserPlus size={32} />
                </div>
                <p className="font-bold uppercase tracking-widest text-sm">Nenhuma avaliação de professor</p>
              </div>
            ) : (
              rankedTeachers.map((teacher, index) => {
                const isExpanded = expandedTeacherId === teacher.teacherId;
                return (
                  <div 
                    key={teacher.teacherId}
                    className="bg-zinc-800/20 border border-zinc-800 rounded-2xl overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => setExpandedTeacherId(isExpanded ? null : teacher.teacherId)}
                      className="w-full p-6 flex flex-wrap items-center justify-between gap-6 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {/* Indicador de Posição (Ranking) */}
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-zinc-500 shrink-0 border border-white/5">
                          {index + 1}º
                        </div>

                        {/* Avatar do Professor (Tamanho Maior) */}
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden bg-zinc-800 border border-white/10 shrink-0 flex items-center justify-center shadow-2xl">
                          {teacher.teacherPhotoUrl ? (
                            <img 
                              src={teacher.teacherPhotoUrl} 
                              alt={teacher.teacherName} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <User className="w-6 h-6 text-zinc-600" />
                          )}
                        </div>

                        {/* Nome e Info */}
                        <div className="text-left">
                          <h3 className="text-white font-bold text-lg tracking-tight uppercase leading-tight">{teacher.teacherName}</h3>
                          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-0.5">
                            Baseado em {teacher.totalEvaluations} avaliações
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 ml-auto">
                        <div className={`px-4 py-2 rounded-xl border flex flex-col items-center min-w-[80px] ${getRatingBg(teacher.totalScore)}`}>
                          <span className={`text-2xl font-black ${getRatingColor(teacher.totalScore)}`}>
                            {teacher.totalScore > 0 ? `+${teacher.totalScore}` : teacher.totalScore}
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">SALDO TOTAL</span>
                        </div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          className="p-2 rounded-full bg-zinc-800/50 border border-white/5"
                        >
                          <ChevronDown className="text-zinc-500" size={18} />
                        </motion.div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 bg-black/20"
                        >
                          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {teacher.feedbacks.map((f: Feedback) => (
                              <div key={f.id} className="bg-zinc-900/50 border border-zinc-800/50 p-4 rounded-xl space-y-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-3">
                                    {f.userProfile.photoUrl ? (
                                      <img src={f.userProfile.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-600">
                                        <User size={14} />
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-white text-xs font-bold leading-none">{f.userProfile.name}</p>
                                      <p className="text-zinc-600 text-[9px] font-bold uppercase mt-1">{new Date(f.createdAt).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                  <div className={`px-2 py-1 rounded-md text-[10px] font-black border ${getRatingBg(f.rating || 0)}`}>
                                    PONTOS: {f.rating && f.rating > 0 ? `+${f.rating}` : f.rating || 0}
                                  </div>
                                </div>
                                <p className="text-zinc-400 text-xs italic leading-relaxed">&quot;{f.message}&quot;</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          filteredFeedbacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
              <div className={`p-4 bg-zinc-800/50 rounded-2xl mb-4`}>
                {(() => {
                  const Icon = CATEGORIES.find(c => c.id === activeTab)?.icon || AlertCircle;
                  return <Icon size={32} />;
                })()}
              </div>
              <p className="font-bold uppercase tracking-widest text-sm">Nenhum feedback nesta categoria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFeedbacks.map((feedback) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={feedback.id}
                  className="bg-zinc-800/30 border border-zinc-800 p-5 rounded-2xl flex flex-col gap-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden border border-white/5">
                        {feedback.userProfile.photoUrl ? (
                          <img src={feedback.userProfile.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500">
                            <User size={20} />
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-sm tracking-tight">{feedback.userProfile.name}</h4>
                        <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                          <Clock size={10} />
                          {new Date(feedback.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-zinc-300 text-sm leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5 whitespace-pre-wrap">
                    {feedback.message}
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
