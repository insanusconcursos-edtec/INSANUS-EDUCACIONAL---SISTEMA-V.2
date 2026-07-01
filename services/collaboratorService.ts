
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
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
  serverTimestamp 
} from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';
import { AUTH_CONFIG } from './authConstants';

// === TYPES ===

export interface CollaboratorPermissions {
  planos: boolean;      // Access to Plans
  simulados: boolean;  // Access to Simulated Exams
  alunos: boolean;     // Access to Students
  equipe: boolean;       // Access to Team Management
  produtos: boolean;
  cursos_online: boolean;
  turmas_presenciais: boolean;
  eventos_ao_vivo: boolean;
  eventos_presenciais: boolean;
  suporte: boolean;
  vendas: boolean;
}

export interface Collaborator {
  uid: string;
  name: string;
  username: string;
  email: string; // The constructed internal email
  role: 'collaborator' | 'seller';
  pagarmeRecipientId?: string; // Optional for collaborator, required for seller
  permissions: CollaboratorPermissions;
  createdAt?: any;
}

export interface CreateCollaboratorData {
  name: string;
  username: string;
  password: string;
  role: 'collaborator' | 'seller';
  pagarmeRecipientId?: string;
  permissions: CollaboratorPermissions;
}

// === OPERATIONS ===

/**
 * Creates a collaborator in Auth (using Secondary App pattern) and Firestore.
 */
export const createCollaborator = async (data: CreateCollaboratorData): Promise<string> => {
  // 1. Initialize a secondary app to avoid logging out the current admin
  const secondaryApp = initializeApp(firebaseConfig, "SecondaryTeamManager");
  const secondaryAuth = getAuth(secondaryApp);

  const internalEmail = `${data.username.toLowerCase().trim()}${AUTH_CONFIG.DOMAIN_NEW}`;

  try {
    // 2. Create User in Auth
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth, 
      internalEmail, 
      data.password
    );
    const uid = userCredential.user.uid;

    // 3. Create Document in Firestore (Using MAIN db instance)
    const newCollaborator: Collaborator = {
      uid,
      name: data.name.toUpperCase(),
      username: data.username.toLowerCase().trim(),
      email: internalEmail,
      role: data.role,
      permissions: data.permissions,
      createdAt: serverTimestamp()
    };

    if (data.pagarmeRecipientId) {
      newCollaborator.pagarmeRecipientId = data.pagarmeRecipientId;
    }

    await setDoc(doc(db, 'users', uid), newCollaborator);

    // 4. Cleanup Secondary Session
    await signOut(secondaryAuth);
    
    return uid;

  } catch (error: any) {
    console.error("Error creating collaborator:", error);
    
    if (error.code === 'auth/email-already-in-use') {
      throw new Error(`O usuário "${data.username}" já está em uso.`);
    }
    
    throw new Error(error.message || "Erro ao criar colaborador.");
  } finally {
    // 5. Delete Secondary App to free resources
    await deleteApp(secondaryApp);
  }
};

/**
 * Fetches all users with role 'collaborator' or 'seller'.
 */
export const getCollaborators = async (): Promise<Collaborator[]> => {
  const q = query(
    collection(db, 'users'), 
    where('role', 'in', ['collaborator', 'seller']),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Collaborator);
};

/**
 * Updates permissions or basic info.
 */
export const updateCollaborator = async (uid: string, data: Partial<Collaborator>) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, data);
};

/**
 * Updates specifically the permissions object.
 */
export const updateCollaboratorPermissions = async (uid: string, permissions: CollaboratorPermissions) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { permissions });
};

/**
 * Deletes the collaborator from Firestore.
 * Note: Does not delete from Auth (requires Admin SDK or cloud function).
 * However, the app logic should prevent login if Firestore doc is missing or check active status.
 */
export const deleteCollaborator = async (uid: string) => {
  await deleteDoc(doc(db, 'users', uid));
};
