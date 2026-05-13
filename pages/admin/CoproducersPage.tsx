import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Mail, 
  CreditCard, 
  ShieldCheck, 
  Trash2, 
  Edit2, 
  AlertCircle,
  X,
  Check,
  Link,
  Eye,
  EyeOff,
  User as UserIcon
} from 'lucide-react';
import { coproducerService } from '../../services/coproducerService';
import { Coproducer } from '../../types/coproducer';
import { toast } from 'react-hot-toast';
import { AUTH_CONFIG } from '../../services/authConstants';

const CoproducersPage: React.FC = () => {
  const [coproducers, setCoproducers] = useState<Coproducer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoproducer, setEditingCoproducer] = useState<Coproducer | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    document: '',
    pagarmeRecipientId: '',
    isActive: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    loadCoproducers();
  }, []);

  const loadCoproducers = async () => {
    try {
      setLoading(true);
      const data = await coproducerService.getAll();
      setCoproducers(data);
    } catch (error) {
      console.error('Error loading coproducers:', error);
      toast.error('Erro ao carregar coprodutores.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (coproducer?: Coproducer) => {
    setShowPassword(false);
    setShowConfirmPassword(false);
    if (coproducer) {
      setEditingCoproducer(coproducer);
      setFormData({
        name: coproducer.name,
        username: coproducer.username || '',
        password: '', 
        confirmPassword: '',
        document: coproducer.document,
        pagarmeRecipientId: coproducer.pagarmeRecipientId || '',
        isActive: coproducer.isActive
      });
    } else {
      setEditingCoproducer(null);
      setFormData({
        name: '',
        username: '',
        password: '',
        confirmPassword: '',
        document: '',
        pagarmeRecipientId: '',
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      return toast.error('As senhas não coincidem!');
    }

    if (!editingCoproducer && formData.password.length < 6) {
      return toast.error('A senha deve ter no mínimo 6 caracteres.');
    }

    try {
      if (editingCoproducer) {
        await coproducerService.update(editingCoproducer.id, formData);
        toast.success('Coprodutor atualizado com sucesso!');
      } else {
        await coproducerService.create(formData);
        toast.success('Coprodutor cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      loadCoproducers();
    } catch (error: any) {
      toast.error('Erro ao salvar coprodutor: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este coprodutor?')) {
      try {
        await coproducerService.delete(id);
        toast.success('Coprodutor excluído.');
        loadCoproducers();
      } catch (error) {
        toast.error('Erro ao excluir coprodutor.');
      }
    }
  };

  const filteredCoproducers = coproducers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.username && c.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.document.includes(searchTerm)
  );

  return (
    <div className="py-2">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-500" />
            Parceiros de Coprodução
          </h2>
          <p className="text-gray-400 text-sm">Gerencie parceiros financeiros e IDs da Pagar.me para Split de Pagamentos.</p>
        </div>
        
        <button 
          onClick={() => handleOpenModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg active:scale-95"
        >
          <UserPlus size={20} />
          Novo Coprodutor
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white/5 p-4 rounded-xl shadow-sm border border-white/10 mb-6 flex items-center gap-4">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, email ou CPF/CNPJ..."
            className="w-full pl-10 pr-4 py-2 bg-brand-black border border-white/10 rounded-lg focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-brand-black/30 rounded-xl shadow-sm border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/5 border-b border-white/5 font-bold text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Nome / Email</th>
                <th className="px-6 py-4">Documento</th>
                <th className="px-6 py-4">Pagar.me Recipient ID</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500">Carregando coprodutores...</td>
                </tr>
              ) : filteredCoproducers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500 uppercase text-xs font-bold tracking-widest bg-brand-black/20">Nenhum coprodutor encontrado.</td>
                </tr>
              ) : (
                filteredCoproducers.map((coproducer) => (
                  <tr key={coproducer.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-white group-hover:text-emerald-400 transition-colors uppercase text-sm tracking-tight">{coproducer.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                          <UserIcon size={12} className="text-emerald-500/50" />
                          <span className="font-mono">{coproducer.username}</span>
                          <span className="text-white/10">|</span>
                          <Mail size={12} />
                          {coproducer.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                      {coproducer.document}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-md text-[10px] font-black tracking-widest inline-flex items-center gap-1 border border-emerald-500/20 shadow-sm">
                          <CreditCard size={10} />
                          {coproducer.pagarmeRecipientId || 'Não definido'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        coproducer.isActive 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {coproducer.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <button 
                        onClick={() => handleOpenModal(coproducer)}
                        className="p-2 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(coproducer.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-brand-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-white/10 animate-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {editingCoproducer ? <Edit2 size={20} className="text-emerald-500" /> : <UserPlus size={20} className="text-emerald-500" />}
                {editingCoproducer ? 'Editar Coprodutor' : 'Novo Coprodutor'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 font-sans">Nome Completo</label>
                <input 
                  type="text"
                  required
                  className="w-full px-4 py-2 bg-brand-black border border-white/10 rounded-lg focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all text-white placeholder:text-gray-700"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: João Silva da Silva"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 font-sans">Usuário (Login)</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-2 bg-brand-black border border-white/10 rounded-lg focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all text-white font-mono placeholder:text-gray-700"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                    placeholder="ex: joaosilva"
                  />
                </div>
                <p className="text-[10px] text-gray-600 mt-1 uppercase font-bold tracking-tighter">Login: {formData.username || '...'}{AUTH_CONFIG.DOMAIN_NEW}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 font-sans">Senha</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      required={!editingCoproducer}
                      className="w-full px-4 py-2 bg-brand-black border border-white/10 rounded-lg focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all text-white placeholder:text-gray-700"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="••••••"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 font-sans">Confirmar Senha</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"}
                      required={!!formData.password}
                      className={`w-full px-4 py-2 bg-brand-black border rounded-lg focus:ring-2 outline-none transition-all text-white placeholder:text-gray-700 ${
                        formData.confirmPassword && formData.password !== formData.confirmPassword 
                          ? 'border-red-500/50 focus:ring-red-500/50' 
                          : 'border-white/10 focus:ring-emerald-500/50'
                      }`}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                      placeholder="••••••"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">CPF ou CNPJ</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-brand-black border border-white/10 rounded-lg focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all text-white"
                    value={formData.document}
                    onChange={(e) => setFormData({...formData, document: e.target.value.replace(/\D/g, '')})}
                    placeholder="Numeros"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    Pagar.me Recipient ID
                    <AlertCircle size={12} className="text-emerald-500" />
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 bg-brand-black border border-white/10 rounded-lg focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all text-white font-mono"
                    value={formData.pagarmeRecipientId}
                    onChange={(e) => setFormData({...formData, pagarmeRecipientId: e.target.value})}
                    placeholder="re_..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="w-4 h-4 text-emerald-500 bg-brand-black border-white/10 rounded focus:ring-emerald-500/50"
                />
                <label htmlFor="isActive" className="text-sm text-gray-400 cursor-pointer">Coprodutor Ativo</label>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors font-bold text-xs uppercase tracking-widest border border-white/5"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={formData.password !== formData.confirmPassword || (!editingCoproducer && !formData.password)}
                  className={`flex-1 px-4 py-2 rounded-lg transition-all font-bold text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 ${
                    (formData.password !== formData.confirmPassword || (!editingCoproducer && !formData.password))
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                >
                   {editingCoproducer ? <Check size={16} /> : <UserPlus size={16} />}
                   {editingCoproducer ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoproducersPage;
