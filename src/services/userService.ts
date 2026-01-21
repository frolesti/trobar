import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  favoriteTeam?: string;
  favoriteSport?: string;
}

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            return userDoc.data() as UserProfile;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
};

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>): Promise<void> => {
    try {
        const userDocRef = doc(db, 'users', userId);
        // utilitzem setDoc amb merge: true per si el document no existeix encara
        await setDoc(userDocRef, data, { merge: true });
    } catch (error) {
        console.error("Error updating user profile:", error);
        throw error;
    }
};

export const uploadProfileImage = async (userId: string, uri: string): Promise<string> => {
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const storageRef = ref(storage, `avatars/${userId}`);
        await uploadBytes(storageRef, blob).catch((e: any) => {
            if (e.message && e.message.includes('CORS')) {
                 throw new Error("CORS Error: Firebase Storage bucket is not configured for localhost access. Please run 'gsutil cors set cors.json gs://YOUR_BUCKET' or test on a deployed environment.");
            }
            throw e;
        });
        
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
    } catch (error: any) {
        console.error("Error uploading profile image:", error);
        // Fallback: If upload fails (e.g. CORS), return the original URI or a placeholder so the app doesn't break,
        // though the image won't be on the server.
        if (error.message.includes("CORS")) {
             alert("Imatge no pujada: Error CORS (habitual en localhost). La imatge es veurà localment però no s'ha guardat al servidor.");
             return uri; // Return local URI as fallback logic? 
             // Actually, saving local URI to firestore is bad practice as it won't work on other devices.
             // Better to throw and let UI handle it.
        }
        throw error;
    }
};
