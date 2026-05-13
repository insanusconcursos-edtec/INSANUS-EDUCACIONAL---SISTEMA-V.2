import { db, storage } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Class } from '../types/class';

const CLASSES_COLLECTION = 'classes';

export const classService = {
  uploadBanner: async (file: File): Promise<string> => {
    try {
      // Utilizando 'course_banners' para aproveitar as regras de permissão já existentes no Storage
      const storageRef = ref(storage, `course_banners/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error("Error uploading banner:", error);
      throw error;
    }
  },

  createClass: async (classData: Omit<Class, 'id'>, bannerDesktopFile?: File, bannerMobileFile?: File, bannerTabletFile?: File): Promise<string> => {
    try {
      const finalData: any = { ...classData };

      // Remove undefined fields to prevent Firestore errors
      Object.keys(finalData).forEach(key => {
        if (finalData[key] === undefined) {
          delete finalData[key];
        }
      });

      if (bannerDesktopFile) {
        finalData.bannerUrlDesktop = await classService.uploadBanner(bannerDesktopFile);
      }
      if (bannerMobileFile) {
        finalData.bannerUrlMobile = await classService.uploadBanner(bannerMobileFile);
      }
      if (bannerTabletFile) {
        finalData.bannerUrlTablet = await classService.uploadBanner(bannerTabletFile);
      }

      const docRef = await addDoc(collection(db, CLASSES_COLLECTION), {
        ...finalData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating class: ", error);
      throw error;
    }
  },

  updateClass: async (id: string, classData: Partial<Class>, bannerDesktopFile?: File, bannerMobileFile?: File, bannerTabletFile?: File): Promise<void> => {
    try {
      const finalData: any = { ...classData };

      // Replace undefined fields with deleteField() to remove them from Firestore
      Object.keys(finalData).forEach(key => {
        if (finalData[key] === undefined) {
          finalData[key] = deleteField();
        }
      });

      if (bannerDesktopFile) {
        finalData.bannerUrlDesktop = await classService.uploadBanner(bannerDesktopFile);
      }
      if (bannerMobileFile) {
        finalData.bannerUrlMobile = await classService.uploadBanner(bannerMobileFile);
      }
      if (bannerTabletFile) {
        finalData.bannerUrlTablet = await classService.uploadBanner(bannerTabletFile);
      }

      const classRef = doc(db, CLASSES_COLLECTION, id);
      await updateDoc(classRef, {
        ...finalData,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating class: ", error);
      throw error;
    }
  },

  deleteClass: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, CLASSES_COLLECTION, id));
    } catch (error) {
      console.error("Error deleting class: ", error);
      throw error;
    }
  },

  getClasses: async (): Promise<Class[]> => {
    try {
      const querySnapshot = await getDocs(collection(db, CLASSES_COLLECTION));
      const classes: Class[] = [];
      querySnapshot.forEach((doc) => {
        classes.push({ id: doc.id, ...doc.data() } as Class);
      });
      return classes;
    } catch (error) {
      console.error("Error fetching classes: ", error);
      throw error;
    }
  },

  getClassById: async (id: string): Promise<Class | null> => {
    try {
      const docRef = doc(db, CLASSES_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Class;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error fetching class: ", error);
      throw error;
    }
  }
};
