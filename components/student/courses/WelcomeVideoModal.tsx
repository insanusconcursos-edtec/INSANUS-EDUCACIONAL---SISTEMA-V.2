
import React from 'react';
import { X } from 'lucide-react';
import { AlternativeYouTubePlayer } from '../../shared/AlternativeYouTubePlayer';

interface WelcomeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
}

export function WelcomeVideoModal({ isOpen, onClose, videoUrl, title }: WelcomeVideoModalProps) {
  if (!isOpen) return null;

  // Helper para renderizar o helper do YouTube
  function getYouTubeID(url: string) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  const youtubeId = getYouTubeID(videoUrl);
  const isPanda = videoUrl.includes('panda.video') || videoUrl.includes('player-vz');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
          <h3 className="text-white font-black text-sm md:text-lg uppercase tracking-tight drop-shadow-md">
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
          >
            <X size={24} />
          </button>
        </div>

        {/* Video Player */}
        <div className="w-full h-full">
          {youtubeId ? (
            <AlternativeYouTubePlayer videoId={youtubeId} />
          ) : isPanda ? (
            <iframe 
              src={videoUrl} 
              className="w-full h-full" 
              frameBorder="0" 
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" 
              allowFullScreen 
            />
          ) : (
            <iframe 
              src={videoUrl} 
              className="w-full h-full" 
              frameBorder="0" 
              allowFullScreen 
            />
          )}
        </div>
      </div>
    </div>
  );
}
