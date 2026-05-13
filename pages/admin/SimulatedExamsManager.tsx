import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Settings, Filter, Search, GraduationCap } from 'lucide-react';
import { 
  getSimulatedClasses, 
  createSimulatedClass, 
  updateSimulatedClass, 
  deleteSimulatedClass,
  SimulatedClass 
} from '../../services/simulatedService';
import { getCategories, Category } from '../../services/planService';
import SimulatedClassCard from '../../components/admin/simulated/SimulatedClassCard';
import SimulatedClassForm from '../../components/admin/simulated/SimulatedClassForm';
import CategoryManager from '../../components/admin/CategoryManager';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import SimulatedClassDetails from '../../components/admin/simulated/SimulatedClassDetails';

const SimulatedExamsManager: React.FC = () => {
  // Data State
  const [classes, setClasses] = useState<SimulatedClass[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation State (New for 16.3)
  const [selectedClass, setSelectedClass] = useState<SimulatedClass | null>(null);

  // Filters State
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SimulatedClass | null>(null);
  
  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<SimulatedClass | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // === DATA FETCHING ===
  const fetchData = useCallback(async () => {
    try {
      const [fetchedClasses, fetchedCats] = await Promise.all([
        getSimulatedClasses(),
        getCategories()
      ]);
      setClasses(fetchedClasses);
      setCategories(fetchedCats);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // === ACTIONS ===

  const handleCreateOrUpdate = async (data: Omit<SimulatedClass, 'id' | 'createdAt'>, coverFile?: File) => {
    setIsSaving(true);
    try {
        if (editingClass && editingClass.id) {
            await updateSimulatedClass(editingClass.id, data, coverFile);
        } else {
            await createSimulatedClass(data, coverFile);
        }
        await fetchData();
        setIsFormOpen(false);
        setEditingClass(null);
    } catch (error) {
        console.error("Erro ao salvar turma:", error);
        alert("Erro ao salvar. Verifique o console.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteRequest = (cls: SimulatedClass) => {
    setClassToDelete(cls);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!classToDelete?.id) return;
    setIsDeleting(true);
    try {
        await deleteSimulatedClass(classToDelete.id);
        setClasses(prev => prev.filter(c => c.id !== classToDelete.id));
        setDeleteModalOpen(false);
        setClassToDelete(null);
    } catch (error) {
        console.error("Erro ao excluir:", error);
    } finally {
        setIsDeleting(false);
    }
  };

  const openNewClass = () => {
    setEditingClass(null);
    setIsFormOpen(true);
  };

  const openEditClass = (cls: SimulatedClass) => {
    setEditingClass(cls);
    setIsFormOpen(true);
  };

  const handleManage = (cls: SimulatedClass) => {
    setSelectedClass(cls);
  };

  // === FILTERS LOGIC ===
  const activeCategoryObj = categories.find(c => c.id === filterCategory || c.name === filterCategory);
  const availableSubcategories = activeCategoryObj ? activeCategoryObj.subcategories : [];

  const filteredClasses = classes.filter(cls => {
    const matchCat = filterCategory ? (cls.categoryId === filterCategory || cls.categoryId === activeCategoryObj?.id) : true;
    const matchSub = filterSubcategory ? cls.subcategoryId === filterSubcategory : true;
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = searchTerm 
        ? cls.title.toLowerCase().includes(searchLower) || cls.organization.toLowerCase().includes(searchLower)
        : true;
    return matchCat && matchSub && matchSearch;
  });

  // === RENDER ===

  // 1. Loading State
  if (loading && !isDeleting) {
    return (
        <div className="flex items-center justify-center h-full min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-red"></div>
        </div>
    );
  }

  // 2. Selected Class View (Internal Page)
  if (selectedClass) {
      return (
          <SimulatedClassDetails 
              classData={selectedClass} 
              onBack={() => setSelectedClass(null)} 
          />
      );
  }

  // 3. Dashboard View (Grid)
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Turmas de Simulados</h2>
          <div className="w-12 h-1 bg-brand-red shadow-[0_0_15px_rgba(255,0,0,0.5)]"></div>
        </div>
        
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsCatManagerOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-black uppercase text-zinc-400 hover:text-white hover:border-zinc-600 transition-all tracking-widest"
            >
                <Settings size={14} />
                Gerenciar Categorias
            </button>
            <button 
                onClick={openNewClass}
                className="flex items-center gap-2 px-8 py-3 bg-brand-red rounded-lg text-[10px] font-black uppercase text-white shadow-lg shadow-brand-red/30 hover:bg-red-600 hover:scale-[1.02] transition-all tracking-widest"
            >
                <Plus size={14} strokeWidth={3} />
                Nova Turma
            </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-1 bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            <Filter size={14} />
            <span>Filtros:</span>
        </div>
        
        <select 
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setFilterSubcategory(''); }}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[180px]"
        >
            <option value="">TODAS AS CATEGORIAS</option>
            {categories.map(cat => (
                <option key={cat.id} value={cat.id || cat.name}>{cat.name}</option>
            ))}
        </select>
        
        <select 
            value={filterSubcategory}
            onChange={(e) => setFilterSubcategory(e.target.value)}
            disabled={!filterCategory}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[180px] disabled:opacity-50"
        >
            <option value="">TODAS AS SUBCATEGORIAS</option>
            {availableSubcategories.map((sub, idx) => (
                <option key={idx} value={sub}>{sub}</option>
            ))}
        </select>
        
        <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search size={14} className="text-zinc-600" />
            </div>
            <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="BUSCAR TURMA OU ÓRGÃO..."
                className="w-full bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white pl-10 pr-4 py-2.5 placeholder-zinc-700 focus:outline-none focus:border-brand-red transition-all uppercase"
            />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredClasses.map(cls => (
              <SimulatedClassCard 
                  key={cls.id} 
                  data={cls} 
                  onManage={handleManage}
                  onEdit={openEditClass}
                  onDelete={handleDeleteRequest}
              />
          ))}
          
          <button 
              onClick={openNewClass}
              className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800/50 rounded-2xl p-8 hover:border-brand-red/30 hover:bg-zinc-900/10 transition-all group min-h-[300px]"
          >
              <div className="w-14 h-14 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-600 group-hover:text-brand-red group-hover:border-brand-red/30 group-hover:shadow-[0_0_20px_rgba(255,0,0,0.1)] transition-all mb-6">
                  <Plus size={24} />
              </div>
              <span className="text-[10px] font-black uppercase text-zinc-500 group-hover:text-white transition-colors tracking-[0.2em]">Criar Nova Turma</span>
          </button>
      </div>

      {/* Empty State */}
      {filteredClasses.length === 0 && (
          <div className="text-center py-20 bg-zinc-900/20 rounded-2xl border border-zinc-800/30 flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-600">
                 <GraduationCap size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-700 uppercase">Nenhuma turma encontrada</h3>
                <p className="text-zinc-600 text-xs mt-2">Ajuste os filtros ou crie uma nova turma de simulados.</p>
              </div>
          </div>
      )}

      {/* MODALS */}
      <SimulatedClassForm 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleCreateOrUpdate}
        initialData={editingClass}
        categories={categories}
        loading={isSaving}
      />

      <CategoryManager 
        isOpen={isCatManagerOpen}
        onClose={() => setIsCatManagerOpen(false)}
        categories={categories}
        refreshData={fetchData}
      />

      <ConfirmationModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Turma"
        message={`Deseja excluir a turma "${classToDelete?.title}"? Todos os simulados vinculados serão perdidos (recomenda-se backup).`}
        isLoading={isDeleting}
      />

    </div>
  );
};

export default SimulatedExamsManager;