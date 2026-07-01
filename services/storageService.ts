import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const uploadProfilePhoto = async (userId: string, file: File): Promise<string> => {
  const fileRef = ref(storage, `profile_photos/${userId}/${file.name}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
};

export const uploadSupportImage = async (ticketId: string, file: File): Promise<string> => {
  const timestamp = Date.now();
  const fileRef = ref(storage, `support_images/${ticketId}/${timestamp}_${file.name}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
};

export const uploadFile = async (file: File, path: string): Promise<string> => {
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
};
