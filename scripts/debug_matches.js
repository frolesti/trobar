const fs = require('fs');

const ICS_URL = 'https://ics.fixtur.es/v2/fc-barcelona.ics';

const parseICSDate = (icsDate) => {
    if (!icsDate) return new Date();
    const year = parseInt(icsDate.substring(0, 4), 10);
    const month = parseInt(icsDate.substring(4, 6), 10) - 1;
    const day = parseInt(icsDate.substring(6, 8), 10);
    const hour = parseInt(icsDate.substring(9, 11), 10);
    const minute = parseInt(icsDate.substring(11, 13), 10);
    const second = parseInt(icsDate.substring(13, 15), 10);
    return new Date(Date.UTC(year, month, day, hour, minute, second));
};

const guessCompetition = (summary, description) => {
    const text = (summary + " " + description).toLowerCase();
    if (text.includes('[cl]') || text.includes('champions') || text.includes('ucl')) return 'Champions League';
    if (text.includes('[copa]') || text.includes('copa del rey') || text.includes('king')) return 'Copa del Rey';
    if (text.includes('supercopa') || text.includes('super cup')) return 'Supercopa';
    if (text.includes('[el]') || text.includes('europa league')) return 'Europa League';
    if (text.includes('friendly') || text.includes('amistós')) return 'Amistós';
    // Check if it explicitly says La Liga in description if needed, otherwise default
    if (text.includes('la liga') || text.includes('primera división')) return 'Lliga';
    return 'Lliga';
};

const decodeICSText = (text) => {
    try {
        return decodeURIComponent(escape(text));
    } catch (e) {
        return text;
    }
};

async function fetchAndParseMatches() {
    console.log(`Fetching from ${ICS_URL}...`);
    try {
        const response = await fetch(ICS_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        
        console.log(`Fetched ${text.length} chars. Parsing...`);

        const matches = [];
        const lines = text.split(/\r\n|\n|\r/);
        let currentMatch = {};
        let inEvent = false;

        for (const line of lines) {
            if (line.startsWith('BEGIN:VEVENT')) {
                inEvent = true;
                currentMatch = {};
            } else if (line.startsWith('END:VEVENT')) {
                inEvent = false;
                if (currentMatch.summary && currentMatch.dtstart) {
                    const decodedSummary = decodeICSText(currentMatch.summary);
                    const parts = decodedSummary.split(' - ');
                    const home = parts[0] ? parts[0].trim() : 'Unknown';
                    const away = parts[1] ? parts[1].trim() : 'Unknown';
                    
                    matches.push({
                        date: parseICSDate(currentMatch.dtstart),
                        teamHome: home,
                        teamAway: away,
                        competition: guessCompetition(currentMatch.summary || '', currentMatch.description || ''),
                        rawSummary: currentMatch.summary
                    });
                }
            } else if (inEvent) {
                if (line.startsWith('DTSTART:')) currentMatch.dtstart = line.substring(8);
                if (line.startsWith('SUMMARY:')) currentMatch.summary = line.substring(8);
                if (line.startsWith('DESCRIPTION:')) currentMatch.description = line.substring(12);
                if (line.startsWith('LOCATION:')) currentMatch.location = line.substring(9);
            }
        }

        console.log(`Found ${matches.length} matches.`);
        
        // Debug Parsing Issues
        const suspicious = matches.filter(m => m.teamHome.includes('Suspended') || m.teamAway.includes('Suspended') || m.rawSummary.toLowerCase().includes('suspended'));
        if (suspicious.length > 0) {
            console.log('\n!!! SUSPICIOUS ENTRIES FOUND !!!');
            console.table(suspicious.map(m => ({
                Raw: m.rawSummary,
                Home: m.teamHome,
                Away: m.teamAway
            })));
        }

        const upcomingMatches = matches.filter(m => m.date >= new Date('2026-01-22'));
        console.log(`\n--- Showing ${upcomingMatches.length} Upcoming Matches ---`);
        
        console.table(upcomingMatches.map(m => ({
            Date: m.date.toISOString().substring(0, 10),
            Home: m.teamHome,
            Away: m.teamAway,
            Comp: m.competition
        })));

    } catch (err) {
        console.error("Error fetching/parsing:", err);
    }
}

fetchAndParseMatches();
