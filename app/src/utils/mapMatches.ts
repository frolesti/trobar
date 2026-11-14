import { Match } from '../models/Match';

export function isWomenMatch(match: Match): boolean {
    if (match.category === 'femenino' || match.category === 'FEMENI') return true;
    if (match.category === 'masculino' || match.category === 'MASCULI') return false;
    const teamName = (team: Match['homeTeam']): string =>
        typeof team === 'string' ? team : team?.name || team?.shortName || '';
    return /women|femen|femení|liga f|uwcl|reina/i.test(
        `${match.competition?.name || ''} ${match.league || ''} ${teamName(match.homeTeam)} ${teamName(match.awayTeam)}`,
    );
}

export function upcomingMapMatches(matches: Match[], now = Date.now()): Match[] {
    return matches.filter(match => Number.isFinite(match.date.getTime()) &&
        match.status !== 'finished' && match.status !== 'postponed' &&
        (match.date.getTime() > now || match.status === 'live'))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function alternativeMapMatch(matches: Match[], current: Match | null): Match | null {
    if (!current) return null;
    return matches.find(match => match.id !== current.id && isWomenMatch(match) !== isWomenMatch(current)) || null;
}
