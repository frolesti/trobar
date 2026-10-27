import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut,
    signInWithCredential, 
    signInWithPopup,
    User as FirebaseUser,
    GoogleAuthProvider,
    OAuthProvider,
    updateProfile,
    sendEmailVerification
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfile, UserProfile, deleteUserProfile } from '../services/userService';
import { Platform, Alert, TurboModuleRegistry, AppState } from 'react-native';
import { registerPushNotifications, unregisterPushNotifications, clearNotificationArea } from '../services/notificationService';
import Constants from 'expo-constants';
import { showAlert } from '../components/AlertBanner';
import { executeRequest, executeOrThrow } from '../api/core';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

// Configurem l'idioma de les notificacions d'auth a Català
auth.languageCode = 'ca';
const GOOGLE_WEB_CLIENT_ID = '632303151235-t3egkpe42vrs3mk19ai1tmp0u15valdo.apps.googleusercontent.com';
const EXPO_GOOGLE_PROXY_REDIRECT_URI = 'https://auth.expo.io/@frolesti/trobar-ios';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string, name: string) => Promise<void>;
  loginGoogle: () => Promise<boolean>;
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
    const defaultAvatar = firebaseUser.photoURL || firebaseUser.providerData?.find(provider => provider.providerId === 'google.com')?.photoURL || undefined;
    try {
        // Reforçar seguretat: refrescar el token assegura que tenim les últimes claims i l'usuari no està desactivat
        // Aquest token s'utilitza internament per les SDKs de Firebase (Firestore/Storage) per validar la seguretat
        await firebaseUser.getIdToken(true);
        const tokenResult = await firebaseUser.getIdTokenResult();

        const firestoreProfile = await getUserProfile(firebaseUser.uid);
        const roleClaim = tokenResult.claims.role;
        
        const combinedUser: UserProfile = {
            id: firebaseUser.uid,
            name: firestoreProfile?.name || firebaseUser.displayName || 'Usuari',
            surname: firestoreProfile?.surname || '',
            email: firebaseUser.email || '',
            // Prioritzar avatar de Firestore si existeix; si no, foto de Google; si no, undefined
            avatar: (firestoreProfile?.avatar) ? firestoreProfile.avatar : defaultAvatar,
            favoriteTeam: firestoreProfile?.favoriteTeam,
            favoriteSport: firestoreProfile?.favoriteSport,
            role: firestoreProfile?.role || (roleClaim === 'bar_owner' || roleClaim === 'admin' ? roleClaim : undefined),
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
            avatar: defaultAvatar
        });
    }
  };

  // Escolta canvis d'estat de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('[AuthContext] Firebase user found, fetching profile');
        await fetchAndSetUser(firebaseUser);
      } else {
        console.log('[AuthContext] No Firebase user');
        setUser(null);
      }
      console.log('[AuthContext] Setting isLoading = false');
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
      if (auth.currentUser) {
          await fetchAndSetUser(auth.currentUser);
      }
  };

  useEffect(() => {
      if (!user || Platform.OS === 'web') return;
      const refresh = () => { void registerPushNotifications(user.id, false); };
      refresh();
      const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
      return () => subscription.remove();
  }, [user?.id]);

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

  const loginGoogleWithExpoProxy = async (): Promise<boolean> => {
      const proxyRedirectUri = EXPO_GOOGLE_PROXY_REDIRECT_URI;
      const appReturnUrl = AuthSession.getDefaultReturnUrl('google');
      const nonce = Crypto.randomUUID();
      const discovery = {
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      };
      const request = new AuthSession.AuthRequest({
          clientId: GOOGLE_WEB_CLIENT_ID,
          redirectUri: proxyRedirectUri,
          responseType: AuthSession.ResponseType.IdToken,
          scopes: ['openid', 'email', 'profile'],
          usePKCE: false,
          prompt: AuthSession.Prompt.SelectAccount,
          extraParams: { nonce },
      });

      const googleAuthUrl = await request.makeAuthUrlAsync(discovery);
        console.info('[GoogleAuth] OAuth request', {
          clientId: GOOGLE_WEB_CLIENT_ID,
          redirectUri: proxyRedirectUri,
        });
      const proxyStartUrl = new URL(`${proxyRedirectUri.replace(/\/$/, '')}/start`);
      proxyStartUrl.searchParams.set('authUrl', googleAuthUrl);
      proxyStartUrl.searchParams.set('returnUrl', appReturnUrl);

      const browserResult = await WebBrowser.openAuthSessionAsync(
          proxyStartUrl.toString(),
          appReturnUrl,
      );
      if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') return false;
      if (browserResult.type !== 'success') {
          throw new Error('No s’ha pogut completar l’inici de sessió amb Google.');
      }

      const result = request.parseReturnUrl(browserResult.url);
      if (result.type === 'error') {
          throw new Error(result.error?.description || 'Google ha rebutjat l’inici de sessió.');
      }
        if (result.type !== 'success') {
          throw new Error('Google no ha completat l’autenticació. Torna-ho a provar.');
        }

      const idToken = result.params.id_token;
      if (!idToken) {
          throw new Error('Google no ha retornat cap ID token. Comprova que el redirect auth.expo.io estigui autoritzat al client OAuth web.');
      }

      const encodedPayload = idToken.split('.')[1];
      if (!encodedPayload) throw new Error('El ID token retornat per Google no és vàlid.');
      const base64Payload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const decodedPayload = globalThis.atob(base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '='));
      const jsonPayload = decodeURIComponent(Array.from(decodedPayload, (char) =>
          `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
      ).join(''));
      const tokenClaims = JSON.parse(jsonPayload);
      if (tokenClaims.nonce !== nonce) {
          throw new Error('La verificació de seguretat del login de Google no coincideix. Torna-ho a provar.');
      }

      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      return true;
  };

  // Nota: Eliminem els Alerts interns. La UI (LoginModal) s'encarrega de mostrar l'error que llancem.
  const loginGoogle = async (): Promise<boolean> => {
      setIsLoading(true);
      try {
        if (Platform.OS !== 'web' && !TurboModuleRegistry.get('RNGoogleSignin')) {
        const startedAt = Date.now();
        try {
          const signedIn = await loginGoogleWithExpoProxy();
          if (signedIn) {
            console.log(`[API OK] loginGoogleExpoProxy ${Date.now() - startedAt}ms`);
          } else {
            console.log(`[API CANCEL] loginGoogleExpoProxy ${Date.now() - startedAt}ms`);
          }
          return signedIn;
        } catch (error: any) {
          console.error('[API FAIL] loginGoogleExpoProxy:', {
            name: error?.name,
            message: error?.message,
            code: error?.code,
            status: error?.status,
          });
          throw error;
        }
        }

        await executeOrThrow(async () => {
            // Web: utilitzem el popup de Firebase Auth
            if (Platform.OS === 'web') {
                const provider = new GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                await signInWithPopup(auth, provider);
                return;
            }

            // Flux natiu Android/iOS via Google Play Services
            const { GoogleSignin } = await import('@react-native-google-signin/google-signin');

            GoogleSignin.configure({
              webClientId: GOOGLE_WEB_CLIENT_ID,
            });

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
        }, 'loginGoogle');
        return true;
      } finally {
          setIsLoading(false);
      }
  };

  const loginApple = async () => {
    setIsLoading(true);
    try {
      await executeOrThrow(async () => {
        if (Platform.OS === 'web') {
            // Web: popup de Firebase amb proveïdor Apple
            const provider = new OAuthProvider('apple.com');
            provider.addScope('email');
            provider.addScope('name');
            await signInWithPopup(auth, provider);
            return;
        }
        if (Platform.OS === 'ios') {
            const isAvailable = await AppleAuthentication.isAvailableAsync();
            if (!isAvailable) {
              const runtime = {
                executionEnvironment: Constants.executionEnvironment,
                appOwnership: Constants.appOwnership,
              };
              console.error('[AppleAuth] Native module unavailable', runtime);
              throw new Error(
                `Apple Sign-In no està disponible en aquest runtime iOS (${runtime.executionEnvironment}, ownership: ${runtime.appOwnership ?? 'none'}). El mòdul és inclòs a Expo Go SDK 57; comprova el runtime registrat al log i que Expo Go estigui actualitzat.`,
              );
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
        if (auth.currentUser) await unregisterPushNotifications(auth.currentUser.uid);
        await executeRequest(() => signOut(auth), 'logout');
    } finally {
        setIsLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (!auth.currentUser) return;
    
    setIsLoading(true);
    try {
      await unregisterPushNotifications(auth.currentUser.uid);
      await clearNotificationArea(auth.currentUser.uid);
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
            showAlert({
                tone: 'error',
                eyebrow: 'Seguretat',
                message: "Per eliminar el compte, has d'haver iniciat sessió recentment. Tanca la sessió i torna a entrar.",
                duration: 7000,
            });
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
