import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  getDocs,
  limit,
  setDoc,
  increment,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { toPlainObject } from './firestoreUtils';
import { SupportTicket, TicketMessage, TicketStatus, ProductType } from '../types/support';

const TICKETS_COLLECTION = 'support_tickets';

export const supportService = {
  // Create a new ticket (Alternative signature for frontend consistency)
  async openTicket(data: {
    userId: string;
    userProfile: {
      name: string;
      email: string;
      photoUrl: string;
    };
    productType: ProductType;
    productId: string;
    productName: string;
    initialMessage: string;
  }) {
    return this.createTicket({
      userId: data.userId,
      userProfile: {
        ...data.userProfile,
        phone: '' // Default or empty if not provided in openTicket
      },
      productType: data.productType,
      productId: data.productId,
      productName: data.productName,
    }, data.initialMessage);
  },

  // Create a new ticket
  async createTicket(ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'lastMessageSnippet' | 'unreadCountAdmin' | 'unreadCountUser' | 'status'>, firstMessage: string) {
    const now = Date.now();
    const ticketRef = collection(db, TICKETS_COLLECTION);
    
    const newTicket: Omit<SupportTicket, 'id'> = {
      ...ticketData,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      lastMessageSnippet: firstMessage,
      unreadCountAdmin: 1,
      unreadCountUser: 0,
    };

    const docRef = await addDoc(ticketRef, newTicket);
    
    // Add first message
    const messageRef = collection(db, TICKETS_COLLECTION, docRef.id, 'messages');
    await addDoc(messageRef, {
      senderId: ticketData.userId,
      senderRole: 'student',
      senderName: ticketData.userProfile.name,
      text: firstMessage,
      createdAt: now,
    });

    return docRef.id;
  },

  // List tickets for a user (Student view)
  subscribeToUserTickets(userId: string, callback: (tickets: SupportTicket[]) => void) {
    const q = query(
      collection(db, TICKETS_COLLECTION),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as SupportTicket);
      callback(tickets);
    });
  },

  // List tickets by type and product (Admin dashboard view)
  subscribeToGlobalTickets(callback: (tickets: SupportTicket[]) => void) {
    const q = query(
      collection(db, TICKETS_COLLECTION),
      orderBy('updatedAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as SupportTicket);
      callback(tickets);
    });
  },

  // List tickets for a specific product
  subscribeToProductTickets(productType: ProductType, productId: string, callback: (tickets: SupportTicket[]) => void) {
    const q = query(
      collection(db, TICKETS_COLLECTION),
      where('productType', '==', productType),
      where('productId', '==', productId),
      orderBy('updatedAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as SupportTicket);
      callback(tickets);
    });
  },

  // Subscribe to messages in a ticket
  subscribeToMessages(ticketId: string, callback: (messages: TicketMessage[]) => void) {
    const q = query(
      collection(db, TICKETS_COLLECTION, ticketId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as TicketMessage);
      callback(messages);
    });
  },

  // Send a message
  async sendMessage(ticketId: string, message: Omit<TicketMessage, 'id' | 'createdAt'>, isAdmin: boolean) {
    const now = Date.now();
    const messageRef = collection(db, TICKETS_COLLECTION, ticketId, 'messages');
    
    await addDoc(messageRef, {
      ...message,
      createdAt: now,
    });

    // Update ticket preview and counters
    const updateData: any = {
      updatedAt: now,
      lastMessageSnippet: message.text,
    };

    if (isAdmin) {
      updateData.unreadCountUser = increment(1);
    } else {
      updateData.unreadCountAdmin = increment(1);
    }

    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), updateData);
  },

  // Update Ticket Status
  async updateStatus(ticketId: string, status: TicketStatus) {
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
      status,
      updatedAt: Date.now()
    });
  },

  // Reset unread count
  async resetUnread(ticketId: string, isAdmin: boolean) {
    const field = isAdmin ? 'unreadCountAdmin' : 'unreadCountUser';
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), {
      [field]: 0
    });
  }
};
