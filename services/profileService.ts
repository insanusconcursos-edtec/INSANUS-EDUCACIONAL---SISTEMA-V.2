import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth } from './firebase';

export const updateStudentProfile = async (userId: string, data: any) => {
  const userRef = doc(db, `users/${userId}`);
  await setDoc(userRef, {
    ...data,
    updatedAt: new Date().toISOString()
  }, { merge: true });
};

export const changeUserPassword = async (newPassword: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado.');
  
  try {
    await updatePassword(user, newPassword);
  } catch (error: any) {
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('Por questões de segurança, sua sessão expirou para esta ação. Por favor, saia, faça login novamente e tente alterar a senha.');
    }
    throw error;
  }
};

export const checkNicknameExists = async (nickname: string, currentUserId: string): Promise<boolean> => {
  if (!nickname.trim()) return false;
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('nickname', '==', nickname));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return false;

  // Verifica se o apelido encontrado pertence a outro usuário que não seja o próprio usuário atual
  const existsForOtherUser = snapshot.docs.some(doc => doc.id !== currentUserId);
  return existsForOtherUser;
};
