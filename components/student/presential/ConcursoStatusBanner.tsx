import React, { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { Class } from '../../../types/class';

export const ConcursoStatusBanner = ({ classData }: { classData: Class }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number } | null>(null);

  const status = classData?.concursoStatus || 'SEM_PREVISAO';
  
  const statusLabels: Record<string, string> = {
    SEM_PREVISAO: 'Sem Previsão',
    COMISSAO_FORMADA: 'Comissão Formada',
    AUTORIZADO: 'Autorizado',
    BANCA_CONTRATADA: 'Banca Contratada',
    EDITAL_ABERTO: 'Edital Aberto',
    CONCURSO_SUSPENSO: 'Concurso Suspenso',
  };

  useEffect(() => {
    if (status !== 'EDITAL_ABERTO' || !classData?.examDate) return;

    const calculateTime = () => {
      const examDateStr = classData.examDate.includes('T') ? classData.examDate : `${classData.examDate}T00:00:00`;
      const difference = new Date(examDateStr).getTime() - new Date().getTime();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60)
        });
      } else {
        setTimeLeft(null);
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 60000);
    return () => clearInterval(timer);
  }, [status, classData?.examDate]);

  if (status === 'SEM_PREVISAO') return null;

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Badge de Status */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-bold text-xs uppercase shrink-0">
        <CheckCircle2 size={16} className="text-green-500" />
        <span className="text-gray-300">
          {statusLabels[status]}
          {status === 'BANCA_CONTRATADA' && classData.bancaName && (
            <span className="text-white ml-1">: {classData.bancaName}</span>
          )}
        </span>
      </div>

      {/* Info de Prova e Countdown se Edital Aberto */}
      {status === 'EDITAL_ABERTO' && classData.examDate && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-bold text-xs uppercase shrink-0">
            <Calendar size={16} className="text-red-500" />
            <span className="text-gray-300">
              Prova: <span className="text-white ml-1">{new Date(classData.examDate + 'T00:00:00').toLocaleDateString('pt-BR')} {classData.examShift && `(${classData.examShift})`}</span>
            </span>
          </div>

          {timeLeft && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-950/20 border border-red-900/30 rounded-lg text-white font-bold text-xs uppercase shrink-0">
              <Clock size={16} className="text-red-500 animate-pulse" />
              <div className="flex items-center gap-1 font-mono">
                <span className="text-red-500">{timeLeft.days}D</span>
                <span className="text-zinc-500">:</span>
                <span>{timeLeft.hours}H</span>
                <span className="text-zinc-500">:</span>
                <span>{timeLeft.minutes}M</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
