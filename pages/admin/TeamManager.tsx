
import React, { useEffect, useState, useCallback } from 'react';
import { 
  Plus, Trash2, Shield, Users, Layers, GraduationCap, 
  CheckCircle2, XCircle, User, Lock, Key, Loader2, Pencil,
  Package, Monitor, MapPin, Radio, Headphones, Headset
} from 'lucide-react';
import { 
  getCollaborators, 
  createCollaborator, 
  updateCollaborator,
  deleteCollaborator, 
  Collaborator, 
  CreateCollaboratorData,
  CollaboratorPermissions 
} from '../../services/collaboratorService';
import { AUTH_CONFIG } from '../../services/authConstants';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import MentorManager from './MentorManager';

// === INTERNAL COMPONENTS ===

// 1. Permission Toggle Item
const PermissionToggle = ({ 
  label, 
  icon: Icon, 
  checked, 
  onChange, 
  colorClass 
}: { 
  label: string; 
  icon: React.ElementType; 
  checked: boolean; 
  onChange: (val: boolean) => void;
  colorClass: string;
}) => (
  <div 
    onClick={() => onChange(!checked)}
    className={`
      flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200
      ${checked 
        ? `bg-${colorClass}/10 border-${colorClass}/50 shadow-[0_0_15px_rgba(0,0,0,0.2)]` 
        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 opacity-60 hover:opacity-100'}
    `}
  >
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${checked ? `bg-${colorClass} text-white` : 'bg-zinc-800 text-zinc-500'}`}>
        <Icon size={16} />
      </div>
      <span className={`text-xs font-bold uppercase tracking-wide ${checked ? 'text-white' : 'text-zinc-500'}`}>
        {label}
      </span>
    </div>
    
    <div className={`
      w-10 h-5 rounded-full relative transition-colors 
      ${checked ? `bg-${colorClass}` : 'bg-zinc-700'}
    `}>
      <div className={`
        absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200
        ${checked ? 'translate-x-5' : 'translate-x-0'}
      `} />
    </div>
  </div>
);

// 2. Creation/Edition Modal
const CreateCollaboratorModal = ({ 
  isOpen, 
  onClose, 
  onSave,
  editingCollaborator = null
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (data: Partial<CreateCollaboratorData>) => Promise<void>; 
  editingCollaborator?: Collaborator | null;
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'collaborator' | 'seller'>('collaborator');
  const [pagarmeRecipientId, setPagarmeRecipientId] = useState('');
  const [permissions, setPermissions] = useState<CollaboratorPermissions>({
    planos: false,
    simulados: false,
    alunos: false,
    equipe: false,
    produtos: false,
    cursos_online: false,
    turmas_presenciais: false,
    eventos_ao_vivo: false,
    eventos_presenciais: false,
    suporte: false,
    vendas: false
  });
  const [loading, setLoading] = useState(false);

  // UX Auto-Enable Sales for Sellers
  useEffect(() => {
    if (role === 'seller') {
      setPermissions(prev => ({ ...prev, vendas: true }));
    }
  }, [role]);

  useEffect(() => {
    if (editingCollaborator) {
      setName(editingCollaborator.name);
      setUsername(editingCollaborator.username);
      setPassword(''); // Don't show password
      setRole(editingCollaborator.role || 'collaborator');
      setPagarmeRecipientId(editingCollaborator.pagarmeRecipientId || '');
      setPermissions(editingCollaborator.permissions);
    } else {
      setName('');
      setUsername('');
      setPassword('');
      setRole('collaborator');
      setPagarmeRecipientId('');
      setPermissions({
        planos: false,
        simulados: false,
        alunos: false,
        equipe: false,
        produtos: false,
        cursos_online: false,
        turmas_presenciais: false,
        eventos_ao_vivo: false,
        eventos_presenciais: false,
        suporte: false,
        vendas: false
      });
    }
  }, [editingCollaborator, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || (!editingCollaborator && !password)) return alert("Preencha todos os campos.");
    if (!editingCollaborator && password.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");
    if (role === 'seller' && !pagarmeRecipientId) return alert("Sellers devem ter um ID da Pagar.me.");

    setLoading(true);
    try {
      const data: Partial<CreateCollaboratorData> = { 
        name, 
        username, 
        role, 
        pagarmeRecipientId: role === 'seller' ? pagarmeRecipientId : '',
        permissions 
      };
      if (password) data.password = password;
      
      await onSave(data);
      onClose();
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const togglePerm = (key: keyof CollaboratorPermissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-zinc-900 bg-zinc-900/50 flex justify-between items-center">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">
            {editingCollaborator ? 'Editar Colaborador' : 'Novo Colaborador'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><XCircle size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
            {/* Credentials */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2 mb-2">Credenciais</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Cargo / Role</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as 'collaborator' | 'seller')}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-xs text-white focus:border-brand-red focus:outline-none font-bold uppercase cursor-pointer"
                  >
                    <option value="collaborator">Colaborador (Admin)</option>
                    <option value="seller">Vendedor (Afiliado)</option>
                  </select>
                </div>
                {role === 'seller' && (
                  <div className="space-y-1 animate-in zoom-in duration-200">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                      Pagar.me Recipient ID <span className="text-brand-red">*</span>
                    </label>
                    <input 
                      value={pagarmeRecipientId}
                      onChange={e => setPagarmeRecipientId(e.target.value)}
                      placeholder="re_..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-white placeholder-zinc-700 focus:border-emerald-500 focus:outline-none font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Nome Completo</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-3 text-zinc-600" />
                <input 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="EX: JOÃO DA SILVA"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none font-bold uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Usuário (Login)</label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-3 text-zinc-600" />
                  <input 
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    disabled={!!editingCollaborator}
                    placeholder="joao.silva"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none disabled:opacity-50"
                  />
                </div>
                <p className="text-[9px] text-zinc-600 mt-1 uppercase font-bold tracking-tighter">Login: {username || '...'}{AUTH_CONFIG.DOMAIN_NEW}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">
                  {editingCollaborator ? 'Nova Senha (opcional)' : 'Senha Inicial'}
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-3 text-zinc-600" />
                  <input 
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="******"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-zinc-700 focus:border-brand-red focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2 mb-2">Permissões de Acesso</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PermissionToggle 
                label="Gestão de Planos" 
                icon={Layers} 
                checked={permissions.planos} 
                onChange={() => togglePerm('planos')} 
                colorClass="blue-500" 
              />
              <PermissionToggle 
                label="Gestão de Alunos" 
                icon={Users} 
                checked={permissions.alunos} 
                onChange={() => togglePerm('alunos')} 
                colorClass="emerald-500" 
              />
              <PermissionToggle 
                label="Gestão de Simulados" 
                icon={GraduationCap} 
                checked={permissions.simulados} 
                onChange={() => togglePerm('simulados')} 
                colorClass="orange-500" 
              />
              <PermissionToggle 
                label="Gestão de Equipe" 
                icon={Shield} 
                checked={permissions.equipe} 
                onChange={() => togglePerm('equipe')} 
                colorClass="purple-500" 
              />
              <PermissionToggle 
                label="Gestão de Produtos" 
                icon={Package} 
                checked={permissions.produtos} 
                onChange={() => togglePerm('produtos')} 
                colorClass="pink-500" 
              />
              <PermissionToggle 
                label="Cursos Online" 
                icon={Monitor} 
                checked={permissions.cursos_online} 
                onChange={() => togglePerm('cursos_online')} 
                colorClass="cyan-500" 
              />
              <PermissionToggle 
                label="Turmas Presenciais" 
                icon={MapPin} 
                checked={permissions.turmas_presenciais} 
                onChange={() => togglePerm('turmas_presenciais')} 
                colorClass="yellow-500" 
              />
              <PermissionToggle 
                label="Eventos ao Vivo" 
                icon={Radio} 
                checked={permissions.eventos_ao_vivo} 
                onChange={() => togglePerm('eventos_ao_vivo')} 
                colorClass="red-500" 
              />
              <PermissionToggle 
                label="Eventos Presenciais" 
                icon={MapPin} 
                checked={permissions.eventos_presenciais} 
                onChange={() => togglePerm('eventos_presenciais')} 
                colorClass="brand-red" 
              />
              <PermissionToggle 
                label="Suporte" 
                icon={Headset} 
                checked={permissions.suporte} 
                onChange={() => togglePerm('suporte')} 
                colorClass="sky-500" 
              />
              <PermissionToggle 
                label="Acesso a Vendas" 
                icon={Radio} 
                checked={permissions.vendas} 
                onChange={() => togglePerm('vendas')} 
                colorClass="brand-red" 
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-900">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-brand-red hover:bg-red-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={16} />}
              {editingCollaborator ? 'Salvar Alterações' : 'Criar Colaborador'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

// === MAIN PAGE ===

const TeamManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'COLLABORATORS' | 'MENTORS'>('COLLABORATORS');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  
  // Delete State
  const [collabToDelete, setCollabToDelete] = useState<Collaborator | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getCollaborators();
      setCollaborators(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (data: Partial<CreateCollaboratorData>) => {
    if (editingCollaborator) {
      await updateCollaborator(editingCollaborator.uid, data);
    } else {
      await createCollaborator(data as CreateCollaboratorData);
    }
    await fetchData();
    setEditingCollaborator(null);
  };

  const handleOpenEdit = (collab: Collaborator) => {
    setEditingCollaborator(collab);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCollaborator(null);
  };

  const handleDelete = async () => {
    if (!collabToDelete) return;
    setIsDeleting(true);
    try {
      await deleteCollaborator(collabToDelete.uid);
      setCollaborators(prev => prev.filter(c => c.uid !== collabToDelete.uid));
      setCollabToDelete(null);
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Gestão de Equipe</h2>
          <div className="w-12 h-1 bg-brand-red shadow-[0_0_15px_rgba(255,0,0,0.5)]"></div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* TAB SWITCHER */}
          <div className="bg-zinc-900 p-1 rounded-xl border border-zinc-800 flex gap-1">
              <button 
                  onClick={() => setActiveTab('COLLABORATORS')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'COLLABORATORS' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <Users size={14} /> Colaboradores
              </button>
              <button 
                  onClick={() => setActiveTab('MENTORS')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'MENTORS' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                  <Headphones size={14} /> Mentores
              </button>
          </div>

          {activeTab === 'COLLABORATORS' && (
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-8 py-3 bg-zinc-100 hover:bg-white text-black rounded-lg text-[10px] font-black uppercase shadow-lg shadow-white/10 hover:scale-[1.02] transition-all tracking-widest"
            >
                <Plus size={14} strokeWidth={3} />
                Novo Colaborador
            </button>
          )}
        </div>
      </div>

      {activeTab === 'COLLABORATORS' ? (
        /* List */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
             <div className="col-span-full flex justify-center py-20">
               <Loader2 className="animate-spin text-brand-red" size={32} />
             </div>
          ) : collaborators.length === 0 ? (
             <div className="col-span-full text-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl">
               <p className="text-zinc-500 text-xs font-bold uppercase">Nenhum colaborador encontrado</p>
             </div>
          ) : (
             collaborators.map(collab => (
               <div key={collab.uid} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 group hover:border-zinc-700 transition-all shadow-sm hover:shadow-xl">
                  
                  {/* Header Card */}
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm font-black text-white shadow-inner">
                           {getInitials(collab.name)}
                        </div>
                        <div>
                           <div className="flex items-center gap-2">
                               <h3 className="text-sm font-black text-white uppercase tracking-tight">{collab.name}</h3>
                               <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${collab.role === 'seller' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-brand-red'}`}>
                                  {collab.role === 'seller' ? 'VENDEDOR' : 'EQUIPE'}
                               </span>
                            </div>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] text-zinc-500 font-mono">@{collab.username}</span>
                               {collab.role === 'seller' && (
                                 <span className="text-[9px] text-zinc-600 bg-zinc-900 px-1 rounded border border-zinc-800">
                                   PG: {collab.pagarmeRecipientId}
                                 </span>
                               )}
                            </div>
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleOpenEdit(collab)}
                          className="p-2 text-zinc-600 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => setCollabToDelete(collab)}
                          className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-900/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                     </div>
                  </div>

                  {/* Permissions Grid */}
                  <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50 grid grid-cols-2 gap-y-3 gap-x-2">
                     <PermissionBadge label="PLANOS" active={collab.permissions.planos} color="text-blue-500" />
                     <PermissionBadge label="ALUNOS" active={collab.permissions.alunos} color="text-emerald-500" />
                     <PermissionBadge label="SIMULADOS" active={collab.permissions.simulados} color="text-orange-500" />
                     <PermissionBadge label="EQUIPE" active={collab.permissions.equipe} color="text-purple-500" />
                     <PermissionBadge label="PRODUTOS" active={collab.permissions.produtos} color="text-pink-500" />
                     <PermissionBadge label="CURSOS" active={collab.permissions.cursos_online} color="text-cyan-500" />
                     <PermissionBadge label="PRESENCIAL" active={collab.permissions.turmas_presenciais} color="text-yellow-500" />
                     <PermissionBadge label="EVENTOS AO VIVO" active={collab.permissions.eventos_ao_vivo} color="text-red-500" />
                     <PermissionBadge label="EVENTOS PRESENCIAIS" active={collab.permissions.eventos_presenciais} color="text-brand-red" />
                     <PermissionBadge label="SUPORTE" active={collab.permissions.suporte} color="text-sky-500" />
                     <PermissionBadge label="VENDAS" active={collab.permissions.vendas} color="text-red-500" />
                  </div>

               </div>
             ))
          )}
        </div>
      ) : (
        <MentorManager hideHeader />
      )}

      <CreateCollaboratorModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        editingCollaborator={editingCollaborator}
      />

      <ConfirmationModal 
        isOpen={!!collabToDelete}
        onClose={() => setCollabToDelete(null)}
        onConfirm={handleDelete}
        title="Excluir Colaborador"
        message={`Tem certeza que deseja remover ${collabToDelete?.name} da equipe?`}
        isLoading={isDeleting}
      />

    </div>
  );
};

const PermissionBadge = ({ label, active, color }: { label: string, active: boolean, color: string }) => (
  <div className={`flex items-center gap-2 ${active ? 'opacity-100' : 'opacity-30 grayscale'}`}>
    <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-current ' + color : 'bg-zinc-700'}`} />
    <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-zinc-300' : 'text-zinc-600'}`}>
      {label}
    </span>
  </div>
);

export default TeamManager;
