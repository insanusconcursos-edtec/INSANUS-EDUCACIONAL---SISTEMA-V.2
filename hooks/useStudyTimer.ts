
import { useState, useEffect, useRef, useCallback } from 'react';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export const useStudyTimer = () => {
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === 'running') {
      intervalRef.current = window.setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status]);

  const start = useCallback(() => {
    setStatus('running');
  }, []);

  const pause = useCallback(() => {
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    setStatus('running');
  }, []);

  const finish = useCallback(() => {
    setStatus('completed');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return seconds; // Retorna o tempo total para uso no callback
  }, [seconds]);

  const reset = useCallback(() => {
    setStatus('idle');
    setSeconds(0);
  }, []);

  // Helper de Formatação (HH:MM:SS)
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    }
    return `${pad(minutes)}:${pad(secs)}`;
  };

  return {
    status,
    seconds,
    formattedTime: formatTime(seconds),
    start,
    pause,
    resume,
    finish,
    reset
  };
};
