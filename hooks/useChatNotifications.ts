import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Call } from '../types/chat';

export const useChatNotifications = () => {
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<{ id: string; mentorId: string; mentorName: string; mentorPhotoUrl?: string; lastMessage: string; lastMessageTime: any }[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      setRecentNotifications([]);
      return;
    }

    // Monitora calls/chats onde o aluno tem mensagens não lidas
    const callsRef = collection(db, 'calls');
    const q = query(
      callsRef,
      where('studentId', '==', currentUser.uid),
      where('studentUnreadCount', '>', 0)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      const notifications: any[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data() as Call;
        total += data.studentUnreadCount || 0;
        notifications.push({
          id: doc.id,
          mentorId: data.mentorId,
          mentorName: data.mentorName,
          mentorPhotoUrl: data.mentorPhotoUrl,
          lastMessage: data.lastMessage,
          lastMessageTime: data.lastMessageTime
        });
      });

      setUnreadCount(total);
      setRecentNotifications(notifications.sort((a, b) => b.lastMessageTime?.toMillis() - a.lastMessageTime?.toMillis()));
    });

    return () => unsubscribe();
  }, [currentUser]);

  return { unreadCount, recentNotifications };
};
