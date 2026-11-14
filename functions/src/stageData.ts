// Provider phase labels only: dates, scores and opponents never imply a round.
const PHASES: Record<string, string> = {
    'round-of-64': 'LAST_64', 'round-of-32': 'LAST_32', 'round-of-16': 'LAST_16',
    quarterfinals: 'QUARTER_FINALS', 'quarter-finals': 'QUARTER_FINALS',
    semifinals: 'SEMI_FINALS', 'semi-finals': 'SEMI_FINALS', final: 'FINAL',
    'group-stage': 'GROUP_STAGE', 'league-phase': 'LEAGUE_STAGE',
    'knockout-round-playoffs': 'PLAYOFFS', 'play-off-round': 'PLAYOFFS', playoffs: 'PLAYOFFS',
    'first-round': 'FIRST_ROUND', 'second-round': 'SECOND_ROUND',
    'third-round': 'THIRD_ROUND', 'fourth-round': 'FOURTH_ROUND',
    qualification: 'QUALIFICATION', 'qualifying-round': 'QUALIFICATION',
};
const CANONICAL = new Set([...Object.values(PHASES), 'PRELIMINARY_ROUND']);
export type StageSource = 'uefa.champions' | 'uefa.wchampions' | 'esp.copa_del_rey' | 'esp.copa_de_la_reina';
export type StageRecord = { eventId: string; date: string; home: string; away: string; stage?: string; rawStage?: string; provider?: 'uefa' };

export function normalizeStage(value: unknown): string | undefined {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const upper = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (CANONICAL.has(upper)) return upper;
    return PHASES[value.trim().toLowerCase().replace(/[\s_]+/g, '-')];
}

export function stageSource(name: string, category?: string): StageSource | undefined {
    if (/copa.*reina/i.test(name)) return 'esp.copa_de_la_reina';
    if (/copa.*(?:rey|rei)\b/i.test(name)) return 'esp.copa_del_rey';
    if (/champion|uwcl|\bucl\b/i.test(name)) {
        return category === 'femenino' || /women|femen|uwcl/i.test(name) ? 'uefa.wchampions' : 'uefa.champions';
    }
    return undefined;
}

export function stageTeamKey(name: string): string {
    const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ø/g, 'o').replace(/\./g, '')
        .replace(/\b(fc|cf|afc|cd|ud|ad|women|femenino|femenina|femeni|wfc|frauen|ladies)\b/g, '')
        .replace(/[^a-z0-9]/g, '');
    const aliases: Record<string, string> = {
        clubatleticodemadrid: 'atleticomadrid', atleticodemadrid: 'atleticomadrid',
        athleticclub: 'athleticbilbao', athleticdebilbao: 'athleticbilbao', athleticclubbilbao: 'athleticbilbao',
        albacetebalompie: 'albacete', racingdesantander: 'racingsantander', deportivoalaves: 'alaves',
        paeolympiakossfp: 'olympiacos', olympiakos: 'olympiacos',
        clubbruggekv: 'clubbrugge', skslaviapraha: 'slaviaprague', kobenhavn: 'copenhagen',
        bayernmunchen: 'bayernmunich', olympiquelyon: 'ollyonnes',
        avaldsnesil: 'avaldsnes', koge: 'hbkoge', skbrann: 'brann',
        servettechenois: 'servette', hammarby: 'hammarbyif',
        cydleonesa: 'culturalleonesa', celtadevigo: 'celtavigo',
        galatasaraysk: 'galatasaray', sportingclubedeportugal: 'sportingcp', como1907: 'como',
    };
    return aliases[key] || key;
}

export function stageRecords(events: any[]): StageRecord[] {
    return events.flatMap(event => {
        const competitors = event.competitions?.[0]?.competitors;
        const home = competitors?.find((team: any) => team.homeAway === 'home')?.team?.displayName;
        const away = competitors?.find((team: any) => team.homeAway === 'away')?.team?.displayName;
        if (!event.id || !Number.isFinite(Date.parse(event.date)) || !home || !away) return [];
        return [{ eventId: String(event.id), date: event.date, home, away,
            stage: normalizeStage(event.season?.slug), rawStage: event.season?.slug }];
    });
}

export function matchingStageRecord(date: string, home: string, away: string, records: StageRecord[]): StageRecord | undefined {
    const candidates = records.filter(record => record.date.slice(0, 10) === date.slice(0, 10)
        && stageTeamKey(record.home) === stageTeamKey(home) && stageTeamKey(record.away) === stageTeamKey(away));
    return candidates.length === 1 ? candidates[0] : undefined;
}

export async function fetchStageRecords(source: StageSource, year: string): Promise<StageRecord[]> {
    if (!/^\d{4}$/.test(year)) throw new Error('Invalid stage year');
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${source}/scoreboard?dates=${year}&limit=1000`, {
        signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Stage provider HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.events) || body.events.length >= 1000) throw new Error('Invalid or truncated stage provider response');
    const records = stageRecords(body.events);
    // ESPN has no 2017 Avaldsnes tie. Fetch the two official UEFA match IDs,
    // not hard-coded phases; the returned competition, date and teams still match.
    if (source === 'uefa.wchampions' && year === '2017') {
        for (const id of ['2023207', '2023223']) {
            const official = await fetch(`https://match.uefa.com/v5/matches/${id}`, { signal: AbortSignal.timeout(20_000) });
            if (!official.ok) throw new Error(`UEFA stage provider HTTP ${official.status}`);
            const match = await official.json();
            if (String(match.id) !== id || String(match.round?.competitionId) !== '28'
                || !match.kickOffTime?.dateTime || !match.homeTeam?.internationalName || !match.awayTeam?.internationalName) {
                throw new Error('Invalid UEFA stage provider response');
            }
            const record: StageRecord = { eventId: id, date: match.kickOffTime.dateTime,
                home: match.homeTeam.internationalName, away: match.awayTeam.internationalName,
                rawStage: match.round.metaData?.name, stage: normalizeStage(match.round.metaData?.name), provider: 'uefa' };
            if (!matchingStageRecord(record.date, record.home, record.away, records)) records.push(record);
        }
    }
    return records;
}
