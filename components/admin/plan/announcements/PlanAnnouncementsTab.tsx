import React, { useState, useEffect } from 'react';
import { Megaphone, Send, Clock, Bell, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createAnnouncement, getAnnouncementsByPlan, Announcement } from '../../../../services/announcementService';

interface PlanAnnouncementsTabProps {
  planId: string;
}

export const PlanAnnouncementsTab: React.FC<PlanAnnouncementsTabProps> = ({ planId }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [forcePopUp, setForcePopUp] = useState(false);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const data = await getAnnouncementsByPlan(planId);
        setAnnouncements(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, [planId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    
    setSending(true);
    try {
      await createAnnouncement({
        planId,
        title,
        content,
        forcePopUp
      });
      
      // Reset form
      setTitle('');
      setContent('');
      setForcePopUp(false);
      
      // Refresh list
      const data = await getAnnouncementsByPlan(planId);
      setAnnouncements(data);
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar comunicado');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      {/* Form Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 border border-red-500/20">
            <Megaphone size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Disparar Aviso Geral</h2>
            <p className="text-xs text-zinc-500 font-medium">Envie comunicados instantâneos para todos os alunos deste plano.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Título do Aviso</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Nova Aula Disponível / Atualização do Cronograma"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Conteúdo da Mensagem</label>
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Descreva aqui os detalhes do comunicado..."
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all font-medium resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${forcePopUp ? 'bg-amber-500 text-white' : 'bg-zinc-900 text-zinc-600'}`}>
                <AlertCircle size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-white uppercase tracking-tight">Exibir como Pop-up obrigatório</span>
                <span className="text-[9px] text-zinc-500 font-medium italic">O aluno verá o aviso assim que logar e precisará confirmar a leitura.</span>
              </div>
            </div>

            <button
               type="button"
               onClick={() => setForcePopUp(!forcePopUp)}
               className={`w-12 h-6 rounded-full transition-all relative ${forcePopUp ? 'bg-red-600' : 'bg-zinc-800'}`}
            >
               <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${forcePopUp ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={sending}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest py-3 px-8 rounded-xl flex items-center gap-2 transition-all shadow-xl shadow-red-900/20"
            >
              {sending ? 'Disparando...' : (
                <>
                  <Send size={14} /> Disparar Agora
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* History Section */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-zinc-500" />
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Histórico de Comunicados</h3>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
          {announcements.length === 0 && !loading && (
            <div className="text-center py-12 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
              <p className="text-zinc-500 text-sm font-medium italic">Nenhum comunicado enviado ainda.</p>
            </div>
          )}

          {announcements.map((ann) => (
            <div key={ann.id} className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {ann.forcePopUp ? (
                      <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-amber-500/20">Pop-up</span>
                    ) : (
                      <span className="bg-zinc-800 text-zinc-500 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">Silencioso</span>
                    )}
                    <h4 className="text-sm font-bold text-white tracking-tight">{ann.title}</h4>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium line-clamp-2">{ann.content}</p>
                </div>
                
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[10px] text-zinc-600 font-medium mb-2">
                    {new Date(ann.createdAt).toLocaleDateString('pt-BR')} {new Date(ann.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-green-500" />
                      <span className="text-[10px] font-black text-green-500 uppercase">{ann.readBy?.length || 0} Lidos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
