const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../app/src/data/womenTeamCrests.json');

async function main() {
    const folder = path.join(__dirname, '../assets/app/img/teams/women');
    fs.mkdirSync(folder, { recursive: true });
    const failures = [];
    for (const team of manifest) {
        try {
            const response = await fetch(team.url, { signal: AbortSignal.timeout(20000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const image = Buffer.from(await response.arrayBuffer());
            if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || image.length < 100 || image.readUInt32BE(16) < 16 || image.readUInt32BE(20) < 16) throw new Error('Invalid PNG');
            fs.writeFileSync(path.join(folder, `${team.key}.png`), image);
            console.log(`OK ${team.key}: ${image.readUInt32BE(16)}x${image.readUInt32BE(20)}`);
        } catch (error) { failures.push(`${team.key}: ${error.message}`); }
    }
    if (failures.length) throw new Error(failures.join('\n'));
    console.log(`Verified ${manifest.length} local crests; ${manifest.reduce((total, team) => total + team.names.length, 0)} aliases.`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });