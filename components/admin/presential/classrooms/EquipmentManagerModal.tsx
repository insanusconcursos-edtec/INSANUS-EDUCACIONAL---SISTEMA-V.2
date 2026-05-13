import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Settings, Loader2, AlertTriangle, Check } from 'lucide-react';
import { Equipment } from '../../../../types/equipment';
import { equipmentService } from '../../../../services/equipmentService';

interface EquipmentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EquipmentManagerModal: React.FC<EquipmentManagerModalProps> = ({ isOpen, onClose }) => {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchEquipments = async () => {
    try {
      setLoading(true);
      const data = await equipmentService.getEquipments();
      setEquipments(data);
    } catch (error) {
      console.error("Error fetching equipments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEquipments();
    }
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquipmentName.trim()) return;

    try {
      setAdding(true);
      await equipmentService.createEquipment({ name: newEquipmentName.trim() });
      setNewEquipmentName('');
      await fetchEquipments();
    } catch (error) {
      console.error("Error adding equipment:", error);
      alert("Erro ao adicionar equipamento.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await equipmentService.deleteEquipment(id);
      await fetchEquipments();
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Error deleting equipment:", error);
      alert("Erro ao excluir equipamento.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-red" />
            <h2 className="text-lg font-bold text-white uppercase tracking-tight">
              Gerenciar Equipamentos
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          <form onSubmit={handleAdd} className="flex gap-2 mb-6">
            <input
              type="text"
              value={newEquipmentName}
              onChange={(e) => setNewEquipmentName(e.target.value)}
              placeholder="Nome do equipamento..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-red transition-colors text-sm"
            />
            <button
              type="submit"
              disabled={adding || !newEquipmentName.trim()}
              className="bg-brand-red hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center min-w-[40px]"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </form>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {loading ? (
              <div className="text-center py-8 text-zinc-500 text-sm">Carregando...</div>
            ) : equipments.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm italic border border-dashed border-zinc-800 rounded-lg">
                Nenhum equipamento cadastrado.
              </div>
            ) : (
              equipments.map((item) => (
                <div key={item.id} className={`flex items-center justify-between p-3 border rounded-lg transition-all ${confirmDeleteId === item.id ? 'bg-red-900/10 border-red-900/30' : 'bg-zinc-800/30 border-zinc-800 hover:border-zinc-700'}`}>
                  {confirmDeleteId === item.id ? (
                    <div className="flex items-center justify-between w-full animate-in fade-in duration-200">
                      <span className="text-xs font-bold text-red-400 uppercase flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3" />
                        Confirmar exclusão?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs font-bold uppercase hover:text-white transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="px-2 py-1 rounded bg-red-600 text-white text-xs font-bold uppercase hover:bg-red-700 transition-colors flex items-center gap-1"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="w-3 h-3" />
                              Excluir
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-zinc-300 font-medium">{item.name}</span>
                      <button
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="text-zinc-500 hover:text-red-500 p-1.5 rounded-md hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <p className="text-[10px] text-zinc-500 text-center">
            Estes equipamentos estarão disponíveis para seleção no cadastro de salas.
          </p>
        </div>
      </div>
    </div>
  );
};
