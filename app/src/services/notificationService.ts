/**
 * Servei de notificacions push per a propietaris de bars.
 * Utilitza Firebase Cloud Messaging (FCM) per rebre notificacions
 * quan algú deixa una ressenya o comentari al bar.
 *
 * Plataforma: Web (via firebase/messaging)
 * Tokens FCM emmagatzemats a: users/{uid}/fcmTokens/{tokenId}
 */
import { Platform } from 'react-native';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// Firebase Messaging — importem condicionalment per evitar errors en natiu
let _messaging: any = null;
let _getToken: any = null;
let _onMessage: any = null;
let _isSupported: any = null;

if (Platform.OS === 'web') {
    try {
        const fcm = require('firebase/messaging');
        _getToken = fcm.getToken;
        _onMessage = fcm.onMessage;
        _isSupported = fcm.isSupported;
        const { getApp } = require('firebase/app');
        _messaging = fcm.getMessaging(getApp());
    } catch (_e) {
        // firebase/messaging no disponible
    }
}

/**
 * Demana permís de notificacions i registra el token FCM a Firestore.
 * Crida això quan l'usuari (bar owner) inicia sessió.
 * 
 * Returns: 'granted' | 'denied' | 'blocked' | 'unsupported' | 'error'
 */
export async function registerPushNotifications(userId: string): Promise<'granted' | 'denied' | 'blocked' | 'unsupported' | 'error'> {
    if (Platform.OS !== 'web' || !_messaging) return 'unsupported';

    try {
        // Comprovar suport del navegador
        if (_isSupported) {
            const supported = await _isSupported();
            if (!supported) {
                console.log('ℹ️ Push notifications no suportades en aquest navegador.');
                return 'unsupported';
            }
        }

        // Comprovar estat actual del permís ABANS de demanar-lo
        if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'denied') {
                console.log('ℹ️ Notificacions bloquejades pel navegador.');
                return 'blocked';
            }
        }

        // Demanar permís
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('ℹ️ Permís de notificacions denegat.');
            return permission === 'denied' ? 'blocked' : 'denied';
        }

        // Obtenir token FCM
        const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
        const token = await _getToken(_messaging, {
            vapidKey: vapidKey || undefined,
        });

        if (!token) {
            console.warn('⚠️ No s\'ha pogut obtenir el token FCM.');
            return 'error';
        }

        // Guardar el token a Firestore (users/{uid}/fcmTokens/{tokenHash})
        const tokenId = hashTokenSync(token);
        const tokenRef = doc(collection(db, 'users', userId, 'fcmTokens'), tokenId);
        await setDoc(tokenRef, {
            token,
            platform: 'web',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true });

        console.log('✅ Token FCM registrat correctament.');
        return 'granted';
    } catch (e) {
        console.warn('⚠️ Error registrant notificacions push:', e);
        return 'error';
    }
}

/**
 * Retorna l'estat actual del permís de notificacions.
 */
export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
    if (Platform.OS !== 'web') return 'unsupported';
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission as 'granted' | 'denied' | 'default';
}

/**
 * Escolta missatges en primer pla (quan l'app està oberta).
 * Mostra una notificació nativa del navegador i invoca el callback.
 */
export async function listenForegroundMessages(
    onMsg?: (payload: { title: string; body: string; data?: Record<string, string> }) => void,
): Promise<(() => void) | null> {
    if (Platform.OS !== 'web' || !_messaging || !_onMessage) return null;

    try {
        const unsubscribe = _onMessage(_messaging, (payload: any) => {
            const title = payload.notification?.title || 'Nova notificació';
            const body = payload.notification?.body || '';
            const data = payload.data as Record<string, string> | undefined;

            // Callback personalitzat (per a toasts in-app)
            if (onMsg) {
                onMsg({ title, body, data });
            }

            // Notificació nativa del navegador
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification(title, {
                    body,
                    icon: '/favicon.ico',
                    tag: data?.reviewId || 'trobar-notification',
                });
            }
        });

        return unsubscribe;
    } catch (e) {
        console.warn('⚠️ Error escoltant missatges FCM:', e);
        return null;
    }
}

/**
 * Hash senzill per generar un ID determinístic per al token.
 */
function hashTokenSync(token: string): string {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
        const char = token.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'fcm_' + Math.abs(hash).toString(36);
}
