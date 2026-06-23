
import React, { useState } from 'react';
import { OnlineCourse } from '../../../types/course';
import { courseService } from '../../../services/courseService';
import { Lock, Unlock, Calendar, MessageSquare, UserCheck, Plus, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface AdminCourseMaintenanceTabProps {
  course: OnlineCourse;
}

export function AdminCourseMaintenanceTab({ course }: AdminCourseMaintenanceTabProps) {
  const [loading, setLoading] = useState(false);
  const [maintenance, setMaintenance] = useState(course.maintenanceMode || {
    enabled: false,
    message: '',
    endDate: '',
    whitelistedUsers: []
  });
  const [newWhitelistedEmail, setNewWhitelistedEmail] = useState('');

  const handleSave = async () => {
    setLoading(true);
    try {
      await courseService.updateCourse(course.id, {
        maintenanceMode: maintenance
      } as any);
      toast.success('Configurações de manutenção atualizadas!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar configurações.');
    } finally {
      setLoading(false);
    }
  };

  const addWhitelistedUser = () => {
    if (!newWhitelistedEmail) return;
    if (maintenance.whitelistedUsers?.includes(newWhitelistedEmail)) {
        toast.error('Este usuário já está na lista.');
        return;
    }
    setMaintenance(prev => ({
      ...prev,
      whitelistedUsers: [...(prev.whitelistedUsers || []), newWhitelistedEmail]
    }));
    setNewWhitelistedEmail('');
  };

  const removeWhitelistedUser = (email: string) => {
    setMaintenance(prev => ({
      ...prev,
      whitelistedUsers: (prev.whitelistedUsers || []).filter(e => e !== email)
    }));
  };

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${maintenance.enabled ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
              {maintenance.enabled ? <Lock size={20} /> : <Unlock size={20} />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">Manutenção do Curso</h3>
              <p className="text-xs text-zinc-500">Bloqueie o acesso de todos os alunos para realizar atualizações com segurança.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button 
                onClick={() => setMaintenance({...maintenance, enabled: false})}
                className={`px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${!maintenance.enabled ? 'bg-green-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                Ativo
            </button>
            <button 
                onClick={() => setMaintenance({...maintenance, enabled: true})}
                className={`px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${maintenance.enabled ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                Em Manutenção
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Mensagem e Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <MessageSquare size={14} className="text-zinc-600" />
                Mensagem Personalizada
              </label>
              <textarea 
                value={maintenance.message}
                onChange={e => setMaintenance({...maintenance, message: e.target.value})}
                placeholder="Ex: O conteúdo do curso foi trancado para atualização."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:border-red-500 outline-none h-32 resize-none transition-all placeholder:text-zinc-700"
              />
              <p className="text-[10px] text-zinc-600 italic">* Se deixado em branco, uma mensagem padrão será exibida.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <Calendar size={14} className="text-zinc-600" />
                  Previsão de Término
                </label>
                <input 
                  type="date"
                  value={maintenance.endDate}
                  onChange={e => setMaintenance({...maintenance, endDate: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:border-red-500 outline-none transition-all"
                />
              </div>
              
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                 <p className="text-xs text-red-400 font-medium leading-relaxed">
                    <strong>Atenção:</strong> Ao ativar o modo de manutenção, todos os módulos e aulas do curso ficarão trancados para os alunos regulares.
                 </p>
              </div>
            </div>
          </div>

          {/* Whitelist */}
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <UserCheck size={14} className="text-zinc-600" />
                Contas com Acesso Liberado (Whitelist)
              </label>
              <span className="text-[10px] font-bold text-zinc-600 uppercase">
                {maintenance.whitelistedUsers?.length || 0} Usuários
              </span>
            </div>
            
            <p className="text-[10px] text-zinc-600 italic">
              Insira o e-mail das contas que poderão acessar o curso normalmente mesmo em manutenção (ex: contas de teste).
            </p>

            <div className="flex gap-2">
              <input 
                type="email"
                value={newWhitelistedEmail}
                onChange={e => setNewWhitelistedEmail(e.target.value)}
                placeholder="E-mail do usuário..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-red-500 outline-none transition-all placeholder:text-zinc-700 font-medium"
                onKeyPress={(e) => e.key === 'Enter' && addWhitelistedUser()}
              />
              <button 
                onClick={addWhitelistedUser}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-xl transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-2"
              >
                <Plus size={16} /> Adicionar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {maintenance.whitelistedUsers?.map(email => (
                <div key={email} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg p-3 group">
                  <span className="text-xs text-zinc-400 font-medium truncate">{email}</span>
                  <button 
                    onClick={() => removeWhitelistedUser(email)}
                    className="text-zinc-700 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              
              {(!maintenance.whitelistedUsers || maintenance.whitelistedUsers.length === 0) && (
                 <div className="col-span-full py-6 text-center border border-dashed border-zinc-800 rounded-xl">
                    <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">Nenhuma conta na whitelist</p>
                 </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-900/30 border-t border-zinc-800 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-red-900/20 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
