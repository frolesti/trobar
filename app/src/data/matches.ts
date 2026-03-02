// Deprecated: hardcoded fixtures removed.
// Matches are fetched from online competition calendars in src/services/matchService.ts.

export interface Match {
  id: string;
  date: string;
  time: string;
  opponent: string;
  competition: string;
  homeAway: 'Home' | 'Away';
}

export const matches: Match[] = [];
