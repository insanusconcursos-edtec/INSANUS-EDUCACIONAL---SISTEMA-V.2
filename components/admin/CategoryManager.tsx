
import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Category, createCategory, deleteCategory, updateCategory } from '../../services/planService';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  refreshData: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose, categories, refreshData }) => {
  const [newCatName, setNewCatName] = useState('');
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [newSubName, setNewSubName] = useState('');

  if (!isOpen) return null;

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    await createCategory(newCatName.toUpperCase());
    setNewCatName('');
    refreshData();
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Tem certeza? Isso pode afetar planos existentes.')) {
      await deleteCategory(id);
      if (selectedCat?.id === id) setSelectedCat(null);
      refreshData();
    }
  };

  const handleAddSubcategory = async () => {
    if (!selectedCat || !newSubName.trim()) return;
    const updatedSubs = [...selectedCat.subcategories, newSubName.toUpperCase()];
    await updateCategory(selectedCat.id!, { subcategories: updatedSubs });
    
    // Update local state to reflect immediately
    setSelectedCat({ ...selectedCat, subcategories: updatedSubs });
    setNewSubName('');
    refreshData();
  };

  const handleRemoveSubcategory = async (sub: string) => {
    if (!selectedCat) return;
    const updatedSubs = selectedCat.subcategories.filter(s => s !== sub);
    await updateCategory(selectedCat.id!, { subcategories: updatedSubs });
    
    setSelectedCat({ ...selectedCat, subcategories: updatedSubs });
    refreshData();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">Gerenciar Categorias</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Categories List (Left) */}
          <div className="w-1/2 border-r border-zinc-900 p-4 overflow-y-auto">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Categorias</h3>
            
            <div className="flex gap-2 mb-4">
              <input 
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="NOVA CATEGORIA"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-white placeholder-zinc-700 uppercase focus:outline-none focus:border-brand-red"
              />
              <button onClick={handleCreateCategory} className="bg-zinc-800 hover:bg-brand-red text-white p-2 rounded transition-colors">
                <Plus size={16} />
              </button>
            </div>

            <div className="space-y-2">
              {categories.map(cat => (
                <div 
                  key={cat.id}
                  onClick={() => setSelectedCat(cat)}
                  className={`flex items-center justify-between p-3 rounded cursor-pointer border transition-all ${selectedCat?.id === cat.id ? 'bg-zinc-900 border-brand-red/50 text-white' : 'bg-transparent border-zinc-800/50 text-zinc-400 hover:bg-zinc-900'}`}
                >
                  <span className="text-xs font-bold uppercase">{cat.name}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id!); }}
                    className="text-zinc-600 hover:text-red-500 p-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Subcategories List (Right) */}
          <div className="w-1/2 p-4 bg-zinc-900/20 overflow-y-auto">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">
              {selectedCat ? `Subcategorias de ${selectedCat.name}` : 'Selecione uma Categoria'}
            </h3>

            {selectedCat ? (
              <>
                <div className="flex gap-2 mb-4">
                  <input 
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="NOVA SUBCATEGORIA"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-white placeholder-zinc-700 uppercase focus:outline-none focus:border-brand-red"
                  />
                  <button onClick={handleAddSubcategory} className="bg-zinc-800 hover:bg-brand-red text-white p-2 rounded transition-colors">
                    <Plus size={16} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedCat.subcategories.map((sub, idx) => (
                    <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-zinc-300 uppercase">{sub}</span>
                      <button 
                        onClick={() => handleRemoveSubcategory(sub)}
                        className="text-zinc-600 hover:text-red-500"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-700 text-xs uppercase font-medium text-center px-4">
                Selecione uma categoria à esquerda para gerenciar suas subdivisões
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
