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
    nextMatch?: {
        teamHome: string;
        teamAway: string;
        time: string;
        competition: string;
    };
}
