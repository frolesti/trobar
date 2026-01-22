import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { executeRequest, executeOrThrow } from '../api/core';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  favoriteTeam?: string;
  favoriteSport?: string;
}

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
            if (error.message && error.message.includes("CORS")) {
                 console.warn("Imatge no pujada: Error CORS (habitual en localhost).");
                 return uri; 
            }
            throw error;
        }
    }, 'uploadProfileImage');
};
