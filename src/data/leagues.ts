export interface CompetitionSpec {
    name: string;
    slug: string;
    type?: 'domestic_league' | 'international_cup' | 'domestic_cup';
}

export interface SportCategory {
    sport: string;
    competitions: CompetitionSpec[];
}

export const SPORTS_DATA: SportCategory[] = [
    {
        sport: 'Futbol',
        competitions: [
            { name: "La Liga", slug: "primera-division", type: 'domestic_league' },
            { name: "Premier League", slug: "premier-league", type: 'domestic_league' },
            { name: "Serie A", slug: "serie-a", type: 'domestic_league' },
            { name: "Bundesliga", slug: "bundesliga", type: 'domestic_league' },
            { name: "Ligue 1", slug: "ligue-1", type: 'domestic_league' },
            { name: "Champions League", slug: "champions-league", type: 'international_cup' },
            { name: "Europa League", slug: "europa-league", type: 'international_cup' },
            { name: "Copa del Rey", slug: "copa-del-rey", type: 'domestic_cup' },
            { name: "FA Cup", slug: "fa-cup", type: 'domestic_cup' },
            { name: "Eredivisie", slug: "eredivisie", type: 'domestic_league' },
            { name: "Brasileirão", slug: "serie-a-brazil", type: 'domestic_league' },
            { name: "MLS", slug: "mls-major-league-soccer", type: 'domestic_league' },
            { name: "Segunda División", slug: "segunda-division-a", type: 'domestic_league' },
            { name: "Euro 2024", slug: "uefa-euro-2024-germany", type: 'international_cup' },
            { name: "World Cup 2026", slug: "fifa-world-cup-2026", type: 'international_cup' }
        ].sort((a, b) => a.name.localeCompare(b.name))
    }
];
