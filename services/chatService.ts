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
  mentorPhotoUrl?: string
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
    return snapshot.docs[0].id;
  }
  
  const newCall = await addDoc(callsRef, {
    planId,
    studentId,
    studentName,
    studentPhotoUrl: studentPhotoUrl || '',
    mentorId,
    mentorName,
    mentorPhotoUrl: mentorPhotoUrl || '',
    lastMessage: '',
    lastMessageTime: serverTimestamp(),
    unreadCount: 0
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
    timestamp: serverTimestamp()
  };

  if (replyToId) messageData.replyToId = replyToId;
  if (replyToText) messageData.replyToText = replyToText;
  if (imageUrl) messageData.imageUrl = imageUrl;
  
  await addDoc(messagesRef, messageData);
  
  // Update call metadata
  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, {
    lastMessage: imageUrl ? '📷 Imagem' : text,
    lastMessageTime: serverTimestamp(),
    unreadCount: senderRole === 'student' ? increment(1) : 0
  });
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

export const markAsRead = async (callId: string) => {
  const callRef = doc(db, 'calls', callId);
  await updateDoc(callRef, {
    unreadCount: 0
  });
};
