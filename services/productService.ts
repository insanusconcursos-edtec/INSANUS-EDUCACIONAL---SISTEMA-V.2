import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { toPlainObject } from './firestoreUtils';
import { Product } from '../types/product';

const COLLECTION_NAME = 'ticto_products';

export const uploadProductCover = async (file: File): Promise<string> => {
  const storageRef = ref(storage, `products/covers/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

export const getProducts = async (): Promise<Product[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    return querySnapshot.docs.map(doc => toPlainObject({
      id: doc.id,
      ...doc.data()
    }) as Product);
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

export const getProductByOfferId = async (offerId: string): Promise<{ product: Product, offer: any } | null> => {
  try {
    const products = await getProducts();
    for (const product of products) {
      if (product.offers) {
        const offer = product.offers.find(o => o.id === offerId);
        if (offer) {
          return { product, offer };
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding product by offer ID:', error);
    throw error;
  }
};

export const createProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...product,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

export const updateProduct = async (id: string, product: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...product,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};
