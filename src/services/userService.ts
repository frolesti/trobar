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
        await uploadBytes(storageRef, blob);
        
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
    } catch (error) {
        console.error("Error uploading profile image:", error);
        throw error;
    }
};
