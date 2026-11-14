const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planRecovery, decode, encodeFields } = require('../scripts/recoverCupData.cjs');

const match = { id: '285', timestamp: '2026-02-03T20:00:00Z', competition: { name: 'Copa del Rey' },
    homeTeam: { id: '109', name: 'Albacete Balompie', badge: null }, awayTeam: { name: 'FC Barcelona', badge: 'https://existing.com/barca.png' },
    homeScore: 1, awayScore: 2, status: 'finished' };
const record = { date: match.timestamp, eventId: '401856363', home: 'Albacete', away: 'Barcelona',
    homeBadge: 'https://a.espncdn.com/i/teamlogos/soccer/500/2737.png', homeScore: 1, awayScore: 2 };
const sources = new Map([['esp.copa_del_rey|2026', [record]]]);

test('recovery changes only missing embedded badges, preserving IDs, results and existing crests', () => {
    const [planned] = planRecovery([match], sources);
    assert.deepEqual(planned.fields, { 'homeTeam.badge': record.homeBadge });
    assert.equal(planned.id, '285');
    assert.equal(planRecovery([{ ...match, homeTeam: { ...match.homeTeam, badge: record.homeBadge } }], sources).length, 0);
    assert.equal(planRecovery([{ ...match, duplicateOf: '1' }], sources).length, 0);
    assert.equal(planRecovery([match], new Map()).length, 0);
    assert.equal(planRecovery([match], new Map([['esp.copa_del_rey|2026', [record, record]]])).length, 0);
});

test('women cup recovery needs a unique completed score pair and retains real 0-0', () => {
    const women = { ...match, competition: { name: 'Copa de la Reina' }, homeScore: null, awayScore: null };
    const data = new Map([['esp.copa_de_la_reina|2026', [{ ...record, homeScore: 0, awayScore: 0 }]]]);
    const [planned] = planRecovery([women], data);
    assert.equal(planned.fields.homeScore, 0);
    assert.equal(planned.fields.awayScore, 0);
    assert.equal(planned.fields.status, 'finished');
    assert.equal(planned.fields.scorePending, false);
    assert.equal(planRecovery([{ ...women, homeScore: 2, awayScore: 3 }], data)[0].fields.homeScore, undefined);
});

test('Firestore decoding uses numbers and patch encoding updates nested badge only', () => {
    assert.equal(decode({ integerValue: '0' }), 0);
    assert.equal(decode({ booleanValue: false }), false);
    assert.deepEqual(encodeFields({ 'homeTeam.badge': record.homeBadge, homeScore: 0, scorePending: false }), {
        homeTeam: { mapValue: { fields: { badge: { stringValue: record.homeBadge } } } },
        homeScore: { integerValue: '0' }, scorePending: { booleanValue: false },
    });
});
