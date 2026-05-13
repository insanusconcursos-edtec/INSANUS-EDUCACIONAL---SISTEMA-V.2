/* eslint-disable react/prop-types */
import React, { memo } from 'react';

interface BannerConfig {
  desktop: string;
  tablet: string;
  mobile: string;
}

interface PlanHeroBannerProps {
  currentTab: 'today' | 'calendar' | 'edict' | 'mentorship' | 'call' | 'simulados' | 'live';
  planData: {
    banners?: {
      today?: BannerConfig;
      calendar?: BannerConfig;
      edict?: BannerConfig;
      mentorship?: BannerConfig;
      call?: BannerConfig;
      simulados?: BannerConfig;
      live?: BannerConfig;
    };
  };
}

export const PlanHeroBanner: React.FC<PlanHeroBannerProps> = memo(({ currentTab, planData }) => {
  const banner = planData.banners?.[currentTab];

  // Só aborta se realmente não houver NENHUMA imagem
  if (!banner || (!banner.desktop && !banner.tablet && !banner.mobile)) {
      return null;
  }

  return (
    <div className="relative w-full bg-zinc-900">
      <picture>
        <source 
          media="(min-width: 1024px)" 
          srcSet={banner.desktop || banner.tablet || banner.mobile} 
        />
        <source 
          media="(min-width: 768px)" 
          srcSet={banner.tablet || banner.desktop || banner.mobile} 
        />
        <img 
          src={banner.mobile || banner.tablet || banner.desktop} 
          alt={`Banner ${currentTab}`} 
          className="w-full h-48 md:h-[400px] object-cover border-b border-[var(--plan-theme)]/30 shadow-lg"
        />
      </picture>
      
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent"></div>
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-zinc-950 to-transparent h-32 md:h-48 pointer-events-none"></div>
    </div>
  );
});

PlanHeroBanner.displayName = 'PlanHeroBanner';
