import { Match } from '../models/Match';

export function previousMatchPage(matches: Match[], before: Date, count = 10): Match[] {
    return [...new Map(matches.filter(match => match.date.getTime() < before.getTime()).map(match => [match.id, match])).values()]
        .sort((first, second) => second.date.getTime() - first.date.getTime())
        .slice(0, count)
        .reverse();
}