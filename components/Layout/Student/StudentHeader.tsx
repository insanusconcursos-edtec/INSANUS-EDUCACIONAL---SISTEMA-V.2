
import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  LogOut, Maximize2, Layout, GraduationCap, PlayCircle, Home, Video, 
  ChevronDown, Map, ClipboardList, MonitorPlay, Users, Radio 
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SystemLogo } from '../../common/SystemLogo';

const StudentHeader: React.FC = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Detect Context
  const isHomeContext = location.pathname.includes('/app/home');
  const isSimulatedContext = location.pathname.includes('/app/simulated');
  const isCoursesContext = location.pathname.includes('/app/courses');
  const isPresentialContext = location.pathname.includes('/app/presential');
  const isLiveEventsContext = location.pathname.includes('/app/eventos-ao-vivo');
  const isPlanContext = !isHomeContext && !isSimulatedContext && !isCoursesContext && !isPresentialContext && !isLiveEventsContext;

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  return (
    <header className="h-16 w-full bg-zinc-950 border-b border-zinc-900 flex items-center justify-between px-3 md:px-6 sticky top-0 z-50">
      
      {/* --- ESQUERDA: LOGO --- */}
      <div className="flex items-center gap-2 select-none w-auto lg:w-48 shrink-0 transition-all">
        <SystemLogo />
      </div>

      {/* --- CENTRO: NAVEGAÇÃO HÍBRIDA --- */}

      {/* 1. VERSÃO DESKTOP (Botões) - Visível apenas em Desktop (hidden lg:flex) */}
      <div className="hidden lg:flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50 mx-2">
        
        <Link
          to="/app/home"
          className={`
            relative flex items-center gap-2 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
            ${isHomeContext 
              ? 'bg-zinc-100 text-black shadow-[0_0_20px_rgba(255,255,255,0.15)]' 
              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
          `}
        >
          <Home className="w-3 h-3 lg:w-4 lg:h-4" />
          <span>HOME</span>
        </Link>

        <div className="w-px h-4 bg-zinc-800"></div>

        <Link
          to="/app/dashboard"
          className={`
            relative flex items-center gap-2 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
            ${isPlanContext 
              ? 'bg-[var(--plan-theme)] text-white shadow-[0_0_20px_rgba(var(--plan-theme-rgb),0.3)]' 
              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
          `}
        >
          <Layout className="w-3 h-3 lg:w-4 lg:h-4" />
          <span>PLANOS</span>
        </Link>

        <div className="w-px h-4 bg-zinc-800"></div>

        <Link
          to="/app/simulated"
          className={`
            relative flex items-center gap-2 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
            ${isSimulatedContext 
              ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.15)]' 
              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
          `}
        >
          <GraduationCap className="w-3 h-3 lg:w-4 lg:h-4" />
          <span>SIMULADOS</span>
        </Link>

        <div className="w-px h-4 bg-zinc-800"></div>

        <Link
          to="/app/courses"
          className={`
            relative flex items-center gap-2 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
            ${isCoursesContext 
              ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' 
              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
          `}
        >
          <PlayCircle className="w-3 h-3 lg:w-4 lg:h-4" />
          <span>CURSOS</span>
        </Link>

        <div className="w-px h-4 bg-zinc-800"></div>

        <Link
          to="/app/presential"
          className={`
            relative flex items-center gap-2 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
            ${isPresentialContext 
              ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(5,150,105,0.3)]' 
              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
          `}
        >
          <GraduationCap className="w-3 h-3 lg:w-4 lg:h-4" />
          <span>PRESENCIAL</span>
        </Link>

        <div className="w-px h-4 bg-zinc-800"></div>

        <Link
          to="/app/eventos-ao-vivo"
          className={`
            relative flex items-center gap-2 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300
            ${isLiveEventsContext 
              ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]' 
              : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
          `}
        >
          <Video className="w-3 h-3 lg:w-4 lg:h-4" />
          <span>AO VIVO</span>
        </Link>
      </div>

      {/* 2. VERSÃO MOBILE/TABLET (Dropdown Customizado) - Visível apenas em Mobile/Tablet (flex lg:hidden) */}
      <div className="flex lg:hidden flex-1 mx-3 max-w-[240px] relative">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 text-white text-[10px] font-bold uppercase rounded-lg py-2.5 px-4 focus:border-[var(--plan-theme)] outline-none transition-all"
        >
          <div className="flex items-center gap-2 truncate">
            {isHomeContext && <Home className="w-3.5 h-3.5 text-[var(--plan-theme)]" />}
            {isPlanContext && <Map className="w-3.5 h-3.5 text-[var(--plan-theme)]" />}
            {isSimulatedContext && <ClipboardList className="w-3.5 h-3.5 text-[var(--plan-theme)]" />}
            {isCoursesContext && <MonitorPlay className="w-3.5 h-3.5 text-[var(--plan-theme)]" />}
            {isPresentialContext && <Users className="w-3.5 h-3.5 text-[var(--plan-theme)]" />}
            {isLiveEventsContext && <Radio className="w-3.5 h-3.5 text-[var(--plan-theme)]" />}
            
            <span>
              {isHomeContext ? 'Home' : 
               isPlanContext ? 'Planos' : 
               isSimulatedContext ? 'Simulados' : 
               isCoursesContext ? 'Cursos' : 
               isPresentialContext ? 'Presencial' : 
               isLiveEventsContext ? 'Ao Vivo' : 'Menu'}
            </span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Menu Flutuante */}
        {isMobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="absolute top-full left-0 w-full mt-2 bg-[#1A1A1A] border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-1.5 flex flex-col gap-1">
                {[
                  { path: '/app/home', label: 'Home', icon: Home, active: isHomeContext },
                  { path: '/app/dashboard', label: 'Planos', icon: Map, active: isPlanContext },
                  { path: '/app/simulated', label: 'Simulados', icon: ClipboardList, active: isSimulatedContext },
                  { path: '/app/courses', label: 'Cursos', icon: MonitorPlay, active: isCoursesContext },
                  { path: '/app/presential', label: 'Presencial', icon: Users, active: isPresentialContext },
                  { path: '/app/eventos-ao-vivo', label: 'Ao Vivo', icon: Radio, active: isLiveEventsContext },
                ].map((item) => (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                      ${item.active 
                        ? 'bg-[var(--plan-theme)]/10 text-[var(--plan-theme)]' 
                        : 'text-zinc-500 hover:bg-[var(--plan-theme)]/5 hover:text-[var(--plan-theme)]'}
                    `}
                  >
                    <item.icon className={`w-4 h-4 ${item.active ? 'text-[var(--plan-theme)]' : ''}`} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- DIREITA: UTILITÁRIOS --- */}
      <div className="flex items-center gap-2 lg:gap-6 w-auto lg:w-48 justify-end shrink-0">
        <button 
          onClick={toggleFullScreen}
          className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest group"
        >
          <Maximize2 className="w-4 h-4 text-zinc-600 group-hover:text-[var(--plan-theme)] transition-colors" />
          <span className="hidden lg:inline">Tela Cheia</span>
        </button>
        
        <div className="h-4 w-px bg-zinc-800 hidden md:block"></div>
        
        <button 
          onClick={logout}
          className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest group"
        >
          <LogOut className="w-4 h-4 text-zinc-600 group-hover:text-[var(--plan-theme)] transition-colors" />
          <span className="hidden lg:inline">Sair</span>
        </button>
      </div>
    </header>
  );
};

export default StudentHeader;
