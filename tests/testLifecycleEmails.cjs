const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderLifecycleEmail, kinds, date, money } = require('../emails/lifecycle.cjs');
const { renderPreview, previewInput, previewKinds } = require('../emails/renderPreview.cjs');

test('all 18 designs share a semantic, compact hierarchy, a discreet logo and an equivalent plain-text body', () => {
  assert.equal(previewKinds.length, 18);
  for (const kind of kinds) {
    const { html, text, from, replyTo } = renderLifecycleEmail(kind, previewInput());
    assert.equal((html.match(/<h1\b/g) || []).length, 1, kind);
    assert.ok((html.match(/data-email-action/g) || []).length <= 1, kind);
    assert.match(html, /width="40" height="40"/);
    assert.doesNotMatch(html, /email-header-pattern|<script|<iframe|<form/);
    assert.doesNotMatch(html + text, /Correu automàtic|T’enviem aquesta benvinguda una sola vegada|Aquest correu confirma|Aquest correu no confirma|Aquest resum no acredita|El botó no s’obre/);
    assert.match(html, /Lora-SemiBold\.ttf/);
    assert.doesNotMatch(html, /border-left:3px|letter-spacing:2px/);
    assert.ok(Buffer.byteLength(html) < 102400, 'HTML stays below Gmail clipping size');
    assert.ok(html.indexOf('<h1') < html.indexOf('data-email-summary') || !html.includes('data-email-summary'));
    assert.match(text, /troBar/);
    assert.doesNotMatch(text, /<\/?(?:table|p|a|html)\b/);
    assert.ok(['suport@trobar.cat', 'facturacio@trobar.cat'].includes(replyTo));
    assert.equal(from, `troBar <${replyTo}>`);
    const stored = fs.readFileSync(path.join(__dirname, '..', 'docs', 'previews', `${kind}.html`), 'utf8');
    assert.equal(stored, renderPreview(kind), kind);
    if (html.includes('data-email-action')) assert.match(stored, /example\.invalid/);
  }
});

test('activation highlights real trial end, first amount, cadence and cancellation, not a fictional invoice date', () => {
  const options = previewInput();
  const mail = renderLifecycleEmail('bar-activated', options);
  for (const value of [date(options.trialEnd), money(options.amount, options.currency), options.barName, 'Cada any']) {
    assert.ok(mail.text.includes(value), value);
  }
  assert.match(mail.text, /No t’hem cobrat/);
  assert.match(mail.text, /cancel·lar abans/);
  assert.equal(mail.replyTo, 'facturacio@trobar.cat');
});

test('only a positive confirmed payment can render a receipt; failed payments never claim collection', () => {
  for (const amount of [0, -1, NaN, 1.5, undefined]) {
    assert.throws(() => renderLifecycleEmail('payment-received', { ...previewInput(), amount }));
  }
  for (const field of ['periodStart', 'periodEnd', 'invoiceNumber', 'invoiceUrl']) {
    assert.throws(() => renderLifecycleEmail('payment-received', { ...previewInput(), [field]: undefined }), field);
  }
  const paid = renderLifecycleEmail('payment-received', previewInput());
  assert.match(paid.text, /Import cobrat: 348,00/);
  assert.match(paid.html, /data-email-summary/);
  const failed = renderLifecycleEmail('payment-failed', previewInput());
  assert.match(failed.text, /No hem pogut completar el cobrament/);
  assert.doesNotMatch(failed.text, /Hem rebut el pagament/);
});

test('dates respect Barcelona daylight savings; amounts are integer EUR cents with no silent defaults', () => {
  assert.match(date(Date.parse('2026-03-29T01:30:00Z') / 1000), /03:30/);
  assert.match(date(Date.parse('2026-10-25T01:30:00Z') / 1000), /02:30/);
  assert.equal(money(9900, 'eur').replace(/\s/g, ''), '99,00€');
  for (const value of [null, 0, NaN, -1, 'tomorrow']) assert.throws(() => date(value));
  assert.throws(() => money(100, 'usd'));
  assert.throws(() => renderLifecycleEmail('bar-activated', { ...previewInput(), billingCycle: 'weekly' }));
});

test('summary fields and names are escaped, action origins are restricted, and optional onboarding requires opt-out', () => {
  const input = { ...previewInput(), barName: '<img src=x onerror=alert(1)> & Bar' };
  const { html } = renderLifecycleEmail('bar-activated', input);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; &amp; Bar/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.throws(() => renderLifecycleEmail('bar-activated', { ...input, manageUrl: 'https://evil.invalid/' }));
  assert.throws(() => renderLifecycleEmail('bar-activated', { ...input, barName: 'Bar\r\nBcc: other' }));
  assert.throws(() => renderLifecycleEmail('bar-onboarding', { ...input, unsubscribeUrl: undefined }));
  assert.match(renderLifecycleEmail('bar-onboarding', input).text, /deixar de rebre aquests consells/);
});

test('welcome is a short invitation, not an account-status report; only financial facts need a highlighted summary', () => {
  const welcome = renderLifecycleEmail('welcome', previewInput());
  assert.equal(welcome.subject, 'Benvingut a troBar');
  assert.doesNotMatch(welcome.html + welcome.text, /data-email-summary|Estat del compte|A punt per començar/);
  assert.match(welcome.html, /data-email-greeting[^>]*>Hola, Laia!<\/p>/);
  assert.match(welcome.html, />Descobrir troBar<\/span>/);
  assert.match(renderLifecycleEmail('bar-activated', previewInput()).html, /data-email-summary/);
  assert.match(renderLifecycleEmail('payment-received', previewInput()).html, /data-email-summary/);
  assert.doesNotMatch(renderLifecycleEmail('support-received', previewInput()).html, /data-email-summary/);
});
