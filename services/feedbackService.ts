import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
} from 'firebase/firestore';
import { db } from './firebase';
import { Feedback } from '../types/feedback';
import { sanitizeData, toPlainObject } from './firestoreUtils';

const FEEDBACKS_COLLECTION = 'feedbacks';

export const feedbackService = {
  async submitFeedback(feedbackData: Omit<Feedback, 'id' | 'createdAt'>) {
    try {
      const sanitized = sanitizeData({
        ...feedbackData,
        createdAt: Date.now()
      });
      
      const docRef = await addDoc(collection(db, FEEDBACKS_COLLECTION), sanitized);
      return docRef.id;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  },

  async getFeedbacksByProduct(productId: string) {
    try {
      const q = query(
        collection(db, FEEDBACKS_COLLECTION),
        where('productId', '==', productId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as Feedback);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      throw error;
    }
  },

  async getFeedbacksByType(productType: string) {
    try {
      const q = query(
        collection(db, FEEDBACKS_COLLECTION),
        where('productType', '==', productType),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as Feedback);
    } catch (error) {
      console.error('Error fetching feedbacks by type:', error);
      throw error;
    }
  },

  async getAllFeedbacks() {
    try {
      const q = query(
        collection(db, FEEDBACKS_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => toPlainObject({ id: doc.id, ...doc.data() }) as Feedback);
    } catch (error) {
      console.error('Error fetching all feedbacks:', error);
      throw error;
    }
  }
};
