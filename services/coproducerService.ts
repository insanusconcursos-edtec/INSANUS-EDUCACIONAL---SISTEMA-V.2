import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Coproducer } from '../types/coproducer';

const COLLECTION_NAME = 'coproducers';

export const coproducerService = {
  async getAll(): Promise<Coproducer[]> {
    const response = await fetch('/api/admin/coproducers');
    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.coproducers;
  },

  async getById(id: string): Promise<Coproducer | null> {
    const all = await this.getAll();
    return all.find(c => c.id === id) || null;
  },

  async create(data: Omit<Coproducer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const response = await fetch('/api/admin/coproducers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.id;
  },

  async update(id: string, data: Partial<Omit<Coproducer, 'id' | 'createdAt'>>): Promise<void> {
    const response = await fetch(`/api/admin/coproducers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`/api/admin/coproducers/${id}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
  },

  async search(term: string): Promise<Coproducer[]> {
    // Basic search: gets all and filters in JS if term is small
    // For production with many coproducers, this should use a proper search engine or better Firestore tactics
    const all = await this.getAll();
    const normalizedTerm = term.toLowerCase();
    return all.filter(c => 
      c.name.toLowerCase().includes(normalizedTerm) || 
      (c.username && c.username.toLowerCase().includes(normalizedTerm)) ||
      c.email.toLowerCase().includes(normalizedTerm) ||
      c.document.includes(normalizedTerm)
    );
  }
};
