import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export type ContactKind = 'issue' | 'improvement' | 'other';
export type ContactMessage = {
    requestId: string;
    kind: ContactKind;
    subject: string;
    message: string;
    consent: boolean;
    platform: string;
    appVersion: string;
};

export async function submitContact(message: ContactMessage): Promise<string> {
    const send = httpsCallable<ContactMessage, { id: string }>(functions, 'submitContact');
    const result = await send(message);
    if (!result.data || result.data.id !== message.requestId) {
        throw new Error("No s'ha pogut confirmar l'enviament de la consulta.");
    }
    return result.data.id;
}
