export interface CompetitionSpec {
    name: string;
    slug: string;
}

export interface SportCategory {
    sport: string;
    competitions: CompetitionSpec[];
}

export const SPORTS_DATA: SportCategory[] = [
    {
        sport: 'Futbol',
        competitions: [
            { name: "La Liga", slug: "primera-division" },
            { name: "Premier League", slug: "premier-league" },
            { name: "Serie A", slug: "serie-a" },
            { name: "Bundesliga", slug: "bundesliga" },
            { name: "Ligue 1", slug: "ligue-1" },
            { name: "Champions League", slug: "champions-league" },
            { name: "Europa League", slug: "europa-league" },
            { name: "Copa del Rey", slug: "copa-del-rey" },
            { name: "FA Cup", slug: "fa-cup" },
            { name: "Eredivisie", slug: "eredivisie" },
            { name: "Brasileirão", slug: "serie-a-brazil" },
            { name: "MLS", slug: "mls-major-league-soccer" },
            { name: "Segunda División", slug: "segunda-division-a" },
            { name: "Euro 2024", slug: "uefa-euro-2024-germany" },
            { name: "World Cup 2026", slug: "fifa-world-cup-2026" }
        ].sort((a, b) => a.name.localeCompare(b.name))
    }
];
