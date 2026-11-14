import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildBarNavigationUrls, Coordinates, validBarCoordinates } from '../utils/barNavigation';
import { showAlert } from '../components/AlertBanner';

export type MapAppId = 'google' | 'apple' | 'waze';
const KEY = 'trobar.defaultMapApp';
export const MAP_APPS: { id: MapAppId; name: string; scheme: string }[] = [
    { id: 'google', name: 'Google Maps', scheme: 'comgooglemaps://' },
    { id: 'apple', name: 'Apple Maps', scheme: 'maps://' },
    { id: 'waze', name: 'Waze', scheme: 'waze://' },
];

export async function installedMapApps() {
    if (Platform.OS === 'web') return [];
    const candidates = MAP_APPS.filter(app => app.id !== 'apple' || Platform.OS === 'ios');
    const available = await Promise.all(candidates.map(async app => {
        const scheme = app.id === 'google' && Platform.OS === 'android' ? 'google.navigation:q=0,0' : app.scheme;
        try { return await Linking.canOpenURL(scheme) ? app : null; } catch { return null; }
    }));
    return available.filter((app): app is typeof MAP_APPS[number] => app !== null);
}

export async function getDefaultMapApp(): Promise<string | null> { return AsyncStorage.getItem(KEY); }
export async function setDefaultMapApp(id: MapAppId | null) {
    if (id) await AsyncStorage.setItem(KEY, id);
    else await AsyncStorage.removeItem(KEY);
}

export function nativeMapUrl(id: MapAppId, point: Coordinates) {
    if (!validBarCoordinates(point)) throw new Error('Invalid bar coordinates');
    const destination = `${point.latitude},${point.longitude}`;
    if (id === 'waze') return `waze://?ll=${destination}&navigate=yes`;
    if (id === 'apple') return `maps://?daddr=${destination}&dirflg=w`;
    return Platform.OS === 'android' ? `google.navigation:q=${destination}&mode=w` : `comgooglemaps://?daddr=${destination}&directionsmode=walking`;
}

export async function openBarMaps(point: Coordinates) {
    if (!validBarCoordinates(point)) {
        showAlert({ tone: 'info', message: 'Aquest bar no té una ubicació disponible.' });
        return;
    }
    if (Platform.OS === 'web') {
        await Linking.openURL(buildBarNavigationUrls(point).googleUrl);
        return;
    }
    const apps = await installedMapApps();
    const preferred = await getDefaultMapApp();
    const open = async (id: MapAppId) => {
        try {
            const url = nativeMapUrl(id, point);
            if (!await Linking.canOpenURL(url)) throw new Error('Unavailable');
            await Linking.openURL(url);
            return true;
        } catch (error) {
            console.info('[MapApps] Cannot open selected app', error);
            showAlert({ tone: 'error', message: 'No es pot obrir aquesta aplicació de mapes.' });
            return false;
        }
    };
    if (apps.some(app => app.id === preferred)) { await open(preferred as MapAppId); return; }
    if (preferred) await setDefaultMapApp(null);
    if (!apps.length) { showAlert({ tone: 'info', message: 'No hem detectat cap aplicació de mapes compatible instal·lada.' }); return; }
    const choose = async (id: MapAppId) => {
        if (await open(id)) {
            try { await setDefaultMapApp(id); }
            catch (error) {
                console.info('[MapApps] Cannot save preferred app', error);
                showAlert({ tone: 'error', message: 'La ruta s’ha obert, però caldrà tornar a triar l’app de mapes la pròxima vegada.' });
            }
        }
    };
    if (apps.length === 1) { await choose(apps[0].id); return; }
    Alert.alert('Obrir amb…', undefined, [
        ...apps.map(app => ({ text: app.name, onPress: () => { void choose(app.id); } })),
        { text: 'Cancel·la', style: 'cancel' as const },
    ]);
}