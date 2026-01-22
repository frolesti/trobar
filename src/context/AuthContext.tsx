import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    User as FirebaseUser,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    updateProfile,
    sendEmailVerification
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfile, UserProfile } from '../services/userService';
import { Platform, Alert } from 'react-native';
import { executeRequest, executeOrThrow } from '../api/core';

// Configurem l'idioma de les notificacions d'auth a Català
auth.languageCode = 'ca';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string, name: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  loginApple: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAndSetUser = async (firebaseUser: FirebaseUser) => {
    try {
        // Enforce security: refreshing token ensures we have the latest claims and the user is not disabled
        // Aquest token s'utilitza internament per les SDKs de Firebase (Firestore/Storage) per validar la seguretat
        await firebaseUser.getIdToken(true);

        const firestoreProfile = await getUserProfile(firebaseUser.uid);
        
        const combinedUser: UserProfile = {
            id: firebaseUser.uid,
            name: firestoreProfile?.name || firebaseUser.displayName || 'Usuari',
            email: firebaseUser.email || '',
            // Prioritize Firestore avatar if it exists; otherwise use Google photo; otherwise undefined
            avatar: (firestoreProfile?.avatar) ? firestoreProfile.avatar : (firebaseUser.photoURL || undefined),
            favoriteTeam: firestoreProfile?.favoriteTeam,
            favoriteSport: firestoreProfile?.favoriteSport
        };
        setUser(combinedUser);
    } catch (error) {
        console.error("Error fetching extended user profile:", error);
        // Fallback to basic auth info
        setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Usuari',
            email: firebaseUser.email || '',
            avatar: firebaseUser.photoURL || undefined
        });
    }
  };

  // Escolta canvis d'estat de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchAndSetUser(firebaseUser);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
      if (auth.currentUser) {
          await fetchAndSetUser(auth.currentUser);
      }
  };

  /**
   * Obté el token de sessió actual (JWT) de manera segura.
   * Si el token ha caducat (1h), Firebase el refresca automàticament utilitzant el Refresh Token emmagatzemat.
   * Aquest mètode és útil si necessitem cridar a una API externa pròpia.
   */
  const getAccessToken = async (): Promise<string | null> => {
      if (!auth.currentUser) return null;
      const result = await executeRequest(() => auth.currentUser!.getIdToken(), 'getAccessToken');
      return result.data;
  };

  const loginEmail = async (email: string, pass: string) => {
      setIsLoading(true);
      try {
          await executeOrThrow(() => signInWithEmailAndPassword(auth, email, pass), 'loginEmail');
      } finally {
          setIsLoading(false);
      }
  };

  const registerEmail = async (email: string, pass: string, name: string) => {
    setIsLoading(true);
    try {
        await executeOrThrow(async () => {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            if (cred.user) {
                await updateProfile(cred.user, { displayName: name });
                await sendEmailVerification(cred.user);
                await fetchAndSetUser(cred.user);
            }
        }, 'registerEmail');
    } finally {
        setIsLoading(false);
    }
  };

  // Nota: Eliminem els Alerts interns. La UI (LoginModal) s'encarrega de mostrar l'error que llancem.
  const loginGoogle = async () => {
      setIsLoading(true);
      try {
        await executeOrThrow(async () => {
            if (Platform.OS === 'web') {
                const provider = new GoogleAuthProvider();
                await signInWithPopup(auth, provider);
            } else {
                throw new Error("No disponible: Login amb Google natiu requereix configuració addicional");
            }
        }, 'loginGoogle');
      } finally {
          setIsLoading(false);
      }
  };

  const loginApple = async () => {
    setIsLoading(true);
    try {
      await executeOrThrow(async () => {
          if (Platform.OS === 'web') {
              const provider = new OAuthProvider('apple.com');
              await signInWithPopup(auth, provider);
          } else {
              throw new Error("No disponible: Login amb Apple natiu requereix configuració addicional");
          }
      }, 'loginApple');
    } finally {
        setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
        await executeRequest(() => signOut(auth), 'logout');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginEmail,
        registerEmail,
        loginGoogle,
        loginApple,
        logout,
        getAccessToken,
        refreshProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
