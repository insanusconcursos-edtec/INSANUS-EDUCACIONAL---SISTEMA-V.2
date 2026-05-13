
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { SystemLogo } from '../common/SystemLogo';
import { ChevronDown } from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

interface TopbarProps {
  navGroups: NavGroup[];
  roleLabel: string;
  dashboardLabel: string;
  userEmail?: string;
}

const Topbar: React.FC<TopbarProps> = ({ navGroups, roleLabel, dashboardLabel }) => {
  const location = useLocation();
  const { logout } = useAuth();

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to logout", error);
    }
  };

  // Safe safe access for initials
  const roleInitials = roleLabel ? roleLabel.substring(0, 2).toUpperCase() : '??';

  const activeGroup = navGroups.find(group => 
    group.items.some(item => location.pathname.startsWith(item.path))
  ) || navGroups[0];

  return (
    <header className="flex flex-col bg-brand-black border-b border-zinc-900 z-50">
      {/* Top Strip */}
      <div className="h-14 px-6 flex items-center justify-between border-b border-zinc-900/50 bg-zinc-950/50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <SystemLogo />
          </div>
          <div className="h-4 w-px bg-zinc-800 hidden md:block"></div>
          <div className="hidden md:flex items-center gap-3">
            <div className="w-6 h-6 bg-brand-red/10 rounded flex items-center justify-center text-brand-red font-black text-[10px] border border-brand-red/20">
              {roleInitials}
            </div>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{dashboardLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={toggleFullScreen}
            className="flex items-center gap-2 text-[9px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            TELA INTEIRA
          </button>
          
          <div className="h-3 w-px bg-zinc-800"></div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-[9px] font-black text-zinc-500 hover:text-brand-red transition-colors uppercase tracking-widest"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            SAIR
          </button>
        </div>
      </div>

      {/* Tier 1: Main Sectors Bar */}
      <div className="h-14 px-6 flex items-center bg-brand-black border-b border-zinc-900/30 overflow-x-auto scrollbar-hide">
        <nav className="flex items-center gap-6 lg:gap-10">
          {navGroups.map((group, index) => {
            const isGroupActive = activeGroup?.id === group.id;
            
            return (
              <Link
                key={`${group.id}-${index}`}
                to={group.items[0]?.path || '/admin'}
                className={`relative h-14 flex items-center text-[11px] font-black tracking-tighter uppercase transition-all whitespace-nowrap px-1 ${
                  isGroupActive ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {group.label}
                {isGroupActive && (
                  <div key="active-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-red shadow-[0_0_12px_rgba(255,0,0,0.8)]"></div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tier 2: Submenu Bar */}
      {activeGroup && activeGroup.items.length > 1 && (
        <div className="h-12 px-6 flex items-center bg-zinc-950 border-b border-zinc-900/50 overflow-x-auto scrollbar-hide">
          <nav className="flex items-center gap-6">
            {activeGroup.items.map((item, index) => {
              const isItemActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={`${item.path}-${index}`}
                  to={item.path}
                  className={`text-[10px] font-bold uppercase tracking-widest transition-all px-2 py-1.5 rounded-md  ${
                    isItemActive 
                      ? 'bg-brand-red/10 text-brand-red border border-brand-red/20' 
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Topbar;
