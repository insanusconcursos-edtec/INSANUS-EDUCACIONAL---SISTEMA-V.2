
import React, { useState, useEffect } from 'react';
import { 
  X, Save, FileText, Upload, Plus, Trash2, 
  AlertTriangle, CheckCircle, Scale, Layers, Settings, FileCheck, Info, Clock 
} from 'lucide-react';
import { 
  SimulatedExam, 
  ExamType, 
  ExamBlock, 
  addExamToClass, 
  updateExam 
} from '../../../services/simulatedService';

interface SimulatedExamConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  examToEdit?: SimulatedExam | null;
  onSuccess: () => void;
}

const SimulatedExamConfigModal: React.FC<SimulatedExamConfigModalProps> = ({ 
  isOpen, onClose, classId, examToEdit, onSuccess 
}) => {
  // === STATE ===
  const [loading, setLoading] = useState(false);
  
  // Basic Data
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ExamStatus>('draft');
  const [publishDate, setPublishDate] = useState<string>('');
  const [type, setType] = useState<ExamType>('multiple_choice');
  const [alternativesCount, setAlternativesCount] = useState<number>(5);
  const [questionCount, setQuestionCount] = useState<number>(0);
  
  // Duration State
  const [durationHours, setDurationHours] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  
  // Files
  const [bookletFile, setBookletFile] = useState<File | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  // Keep track of existing URLs
  const [existingFiles, setExistingFiles] = useState<{ booklet?: string, answerKey?: string }>({});

  // Advanced Rules
  const [hasPenalty, setHasPenalty] = useState(false);
  const [minApprovalPercent, setMinApprovalPercent] = useState<number>(50);
  const [isAutoDiagnosisEnabled, setIsAutoDiagnosisEnabled] = useState(false);

  // Leveling System
  const [isLeveling, setIsLeveling] = useState(false);
  const [levelingRanges, setLevelingRanges] = useState({
    beginner: 50,
    intermediate: 70,
    advanced: 89,
    insane: 100
  });
  
  // Blocks System
  const [hasBlocks, setHasBlocks] = useState(false);
  const [blocks, setBlocks] = useState<ExamBlock[]>([]);

  // Helper to calculate discipline ranges
  const getBlockStartIndex = (blockIndex: number) => {
    let totalBefore = 0;
    for (let i = 0; i < blockIndex; i++) {
        totalBefore += Number(blocks[i].questionCount || 0);
    }
    return totalBefore;
  };

  const calculateDisciplineRanges = (block: ExamBlock, blockIndex: number) => {
    let currentStart = getBlockStartIndex(blockIndex) + 1;
    return (block.disciplines || []).map(d => {
        const start = currentStart;
        const end = currentStart + (Number(d.questionCount) || 0) - 1;
        currentStart = end + 1;
        return { start, end };
    });
  };

  // === INITIALIZATION ===
  useEffect(() => {
    if (isOpen) {
      if (examToEdit) {
        setTitle(examToEdit.title);
        setStatus(examToEdit.status || 'draft');
        setPublishDate(examToEdit.publishDate || '');
        setType(examToEdit.type);
        setAlternativesCount(examToEdit.alternativesCount || 5);
        setQuestionCount(examToEdit.questionCount);
        setHasPenalty(examToEdit.hasPenalty);
        setMinApprovalPercent(examToEdit.minApprovalPercent);
        setIsAutoDiagnosisEnabled(examToEdit.isAutoDiagnosisEnabled);
        setIsLeveling(examToEdit.isLeveling || false);
        if (examToEdit.levelingRanges) setLevelingRanges(examToEdit.levelingRanges);
        setHasBlocks(examToEdit.hasBlocks);
        setBlocks(examToEdit.blocks || []);
        
        // Load Duration
        if (examToEdit.duration) {
            setDurationHours(Math.floor(examToEdit.duration / 60));
            setDurationMinutes(examToEdit.duration % 60);
        } else {
            setDurationHours(0);
            setDurationMinutes(0);
        }

        // Map existing URLs safely
        setExistingFiles({
            booklet: examToEdit.files?.bookletUrl,
            answerKey: examToEdit.files?.answerKeyUrl
        });
      } else {
        // Reset Defaults
        setTitle('');
        setStatus('draft');
        setPublishDate('');
        setType('multiple_choice');
        setAlternativesCount(5);
        setQuestionCount(60);
        setDurationHours(4); // Default suggested duration
        setDurationMinutes(0);
        setHasPenalty(false);
        setMinApprovalPercent(50);
        setIsAutoDiagnosisEnabled(false);
        setIsLeveling(false);
        setLevelingRanges({
            beginner: 50,
            intermediate: 70,
            advanced: 89,
            insane: 100
        });
        setHasBlocks(false);
        setBlocks([]);
        setExistingFiles({});
      }
      setBookletFile(null);
      setAnswerKeyFile(null);
    }
  }, [isOpen, examToEdit]);

  if (!isOpen) return null;

  // === HANDLERS ===

  // Block Logic
  const handleAddBlock = () => {
    setBlocks([...blocks, { name: '', questionCount: 0, minApproval: 0, disciplines: [] }]);
  };

  const handleBlockChange = (index: number, field: keyof ExamBlock, value: any) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], [field]: value };
    setBlocks(newBlocks);
  };

  const handleRemoveBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const handleAddDiscipline = (blockIndex: number) => {
    const newBlocks = [...blocks];
    const block = newBlocks[blockIndex];
    newBlocks[blockIndex] = {
        ...block,
        disciplines: [...(block.disciplines || []), { id: crypto.randomUUID(), name: '', questionCount: 0 }]
    };
    setBlocks(newBlocks);
  };

  const handleDisciplineChange = (blockIndex: number, discIndex: number, field: keyof BlockDiscipline, value: any) => {
    const newBlocks = [...blocks];
    const disciplines = [...(newBlocks[blockIndex].disciplines || [])];
    disciplines[discIndex] = { ...disciplines[discIndex], [field]: value };
    newBlocks[blockIndex].disciplines = disciplines;
    setBlocks(newBlocks);
  };

  const handleRemoveDiscipline = (blockIndex: number, discIndex: number) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].disciplines = (newBlocks[blockIndex].disciplines || []).filter((_, i) => i !== discIndex);
    setBlocks(newBlocks);
  };

  // Validation
  const blocksTotalQuestions = blocks.reduce((acc, b) => acc + (Number(b.questionCount) || 0), 0);
  const isBlockCountValid = !hasBlocks || blocksTotalQuestions === Number(questionCount);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return alert("O título é obrigatório.");
    
    const totalDuration = (Number(durationHours) * 60) + Number(durationMinutes);
    if (totalDuration <= 0) return alert("A duração da prova deve ser maior que 0 minutos.");

    if (hasBlocks && !isBlockCountValid) {
        return alert(`ERRO DE VALIDAÇÃO: A soma das questões dos blocos (${blocksTotalQuestions}) deve ser igual ao total de questões do simulado (${questionCount}).`);
    }

    // New validation: check if sum of disciplines matches block count
    if (hasBlocks) {
        for (const block of blocks) {
            const discSum = (block.disciplines || []).reduce((acc, d) => acc + (Number(d.questionCount) || 0), 0);
            if (discSum !== Number(block.questionCount)) {
                return alert(`ERRO DE VALIDAÇÃO NO BLOCO "${block.name}": A soma das questões das disciplinas (${discSum}) deve ser igual ao total de questões do bloco (${block.questionCount}).`);
            }
        }
    }

    setLoading(true);
    try {
        const examData: any = {
            title,
            publishDate: publishDate || null,
            type,
            questionCount: Number(questionCount),
            duration: totalDuration,
            hasPenalty,
            hasBlocks,
            minApprovalPercent: Number(minApprovalPercent),
            isAutoDiagnosisEnabled,
            isLeveling,
            levelingRanges: isLeveling ? levelingRanges : undefined,
            status: status
        };

        if (type === 'multiple_choice') {
            examData.alternativesCount = Number(alternativesCount);
        }

        if (hasBlocks) {
            examData.blocks = blocks.map(b => ({
                ...b,
                questionCount: Number(b.questionCount),
                minApproval: Number(b.minApproval)
            }));
        } else {
            examData.blocks = [];
        }

        let filesToUpload;
        if (bookletFile || answerKeyFile) {
            filesToUpload = {
                ...(bookletFile && { booklet: bookletFile }),
                ...(answerKeyFile && { answerKey: answerKeyFile })
            };
        }

        if (examToEdit && examToEdit.id) {
            await updateExam(classId, examToEdit.id, examData, filesToUpload);
        } else {
            await addExamToClass(classId, examData, filesToUpload || {});
        }

        onSuccess();
        onClose();
    } catch (error) {
        console.error("Erro ao salvar simulado:", error);
        alert("Erro ao salvar. Verifique o console.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500 border border-purple-500/20">
                <FileCheck size={20} />
             </div>
             <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                    {examToEdit ? 'Editar Simulado' : 'Novo Simulado'}
                </h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Configuração e Arquivos</p>
             </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            {/* SEÇÃO 1: DADOS BÁSICOS */}
            <section className="space-y-4">
                <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-2 border-b border-purple-500/10 pb-2">
                    <Settings size={14} /> Dados Básicos
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Título do Simulado</label>
                        <input 
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="EX: SIMULADO 01 - PROVA OBJETIVA"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 uppercase font-bold"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Data de Publicação (Opcional)</label>
                        <input 
                            type="datetime-local"
                            value={publishDate}
                            onChange={e => setPublishDate(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                        <p className="text-[9px] text-zinc-500 italic">Deixe vazio para liberar imediatamente.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Tipo de Questão</label>
                        <select 
                            value={type}
                            onChange={e => setType(e.target.value as ExamType)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                        >
                            <option value="multiple_choice">Múltipla Escolha (ABCDE)</option>
                            <option value="true_false">Certo / Errado (Cespe)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Status de Publicação</label>
                        <select 
                            value={status}
                            onChange={e => setStatus(e.target.value as ExamStatus)}
                            className={`w-full bg-zinc-900 border rounded-lg px-4 py-3 text-sm font-bold focus:outline-none transition-all ${
                                status === 'published' ? 'text-emerald-400 border-emerald-500/30' : 'text-zinc-400 border-zinc-800'
                            }`}
                        >
                            <option value="draft">RASCUNHO (OCULTO PARA ALUNOS)</option>
                            <option value="published">PUBLICADO (VISÍVEL PARA ALUNOS)</option>
                        </select>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">Qtd. Questões</label>
                            <input 
                                type="number"
                                value={questionCount}
                                onChange={e => setQuestionCount(Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                            />
                        </div>
                        
                        {type === 'multiple_choice' && (
                            <div className="flex-1 space-y-2">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Alternativas</label>
                                <select 
                                    value={alternativesCount}
                                    onChange={e => setAlternativesCount(Number(e.target.value))}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                                >
                                    <option value={4}>4 (A-D)</option>
                                    <option value={5}>5 (A-E)</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* DURATION INPUTS */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-zinc-900/20 p-3 rounded-xl border border-zinc-800/50">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2">
                                <Clock size={12} /> Duração (Horas)
                            </label>
                            <input 
                                type="number"
                                min="0"
                                value={durationHours}
                                onChange={e => setDurationHours(Math.max(0, Number(e.target.value)))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 font-mono text-center"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-2">
                                <Clock size={12} /> Duração (Minutos)
                            </label>
                            <input 
                                type="number"
                                min="0"
                                max="59"
                                value={durationMinutes}
                                onChange={e => setDurationMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 font-mono text-center"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 2: ARQUIVOS */}
            <section className="space-y-4">
                <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-2 border-b border-purple-500/10 pb-2">
                    <FileText size={14} /> Arquivos PDF
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Caderno de Questões */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Caderno de Questões</label>
                        <div className="relative group">
                            <input 
                                type="file" 
                                accept=".pdf"
                                onChange={e => setBookletFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className={`
                                border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all
                                ${bookletFile ? 'border-purple-500 bg-purple-500/10' : existingFiles.booklet ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'}
                            `}>
                                <Upload size={20} className={bookletFile ? 'text-purple-400' : existingFiles.booklet ? 'text-emerald-500' : 'text-zinc-600'} />
                                <span className={`text-xs font-bold uppercase truncate max-w-full px-2 ${bookletFile ? 'text-purple-400' : existingFiles.booklet ? 'text-emerald-500' : 'text-zinc-400'}`}>
                                    {bookletFile ? bookletFile.name : (existingFiles.booklet ? 'Substituir Caderno' : 'Enviar PDF')}
                                </span>
                            </div>
                        </div>
                        {existingFiles.booklet && !bookletFile && (
                            <div className="flex items-center justify-between px-1">
                                <p className="text-[9px] text-emerald-500/80 font-bold uppercase flex items-center gap-1">
                                    <FileCheck size={12} /> Arquivo já vinculado
                                </p>
                                <a 
                                    href={existingFiles.booklet} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-[9px] text-zinc-500 hover:text-white underline font-bold"
                                >
                                    Visualizar Atual
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Gabarito */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Gabarito Oficial/Comentado</label>
                        <div className="relative group">
                            <input 
                                type="file" 
                                accept=".pdf"
                                onChange={e => setAnswerKeyFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className={`
                                border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all
                                ${answerKeyFile ? 'border-purple-500 bg-purple-500/10' : existingFiles.answerKey ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'}
                            `}>
                                <Upload size={20} className={answerKeyFile ? 'text-purple-400' : existingFiles.answerKey ? 'text-emerald-500' : 'text-zinc-600'} />
                                <span className={`text-xs font-bold uppercase truncate max-w-full px-2 ${answerKeyFile ? 'text-purple-400' : existingFiles.answerKey ? 'text-emerald-500' : 'text-zinc-400'}`}>
                                    {answerKeyFile ? answerKeyFile.name : (existingFiles.answerKey ? 'Substituir Gabarito' : 'Enviar PDF')}
                                </span>
                            </div>
                        </div>
                        {existingFiles.answerKey && !answerKeyFile && (
                            <div className="flex items-center justify-between px-1">
                                <p className="text-[9px] text-emerald-500/80 font-bold uppercase flex items-center gap-1">
                                    <FileCheck size={12} /> Arquivo já vinculado
                                </p>
                                <a 
                                    href={existingFiles.answerKey} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-[9px] text-zinc-500 hover:text-white underline font-bold"
                                >
                                    Visualizar Atual
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* SEÇÃO 3: REGRAS AVANÇADAS */}
            <section className="space-y-6">
                <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-2 border-b border-purple-500/10 pb-2">
                    <Scale size={14} /> Regras do Simulado
                </h3>

                {/* Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Penalidade */}
                    <div className={`p-4 rounded-xl border transition-all ${hasPenalty ? 'bg-red-900/20 border-red-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-black uppercase ${hasPenalty ? 'text-red-400' : 'text-zinc-400'}`}>Sistema de Penalidade</span>
                            <div 
                                onClick={() => setHasPenalty(!hasPenalty)}
                                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${hasPenalty ? 'bg-red-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${hasPenalty ? 'translate-x-5' : ''}`} />
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight">
                            Uma questão errada anula uma certa. Comum em provas estilo Cebraspe.
                        </p>
                    </div>

                    {/* Simulado de Nivelamento */}
                    <div className={`p-4 rounded-xl border transition-all ${isLeveling ? 'bg-purple-900/20 border-purple-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-black uppercase ${isLeveling ? 'text-purple-400' : 'text-zinc-400'}`}>Simulado de Nivelamento?</span>
                            <div 
                                onClick={() => setIsLeveling(!isLeveling)}
                                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isLeveling ? 'bg-purple-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isLeveling ? 'translate-x-5' : ''}`} />
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight">
                            Define automaticamente o nível do aluno (Iniciante, Intermediário, Avançado ou Insano) baseado no resultado.
                        </p>
                    </div>

                    {/* Auto Diagnóstico */}
                    <div className={`p-4 rounded-xl border transition-all ${isAutoDiagnosisEnabled ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-black uppercase ${isAutoDiagnosisEnabled ? 'text-emerald-400' : 'text-zinc-400'}`}>Autodiagnóstico</span>
                            <div 
                                onClick={() => setIsAutoDiagnosisEnabled(!isAutoDiagnosisEnabled)}
                                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${isAutoDiagnosisEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isAutoDiagnosisEnabled ? 'translate-x-5' : ''}`} />
                            </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-tight">
                            Gera gráficos de desempenho e análise de pontos fracos ao finalizar.
                        </p>
                    </div>
                </div>

                {/* Leveling Ranges Config */}
                {isLeveling && (
                  <div className="bg-zinc-900/30 rounded-xl border border-purple-500/30 p-4 space-y-4 animate-in slide-in-from-top-2">
                    <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Faixas de Rendimento (Até %)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase">Iniciante</label>
                        <input 
                          type="number"
                          value={levelingRanges.beginner}
                          onChange={e => setLevelingRanges({...levelingRanges, beginner: Number(e.target.value)})}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase">Intermediário</label>
                        <input 
                          type="number"
                          value={levelingRanges.intermediate}
                          onChange={e => setLevelingRanges({...levelingRanges, intermediate: Number(e.target.value)})}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase">Avançado</label>
                        <input 
                          type="number"
                          value={levelingRanges.advanced}
                          onChange={e => setLevelingRanges({...levelingRanges, advanced: Number(e.target.value)})}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase">Insano</label>
                        <input 
                          type="number"
                          value={levelingRanges.insane}
                          onChange={e => setLevelingRanges({...levelingRanges, insane: Number(e.target.value)})}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Divisão por Blocos */}
                <div className="bg-zinc-900/30 rounded-xl border border-zinc-800 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-xs font-black text-white uppercase flex items-center gap-2">
                                <Layers size={14} /> Divisão por Blocos
                            </span>
                            <p className="text-[10px] text-zinc-500 mt-1">Dividir a prova em áreas de conhecimento.</p>
                        </div>
                        <div 
                            onClick={() => setHasBlocks(!hasBlocks)}
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${hasBlocks ? 'bg-purple-500' : 'bg-zinc-700'}`}
                        >
                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${hasBlocks ? 'translate-x-5' : ''}`} />
                        </div>
                    </div>

                    {hasBlocks && (
                        <div className="space-y-6 animate-in slide-in-from-top-2">
                            {blocks.map((block, index) => {
                                const discSum = (block.disciplines || []).reduce((acc, d) => acc + (Number(d.questionCount) || 0), 0);
                                const remaining = Number(block.questionCount) - discSum;
                                const ranges = calculateDisciplineRanges(block, index);

                                return (
                                <div key={index} className="space-y-4 bg-zinc-950 p-6 rounded-xl border border-zinc-800 relative group">
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveBlock(index)}
                                        className="absolute top-4 right-4 p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pr-10">
                                        <div className="md:col-span-2 space-y-1">
                                            <label className="text-[9px] font-bold text-zinc-500 uppercase">Nome do Bloco</label>
                                            <input 
                                                value={block.name}
                                                onChange={e => handleBlockChange(index, 'name', e.target.value)}
                                                placeholder="Ex: Conhecimentos Gerais"
                                                className="w-full bg-zinc-900 border-b border-zinc-800 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-zinc-500 uppercase">Total Bloco</label>
                                            <input 
                                                type="number"
                                                value={block.questionCount}
                                                onChange={e => handleBlockChange(index, 'questionCount', Number(e.target.value))}
                                                className="w-full bg-zinc-900 border-b border-zinc-800 px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-purple-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-zinc-500 uppercase">Min % Aprovação</label>
                                            <input 
                                                type="number"
                                                value={block.minApproval}
                                                onChange={e => handleBlockChange(index, 'minApproval', Number(e.target.value))}
                                                className="w-full bg-zinc-900 border-b border-zinc-800 px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-purple-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Disciplinas do Bloco */}
                                    <div className="pl-4 border-l-2 border-zinc-800 space-y-3 mt-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Disciplinas do Bloco</h4>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${remaining === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                                    Questões restantes: {remaining}
                                                </span>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => handleAddDiscipline(index)}
                                                className="text-[9px] font-black text-purple-400 hover:text-purple-300 uppercase flex items-center gap-1"
                                            >
                                                <Plus size={10} /> Add Disciplina
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {(block.disciplines || []).map((disc, dIdx) => (
                                                <div key={dIdx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-zinc-900/40 p-2 rounded-lg border border-zinc-800/50">
                                                    <div className="md:col-span-5">
                                                        <input 
                                                            value={disc.name}
                                                            onChange={e => handleDisciplineChange(index, dIdx, 'name', e.target.value)}
                                                            placeholder="Nome da Disciplina"
                                                            className="w-full bg-transparent border-b border-zinc-800 text-[11px] text-white py-1 focus:outline-none focus:border-purple-500"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <input 
                                                            type="number"
                                                            value={disc.questionCount}
                                                            onChange={e => handleDisciplineChange(index, dIdx, 'questionCount', Number(e.target.value))}
                                                            placeholder="Qtd"
                                                            className="w-full bg-transparent border-b border-zinc-800 text-[11px] text-white text-center py-1 focus:outline-none focus:border-purple-500"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-4 text-[9px] font-bold text-zinc-500 uppercase px-2 py-1 bg-zinc-950 rounded border border-zinc-800/50 text-center">
                                                        Questões {String(ranges[dIdx]?.start || 0).padStart(2, '0')} a {String(ranges[dIdx]?.end || 0).padStart(2, '0')}
                                                    </div>
                                                    <div className="md:col-span-1 flex justify-end">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleRemoveDiscipline(index, dIdx)}
                                                            className="p-1 text-zinc-600 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(block.disciplines || []).length === 0 && (
                                                <div className="text-[10px] text-zinc-600 font-bold uppercase py-4 text-center border border-dashed border-zinc-800 rounded-lg">
                                                    Nenhuma disciplina adicionada a este bloco.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )})}
                            
                            <div className="flex items-center justify-between pt-2">
                                <button 
                                    type="button"
                                    onClick={handleAddBlock}
                                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 uppercase flex items-center gap-1"
                                >
                                    <Plus size={12} /> Adicionar Bloco
                                </button>
                                
                                <div className={`text-[10px] font-mono font-bold ${isBlockCountValid ? 'text-emerald-500' : 'text-red-500'}`}>
                                    Soma: {blocksTotalQuestions} / {questionCount}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Aprovação Geral */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Nota Mínima Geral (%)</label>
                    <input 
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={minApprovalPercent}
                        onChange={e => setMinApprovalPercent(Number(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                        <span>0%</span>
                        <span className="text-white font-bold">{minApprovalPercent}%</span>
                        <span>100%</span>
                    </div>
                </div>
            </section>

        </form>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-900 bg-zinc-950 flex justify-end gap-3">
            <button 
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-xs font-bold uppercase tracking-widest transition-all"
            >
                Cancelar
            </button>
            <button 
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Salvando...' : <><Save size={16} /> Salvar Simulado</>}
            </button>
        </div>

      </div>
    </div>
  );
};

export default SimulatedExamConfigModal;
