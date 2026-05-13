import React, { useEffect, useState } from 'react';
import { Clock, Calculator, AlertCircle, CalendarClock } from 'lucide-react';
import { Class } from '../../../../../types/class';
import { useClassCalculations } from '../../../../../hooks/useClassCalculations';

interface ClassStructureFormProps {
  data: Partial<Class>;
  onChange: (updates: Partial<Class>) => void;
  breakCount: number;
  setBreakCount: (count: number) => void;
}

export const ClassStructureForm: React.FC<ClassStructureFormProps> = ({ data, onChange, breakCount, setBreakCount }) => {
  const { calculateNetClassTime } = useClassCalculations();
  const [netTime, setNetTime] = useState(0);

  useEffect(() => {
    const time = calculateNetClassTime(
      data.meetingDuration || 0,
      data.hasBreak ? breakCount : 0,
      data.breakDuration || 0,
      data.classesPerMeeting || 1
    );
    setNetTime(time);
  }, [data.meetingDuration, data.hasBreak, breakCount, data.breakDuration, data.classesPerMeeting]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800">
        <Clock className="w-5 h-5 text-brand-red" />
        <h3 className="text-lg font-bold text-white uppercase">Estrutura do Encontro</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quantidade de Encontros */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Total de Encontros *</label>
          <div className="relative">
            <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="number"
              min="1"
              value={data.totalMeetings || ''}
              onChange={(e) => onChange({ totalMeetings: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
              placeholder="Ex: 60"
            />
          </div>
        </div>

        {/* Duração do Encontro */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Duração do Encontro (Horas) *</label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="number"
              min="1"
              step="0.5"
              value={data.meetingDuration || ''}
              onChange={(e) => onChange({ meetingDuration: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
              placeholder="Ex: 3 ou 3.5"
            />
          </div>
        </div>

        {/* Aulas por Encontro */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Aulas por Encontro *</label>
          <input
            type="number"
            min="1"
            value={data.classesPerMeeting || ''}
            onChange={(e) => onChange({ classesPerMeeting: Number(e.target.value) })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
            placeholder="Ex: 2"
          />
        </div>

        {/* Configuração de Intervalo */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hasBreak"
              checked={data.hasBreak || false}
              onChange={(e) => onChange({ hasBreak: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-brand-red focus:ring-brand-red"
            />
            <label htmlFor="hasBreak" className="text-sm font-medium text-zinc-300 cursor-pointer select-none">
              Possui Intervalo?
            </label>
          </div>

          {data.hasBreak && (
            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Qtd.</label>
                <input
                  type="number"
                  min="1"
                  value={breakCount}
                  onChange={(e) => setBreakCount(Number(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-red"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Minutos</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={data.breakDuration || ''}
                  onChange={(e) => onChange({ breakDuration: Number(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-red"
                />
              </div>
            </div>
          )}
        </div>

        {/* Card de Cálculo Matemático (Read-Only) */}
        <div className="col-span-1 md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-brand-red" />
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Cálculo Matemático Automático</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-3 border border-zinc-800">
              <span className="block text-[10px] text-zinc-500 uppercase font-bold mb-1">Tempo Total Bruto</span>
              <span className="text-lg font-mono text-zinc-300">
                {(data.meetingDuration || 0) * 60} <span className="text-xs text-zinc-600">min</span>
              </span>
            </div>
            
            <div className="bg-brand-red/10 rounded-lg p-3 border border-brand-red/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-1 bg-brand-red/20 rounded-bl-lg">
                <AlertCircle className="w-3 h-3 text-brand-red" />
              </div>
              <span className="block text-[10px] text-brand-red/80 uppercase font-bold mb-1">Tempo Líquido por Aula</span>
              <span className="text-2xl font-black text-white font-mono tracking-tight">
                {netTime} <span className="text-sm font-bold text-brand-red">min</span>
              </span>
            </div>
          </div>
          
          <p className="text-[10px] text-zinc-600 mt-3 italic">
            * O tempo de intervalo é adicionado ao final do encontro.
            <br/>
            Fórmula: (Duração × 60) ÷ Qtd. Aulas
          </p>
        </div>
      </div>
    </div>
  );
};
