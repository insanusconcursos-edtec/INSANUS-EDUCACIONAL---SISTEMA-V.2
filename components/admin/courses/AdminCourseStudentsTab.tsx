import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, UserCheck, UserPlus, GraduationCap, MessageCircle, ExternalLink, Search, Link as LinkIcon, X, Copy, Check, RefreshCw } from 'lucide-react';
import { CourseEnrollment } from '../../../types/course';
import { differenceInDays, parseISO, format } from 'date-fns';
import toast from 'react-hot-toast';

interface AdminCourseStudentsTabProps {
  courseId: string;
}

export function AdminCourseStudentsTab({ courseId }: AdminCourseStudentsTabProps) {
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'REGULAR' | 'MIGRACAO' | 'BOLSISTA'>('ALL');
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationConfig, setMigrationConfig] = useState({
    expiresAt: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    accessDurationDays: 365
  });
  const [generatedLink, setGeneratedLink] = useState<{ id: string; url: string; embed: string } | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  // Métricas
  const [metrics, setMetrics] = useState({
    total: 0,
    regular: 0,
    migration: 0,
    scholarship: 0
  });

  const fetchLock = useRef(''); // Armazena o ID do curso já carregado

  const loadStudents = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      fetchLock.current = courseId;
      const response = await fetch(`/api/admin/courses/${courseId}/students`);
      const data = await response.json();
      
      if (data.success) {
        const realStudents = (data.students || []) as CourseEnrollment[];
        
        // Ordenação Alfabética Real (Defensiva)
        realStudents.sort((a, b) => (a?.userName || '').localeCompare(b?.userName || ''));
        
        setEnrollments(realStudents);
        
        // Cálculo Dinâmico das Métricas
        setMetrics({
          total: realStudents.length,
          regular: realStudents.filter(s => s?.enrollmentType === 'REGULAR' || !s?.enrollmentType).length,
          migration: realStudents.filter(s => s?.enrollmentType === 'MIGRACAO').length,
          scholarship: realStudents.filter(s => s?.enrollmentType === 'BOLSISTA').length
        });
      }
    } catch (error) {
      fetchLock.current = ''; // Destranca em caso de erro para permitir retry
      console.error("Erro ao buscar alunos reais:", error);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    // Se não tem ID, ou se o ID atual já foi carregado, aborta (quebra o loop)
    if (!courseId || fetchLock.current === courseId) return;

    loadStudents();

    // Cleanup: Reseta o lock ao sair da aba, forçando um novo fetch ao voltar
    return () => { fetchLock.current = ''; };
  }, [courseId, loadStudents]);

  const handleSync = () => {
    fetchLock.current = '';
    loadStudents();
  };

  // Formatação de CPF
  const formatCPF = (cpf?: string) => {
    if (!cpf) return '---';
    const clean = cpf.replace(/\D/g, '');
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  // Link WhatsApp
  const getWhatsAppLink = (phone?: string) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    return `https://wa.me/55${clean}`;
  };

  // Cálculo de dias restantes
  const getRemainingDays = (expiresAt?: string) => {
    if (!expiresAt) return { label: 'Sem validade', color: 'text-zinc-500' };
    const now = new Date();
    try {
      const expiration = parseISO(expiresAt);
      const days = differenceInDays(expiration, now);
      
      if (days < 0) return { label: 'Expirado', color: 'text-red-500' };
      if (days === 0) return { label: 'Expira hoje', color: 'text-orange-500' };
      return { label: `${days} dias restantes`, color: 'text-emerald-400' };
    } catch (e) {
      return { label: 'Data inválida', color: 'text-zinc-500' };
    }
  };

  const filteredEnrollments = (enrollments || []).filter(e => {
    const searchLower = (searchTerm || '').toLowerCase();
    const matchName = (e?.userName || '').toLowerCase().includes(searchLower);
    const matchEmail = (e?.userEmail || '').toLowerCase().includes(searchLower);
    const matchCpf = (e?.userCpf || '').includes(searchTerm);
    
    const matchesSearch = matchName || matchEmail || matchCpf;
    const matchesFilter = filterType === 'ALL' || e.enrollmentType === filterType;
    return matchesSearch && matchesFilter;
  });

  const handleCreateMigrationLink = async () => {
    setIsCreatingLink(true);
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/migration-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresAt: migrationConfig.expiresAt,
          accessDurationDays: migrationConfig.accessDurationDays
        })
      });
      const data = await response.json();
      if (data.success) {
        const fullUrl = `${window.location.origin}${data.link}`;
        setGeneratedLink({
          id: data.id,
          url: fullUrl,
          embed: `<iframe src="${fullUrl}" width="100%" height="600px" frameborder="0"></iframe>`
        });
        toast.success('Link de migração gerado!');
      } else {
        toast.error(data.error || 'Erro ao gerar link');
      }
    } catch (error) {
      console.error("Erro ao criar link:", error);
      toast.error('Erro de conexão');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-zinc-800 rounded-lg text-white">
            <Users size={24} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Total Alunos</p>
            <h3 className="text-2xl font-black text-white">{metrics.total}</h3>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Regulares</p>
            <h3 className="text-2xl font-black text-white">{metrics.regular}</h3>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
            <UserPlus size={24} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Migração</p>
            <h3 className="text-2xl font-black text-white">{metrics.migration}</h3>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Bolsistas</p>
            <h3 className="text-2xl font-black text-white">{metrics.scholarship}</h3>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/50">
        <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text"
              placeholder="Buscar por nome, email ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-red-600 transition-colors"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={handleSync}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-zinc-700 justify-center"
              title="Sincronizar dados"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Sincronizar
            </button>
            <button
              onClick={() => setShowMigrationModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-900/20 w-full md:w-auto justify-center"
            >
              <LinkIcon size={16} />
              Cadastrar Link de Migração
            </button>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {(['ALL', 'REGULAR', 'MIGRACAO', 'BOLSISTA'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                filterType === type 
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' 
                : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800'
              }`}
            >
              {type === 'ALL' ? 'Todos' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/50">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Aluno</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Documento</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Contatos</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Acesso</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Grupo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {(filteredEnrollments || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-zinc-500 italic">
                    Nenhum aluno encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                (filteredEnrollments || []).map((enrollment) => {
                  const remaining = getRemainingDays(enrollment.expiresAt);
                  const waLink = getWhatsAppLink(enrollment.userPhone);

                  return (
                    <tr key={enrollment.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                            {enrollment.userAvatar ? (
                              <img src={enrollment.userAvatar} alt={enrollment.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-zinc-400 font-bold text-sm">
                                {(() => {
                                  const userNameString = enrollment?.userName || 'Aluno';
                                  return userNameString
                                    .split(' ')
                                    .filter(Boolean)
                                    .map(n => n[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase() || '👤';
                                })()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm group-hover:text-red-500 transition-colors">{enrollment.userName}</p>
                            <p className="text-zinc-500 text-xs">{enrollment.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-zinc-300 font-mono text-xs">{formatCPF(enrollment.userCpf)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {waLink && (
                            <a 
                              href={waLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </a>
                          )}
                          <button 
                            onClick={() => window.location.href = `mailto:${enrollment.userEmail}`}
                            className="p-2 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white rounded-lg transition-all"
                            title="Enviar E-mail"
                          >
                            <ExternalLink size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-zinc-400 text-[10px] uppercase font-bold">
                            Expira em: <span className="text-white">
                              {enrollment.expiresAt ? format(parseISO(enrollment.expiresAt), 'dd/MM/yyyy') : '---'}
                            </span>
                          </p>
                          <p className={`text-xs font-bold ${remaining.color}`}>{remaining.label}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${
                          enrollment.enrollmentType === 'REGULAR' 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                          : enrollment.enrollmentType === 'MIGRACAO'
                          ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                        }`}>
                          {enrollment.enrollmentType}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Migration Link Modal */}
      {showMigrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <LinkIcon size={20} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">Link de Migração</h3>
              </div>
              <button 
                onClick={() => {
                  setShowMigrationModal(false);
                  setGeneratedLink(null);
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!generatedLink ? (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Validade do Link (Até quando pode ser usado)</label>
                      <input 
                        type="date"
                        value={migrationConfig.expiresAt}
                        onChange={(e) => setMigrationConfig({ ...migrationConfig, expiresAt: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Dias de Acesso (Duração da matrícula)</label>
                      <input 
                        type="number"
                        value={migrationConfig.accessDurationDays}
                        onChange={(e) => setMigrationConfig({ ...migrationConfig, accessDurationDays: parseInt(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="Ex: 365"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleCreateMigrationLink}
                    disabled={isCreatingLink}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-900/20"
                  >
                    {isCreatingLink ? 'Gerando...' : 'Gerar Link e Código Embed'}
                  </button>
                </>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="flex items-center gap-2 text-emerald-500 mb-1">
                      <Check size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">Link Gerado com Sucesso!</span>
                    </div>
                    <p className="text-zinc-400 text-xs">O link está ativo e pronto para ser compartilhado ou embarcado.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">URL Direta</label>
                      <div className="flex gap-2">
                        <input 
                          readOnly
                          value={generatedLink.url}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400 focus:outline-none"
                        />
                        <button 
                          onClick={() => copyToClipboard(generatedLink.url)}
                          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Código Iframe (Embed)</label>
                      <div className="flex gap-2">
                        <textarea 
                          readOnly
                          rows={3}
                          value={generatedLink.embed}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] font-mono text-zinc-400 focus:outline-none resize-none"
                        />
                        <button 
                          onClick={() => copyToClipboard(generatedLink.embed)}
                          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors self-start"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowMigrationModal(false);
                      setGeneratedLink(null);
                    }}
                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase tracking-widest rounded-xl transition-all"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
