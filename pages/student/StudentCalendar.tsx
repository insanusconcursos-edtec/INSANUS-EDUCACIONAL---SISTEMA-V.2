
import React, { useState, useEffect } from 'react';
import { StudyCalendar } from '../../components/student/calendar/StudyCalendar';
import { useAuth } from '../../contexts/AuthContext';
import { PlanHeroBanner } from '../../components/student/PlanHeroBanner';
import { fetchFullPlanData } from '../../services/scheduleService';
import { getStudentConfig } from '../../services/studentService';
import { Calendar as CalendarIcon } from 'lucide-react';

const StudentCalendar: React.FC = () => {
  const { currentUser } = useAuth();
  const [fullPlanData, setFullPlanData] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return;
      const config = await getStudentConfig(currentUser.uid);
      if (config?.currentPlanId) {
        const fullPlan = await fetchFullPlanData(config.currentPlanId);
        setFullPlanData(fullPlan);
      }
    };
    loadData();
  }, [currentUser]);

  if (!currentUser) return null;

  return (
    <div className="relative w-full min-h-screen bg-zinc-950 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {fullPlanData && (
        <PlanHeroBanner currentTab="calendar" planData={fullPlanData} />
      )}

      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 md:px-8 pt-8 md:pt-12 flex-1 flex flex-col -mt-10 md:-mt-20">
        <div className="flex items-center gap-3 mb-8">
            <CalendarIcon size={28} className="text-zinc-600" />
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                Calendário de Estudos
            </h1>
        </div>

        <StudyCalendar userId={currentUser.uid} />
      </div>
    </div>
  );
};

export default StudentCalendar;