import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut,
    signInWithCredential, 
    User as FirebaseUser,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    updateProfile,
    sendEmailVerification
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfile, UserProfile, deleteUserProfile } from '../services/userService';
import { Platform, Alert } from 'react-native';
import { executeRequest, executeOrThrow } from '../api/core';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

// Configurem Google Sign-In amb el Web Client ID de Firebase
// (imprescindible per obtenir l'idToken que Firebase necessita)
GoogleSignin.configure({
  webClientId: '632303151235-t3egkpe42vrs3mk19ai1tmp0u15valdo.apps.googleusercontent.com',
});

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
  deleteAccount: () => Promise<void>;
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
        // Reforçar seguretat: refrescar el token assegura que tenim les últimes claims i l'usuari no està desactivat
        // Aquest token s'utilitza internament per les SDKs de Firebase (Firestore/Storage) per validar la seguretat
        await firebaseUser.getIdToken(true);

        const firestoreProfile = await getUserProfile(firebaseUser.uid);
        
        const combinedUser: UserProfile = {
            id: firebaseUser.uid,
            name: firestoreProfile?.name || firebaseUser.displayName || 'Usuari',
            surname: firestoreProfile?.surname || '',
            email: firebaseUser.email || '',
            // Prioritzar avatar de Firestore si existeix; si no, foto de Google; si no, undefined
            avatar: (firestoreProfile?.avatar) ? firestoreProfile.avatar : (firebaseUser.photoURL || undefined),
            favoriteTeam: firestoreProfile?.favoriteTeam,
            favoriteSport: firestoreProfile?.favoriteSport,
            role: firestoreProfile?.role,
            ownedBars: firestoreProfile?.ownedBars,
        };
        setUser(combinedUser);
    } catch (error) {
        console.error("Error fetching extended user profile:", error);
        // Alternativa amb info bàsica d'auth
        setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Usuari',
            surname: '',
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
                // Flux natiu Android/iOS via Google Play Services
                // 1. Comprovar si Google Play Services està disponible
                await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

                // 2. Iniciar sessió amb Google (obre diàleg natiu)
                const signInResult = await GoogleSignin.signIn();

                // 3. Obtenir l'idToken del resultat
                const idToken = signInResult?.data?.idToken;
                if (!idToken) {
                    throw new Error("No s'ha obtingut el token d'identificació de Google.");
                }

                // 4. Crear credencial de Firebase i autenticar
                const credential = GoogleAuthProvider.credential(idToken);
                await signInWithCredential(auth, credential);
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
            provider.addScope('email');
            provider.addScope('name');
            await signInWithPopup(auth, provider);
        } else if (Platform.OS === 'ios') {
            const isAvailable = await AppleAuthentication.isAvailableAsync();
            if (!isAvailable) {
              throw new Error("Apple Authentication is not available on this device.");
            }

            // 1. Generar nonce
            const rawNonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

            // 2. Autenticar amb Apple
            const credential = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
              nonce: hashedNonce,
            });

            // 3. Autenticar amb Firebase
            const { identityToken, fullName } = credential;
            if (identityToken) {
              const provider = new OAuthProvider('apple.com');
              const firebaseCredential = provider.credential({
                idToken: identityToken,
                rawNonce: rawNonce,
              });
              
              const userCredential = await signInWithCredential(auth, firebaseCredential);

              // 4. Si Apple ens passa el nom (només passa al primer login), actualitzem el perfil
              if (fullName && userCredential.user) {
                  const name = [fullName.givenName, fullName.familyName].filter(Boolean).join(' ');
                  if (name) {
                      await updateProfile(userCredential.user, { displayName: name });
                  }
              }

            } else {
              throw new Error("No identity token received from Apple.");
            }
        } else {
            // Es podria afegir suport Android via flux WebView bàsic o similar,
            // però normalment requereix configuració més complexa o un wrapper de biblioteca.
            // Per ara, replicant el comportament web o llançant un error especialitzat.
             throw new Error("Login amb Apple a Android requereix configuració addicional.");
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

  const deleteAccount = async () => {
    if (!auth.currentUser) return;
    
    setIsLoading(true);
    try {
        // 1. Cancel·lar subscripció de Stripe
        try {
            const { cancelSubscription } = await import('../services/subscriptionService');
            await cancelSubscription();
        } catch (stripeErr) {
            console.warn("No s'ha pogut cancel·lar la subscripció de Stripe (potser no n'hi ha):", stripeErr);
            // Continuar igualment — pot ser que no tingui subscripció
        }

        // 2. Eliminar dades de Firestore
        await deleteUserProfile(auth.currentUser.uid);
        
        // 3. Eliminar compte d'Auth
        await auth.currentUser.delete();
        
        // La neteja d'estat passa a onAuthStateChanged
    } catch (error: any) {
        console.error("Error deleting account:", error);
        if (error.code === 'auth/requires-recent-login') {
            Alert.alert(
                "Seguretat",
                "Per eliminar el compte, has d'haver iniciat sessió recentment. Si us plau, tanca la sessió i torna a entrar.",
                [{ text: "D'acord" }]
            );
        } else {
            throw error;
        }
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
        deleteAccount,
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
