import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { auth, db, storage } from '../config/firebase';
import { executeRequest, executeOrThrow } from '../api/core';
import { UserProfile, UserPreferences, DEFAULT_PREFERENCES } from '../models/UserProfile';

export type { UserProfile, UserPreferences };

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const result = await executeRequest(async () => {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
    }, `getUserProfile:${userId}`);

    return result.data;
};

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>): Promise<void> => {
    await executeOrThrow(async () => {
        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, data, { merge: true });
    }, `updateUserProfile:${userId}`);
};

export const deleteUserProfile = async (userId: string): Promise<void> => {
    await executeOrThrow(async () => {
        const userDocRef = doc(db, 'users', userId);
        await deleteDoc(userDocRef);
    }, `deleteUserProfile:${userId}`);
};

export const uploadProfileImage = async (userId: string, uri: string, mimeType?: string): Promise<string> => {
    return await executeOrThrow(async () => {
        if (!auth.currentUser || auth.currentUser.uid !== userId) {
            throw new Error('Cal iniciar sessió amb el propietari del perfil per pujar la foto.');
        }
        const storageRef = ref(storage, `avatars/${userId}`);
        if (Platform.OS !== 'web') {
            const file = await FileSystem.getInfoAsync(uri);
            if (!file.exists || !file.size) throw new Error("No s'ha pogut llegir la imatge seleccionada.");
            if (file.size > 5 * 1024 * 1024) throw new Error('La foto no pot superar els 5 MB.');
            const token = await auth.currentUser.getIdToken();
            const bucket = storage.app.options.storageBucket;
            if (!bucket) throw new Error('No hi ha cap bucket de fotos configurat.');
            const contentType = mimeType?.startsWith('image/') ? mimeType : 'image/jpeg';
            const result = await FileSystem.uploadAsync(
                `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(`avatars/${userId}`)}`,
                uri,
                { httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: { Authorization: `Firebase ${token}`, 'Content-Type': contentType } },
            );
            if (result.status < 200 || result.status >= 300) {
                const error = new Error(`No s'ha pogut pujar la foto (HTTP ${result.status}).`) as Error & { code: string };
                error.code = result.status === 401 ? 'storage/unauthenticated' : result.status === 403 ? 'storage/unauthorized' : 'storage/unknown';
                throw error;
            }
            return await getDownloadURL(storageRef);
        }
        const response = await fetch(uri);
        if (!response.ok) throw new Error("No s'ha pogut llegir la imatge seleccionada.");
        const blob = await response.blob();
        if (blob.size > 5 * 1024 * 1024) throw new Error('La foto no pot superar els 5 MB.');
        const contentType = blob.type?.startsWith('image/') ? blob.type : mimeType;
        if (!contentType?.startsWith('image/')) throw new Error('El fitxer seleccionat no és una imatge compatible.');
        await uploadBytes(storageRef, blob, { contentType });
        return await getDownloadURL(storageRef);
    }, 'uploadProfileImage');
};

/** Obtenir les preferències d'un usuari (amb valors per defecte si falten) */
export const getUserPreferences = async (userId: string): Promise<UserPreferences> => {
    const result = await executeRequest(async () => {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const data = userDoc.data();
            // Merge amb defaults per camps que puguin faltar
            return {
                notifications: { ...DEFAULT_PREFERENCES.notifications, ...data.preferences?.notifications },
                display: { ...DEFAULT_PREFERENCES.display, ...data.preferences?.display },
            } as UserPreferences;
        }
        return DEFAULT_PREFERENCES;
    }, `getUserPreferences:${userId}`);

    return result.data ?? DEFAULT_PREFERENCES;
};

/** Actualitzar parcialment les preferències d'un usuari */
export const updateUserPreferences = async (userId: string, prefs: Partial<UserPreferences>): Promise<void> => {
    await executeOrThrow(async () => {
        const userDocRef = doc(db, 'users', userId);

        // Primer llegim les prefs actuals per fer merge correcte
        const snap = await getDoc(userDocRef);
        const currentData = snap.exists() ? snap.data() : {};
        const currentPrefs = currentData.preferences || {};

        const mergedPreferences = {
            notifications: {
                ...(DEFAULT_PREFERENCES.notifications),
                ...(currentPrefs.notifications || {}),
                ...(prefs.notifications || {}),
            },
            display: {
                ...(DEFAULT_PREFERENCES.display),
                ...(currentPrefs.display || {}),
                ...(prefs.display || {}),
            },
        };

        // setDoc amb merge:true crea el document si no existeix
        await setDoc(userDocRef, { preferences: mergedPreferences }, { merge: true });
        console.log('[PREFS] Guardat correctament:', JSON.stringify(mergedPreferences));
    }, `updateUserPreferences:${userId}`);
};
