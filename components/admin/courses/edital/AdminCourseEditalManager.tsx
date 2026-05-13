import React, { useState, useEffect } from 'react';
import { CourseEditalStructure, CourseEditalDiscipline } from '../../../../types/courseEdital';
import { courseService } from '../../../../services/courseService';
import { AdminCourseEditalDiscipline } from './AdminCourseEditalDiscipline';
import { Loader2, Plus } from 'lucide-react';
import ConfirmationModal from '../../../../components/ui/ConfirmationModal';

interface EditalManagerProps {
    courseId: string;
}

// Helper para gerar ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export const AdminCourseEditalManager: React.FC<EditalManagerProps> = ({ courseId }) => {
    const [editalStatus, setEditalStatus] = useState<'PRE_EDITAL' | 'POS_EDITAL'>('PRE_EDITAL');
    const [disciplines, setDisciplines] = useState<CourseEditalDiscipline[]>([]);
    const [loading, setLoading] = useState(true);

    // Estados para Exclusão (Modal)
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [disciplineToDelete, setDisciplineToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // 1. Carregar dados do Edital
    useEffect(() => {
        const fetchEdital = async () => {
            setLoading(true);
            try {
                const data = await courseService.getCourseEdital(courseId);
                if (data) {
                    setEditalStatus(data.status);
                    setDisciplines(data.disciplines);
                } else {
                    // Inicializa se não existir
                    setEditalStatus('PRE_EDITAL');
                    setDisciplines([]);
                }
            } catch (error) {
                console.error("Erro ao carregar edital", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEdital();
    }, [courseId]);

    // Função auxiliar para salvar no banco
    const saveToFirestore = async (newStatus: 'PRE_EDITAL' | 'POS_EDITAL', newDisciplines: CourseEditalDiscipline[]) => {
        const structure: CourseEditalStructure = {
            courseId,
            status: newStatus,
            disciplines: newDisciplines,
            updatedAt: new Date()
        };
        await courseService.saveCourseEdital(structure);
    };

    // Handler de Status
    const handleStatusChange = async (newStatus: 'PRE_EDITAL' | 'POS_EDITAL') => {
        setEditalStatus(newStatus);
        await saveToFirestore(newStatus, disciplines);
    };

    // Adicionar Nova Disciplina
    const handleAddDiscipline = async () => {
        const newDiscipline: CourseEditalDiscipline = {
            id: generateId(),
            name: 'Nova Disciplina',
            topics: []
        };
        
        // Adiciona no início (unshift) para visibilidade imediata ou no fim (push). 
        // Padrão geralmente é fim.
        const updatedDisciplines = [...disciplines, newDiscipline];
        setDisciplines(updatedDisciplines);
        await saveToFirestore(editalStatus, updatedDisciplines);
    };

    // Callback para Atualização de Disciplinas (Passado para filhos)
    const handleDisciplineUpdate = async (updatedDiscipline: CourseEditalDiscipline) => {
        const updatedList = disciplines.map(d => d.id === updatedDiscipline.id ? updatedDiscipline : d);
        setDisciplines(updatedList);
        await saveToFirestore(editalStatus, updatedList);
    };

    // --- REORDENAÇÃO DE DISCIPLINAS ---
    const handleMoveDiscipline = async (index: number, direction: 'up' | 'down') => {
        if (
          (direction === 'up' && index === 0) || 
          (direction === 'down' && index === disciplines.length - 1)
        ) return;
    
        const newDisciplines = [...disciplines];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        // Troca os elementos de posição (Array Swap)
        [newDisciplines[index], newDisciplines[targetIndex]] = [newDisciplines[targetIndex], newDisciplines[index]];
        
        // Atualiza a tela imediatamente
        setDisciplines(newDisciplines);
    
        // Salva no banco de dados com a nova ordem
        try {
          await saveToFirestore(editalStatus, newDisciplines);
        } catch (error) {
          console.error("Erro ao reordenar disciplinas:", error);
          alert("Erro ao salvar a nova ordem.");
        }
    };

    // --- CONTROLE DE EXCLUSÃO ---

    const handleDeleteClick = (disciplineId: string) => {
        setDisciplineToDelete(disciplineId);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!disciplineToDelete) return;
        
        setIsDeleting(true);
        try {
            const updatedDisciplines = disciplines.filter(d => d.id !== disciplineToDelete);
            await saveToFirestore(editalStatus, updatedDisciplines);
            setDisciplines(updatedDisciplines);
            setIsDeleteModalOpen(false);
            setDisciplineToDelete(null);
        } catch (error) {
            console.error("Erro ao excluir disciplina:", error);
            alert("Não foi possível excluir a disciplina. Tente novamente.");
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-red-600" /></div>;

    return (
        <div className="flex flex-col w-full max-w-5xl mx-auto p-4 animate-in fade-in pb-20">
            {/* CABEÇALHO E STATUS DO EDITAL */}
            <div className="bg-[#1a1d24] p-6 rounded-xl border border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-wider">Edital Verticalizado</h2>
                    <p className="text-gray-400 text-sm mt-1">Estruture os tópicos e vincule aulas, materiais e revisões.</p>
                </div>

                {/* CONTROLE DE STATUS (PRÉ/PÓS EDITAL) */}
                <div className="flex bg-black p-1 rounded-lg border border-gray-800">
                    <button
                        onClick={() => handleStatusChange('PRE_EDITAL')}
                        className={`px-6 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all ${
                            editalStatus === 'PRE_EDITAL' 
                            ? 'bg-yellow-500 text-black shadow-lg' 
                            : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        Pré-Edital
                    </button>
                    <button
                        onClick={() => handleStatusChange('POS_EDITAL')}
                        className={`px-6 py-2 rounded-md font-bold text-xs uppercase tracking-wider transition-all ${
                            editalStatus === 'POS_EDITAL' 
                            ? 'bg-red-600 text-white shadow-lg' 
                            : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        Pós-Edital
                    </button>
                </div>
            </div>

            {/* BOTÃO ADICIONAR DISCIPLINA */}
            <button 
                onClick={handleAddDiscipline}
                className="w-full py-4 bg-transparent border-2 border-dashed border-gray-700 hover:border-yellow-500 text-gray-500 hover:text-yellow-500 rounded-xl font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 mb-6 shrink-0"
            >
                <Plus className="w-5 h-5" />
                Adicionar Disciplina
            </button>
            
            {/* LISTA DE DISCIPLINAS (Sem Scroll Interno, scroll via body) */}
            <div className="space-y-4">
                {disciplines.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-gray-800 rounded-xl text-gray-500">
                        Nenhuma disciplina criada.
                    </div>
                )}
                
                {disciplines.map((discipline, index) => (
                    <AdminCourseEditalDiscipline 
                        key={discipline.id} 
                        discipline={discipline} 
                        courseId={courseId}
                        onUpdate={handleDisciplineUpdate}
                        onDelete={() => handleDeleteClick(discipline.id)}
                        // Props de Reordenação
                        onMoveUp={() => handleMoveDiscipline(index, 'up')}
                        onMoveDown={() => handleMoveDiscipline(index, 'down')}
                        isFirst={index === 0}
                        isLast={index === disciplines.length - 1}
                    />
                ))}
            </div>

            {/* MODAL DE CONFIRMAÇÃO */}
            <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setDisciplineToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="Excluir Disciplina?"
                message="Tem certeza que deseja excluir esta disciplina? Todos os tópicos, materiais e vínculos dentro dela serão perdidos permanentemente."
                confirmText="Sim, Excluir"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
};