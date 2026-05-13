import React from 'react';
import { Calendar, Clock, AlertTriangle, CalendarDays, Sun, Moon, Sunset } from 'lucide-react';
import { Class, ClassShift } from '../../../../../types/class';

interface ClassScheduleFormProps {
  data: Partial<Class>;
  onChange: (updates: Partial<Class>) => void;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
];

const WEEKEND_DAYS = [
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

export const ClassScheduleForm: React.FC<ClassScheduleFormProps> = ({ data, onChange }) => {
  
  const toggleDay = (day: number) => {
    const currentDays = data.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();
    onChange({ daysOfWeek: newDays });
  };

  const updateRegularWeekendConfig = (dayOfWeek: number, shift: ClassShift, checked: boolean, time?: string) => {
    const currentConfigs = data.regularWeekendConfigs || [];
    const dayConfigIndex = currentConfigs.findIndex(c => c.dayOfWeek === dayOfWeek);
    
    let newConfigs = [...currentConfigs];

    if (dayConfigIndex === -1) {
        if (checked) {
            // Add new day config with the shift
            newConfigs.push({
                dayOfWeek,
                shifts: [{ shift, startTime: time || '08:00' }]
            });
        }
    } else {
        const dayConfig = { ...newConfigs[dayConfigIndex] };
        const shiftIndex = dayConfig.shifts.findIndex(s => s.shift === shift);

        if (checked) {
            if (shiftIndex === -1) {
                // Add shift
                dayConfig.shifts = [...dayConfig.shifts, { shift, startTime: time || '08:00' }];
            } else if (time !== undefined) {
                // Update time
                const newShifts = [...dayConfig.shifts];
                newShifts[shiftIndex] = { ...newShifts[shiftIndex], startTime: time };
                dayConfig.shifts = newShifts;
            }
        } else {
            // Remove shift
            if (shiftIndex !== -1) {
                dayConfig.shifts = dayConfig.shifts.filter(s => s.shift !== shift);
            }
        }

        if (dayConfig.shifts.length === 0) {
            newConfigs = newConfigs.filter((_, i) => i !== dayConfigIndex);
        } else {
            newConfigs[dayConfigIndex] = dayConfig;
        }
    }

    onChange({ regularWeekendConfigs: newConfigs });
  };

  const updateWeekendConfig = (dayOfWeek: number, shift: ClassShift, checked: boolean, time?: string) => {
    const currentConfigs = data.weekendConfigs || [];
    const dayConfigIndex = currentConfigs.findIndex(c => c.dayOfWeek === dayOfWeek);
    
    let newConfigs = [...currentConfigs];

    if (dayConfigIndex === -1) {
        if (checked) {
            // Add new day config with the shift
            newConfigs.push({
                dayOfWeek,
                shifts: [{ shift, startTime: time || '08:00' }]
            });
        }
    } else {
        const dayConfig = { ...newConfigs[dayConfigIndex] };
        const shiftIndex = dayConfig.shifts.findIndex(s => s.shift === shift);

        if (checked) {
            if (shiftIndex === -1) {
                // Add shift
                dayConfig.shifts = [...dayConfig.shifts, { shift, startTime: time || '08:00' }];
            } else if (time !== undefined) {
                // Update time
                const newShifts = [...dayConfig.shifts];
                newShifts[shiftIndex] = { ...newShifts[shiftIndex], startTime: time };
                dayConfig.shifts = newShifts;
            }
        } else {
            // Remove shift
            if (shiftIndex !== -1) {
                dayConfig.shifts = dayConfig.shifts.filter(s => s.shift !== shift);
            }
        }

        if (dayConfig.shifts.length === 0) {
            newConfigs = newConfigs.filter((_, i) => i !== dayConfigIndex);
        } else {
            newConfigs[dayConfigIndex] = dayConfig;
        }
    }

    onChange({ weekendConfigs: newConfigs });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800">
        <CalendarDays className="w-5 h-5 text-brand-red" />
        <h3 className="text-lg font-bold text-white uppercase">Cronograma e Prazos</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Turno */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Turno *</label>
          <div className="grid grid-cols-3 gap-2 bg-zinc-800 p-1 rounded-lg border border-zinc-700">
            {[
              { value: 'MORNING', label: 'Manhã', icon: Sun },
              { value: 'AFTERNOON', label: 'Tarde', icon: Sunset },
              { value: 'NIGHT', label: 'Noite', icon: Moon },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ shift: option.value as ClassShift })}
                className={`flex flex-col items-center justify-center py-2 rounded-md text-[10px] font-bold uppercase transition-all ${
                  data.shift === option.value
                    ? 'bg-zinc-600 text-white shadow-lg'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <option.icon className="w-3 h-3 mb-1" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Horário de Início */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Horário de Início *</label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="time"
              value={data.startTime || ''}
              onChange={(e) => onChange({ startTime: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
            />
          </div>
        </div>

        {/* Dias da Semana */}
        <div className="col-span-2">
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Dias de Aula (Semana) *</label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all border ${
                  data.daysOfWeek?.includes(day.value)
                    ? 'bg-brand-red text-white border-brand-red shadow-lg shadow-red-900/20'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Datas Início e Fim */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Data de Início *</label>
          <input
            type="date"
            value={data.startDate || ''}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Término Previsto (Desejado)</label>
          <input
            type="date"
            value={data.endDate || ''}
            onChange={(e) => onChange({ endDate: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
          />
        </div>

        {/* Gatilhos Condicionais de Prazo */}
        <div className="col-span-2 bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
          {data.type === 'POS_EDITAL' ? (
            <div className="animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 mb-2 text-red-500">
                <AlertTriangle className="w-4 h-4" />
                <label className="text-xs font-bold uppercase">Data Limite Inegociável (Hard Deadline) *</label>
              </div>
              <input
                type="date"
                value={data.hardDeadline || ''}
                onChange={(e) => onChange({ hardDeadline: e.target.value })}
                className="w-full bg-red-900/10 border border-red-900/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                required
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Nenhum encontro será agendado automaticamente após esta data.
              </p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Margem de Tolerância de Prazo (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={data.softDeadlineMargin || ''}
                onChange={(e) => onChange({ softDeadlineMargin: Number(e.target.value) })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
                placeholder="Ex: 10%"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Percentual de tempo extra tolerado além da data de término prevista.
              </p>
            </div>
          )}
        </div>

        {/* Configuração de Finais de Semana (REGULAR) */}
        <div className="col-span-2 space-y-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-white uppercase">
                Aulas Regulares aos Finais de Semana
              </label>
            </div>
          </div>

          <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-700/50 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WEEKEND_DAYS.map((day) => {
                  const dayConfig = data.regularWeekendConfigs?.find(c => c.dayOfWeek === day.value);
                  
                  return (
                      <div key={day.value} className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                          <h4 className="text-sm font-bold text-white uppercase mb-3">{day.label}</h4>
                          <div className="space-y-3">
                              {[
                                  { value: 'MORNING', label: 'Manhã' },
                                  { value: 'AFTERNOON', label: 'Tarde' },
                                  { value: 'NIGHT', label: 'Noite' },
                              ].map((shiftOption) => {
                                  const shift = shiftOption.value as ClassShift;
                                  const shiftConfig = dayConfig?.shifts.find(s => s.shift === shift);
                                  const isChecked = !!shiftConfig;

                                  return (
                                      <div key={shift} className="flex flex-col gap-2">
                                          <div className="flex items-center gap-2">
                                              <input
                                                  type="checkbox"
                                                  id={`regular-weekend-${day.value}-${shift}`}
                                                  checked={isChecked}
                                                  onChange={(e) => updateRegularWeekendConfig(day.value, shift, e.target.checked)}
                                                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-brand-red focus:ring-brand-red"
                                              />
                                              <label htmlFor={`regular-weekend-${day.value}-${shift}`} className="text-xs font-medium text-zinc-300 cursor-pointer select-none">
                                                  {shiftOption.label}
                                              </label>
                                          </div>
                                          
                                          {isChecked && (
                                              <div className="ml-6 animate-in fade-in slide-in-from-top-1">
                                                  <input
                                                      type="time"
                                                      value={shiftConfig?.startTime || ''}
                                                      onChange={(e) => updateRegularWeekendConfig(day.value, shift, true, e.target.value)}
                                                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-brand-red"
                                                  />
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })}
            </div>
          </div>
        </div>

        {/* Configuração de Finais de Semana (Reserva) */}
        <div className="col-span-2 space-y-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allowWeekend"
                checked={data.allowWeekend || false}
                onChange={(e) => onChange({ allowWeekend: e.target.checked, weekendConfigs: e.target.checked ? data.weekendConfigs : [] })}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-brand-red focus:ring-brand-red"
              />
              <label htmlFor="allowWeekend" className="text-sm font-medium text-white cursor-pointer select-none">
                Permitir aulas aos Finais de Semana (Reserva)?
              </label>
            </div>
          </div>

          {data.allowWeekend && (
            <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-700/50 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {WEEKEND_DAYS.map((day) => {
                    const dayConfig = data.weekendConfigs?.find(c => c.dayOfWeek === day.value);
                    
                    return (
                        <div key={day.value} className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                            <h4 className="text-sm font-bold text-white uppercase mb-3">{day.label}</h4>
                            <div className="space-y-3">
                                {[
                                    { value: 'MORNING', label: 'Manhã' },
                                    { value: 'AFTERNOON', label: 'Tarde' },
                                    { value: 'NIGHT', label: 'Noite' },
                                ].map((shiftOption) => {
                                    const shift = shiftOption.value as ClassShift;
                                    const shiftConfig = dayConfig?.shifts.find(s => s.shift === shift);
                                    const isChecked = !!shiftConfig;

                                    // Check if this slot is already taken by Regular Schedule
                                    const isRegularlyScheduled = data.regularWeekendConfigs?.some(
                                        c => c.dayOfWeek === day.value && c.shifts.some(s => s.shift === shift)
                                    );

                                    return (
                                        <div key={shift} className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`weekend-${day.value}-${shift}`}
                                                    checked={isChecked}
                                                    disabled={isRegularlyScheduled}
                                                    onChange={(e) => updateWeekendConfig(day.value, shift, e.target.checked)}
                                                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-brand-red focus:ring-brand-red disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                                <label 
                                                    htmlFor={`weekend-${day.value}-${shift}`} 
                                                    className={`text-xs font-medium cursor-pointer select-none ${isRegularlyScheduled ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}
                                                >
                                                    {shiftOption.label} {isRegularlyScheduled && '(Regular)'}
                                                </label>
                                            </div>
                                            
                                            {isChecked && (
                                                <div className="ml-6 animate-in fade-in slide-in-from-top-1">
                                                    <input
                                                        type="time"
                                                        value={shiftConfig?.startTime || ''}
                                                        onChange={(e) => updateWeekendConfig(day.value, shift, true, e.target.value)}
                                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-brand-red"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Feriados */}
        <div className="col-span-2 pt-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="holidaysOff"
              checked={data.holidaysOff || false}
              onChange={(e) => onChange({ holidaysOff: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-brand-red focus:ring-brand-red"
            />
            <label htmlFor="holidaysOff" className="text-sm font-medium text-zinc-300 cursor-pointer select-none">
              Dar folga nos Feriados Vermelhos?
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
