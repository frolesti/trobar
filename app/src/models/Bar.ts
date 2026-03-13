/** Període d'obertura estructurat (dia 0=diumenge, 1=dilluns...) */
export interface OpeningPeriod {
    openDay: number;
    openHour: number;
    openMinute: number;
    closeDay: number;
    closeHour: number;
    closeMinute: number;
}

/** Tipus per a les xarxes socials del bar */
export interface BarSocialMedia {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    telegram?: string;
}

/** Amenitats disponibles per un bar */
export type BarAmenity =
    | 'projector'
    | 'multiple_screens'
    | 'outdoor_seating'
    | 'wifi'
    | 'accessible'
    | 'air_conditioning'
    | 'reservations'
    | 'parking'
    | 'pet_friendly'
    | 'live_music'
    | 'darts'
    | 'pool_table'
    | 'sports_bar'
    | 'craft_beer'
    | 'food_served'
    | 'late_night';

export interface Bar {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    address: string;
    rating: number;
    isOpen: boolean;
    image: string;
    tags: string[];
    source?: 'verified' | 'user_reported';
    /** IDs dels partits que el bar emet explícitament (bars verificats) */
    broadcastingMatches?: string[];
    /** Si true, el bar normalment fa el Barça → compta per tots els partits */
    usuallyShowsBarca?: boolean;
    /** Identificador del bar a Google Maps o similar */
    googlePlaceId?: string;
    /** Tier del bar: 'premium' = perfil de pagament amb pin destacat, 'free' = per defecte */
    tier?: 'free' | 'premium';

    // ── Camps premium ──────────────────────────────────
    /** Xarxes socials del bar */
    socialMedia?: BarSocialMedia;
    /** Descripció lliure del propietari */
    description?: string;
    /** Text promocional visible a la targeta */
    promotionalText?: string;
    /** URLs de Firebase Storage amb fotos pròpies del propietari */
    gallery?: string[];
    /** Amenitats del bar (claus fixes que es mapegen a icones) */
    amenities?: BarAmenity[];
    /** Períodes d'obertura cachejats (de Google Places, per calcular obert/tancat localment) */
    openingPeriods?: OpeningPeriod[];
    /** UID de Firebase Auth del propietari verificat */
    ownerId?: string;
    /** Data de verificació del negoci */
    verifiedAt?: Date;

    /** @deprecated — usar broadcastingMatches/usuallyShowsBarca */
    nextMatch?: {
        teamHome: string;
        teamAway: string;
        time: string;
        competition: string;
    };
}
