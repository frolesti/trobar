import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { executeRequest, executeOrThrow } from '../api/core';
import { UserProfile } from '../models/UserProfile';

export type { UserProfile };

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
