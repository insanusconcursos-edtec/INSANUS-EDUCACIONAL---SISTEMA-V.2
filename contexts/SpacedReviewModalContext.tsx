
import React, { createContext, useContext, useState, useCallback } from 'react';
import { SpacedReviewConfigModal } from '../components/student/courses/reviews/SpacedReviewConfigModal';
import { courseReviewService } from '../services/courseReviewService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface SpacedReviewModalContextType {
  openSpacedReviewModal: (params: {
    planId?: string;
    courseId?: string;
    disciplineId: string;
    disciplineName: string;
    topicId: string;
    topicName: string;
    isAutoTriggered?: boolean;
    message?: string;
    contextType?: 'plan' | 'course_topic';
    config?: number[];
  }) => void;
}

const SpacedReviewModalContext = createContext<SpacedReviewModalContextType | undefined>(undefined);

export const useSpacedReviewModal = () => {
  const context = useContext(SpacedReviewModalContext);
  if (!context) {
    throw new Error('useSpacedReviewModal must be used within a SpacedReviewModalProvider');
  }
  return context;
};

export const SpacedReviewModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [params, setParams] = useState<{
    planId?: string;
    courseId?: string;
    disciplineId: string;
    disciplineName: string;
    topicId: string;
    topicName: string;
    isAutoTriggered?: boolean;
    message?: string;
    contextType?: 'plan' | 'course_topic';
    config?: number[];
  } | null>(null);

  const openSpacedReviewModal = useCallback((newParams: {
    planId?: string;
    courseId?: string;
    disciplineId: string;
    disciplineName: string;
    topicId: string;
    topicName: string;
    isAutoTriggered?: boolean;
    message?: string;
    contextType?: 'plan' | 'course_topic';
    config?: number[];
  }) => {
    setParams(newParams);
    setIsOpen(true);
  }, []);

  const handleSave = async (intervals: number[], repeatLast: boolean) => {
    if (!params || !currentUser) return;

    try {
      // Se o contexto for curso, garantimos que o courseId seja usado
      const targetCourseId = params.contextType === 'course_topic' ? params.courseId : null;
      const targetPlanId = params.contextType === 'plan' || !params.contextType ? params.planId : undefined;

      await courseReviewService.scheduleReviews(
        currentUser.uid,
        targetCourseId || null,
        params.disciplineId,
        params.disciplineName,
        params.topicId,
        params.topicName,
        intervals,
        repeatLast,
        targetPlanId
      );
      toast.success('Revisões agendadas com sucesso!');
      setIsOpen(false);
    } catch (error) {
      console.error('Erro ao agendar revisões:', error);
      toast.error('Erro ao agendar revisões.');
    }
  };

  return (
    <SpacedReviewModalContext.Provider value={{ openSpacedReviewModal }}>
      {children}
      {isOpen && params && (
        <SpacedReviewConfigModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
          topicName={params.topicName}
          isAutoTriggered={params.isAutoTriggered ?? true}
          customMessage={params.message}
          initialConfig={params.config}
        />
      )}
    </SpacedReviewModalContext.Provider>
  );
};
