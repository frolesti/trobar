/**
 * Servei de notificacions push per a propietaris de bars.
 * TODO: Implementar amb expo-notifications per a natiu (FCM).
 * De moment, stubs que retornen 'unsupported'.
 */

/**
 * Registra notificacions push. Stub fins implementar expo-notifications.
 */
export async function registerPushNotifications(_userId: string): Promise<'granted' | 'denied' | 'blocked' | 'unsupported' | 'error'> {
    return 'unsupported';
}

/**
 * Retorna l'estat actual del permís de notificacions.
 */
export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
    return 'unsupported';
}

/**
 * Escolta missatges en primer pla. Stub fins implementar expo-notifications.
 */
export async function listenForegroundMessages(
    _onMsg?: (payload: { title: string; body: string; data?: Record<string, string> }) => void,
): Promise<(() => void) | null> {
    return null;
}

