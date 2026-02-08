const https = require('https');
const ICAL = require('ical.js');

const url = 'https://ics.fixtur.es/v2/fc-barcelona.ics';

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const jcalData = ICAL.parse(data);
            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');
            
            console.log(`Events found: ${vevents.length}`);
            
            // Check past events with scores
            vevents.slice(0, 30).forEach(vevent => {
                const event = new ICAL.Event(vevent);
                const summary = event.summary;
                console.log(`Summary: "${summary}"`);
                
                if (summary.includes(' - ')) {
                    const parts = summary.split(' - ');
                    const home = parts[0].replace(/\s+\d+$/, '').trim();
                    const away = parts[1].replace(/^\d+\s+/, '').trim();
                    console.log(`   -> Parsed: [${home}] vs [${away}]`);
                }
            });
        } catch (e) {
            console.error(e);
        }
    });
});
