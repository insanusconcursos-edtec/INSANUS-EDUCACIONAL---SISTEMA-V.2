import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import StudentHeader from './Student/StudentHeader';
import StudentNavbar from './Student/StudentNavbar';
import PlanUpdateManager from '../student/PlanUpdateManager';
import { SupportFloatingButton } from '../student/support/SupportFloatingButton';
import { useAuth } from '../../contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

const StudentLayout: React.FC = () => {
  const { userData } = useAuth();
  const [themeColor, setThemeColor] = useState('#EF4444');
  const [planTitle, setPlanTitle] = useState('Meu Plano de Estudos');
  const location = useLocation();
  const isCourseArea = location.pathname.includes('/app/courses') || location.pathname.includes('/app/presential') || location.pathname.includes('/app/eventos-ao-vivo');

  const isLiveRoom = location.pathname.includes('/app/eventos-ao-vivo/sala/');

  useEffect(() => {
    if (!userData?.currentPlanId) return;

    const unsub = onSnapshot(doc(db, 'plans', userData.currentPlanId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setThemeColor(data.themeColor || '#EF4444');
        setPlanTitle(data.title || 'Meu Plano de Estudos');
      }
    });

    return () => unsub();
  }, [userData?.currentPlanId]);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '239, 68, 68';
  };

  return (
    <div 
        className="flex flex-col h-screen bg-brand-black text-white font-sans overflow-hidden selection:bg-[var(--plan-theme)] selection:text-white"
        style={{ 
          '--plan-theme': themeColor,
          '--plan-theme-rgb': hexToRgb(themeColor)
        } as React.CSSProperties}
    >
      {/* Update Listener (Global) */}
      <PlanUpdateManager />

      {/* Top Header Strip */}
      {!isLiveRoom && <StudentHeader />}

      {/* Navigation & Timers Strip - Hide in Course Area */}
      {!isCourseArea && <StudentNavbar />}

      {/* Main Content Area */}
      <main className={`flex-1 ${isLiveRoom ? 'overflow-hidden' : 'overflow-y-auto'} bg-zinc-950 scrollbar-hide relative`}>
        {/* Subtle Grid Background for Content Area */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20"></div>
        
        <div className={
          // Remove padding and max-width for Presential Details, Courses, and Live Event Room to allow full-width banner
          location.pathname.includes('/app/presential/') || location.pathname.includes('/app/courses') || location.pathname.includes('/app/eventos-ao-vivo/sala/') || location.pathname.includes('/app/dashboard') || location.pathname.includes('/app/calendar') || location.pathname.includes('/app/edict') || location.pathname.includes('/app/edital')
            ? "w-full p-0 relative z-10"
            : "max-w-[1600px] mx-auto p-6 md:p-8 relative z-10"
        }>
          <Outlet />
        </div>
      </main>

      {userData?.currentPlanId && (
        <SupportFloatingButton 
          productInfo={{
            type: 'plano',
            id: userData.currentPlanId,
            name: planTitle
          }}
        />
      )}
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default StudentLayout;