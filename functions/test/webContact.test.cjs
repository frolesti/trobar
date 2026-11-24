const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./betaHarness.cjs');

const payload = {
  requestId: '12345678-1234-4234-8234-123456789abc', name: 'Bar de prova',
  email: 'consulta@example.test', kind: 'support', message: 'Necessito ajuda amb el registre del meu bar.',
  consent: true, website: '',
};
const nextId = '22345678-1234-4234-8234-123456789abc';
const sender = response => {
  const calls = [];
  return { calls, emails: { send: async (...args) => { calls.push(args); return response || { data: { id: 'mail_accepted' }, error: null }; } } };
};

test('public contact validates the full payload, consent, honeypot and safe reply address without requiring an account', async () => {
  const h = harness();
  for (const change of [{ consent: false }, { website: 'spam' }, { kind: 'admin' }, { requestId: '../other' },
    { email: 'someone@example.test\r\nBcc: other@example.test' }, { name: 'Name\nInjected' }, { message: 'curt' },
    { message: 'x'.repeat(5001) }]) {
    await assert.rejects(h.api.submitWebContact({ data: { ...payload, ...change } }), { code: 'invalid-argument' });
  }
  assert.equal(h.webContact.validateWebContact(payload).email, payload.email);
  assert.equal(h.documents.size, 0);
});

test('staff receives a real persisted contact, with a fixed destination and no customer lifecycle email', async () => {
  const h = harness(), client = sender();
  const data = h.webContact.validateWebContact({ ...payload, to: 'arbitrary@example.test' });
  const result = await h.webContact.deliverWebContact(h.database, client, data, '192.0.2.1', 100_000);
  assert.equal(result.id, payload.requestId);
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0][0].to.join(), 'suport@trobar.cat');
  assert.equal(client.calls[0][0].replyTo, payload.email);
  assert.match(client.calls[0][0].text, /Necessito ajuda/);
  assert.equal(h.documents.get(`webContactMessages/${payload.requestId}`).state, 'accepted');
  assert.equal([...h.documents.keys()].some(key => /^(users|contactMessages|emailQueue)\//.test(key)), false);
  assert.equal(JSON.stringify([...h.documents]).includes('192.0.2.1'), false);
  await h.webContact.deliverWebContact(h.database, client, data, '192.0.2.1', 100_001);
  assert.equal(client.calls.length, 1, 'accepted retries must not send a second email');
  await assert.rejects(h.webContact.deliverWebContact(h.database, client, { ...data, message: 'Un altre missatge prou llarg' }, '192.0.2.1', 100_002), { code: 'already-exists' });
});

test('provider failures stay pending; retries reuse the provider idempotency key and stop after its safe window', async () => {
  const h = harness(), client = sender({ data: null, error: { statusCode: 503 } });
  const data = h.webContact.validateWebContact(payload);
  await assert.rejects(h.webContact.deliverWebContact(h.database, client, data, '192.0.2.1', 100_000), { code: 'unavailable' });
  assert.equal(h.documents.get(`webContactMessages/${payload.requestId}`).state, 'pending');
  await assert.rejects(h.webContact.deliverWebContact(h.database, client, data, '192.0.2.1', 100_001), { code: 'unavailable' });
  assert.equal(client.calls[0][1].idempotencyKey, client.calls[1][1].idempotencyKey);
  assert.equal(JSON.stringify(client.calls[0][0]), JSON.stringify(client.calls[1][0]));
  await assert.rejects(h.webContact.deliverWebContact(h.database, client, data, '192.0.2.1', 100_000 + 23 * 60 * 60_000), { code: 'failed-precondition' });
  assert.equal(client.calls.length, 2);
});

test('rate limits apply to new messages while allowing the same message to retry', async () => {
  const h = harness(), client = sender(), data = h.webContact.validateWebContact(payload);
  await h.webContact.deliverWebContact(h.database, client, data, '192.0.2.1', 100_000);
  await assert.rejects(h.webContact.deliverWebContact(h.database, client, { ...data, requestId: nextId }, '192.0.2.1', 100_001), { code: 'resource-exhausted' });
  await h.webContact.deliverWebContact(h.database, client, { ...data, requestId: nextId }, '192.0.2.1', 160_000);
  assert.equal(client.calls.length, 2);
  const rate = [...h.documents.entries()].find(([key]) => key.startsWith('webContactRateLimits/'))[1];
  rate.count = 10;
  await assert.rejects(h.webContact.deliverWebContact(h.database, client, { ...data, requestId: '32345678-1234-4234-8234-123456789abc' }, '192.0.2.1', 220_000), { code: 'resource-exhausted' });
});
