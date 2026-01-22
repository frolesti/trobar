const https = require('https');

const ICS_URL = 'https://ics.fixtur.es/v2/fc-barcelona.ics';

function fetchICS() {
  return new Promise((resolve, reject) => {
    https.get(ICS_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });
}

async function run() {
  console.log('Fetching ICS...');
  const data = await fetchICS();
  
  // Split by events
  const events = data.split('BEGIN:VEVENT');
  console.log(`Found ${events.length} chunks`);

  // Parse a few future matches to see patterns
  const now = new Date();
  const futureEvents = [];

  for (const eventRaw of events) {
    if (!eventRaw.includes('END:VEVENT')) continue;

    const getField = (name) => {
      const match = eventRaw.match(new RegExp(`${name}:(.*)`));
      return match ? match[1].trim() : null;
    };

    const dtStart = getField('DTSTART');
    const summary = getField('SUMMARY');
    const description = getField('DESCRIPTION');
    
    if (!dtStart) continue;

    // Logic from src/services/matchService.ts
    const guessCompetition = (s, d) => {
        const text = ((s || '') + " " + (d || '')).toLowerCase();
        if (text.includes('[cl]') || text.includes('champions') || text.includes('ucl')) return 'Champions League';
        if (text.includes('[copa]') || text.includes('copa del rey') || text.includes('king')) return 'Copa del Rey';
        if (text.includes('supercopa') || text.includes('super cup')) return 'Supercopa';
        if (text.includes('[el]') || text.includes('europa league')) return 'Europa League';
        if (text.includes('friendly') || text.includes('amistós')) return 'Amistós';
        return 'La Liga';
    };

    // Basic date parsing (YYYYMMDDTHHMMSSZ)
    const y = dtStart.substring(0, 4);
    const m = dtStart.substring(4, 6);
    const d = dtStart.substring(6, 8);
    const h = dtStart.substring(9, 11);
    const min = dtStart.substring(11, 13);
    const dateObj = new Date(`${y}-${m}-${d}T${h}:${min}:00Z`);

    if (dateObj > now) {
      futureEvents.push({
        date: dateObj,
        summary,
        description,
        competition: guessCompetition(summary, description),
        raw: eventRaw.substring(0, 200) // Just the start to check for other fields
      });
    }
  }

  // Sort by date
  futureEvents.sort((a, b) => a.date - b.date);

  // Print next 10
  console.log('--- NEXT 10 MATCHES CLASSIFICATION ---');
  futureEvents.slice(0, 10).forEach((ev, i) => {
    console.log(`\nMatch ${i+1}: ${ev.date.toISOString()} - [${ev.competition}]`);
    console.log(`SUMMARY: ${ev.summary}`);
  });
}

run();
