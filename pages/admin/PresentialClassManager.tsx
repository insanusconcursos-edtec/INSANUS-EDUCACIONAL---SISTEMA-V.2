import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Users, DollarSign, BookOpen, Clock, LayoutDashboard, Monitor } from 'lucide-react';
import { classService } from '../../services/classService';
import { curriculumService } from '../../services/curriculumService';
import { teacherService } from '../../services/teacherService';
import { classScheduleService } from '../../services/classScheduleService';
import { getStudentsByClass } from '../../services/studentService';
import { classroomService } from '../../services/classroomService';
import { Class } from '../../types/class';
import { Topic, Subject, Module } from '../../types/curriculum';
import { Teacher } from '../../types/teacher';
import { ClassScheduleEvent } from '../../types/schedule';
import { RemunerationTab } from '../../components/admin/presential/classes/manager/RemunerationTab';
import { SubjectsTab } from '../../components/admin/presential/classes/manager/SubjectsTab';
import { ScheduleTab } from '../../components/admin/presential/classes/manager/ScheduleTab';
import { PedagogicalPlanning } from '../../components/admin/presential/classes/manager/planning/PedagogicalPlanning';
import { TeachingEnvironment } from '../../components/admin/presential/classes/manager/teaching/TeachingEnvironment';
import { StudentsTab } from '../../components/admin/presential/classes/manager/StudentsTab';
import { formatSafeDateLocal } from '../../utils/dateUtils';

