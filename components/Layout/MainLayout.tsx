
import React from 'react';
import { Outlet } from 'react-router-dom';
import Topbar from './Topbar';

const MainLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen bg-brand-black text-white font-sans overflow-hidden">
      {/* Topbar - Always on top */}
      <Topbar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-brand-dark scrollbar-hide">
        <div className="max-w-[1600px] mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
      
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

export default MainLayout;
