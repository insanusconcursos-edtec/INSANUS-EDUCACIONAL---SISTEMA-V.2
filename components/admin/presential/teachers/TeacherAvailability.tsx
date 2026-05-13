import React from 'react';
import { Check, Info } from 'lucide-react';
import { Teacher, DayOfWeek, Shift, TeacherArea, TeacherSchedulePreference } from '../../../../types/teacher';

interface TeacherAvailabilityProps {
  data: Partial<Teacher>;
  onChange: (data: Partial<Teacher>) => void;
}

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Segunda' },
  { value: 'TUESDAY', label: 'Terça' },
  { value: 'WEDNESDAY', label: 'Quarta' },
  { value: 'THURSDAY', label: 'Quinta' },
  { value: 'FRIDAY', label: 'Sexta' },
];

const SHIFTS: { value: Shift; label: string }[] = [
  { value: 'MORNING', label: 'Manhã' },
  { value: 'AFTERNOON', label: 'Tarde' },
  { value: 'NIGHT', label: 'Noite' },
];

export const TeacherAvailability: React.FC<TeacherAvailabilityProps> = ({ data, onChange }) => {
  const preferences = data.schedulePreferences || [];
  const areas = data.areas || [];

  const handlePreferenceToggle = (day: DayOfWeek, shift: Shift, area: TeacherArea) => {
    // Check if already selected
    const existingIndex = preferences.findIndex(
      p => p.day === day && p.shift === shift && p.area === area
    );

    const newPreferences = [...preferences];

    if (existingIndex >= 0) {
      // Remove if exists
      newPreferences.splice(existingIndex, 1);
    } else {
      // Add new preference
      // Check limit: Max 3 preferences total? Or just collect them all and rank later?
      // PRD says: "Escolher três horários em ordem hierárquica de preferência."
      // For now, let's allow selecting them, and we assign priority based on selection order or just count.
      
      // Simple logic: Add to list with next priority
      const nextPriority = (newPreferences.length % 3) + 1; 
      
      newPreferences.push({
        day,
        shift,
        area,
        priority: nextPriority as 1 | 2 | 3
      });
    }

    onChange({ ...data, schedulePreferences: newPreferences });
  };

  const getPreference = (day: DayOfWeek, shift: Shift, area: TeacherArea) => {
    return preferences.find(p => p.day === day && p.shift === shift && p.area === area);
  };

  const handleWeekendChange = (day: 'saturday' | 'sunday') => {
    onChange({
      ...data,
      availableWeekends: {
        ...data.availableWeekends,
        [day]: !data.availableWeekends?.[day],
      } as any
    });
  };

  if (areas.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl">
        <p className="text-zinc-500">Selecione as Áreas de Atuação na etapa de Dados Profissionais para configurar a disponibilidade.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Preferência de Horários</h3>
        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
          <Info className="w-3 h-3" />
          <span>Selecione os horários titulares de preferência</span>
        </div>
      </div>

      {areas.map(area => (
        <div key={area} className="space-y-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              area === 'CONCURSO' ? 'bg-blue-500/10 text-blue-500' : 'bg-brand-red/10 text-brand-red'
            }`}>
              {area === 'CONCURSO' ? 'CONCURSO PÚBLICO' : 'ENEM'}
            </span>
            <div className="h-px bg-zinc-800 flex-1"></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-[10px] font-bold text-zinc-500 uppercase">Turno / Dia</th>
                  {DAYS.map(day => (
                    <th key={day.value} className="p-2 text-center text-[10px] font-bold text-zinc-500 uppercase bg-zinc-900/50 border border-zinc-800 min-w-[80px]">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHIFTS.map(shift => (
                  <tr key={shift.value}>
                    <td className="p-3 text-[11px] font-bold text-zinc-400 uppercase bg-zinc-900/30 border border-zinc-800">
                      {shift.label}
                    </td>
                    {DAYS.map(day => {
                      const pref = getPreference(day.value, shift.value, area);
                      const isSelected = !!pref;
                      
                      return (
                        <td key={`${day.value}-${shift.value}`} className="p-1 border border-zinc-800 text-center">
                          <button
                            onClick={() => handlePreferenceToggle(day.value, shift.value, area)}
                            className={`w-full h-10 rounded transition-all flex items-center justify-center gap-1 ${
                              isSelected 
                                ? area === 'CONCURSO' 
                                  ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]' 
                                  : 'bg-brand-red text-white shadow-[0_0_10px_rgba(220,38,38,0.3)]'
                                : 'hover:bg-zinc-800 text-zinc-600'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            <span className="text-[10px] font-bold">{isSelected ? 'TITULAR' : '-'}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="pt-6 border-t border-zinc-800">
        <h4 className="text-sm font-bold text-white mb-4 uppercase">Disponibilidade Finais de Semana</h4>
        <div className="flex gap-6">
          <label className="flex items-center gap-3 cursor-pointer group p-3 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors">
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
              data.availableWeekends?.saturday ? 'bg-brand-red border-brand-red' : 'border-zinc-600 bg-zinc-800'
            }`}>
              {data.availableWeekends?.saturday && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm font-medium text-zinc-300">Sábado</span>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={data.availableWeekends?.saturday || false}
              onChange={() => handleWeekendChange('saturday')}
            />
          </label>

          <label className="flex items-center gap-3 cursor-pointer group p-3 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors">
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
              data.availableWeekends?.sunday ? 'bg-brand-red border-brand-red' : 'border-zinc-600 bg-zinc-800'
            }`}>
              {data.availableWeekends?.sunday && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm font-medium text-zinc-300">Domingo</span>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={data.availableWeekends?.sunday || false}
              onChange={() => handleWeekendChange('sunday')}
            />
          </label>
        </div>
      </div>
    </div>
  );
};
