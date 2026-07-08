
import React, { useEffect, useState, useCallback } from 'react';
import { 
  Plus, Search, Filter, Trash2, Edit, Key, Lock,
  MessageCircle, ShieldCheck, ShieldAlert, AlertTriangle,
  Eye, EyeOff, X
} from 'lucide-react';
import { 
  getStudents, 
  createStudent, 
  updateStudent, 
  updateStudentEmailAdmin,
  updateStudentPasswordAdmin,
  deleteStudent,
  sendPasswordReset,
  blockStudent,
  unblockStudent,
  setExceptionStatus,
  Student, 
  CreateStudentData,
  getStudentById 
} from '../../services/userService';
import { getPlans, Plan } from '../../services/planService';
import { getSimulatedClasses, SimulatedClass } from '../../services/simulatedService';
import { getProducts } from '../../services/productService';
import { TictoProduct } from '../../types/product';
import StudentFormModal from '../../components/admin/students/StudentFormModal';
import StudentAccessManager from '../../components/admin/students/StudentAccessManager';
import SecurityContent from '../../components/admin/students/SecurityContent';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { toast } from 'react-hot-toast';

const StudentManager: React.FC = () => {
  // State
  const [students, setStudents] = useState<Student[]>([]);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [availableClasses, setAvailableClasses] = useState<SimulatedClass[]>([]);
  const [availableProducts, setAvailableProducts] = useState<TictoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState(''); // Filter for Plans
  const [selectedClassFilter, setSelectedClassFilter] = useState(''); // Filter for Simulated Classes
  const [selectedProductFilter, setSelectedProductFilter] = useState(''); // Filter for Products (Combos)
  
  const [activeTab, setActiveTab] = useState<'STUDENTS' | 'SECURITY'>('STUDENTS');
  
  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [managingAccessStudent, setManagingAccessStudent] = useState<Student | null>(null);
  
  // Delete & Block State
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // Controls the actual delete confirmation
  const [showBlockModal, setShowBlockModal] = useState(false);     // Controls the warning block modal

  // Password Reset State
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [studentToReset, setStudentToReset] = useState<Student | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Email Password Reset State
  const [emailResetModalOpen, setEmailResetModalOpen] = useState(false);
  const [studentToEmailReset, setStudentToEmailReset] = useState<Student | null>(null);
  const [isSendingEmailReset, setIsSendingEmailReset] = useState(false);

  // === DATA FETCHING ===
  const fetchData = useCallback(async () => {
    try {
      // Fetch students, plans, classes, and products in parallel
      const [studentsData, plansData, classesData, productsData] = await Promise.all([
        getStudents(),
        getPlans(),
        getSimulatedClasses(),
        getProducts()
      ]);
      
      setStudents(studentsData);
      setAvailablePlans(plansData);
      setAvailableClasses(classesData);
      setAvailableProducts(productsData);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // === HANDLERS ===

  const handleCreateOrUpdate = async (data: CreateStudentData) => {
    if (editingStudent) {
        // Se o e-mail mudou, realiza a atualização síncrona usando o Admin SDK primeiro
        if (editingStudent.email && data.email && editingStudent.email.trim().toLowerCase() !== data.email.trim().toLowerCase()) {
            await updateStudentEmailAdmin(editingStudent.uid, data.email);
        }
        
        // Atualiza os demais campos cadastrais
        await updateStudent(editingStudent.uid, {
            name: data.name.toUpperCase(),
            whatsapp: data.whatsapp || '',
        });
        toast.success("Aluno atualizado com sucesso!");
    } else {
        await createStudent(data);
        toast.success("Aluno cadastrado com sucesso!");
    }
    await fetchData();
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsFormOpen(true);
  };

  const handleManageAccess = (student: Student) => {
    setManagingAccessStudent(student);
  };

  const handleRequestPasswordReset = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setStudentToReset(student);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setResetPasswordModalOpen(true);
  };

  const handleConfirmPasswordReset = async () => {
    if (!studentToReset) return;
    if (!newPassword || newPassword.length < 6) {
        toast.error("A senha deve ter no mínimo 6 caracteres.");
        return;
    }
    if (newPassword !== confirmNewPassword) {
        toast.error("As senhas não conferem.");
        return;
    }

    setIsResetting(true);
    try {
        await updateStudentPasswordAdmin(studentToReset.uid, newPassword);
        toast.success("Senha alterada com sucesso!");
        setResetPasswordModalOpen(false);
        setStudentToReset(null);
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Erro ao atualizar a senha.";
        toast.error(`Erro: ${message}`);
    } finally {
        setIsResetting(false);
    }
  };

  const handleRequestEmailReset = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setStudentToEmailReset(student);
    setEmailResetModalOpen(true);
  };

  const handleConfirmEmailReset = async () => {
    if (!studentToEmailReset) return;
    setIsSendingEmailReset(true);
    try {
        await sendPasswordReset(studentToEmailReset.email);
        toast.success(`E-mail de recuperação enviado para ${studentToEmailReset.email}`, {
          duration: 5000,
          icon: '📧'
        });
        setEmailResetModalOpen(false);
        setStudentToEmailReset(null);
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Erro ao enviar e-mail de redefinição.";
        toast.error(`Erro: ${message}`);
    } finally {
        setIsSendingEmailReset(false);
    }
  };

  const handleDeleteRequest = (student: Student) => {
    // 1. Check for active access
    const hasActiveAccess = student.access?.some(item => item.isActive) || student.products?.some(item => item.isActive);
    
    setStudentToDelete(student);

    if (hasActiveAccess) {
        // 2a. Block Delete
        setShowBlockModal(true);
    } else {
        // 2b. Proceed to Confirmation
        setShowConfirmModal(true);
    }
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
        await deleteStudent(studentToDelete.uid);
        setStudents(prev => prev.filter(s => s.uid !== studentToDelete.uid));
        toast.success("Aluno excluído com sucesso!");
        closeModals();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erro ao excluir";
        toast.error(message);
    } finally {
        setIsDeleting(false);
    }
  };

  const closeModals = () => {
    setStudentToDelete(null);
    setShowConfirmModal(false);
    setShowBlockModal(false);
  };

  const openNewStudent = () => {
    setEditingStudent(null);
    setIsFormOpen(true);
  };

  // === HELPERS ===

  const formatCPF = (cpf: string) => {
    return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') || '---';
  };

  const isActive = (student: Student) => {
    const now = new Date();
    const checkItem = (a: any) => {
        if (a.isActive === false) return false;
        
        // Handle dates robustly (Timestamp objects or ISO strings)
        let end: Date | null = null;
        const rawEnd = a.diaFim || a.endDate || a.expiresAt;
        
        if (rawEnd) {
          if (typeof rawEnd.toDate === 'function') {
            end = rawEnd.toDate();
          } else {
            const d = new Date(rawEnd);
            if (!isNaN(d.getTime())) end = d;
          }
        }

        if (end && now > end) return false;
        return a.isActive;
    };
    return student.access?.some(checkItem) || student.products?.some(checkItem);
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // === FILTERING ===

  const filteredStudents = students.filter(student => {
    // 1. Text Search
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
        (student.name || '').toLowerCase().includes(searchLower) || 
        (student.email || '').toLowerCase().includes(searchLower) ||
        (student.cpf || '').includes(searchTerm);

    // 2. Status Filter
    const active = isActive(student);
    let matchesStatus = true;
    if (statusFilter === 'ACTIVE') matchesStatus = active;
    if (statusFilter === 'INACTIVE') matchesStatus = !active;

    // 3. Plan Filter (AND Logic)
    let matchesPlan = true;
    if (selectedPlanFilter) {
        matchesPlan = student.access?.some(item => item.targetId === selectedPlanFilter && item.type === 'plan') || false;
    }

    // 4. Class Filter (AND Logic)
    let matchesClass = true;
    if (selectedClassFilter) {
        matchesClass = student.access?.some(item => item.targetId === selectedClassFilter && item.type === 'simulated_class') || false;
    }

    // 5. Product Filter (Combo)
    let matchesProduct = true;
    if (selectedProductFilter) {
        matchesProduct = (
            student.products?.some(item => item.targetId === selectedProductFilter && item.isActive) || 
            student.access?.some(item => item.targetId === selectedProductFilter && item.type === 'product' && item.isActive)
        ) || false;
    }

    return matchesSearch && matchesStatus && matchesPlan && matchesClass && matchesProduct;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Gestão de Alunos</h2>
          <div className="w-12 h-1 bg-brand-red shadow-[0_0_15px_rgba(255,0,0,0.5)]"></div>
        </div>
        
        {activeTab === 'STUDENTS' && (
          <button 
              onClick={openNewStudent}
              className="flex items-center gap-2 px-8 py-3 bg-brand-red rounded-lg text-[10px] font-black uppercase text-white shadow-lg shadow-brand-red/30 hover:bg-red-600 hover:scale-[1.02] transition-all tracking-widest"
          >
              <Plus size={14} strokeWidth={3} />
              Novo Aluno
          </button>
        )}
      </div>

      {/* TABS */}
      <div className="flex gap-4 border-b border-zinc-800">
        <button 
          onClick={() => setActiveTab('STUDENTS')}
          className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'STUDENTS' ? 'text-white border-b-2 border-brand-red' : 'text-zinc-600 hover:text-zinc-400'}`}
        >
          Lista de Alunos
        </button>
        <button 
          onClick={() => setActiveTab('SECURITY')}
          className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'SECURITY' ? 'text-white border-b-2 border-brand-red' : 'text-zinc-600 hover:text-zinc-400'}`}
        >
          Segurança
        </button>
      </div>

      {activeTab === 'SECURITY' ? (
        <SecurityContent students={students} onUpdate={fetchData} />
      ) : (
        <>
            {/* FILTER BAR */}
            <div className="p-1 bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            <Filter size={14} />
            <span>Filtros:</span>
        </div>
        
        {/* Status Select */}
        <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[150px]"
        >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Apenas Ativos</option>
            <option value="INACTIVE">Inativos/Expirados</option>
        </select>

        {/* Plan Select */}
        <select 
            value={selectedPlanFilter}
            onChange={(e) => setSelectedPlanFilter(e.target.value)}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[200px]"
        >
            <option value="">Todos os Planos</option>
            {availablePlans.map((plan, index) => (
                <option key={`${plan.id}-${index}`} value={plan.id} className="text-white">
                    {plan.title}
                </option>
            ))}
        </select>

        {/* Class Select */}
        <select 
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[200px]"
        >
            <option value="">Todas as Turmas</option>
            {availableClasses.map((cls, index) => (
                <option key={`${cls.id}-${index}`} value={cls.id} className="text-white">
                    {cls.title}
                </option>
            ))}
        </select>

        {/* Product Select */}
        <select 
            value={selectedProductFilter}
            onChange={(e) => setSelectedProductFilter(e.target.value)}
            className="bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white px-4 py-2.5 focus:outline-none focus:border-brand-red transition-all uppercase tracking-tighter min-w-[200px]"
        >
            <option value="">Todos os Combos</option>
            {availableProducts.map((prod, index) => (
                <option key={`${prod.id}-${index}`} value={prod.id} className="text-white">
                    {prod.name}
                </option>
            ))}
        </select>
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search size={14} className="text-zinc-600" />
            </div>
            <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="BUSCAR POR NOME, CPF OU EMAIL..."
                className="w-full bg-brand-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white pl-10 pr-4 py-2.5 placeholder-zinc-700 focus:outline-none focus:border-brand-red transition-all uppercase"
            />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
            <div className="p-20 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-red"></div>
            </div>
        ) : filteredStudents.length === 0 ? (
            <div className="p-20 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
                Nenhum aluno encontrado
            </div>
        ) : (
            <table className="w-full text-left">
                <thead className="bg-zinc-950 text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800">
                    <tr>
                        <th className="px-6 py-4">Aluno</th>
                        <th className="px-6 py-4">CPF</th>
                        <th className="px-6 py-4">Produtos (Combos)</th>
                        <th className="px-6 py-4 text-center">Contato</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                    {filteredStudents.map((student, index) => {
                        const activeProducts = [
                            ...(student.products?.filter(p => p.isActive) || []),
                            ...(student.access?.filter(a => a.type === 'product' && a.isActive) || [])
                        ];

                        return (
                        <tr key={`${student.uid}-${index}`} className="hover:bg-zinc-900/40 transition-colors group">
                            {/* Aluno */}
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-black text-zinc-300">
                                        {getInitials(student.name)}
                                    </div>
                                    <div className="max-w-[200px]">
                                        <div className="text-xs font-bold text-white uppercase truncate">{student.name}</div>
                                        <div className="text-[10px] text-zinc-500 truncate">{student.email}</div>
                                    </div>
                                </div>
                            </td>
                            
                            {/* CPF */}
                            <td className="px-6 py-4">
                                <span className="text-xs font-mono text-zinc-400">{formatCPF(student.cpf)}</span>
                            </td>

                            {/* Produtos (Combos) */}
                            <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1 max-w-[300px]">
                                    {activeProducts.length > 0 ? (
                                        activeProducts.map((p, pIndex) => (
                                            <span key={`${p.id}-${pIndex}`} className="inline-block px-2 py-0.5 bg-purple-900/30 text-purple-400 border border-purple-800/50 rounded text-[9px] font-bold uppercase truncate max-w-[140px]">
                                                {p.title}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-[10px] text-zinc-700 font-bold uppercase italic">Sem Combos</span>
                                    )}
                                </div>
                            </td>

                            {/* WhatsApp */}
                            <td className="px-6 py-4 text-center">
                                {student.whatsapp ? (
                                    <a 
                                        href={`https://wa.me/55${student.whatsapp}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-bold uppercase"
                                    >
                                        <MessageCircle size={12} /> WhatsApp
                                    </a>
                                ) : (
                                    <span className="text-[10px] text-zinc-700 font-bold uppercase">-</span>
                                )}
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4 text-center">
                                {isActive(student) ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-wide">
                                        <ShieldCheck size={12} /> Ativo
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 text-[10px] font-bold uppercase tracking-wide">
                                        <ShieldAlert size={12} /> Inativo
                                    </span>
                                )}
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"
                                        title="Gerenciar Acessos"
                                        onClick={() => handleManageAccess(student)}
                                    >
                                        <ShieldCheck size={14} />
                                    </button>

                                    {/* Manual password reset (Key) */}
                                    <button 
                                        type="button"
                                        className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"
                                        title="Redefinir Senha Manualmente"
                                        onClick={(e) => handleRequestPasswordReset(student, e)}
                                    >
                                        <Key size={14} />
                                    </button>

                                    {/* Password Reset Email Button (Lock, Yellow/Amber styled) */}
                                    <button 
                                        type="button"
                                        className="p-2 bg-zinc-900 hover:bg-amber-950/30 border border-zinc-800 hover:border-amber-500/30 rounded-lg text-amber-500 hover:text-amber-400 transition-all"
                                        title="Enviar Redefinição de Senha por E-mail"
                                        onClick={(e) => handleRequestEmailReset(student, e)}
                                    >
                                        <Lock size={14} />
                                    </button>

                                    <button 
                                        onClick={() => handleEdit(student)}
                                        className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"
                                        title="Editar Dados"
                                    >
                                        <Edit size={14} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteRequest(student)}
                                        className="p-2 bg-zinc-900 hover:bg-red-900/20 border border-zinc-800 hover:border-red-900/50 rounded-lg text-zinc-400 hover:text-red-500 transition-all"
                                        title="Excluir Aluno"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        )}
      </div>
      </>
      )}

      {/* ACCESS MANAGER OVERLAY */}
      {managingAccessStudent && (
        <StudentAccessManager 
            student={managingAccessStudent}
            onClose={() => setManagingAccessStudent(null)}
            onUpdate={fetchData}
        />
      )}

      {/* MODAL EDIT */}
      <StudentFormModal 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleCreateOrUpdate}
        initialData={editingStudent}
      />

      {/* PASSWORD RESET MODAL */}
      {resetPasswordModalOpen && studentToReset && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-[160px] bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto" onMouseDown={() => setResetPasswordModalOpen(false)}>
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden mb-8 animate-in zoom-in-95 duration-200" onMouseDown={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-5 border-b border-zinc-900 bg-zinc-900/50 flex items-center justify-between">
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                    Redefinir Senha Manualmente
                  </h2>
                  <button onClick={() => setResetPasswordModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleConfirmPasswordReset(); }} className="p-6 space-y-4">
                    <p className="text-zinc-400 text-xs">
                        Defina uma nova senha para o aluno <strong className="text-white uppercase">{studentToReset.name}</strong> ({studentToReset.email})
                    </p>

                    {/* Nova Senha */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Nova Senha</label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3 top-3 text-zinc-600" />
                            <input 
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red font-mono"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-3 text-zinc-500 hover:text-white transition-colors focus:outline-none"
                            >
                                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {newPassword && newPassword.length < 6 && (
                            <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1 pl-1">
                                A senha deve ter no mínimo 6 caracteres.
                            </p>
                        )}
                    </div>

                    {/* Confirmar Nova Senha */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Confirmar Nova Senha</label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3 top-3 text-zinc-600" />
                            <input 
                                type={showConfirmNewPassword ? 'text' : 'password'}
                                value={confirmNewPassword}
                                onChange={e => setConfirmNewPassword(e.target.value)}
                                placeholder="Confirme a nova senha"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red font-mono"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                                className="absolute right-3 top-3 text-zinc-500 hover:text-white transition-colors focus:outline-none"
                            >
                                {showConfirmNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {newPassword && confirmNewPassword && newPassword !== confirmNewPassword && (
                            <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1 pl-1">
                                As senhas não conferem.
                            </p>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button 
                            type="button"
                            onClick={() => setResetPasswordModalOpen(false)}
                            className="flex-1 py-3 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold uppercase text-xs tracking-widest transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={isResetting || !newPassword || newPassword.length < 6 || newPassword !== confirmNewPassword}
                            className="flex-1 py-3 rounded-xl bg-brand-red hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-brand-red/20 flex items-center justify-center gap-2"
                        >
                            {isResetting ? 'Atualizando...' : 'Atualizar Senha'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* EMAIL PASSWORD RESET MODAL */}
      {emailResetModalOpen && studentToEmailReset && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-[160px] bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto" onMouseDown={() => setEmailResetModalOpen(false)}>
            <div className="w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 mb-8" onMouseDown={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-3 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <Lock size={32} />
                    </div>
                    
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                        Enviar Redefinição?
                    </h3>
                    
                    <p className="text-zinc-400 text-sm leading-relaxed text-center">
                        Você está prestes a enviar um e-mail de redefinição de senha para o aluno <strong className="text-white uppercase">{studentToEmailReset.name}</strong> ({studentToEmailReset.email}).
                        <br/><br/>
                        O aluno receberá um link automático para criar uma nova senha.
                    </p>

                    <div className="flex gap-3 w-full mt-2">
                        <button 
                            onClick={() => setEmailResetModalOpen(false)} 
                            disabled={isSendingEmailReset}
                            className="flex-1 py-3 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold uppercase text-xs tracking-widest transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleConfirmEmailReset} 
                            disabled={isSendingEmailReset}
                            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                        >
                            {isSendingEmailReset ? 'Enviando...' : 'Enviar E-mail'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* DELETE CONFIRMATION (Normal) */}
      <ConfirmationModal 
        isOpen={showConfirmModal}
        onClose={closeModals}
        onConfirm={confirmDelete}
        title="Excluir Aluno"
        message={`Tem certeza que deseja excluir o aluno "${studentToDelete?.name}"? Esta ação não poderá ser desfeita.`}
        isLoading={isDeleting}
      />

      {/* BLOCK DELETE MODAL (Warning) */}
      {showBlockModal && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-[160px] bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto" onMouseDown={closeModals}>
            <div className="w-full max-w-md bg-zinc-950 border border-yellow-600/50 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 mb-8" onMouseDown={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-3 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                        <AlertTriangle size={32} />
                    </div>
                    
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                        Exclusão Não Permitida
                    </h3>
                    
                    <div className="space-y-2 text-zinc-400 text-sm leading-relaxed">
                        <p>
                            O aluno <strong className="text-white">{studentToDelete?.name}</strong> possui Planos de Estudo ou Turmas de Simulado ativos.
                        </p>
                        <p className="text-xs bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                            Para excluir este cadastro, você deve primeiro <strong>REVOGAR</strong> os acessos manualmente na tela de gerenciamento (ícone de chave).
                        </p>
                    </div>

                    <button 
                        onClick={closeModals} 
                        className="w-full py-3 mt-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold uppercase text-xs tracking-widest border border-zinc-700 hover:border-zinc-600 transition-all"
                    >
                        Entendi
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default StudentManager;
