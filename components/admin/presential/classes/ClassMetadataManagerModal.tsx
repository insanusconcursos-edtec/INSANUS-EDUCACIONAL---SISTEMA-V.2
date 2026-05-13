import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Tag, Layers, Building2 } from 'lucide-react';
import { classMetadataService, MetadataItem } from '../../../../services/classMetadataService';

interface ClassMetadataManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'CATEGORIES' | 'SUBCATEGORIES' | 'ORGANIZATIONS';

export const ClassMetadataManagerModal: React.FC<ClassMetadataManagerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('CATEGORIES');
  const [items, setItems] = useState<MetadataItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let data: MetadataItem[] = [];
      switch (activeTab) {
        case 'CATEGORIES':
          data = await classMetadataService.getCategories();
          break;
        case 'SUBCATEGORIES':
          data = await classMetadataService.getSubcategories();
          break;
        case 'ORGANIZATIONS':
          data = await classMetadataService.getOrganizations();
          break;
      }
      setItems(data);
    } catch (error) {
      console.error('Error loading metadata:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newItemName.trim()) return;

    setIsLoading(true);
    try {
      switch (activeTab) {
        case 'CATEGORIES':
          await classMetadataService.createCategory(newItemName);
          break;
        case 'SUBCATEGORIES':
          await classMetadataService.createSubcategory(newItemName);
          break;
        case 'ORGANIZATIONS':
          await classMetadataService.createOrganization(newItemName);
          break;
      }
      setNewItemName('');
      await loadData();
    } catch (error) {
      console.error('Error adding item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este item?')) return;

    setIsLoading(true);
    try {
      switch (activeTab) {
        case 'CATEGORIES':
          await classMetadataService.deleteCategory(id);
          break;
        case 'SUBCATEGORIES':
          await classMetadataService.deleteSubcategory(id);
          break;
        case 'ORGANIZATIONS':
          await classMetadataService.deleteOrganization(id);
          break;
      }
      await loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h2 className="text-xl font-bold text-white">Gerenciar Filtros</h2>
            <p className="text-sm text-zinc-400">Adicione ou remova categorias, subcategorias e órgãos</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/30">
          <button
            onClick={() => setActiveTab('CATEGORIES')}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'CATEGORIES' ? 'text-brand-red bg-zinc-800/50' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30'
            }`}
          >
            <Tag className="w-4 h-4" />
            Categorias
            {activeTab === 'CATEGORIES' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-red" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('SUBCATEGORIES')}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'SUBCATEGORIES' ? 'text-brand-red bg-zinc-800/50' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30'
            }`}
          >
            <Layers className="w-4 h-4" />
            Subcategorias
            {activeTab === 'SUBCATEGORIES' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-red" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('ORGANIZATIONS')}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'ORGANIZATIONS' ? 'text-brand-red bg-zinc-800/50' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Órgãos
            {activeTab === 'ORGANIZATIONS' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-red" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/30">
          {/* Add Form */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={`Novo nome para ${
                activeTab === 'CATEGORIES' ? 'Categoria' : 
                activeTab === 'SUBCATEGORIES' ? 'Subcategoria' : 'Órgão'
              }...`}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={isLoading || !newItemName.trim()}
              className="px-4 py-2 bg-brand-red text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Adicionar
            </button>
          </div>

          {/* List */}
          {isLoading && items.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800">
              Nenhum item cadastrado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-colors"
                >
                  <span className="text-zinc-200 font-medium">{item.name}</span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
