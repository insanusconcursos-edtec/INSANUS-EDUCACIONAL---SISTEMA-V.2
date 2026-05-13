import React, { useEffect, useState } from 'react';
import { subscribeToLogo } from '../../services/settingsService';

export const SystemLogo: React.FC = () => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToLogo(setLogoUrl);
    return () => unsubscribe();
  }, []);

  if (logoUrl) {
    return <img src={logoUrl} alt="Logo do Sistema" className="h-8 md:h-10 object-contain" />;
  }

  return (
    <div className="text-xl font-black italic tracking-tighter">
      <span className="text-red-600">INSANUS</span>
      <span className="text-white">PLANNER</span>
    </div>
  );
};
