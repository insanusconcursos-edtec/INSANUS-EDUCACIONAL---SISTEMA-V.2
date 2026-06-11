
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { StudentGoal } from '../components/student/StudentGoalCard';
import { registerStudySession, updateGoalRecordedTime, toggleGoalStatus, updateActiveTimer } from '../services/studentService';
import { getLocalISODate } from '../services/scheduleService';
import { useAuth } from './AuthContext';
import { ProductType } from '../types/support';

export interface ProductInfo {
  type: ProductType;
  id: string;
  name: string;
}

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
  reset: () => Promise<void>;
  isFloating: boolean;
  setIsFloating: (value: boolean) => void;
  isMaterialActive: boolean;
  setIsMaterialActive: (value: boolean) => void;
  currentProduct: ProductInfo | null;
  setCurrentProduct: (product: ProductInfo | null) => void;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userData, refreshUserData } = useAuth();
  const [activeGoal, setActiveGoal] = useState<StudentGoal | null>(null);
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0);
  const [isFloating, setIsFloating] = useState(false);
  const [isMaterialActive, setIsMaterialActive] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<ProductInfo | null>(null);
  const lastSavedSeconds = useRef(0);
  const isResettingRef = useRef(false);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (num: number) => num.toString().padStart(2, '0');

    if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    return `${pad(minutes)}:${pad(secs)}`;
  };

  // Restaurar cronômetro persistente do Firestore ao carregar
  useEffect(() => {
    if (userData?.activeTimer && status === 'idle' && !isResettingRef.current) {
      const { goal, startTime: remoteStart, accumulatedSeconds: remoteAccumulated, status: remoteStatus } = userData.activeTimer;
      setActiveGoal(goal);
      setStartTime(remoteStart);
      setAccumulatedSeconds(remoteAccumulated);
      setStatus(remoteStatus);
      
      if (remoteStatus === 'running' || remoteStatus === 'paused') {
        setIsFloating(true);
      }
    }
  }, [userData, status]);

  // Lógica de cronômetro imune a throttling (Uso de Timestamp Absoluto)
  useEffect(() => {
    let interval: any;

    if (status === 'running' && startTime) {
      // Cálculo inicial imediato para evitar pulo de 1s
      const initialDiff = Math.floor((Date.now() - startTime) / 1000);
      setSeconds(accumulatedSeconds + initialDiff);

      interval = setInterval(() => {
        const now = Date.now();
        const diffInSeconds = Math.floor((now - startTime) / 1000);
        setSeconds(accumulatedSeconds + diffInSeconds);
      }, 1000);
    } else {
      setSeconds(accumulatedSeconds);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, startTime, accumulatedSeconds]);

  // Recalcular ao ganhar foco ou trocar visibilidade
  useEffect(() => {
    const handleSync = () => {
      if (document.visibilityState === 'visible' && status === 'running' && startTime) {
        const now = Date.now();
        const diffInSeconds = Math.floor((now - startTime) / 1000);
        setSeconds(accumulatedSeconds + diffInSeconds);
      }
    };

    window.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [status, startTime, accumulatedSeconds]);

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
    const now = Date.now();
    setActiveGoal(goal);
    setStatus('running');
    setStartTime(now);
    setAccumulatedSeconds(0);
    setSeconds(0);
    lastSavedSeconds.current = 0;
    setIsFloating(true);

    if (currentUser) {
      updateActiveTimer(currentUser.uid, {
        goal,
        startTime: now,
        accumulatedSeconds: 0,
        status: 'running'
      });
    }
  }, [activeGoal, status, seconds, saveSessionTime, currentUser]);

  const pause = useCallback(async () => {
    const now = Date.now();
    const diffInSeconds = startTime ? Math.floor((now - startTime) / 1000) : 0;
    const newAccumulated = accumulatedSeconds + diffInSeconds;
    
    setStatus('paused');
    setStartTime(null);
    setAccumulatedSeconds(newAccumulated);
    setSeconds(newAccumulated);
    
    await saveSessionTime(newAccumulated);

    if (currentUser) {
      updateActiveTimer(currentUser.uid, {
        goal: activeGoal,
        startTime: null,
        accumulatedSeconds: newAccumulated,
        status: 'paused'
      });
    }
  }, [startTime, accumulatedSeconds, saveSessionTime, currentUser, activeGoal]);

  const resume = useCallback(() => {
    const now = Date.now();
    setStatus('running');
    setStartTime(now);
    setIsFloating(true);

    if (currentUser) {
      updateActiveTimer(currentUser.uid, {
        goal: activeGoal,
        startTime: now,
        accumulatedSeconds: accumulatedSeconds,
        status: 'running'
      });
    }
  }, [currentUser, activeGoal, accumulatedSeconds]);

  const reset = useCallback(async () => {
    isResettingRef.current = true;
    setActiveGoal(null);
    setStatus('idle');
    setSeconds(0);
    setStartTime(null);
    setAccumulatedSeconds(0);
    lastSavedSeconds.current = 0;
    setIsFloating(false);
    setIsMaterialActive(false);

    if (currentUser) {
      try {
        await updateActiveTimer(currentUser.uid, null);
        if (refreshUserData) await refreshUserData();
      } catch (error) {
        console.error("[StudyContext] Error clearing active timer:", error);
      }
    }
    
    // Pequeno delay para garantir que o ciclo de renderização reconheça o userData atualizado 
    // antes de permitir novas restaurações automáticas.
    setTimeout(() => {
      isResettingRef.current = false;
    }, 1000);
  }, [currentUser, refreshUserData]);

  const finish = useCallback(async () => {
    if (!currentUser || !activeGoal || !activeGoal.planId) return 0;
    
    const now = Date.now();
    const diffInSeconds = startTime ? Math.floor((now - startTime) / 1000) : 0;
    const finalSeconds = accumulatedSeconds + diffInSeconds;
    const goalId = activeGoal.id;
    const planId = activeGoal.planId;
    
    setStatus('completed');
    
    // 1. Salva o tempo acumulado da sessão no banco (recordedTime)
    try {
      await saveSessionTime(finalSeconds);
    } catch (e) {
      console.error("Error saving session time:", e);
    }
    
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
      await reset();
    }

    return finalSeconds;
  }, [startTime, accumulatedSeconds, saveSessionTime, currentUser, activeGoal, reset]);

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
      setIsMaterialActive,
      currentProduct,
      setCurrentProduct
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
