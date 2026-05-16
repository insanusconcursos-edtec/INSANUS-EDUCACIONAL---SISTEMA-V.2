import React, { useState, useEffect, useRef } from 'react';
import { Bell, MessageSquare, Megaphone, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { Announcement, subscribeToAnnouncements, markAnnouncementAsRead } from '../../services/announcementService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';

interface NotificationItem {
  id: string;
  type: 'announcement' | 'chat';
  title: string;
  content: string;
  timestamp: number;
  data: any;
}

export const NotificationBell: React.FC = () => {
  const { currentUser, userRole, userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const unsubs: (() => void)[] = [];

    // 1. Subscribe to Announcements
    const studentPlanId = (userData as any)?.planId || (userData as any)?.currentPlanId;

    if (studentPlanId) {
      const unsubAnnouncements = subscribeToAnnouncements(studentPlanId, (allAnnouncements) => {
        const unreadAnnouncements = allAnnouncements
          .filter(a => !a.readBy?.includes(currentUser.uid))
          .map(a => ({
            id: a.id,
            type: 'announcement' as const,
            title: a.title,
            content: a.content,
            timestamp: a.createdAt,
            data: a
          }));
        
        setNotifications(prev => {
          const others = prev.filter(n => n.type !== 'announcement');
          const merged = [...others, ...unreadAnnouncements].sort((a, b) => b.timestamp - a.timestamp);
          // Deduplicate by ID
          return merged.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        });
      });
      unsubs.push(unsubAnnouncements);
    }

    // 2. Subscribe to Unread Chat Messages (For Students and Mentors)
    const callsRef = collection(db, 'calls');
    let q;
    if (userRole === 'STUDENT') {
      q = query(
        callsRef,
        where('studentId', '==', currentUser.uid),
        where('studentUnreadCount', '>', 0)
      );
    } else if (userRole === 'ADMIN' || userRole === 'COLLABORATOR') {
      // Mentors check unreadCount
      q = query(
        callsRef,
        where('mentorId', '==', currentUser.uid),
        where('unreadCount', '>', 0)
      );
    }

    if (q) {
      const unsubChat = onSnapshot(q, (snapshot) => {
        const chatNotifications = snapshot.docs.map(doc => {
          const data = doc.data();
          const isStudent = userRole === 'STUDENT';
          const senderName = isStudent ? (data.mentorName || 'Mentor') : (data.studentName || 'Aluno');
          
          return {
            id: doc.id,
            type: 'chat' as const,
            title: isStudent ? 'Nova mensagem do Mentor' : 'Nova mensagem do Aluno',
            content: `Você tem uma nova mensagem de ${senderName}.`,
            timestamp: data.lastMessageTime?.toMillis() || Date.now(),
            data: { callId: doc.id, mentorId: isStudent ? data.mentorId : null }
          };
        });

        setNotifications(prev => {
          const others = prev.filter(n => n.type !== 'chat');
          const merged = [...others, ...chatNotifications].sort((a, b) => b.timestamp - a.timestamp);
          return merged.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        });
      });
      unsubs.push(unsubChat);
    }

    return () => unsubs.forEach(unsub => unsub());
  }, [currentUser, userRole, userData]);

  const handleMarkAsRead = async (item: NotificationItem) => {
    if (item.type === 'announcement') {
      try {
        await markAnnouncementAsRead(item.id, currentUser!.uid);
      } catch (err) {
        console.error("Erro ao marcar como lido:", err);
      }
    } else {
      handleItemClick(item);
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    if (item.type === 'chat') {
      if (userRole === 'STUDENT') {
        navigate(`/app/dashboard?tab=call${item.data.mentorId ? `&mentorId=${item.data.mentorId}` : ''}`);
      } else {
        navigate('/admin/suporte'); // Rota de suporte do admin
      }
    } else if (item.type === 'announcement') {
      // Stay on dashboard if it's an announcement
      if (userRole === 'STUDENT') {
        navigate('/app/dashboard');
      }
    }
    setIsOpen(false);
  };

  const unreadCount = notifications.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-brand-red text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-zinc-950 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Notificações</h3>
              <span className="text-[10px] text-zinc-500 uppercase font-bold">{unreadCount} pendentes</span>
            </div>

            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-zinc-600" />
                  </div>
                  <p className="text-xs text-zinc-500 font-medium tracking-tight">Tudo em dia por aqui!</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {notifications.map((item) => (
                    <div 
                      key={item.id}
                      className="p-4 hover:bg-white/5 transition-colors group cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          item.type === 'announcement' ? 'bg-amber-500/10 text-amber-500' : 'bg-brand-red/10 text-brand-red'
                        }`}>
                          {item.type === 'announcement' ? (
                            <Megaphone className="w-4 h-4" />
                          ) : (
                            <MessageSquare className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-[11px] font-bold text-white truncate pr-2">{item.title}</h4>
                            <span className="text-[9px] text-zinc-500 whitespace-nowrap">
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                            {item.content}
                          </p>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(item);
                            }}
                            className="flex items-center gap-1.5 text-[9px] font-black text-brand-red uppercase tracking-widest hover:text-white transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            MARCAR COMO LIDO
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 bg-zinc-950/50 border-t border-zinc-800 text-center">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[9px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors"
                >
                  Fechar Central
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
