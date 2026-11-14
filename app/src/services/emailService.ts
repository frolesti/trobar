import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export async function recordAccountSecurity(): Promise<void> {
    const record = httpsCallable<void, { status: string }>(functions, 'recordAccountSecurity');
    const response = await record();
    if (!['recorded', 'suppressed'].includes(response.data?.status)) {
        throw new Error("No s'ha pogut comprovar la seguretat del compte.");
    }
}

export async function recordFirstAppLogin(): Promise<void> {
    const record = httpsCallable<void, { status: string }>(functions, 'recordFirstLogin');
    const response = await record();
    if (!['queued', 'suppressed', 'unverified', 'not-new'].includes(response.data?.status)) {
        throw new Error("No s'ha pogut confirmar el registre de benvinguda.");
    }
}
