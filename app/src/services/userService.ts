import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
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

export const uploadProfileImage = async (userId: string, uri: string): Promise<string> => {
    // Utilitzem executeOrThrow perquè volem que l'error pugi si és greu,
    // però gestionem el cas específic de CORS internament si cal.
    return await executeOrThrow(async () => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            
            const storageRef = ref(storage, `avatars/${userId}`);
            await uploadBytes(storageRef, blob);
            
            return await getDownloadURL(storageRef);
        } catch (error: any) {
            // Fallback específic per entorns de desenvolupament (CORS)
            // A Chrome "Failed to fetch" sol ser error de CORS o xarxa.
            const isCorsOrNetwork = error.message && (error.message.includes("CORS") || error.message.includes("Failed to fetch"));
            
            if (isCorsOrNetwork) {
                 console.warn("Imatge no pujada: Error CORS/Xarxa (habitual en localhost). S'usarà la URI local.");
                 return uri; 
            }
            throw error;
        }
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
