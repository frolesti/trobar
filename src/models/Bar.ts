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
    /** @deprecated — usar broadcastingMatches/usuallyShowsBarca */
    nextMatch?: {
        teamHome: string;
        teamAway: string;
        time: string;
        competition: string;
    };
}
