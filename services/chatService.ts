import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  increment,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { Call, Message } from '../types/chat';

export const getOrCreateCall = async (
  planId: string, 
  studentId: string, 
  studentName: string, 
  mentorId: string, 
  mentorName: string,
  studentPhotoUrl?: string,
  mentorPhotoUrl?: string,
  assignedMentor?: 'kelsen' | 'borges'
): Promise<string> => {
  const callsRef = collection(db, 'calls');
  const q = query(
    callsRef, 
    where('planId', '==', planId),
    where('studentId', '==', studentId),
    where('mentorId', '==', mentorId)
  );
  
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    // Se a conversa já existe mas não tem o assignedMentor (migração), atualizamos
    const existingDoc = snapshot.docs[0];
    if (assignedMentor && !existingDoc.data().assignedMentor) {
      await updateDoc(doc(db, 'calls', existingDoc.id), { assignedMentor });
    }
    return existingDoc.id;
  }
  
  const newCall = await addDoc(callsRef, {
    planId,
    studentId,
    studentName,
    studentPhotoUrl: studentPhotoUrl || '',
    mentorId,
    assignedMentor: assignedMentor || null,
    mentorName,
    mentorPhotoUrl: mentorPhotoUrl || '',
    lastMessage: '',
    lastMessageTime: serverTimestamp(),
    unreadCount: 0,
    studentUnreadCount: 0
  });
  
  return newCall.id;
};

export const sendMessage = async (
  callId: string, 
  senderId: string, 
  senderRole: 'student' | 'mentor', 
  text: string,
  replyToId?: string,
  replyToText?: string,
  imageUrl?: string
) => {
  const messagesRef = collection(db, 'calls', callId, 'messages');
  
  const messageData: any = {
    senderId,
    senderRole,
    text,
    unread: senderRole === 'mentor',
    timestamp: serverTimestamp()
  };

  if (replyToId) messageData.replyToId = replyToId;
  if (replyToText) messageData.replyToText = replyToText;
  if (imageUrl) messageData.imageUrl = imageUrl;
  
  await addDoc(messagesRef, messageData);
  
  // Update call metadata
  const callRef = doc(db, 'calls', callId);
  const updateData: any = {
    lastMessage: imageUrl ? '📷 Imagem' : text,
    lastMessageTime: serverTimestamp(),
  };

  if (senderRole === 'student') {
    updateData.unreadCount = increment(1);
    updateData.studentUnreadCount = 0; // Se estou enviando, já li as que estavam lá
  } else {
    updateData.studentUnreadCount = increment(1);
    updateData.unreadCount = 0;
  }

  await updateDoc(callRef, updateData);
};

export const editMessage = async (callId: string, messageId: string, newText: string) => {
  const messageRef = doc(db, 'calls', callId, 'messages', messageId);
  await updateDoc(messageRef, {
    text: newText,
    isEdited: true
  });
};

export const deleteMessage = async (callId: string, messageId: string) => {
  const messageRef = doc(db, 'calls', callId, 'messages', messageId);
  await updateDoc(messageRef, {
    isDeleted: true,
    text: '',
    imageUrl: null
  });

  const messagesRef = collection(db, 'calls', callId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
  const snapshot = await getDocs(q);
  const activeMessage = snapshot.docs.find(d => !d.data().isDeleted);

  const callRef = doc(db, 'calls', callId);
  if (!activeMessage) {
    await updateDoc(callRef, { lastMessage: '' });
  } else {
    const lastMsgData = activeMessage.data();
    await updateDoc(callRef, {
      lastMessage: lastMsgData.imageUrl ? '📷 Imagem' : lastMsgData.text,
      lastMessageTime: lastMsgData.timestamp
    });
  }
};

export const subscribeToMessages = (callId: string, callback: (messages: Message[]) => void) => {
  const messagesRef = collection(db, 'calls', callId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message));
    callback(messages);
  });
};

export const subscribeToCalls = (
  mentorId: string, 
  callback: (calls: Call[]) => void,
  planId?: string
) => {
  const callsRef = collection(db, 'calls');
  const constraints = [];
  
  if (mentorId) {
    constraints.push(where('mentorId', '==', mentorId));
  }
  
  if (planId) {
    constraints.push(where('planId', '==', planId));
  }
  
  constraints.push(orderBy('lastMessageTime', 'desc'));
  
  const q = query(callsRef, ...constraints);
  
  return onSnapshot(q, (snapshot) => {
    const calls = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Call));
    callback(calls);
  });
};

export const markAsRead = async (callId: string, role: 'student' | 'mentor' = 'mentor') => {
  const callRef = doc(db, 'calls', callId);
  
  if (role === 'mentor') {
    await updateDoc(callRef, {
      unreadCount: 0
    });
  } else {
    await updateDoc(callRef, {
      studentUnreadCount: 0
    });
    
    // Marcar as mensagens do mentor como lidas
    const messagesRef = collection(db, 'calls', callId, 'messages');
    const q = query(messagesRef, where('senderRole', '==', 'mentor'), where('unread', '==', true));
    const snapshot = await getDocs(q);
    
    const batchPromises = snapshot.docs.map(d => updateDoc(doc(messagesRef, d.id), { unread: false }));
    await Promise.all(batchPromises);
  }
};
