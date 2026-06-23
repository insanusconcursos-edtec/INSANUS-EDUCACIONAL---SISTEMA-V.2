import React, { useState } from 'react';
import { X, ArrowRightLeft, Search, GraduationCap } from 'lucide-react';
import { CourseEditalDiscipline } from '../../../../types/courseEdital';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sourceDiscipline: CourseEditalDiscipline | null;
  allDisciplines: CourseEditalDiscipline[];
  onConfirm: (targetDisciplineId: string) => void;
}

export const DisciplineMigrationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sourceDiscipline,
  allDisciplines,
  onConfirm
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  if (!isOpen || !sourceDiscipline) return null;

  const filteredDisciplines = allDisciplines.filter(d => 
    d.id !== sourceDiscipline.id && 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <ArrowRightLeft className="text-blue-500" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Migrar Disciplina</h2>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Mover conteúdo para outra disciplina</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700 mb-4">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Origem</p>
            <h3 className="text-sm font-black text-white">{sourceDiscipline.name}</h3>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text"
              placeholder="Buscar disciplina de destino..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm font-medium text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-2">
            {filteredDisciplines.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-zinc-500 text-sm font-medium">Nenhuma outra disciplina encontrada.</p>
              </div>
            ) : (
              filteredDisciplines.map(discipline => (
                <button
                  key={discipline.id}
                  onClick={() => onConfirm(discipline.id)}
                  className="w-full text-left p-4 bg-zinc-900/30 border border-zinc-800 hover:border-blue-500 hover:bg-blue-500/5 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                      <GraduationCap className="text-zinc-500 group-hover:text-blue-500" size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white group-hover:text-blue-400 transition-colors">{discipline.name}</h4>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        {discipline.topics.length} tópicos atuais
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-zinc-900/30 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 font-medium leading-relaxed">
            Ao confirmar, todos os tópicos de <span className="text-white font-bold">"{sourceDiscipline.name}"</span> serão movidos para uma nova pasta com o mesmo nome dentro da disciplina selecionada.
          </p>
        </div>
      </div>
    </div>
  );
};
