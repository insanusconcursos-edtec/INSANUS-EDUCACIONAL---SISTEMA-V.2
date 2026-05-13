import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, GraduationCap, MapPin } from 'lucide-react';
import { TeacherList } from '../../../components/admin/presential/teachers/TeacherList';
import { ClassroomList } from '../../../components/admin/presential/classrooms/ClassroomList';
import { ClassList } from '../../../components/admin/presential/classes/ClassList';

type TabType = 'TEACHERS' | 'CLASSES' | 'CLASSROOMS';

const PresentialClassesPage: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('TEACHERS');

  useEffect(() => {
    if (location.state && location.state.initialTab) {
      setActiveTab(location.state.initialTab);
    }
  }, [location.state]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-white tracking-tight uppercase">
          Turmas <span className="text-brand-red">Presenciais</span>
        </h1>
        <p className="text-zinc-400">
          Gerencie professores, turmas presenciais e salas de aula.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('TEACHERS')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'TEACHERS'
              ? 'border-brand-red text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Professores
        </button>

        <button
          onClick={() => setActiveTab('CLASSES')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'CLASSES'
              ? 'border-brand-red text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Turmas
        </button>

        <button
          onClick={() => setActiveTab('CLASSROOMS')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'CLASSROOMS'
              ? 'border-brand-red text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Salas
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'TEACHERS' && <TeacherList />}
        {activeTab === 'CLASSES' && <ClassList />}
        {activeTab === 'CLASSROOMS' && <ClassroomList />}
      </div>
    </div>
  );
};

export default PresentialClassesPage;
