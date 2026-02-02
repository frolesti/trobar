/*
  Probes fixtur.es ICS endpoints for the slugs listed in src/data/leagues.ts.

  Usage:
    node scripts/probeIcsSlugs.js
*/

const fs = require('fs');

const LEAGUES_FILE = require('path').join(__dirname, '..', 'src', 'data', 'leagues.ts');

function extractSlugsFromLeaguesTs(source) {
  const slugs = [];
  const re = /slug:\s*"([^"]+)"/g;
  for (const match of source.matchAll(re)) {
    slugs.push(match[1]);
  }
  return Array.from(new Set(slugs));
}

async function probe(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    const ok = res.ok && text.includes('BEGIN:VCALENDAR');
    return { status: res.status, ok };
  } catch (e) {
    return { status: -1, ok: false, error: String(e) };
  }
}

(async () => {
  const txt = fs.readFileSync(LEAGUES_FILE, 'utf8');
  const slugs = extractSlugsFromLeaguesTs(txt);

  console.log(`Found ${slugs.length} slugs in ${LEAGUES_FILE}`);

  const base = 'https://ics.fixtur.es/v2/league/';
  const results = [];

  for (const slug of slugs) {
    const url = `${base}${slug}.ics`;
    const r = await probe(url);
    results.push({ slug, url, ...r });
    console.log(`${String(r.status).padStart(3)} ${r.ok ? 'OK ' : '   '} ${slug}`);
    if (r.error) console.log(`    ${r.error}`);
  }

  const ok = results.filter((r) => r.ok).map((r) => r.slug);
  const bad = results.filter((r) => !r.ok).map((r) => r.slug);

  console.log('\nOK slugs:', ok.length ? ok.join(', ') : '(none)');
  console.log('BAD slugs:', bad.length ? bad.join(', ') : '(none)');
})();
