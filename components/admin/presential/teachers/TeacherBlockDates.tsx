import React, { useState } from 'react';
import { Calendar, Plus, Trash2, AlertCircle } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Teacher, TeacherUnavailability, UnavailabilityType } from '../../../../types/teacher';

interface TeacherBlockDatesProps {
  data: Partial<Teacher>;
  onChange: (data: Partial<Teacher>) => void;
}

const UNAVAILABILITY_TYPES: { value: UnavailabilityType; label: string }[] = [
  { value: 'PLANTÃO', label: 'Plantão' },
  { value: 'FÉRIAS', label: 'Férias' },
  { value: 'LICENÇA_MÉDICA', label: 'Licença Médica' },
  { value: 'VIAGEM', label: 'Viagem' },
  { value: 'OUTROS', label: 'Outros' },
];

export const TeacherBlockDates: React.FC<TeacherBlockDatesProps> = ({ data, onChange }) => {
  const [newBlock, setNewBlock] = useState<Partial<TeacherUnavailability>>({
    type: 'PLANTÃO',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [selectedDays, setSelectedDays] = useState<Date[] | undefined>([]);

  const handleAddBlock = () => {
    const currentBlocks = data.unavailabilities || [];
    let newBlocksToAdd: TeacherUnavailability[] = [];

    if (newBlock.type === 'PLANTÃO') {
      if (!selectedDays || selectedDays.length === 0) return;

      newBlocksToAdd = selectedDays.map(day => ({
        id: crypto.randomUUID(),
        startDate: day.toISOString(),
        endDate: day.toISOString(),
        type: 'PLANTÃO',
        reason: newBlock.reason
      }));

      setSelectedDays([]);
    } else {
      if (!newBlock.startDate || !newBlock.endDate || !newBlock.type) return;

      newBlocksToAdd = [{
        id: crypto.randomUUID(),
        startDate: newBlock.startDate!,
        endDate: newBlock.endDate!,
        type: newBlock.type!,
        reason: newBlock.reason
      }];

      setNewBlock({
        type: newBlock.type, // Keep the type selected
        startDate: '',
        endDate: '',
        reason: ''
      });
    }

    onChange({
      ...data,
      unavailabilities: [...currentBlocks, ...newBlocksToAdd]
    });
  };

  const handleRemoveBlock = (id: string) => {
    const currentBlocks = data.unavailabilities || [];
    onChange({
      ...data,
      unavailabilities: currentBlocks.filter(b => b.id !== id)
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Agenda de Indisponibilidade</h3>
        <div className="flex items-center gap-2 text-xs text-brand-red bg-brand-red/10 px-3 py-1 rounded-full border border-brand-red/20">
          <AlertCircle className="w-3 h-3" />
          <span>Bloqueia agendamentos automáticos</span>
        </div>
      </div>

      {/* Form de Adição */}
      <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-4">
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Tipo de Ausência</label>
          <select
            value={newBlock.type}
            onChange={(e) => setNewBlock({ ...newBlock, type: e.target.value as UnavailabilityType })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red"
          >
            {UNAVAILABILITY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {newBlock.type === 'PLANTÃO' ? (
          <div className="flex flex-col items-center bg-zinc-950 p-6 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-brand-red" />
              <p className="text-sm text-white uppercase font-bold tracking-wider">Selecione os dias de plantão</p>
            </div>
            
            <DayPicker
              mode="multiple"
              selected={selectedDays}
              onSelect={setSelectedDays}
              locale={ptBR}
              showOutsideDays
              className="p-3 bg-zinc-900 rounded-xl border border-zinc-800"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-bold text-white uppercase tracking-wider",
                nav: "space-x-1 flex items-center",
                nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-white hover:bg-zinc-800 rounded-md transition-colors",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse",
                head_row: "flex w-full",
                head_cell: "text-zinc-500 w-10 font-normal text-[0.8rem] uppercase border-r border-b border-zinc-800 last:border-r-0 flex items-center justify-center pb-2",
                row: "flex w-full mt-0",
                cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent border-r border-b border-zinc-800 last:border-r-0",
                day: "h-10 w-10 p-0 font-medium hover:bg-zinc-800 transition-colors aria-selected:bg-red-600 aria-selected:text-white aria-selected:hover:bg-red-700 aria-selected:font-bold",
                day_outside: "opacity-30 text-zinc-500 pointer-events-none",
                day_today: "text-brand-red font-bold",
              }}
            />
            
            <div className="mt-6 flex items-center justify-between w-full px-4 py-3 bg-zinc-900 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-red animate-pulse"></div>
                <span className="text-xs font-bold text-zinc-400 uppercase">
                  {selectedDays?.length || 0} {selectedDays?.length === 1 ? 'dia selecionado' : 'dias selecionados'}
                </span>
              </div>
              {selectedDays && selectedDays.length > 0 && (
                <button 
                  onClick={() => setSelectedDays([])}
                  className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase transition-colors"
                >
                  Limpar Seleção
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Início</label>
              <input
                type="date"
                value={newBlock.startDate}
                onChange={(e) => setNewBlock({ ...newBlock, startDate: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Término</label>
              <input
                type="date"
                value={newBlock.endDate}
                onChange={(e) => setNewBlock({ ...newBlock, endDate: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Motivo (Opcional)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newBlock.reason}
              onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-red"
              placeholder="Detalhes sobre a ausência..."
            />
            <button
              onClick={handleAddBlock}
              disabled={newBlock.type === 'PLANTÃO' ? (!selectedDays || selectedDays.length === 0) : (!newBlock.startDate || !newBlock.endDate)}
              className="bg-brand-red hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-bold uppercase">Adicionar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Bloqueios */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700">
        {data.unavailabilities?.slice().reverse().map((block) => (
          <div key={block.id} className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white uppercase">{block.type.replace('_', ' ')}</span>
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                    {block.startDate === block.endDate 
                      ? format(new Date(block.startDate), "dd 'de' MMMM", { locale: ptBR })
                      : `${format(new Date(block.startDate), "dd/MM/yyyy")} até ${format(new Date(block.endDate), "dd/MM/yyyy")}`
                    }
                  </span>
                </div>
                {block.reason && (
                  <p className="text-xs text-zinc-400 mt-1">{block.reason}</p>
                )}
              </div>
            </div>
            
            <button
              onClick={() => handleRemoveBlock(block.id)}
              className="text-zinc-600 hover:text-red-500 transition-colors p-2"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        
        {(!data.unavailabilities || data.unavailabilities.length === 0) && (
          <div className="text-center py-8 text-zinc-600 text-sm italic">
            Nenhum bloqueio registrado na agenda.
          </div>
        )}
      </div>
    </div>
  );
};
