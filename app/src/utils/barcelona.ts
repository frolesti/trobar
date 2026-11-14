type Team = string | { name?: unknown } | null;

export function isBarcelonaMatch(match: { homeTeam?: Team; awayTeam?: Team }): boolean {
    return [match.homeTeam, match.awayTeam].some(team => {
        const name = typeof team === 'string' ? team : team?.name;
        if (typeof name !== 'string') return false;
        const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/\b(fc|cf|women|femenino|femenina|femeni|wfc)\b/g, '').replace(/[^a-z0-9]/g, '');
        return key === 'barcelona' || key === 'barca';
    });
}
