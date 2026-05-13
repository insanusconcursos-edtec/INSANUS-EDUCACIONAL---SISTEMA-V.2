import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter, Calendar, Users, Edit2, Trash2, AlertTriangle, ChevronDown, ChevronUp, Settings, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Class } from '../../../../types/class';
import { classService } from '../../../../services/classService';
import { classMetadataService, MetadataItem } from '../../../../services/classMetadataService';
import { ClassFormModal } from './ClassFormModal';
import { ClassMetadataManagerModal } from './ClassMetadataManagerModal';
import { formatSafeDateLocal } from '../../../../utils/dateUtils';

// Helper functions moved outside component to be used by ClassCard
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'SALES_OPEN':
      return <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase border border-green-500/20">Matrículas Abertas</span>;
    case 'SALES_CLOSED':
      return <span className="px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] font-bold uppercase border border-yellow-500/20">Matrículas Encerradas</span>;
    case 'SOLD_OUT':
      return <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase border border-red-500/20">Esgotado</span>;
    case 'FINISHED':
      return <span className="px-2 py-1 rounded-full bg-zinc-500/10 text-zinc-500 text-[10px] font-bold uppercase border border-zinc-500/20">Finalizada</span>;
    default:
      return null;
  }
};

const getTypeBadge = (type: string) => {
   return type === 'PRE_EDITAL' 
    ? <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase border border-blue-500/20">Pré-Edital</span>
    : <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase border border-purple-500/20">Pós-Edital</span>;
};

interface ClassCardProps {
  cls: Class;
  onEdit: (cls: Class) => void;
  onDelete: (id: string) => void;
}

