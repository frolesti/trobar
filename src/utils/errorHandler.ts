// Utilitat centralitzada per gestionar errors de l'aplicació
// Això permet mantenir els missatges consistents i separar la lògica UI de la lògica d'errors.

export type AppError = {
    code: string;
    message: string;
    originalError?: any;
};

// Mapa de traducció d'errors de Firebase Auth
const AUTH_ERROR_MAP: Record<string, string> = {
    'auth/invalid-credential': 'El correu o la contrasenya són incorrectes.',
    'auth/invalid-login-credentials': 'El correu o la contrasenya són incorrectes.',
    'auth/user-not-found': 'No hem trobat cap usuari amb aquest correu.',
    'auth/wrong-password': 'La contrasenya és incorrecta.',
    'auth/email-already-in-use': 'Aquest correu ja està registrat. Prova d\'iniciar sessió.',
    'auth/invalid-email': 'El format del correu no és vàlid.',
    'auth/too-many-requests': 'Massa intents fallits. Per seguretat, espera uns minuts.',
    'auth/operation-not-allowed': "Aquest mètode d'accés no està habilitat actualment.",
    'auth/weak-password': 'La contrasenya ha de tenir almenys 6 caràcters.',
    'auth/network-request-failed': 'Error de connexió. Comprova la teva internet.',
    'auth/popup-closed-by-user': "S'ha cancel·lat l'inici de sessió.",
    'auth/cancelled-popup-request': "S'ha obert una altra finestra d'autenticació.",
};

// Mapa d'errors genèrics o d'altres serveis
const GENERIC_ERROR_MAP: Record<string, string> = {
    'unavailable': 'El servei no està disponible momentàniament.',
    'permission-denied': 'No tens permisos per fer aquesta acció.',
};

/**
 * Transforma qualsevol error (Firebase, JS, Custom) en un missatge entenedor per l'usuari.
 * @param error L'objecte error rebut del catch
 * @param defaultMessage Missatge per defecte si no es troba traducció
 */
export const getUserFriendlyError = (error: any, defaultMessage: string = "S'ha produït un error inesperat."): string => {
    if (!error) return defaultMessage;

    // Si és un error de Firebase Auth amb codi
    if (error.code) {
        // Mirem primer al diccionari d'Auth
        if (AUTH_ERROR_MAP[error.code]) {
            return AUTH_ERROR_MAP[error.code];
        }
        // Mirem al diccionari genèric
        if (GENERIC_ERROR_MAP[error.code]) {
            return GENERIC_ERROR_MAP[error.code];
        }
        // Si no està mapejat i estem en desenvolupament, pot ser útil veure el codi original
        // En producció, potser voldríem un missatge genèric
        return `Error (${error.code}): ${error.message || defaultMessage}`;
    }

    // Si és un error simple de JS amb missatge
    if (error.message) {
        return error.message;
    }

    // Si és només una string
    if (typeof error === 'string') {
        return error;
    }

    return defaultMessage;
};
