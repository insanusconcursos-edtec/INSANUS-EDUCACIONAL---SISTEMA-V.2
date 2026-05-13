import { db } from './firebase';
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy } from 'firebase/firestore';

export interface MetadataItem {
  id: string;
  name: string;
}

const CATEGORIES_COLLECTION = 'class_categories';
const SUBCATEGORIES_COLLECTION = 'class_subcategories';
const ORGANIZATIONS_COLLECTION = 'class_organizations';

export const classMetadataService = {
  // Categories
  getCategories: async (): Promise<MetadataItem[]> => {
    try {
      const q = query(collection(db, CATEGORIES_COLLECTION), orderBy('name'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  },

  createCategory: async (name: string): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), { name });
      return docRef.id;
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  },

  deleteCategory: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  },

  // Subcategories
  getSubcategories: async (): Promise<MetadataItem[]> => {
    try {
      const q = query(collection(db, SUBCATEGORIES_COLLECTION), orderBy('name'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      throw error;
    }
  },

  createSubcategory: async (name: string): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, SUBCATEGORIES_COLLECTION), { name });
      return docRef.id;
    } catch (error) {
      console.error("Error creating subcategory:", error);
      throw error;
    }
  },

  deleteSubcategory: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, SUBCATEGORIES_COLLECTION, id));
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      throw error;
    }
  },

  // Organizations
  getOrganizations: async (): Promise<MetadataItem[]> => {
    try {
      const q = query(collection(db, ORGANIZATIONS_COLLECTION), orderBy('name'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
    } catch (error) {
      console.error("Error fetching organizations:", error);
      throw error;
    }
  },

  createOrganization: async (name: string): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, ORGANIZATIONS_COLLECTION), { name });
      return docRef.id;
    } catch (error) {
      console.error("Error creating organization:", error);
      throw error;
    }
  },

  deleteOrganization: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, ORGANIZATIONS_COLLECTION, id));
    } catch (error) {
      console.error("Error deleting organization:", error);
      throw error;
    }
  }
};
