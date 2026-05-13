import React, { useState } from 'react';
import { Plus, Trash2, Star, AlertTriangle } from 'lucide-react';
import { Teacher, TeacherArea, TeacherLocation } from '../../../../../types/teacher';

interface ProfessionalDataFormProps {
  data: Partial<Teacher>;
  onChange: (data: Partial<Teacher>) => void;
}

export const ProfessionalDataForm: React.FC<ProfessionalDataFormProps> = ({ data, onChange }) => {
  const [newSubject, setNewSubject] = useState('');

  // Helper to toggle array items
  const toggleItem = <T,>(list: T[] | undefined, item: T): T[] => {
    const currentList = list || [];
    if (currentList.includes(item)) {
      return currentList.filter(i => i !== item);
    }
    return [...currentList, item];
  };

  const handleAreaChange = (area: TeacherArea) => {
    const newAreas = toggleItem(data.areas, area);
    onChange({ ...data, areas: newAreas });
  };

  const handleLocationChange = (location: TeacherLocation) => {
    const newLocations = toggleItem(data.locations, location);
    
    // Reset primary location and block time if logic changes
    const updates: Partial<Teacher> = { locations: newLocations };
    
    if (newLocations.length < 2) {
      updates.primaryLocation = null;
      updates.blockTime = null;
    }
    
    onChange({ ...data, ...updates });
  };

  const handleAddSubject = () => {
    if (!newSubject.trim()) return;
    
    const currentSubjects = data.subjects || [];
    const newSubjectObj = {
      id: crypto.randomUUID(),
      name: newSubject.trim(),
      isPrimary: currentSubjects.length === 0 // First one is primary by default
    };

    onChange({
      ...data,
      subjects: [...currentSubjects, newSubjectObj]
    });
    setNewSubject('');
  };

  const handleRemoveSubject = (id: string) => {
    const currentSubjects = data.subjects || [];
    const filtered = currentSubjects.filter(s => s.id !== id);
    
    // If we removed the primary one, make the first available one primary
    if (currentSubjects.find(s => s.id === id)?.isPrimary && filtered.length > 0) {
      filtered[0].isPrimary = true;
    }

    onChange({ ...data, subjects: filtered });
  };

  const setPrimarySubject = (id: string) => {
    const currentSubjects = data.subjects || [];
    const updated = currentSubjects.map(s => ({
      ...s,
      isPrimary: s.id === id
    }));
    onChange({ ...data, subjects: updated });
  };

  const showBlockTimeLogic = (data.locations?.length || 0) > 1;

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-bold text-white mb-4">Dados Profissionais</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Áreas de Atuação */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-zinc-400 uppercase">Área de Atuação *</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                data.areas?.includes('CONCURSO') ? 'bg-brand-red border-brand-red' : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-500'
              }`}>
                {data.areas?.includes('CONCURSO') && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-sm text-zinc-300">Concurso Público</span>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={data.areas?.includes('CONCURSO') || false}
                onChange={() => handleAreaChange('CONCURSO')}
              />
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                data.areas?.includes('ENEM') ? 'bg-brand-red border-brand-red' : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-500'
              }`}>
                {data.areas?.includes('ENEM') && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-sm text-zinc-300">ENEM</span>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={data.areas?.includes('ENEM') || false}
                onChange={() => handleAreaChange('ENEM')}
              />
            </label>
          </div>
        </div>

        {/* Locais de Atuação */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-zinc-400 uppercase">Local de Atuação *</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                data.locations?.includes('RIO_BRANCO') ? 'bg-brand-red border-brand-red' : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-500'
              }`}>
                {data.locations?.includes('RIO_BRANCO') && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-sm text-zinc-300">Rio Branco</span>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={data.locations?.includes('RIO_BRANCO') || false}
                onChange={() => handleLocationChange('RIO_BRANCO')}
              />
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                data.locations?.includes('PORTO_VELHO') ? 'bg-brand-red border-brand-red' : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-500'
              }`}>
                {data.locations?.includes('PORTO_VELHO') && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-sm text-zinc-300">Porto Velho</span>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={data.locations?.includes('PORTO_VELHO') || false}
                onChange={() => handleLocationChange('PORTO_VELHO')}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Lógica Condicional de Deslocamento */}
      {showBlockTimeLogic && (
        <div className="p-4 bg-zinc-900/50 border border-brand-red/30 rounded-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 mb-4 text-brand-red">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-bold uppercase">Configuração de Deslocamento</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Local Titular (Principal) *</label>
              <select
                value={data.primaryLocation || ''}
                onChange={(e) => onChange({ ...data, primaryLocation: e.target.value as TeacherLocation })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red"
              >
                <option value="">Selecione...</option>
                <option value="RIO_BRANCO">Rio Branco</option>
                <option value="PORTO_VELHO">Porto Velho</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Tempo de Deslocamento (Block Time) *</label>
              <div className="relative">
                <input
                  type="number"
                  value={data.blockTime || ''}
                  onChange={(e) => onChange({ ...data, blockTime: Number(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red pl-4 pr-12"
                  placeholder="Ex: 24"
                />
                <span className="absolute right-4 top-3 text-zinc-500 text-sm font-bold">HORAS</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Tempo necessário para viagem e descanso entre cidades.</p>
            </div>
          </div>
        </div>
      )}

      {/* Matérias */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-zinc-400 uppercase">Matérias Lecionadas *</label>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-brand-red"
            placeholder="Digite o nome da matéria e pressione Enter"
          />
          <button
            onClick={handleAddSubject}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 mt-2">
          {data.subjects?.map((subject) => (
            <div key={subject.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800 group hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPrimarySubject(subject.id)}
                  className={`p-1 rounded-full transition-colors ${
                    subject.isPrimary ? 'text-yellow-500' : 'text-zinc-600 hover:text-yellow-500'
                  }`}
                  title="Definir como Principal"
                >
                  <Star className={`w-4 h-4 ${subject.isPrimary ? 'fill-yellow-500' : ''}`} />
                </button>
                <span className="text-sm text-white font-medium">{subject.name}</span>
                {subject.isPrimary && (
                  <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20 uppercase font-bold">
                    Titular
                  </span>
                )}
              </div>
              
              <button
                onClick={() => handleRemoveSubject(subject.id)}
                className="text-zinc-600 hover:text-red-500 transition-colors p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {(!data.subjects || data.subjects.length === 0) && (
            <p className="text-sm text-zinc-500 italic">Nenhuma matéria adicionada.</p>
          )}
        </div>
      </div>
    </div>
  );
};
