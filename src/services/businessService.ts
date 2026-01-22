import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { executeRequest } from '../api/core';

export interface ClaimData {
    name: string;
    phone: string;
    email: string;
    cif: string;
}

/**
 * Envia una sol·licitud per reclamar la propietat d'un negoci.
 * Utilitza el wrapper estàndard per a la gestió d'errors.
 */
export const submitBusinessClaim = async (barId: string, barName: string, data: ClaimData) => {
    return await executeRequest(async () => {
        await addDoc(collection(db, 'business_claims'), {
            barId,
            barName,
            contactName: data.name,
            contactPhone: data.phone,
            contactEmail: data.email,
            cif: data.cif,
            status: 'pending',
            createdAt: serverTimestamp()
        });
    }, 'submitBusinessClaim');
};
