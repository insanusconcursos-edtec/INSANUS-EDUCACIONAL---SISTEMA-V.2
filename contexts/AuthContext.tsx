
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User,
  UserCredential 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { requestNotificationPermission } from '../services/notificationService';

interface UserData {
  role?: string;
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  photoURL?: string;
  access?: unknown[];
  allowManualGeneration?: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  userRole: 'ADMIN' | 'STUDENT' | 'COLLABORATOR' | 'SELLER' | 'COPRODUTOR' | null;
  userData: UserData | null; // Stores full firestore document data (permissions, etc)
  loading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  seedInitialUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'ADMIN' | 'STUDENT' | 'COLLABORATOR' | 'SELLER' | 'COPRODUTOR' | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Hardcoded admin email for this phase
  const ADMIN_EMAIL = 'insanusconcursos@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Solicitar permissão de notificação (PWA Push)
        requestNotificationPermission(user.uid);

        try {
            // Fetch User Data from Firestore
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                setUserData(data);

                // Sync photoURL to Firestore if it exists in Auth but not in Firestore
                // or if it's different.
                if (user.photoURL && data.photoURL !== user.photoURL && data.photoUrl !== user.photoURL && data.photo !== user.photoURL) {
                  try {
                    const { updateDoc } = await import('firebase/firestore');
                    await updateDoc(userDocRef, { photoURL: user.photoURL });
                  } catch (e) {
                    console.error("Failed to sync photoURL to Firestore", e);
                  }
                }
                
                const roleLower = (data.role || '').toLowerCase();

                // Determine Role from Firestore Data
                if (roleLower === 'collaborator') {
                    setUserRole('COLLABORATOR');
                } else if (roleLower === 'seller' || roleLower === 'vendedor' || roleLower === 'afiliado') {
                    setUserRole('SELLER');
                } else if (roleLower === 'coprodutor' || roleLower === 'coproducer') {
                    setUserRole('COPRODUTOR');
                } else if (roleLower === 'student') {
                    setUserRole('STUDENT');
                } else if (roleLower === 'admin' || user.email === ADMIN_EMAIL) {
                    setUserRole('ADMIN');
                } else {
                    setUserRole('STUDENT'); // Fallback
                }
            } else {
                // Fallback for Seeded/Hardcoded Admin without Firestore Doc
                if (user.email === ADMIN_EMAIL) {
                    setUserRole('ADMIN');
                    setUserData({ role: 'admin', name: 'Super Admin' });
                } else {
                    // Default fallback for users without doc (likely students created via auth directly)
                    setUserRole('STUDENT');
                    setUserData(null);
                }
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
            // Default safe fallback
            setUserRole('STUDENT'); 
        }
      } else {
        setUserRole(null);
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<UserCredential> => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const seedInitialUsers = async () => {
    const users = [
      { email: 'insanusconcursos@gmail.com', pass: '123456' },
      { email: 'kelsen.pantoja.prof@gmail.com', pass: '123456' }
    ];

    console.log("Starting seed process...");
    
    for (const u of users) {
      try {
        await createUserWithEmailAndPassword(auth, u.email, u.pass);
        console.log(`User created: ${u.email}`);
        await signOut(auth); 
      } catch (err: unknown) {
        const error = err as { code?: string };
        if (error.code === 'auth/email-already-in-use') {
          console.log(`User already exists: ${u.email}`);
        } else {
          console.error(`Error creating user ${u.email}:`, error);
        }
      }
    }
    console.log("Seed process finished.");
  };

  const value = {
    currentUser,
    userRole,
    userData,
    loading,
    login,
    logout,
    seedInitialUsers
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
