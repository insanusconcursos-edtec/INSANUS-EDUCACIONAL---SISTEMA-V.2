import React from 'react';
import { DollarSign } from 'lucide-react';
import { Teacher } from '../../../../../types/teacher';

interface FinancialFormProps {
  data: Partial<Teacher>;
  onChange: (data: Partial<Teacher>) => void;
}

export const FinancialForm: React.FC<FinancialFormProps> = ({ data, onChange }) => {
  const showConcurso = data.areas?.includes('CONCURSO');
  const showEnem = data.areas?.includes('ENEM');

  if (!showConcurso && !showEnem) {
    return (
      <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl">
        <p className="text-zinc-500">Selecione as Áreas de Atuação na etapa anterior para configurar os valores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white mb-4">Dados Financeiros</h3>
      <p className="text-sm text-zinc-400 mb-6">
        Defina o valor base da hora/aula para cada área de atuação. Este valor será utilizado para calcular a remuneração das turmas.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {showConcurso && (
          <div className="space-y-2 animate-in fade-in slide-in-from-left-4">
            <label className="block text-xs font-bold text-zinc-400 uppercase">Valor Hora/Aula (Concurso)</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-zinc-500 font-bold group-focus-within:text-brand-red transition-colors">R$</span>
              </div>
              <input
                type="number"
                step="0.01"
                value={data.baseHourlyRateConcurso || ''}
                onChange={(e) => onChange({ ...data, baseHourlyRateConcurso: Number(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-12 pr-4 py-4 text-white font-mono text-lg placeholder-zinc-700 focus:outline-none focus:border-brand-red transition-colors"
                placeholder="0.00"
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <DollarSign className="w-4 h-4 text-zinc-600" />
              </div>
            </div>
          </div>
        )}

        {showEnem && (
          <div className="space-y-2 animate-in fade-in slide-in-from-right-4">
            <label className="block text-xs font-bold text-zinc-400 uppercase">Valor Hora/Aula (ENEM)</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-zinc-500 font-bold group-focus-within:text-brand-red transition-colors">R$</span>
              </div>
              <input
                type="number"
                step="0.01"
                value={data.baseHourlyRateEnem || ''}
                onChange={(e) => onChange({ ...data, baseHourlyRateEnem: Number(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-12 pr-4 py-4 text-white font-mono text-lg placeholder-zinc-700 focus:outline-none focus:border-brand-red transition-colors"
                placeholder="0.00"
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <DollarSign className="w-4 h-4 text-zinc-600" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
