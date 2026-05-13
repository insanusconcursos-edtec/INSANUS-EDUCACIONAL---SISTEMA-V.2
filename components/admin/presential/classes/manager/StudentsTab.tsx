/* eslint-disable react/prop-types */
import React, { useState, useEffect, useMemo } from 'react';
import { Search, MessageCircle, User, Star, Loader2, RefreshCw } from 'lucide-react';
import { getStudentsByClass } from '../../../../../services/studentService';

interface Props {
  classId: string;
}

export const StudentsTab: React.FC<Props> = ({ classId }) => {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const data = await getStudentsByClass(classId);
        // Ordena alfabeticamente
        data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setStudents(data);
      } catch (error) {
        console.error("Erro ao buscar alunos da turma:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (classId) fetchStudents();
  }, [classId, refreshTrigger]);

  // Filtra e divide as listas (Memoizado para performance)
  const { regularStudents, scholarshipStudents } = useMemo(() => {
    const filtered = students.filter(student => {
      const term = searchTerm.toLowerCase();
      return (
        (student.name || '').toLowerCase().includes(term) ||
        (student.email || '').toLowerCase().includes(term) ||
        (student.cpf || '').includes(term)
      );
    });

    const regular = filtered.filter(s => !s.classAccess?.isScholarship);
    const scholarship = filtered.filter(s => s.classAccess?.isScholarship);

    return { regularStudents: regular, scholarshipStudents: scholarship };
  }, [students, searchTerm]);

  // Componente interno para renderizar o Card do Aluno
  const StudentCard = ({ student, isScholarship }: { student: any, isScholarship: boolean }) => {
    const access = student.classAccess;
    const phoneDigits = (student.whatsapp || student.phone)?.replace(/\D/g, '');
    
    return (
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition ${isScholarship ? 'bg-blue-900/10 border-blue-900/50 hover:border-blue-700' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}>
        <div className="flex items-center gap-4">
          {/* Avatar */}
          {student.photoUrl ? (
            <img src={student.photoUrl} alt={student.name} className="w-12 h-12 rounded-full object-cover border-2 border-zinc-800" referrerPolicy="no-referrer" />
          ) : (
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${isScholarship ? 'bg-blue-900 text-blue-300' : 'bg-zinc-800 text-zinc-500'}`}>
              {(student.name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          
          {/* Dados do Aluno */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-lg">{student.name}</h3>
              {isScholarship && <span className="flex items-center gap-1 bg-blue-900/50 text-blue-400 border border-blue-800 text-[10px] px-2 py-0.5 rounded uppercase font-bold"><Star size={10} /> Bolsista</span>}
            </div>
            <div className="text-sm text-zinc-500 flex flex-col sm:flex-row sm:gap-3">
              <span>{student.email}</span>
              <span className="hidden sm:inline">•</span>
              <span>CPF: {student.cpf || 'Não informado'}</span>
            </div>
          </div>
        </div>

        {/* Dados de Acesso e Ações */}
        <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
          <div className="text-xs text-gray-400 grid grid-cols-2 md:text-right gap-x-4 gap-y-1 bg-gray-900/50 p-2 rounded-lg">
            <span>Dia Início: <strong className="text-gray-300">
              {(() => {
                const dateVal = access?.diaInicio || access?.startDate;
                if (!dateVal) return 'N/A';
                if (typeof dateVal.toDate === 'function') return dateVal.toDate().toLocaleDateString('pt-BR');
                return new Date(dateVal).toLocaleDateString('pt-BR');
              })()}
            </strong></span>
            <span>Dia Fim: <strong className="text-gray-300">
              {(() => {
                const dateVal = access?.diaFim || access?.endDate;
                if (!dateVal) return 'N/A';
                if (typeof dateVal.toDate === 'function') return dateVal.toDate().toLocaleDateString('pt-BR');
                return new Date(dateVal).toLocaleDateString('pt-BR');
              })()}
            </strong></span>
            <span className="col-span-2">Acesso: <strong className="text-gray-300">{access?.days || 0} dias</strong></span>
          </div>
          
          {phoneDigits && (
            <a 
              href={`https://wa.me/55${phoneDigits}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition w-full md:w-auto"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) return (
    <div className="p-8 flex flex-col items-center justify-center gap-3">
      <Loader2 className="animate-spin text-brand-red" size={32} />
      <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Carregando Alunos...</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho e Pesquisa */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <User className="text-red-500" /> Alunos Matriculados ({students.length})
          <button 
            onClick={() => setRefreshTrigger(prev => prev + 1)} 
            disabled={isLoading}
            className="ml-2 p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-gray-400 hover:text-white transition disabled:opacity-50"
            title="Sincronizar Lista"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin text-red-500' : ''} />
          </button>
        </h2>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-brand-red transition"
          />
        </div>
      </div>

      {/* Lista de Alunos Regulares */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2">
          Alunos Regulares ({regularStudents.length})
        </h3>
        {regularStudents.length === 0 ? (
          <p className="text-zinc-600 text-sm italic">Nenhum aluno regular encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {regularStudents.map(student => <StudentCard key={student.id} student={student} isScholarship={false} />)}
          </div>
        )}
      </div>

      {/* Lista de Bolsistas */}
      <div className="flex flex-col gap-3 mt-4">
        <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider border-b border-zinc-800 pb-2 flex items-center gap-2">
          <Star size={14} /> Bolsistas ({scholarshipStudents.length})
        </h3>
        {scholarshipStudents.length === 0 ? (
          <p className="text-zinc-600 text-sm italic">Nenhum bolsista encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {scholarshipStudents.map(student => <StudentCard key={student.id} student={student} isScholarship={true} />)}
          </div>
        )}
      </div>
    </div>
  );
};
