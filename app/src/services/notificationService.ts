import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

type Permission = 'granted' | 'denied' | 'default' | 'unsupported';
let permission: Permission = Platform.OS === 'web' ? 'unsupported' : 'default';
const DEVICE_KEY = 'trobar.pushDevice';
const AREA_KEY = 'trobar.notificationAreaOwner';
export const isExpoGo = () => Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

async function notifications() {
    const api = await import('expo-notifications');
    api.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
    if (Platform.OS === 'android') await api.setNotificationChannelAsync('trobar', { name: 'troBar', importance: api.AndroidImportance.HIGH });
    return api;
}

export async function requestNotificationPermission(ask = true): Promise<Permission> {
    if (Platform.OS === 'web') return 'unsupported';
    const api = await notifications();
    let result = await api.getPermissionsAsync();
    if (!result.granted && result.canAskAgain && ask) result = await api.requestPermissionsAsync();
    permission = result.granted || result.ios?.status === api.IosAuthorizationStatus.PROVISIONAL || result.ios?.status === api.IosAuthorizationStatus.EPHEMERAL ? 'granted' : result.status === 'undetermined' ? 'default' : 'denied';
    return permission;
}

export function getNotificationPermissionStatus(): Permission { return permission; }

export async function registerPushNotifications(userId: string, ask = true): Promise<'granted' | 'denied' | 'blocked' | 'unsupported' | 'error'> {
    try {
        if (Platform.OS !== 'web' && auth.currentUser?.uid === userId) {
            const location = await import('expo-location');
            if (!(await location.getForegroundPermissionsAsync()).granted) await clearNotificationArea(userId);
        }
        if (await requestNotificationPermission(ask) !== 'granted') {
            if (auth.currentUser?.uid === userId && permission === 'denied') await unregisterPushNotifications(userId);
            return permission === 'unsupported' ? 'unsupported' : 'denied';
        }
        if (isExpoGo() || !Device.isDevice) return 'unsupported';
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        if (!projectId) return 'error';
        const api = await notifications();
        const { data: token } = await api.getExpoPushTokenAsync({ projectId });
        if (auth.currentUser?.uid !== userId) return 'error';
        const id = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
        const saved = await AsyncStorage.getItem(DEVICE_KEY);
        if (saved) {
            const previous = JSON.parse(saved);
            if (previous.userId === userId && previous.id !== id) await deleteDoc(doc(db, 'users', userId, 'pushDevices', previous.id));
        }
        await setDoc(doc(db, 'users', userId, 'pushDevices', id), { token, platform: Platform.OS, updatedAt: serverTimestamp() });
        await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify({ userId, id }));
        return 'granted';
    } catch { return 'error'; }
}

export async function unregisterPushNotifications(userId: string) {
    const saved = await AsyncStorage.getItem(DEVICE_KEY);
    if (saved) {
        const device = JSON.parse(saved);
        if (device.userId === userId) {
            await deleteDoc(doc(db, 'users', userId, 'pushDevices', device.id));
            await AsyncStorage.removeItem(DEVICE_KEY);
        }
    }
}

export async function saveNotificationArea(userId: string) {
    if (Platform.OS === 'web') return false;
    const location = await import('expo-location');
    const access = await location.requestForegroundPermissionsAsync();
    if (!access.granted) return false;
    const point = await location.getCurrentPositionAsync({ accuracy: location.Accuracy.Balanced });
    if (auth.currentUser?.uid !== userId) return false;
    await setDoc(doc(db, 'users', userId, 'notificationPrivate', 'area'), { latitude: point.coords.latitude, longitude: point.coords.longitude, consent: 'foreground', updatedAt: serverTimestamp() });
    await AsyncStorage.setItem(AREA_KEY, userId);
    return true;
}

export async function clearNotificationArea(userId: string) {
    if (await AsyncStorage.getItem(AREA_KEY) !== userId) return;
    await deleteDoc(doc(db, 'users', userId, 'notificationPrivate', 'area'));
    await AsyncStorage.removeItem(AREA_KEY);
}

export async function testLocalNotification() {
    if (await requestNotificationPermission() !== 'granted') return false;
    const api = await notifications();
    await api.scheduleNotificationAsync({ content: { title: 'troBar', body: 'La notificació de prova funciona.', sound: 'default', data: { type: 'test' } }, trigger: { type: api.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: 'trobar' } });
    return true;
}

export async function listenForegroundMessages(onMsg?: (payload: { title: string; body: string; data?: Record<string, string> }) => void): Promise<(() => void) | null> {
    if (Platform.OS === 'web') return null;
    const api = await notifications();
    const subscription = api.addNotificationReceivedListener(notification => {
        const content = notification.request.content;
        onMsg?.({ title: content.title || '', body: content.body || '', data: content.data as Record<string, string> });
    });
    return () => subscription.remove();
}

