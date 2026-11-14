export type CompetitionFamily = 'league' | 'champions' | 'cup' | 'supercup';

export function competitionFamily(name: string): CompetitionFamily | undefined {
    const normalized = name.toLowerCase();
    if (/supercopa|supercup|super cup/.test(normalized)) return 'supercup';
    if (/champion|uwcl|ucl/.test(normalized)) return 'champions';
    if (/copa|cup|king|queen|cdr/.test(normalized)) return 'cup';
    if (/liga|league|primera|laliga|^pd$/.test(normalized)) return 'league';
    return undefined;
}

export const COMPETITION_FILTERS: { id: CompetitionFamily; label: string; logo?: number; womenLogo?: number }[] = [
    { id: 'league', label: 'Lliga', logo: require('../../../assets/app/img/competicions/liga.png'), womenLogo: require('../../../assets/app/img/competicions/ligaf.png') },
    { id: 'champions', label: 'Champions', logo: require('../../../assets/app/img/competicions/champions.png'), womenLogo: require('../../../assets/app/img/competicions/champions-w.png') },
    { id: 'cup', label: 'Copa', logo: require('../../../assets/app/img/competicions/copa-del-rey.png'), womenLogo: require('../../../assets/app/img/competicions/copa-reina.png') },
    { id: 'supercup', label: 'Supercopa' },
];
