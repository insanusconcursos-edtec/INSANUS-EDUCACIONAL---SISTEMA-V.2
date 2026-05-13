import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Plus, Settings, FileText, BarChart2, MoreVertical, 
  Trash2, Edit, AlertCircle, FileCheck, Info, ListChecks 
} from 'lucide-react';
import { 
  getSimulatedClassById, 
  getExams, 
  deleteExam,
  SimulatedClass, 
  SimulatedExam 
} from '../../services/simulatedService';
import SimulatedExamConfigModal from '../../components/admin/simulated/SimulatedExamConfigModal';
import SimulatedExamConsole from '../../components/admin/simulated/SimulatedExamConsole';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import Loading from '../../components/ui/Loading';

const SimulatedClassDetails: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  // Data State
  const [simulatedClass, setSimulatedClass] = useState<SimulatedClass | null>(null);
  const [exams, setExams] = useState<SimulatedExam[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState<SimulatedExam | null>(null);
  const [examToDelete, setExamToDelete] = useState<SimulatedExam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Console Navigation State
  const [selectedExamForConsole, setSelectedExamForConsole] = useState<SimulatedExam | null>(null);

  // Fetch Data
  const fetchData = useCallback(async () => {
    if (!classId) return;
    try {
        const [clsData, examsData] = await Promise.all([
            getSimulatedClassById(classId),
            getExams(classId)
        ]);
        
        if (!clsData) {
            alert("Turma não encontrada.");
            navigate('/admin/simulados');
            return;
        }

        setSimulatedClass(clsData);
        setExams(examsData);
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    } finally {
        setLoading(false);
    }
  }, [classId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Actions
  const handleOpenNew = () => {
    setExamToEdit(null);
    setIsConfigOpen(true);
  };

  const handleOpenEdit = (exam: SimulatedExam) => {
    setExamToEdit(exam);
    setIsConfigOpen(true);
  };

  const handleOpenConsole = (exam: SimulatedExam) => {
    setSelectedExamForConsole(exam);
  };

  const handleDeleteRequest = (exam: SimulatedExam) => {
    setExamToDelete(exam);
  };

  const confirmDelete = async () => {
    if (!classId || !examToDelete?.id) return;
    setIsDeleting(true);
    try {
        await deleteExam(classId, examToDelete.id);
        setExams(prev => prev.filter(e => e.id !== examToDelete.id));
        setExamToDelete(null);
    } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir simulado.");
    } finally {
        setIsDeleting(false);
    }
  };

  if (loading) return <Loading />;
  if (!simulatedClass) return null;

  // Render Console View if an exam is selected
  if (selectedExamForConsole && classId) {
      return (
          <SimulatedExamConsole 
              classId={classId}
              exam={selectedExamForConsole}
              onBack={() => setSelectedExamForConsole(null)}
          />
      );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
        
        {/* Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => navigate('/admin/simulados')}
                    className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
                >
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border border-zinc-800 px-2 py-0.5 rounded-full">
                            {simulatedClass.organization}
                        </span>
                        <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 rounded-full">
                            {exams.length} Simulados
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                        {simulatedClass.title}
                    </h1>
                </div>
            </div>

            <button 
                onClick={handleOpenNew}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 transition-all hover:scale-105"
            >
                <Plus size={14} /> Novo Simulado
            </button>
        </div>

        {/* Exams List */}
        <div className="grid grid-cols-1 gap-4">
            {exams.length === 0 ? (
                <div className="text-center py-20 bg-zinc-900/20 rounded-2xl border border-zinc-800/30 border-dashed">
                    <FileCheck size={48} className="mx-auto text-zinc-700 mb-4" />
                    <h3 className="text-lg font-black text-zinc-600 uppercase">Nenhum simulado cadastrado</h3>
                    <p className="text-zinc-500 text-xs mt-1">Crie o primeiro simulado para esta turma.</p>
                </div>
            ) : (
                exams.map((exam) => (
                    <div 
                        key={exam.id}
                        className="group bg-zinc-900 border border-zinc-800 hover:border-purple-500/30 rounded-2xl p-5 flex items-center justify-between transition-all hover:shadow-lg hover:shadow-purple-900/10"
                    >
                        {/* Info Column */}
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col items-center justify-center text-zinc-500 group-hover:text-purple-400 group-hover:border-purple-500/30 transition-colors">
                                <span className="text-xl font-black">{exam.questionCount}</span>
                                <span className="text-[8px] uppercase font-bold tracking-widest">Questões</span>
                            </div>
                            
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">{exam.title}</h3>
                                    {exam.status === 'draft' && (
                                        <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono uppercase">Rascunho</span>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                    <span className="flex items-center gap-1">
                                        <Info size={12} /> {exam.type === 'multiple_choice' ? 'Múltipla Escolha' : 'Certo/Errado'}
                                    </span>
                                    {exam.files.bookletUrl && (
                                        <span className="flex items-center gap-1 text-emerald-500">
                                            <FileText size={12} /> PDF Caderno
                                        </span>
                                    )}
                                    {exam.hasBlocks && (
                                        <span className="flex items-center gap-1 text-blue-500">
                                            <BarChart2 size={12} /> {exam.blocks?.length} Blocos
                                        </span>
                                    )}
                                    {exam.hasPenalty && (
                                        <span className="flex items-center gap-1 text-red-500">
                                            <AlertCircle size={12} /> Penalidade
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions Column */}
                        <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => handleOpenConsole(exam)}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors text-[10px] font-black uppercase tracking-widest border border-zinc-700 hover:border-zinc-600"
                                title="Configurar Gabarito e Regras"
                            >
                                <ListChecks size={14} /> GABARITO & QUESTÕES
                            </button>

                            <button 
                                onClick={() => handleOpenEdit(exam)}
                                className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors"
                                title="Editar Configurações"
                            >
                                <Edit size={16} />
                            </button>
                            <button 
                                onClick={() => handleDeleteRequest(exam)}
                                className="p-2.5 bg-zinc-800 hover:bg-red-900/30 text-zinc-300 hover:text-red-500 rounded-lg transition-colors"
                                title="Excluir Simulado"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Config Modal */}
        {classId && (
            <SimulatedExamConfigModal 
                isOpen={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
                classId={classId}
                examToEdit={examToEdit}
                onSuccess={fetchData}
            />
        )}

        {/* Delete Confirmation */}
        <ConfirmationModal 
            isOpen={!!examToDelete}
            onClose={() => setExamToDelete(null)}
            onConfirm={confirmDelete}
            title="Excluir Simulado"
            message={`Deseja realmente excluir "${examToDelete?.title}"? Esta ação é irreversível.`}
            isLoading={isDeleting}
        />

    </div>
  );
};

export default SimulatedClassDetails;