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

export class ApiTimeoutError extends Error {
    readonly context: string;
    readonly timeoutMs: number;

    constructor(context: string, timeoutMs: number) {
        super(`${context} timed out after ${timeoutMs}ms`);
        this.name = 'ApiTimeoutError';
        this.context = context;
        this.timeoutMs = timeoutMs;
    }
}

const getSafeUrl = (input: RequestInfo | URL): string => {
    try {
        const url = new URL(String(input));
        return `${url.origin}${url.pathname}`;
    } catch {
        return '<request>';
    }
};

export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    context: string,
    timeoutMs = 15000,
    failureLevel: 'error' | 'warn' = 'error',
): Promise<Response> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const callerSignal = init?.signal;
    const abortFromCaller = () => controller.abort();
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(input, { ...init, signal: controller.signal });
        console.log(`[HTTP] ${context} ${response.status} ${Date.now() - startedAt}ms ${getSafeUrl(input)}`);
        return response;
    } catch (error: any) {
        const elapsedMs = Date.now() - startedAt;
        if (error?.name === 'AbortError' && !callerSignal?.aborted) {
            const timeoutError = new ApiTimeoutError(context, timeoutMs);
            console[failureLevel](`[HTTP TIMEOUT] ${timeoutError.message} (${elapsedMs}ms) ${getSafeUrl(input)}`);
            throw timeoutError;
        }
        console[failureLevel](`[HTTP ERROR] ${context} after ${elapsedMs}ms ${getSafeUrl(input)}`, {
            name: error?.name,
            message: error?.message,
        });
        throw error;
    } finally {
        clearTimeout(timeoutId);
        callerSignal?.removeEventListener('abort', abortFromCaller);
    }
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
        const startedAt = Date.now();
        const result = await operation();
        console.log(`[API OK] ${context} ${Date.now() - startedAt}ms`);
        return {
            data: result,
            error: null,
            success: true
        };
    } catch (e: any) {
        // Logging centralitzat
        console.error(`[API ERROR] ${context}:`, {
            name: e?.name,
            message: e?.message,
            code: e?.code,
            status: e?.status,
        });

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
        const startedAt = Date.now();
        const result = await operation();
        console.log(`[API OK] ${context} ${Date.now() - startedAt}ms`);
        return result;
    } catch (e: any) {
        console.error(`[API FAIL] ${context}:`, {
            name: e?.name,
            message: e?.message,
            code: e?.code,
            status: e?.status,
        });
        throw new Error(getUserFriendlyError(e));
    }
}
