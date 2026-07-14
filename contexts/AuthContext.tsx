
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User,
  UserCredential 
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { requestNotificationPermission } from '../services/notificationService';

// Add to the top of AuthProvider:
// const localSessionId = React.useRef(Math.random().toString(36).substring(2, 15));

interface UserData {
  role?: string;
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  photoURL?: string;
  access?: unknown[];
  allowManualGeneration?: boolean;
  currentPlanId?: string;
  activePlanId?: string;
  activeCourseId?: string;
  planId?: string;
  permissions?: any;
  planStats?: Record<string, any>;
  routine?: any;
  studyProfile?: any;
}

interface AuthContextType {
  currentUser: User | null;
  userRole: 'ADMIN' | 'STUDENT' | 'COLLABORATOR' | 'SELLER' | 'COPRODUTOR' | null;
  userData: any | null; // Stores full firestore document data (permissions, etc)
  loading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
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
  
  // Persistir o sessionId no sessionStorage para evitar que recarregamentos de página
  // contem como novas sessões simultâneas no mesmo navegador/aba.
  const localSessionId = React.useRef<string>(null!);
  if (!localSessionId.current) {
    const key = 'insanus_session_id';
    try {
      let id = typeof window !== 'undefined' ? sessionStorage.getItem(key) : null;
      if (!id) {
        id = Math.random().toString(36).substring(2, 15);
        if (typeof window !== 'undefined') sessionStorage.setItem(key, id);
      }
      localSessionId.current = id;
    } catch (e) {
      localSessionId.current = Math.random().toString(36).substring(2, 15);
    }
  }

  const refreshUserData = async () => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        setUserData(userDocSnap.data());
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  };

  // Hardcoded admin email for this phase
  const ADMIN_EMAIL = 'insanusconcursos@gmail.com';

  useEffect(() => {
    let unsubSnapshot: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (unsubSnapshot) unsubSnapshot();

      setCurrentUser(user);
      
      if (user) {
        // Solicitar permissão de notificação (PWA Push)
        requestNotificationPermission(user.uid);

        try {
            // Fetch User Data from Firestore
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            // Log session (Anti-piracy)
            try {
              const logSession = async () => {
                let browserGeo = null;
                
                // Fingerprinting (Canvas + Screen + Browser info)
                const getFingerprint = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return 'canvas-not-supported';
                    
                    canvas.width = 200;
                    canvas.height = 40;
                    ctx.textBaseline = "top";
                    ctx.font = "14px 'Arial'";
                    ctx.fillStyle = "#f60";
                    ctx.fillRect(125,1,62,20);
                    ctx.fillStyle = "#069";
                    ctx.fillText("Insanus, <canvas> 1.0", 2, 15);
                    
                    const b64 = canvas.toDataURL().replace("data:image/png;base64,","");
                    let hash = 0;
                    for (let i = 0; i < b64.length; i++) {
                      hash = ((hash << 5) - hash) + b64.charCodeAt(i);
                      hash |= 0;
                    }
                    
                    const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
                    const language = navigator.language;
                    return `f_${Math.abs(hash)}_${screenInfo}_${language}`.replace(/\s+/g, '');
                  } catch (e) {
                    return 'fingerprint-err';
                  }
                };

                // Precision Geolocation
                if (navigator.geolocation) {
                  try {
                    const pos: any = await new Promise((resolve) => {
                      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { 
                        enableHighAccuracy: true, 
                        timeout: 5000 
                      });
                    });
                    if (pos && pos.coords) {
                      browserGeo = {
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                      };
                    }
                  } catch (e) {
                    console.error("Geo error", e);
                  }
                }

                fetch('/api/auth/log-session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    userId: user.uid, 
                    userEmail: user.email,
                    fingerprint: getFingerprint(),
                    lat: browserGeo?.lat,
                    lon: browserGeo?.lon,
                    accuracy: browserGeo?.accuracy,
                    sessionId: localSessionId.current
                  })
                }).catch(e => console.error("Session logging failed", e));
              };

              logSession();
            } catch (logErr) {
              console.error("Log session fetch error", logErr);
            }
            
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

                // Listen for changes to currentSessionId or blocked status
                unsubSnapshot = onSnapshot(userDocRef, (docSnap) => {
                  if (docSnap.exists()) {
                    const snapData = docSnap.data();
                    
                    // Update user data context just in case
                    setUserData(snapData as UserData);

                    // Check if blocked by Geofencing or piracy
                    if (snapData.blocked) {
                      alert(`Acesso bloqueado: ${snapData.blockReason === 'geofencing' ? 'Identificamos acessos distintos em locais diferentes em um curto espaço de tempo. Entre em contato com o suporte: pedagogico.insanus@gmail.com' : 'Sua conta foi bloqueada. Contate o suporte.'}`);
                      signOut(auth);
                      return;
                    }

                    // Check simultaneous access (only for students)
                    const snapRole = (snapData.role || '').toLowerCase();
                    if (snapRole === 'student' && snapData.activeSessionIds && !snapData.activeSessionIds.includes(localSessionId.current) && !snapData.isException) {
                      alert("Sua conta foi acessada em outro dispositivo. Você foi desconectado.");
                      signOut(auth);
                    }
                  }
                });

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

    return () => {
      unsubscribe();
      if (unsubSnapshot) unsubSnapshot();
    };
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
    refreshUserData,
    seedInitialUsers
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
