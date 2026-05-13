import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase'; 

export const uploadSystemLogo = async (file: File): Promise<string> => {
  const storageRef = ref(storage, 'settings/logo/system_logo.png');
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  const settingsRef = doc(db, 'settings', 'appearance');
  await setDoc(settingsRef, { logoUrl: downloadUrl, updatedAt: new Date() }, { merge: true });
  return downloadUrl;
};

export const uploadFavicon = async (file: File): Promise<string> => {
  const storageRef = ref(storage, 'settings/logo/favicon.png');
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  const settingsRef = doc(db, 'settings', 'appearance');
  await setDoc(settingsRef, { faviconUrl: downloadUrl, updatedAt: new Date() }, { merge: true });
  return downloadUrl;
};

export const uploadPWALogo = async (file: File): Promise<string> => {
  const storageRef = ref(storage, 'settings/logo/pwa_logo.png');
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  const settingsRef = doc(db, 'settings', 'appearance');
  await setDoc(settingsRef, { pwaLogoUrl: downloadUrl, updatedAt: new Date() }, { merge: true });
  return downloadUrl;
};

export const subscribeToLogo = (callback: (url: string | null) => void) => {
  const settingsRef = doc(db, 'settings', 'appearance');
  return onSnapshot(settingsRef, (docSnap) => {
    if (docSnap.exists() && docSnap.data().logoUrl) {
      callback(docSnap.data().logoUrl);
    } else {
      callback(null);
    }
  });
};
