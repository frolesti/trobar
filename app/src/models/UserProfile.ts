/** Preferències de notificacions push */
export interface NotificationPreferences {
    /** Recordatori abans del partit (minuts). 0 = desactivat */
    matchReminder: 0 | 30 | 60 | 120;
    /** Notificar resultats en directe */
    liveResults: boolean;
    /** Alertes de nous bars verificats a prop */
    newBarNearby: boolean;
    /** Promocions de bars premium */
    barPromotions: boolean;
}

/** Preferències de visualització de l'app */
export interface DisplayPreferences {
    /** Categoria per defecte al llistat de partits */
    defaultCategory: 'all' | 'masculino' | 'femenino';
    /** Radi de cerca de bars al mapa (metres) */
    searchRadius: 500 | 1000 | 2000 | 5000;
}

/** Totes les preferències d'usuari agrupades */
export interface UserPreferences {
    notifications: NotificationPreferences;
    display: DisplayPreferences;
}

/** Valors per defecte de les preferències */
export const DEFAULT_PREFERENCES: UserPreferences = {
    notifications: {
        matchReminder: 60,
        liveResults: true,
        newBarNearby: false,
        barPromotions: false,
    },
    display: {
        defaultCategory: 'all',
        searchRadius: 2000,
    },
};

export interface UserProfile {
    id: string;
    name: string;
    surname?: string;
    email: string;
    avatar?: string;
    favoriteTeam?: string;
    favoriteSport?: string;
    role?: 'user' | 'bar_owner' | 'admin';
    ownedBars?: string[]; // Array d'IDs de bars propietat d'aquest usuari
    preferences?: UserPreferences;
}
