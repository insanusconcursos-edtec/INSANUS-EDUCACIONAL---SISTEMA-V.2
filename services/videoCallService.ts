import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  getDocs,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { ScheduledCall } from '../types/videoCall';

const CALLS_COLLECTION = 'scheduled_calls';

export const scheduleVideoCall = async (data: Omit<ScheduledCall, 'id' | 'createdAt' | 'status' | 'roomId'>) => {
  const roomId = Math.random().toString(36).substring(2, 15);
  return addDoc(collection(db, CALLS_COLLECTION), {
    ...data,
    status: 'scheduled',
    roomId,
    createdAt: serverTimestamp()
  });
};

export const updateCallStatus = async (callId: string, status: ScheduledCall['status']) => {
  return updateDoc(doc(db, CALLS_COLLECTION, callId), { status });
};

export const requestEntry = async (callId: string) => {
  return updateDoc(doc(db, CALLS_COLLECTION, callId), { 
    requestEntry: true, 
    studentStatus: 'waiting' 
  });
};

export const approveEntry = async (callId: string) => {
  return updateDoc(doc(db, CALLS_COLLECTION, callId), { 
    requestEntry: false, 
    status: 'accepted' 
  });
};

export const rejectEntry = async (callId: string) => {
  return updateDoc(doc(db, CALLS_COLLECTION, callId), { 
    requestEntry: false, 
    studentStatus: 'rejected' 
  });
};

export const updateHostControls = async (callId: string, controls: { forceMute?: boolean, forceHideCamera?: boolean }) => {
  return updateDoc(doc(db, CALLS_COLLECTION, callId), controls);
};

export const subscribeToScheduledCalls = (
  filters: { planId?: string; studentId?: string; mentorId?: string },
  callback: (calls: ScheduledCall[]) => void
) => {
  const q = collection(db, CALLS_COLLECTION);
  const constraints: any[] = [];

  if (filters.planId) constraints.push(where('planId', '==', filters.planId));
  if (filters.studentId) constraints.push(where('studentId', '==', filters.studentId));
  if (filters.mentorId) constraints.push(where('mentorId', '==', filters.mentorId));

  const finalQuery = query(q, ...constraints, orderBy('scheduledAt', 'asc'));

  return onSnapshot(finalQuery, (snapshot) => {
    const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledCall));
    callback(calls);
  });
};

export const subscribeToCall = (callId: string, callback: (call: ScheduledCall) => void) => {
  return onSnapshot(doc(db, CALLS_COLLECTION, callId), (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as ScheduledCall);
    }
  });
};

// Signaling for WebRTC
export const addSignal = async (callId: string, type: 'offer' | 'answer' | 'candidate', data: any, senderId: string) => {
  return addDoc(collection(db, CALLS_COLLECTION, callId, 'signals'), {
    type,
    data,
    senderId,
    createdAt: serverTimestamp()
  });
};

export const subscribeToSignals = (callId: string, callback: (signals: any[]) => void) => {
  const q = query(collection(db, CALLS_COLLECTION, callId, 'signals'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const signals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(signals);
  });
};

export const clearSignals = async (callId: string) => {
  const signalsRef = collection(db, CALLS_COLLECTION, callId, 'signals');
  const snapshot = await getDocs(signalsRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
};
