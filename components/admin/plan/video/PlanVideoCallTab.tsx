import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Clock, Video, Plus, Loader2, Trash2, CheckCircle, ExternalLink, User as UserIcon, Search
} from 'lucide-react';
import { getStudentsByPlan } from '../../../../services/studentService';
import { scheduleVideoCall, subscribeToScheduledCalls, updateCallStatus } from '../../../../services/videoCallService';
import { ScheduledCall } from '../../../../types/videoCall';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../../contexts/AuthContext';

interface PlanVideoCallTabProps {
  planId: string;
}

export const PlanVideoCallTab: React.FC<PlanVideoCallTabProps> = ({ planId }) => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const enrolledStudents = await getStudentsByPlan(planId);
        setStudents(enrolledStudents);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar alunos.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const unsubscribe = subscribeToScheduledCalls({ planId }, (calls) => {
      setScheduledCalls(calls);
    });

    return () => unsubscribe();
  }, [planId]);
  
  const filteredStudents = students.filter(student => {
    const term = searchTerm.toLowerCase();
    const nameMatch = student.name?.toLowerCase().includes(term);
    const emailMatch = student.email?.toLowerCase().includes(term);
    return nameMatch || emailMatch;
  });

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !scheduleDate || !scheduleTime || !currentUser) return;

    setScheduling(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
      
      await scheduleVideoCall({
        planId,
        mentorId: currentUser.uid,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name || 'Aluno',
        studentPhotoUrl: selectedStudent.photoURL || selectedStudent.photoUrl || selectedStudent.photo || '',
        scheduledAt: Timestamp.fromDate(scheduledAt),
      });

      toast.success("Mentoria agendada com sucesso!");
      setSelectedStudent(null);
      setScheduleDate('');
      setScheduleTime('');
    } catch (error) {
      console.error(error);
      toast.error("Erro ao agendar mentoria.");
    } finally {
      setScheduling(false);
    }
  };

  const handleStartCall = async (call: ScheduledCall) => {
    try {
      await updateCallStatus(call.id, 'active');
      // Redirect to video room (will be implemented later)
      window.open(`/video-room/${call.id}`, '_blank');
    } catch (error) {
      console.error(error);
      toast.error("Erro ao iniciar chamada.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-brand-red" size={32} />
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-6 min-h-0 animate-in fade-in duration-500 pb-4">
      {/* Lado A: Lista de Alunos e Agendamento */}
      <div className="flex-1 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden min-h-0 h-full">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center gap-2">
          <Users size={18} className="text-brand-red" />
          <h3 className="text-sm font-black text-white uppercase tracking-tight">Alunos Matriculados</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
          {!selectedStudent && (
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-zinc-500" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-brand-red focus:outline-none transition-all"
              />
            </div>
          )}

          {selectedStudent ? (
            <div className="animate-in slide-in-from-left-4 duration-300">
              <button 
                onClick={() => setSelectedStudent(null)}
                className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest mb-4 flex items-center gap-1"
              >
                ← Voltar para lista
              </button>
              
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-brand-red/20">
                    {(selectedStudent.photoURL || selectedStudent.photoUrl || selectedStudent.photo) ? (
                      <img src={selectedStudent.photoURL || selectedStudent.photoUrl || selectedStudent.photo} alt={selectedStudent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                        <UserIcon size={32} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">{selectedStudent.name}</h4>
                    <p className="text-xs text-zinc-500">{selectedStudent.email}</p>
                  </div>
                </div>

                <form onSubmit={handleSchedule} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Data</label>
                      <input 
                        type="date"
                        required
                        value={scheduleDate}
                        onChange={e => setScheduleDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-xs text-white focus:border-brand-red focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Hora</label>
                      <input 
                        type="time"
                        required
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-xs text-white focus:border-brand-red focus:outline-none"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={scheduling}
                    className="w-full py-4 bg-brand-red hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {scheduling ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Agendar Mentoria
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredStudents.map(student => (
                <div 
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-brand-red transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800">
                      {(student.photoURL || student.photoUrl || student.photo) ? (
                        <img src={student.photoURL || student.photoUrl || student.photo} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                          <UserIcon size={20} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-brand-red transition-colors">{student.name || 'Aluno'}</h4>
                      <p className="text-[10px] text-zinc-500">{student.email}</p>
                    </div>
                  </div>
                  <Plus size={16} className="text-zinc-700 group-hover:text-brand-red transition-colors" />
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-zinc-500 text-[10px] font-bold uppercase">
                    {students.length === 0 ? "Nenhum aluno matriculado." : "Nenhum aluno encontrado."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lado B: Calls Agendadas */}
      <div className="w-96 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center gap-2">
          <Calendar size={18} className="text-brand-red" />
          <h3 className="text-sm font-black text-white uppercase tracking-tight">Próximas Mentoria</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {scheduledCalls.map(call => {
            const isActive = call.status === 'active';

            return (
              <div 
                key={call.id}
                className={`bg-zinc-950 border rounded-xl p-4 relative overflow-hidden transition-all ${
                  isActive ? 'border-emerald-500 shadow-lg shadow-emerald-900/10' : 'border-zinc-800'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-bl-lg animate-pulse">
                    Ao Vivo
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-800">
                    {call.studentPhotoUrl ? (
                      <img src={call.studentPhotoUrl} alt={call.studentName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                        <UserIcon size={16} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-tight">{call.studentName}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-bold uppercase">
                        <Calendar size={10} />
                        {format(call.scheduledAt.toDate(), "dd 'de' MMM", { locale: ptBR })}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-bold uppercase">
                        <Clock size={10} />
                        {format(call.scheduledAt.toDate(), "HH:mm")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {call.status === 'scheduled' ? (
                    <button 
                      onClick={() => handleStartCall(call)}
                      className="flex-1 py-2 bg-zinc-800 hover:bg-brand-red text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Video size={12} />
                      Iniciar Sala
                    </button>
                  ) : isActive ? (
                    <button 
                      onClick={() => window.open(`/video-room/${call.id}`, '_blank')}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                    >
                      <ExternalLink size={12} />
                      Entrar na Sala
                    </button>
                  ) : (
                    <div className="flex-1 py-2 bg-zinc-900 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2">
                      <CheckCircle size={12} />
                      Concluída
                    </div>
                  )}
                  <button className="p-2 bg-zinc-900 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {scheduledCalls.length === 0 && (
            <div className="text-center py-20 flex flex-col items-center gap-4">
              <Calendar size={32} className="text-zinc-800" />
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Nenhuma call agendada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
