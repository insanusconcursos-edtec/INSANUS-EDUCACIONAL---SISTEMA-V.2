import React, { useState, useEffect } from 'react';
import { X, Search, BookOpen, Folder } from 'lucide-react';
import { courseService } from '../../../services/courseService';

interface SelectionData {
  moduleId: string;
  moduleName: string;
  folderId: string;
  folderName: string;
}

interface TeachingAreaSelectorModalProps {
  isOpen: boolean;
  classId: string;
  onClose: () => void;
  onSelect: (data: SelectionData) => void;
}

export const TeachingAreaSelectorModal: React.FC<TeachingAreaSelectorModalProps> = ({ isOpen, classId, onClose, onSelect }) => {
  const [teachingModules, setTeachingModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && classId) {
      loadTeachingArea();
    } else {
      setSearchTerm('');
    }
  }, [isOpen, classId]);

  const loadTeachingArea = async () => {
    setLoading(true);
    try {
      // Buscamos a estrutura da Área de Ensino vinculada a esta turma
      // Por padrão, usamos o classId como identificador da área de ensino
      const data = await courseService.getCourseStructure(classId);
      setTeachingModules(data);
    } catch (error) {
      console.error("Erro ao carregar Área de Ensino:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredModules = teachingModules.filter(module => {
    const moduleMatch = (module.title || module.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const folderMatch = module.folders?.some((f: any) => 
      (f.title || f.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    return moduleMatch || folderMatch;
  });

  const handleSelectFolder = (moduleItem: any, folderItem: any) => {
    onSelect({
      moduleId: moduleItem.id,
      moduleName: moduleItem.title || moduleItem.name,
      folderId: folderItem.id,
      folderName: folderItem.title || folderItem.name
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden h-[80vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-red-500" />
            Vincular à Área de Ensino
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          
          {/* Barra de Pesquisa */}
          <div className="p-4 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Buscar módulo ou pasta..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-red-500 transition"
              />
            </div>
          </div>

          {/* Navegação Estrutural */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex justify-center items-center h-full text-gray-400">Carregando estrutura...</div>
            ) : (
              <div className="flex flex-col gap-2 p-2">
                {filteredModules.length > 0 ? (
                  filteredModules.map((module: any) => (
                    <div key={module.id} className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden mb-3">
                      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700/50">
                        <span className="font-semibold text-gray-200 text-sm uppercase tracking-tight">{module.title || module.name}</span>
                      </div>
                      <div className="p-2 flex flex-col gap-1">
                        {module.folders && module.folders.length > 0 ? (
                          module.folders.map((folder: any) => (
                            <button
                              key={folder.id}
                              onClick={() => handleSelectFolder(module, folder)}
                              className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 transition text-left group"
                            >
                              <Folder size={16} className="text-amber-500 opacity-70 group-hover:opacity-100" />
                              <span className="text-gray-400 text-sm group-hover:text-white transition">{folder.title || folder.name}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-xs text-gray-500 italic">Nenhuma pasta neste módulo.</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    {searchTerm ? 'Nenhum resultado para sua busca.' : 'Nenhum módulo encontrado nesta Área de Ensino.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