const PresentialClassManager: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  console.log("Montou Gerenciador da Turma:", classId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentClass, setCurrentClass] = useState<Class | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<ClassScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [studentsOverview, setStudentsOverview] = useState<any[]>([]);
  const [classroomOverview, setClassroomOverview] = useState<any>(null);

  // Deep Linking: Sync tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      // Find matching tab ID (case-insensitive)
      const tabIds = ['overview', 'remuneration', 'subjects', 'schedule', 'PLANNING', 'TEACHING', 'students'];
      const matchedTab = tabIds.find(id => id.toLowerCase() === tab.toLowerCase());
      if (matchedTab) {
        setActiveTab(matchedTab);
      }
    }
  }, [searchParams]);

  const modules = useMemo(() => {
    return topics.flatMap(t => t.modules || []);
  }, [topics]);

  const fetchData = async (silent: boolean = false) => {
    if (!classId) return;
    try {
      if (!silent) {
        setLoading(true);
      }
      const [classData, topicsData, subjectsData, teachersData, eventsData] = await Promise.all([
        classService.getClassById(classId),
        curriculumService.getTopicsByClass(classId),
        curriculumService.getSubjectsByClass(classId),
        teacherService.getTeachers(),
        classScheduleService.getScheduleEventsByClass(classId)
      ]);
      setCurrentClass(classData);
      setTopics(topicsData);
      setSubjects(subjectsData);
      setTeachers(teachersData);
      setScheduleEvents(eventsData);
    } catch (error) {
      console.error("Error fetching class data:", error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [classId]);

  useEffect(() => {
    const fetchOverviewExtraData = async () => {
      if (!currentClass?.id) return; 
      
      try {
        const fetchedStudents = await getStudentsByClass(currentClass.id);
        setStudentsOverview(fetchedStudents);
        
        if (currentClass.classroomId) {
          const room = await classroomService.getClassroomById(currentClass.classroomId);
          setClassroomOverview(room);
        }
      } catch (error) {
        console.error("Erro ao buscar dados extras da visão geral", error);
      }
    };

    fetchOverviewExtraData();
  }, [currentClass?.id, currentClass?.classroomId]);

  const overviewMetrics = useMemo(() => {
    const planned = currentClass?.totalMeetings || 0;
    const scheduled = scheduleEvents?.length || 0;
    const completed = scheduleEvents?.filter((e: any) => e.status === 'COMPLETED').length || 0;

    const totalSt = studentsOverview.length;
    const regularSt = studentsOverview.filter(s => !s.classAccess?.isScholarship).length;
    const scholarshipSt = studentsOverview.filter(s => s.classAccess?.isScholarship).length;

    const capacity = classroomOverview?.capacity || (currentClass as any)?.capacity || 0;
    const available = Math.max(0, capacity - totalSt);

    return { planned, scheduled, completed, totalSt, regularSt, scholarshipSt, capacity, available };
  }, [currentClass, scheduleEvents, studentsOverview, classroomOverview]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-white">Carregando...</div>;
  }

  if (!currentClass) {
    return <div className="flex items-center justify-center h-screen text-white">Turma não encontrada.</div>;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 animate-in fade-in duration-500">
            {/* Card 1: Encontros */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4 shadow-lg">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                Encontros da Turma
              </h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Previstos no Edital:</span> 
                  <strong className="text-white text-xl">{overviewMetrics.planned}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Agendados:</span> 
                  <strong className="text-blue-400 text-xl">{overviewMetrics.scheduled}</strong>
                </div>
                <div className="flex justify-between items-center border-t border-zinc-800 pt-3">
                  <span className="text-zinc-400 font-medium">Já Ministrados:</span> 
                  <strong className="text-green-500 text-xl">{overviewMetrics.completed}</strong>
                </div>
              </div>
            </div>

            {/* Card 2: Alunos Matriculados */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4 shadow-lg">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                Perfil dos Alunos
              </h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Total Matriculados:</span> 
                  <strong className="text-white text-3xl">{overviewMetrics.totalSt}</strong>
                </div>
                <div className="flex justify-between items-center border-t border-zinc-800 pt-3">
                  <span className="text-zinc-400">Regulares:</span> 
                  <strong className="text-zinc-100 text-lg">{overviewMetrics.regularSt}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Bolsistas:</span> 
                  <strong className="text-blue-400 text-lg">{overviewMetrics.scholarshipSt}</strong>
                </div>
              </div>
            </div>

            {/* Card 3: Ocupação e Vagas */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4 shadow-lg">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                Ocupação da Sala
              </h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Capacidade Física:</span> 
                  <strong className="text-white text-xl">{overviewMetrics.capacity || 'N/D'}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Vagas Preenchidas:</span> 
                  <strong className="text-red-400 text-xl">{overviewMetrics.totalSt}</strong>
                </div>
                <div className="flex justify-between items-center border-t border-zinc-800 pt-3">
                  <span className="text-zinc-400 font-medium">Vagas Disponíveis:</span> 
                  <strong className="text-green-500 text-xl">{overviewMetrics.capacity ? overviewMetrics.available : 'N/D'}</strong>
                </div>
              </div>
            </div>
          </div>
        );
      case 'remuneration':
        return (
          <RemunerationTab 
            cls={currentClass} 
            onUpdate={(silent) => fetchData(silent)} 
            events={scheduleEvents}
            teachers={teachers}
          />
        );
      case 'subjects':
        return <SubjectsTab cls={currentClass} onUpdate={(silent) => fetchData(silent)} />;
      case 'schedule':
        return (
          <ScheduleTab 
            cls={currentClass} 
            topics={topics} 
            subjects={subjects} 
            teachers={teachers} 
            onUpdate={(silent) => fetchData(silent)}
          />
        );
      case 'TEACHING':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white">Ambiente de Ensino Virtual</h2>
              <p className="text-sm text-gray-400">Gerencie os recursos online, módulos, vídeos e PDFs que ficarão disponíveis para os alunos desta turma presencial.</p>
            </div>
            <TeachingEnvironment classId={currentClass.id} />
          </div>
        );
      case 'PLANNING':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white">Planejamento Pedagógico (Edital Verticalizado)</h2>
              <p className="text-sm text-zinc-400">Acompanhe a estrutura do curso, materiais e o status das aulas agendadas.</p>
            </div>
            <PedagogicalPlanning 
              subjects={subjects} 
              topics={topics} 
              modules={modules} 
              events={scheduleEvents} 
              teachers={teachers} 
              totalMeetings={currentClass.totalMeetings}
            />
          </div>
        );
      case 'students':
        return <StudentsTab classId={currentClass.id} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <Link 
          to="/admin/presencial" 
          state={{ initialTab: 'CLASSES' }}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Turmas
        </Link>

        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
          <div className="w-24 h-32 rounded-lg overflow-hidden bg-zinc-800 shrink-0 shadow-lg">
            {currentClass.coverImage ? (
              <img src={currentClass.coverImage} alt={currentClass.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold text-xs">SEM CAPA</div>
            )}
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black uppercase tracking-tight">{currentClass.name}</h1>
              <span className="px-3 py-1 rounded-full bg-brand-red/10 text-brand-red text-xs font-bold border border-brand-red/20">
                {currentClass.type}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span>{currentClass.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{currentClass.shift === 'MORNING' ? 'Manhã' : currentClass.shift === 'AFTERNOON' ? 'Tarde' : 'Noite'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Início: {formatSafeDateLocal(currentClass.startDate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-zinc-800">
        <nav className="flex gap-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Visão Geral', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'remuneration', label: 'Remuneração', icon: <DollarSign className="w-4 h-4" /> },
            { id: 'subjects', label: 'Disciplinas', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'schedule', label: 'Cronograma', icon: <Calendar className="w-4 h-4" /> },
            { id: 'PLANNING', label: 'Planejamento', icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'TEACHING', label: 'Ambiente de Ensino', icon: <Monitor className="w-4 h-4" /> },
            { id: 'students', label: 'Alunos', icon: <Users className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 pb-4 text-sm font-bold uppercase tracking-wider transition-colors border-b-2
                ${activeTab === tab.id 
                  ? 'border-brand-red text-white' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'}
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default PresentialClassManager;
