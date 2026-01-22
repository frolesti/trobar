import { Platform } from 'react-native';
import { executeRequest } from '../api/core';

export interface Match {
    id: string;
    teamHome: string;
    teamAway: string;
    date: Date;
    competition: string;
    location?: string;
}

const ICS_URL = 'https://ics.fixtur.es/v2/fc-barcelona.ics';

// --- CACHE SYSTEM ---
let cachedMatches: Match[] | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 Hour

// Helper to handle CORS on web
const getFetchUrl = () => {
    if (Platform.OS === 'web') {
        return `https://api.allorigins.win/raw?url=${encodeURIComponent(ICS_URL)}`;
    }
    return ICS_URL;
};

// Simple helper to parse ICS date string (e.g., 20260125T200000Z)
const parseICSDate = (icsDate: string): Date => {
    if (!icsDate) return new Date();
    
    // Format: YYYYMMDDTHHmmSSZ
    const year = parseInt(icsDate.substring(0, 4), 10);
    const month = parseInt(icsDate.substring(4, 6), 10) - 1;
    const day = parseInt(icsDate.substring(6, 8), 10);
    const hour = parseInt(icsDate.substring(9, 11), 10);
    const minute = parseInt(icsDate.substring(11, 13), 10);
    const second = parseInt(icsDate.substring(13, 15), 10);

    return new Date(Date.UTC(year, month, day, hour, minute, second));
};

const cleanTeamName = (name: string) => {
    return name.replace('FC Barcelona', 'Barça').trim();
};

const guessCompetition = (summary: string, description: string): string => {
    const text = (summary + " " + description).toLowerCase();

    // Champions League variants
    if (text.includes('[cl]') || text.includes('champions') || text.includes('ucl')) {
        return 'Champions League';
    }
    
    // Copa del Rey variants
    if (text.includes('[copa]') || text.includes('copa del rey') || text.includes('king')) {
        return 'Copa del Rey';
    }

    // Supercopa
    if (text.includes('supercopa') || text.includes('super cup')) {
        return 'Supercopa';
    }
    
    // Europa League
    if (text.includes('[el]') || text.includes('europa league')) {
        return 'Europa League';
    }

    // Friendlies
    if (text.includes('friendly') || text.includes('amistós')) {
        return 'Amistós';
    }

    // Default to La Liga for this specific calendar as it omits the tag for league matches
    return 'La Liga';
};

export const fetchBarcaMatches = async (forceRefresh = false): Promise<Match[]> => {
    // Return cache if valid
    const nowTime = Date.now();
    if (!forceRefresh && cachedMatches && (nowTime - lastFetchTime < CACHE_DURATION)) {
        return cachedMatches;
    }

    try {
        const result = await executeRequest(async () => {
            const response = await fetch(getFetchUrl());
            if (!response.ok) throw new Error("Failed to fetch ICS data");
            const text = await response.text();
            return text;
        }, 'fetchBarcaMatches');

        const icsData = result.data;
        
        if (!icsData) {
            console.error("No ICS data received");
            // If fetch fails but we have old cache, return it rather than empty
            return cachedMatches || [];
        }

        const matches: Match[] = [];
        
        // Split by events
        const events = icsData.split('BEGIN:VEVENT');

        events.forEach((eventBlock) => {
            if (!eventBlock.includes('END:VEVENT')) return;

            // Extract fields
            const summaryMatch = eventBlock.match(/SUMMARY:(.*)/);
            const startMatch = eventBlock.match(/DTSTART:(.*)/);
            const locationMatch = eventBlock.match(/LOCATION:(.*)/);
            const descMatch = eventBlock.match(/DESCRIPTION:(.*)/);
            const uidMatch = eventBlock.match(/UID:(.*)/);

            if (summaryMatch && startMatch) {
                const summary = summaryMatch[1].trim();
                const startDateStr = startMatch[1].trim();
                const location = locationMatch ? locationMatch[1].trim() : undefined;
                const description = descMatch ? descMatch[1].trim() : '';
                const id = uidMatch ? uidMatch[1].trim() : Math.random().toString();

                const date = parseICSDate(startDateStr);

                // Parse Teams from Summary (Usually "Home - Away" or "Home vs Away")
                // Fixtur.es often uses "Home - Away"
                let teamHome = 'Unknown';
                let teamAway = 'Unknown';

                const separators = [' - ', ' vs ', ' v '];
                for (const sep of separators) {
                    if (summary.includes(sep)) {
                        const parts = summary.split(sep);
                        teamHome = parts[0].trim();
                        teamAway = parts[1].trim();
                        break;
                    }
                }

                // Filter only FC Barcelona matches (just in case)
                if (teamHome.includes('Barcelona') || teamAway.includes('Barcelona')) {
                    matches.push({
                        id,
                        teamHome,
                        teamAway,
                        date,
                        competition: guessCompetition(summary, description),
                        location
                    });
                }
            }
        });

        // Sort by date properties
        matches.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Return only future matches or recent past (e.g., today)
        const now = new Date();
        now.setHours(now.getHours() - 4); // Include matches from just a few hours ago

        const finalMatches = matches.filter(m => m.date >= now);
        
        // Update Cache
        cachedMatches = finalMatches;
        lastFetchTime = Date.now();

        return finalMatches;

    } catch (error) {
        console.error("Failed to scrape matches:", error);
        // Fallback to cache on error
        return cachedMatches || [];
    }
};

export const getNextMatch = async (competitionFilter?: string): Promise<Match | null> => {
    const matches = await fetchBarcaMatches();
    
    if (competitionFilter && competitionFilter !== '') {
        const filtered = matches.find(m => m.competition === competitionFilter);
        return filtered || null;
    }

    return matches.length > 0 ? matches[0] : null;
};