const ClassCard: React.FC<ClassCardProps> = ({ cls, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group hover:border-zinc-600 transition-all hover:shadow-xl flex flex-col">
      {/* Cover Image */}
      <div className="relative w-full aspect-[474/1000] overflow-hidden bg-zinc-800">
        {cls.coverImage ? (
          <img 
            src={cls.coverImage} 
            alt={cls.name} 
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700">
            <span className="text-xs uppercase font-bold">Sem Capa</span>
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          {getStatusBadge(cls.status)}
          {getTypeBadge(cls.type)}
        </div>
      </div>

      {/* Accordion Trigger */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800"
      >
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Detalhes da Turma</span>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-3 bg-zinc-900/50 animate-in slide-in-from-top-2 duration-200 flex-1">
          <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Início: {formatSafeDateLocal(cls.startDate)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{cls.modality}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
             <div className="bg-zinc-800/50 p-2 rounded border border-zinc-700/50">
                <span className="block text-zinc-500 text-[10px] uppercase font-bold">Encontros</span>
                <span className="text-white font-medium">{cls.totalMeetings}</span>
             </div>
             <div className="bg-zinc-800/50 p-2 rounded border border-zinc-700/50">
                <span className="block text-zinc-500 text-[10px] uppercase font-bold">Turno</span>
                <span className="text-white font-medium">
                  {cls.shift === 'MORNING' ? 'Manhã' : cls.shift === 'AFTERNOON' ? 'Tarde' : 'Noite'}
                </span>
             </div>
          </div>
        </div>
      )}

      {/* Manage Button */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800">
        <button
          onClick={() => navigate(`/admin/presencial/${cls.id}`)}
          className="w-full flex items-center justify-center gap-2 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider transition-colors shadow-lg shadow-brand-red/20"
        >
          <Settings className="w-4 h-4" />
          Gerenciar Turma
        </button>
      </div>

      {/* Actions Footer */}
      <div className="p-3 grid grid-cols-2 gap-2 border-t border-zinc-800 bg-zinc-950/30 mt-auto">
        <button
          onClick={() => onEdit(cls)}
          className="flex items-center justify-center gap-2 p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-xs font-bold uppercase"
        >
          <Edit2 className="w-3 h-3" />
          Editar
        </button>
        <button
          onClick={() => onDelete(cls.id)}
          className="flex items-center justify-center gap-2 p-2 rounded hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-colors text-xs font-bold uppercase"
        >
          <Trash2 className="w-3 h-3" />
          Excluir
        </button>
      </div>
    </div>
  );
};

export const ClassList: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  
  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, classId: string | null }>({ isOpen: false, classId: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Metadata States
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [categories, setCategories] = useState<MetadataItem[]>([]);
  const [subcategories, setSubcategories] = useState<MetadataItem[]>([]);
  const [organizations, setOrganizations] = useState<MetadataItem[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const data = await classService.getClasses();
      setClasses(data);
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [cats, subs, orgs] = await Promise.all([
        classMetadataService.getCategories(),
        classMetadataService.getSubcategories(),
        classMetadataService.getOrganizations()
      ]);
      setCategories(cats);
      setSubcategories(subs);
      setOrganizations(orgs);
    } catch (error) {
      console.error("Error fetching metadata:", error);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchMetadata();
  }, []);

  const confirmDelete = async () => {
    if (!deleteModal.classId) return;
    
    try {
      setIsDeleting(true);
      await classService.deleteClass(deleteModal.classId);
      await fetchClasses();
      setDeleteModal({ isOpen: false, classId: null });
    } catch (error) {
      console.error("Error deleting class:", error);
      alert("Erro ao excluir turma. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreate = () => {
    setSelectedClass(null);
    setIsModalOpen(true);
  };

  const handleEdit = (cls: Class) => {
    setSelectedClass(cls);
    setIsModalOpen(true);
  };

  const filteredClasses = classes.filter(cls => {
    const matchesName = cls.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter ? cls.category === categoryFilter : true;
    const matchesSubcategory = subcategoryFilter ? cls.subcategory === subcategoryFilter : true;
    const matchesOrg = orgFilter ? cls.organization?.toLowerCase().includes(orgFilter.toLowerCase()) : true;
    return matchesName && matchesCategory && matchesSubcategory && matchesOrg;
  });

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto flex-1">
          {/* Search Name */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Pesquisar turma..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-brand-red transition-colors"
            />
          </div>

          {/* Category */}
          <div className="relative min-w-[180px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-brand-red transition-colors appearance-none"
            >
              <option value="">Todas Categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          <div className="relative min-w-[180px]">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select 
              value={subcategoryFilter}
              onChange={(e) => setSubcategoryFilter(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-brand-red transition-colors appearance-none"
            >
              <option value="">Todas Subcategorias</option>
              {subcategories.map((sub) => (
                <option key={sub.id} value={sub.name}>{sub.name}</option>
              ))}
            </select>
          </div>

          {/* Organization */}
          <div className="relative min-w-[150px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select 
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-brand-red transition-colors appearance-none"
            >
              <option value="">Todos Órgãos</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.name}>{org.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={() => setIsMetadataModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg font-bold uppercase text-xs tracking-wider transition-colors border border-zinc-700 shadow-lg"
        >
          <Settings className="w-4 h-4" />
          Gerenciar
        </button>

        <button 
          onClick={handleCreate}
          className="flex items-center gap-2 px-6 py-2 bg-brand-red hover:bg-red-600 text-white rounded-lg font-bold uppercase text-xs tracking-wider transition-colors shadow-lg shadow-brand-red/20 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Nova Turma
        </button>
      </div>

      {/* Classes Grid */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">Carregando turmas...</div>
      ) : filteredClasses.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
          Nenhuma turma encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
          {filteredClasses.map((cls) => (
            <ClassCard 
              key={cls.id} 
              cls={cls} 
              onEdit={handleEdit} 
              onDelete={(id) => setDeleteModal({ isOpen: true, classId: id })} 
            />
          ))}
        </div>
      )}
      
      <ClassFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchClasses();
        }}
        classToEdit={selectedClass}
      />

      <ClassMetadataManagerModal
        isOpen={isMetadataModalOpen}
        onClose={() => {
          setIsMetadataModalOpen(false);
          fetchMetadata();
        }}
      />

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Excluir Turma</h3>
            </div>
            
            <p className="text-zinc-400 mb-6">
              Tem certeza que deseja excluir esta turma? Esta ação não poderá ser desfeita e removerá todos os dados associados.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, classId: null })}
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
