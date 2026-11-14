export type AppError = {
    code: string;
    message: string;
    originalError?: unknown;
};

export const STANDARD_MESSAGES = {
    unexpected: "No hem pogut completar l'acció. Torna-ho a provar.",
    connection: 'No hem pogut connectar. Comprova la connexió i torna-ho a provar.',
    unavailable: 'El servei no està disponible ara mateix. Torna-ho a provar més tard.',
    session: 'La sessió ha caducat. Torna a iniciar sessió.',
    credentials: 'El correu o la contrasenya no són correctes.',
    resetSent: 'Si aquest correu té un compte, rebràs les instruccions per restablir la contrasenya. Revisa també el correu brossa.',
} as const;

const ERROR_MESSAGES: Record<string, string> = {
    'billing/popup-blocked': 'El navegador ha bloquejat la finestra de gestió. Permet les finestres emergents i torna-ho a provar.',
    'auth/invalid-credential': STANDARD_MESSAGES.credentials,
    'auth/invalid-login-credentials': STANDARD_MESSAGES.credentials,
    'auth/user-not-found': STANDARD_MESSAGES.credentials,
    'auth/wrong-password': STANDARD_MESSAGES.credentials,
    'auth/email-already-in-use': "Aquest correu ja té un compte. Inicia sessió o recupera la contrasenya.",
    'auth/invalid-email': 'Revisa el format del correu electrònic.',
    'auth/too-many-requests': 'Has fet massa intents. Espera uns minuts i torna-ho a provar.',
    'auth/operation-not-allowed': STANDARD_MESSAGES.unavailable,
    'auth/admin-restricted-operation': STANDARD_MESSAGES.unavailable,
    'auth/weak-password': 'La contrasenya ha de tenir almenys 6 caràcters.',
    'auth/network-request-failed': STANDARD_MESSAGES.connection,
    'auth/popup-blocked': "El navegador ha bloquejat la finestra d'accés. Permet les finestres emergents i torna-ho a provar.",
    'auth/popup-closed-by-user': "S'ha cancel·lat l'inici de sessió.",
    'auth/cancelled-popup-request': "S'ha cancel·lat l'inici de sessió.",
    'auth/requires-recent-login': "Per seguretat, torna a iniciar sessió abans de continuar.",
    'auth/user-disabled': 'No pots accedir a aquest compte. Contacta amb suport.',
    'auth/invalid-action-code': "Aquest enllaç ja no és vàlid. Demana'n un de nou.",
    'auth/expired-action-code': "Aquest enllaç ha caducat. Demana'n un de nou.",
    'functions/unauthenticated': STANDARD_MESSAGES.session,
    'functions/resource-exhausted': 'Espera un minut abans d’enviar una altra consulta.',
    'functions/unavailable': STANDARD_MESSAGES.unavailable,
    'functions/deadline-exceeded': 'No hem pogut confirmar l’enviament. Torna-ho a provar: no duplicarem la consulta.',
    'functions/invalid-argument': 'Revisa els camps del formulari i torna-ho a provar.',
    'functions/permission-denied': 'No pots fer aquesta acció amb el compte actual.',
    'unavailable': STANDARD_MESSAGES.unavailable,
    'deadline-exceeded': STANDARD_MESSAGES.connection,
    'permission-denied': 'No pots fer aquesta acció amb el compte actual.',
    'unauthenticated': STANDARD_MESSAGES.session,
    'storage/unauthorized': "No hem pogut desar la foto. Torna-ho a provar més tard.",
    'storage/unauthenticated': STANDARD_MESSAGES.session,
    'storage/bucket-not-found': STANDARD_MESSAGES.unavailable,
    'storage/no-default-bucket': STANDARD_MESSAGES.unavailable,
    'storage/quota-exceeded': STANDARD_MESSAGES.unavailable,
    'storage/retry-limit-exceeded': STANDARD_MESSAGES.connection,
};

const TECHNICAL_MESSAGE = /(?:\[(?:API|HTTP|DB)[^\]]*\]|firebase|firestore|stripe|stack\s*trace|https?:\/\/|(?:auth|functions|storage)\/[\w-]+|\b(?:api[_ -]?key|oobCode|id[_ -]?token|access[_ -]?token|Bearer|TypeError|ReferenceError|SyntaxError|SQL|ECONN\w*|HTTP\s*\d{3}|status(?:\s+code)?\s*[:=]?\s*[45]\d\d)\b|^\s*[{[]|(?:^|\n)\s*at\s+\S+\s*\()/i;

/** Defence in depth for notices composed outside the error mapper. */
export function sanitizeUserMessage(message: unknown, fallback: string = STANDARD_MESSAGES.unexpected): string {
    if (typeof message !== 'string' || !message.trim() || message.length > 1500 || TECHNICAL_MESSAGE.test(message)) {
        return fallback;
    }
    return message.trim();
}

/** Unknown backend text is never trusted as user-facing copy, including in development. */
export function getUserFriendlyError(error: unknown, defaultMessage: string = STANDARD_MESSAGES.unexpected): string {
    if (error && typeof error === 'object') {
        const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
        if (code && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code)) return ERROR_MESSAGES[code];
        const name = 'name' in error ? error.name : undefined;
        if (name === 'ApiTimeoutError' || name === 'AbortError') return STANDARD_MESSAGES.connection;
    }
    return sanitizeUserMessage(defaultMessage);
}
