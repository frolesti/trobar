import type { Fixture } from './matchSync';

export const SUPERCOPA_SOURCE = 'https://rfef.es/es/noticias/definida-la-hoja-de-ruta-de-la-supercopa-2027-que-se-celebrara-en-estambul';

// RFEF schedule published 17 September 2026; 20:00 Europe/Madrid = 19:00 UTC.
export function supercopaFixtures(): Fixture[] {
    const team = (id: number, name: string) => ({ id, name, crest: `https://crests.football-data.org/${id}.png` });
    const competition = { id: 'rfef_supercopa_espana', name: 'Supercopa de España' };
    return [
        {
            id: 'rfef_supercopa_2027_sf1', utcDate: '2027-02-02T19:00:00.000Z',
            homeTeam: team(81, 'FC Barcelona'), awayTeam: team(78, 'Club Atlético de Madrid'),
        },
    ].map(fixture => ({
        ...fixture, competition, status: 'SCHEDULED', category: 'masculino',
        stage: 'SEMI_FINALS', stageSource: 'rfef', stageSourceEventId: fixture.id,
        timeConfirmed: true, sourceUrl: SUPERCOPA_SOURCE,
    }));
}
