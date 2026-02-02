/*
  Try to find working fixtur.es v2 league slugs for competitions currently 404.

  Usage:
    node scripts/guessFixturSlugs.js
*/

const BASE = 'https://ics.fixtur.es/v2/league/';

const candidates = {
  'primeira-liga': [
    'primeira-liga',
    'liga-portugal',
    'liga-portugal-1',
    'portugal-primeira-liga',
    'primeira-liga-portugal',
    'primeira-liga-(portugal)'
  ],
  'mls': [
    'mls',
    'major-league-soccer',
    'major-league-soccer-mls',
    'usa-mls',
    'mls-regular-season'
  ],
  'segunda-division': [
    'segunda-division',
    'laliga2',
    'la-liga-2',
    'segunda-division-spain',
    'segunda-division-es',
    'la-liga-2-division'
  ],
  'euro-2024': [
    'euro-2024',
    'uefa-euro-2024',
    'euro',
    'uefa-euro',
    'euros',
    'european-championship'
  ],
  'world-cup': [
    'world-cup',
    'world-cup-2026',
    'fifa-world-cup',
    'fifa-world-cup-2026'
  ]
};

async function probeSlug(slug) {
  const url = `${BASE}${slug}.ics`;
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  const ok = res.ok && text.includes('BEGIN:VCALENDAR');
  return { url, status: res.status, ok };
}

(async () => {
  for (const [label, slugs] of Object.entries(candidates)) {
    console.log(`\n=== ${label} ===`);
    let found = false;
    for (const slug of slugs) {
      try {
        const r = await probeSlug(slug);
        console.log(`${String(r.status).padStart(3)} ${r.ok ? 'OK ' : '   '} ${slug}`);
        if (r.ok && !found) {
          console.log(`-> Suggested slug: ${slug}`);
          found = true;
        }
      } catch (e) {
        console.log(`ERR ${slug} ${String(e).slice(0,120)}`);
      }
    }
    if (!found) {
      console.log('-> No working slug found in candidate list.');
    }
  }
})();
