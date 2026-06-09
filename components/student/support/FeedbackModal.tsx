import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Lightbulb, 
  Heart, 
  AlertCircle, 
  UserPlus, 
  X, 
  Loader2, 
  Send,
  ChevronDown,
  User,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { feedbackService } from '../../../services/feedbackService';
import { curriculumService } from '../../../services/curriculumService';
import { teacherService } from '../../../services/teacherService';
import { courseService } from '../../../services/courseService';
import { useAuth } from '../../../contexts/AuthContext';
import { Teacher } from '../../../types/teacher';
import { FeedbackCategory } from '../../../types/feedback';
import toast from 'react-hot-toast';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  productInfo: {
    id: string;
    name: string;
    type: 'plano' | 'curso_online' | 'turma_presencial' | 'simulado' | 'evento_ao_vivo';
  };
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ 
  isOpen, 
  onClose, 
  productInfo 
}) => {
  const { currentUser: user, userData: userProfile } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (isOpen && (productInfo.type === 'turma_presencial' || productInfo.type === 'curso_online') && productInfo.id) {
      loadTeachers();
    }
  }, [isOpen, productInfo.type, productInfo.id]);

  const loadTeachers = async () => {
    setLoadingTeachers(true);
    try {
      if (productInfo.type === 'turma_presencial') {
        const [subjects, topics, allTeachers] = await Promise.all([
          curriculumService.getSubjectsByClass(productInfo.id),
          curriculumService.getTopicsByClass(productInfo.id),
          teacherService.getTeachers()
        ]);

        const instructorIds = new Set<string>();
        subjects.forEach(s => { 
          if (s.defaultTeacherId) instructorIds.add(s.defaultTeacherId); 
        });
        topics.forEach(t => { 
          if (t.teacherId) instructorIds.add(t.teacherId); 
        });

        const filteredTeachers = allTeachers.filter(t => instructorIds.has(t.id));
        setTeachers(filteredTeachers);
      } else if (productInfo.type === 'curso_online') {
        // Para cursos online, buscamos os IDs de professores vinculados diretamente no curso
        const [allTeachers, allCourses] = await Promise.all([
          teacherService.getTeachers(),
          courseService.getCourses()
        ]);
        
        const currentCourse = allCourses.find(c => c.id === productInfo.id);
        const linkedTeacherIds = currentCourse?.teacherIds || [];
        
        const filteredTeachers = allTeachers.filter(t => linkedTeacherIds.includes(t.id));
        setTeachers(filteredTeachers);
      }
    } catch (error) {
      console.error('Error loading teachers:', error);
    } finally {
      setLoadingTeachers(false);
    }
  };

  const handleCategorySelect = (cat: FeedbackCategory) => {
    setCategory(cat);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Você precisa estar logado para enviar um feedback.');
      return;
    }

    if (!category) return;
    if (!message.trim()) {
      toast.error('Por favor, escreva sua mensagem.');
      return;
    }

    if (category === 'teacher_evaluation') {
      if (!teacherId) {
        toast.error('Por favor, selecione um professor.');
        return;
      }
      if (rating === null) {
        toast.error('Por favor, atribua uma nota.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const feedbackPayload: any = {
        userId: user.uid,
        userProfile: {
          name: userProfile?.name || user.displayName || 'Aluno',
          email: userProfile?.email || user.email || '',
          photoUrl: userProfile?.photoUrl || user.photoURL || ''
        },
        productType: productInfo.type,
        productId: productInfo.id,
        productName: productInfo.name,
        category,
        message,
      };

      if (category === 'teacher_evaluation') {
        const selectedTeacher = teachers.find(t => t.id === teacherId);
        feedbackPayload.teacherId = teacherId;
        feedbackPayload.teacherName = selectedTeacher?.name;
        feedbackPayload.teacherPhotoUrl = selectedTeacher?.photoUrl || null;
        feedbackPayload.rating = rating;
      }
      
      await feedbackService.submitFeedback(feedbackPayload);

      toast.success('Feedback enviado com sucesso! Obrigado por sua contribuição.');
      onClose();
      // Reset state
      setStep(1);
      setCategory(null);
      setMessage('');
      setRating(null);
      setTeacherId('');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Erro ao enviar feedback. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#1A1A1A] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500">
              <Megaphone size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">Deixe seu Feedback</h2>
              <p className="text-xs text-gray-400 mt-0.5">{productInfo.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-2 gap-4"
              >
                <button 
                  onClick={() => handleCategorySelect('idea')}
                  className="flex flex-col items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                    <Lightbulb size={24} />
                  </div>
                  <span className="text-sm font-medium text-white">Ideia / Melhoria</span>
                </button>

                <button 
                  onClick={() => handleCategorySelect('compliment')}
                  className="flex flex-col items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                    <Heart size={24} />
                  </div>
                  <span className="text-sm font-medium text-white">Elogio</span>
                </button>

                <button 
                  onClick={() => handleCategorySelect('complaint')}
                  className="flex flex-col items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                    <AlertCircle size={24} />
                  </div>
                  <span className="text-sm font-medium text-white">Reclamação</span>
                </button>

                {(productInfo.type === 'turma_presencial' || productInfo.type === 'curso_online') && (
                  <button 
                    onClick={() => handleCategorySelect('teacher_evaluation')}
                    className="flex flex-col items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                      <UserPlus size={24} />
                    </div>
                    <span className="text-sm font-medium text-white">Avaliar Professor</span>
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Back Button */}
                <button 
                  onClick={() => setStep(1)}
                  className="text-sm text-orange-500 hover:underline flex items-center gap-1"
                >
                  ← Voltar para categorias
                </button>

                {category === 'teacher_evaluation' && (
                  <>
                    <div className="space-y-2 relative">
                      <label className="text-sm text-gray-400">Selecione o Professor</label>
                      
                      {/* Custom Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          disabled={loadingTeachers}
                          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-left flex items-center justify-between hover:bg-zinc-800/80 transition-all focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                        >
                          {loadingTeachers ? (
                            <div className="flex items-center gap-2 text-zinc-500">
                              <Loader2 size={16} className="animate-spin" />
                              <span className="text-sm">Carregando professores...</span>
                            </div>
                          ) : teacherId ? (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden border border-white/5">
                                {teachers.find(t => t.id === teacherId)?.photoUrl ? (
                                  <img 
                                    src={teachers.find(t => t.id === teacherId)?.photoUrl} 
                                    alt="" 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500">
                                    <User size={16} />
                                  </div>
                                )}
                              </div>
                              <span className="text-sm font-medium text-gray-200">
                                {teachers.find(t => t.id === teacherId)?.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Selecione um professor...</span>
                          )}
                          {!loadingTeachers && <ChevronDown size={18} className={`text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />}
                        </button>

                        <AnimatePresence>
                          {isDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute z-[60] w-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto no-scrollbar scroll-smooth"
                            >
                              {teachers.length === 0 ? (
                                <div className="p-8 text-center flex flex-col items-center gap-2">
                                  <AlertCircle className="text-zinc-700" size={24} />
                                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest leading-tight">
                                    Nenhum professor<br />vinculado a esta turma
                                  </span>
                                </div>
                              ) : (
                                teachers.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      setTeacherId(t.id);
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`w-full p-3 flex items-center justify-between hover:bg-zinc-800 transition-colors border-b border-white/5 last:border-0 ${teacherId === t.id ? 'bg-orange-500/10' : ''}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-full bg-zinc-800 overflow-hidden border border-white/5 shadow-inner">
                                        {t.photoUrl ? (
                                          <img src={t.photoUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500">
                                            <User size={18} />
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-sm font-medium text-gray-200">{t.name}</span>
                                    </div>
                                    {teacherId === t.id && <Check size={16} className="text-orange-500" />}
                                  </button>
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {/* Overlay to close dropdown when clicking outside */}
                        {isDropdownOpen && (
                          <div 
                            className="fixed inset-0 z-[55] cursor-default" 
                            onClick={() => setIsDropdownOpen(false)}
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center mr-1">
                        <label className="text-sm text-gray-400">Atribua sua pontuação</label>
                        <span className={`text-base font-black px-2 py-0.5 rounded-lg border ${
                          rating > 0 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 
                          rating < 0 ? 'text-red-500 bg-red-500/10 border-red-500/20' : 
                          'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'
                        }`}>
                          {rating > 0 ? `+${rating}` : rating}
                        </span>
                      </div>
                      
                      <div className="flex flex-nowrap gap-1 md:gap-2 justify-between w-full">
                        {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setRating(val)}
                            className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-xs md:text-sm font-black transition-all border shrink-0 ${
                              rating === val
                                ? val > 0 ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' :
                                  val < 0 ? 'bg-red-500 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' :
                                  'bg-zinc-500 border-zinc-400 text-white'
                                : val > 0 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20' :
                                  val < 0 ? 'bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/20' :
                                  'bg-zinc-800 border-white/5 text-zinc-500 hover:bg-zinc-700'
                            }`}
                          >
                            {val > 0 ? `+${val}` : val}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between w-full mt-2 text-[10px] text-gray-500 uppercase tracking-wider px-1">
                        <span className="font-bold text-red-700/80">Muito Insatisfeito</span>
                        <span className="font-bold">Neutro</span>
                        <span className="font-bold text-emerald-700/80">Muito Satisfeito</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Sua mensagem</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Conte-nos mais detalhes..."
                    rows={5}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all resize-none"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Enviar Feedback
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
