
import React from 'react';
import { Settings } from 'lucide-react';
import StudentCalendarComponent from './StudentCalendar'; 
import EditalVerticalizadoComponent from './EditalVerticalizado'; 
import StudentSimulatedComponent from './StudentSimulated'; // Import Real Component

const PagePlaceholder = ({ title, icon: Icon, subtitle }: { title: string, icon: React.ElementType, subtitle: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 animate-in fade-in zoom-in-95 duration-500">
    <div className="p-6 rounded-full bg-zinc-900 border border-zinc-800 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
      <Icon size={48} className="text-zinc-600" />
    </div>
    <div className="space-y-2">
      <h1 className="text-3xl font-black text-white uppercase tracking-tighter">{title}</h1>
      <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">{subtitle}</p>
    </div>
  </div>
);

// Re-exporting Components
export { default as StudentDashboard } from './StudentDashboard'; 
export const StudentCalendar = StudentCalendarComponent;
export const StudentEdict = EditalVerticalizadoComponent;
export const StudentSimulated = StudentSimulatedComponent; // Conectado o componente real

export const StudentConfig = () => (
  <PagePlaceholder title="Configurações" icon={Settings} subtitle="Ajustes da conta e preferências" />
);
