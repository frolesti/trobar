export interface Match {
    id: string;
    homeTeam: string | any;
    awayTeam: string | any;
    date: Date;
    league: string;
    competition?: { id: string; name: string; logo?: string };
    location?: string;
    category?: 'masculino' | 'femenino' | 'MASCULI' | 'FEMENI';
    homeScore?: number;
    awayScore?: number;
    status?: 'scheduled' | 'finished' | 'live' | 'postponed';
}
