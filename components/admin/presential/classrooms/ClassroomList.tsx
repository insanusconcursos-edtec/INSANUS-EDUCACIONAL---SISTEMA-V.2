import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, Plus, MapPin, Armchair, Video, AlertCircle, CheckCircle, XCircle, AlertTriangle, Settings, Box } from 'lucide-react';
import { Classroom, ClassroomLocation } from '../../../../types/classroom';
import { Equipment } from '../../../../types/equipment';
import { classroomService } from '../../../../services/classroomService';
import { equipmentService } from '../../../../services/equipmentService';
import { ClassroomFormModal } from './ClassroomFormModal';
import { EquipmentManagerModal } from './EquipmentManagerModal';

export const ClassroomList: React.FC = () => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLocation, setFilterLocation] = useState<ClassroomLocation | 'ALL'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | undefined>(undefined);
  
  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, classroomId: string | null }>({ isOpen: false, classroomId: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [classroomsData, equipmentsData] = await Promise.all([
        classroomService.getClassrooms(),
        equipmentService.getEquipments()
      ]);
      setClassrooms(classroomsData);
      setEquipments(equipmentsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (classroom: Classroom) => {
    setSelectedClassroom(classroom);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteModal.classroomId) return;
    
    try {
      setIsDeleting(true);
      await classroomService.deleteClassroom(deleteModal.classroomId);
      await fetchData();
      setDeleteModal({ isOpen: false, classroomId: null });
    } catch (error) {
      console.error("Error deleting classroom:", error);
      alert("Erro ao excluir sala. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreate = () => {
    setSelectedClassroom(undefined);
    setIsModalOpen(true);
  };

  const filteredClassrooms = classrooms.filter(c => 
    filterLocation === 'ALL' || c.location === filterLocation
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-green-500/10 text-green-500 px-2 py-1 rounded-full border border-green-500/20"><CheckCircle className="w-3 h-3" /> Ativo</span>;
      case 'MAINTENANCE':
        return <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-full border border-yellow-500/20"><AlertCircle className="w-3 h-3" /> Manutenção</span>;
      case 'INACTIVE':
        return <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-red-500/10 text-red-500 px-2 py-1 rounded-full border border-red-500/20"><XCircle className="w-3 h-3" /> Inativo</span>;
      default:
        return null;
    }
  };

  const getEquipmentName = (id: string) => {
    return equipments.find(e => e.id === id)?.name || 'Item desconhecido';
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-700">
          <button
            onClick={() => setFilterLocation('ALL')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-colors ${filterLocation === 'ALL' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterLocation('RIO_BRANCO')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-colors ${filterLocation === 'RIO_BRANCO' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Rio Branco
          </button>
          <button
            onClick={() => setFilterLocation('PORTO_VELHO')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-colors ${filterLocation === 'PORTO_VELHO' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Porto Velho
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEquipmentModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg font-bold uppercase text-xs tracking-wider transition-colors border border-zinc-700"
          >
            <Settings className="w-4 h-4" />
            Gerenciar Equipamentos
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-6 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider transition-colors shadow-lg shadow-brand-red/20"
          >
            <Plus className="w-4 h-4" />
            Nova Sala
          </button>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Carregando salas...</div>
      ) : filteredClassrooms.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
          Nenhuma sala encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClassrooms.map((classroom) => (
            <div key={classroom.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group hover:border-zinc-600 transition-all hover:shadow-xl flex flex-col">
              <div className="p-5 border-b border-zinc-800/50 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{classroom.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-zinc-400">
                    <MapPin className="w-3 h-3 text-brand-red" />
                    {classroom.location === 'RIO_BRANCO' ? 'Rio Branco' : 'Porto Velho'}
                  </div>
                </div>
                {getStatusBadge(classroom.status)}
              </div>

              <div className="p-5 space-y-4 flex-1">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-2 rounded-lg border border-zinc-700/50">
                    <Armchair className="w-4 h-4 text-zinc-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Capacidade</span>
                      <span className="text-sm font-bold text-white">{classroom.capacity} Lugares</span>
                    </div>
                  </div>
                  
                  {classroom.hasRecordingStructure && (
                    <div className="flex items-center gap-2 bg-brand-red/10 px-3 py-2 rounded-lg border border-brand-red/20">
                      <Video className="w-4 h-4 text-brand-red" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-brand-red/70 uppercase font-bold">Estúdio</span>
                        <span className="text-sm font-bold text-brand-red">Gravação</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resources List */}
                {classroom.resources && classroom.resources.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase">
                      <Box className="w-3 h-3" />
                      Recursos Disponíveis
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {classroom.resources.map(resourceId => (
                        <span key={resourceId} className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300">
                          {getEquipmentName(resourceId)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(classroom.status === 'MAINTENANCE' || classroom.status === 'INACTIVE') && classroom.statusReason && (
                  <div className="bg-red-900/10 border border-red-900/30 p-3 rounded-lg">
                    <p className="text-xs text-red-400 font-medium">
                      <span className="font-bold uppercase block mb-1">Motivo:</span>
                      {classroom.statusReason}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 grid grid-cols-2 gap-2 border-t border-zinc-800 bg-zinc-950/30 mt-auto">
                <button
                  onClick={() => handleEdit(classroom)}
                  className="flex items-center justify-center gap-2 p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-xs font-bold uppercase"
                >
                  <Edit2 className="w-3 h-3" />
                  Editar
                </button>
                <button
                  onClick={() => setDeleteModal({ isOpen: true, classroomId: classroom.id })}
                  className="flex items-center justify-center gap-2 p-2 rounded hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-colors text-xs font-bold uppercase"
                >
                  <Trash2 className="w-3 h-3" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClassroomFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        classroomToEdit={selectedClassroom}
      />

      <EquipmentManagerModal
        isOpen={isEquipmentModalOpen}
        onClose={() => setIsEquipmentModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Excluir Sala</h3>
            </div>
            
            <p className="text-zinc-400 mb-6">
              Tem certeza que deseja excluir esta sala? Esta ação não poderá ser desfeita e pode afetar turmas vinculadas.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, classroomId: null })}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-red-900/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
