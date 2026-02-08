const admin = require('firebase-admin');
const ical = require('node-ical');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// FC Barcelona calendars (same as leagues.ts)
const BARCA_CALENDARS = [
    { 
        name: "Masculí", 
        id: "fc-barcelona", 
        url: "https://ics.fixtur.es/v2/fc-barcelona.ics",
        competition: "FC Barcelona (M)"
    },
    { 
        name: "Femení", 
        id: "fc-barcelona-women", 
        url: "https://ics.fixtur.es/v2/fc-barcelona-women.ics",
        competition: "FC Barcelona (F)"
    }
];

/**
 * Parse team names from event summary
 * Common formats:
 * - "FC Barcelona vs Real Madrid"
 * - "Real Madrid vs FC Barcelona"
 * - "FC Barcelona - Real Madrid"
 */
function parseTeams(summary, teamName = "FC Barcelona") {
    const separators = [' vs ', ' vs. ', ' - ', ' v '];
    
    for (const sep of separators) {
        if (summary.includes(sep)) {
            const parts = summary.split(sep).map(s => s.trim());
            if (parts.length === 2) {
                return {
                    teamHome: parts[0],
                    teamAway: parts[1]
                };
            }
        }
    }
    
    // Fallback: assume teamName is home if not found
    return {
        teamHome: teamName,
        teamAway: summary
    };
}

/**
 * Fetch and parse ICS calendar
 */
async function fetchCalendar(url) {
    try {
        console.log(`📅 Fetching calendar: ${url}`);
        const events = await ical.async.fromURL(url);
        return events;
    } catch (error) {
        console.error(`❌ Error fetching calendar ${url}:`, error.message);
        return null;
    }
}

/**
 * Convert ICS events to Match objects
 */
function eventsToMatches(events, competition) {
    const matches = [];
    const now = new Date();
    
    for (const key in events) {
        const event = events[key];
        
        // Only process VEVENT type
        if (event.type !== 'VEVENT') continue;
        
        // Get start date
        const startDate = event.start;
        if (!startDate || !(startDate instanceof Date)) continue;
        
        // Only include future matches (from now onwards)
        if (startDate < now) continue;
        
        // Parse teams from summary
        const summary = event.summary || '';
        const { teamHome, teamAway } = parseTeams(summary);
        
        // Get location (if available)
        const location = event.location || '';
        
        matches.push({
            teamHome,
            teamAway,
            date: admin.firestore.Timestamp.fromDate(startDate),
            competition,
            location,
            source: 'ics',
            rawSummary: summary
        });
    }
    
    return matches;
}

/**
 * Main seeding function
 */
async function seedMatches() {
    const matchesRef = db.collection('matches');
    
    console.log('🗑️  Clearing existing "matches" collection...');
    const snapshot = await matchesRef.get();
    const deleteBatch = db.batch();
    snapshot.docs.forEach((doc) => {
        deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    
    console.log('🌱 Fetching FC Barcelona calendars...');
    
    const allMatches = [];
    
    for (const calendar of BARCA_CALENDARS) {
        console.log(`\n📥 Processing: ${calendar.name} (${calendar.competition})`);
        const events = await fetchCalendar(calendar.url);
        
        if (!events) {
            console.warn(`⚠️  Skipping ${calendar.name} due to fetch error`);
            continue;
        }
        
        const matches = eventsToMatches(events, calendar.competition);
        console.log(`✅ Found ${matches.length} upcoming matches for ${calendar.name}`);
        
        allMatches.push(...matches);
    }
    
    if (allMatches.length === 0) {
        console.warn('⚠️  No matches found! Check calendar URLs or date filters.');
        return;
    }
    
    console.log(`\n📝 Inserting ${allMatches.length} total matches into Firestore...`);
    
    // Batch insert
    const insertBatch = db.batch();
    allMatches.forEach((match) => {
        const docRef = matchesRef.doc(); // Auto-generate ID
        insertBatch.set(docRef, match);
    });
    
    await insertBatch.commit();
    
    console.log(`✅ Successfully seeded ${allMatches.length} matches!`);
    console.log(`\n📊 Breakdown:`);
    
    // Count by competition
    const byCompetition = {};
    allMatches.forEach(m => {
        byCompetition[m.competition] = (byCompetition[m.competition] || 0) + 1;
    });
    
    for (const [comp, count] of Object.entries(byCompetition)) {
        console.log(`   - ${comp}: ${count} matches`);
    }
}

// Run the seed
seedMatches()
    .then(() => {
        console.log('\n🎉 Seeding complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    });
