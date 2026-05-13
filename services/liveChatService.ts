import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc,
  getDoc,
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { LiveChatMessage, LiveActiveUser } from '../types/liveEvent';

const CHAT_COLLECTION = 'live_chats';
const EVENTS_COLLECTION = 'live_events';

// Lista básica de palavras ofensivas (exemplo)
const badWords = [
  'palavrao1', 'palavrao2', 'ofensa1', 'ofensa2', 'spam', 'lixo', 'merda', 'caralho', 'porra', 'puta'
];

const filterBadWords = (text: string): string => {
  let filteredText = text;
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filteredText = filteredText.replace(regex, '***');
  });
  return filteredText;
};

export const liveChatService = {
  // --- MENSAGENS ---
  subscribeToMessages: (eventId: string, callback: (messages: LiveChatMessage[]) => void) => {
    const q = query(
      collection(db, CHAT_COLLECTION, eventId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LiveChatMessage));
      callback(messages);
    });
  },

  sendMessage: async (eventId: string, messageData: Omit<LiveChatMessage, 'id' | 'eventId' | 'createdAt'>): Promise<string> => {
    try {
      // Trava de Segurança: Verifica se o usuário está bloqueado ou banido antes de enviar
      const presenceRef = doc(db, EVENTS_COLLECTION, eventId, 'presence', messageData.userId);
      const presenceSnap = await getDoc(presenceRef);
      
      if (presenceSnap.exists()) {
        const pData = presenceSnap.data();
        if (pData.isChatBlocked || pData.isBanned) {
          throw new Error('Usuário bloqueado');
        }
      }

      // Blindagem: Remove qualquer chave cujo valor seja estritamente 'undefined'
      const sanitizedData = Object.fromEntries(
        Object.entries(messageData).filter(([_, v]) => v !== undefined)
      );

      const filteredText = filterBadWords(sanitizedData.text as string);
      const chatRef = collection(db, CHAT_COLLECTION, eventId, 'messages');
      const docRef = await addDoc(chatRef, {
        ...sanitizedData,
        text: filteredText,
        eventId,
        senderName: sanitizedData.userName || sanitizedData.senderName || 'Aluno',
        senderPhoto: sanitizedData.userPhoto || sanitizedData.senderPhoto || '',
        createdAt: serverTimestamp(),
        isDeleted: false
      });
      return docRef.id;
    } catch (error) {
      console.error("Error sending chat message:", error);
      throw error;
    }
  },

  deleteMessage: async (eventId: string, messageId: string): Promise<void> => {
    try {
      const docRef = doc(db, CHAT_COLLECTION, eventId, 'messages', messageId);
      await updateDoc(docRef, {
        isDeleted: true,
        text: '🚫 Mensagem apagada pelo usuário'
      });
    } catch (error) {
      console.error("Error deleting chat message:", error);
      throw error;
    }
  },

  clearChat: async (eventId: string): Promise<void> => {
    try {
      const chatRef = collection(db, CHAT_COLLECTION, eventId, 'messages');
      const snapshot = await getDocs(chatRef);
      const batch = writeBatch(db);

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref); // Substituído batch.update por batch.delete (Hard Delete)
      });

      await batch.commit();
    } catch (error) {
      console.error("Error clearing chat:", error);
      throw error;
    }
  },

  editMessage: async (eventId: string, messageId: string, newText: string): Promise<void> => {
    try {
      const docRef = doc(db, CHAT_COLLECTION, eventId, 'messages', messageId);
      await updateDoc(docRef, { 
        text: newText, 
        isEdited: true 
      });
    } catch (error) {
      console.error("Error editing chat message:", error);
      throw error;
    }
  },

  // --- USUÁRIOS ---
  subscribeToActiveUsers: (eventId: string, callback: (users: LiveActiveUser[]) => void) => {
    const q = query(
      collection(db, EVENTS_COLLECTION, eventId, 'presence'),
      orderBy('joinedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
      } as LiveActiveUser));
      callback(users);
    });
  },

  blockUserChat: async (eventId: string, userId: string, isBlocked: boolean): Promise<void> => {
    try {
      const docRef = doc(db, EVENTS_COLLECTION, eventId, 'presence', userId);
      await updateDoc(docRef, {
        isChatBlocked: isBlocked
      });
    } catch (error) {
      console.error("Error blocking user chat:", error);
      throw error;
    }
  },

  banUserFromEvent: async (eventId: string, userId: string, isBanned: boolean): Promise<void> => {
    try {
      const docRef = doc(db, EVENTS_COLLECTION, eventId, 'presence', userId);
      await updateDoc(docRef, {
        isBanned: isBanned,
        isChatBlocked: isBanned // Banir também bloqueia o chat por segurança
      });
    } catch (error) {
      console.error("Error banning user from event:", error);
      throw error;
    }
  }
};

export const joinLiveEvent = async (eventId: string, user: { uid: string, name: string, email: string, photoUrl?: string }) => {
  if (!user.uid) return;
  const presenceRef = doc(db, `live_events/${eventId}/presence`, user.uid);
  
  // Busca status atual para não sobrescrever punições (Bloqueio/Banimento)
  const docSnap = await getDoc(presenceRef);
  
  const baseData = {
    userId: user.uid,
    eventId: eventId,
    userName: user.name || 'Aluno',
    userEmail: user.email || '',
    userPhoto: user.photoUrl || '',
    joinedAt: new Date().toISOString()
  };

  if (docSnap.exists()) {
    // Se já existe, apenas atualiza dados básicos sem tocar nos campos de moderação
    await updateDoc(presenceRef, baseData);
  } else {
    // Se é novo, define os padrões
    await setDoc(presenceRef, {
      ...baseData,
      isChatBlocked: false,
      isBanned: false
    });
  }
};

export const leaveLiveEvent = async (eventId: string, userId: string) => {
  if (!userId) return;
  const presenceRef = doc(db, `live_events/${eventId}/presence`, userId);
  await deleteDoc(presenceRef);
};
