import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, Plus, Search, MapPin, BookOpen, MessageCircle } from 'lucide-react';
import { Teacher } from '../../../../types/teacher';
import { teacherService } from '../../../../services/teacherService';
import { TeacherFormModal } from './TeacherFormModal';

export const TeacherList: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | undefined>(undefined);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const data = await teacherService.getTeachers();
      setTeachers(data);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleEdit = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este professor?')) {
      try {
        await teacherService.deleteTeacher(id);
        fetchTeachers();
      } catch (error) {
        console.error("Error deleting teacher:", error);
      }
    }
  };

  const handleCreate = () => {
    setSelectedTeacher(undefined);
    setIsModalOpen(true);
  };

  const formatPhoneForLink = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar professor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-brand-red transition-colors"
          />
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-6 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider transition-colors shadow-lg shadow-brand-red/20"
        >
          <Plus className="w-4 h-4" />
          Novo Professor
        </button>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Carregando professores...</div>
      ) : filteredTeachers.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
          Nenhum professor encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTeachers.map((teacher) => {
            const primarySubject = teacher.subjects?.find(s => s.isPrimary);
            const secondarySubjects = teacher.subjects?.filter(s => !s.isPrimary) || [];
            const displaySecondary = secondarySubjects.slice(0, 2);
            const remainingCount = secondarySubjects.length - 2;

            return (
              <div key={teacher.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group hover:border-zinc-600 transition-all hover:shadow-xl flex flex-col">
                <div className="p-6 flex flex-col items-center text-center border-b border-zinc-800/50 relative">
                  <div className="w-24 h-24 rounded-full bg-zinc-800 mb-4 overflow-hidden border-2 border-zinc-700 group-hover:border-brand-red transition-colors">
                    {teacher.photoUrl ? (
                      <img src={teacher.photoUrl} alt={teacher.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-zinc-600">
                        {teacher.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1 truncate w-full">{teacher.name}</h3>
                  
                  {/* WhatsApp Link */}
                  {teacher.whatsapp && (
                    <a 
                      href={`https://wa.me/55${formatPhoneForLink(teacher.whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-green-500 hover:text-green-400 transition-colors mt-1 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span className="font-medium">{teacher.whatsapp}</span>
                    </a>
                  )}
                </div>

                <div className="p-4 space-y-3 bg-zinc-900/30 flex-1">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <MapPin className="w-3 h-3 text-brand-red shrink-0" />
                    <span className="truncate">
                      {teacher.locations?.map(l => l === 'RIO_BRANCO' ? 'Rio Branco' : 'Porto Velho').join(', ') || 'Sem local'}
                    </span>
                  </div>
                  
                  {/* Subjects List */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-white">
                      <BookOpen className="w-3 h-3 text-brand-red shrink-0" />
                      <span className="font-bold truncate">
                        {primarySubject?.name || 'Sem matéria titular'}
                      </span>
                      {primarySubject && (
                        <span className="text-[9px] bg-brand-red/20 text-brand-red px-1.5 py-0.5 rounded border border-brand-red/30 uppercase font-bold">
                          Titular
                        </span>
                      )}
                    </div>
                    
                    {secondarySubjects.length > 0 && (
                      <div className="pl-5 flex flex-wrap gap-1">
                        {displaySecondary.map(sub => (
                          <span key={sub.id} className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                            {sub.name}
                          </span>
                        ))}
                        {remainingCount > 0 && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                            +{remainingCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 grid grid-cols-2 gap-2 border-t border-zinc-800 bg-zinc-950/30 mt-auto">
                  <button
                    onClick={() => handleEdit(teacher)}
                    className="flex items-center justify-center gap-2 p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-xs font-bold uppercase"
                  >
                    <Edit2 className="w-3 h-3" />
                    Editar
                  </button>
                  <button
                    onClick={() => teacher.id && handleDelete(teacher.id)}
                    className="flex items-center justify-center gap-2 p-2 rounded hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-colors text-xs font-bold uppercase"
                  >
                    <Trash2 className="w-3 h-3" />
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TeacherFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchTeachers}
        teacherToEdit={selectedTeacher}
      />
    </div>
  );
};
