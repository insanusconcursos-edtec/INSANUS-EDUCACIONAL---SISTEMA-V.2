import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Clock, Timer, Target, CalendarDays, FileText, GraduationCap, Video, Settings, ChevronDown, Radio } from 'lucide-react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { Student } from '../../../services/userService';
import { LiveEvent } from '../../../types/liveEvent';

const StudentNavbar: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab');
  const { currentUser } = useAuth();
  
  const [lifetimeMinutes, setLifetimeMinutes] = useState(0);
  const [planMinutes, setPlanMinutes] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasLiveEvent, setHasLiveEvent] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    // Listen to live events
    const q = query(
      collection(db, 'live_events'),
      where('status', '==', 'live')
    );

    const unsubLive = onSnapshot(q, (snapshot) => {
      const liveEvents = snapshot.docs.map(doc => doc.data() as LiveEvent);
      
      // If we have currentPlanId, check if any live event is for this plan
      if (currentPlanId) {
        const isLiveForPlan = liveEvents.some(event => 
          event.accessControl?.plans?.includes(currentPlanId)
        );
        setHasLiveEvent(isLiveForPlan);
      } else {
        setHasLiveEvent(liveEvents.length > 0);
      }
    });

    return () => unsubLive();
  }, [currentUser, currentPlanId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDropdownOpen && !(event.target as Element).closest('.dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Detect Context
  const isSimulatedContext = location.pathname.includes('/app/simulated');
  const isCoursesContext = location.pathname.includes('/app/courses');

  useEffect(() => {
    if (!currentUser) return;

    // Listen to User Stats changes
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as Student;
            
            // Total Lifetime
            setLifetimeMinutes(data.lifetimeMinutes || 0);

            // Current Plan Stats
            const planId = data.currentPlanId;
            setCurrentPlanId(planId || null);
            if (planId && data.planStats && data.planStats[planId]) {
                setPlanMinutes(data.planStats[planId].minutes || 0);
            } else {
                setPlanMinutes(0);
            }
        }
    });

    return () => unsub();
  }, [currentUser]);

  // Helper Formatter
  const formatMinutes = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
  };

  // Level 2 Nav Items (Plan Context Only)
  const planNavItems = [
    { label: 'METAS DE HOJE', path: '/app/dashboard', icon: <Target className="w-4 h-4" /> },
    { label: 'CALENDÁRIO', path: '/app/calendar', icon: <CalendarDays className="w-4 h-4" /> },
    { label: 'EDITAL', path: '/app/edict', icon: <FileText className="w-4 h-4" /> },
    { 
      label: 'MENTORIA', 
      path: '/app/dashboard?tab=mentorship', 
      icon: <GraduationCap className="w-4 h-4" />,
      isSpecial: true 
    },
    { 
      label: 'CALL', 
      path: '/app/dashboard?tab=call', 
      icon: <Video className="w-4 h-4" />,
      isSpecial: true 
    },
    { 
      label: 'SIMULADOS', 
      path: '/app/dashboard?tab=simulados', 
      icon: <GraduationCap className="w-4 h-4" />,
      isSpecial: true 
    },
    { 
      label: 'AO VIVO', 
      path: '/app/dashboard?tab=live', 
      icon: (
        <div className="relative">
          <Radio className="w-4 h-4" />
          {hasLiveEvent && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-brand-red rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
          )}
        </div>
      ),
      isSpecial: true 
    },
    { label: 'CONFIGURAÇÃO', path: '/app/config', icon: <Settings className="w-4 h-4" /> },
  ];

  const currentItem = planNavItems.find(item => {
    if (item.path.includes('?tab=')) {
      return activeTab === item.path.split('=')[1];
    }
    return location.pathname === item.path && !activeTab;
  }) || planNavItems[0];

  // Regra PRD: A barra secundária não deve aparecer na tela HOME
  if (location.pathname === '/app/home' || location.pathname.includes('/home')) {
    return null;
  }

  return (
    <div className="h-14 px-6 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-900 flex items-center justify-between sticky top-0 z-40">
      
      {/* LEVEL 2 NAVIGATION LINKS */}
      <div className="flex-1 md:flex-none relative dropdown-container h-full flex items-center">
        {!isSimulatedContext && !isCoursesContext && (
          <>
            {/* MOBILE DROPDOWN */}
            <div className="md:hidden w-full">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center justify-between w-full bg-[#121214] border border-white/10 rounded-md px-4 py-3 text-white font-medium transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className={currentItem?.isSpecial ? "text-[var(--plan-theme)]" : "text-zinc-400"}>
                    {currentItem?.icon}
                  </div>
                  <span className="text-[10px] font-bold tracking-widest uppercase">{currentItem?.label}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-[#18181b] border border-white/10 rounded-md shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {planNavItems.map((item) => {
                    const isActive = item.path.includes('?tab=')
                      ? activeTab === item.path.split('=')[1]
                      : location.pathname === item.path && !activeTab;

                    return (
                      <Link
                        key={item.label}
                        to={item.path}
                        onClick={() => setIsDropdownOpen(false)}
                        className={`
                          flex items-center gap-3 w-full px-4 py-3 text-left transition-colors border-b border-white/5 last:border-0
                          ${isActive ? 'bg-white/5 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
                        `}
                      >
                        <div className={item.isSpecial ? "text-[var(--plan-theme)]" : ""}>
                          {item.icon}
                        </div>
                        <span className="text-[10px] font-bold tracking-widest uppercase">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DESKTOP HORIZONTAL NAV */}
            <nav className="hidden md:flex items-center gap-1 sm:gap-2 h-full">
              {planNavItems.map((item) => {
                const isActive = item.path.includes('?tab=')
                  ? activeTab === item.path.split('=')[1]
                  : location.pathname === item.path && !activeTab;

                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`
                      relative h-10 px-4 flex items-center justify-center rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-300 gap-2
                      ${isActive 
                        ? (item.isSpecial ? 'bg-[var(--plan-theme)] text-white shadow-lg shadow-[var(--plan-theme)]/40' : 'text-white bg-zinc-800') 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}
                    `}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
        
        {/* Placeholder title for Simulated Context */}
        {isSimulatedContext && (
            <div className="flex items-center gap-2 opacity-50">
               <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
               <span className="text-[10px] font-black text-white uppercase tracking-widest">Área de Simulados</span>
            </div>
        )}

        {/* Placeholder title for Courses Context */}
        {isCoursesContext && (
            <div className="flex items-center gap-2 opacity-50">
               <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
               <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Área de Cursos</span>
            </div>
        )}
      </div>

      {/* TIMERS (Always Visible) */}
      <div className="flex items-center gap-6 hidden md:flex">
        {/* Tempo no Plano */}
        <div className="flex flex-col items-end leading-none">
          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Tempo no Plano</span>
          <div className="flex items-center gap-2 text-white">
            <Clock size={12} className="text-zinc-500" />
            <span className="text-xs font-mono font-bold tracking-wider tabular-nums">
                {formatMinutes(planMinutes)}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-zinc-900"></div>

        {/* Tempo Total */}
        <div className="flex flex-col items-end leading-none">
          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Tempo Total</span>
          <div className="flex items-center gap-2 text-[var(--plan-theme)]">
            <Timer size={12} />
            <span className="text-xs font-mono font-bold tracking-wider drop-shadow-[0_0_5px_var(--plan-theme)] tabular-nums">
                {formatMinutes(lifetimeMinutes)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentNavbar;