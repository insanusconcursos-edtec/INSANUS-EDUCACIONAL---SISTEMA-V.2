
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { StudentGoal } from '../components/student/StudentGoalCard';
import { registerStudySession, updateGoalRecordedTime, toggleGoalStatus } from '../services/studentService';
import { getLocalISODate } from '../services/scheduleService';
import { useAuth } from './AuthContext';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

interface StudyContextType {
  activeGoal: StudentGoal | null;
  status: TimerStatus;
  seconds: number;
  formattedTime: string;
  startGoal: (goal: StudentGoal) => void;
  pause: () => void;
  resume: () => void;
  finish: () => Promise<number>;
  reset: () => void;
  isFloating: boolean;
  setIsFloating: (value: boolean) => void;
  isMaterialActive: boolean;
  setIsMaterialActive: (value: boolean) => void;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [activeGoal, setActiveGoal] = useState<StudentGoal | null>(null);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [isFloating, setIsFloating] = useState(false);
  const [isMaterialActive, setIsMaterialActive] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const lastSavedSeconds = useRef(0);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (num: number) => num.toString().padStart(2, '0');

    if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    return `${pad(minutes)}:${pad(secs)}`;
  };

  useEffect(() => {
    if (status === 'running') {
      intervalRef.current = window.setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status]);

  const saveSessionTime = useCallback(async (currentSeconds: number) => {
    if (!currentUser || !activeGoal || !activeGoal.planId) return;
    
    const deltaSeconds = currentSeconds - lastSavedSeconds.current;
    if (deltaSeconds > 5) {
      const minutes = deltaSeconds / 60;
      await registerStudySession(currentUser.uid, activeGoal.planId, minutes, activeGoal.type);
      const targetDate = activeGoal.date || getLocalISODate(new Date());
      await updateGoalRecordedTime(currentUser.uid, targetDate, activeGoal.id, minutes);
      lastSavedSeconds.current = currentSeconds;
    }
  }, [currentUser, activeGoal]);

  // Save periodically every 5 minutes if running
  useEffect(() => {
    if (status === 'running' && seconds > 0 && seconds % 300 === 0) {
      saveSessionTime(seconds);
    }
  }, [seconds, status, saveSessionTime]);

  const startGoal = useCallback((goal: StudentGoal) => {
    // If there's an active goal, we should probably save its time first
    if (activeGoal && status !== 'idle') {
       saveSessionTime(seconds);
    }
    setActiveGoal(goal);
    setStatus('running');
    setSeconds(0);
    lastSavedSeconds.current = 0;
    setIsFloating(true);
  }, [activeGoal, status, seconds, saveSessionTime]);

  const pause = useCallback(async () => {
    setStatus('paused');
    await saveSessionTime(seconds);
  }, [seconds, saveSessionTime]);

  const resume = useCallback(() => {
    setStatus('running');
    setIsFloating(true);
  }, []);

  const reset = useCallback(() => {
    setActiveGoal(null);
    setStatus('idle');
    setSeconds(0);
    lastSavedSeconds.current = 0;
    setIsFloating(false);
    setIsMaterialActive(false);
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    }
  }, []);

  const finish = useCallback(async () => {
    if (!currentUser || !activeGoal || !activeGoal.planId) return 0;
    
    const finalSeconds = seconds;
    const goalId = activeGoal.id;
    const planId = activeGoal.planId;
    
    setStatus('completed');
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // 1. Salva o tempo acumulado da sessão no banco (recordedTime)
    await saveSessionTime(finalSeconds);
    
    // 2. Persistência de Conclusão Real (Database Sync)
    // Garantimos que a meta mude de status em todas as coleções (Schedule e Edital Progress)
    try {
      await toggleGoalStatus(
        currentUser.uid,
        planId,
        goalId,
        'pending', // Status de origem
        true, // isManual (conclusão direta pelo botão)
        'completed' // Target Status (Garante conclusão)
      );

      // Despacha um evento global para que outros componentes (Header, Dashboard) 
      // saibam que precisam atualizar seus contadores e estados locais.
      window.dispatchEvent(new CustomEvent('study-goal-finished', { 
        detail: { goalId, planId, status: 'completed' } 
      }));

    } catch (error) {
      console.error("[StudyContext] Erro ao persistir conclusão:", error);
    } finally {
      // Limpa os estados de meta ativa para garantir um fechamento de relógio limpo.
      reset();
    }

    return finalSeconds;
  }, [seconds, saveSessionTime, currentUser, activeGoal, reset]);

  // Monitor Auth State: Reset absolutely on logout
  useEffect(() => {
    if (!currentUser) {
      reset();
    }
  }, [currentUser, reset]);

  return (
    <StudyContext.Provider value={{
      activeGoal,
      status,
      seconds,
      formattedTime: formatTime(seconds),
      startGoal,
      pause,
      resume,
      finish,
      reset,
      isFloating,
      setIsFloating,
      isMaterialActive,
      setIsMaterialActive
    }}>
      {children}
    </StudyContext.Provider>
  );
};

export const useStudyContext = () => {
  const context = useContext(StudyContext);
  if (context === undefined) {
    throw new Error('useStudyContext must be used within a StudyProvider');
  }
  return context;
};
