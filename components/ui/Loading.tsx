
import React from 'react';

const Loading: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-black">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-800 border-t-brand-red"></div>
        <p className="text-xs font-black text-zinc-500 uppercase tracking-widest animate-pulse">
          Carregando Sistema...
        </p>
      </div>
    </div>
  );
};

export default Loading;
