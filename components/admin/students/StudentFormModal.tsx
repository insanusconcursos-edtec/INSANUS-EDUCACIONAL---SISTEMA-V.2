
import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, Phone, Lock, Hash, Loader2 } from 'lucide-react';
import { Student, CreateStudentData } from '../../../services/userService';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateStudentData) => Promise<void>;
  initialData?: Student | null;
}

// Helpers de Máscara
const maskCPF = (value: string) => {
  if (!value) return '';
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

const maskPhone = (value: string) => {
  if (!value) return '';
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

const StudentFormModal: React.FC<StudentFormModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<CreateStudentData>({
    name: '',
    email: '',
    cpf: '',
    whatsapp: '',
    password: ''
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          email: initialData.email || '',
          cpf: maskCPF(initialData.cpf),
          whatsapp: initialData.whatsapp ? maskPhone(initialData.whatsapp) : '',
          password: '' // Password cannot be edited, only set on creation
        });
      } else {
        setFormData({ name: '', email: '', cpf: '', whatsapp: '', password: '' });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (field: keyof CreateStudentData, value: string) => {
    let finalValue = value;
    if (field === 'cpf') finalValue = maskCPF(value);
    if (field === 'whatsapp') finalValue = maskPhone(value);
    
    setFormData(prev => ({ ...prev, [field]: finalValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.cpf) {
        alert("Preencha os campos obrigatórios.");
        return;
    }

    if (!initialData && (!formData.password || formData.password.length < 6)) {
        alert("A senha deve ter no mínimo 6 caracteres.");
        return;
    }

    setLoading(true);
    try {
        await onSave({
            ...formData,
            cpf: (formData.cpf || '').replace(/\D/g, ''), // Send raw numbers
            whatsapp: formData.whatsapp ? formData.whatsapp.replace(/\D/g, '') : '',
        });
        onClose();
    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Erro ao salvar.";
        alert(message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-[160px] bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto" onMouseDown={onClose}>
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-8" onMouseDown={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 bg-zinc-900/50 flex items-center justify-between">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">
            {initialData ? 'Editar Aluno' : 'Novo Aluno'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {/* Nome */}
            <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Nome Completo</label>
                <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-zinc-600" />
                    <input 
                        value={formData.name}
                        onChange={e => handleChange('name', e.target.value)}
                        placeholder="NOME DO ALUNO"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red font-bold uppercase"
                        required
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* CPF */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">CPF</label>
                    <div className="relative">
                        <Hash size={16} className="absolute left-3 top-3 text-zinc-600" />
                        <input 
                            value={formData.cpf}
                            onChange={e => handleChange('cpf', e.target.value)}
                            placeholder="000.000.000-00"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red font-mono"
                            required
                            disabled={!!initialData} // CPF usually immutable as key
                        />
                    </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">WhatsApp</label>
                    <div className="relative">
                        <Phone size={16} className="absolute left-3 top-3 text-zinc-600" />
                        <input 
                            value={formData.whatsapp}
                            onChange={e => handleChange('whatsapp', e.target.value)}
                            placeholder="(00) 00000-0000"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red font-mono"
                        />
                    </div>
                </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">E-mail</label>
                <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-zinc-600" />
                    <input 
                        type="email"
                        value={formData.email}
                        onChange={e => handleChange('email', e.target.value)}
                        placeholder="aluno@email.com"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red"
                        required
                        disabled={!!initialData} // Avoid changing email easily as it affects Auth
                    />
                </div>
            </div>

            {/* Password (Create Only) */}
            {!initialData && (
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Senha Inicial</label>
                    <div className="relative">
                        <Lock size={16} className="absolute left-3 top-3 text-zinc-600" />
                        <input 
                            type="password"
                            value={formData.password}
                            onChange={e => handleChange('password', e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-brand-red"
                            required={!initialData}
                        />
                    </div>
                </div>
            )}

            <div className="pt-4">
                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-red hover:bg-red-600 text-white font-black py-3.5 rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                    ) : (
                        <><Save size={16} /> Salvar Aluno</>
                    )}
                </button>
            </div>

        </form>
      </div>
    </div>
  );
};

export default StudentFormModal;
