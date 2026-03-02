import { getUserFriendlyError } from '../utils/errorHandler';

/**
 * API Core Wrapper
 * 
 * Aquesta capa centralitza totes les interaccions amb Firebase/Backend.
 * Ens assegura que totes les crides tenen:
 * 1. Gestió d'errors unificada (traducció de missatges).
 * 2. Logging centralitzat (per debugging).
 * 3. Tipatge consistent de les respostes.
 */

export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    success: boolean;
}

/**
 * Executa una operació contra el backend (Firebase) de manera segura.
 * @param operation Funció asíncrona que conté la lògica de Firebase (getDocs, signIn, etc.)
 * @param context Nom de l'operació per al logging (ex: 'fetchBars')
 * @returns Objecte { success, data, error } per facilitar el tractament a la UI
 */
export async function executeRequest<T>(
    operation: () => Promise<T>, 
    context: string
): Promise<ApiResponse<T>> {
    try {
        // Podríem afegir aquí logs d'inici: console.log(`[API START] ${context}`);
        const result = await operation();
        return {
            data: result,
            error: null,
            success: true
        };
    } catch (e: any) {
        // Logging centralitzat
        console.error(`[API ERROR] ${context}:`, e);

        // Traducció d'error centralitzada
        const friendlyMessage = getUserFriendlyError(e);

        return {
            data: null,
            error: friendlyMessage,
            success: false
        };
    }
}

/**
 * Versió alternativa que llança l'error (throw) en lloc de retornar un objecte.
 * Útil per quan volem gestionar al component el catch, però volem el missatge netejat.
 */
export async function executeOrThrow<T>(
    operation: () => Promise<T>,
    context: string
): Promise<T> {
    try {
        return await operation();
    } catch (e: any) {
        console.error(`[API FAIL] ${context}:`, e);
        throw new Error(getUserFriendlyError(e));
    }
}
