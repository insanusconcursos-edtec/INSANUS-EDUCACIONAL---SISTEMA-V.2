import React, { useState, useEffect } from 'react';
import { X, Save, Video, AlertTriangle, Box } from 'lucide-react';
import { Classroom, ClassroomLocation, ClassroomStatus } from '../../../../types/classroom';
import { Equipment } from '../../../../types/equipment';
import { classroomService } from '../../../../services/classroomService';
import { equipmentService } from '../../../../services/equipmentService';

interface ClassroomFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classroomToEdit?: Classroom;
}

const INITIAL_DATA: Partial<Classroom> = {
  name: '',
  location: 'RIO_BRANCO',
  capacity: 0,
  hasRecordingStructure: false,
  status: 'ACTIVE',
  statusReason: '',
  resources: []
};

export const ClassroomFormModal: React.FC<ClassroomFormModalProps> = ({ isOpen, onClose, onSuccess, classroomToEdit }) => {
  const [formData, setFormData] = useState<Partial<Classroom>>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [availableEquipments, setAvailableEquipments] = useState<Equipment[]>([]);

  useEffect(() => {
    const fetchEquipments = async () => {
      try {
        const data = await equipmentService.getEquipments();
        setAvailableEquipments(data);
      } catch (error) {
        console.error("Error fetching equipments:", error);
      }
    };

    if (isOpen) {
      fetchEquipments();
      if (classroomToEdit) {
        setFormData({ ...classroomToEdit, resources: classroomToEdit.resources || [] });
      } else {
        setFormData(INITIAL_DATA);
      }
    }
  }, [isOpen, classroomToEdit]);

  const handleResourceToggle = (equipmentId: string) => {
    setFormData(prev => {
      const currentResources = prev.resources || [];
      if (currentResources.includes(equipmentId)) {
        return { ...prev, resources: currentResources.filter(id => id !== equipmentId) };
      } else {
        return { ...prev, resources: [...currentResources, equipmentId] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.capacity) return;
    
    if ((formData.status === 'MAINTENANCE' || formData.status === 'INACTIVE') && !formData.statusReason) {
      alert('Por favor, informe o motivo da indisponibilidade.');
      return;
    }

    try {
      setLoading(true);
      if (classroomToEdit && classroomToEdit.id) {
        await classroomService.updateClassroom(classroomToEdit.id, formData);
      } else {
        await classroomService.createClassroom(formData as Omit<Classroom, 'id'>);
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar sala.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h2 className="text-lg font-bold text-white uppercase tracking-tight">
            {classroomToEdit ? 'Editar Sala' : 'Nova Sala'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Nome da Sala *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
              placeholder="Ex: Sala 01, Auditório..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Location */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Polo *</label>
              <select
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value as ClassroomLocation })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
              >
                <option value="RIO_BRANCO">Rio Branco</option>
                <option value="PORTO_VELHO">Porto Velho</option>
              </select>
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Capacidade *</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={e => setFormData({ ...formData, capacity: Number(e.target.value) })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
                min="1"
                required
              />
            </div>
          </div>

          {/* Recording Structure (Legacy/Financial Check) */}
          <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
            <input
              type="checkbox"
              id="hasRecording"
              checked={formData.hasRecordingStructure}
              onChange={e => setFormData({ ...formData, hasRecordingStructure: e.target.checked })}
              className="w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-brand-red focus:ring-brand-red focus:ring-offset-zinc-900"
            />
            <label htmlFor="hasRecording" className="flex items-center gap-2 text-sm font-medium text-white cursor-pointer select-none">
              <Video className="w-4 h-4 text-brand-red" />
              Possui estrutura para gravação? (Gera comissão)
            </label>
          </div>

          {/* Equipment Inventory */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 flex items-center gap-2">
              <Box className="w-3 h-3" />
              Inventário da Sala
            </label>
            <div className="bg-zinc-800/30 border border-zinc-700 rounded-xl p-4 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-600">
              {availableEquipments.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center">Nenhum equipamento cadastrado no sistema.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableEquipments.map(equipment => (
                    <label key={equipment.id} className="flex items-center gap-2 p-2 rounded hover:bg-zinc-800 transition-colors cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.resources?.includes(equipment.id)}
                        onChange={() => handleResourceToggle(equipment.id)}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-brand-red focus:ring-brand-red focus:ring-offset-zinc-900"
                      />
                      <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">{equipment.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Status de Operação *</label>
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as ClassroomStatus })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
            >
              <option value="ACTIVE">Ativo</option>
              <option value="MAINTENANCE">Em Manutenção</option>
              <option value="INACTIVE">Inativo</option>
            </select>
          </div>

          {/* Conditional Status Reason */}
          {(formData.status === 'MAINTENANCE' || formData.status === 'INACTIVE') && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-xs font-bold text-red-400 uppercase mb-1 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" />
                Motivo da Indisponibilidade *
              </label>
              <textarea
                value={formData.statusReason || ''}
                onChange={e => setFormData({ ...formData, statusReason: e.target.value })}
                className="w-full bg-zinc-800 border border-red-900/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors min-h-[80px]"
                placeholder="Descreva o motivo (ex: Ar-condicionado quebrado, Reforma...)"
                required
              />
            </div>
          )}

          <div className="pt-4 border-t border-zinc-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-bold uppercase text-xs tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-brand-red/20 transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Sala
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
