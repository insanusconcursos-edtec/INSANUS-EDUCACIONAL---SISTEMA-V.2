import React, { useEffect, useState } from 'react';
import { MapPin, Video, Users, CheckCircle, AlertCircle, Building2 } from 'lucide-react';
import { Class } from '../../../../../types/class';
import { Classroom, ClassroomLocation } from '../../../../../types/classroom';
import { classroomService } from '../../../../../services/classroomService';

interface ClassroomSelectionFormProps {
  data: Partial<Class>;
  onChange: (updates: Partial<Class>) => void;
  hasRecordings: boolean;
}

export const ClassroomSelectionForm: React.FC<ClassroomSelectionFormProps> = ({ data, onChange, hasRecordings }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolo, setSelectedPolo] = useState<ClassroomLocation>('RIO_BRANCO');

  useEffect(() => {
    const fetchClassrooms = async () => {
      try {
        setLoading(true);
        const fetchedClassrooms = await classroomService.getClassrooms();
        setClassrooms(fetchedClassrooms);
      } catch (error) {
        console.error("Error fetching classrooms:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClassrooms();
  }, []);

  const filteredClassrooms = classrooms.filter(room => {
    const matchesPolo = room.location === selectedPolo;
    const matchesStatus = room.status === 'ACTIVE';
    const matchesRecording = hasRecordings ? room.hasRecordingStructure : true;
    
    return matchesPolo && matchesStatus && matchesRecording;
  });

  const handleSelect = (id: string) => {
    onChange({ classroomId: id });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800">
        <Building2 className="w-5 h-5 text-brand-red" />
        <h3 className="text-lg font-bold text-white uppercase">Alocação de Sala</h3>
      </div>

      {/* Polo Selector */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setSelectedPolo('RIO_BRANCO')}
          className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all border ${
            selectedPolo === 'RIO_BRANCO'
              ? 'bg-zinc-800 text-white border-brand-red'
              : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          Rio Branco
        </button>
        <button
          type="button"
          onClick={() => setSelectedPolo('PORTO_VELHO')}
          className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all border ${
            selectedPolo === 'PORTO_VELHO'
              ? 'bg-zinc-800 text-white border-brand-red'
              : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          Porto Velho
        </button>
      </div>

      {/* Warnings */}
      {hasRecordings && (
        <div className="bg-brand-red/10 border border-brand-red/20 p-3 rounded-lg flex items-center gap-3 mb-4">
          <Video className="w-4 h-4 text-brand-red" />
          <p className="text-xs text-brand-red font-medium">
            Filtrando apenas salas com estrutura de gravação confirmada.
          </p>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-xs">Carregando salas...</div>
      ) : filteredClassrooms.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
          <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm font-medium">Nenhuma sala disponível.</p>
          <p className="text-zinc-600 text-xs mt-1">Verifique o polo ou os requisitos de gravação.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredClassrooms.map((room) => (
            <div
              key={room.id}
              onClick={() => handleSelect(room.id)}
              className={`relative p-4 rounded-xl border cursor-pointer transition-all group ${
                data.classroomId === room.id
                  ? 'bg-zinc-800 border-brand-red shadow-lg shadow-brand-red/10'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className={`font-bold text-sm ${data.classroomId === room.id ? 'text-white' : 'text-zinc-300'}`}>
                    {room.name}
                  </h4>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" />
                    {room.location === 'RIO_BRANCO' ? 'Rio Branco' : 'Porto Velho'}
                  </span>
                </div>
                {data.classroomId === room.id && (
                  <CheckCircle className="w-5 h-5 text-brand-red" />
                )}
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400 bg-zinc-950/50 px-2 py-1 rounded">
                  <Users className="w-3 h-3" />
                  <span>{room.capacity} Lugares</span>
                </div>
                {room.hasRecordingStructure && (
                  <div className="flex items-center gap-1.5 text-brand-red bg-brand-red/10 px-2 py-1 rounded border border-brand-red/20">
                    <Video className="w-3 h-3" />
                    <span className="font-bold">Estúdio</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
