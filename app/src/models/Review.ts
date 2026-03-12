/** Ressenya d'un usuari sobre un bar */
export interface Review {
    id: string;
    /** ID del bar (referència a bars/) */
    barId: string;
    /** UID de l'usuari que ha escrit la ressenya */
    userId: string;
    /** Nom de l'usuari (desnormalitzat per lectures ràpides) */
    userName: string;
    /** Avatar URL de l'usuari */
    userAvatar?: string;
    /** Puntuació de 1 a 5 estrelles */
    rating: number;
    /** Comentari de text lliure (opcional) */
    comment?: string;
    /** Data de creació */
    createdAt: Date;
    /** Data d'última edició (si s'ha actualitzat) */
    updatedAt?: Date;
}

/** Estadístiques agregades de ressenyes d'un bar */
export interface BarReviewStats {
    /** Puntuació mitjana (1-5) */
    averageRating: number;
    /** Nombre total de ressenyes */
    totalReviews: number;
}
