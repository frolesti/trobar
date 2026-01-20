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
    updateProfile
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfile, UserProfile } from '../services/userService';
import { Platform, Alert } from 'react-native';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string, name: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  loginApple: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAndSetUser = async (firebaseUser: FirebaseUser) => {
    try {
        const firestoreProfile = await getUserProfile(firebaseUser.uid);
        
        const combinedUser: UserProfile = {
            id: firebaseUser.uid,
            name: firestoreProfile?.name || firebaseUser.displayName || 'Usuari',
            email: firebaseUser.email || '',
            avatar: firestoreProfile?.avatar || firebaseUser.photoURL || undefined,
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

  const loginEmail = async (email: string, pass: string) => {
      setIsLoading(true);
      try {
          await signInWithEmailAndPassword(auth, email, pass);
      } catch (error: any) {
          throw error;
      } finally {
          setIsLoading(false);
      }
  };

  const registerEmail = async (email: string, pass: string, name: string) => {
    setIsLoading(true);
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        if (cred.user) {
            await updateProfile(cred.user, { displayName: name });
            await fetchAndSetUser(cred.user);
        }
    } catch (error: any) {
        throw error;
    } finally {
        setIsLoading(false);
    }
  };

  const loginGoogle = async () => {
      setIsLoading(true);
      try {
        if (Platform.OS === 'web') {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } else {
            Alert.alert("No disponible", "Login amb Google natiu requereix configuració addicional");
        }
      } catch (error: any) {
          console.error(error);
          Alert.alert("Error Google", error.message);
      } finally {
          setIsLoading(false);
      }
  };

  const loginApple = async () => {
    setIsLoading(true);
    try {
      if (Platform.OS === 'web') {
          const provider = new OAuthProvider('apple.com');
          await signInWithPopup(auth, provider);
      } else {
          Alert.alert("No disponible", "Login amb Apple natiu requereix configuració addicional");
      }
    } catch (error: any) {
        console.error(error);
        Alert.alert("Error Apple", error.message);
    } finally {
        setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
        await signOut(auth);
    } catch (e) {
        console.error(e);
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
