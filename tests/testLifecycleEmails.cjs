const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderLifecycleEmail, kinds, date, money } = require('../emails/lifecycle.cjs');
const { renderPreview, previewInput, previewKinds } = require('../emails/renderPreview.cjs');
const { designs, imageSlots, getEmailDesign, imageUrl } = require('../emails/artDirection.cjs');

test('all 18 designs share a semantic, compact hierarchy, a discreet logo and an equivalent plain-text body', () => {
  assert.equal(previewKinds.length, 18);
  for (const kind of kinds) {
    const { html, text, from, replyTo } = renderLifecycleEmail(kind, previewInput());
    assert.equal((html.match(/<h1\b/g) || []).length, 1, kind);
    assert.ok((html.match(/data-email-action/g) || []).length <= 1, kind);
    assert.match(html, /width="32" height="52"/);
    assert.doesNotMatch(html, /email-header-pattern|<script|<iframe|<form/);
    assert.doesNotMatch(html + text, /Correu automàtic|T’enviem aquesta benvinguda una sola vegada|Aquest correu confirma|Aquest correu no confirma|Aquest resum no acredita|El botó no s’obre/);
    assert.match(html, /BarlowCondensed-Bold\.ttf/);
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
  for (const field of ['periodStart', 'periodEnd']) assert.ok(paid.text.includes(date(previewInput()[field])));
  assert.ok(paid.text.includes(previewInput().barName));
  assert.ok(paid.text.includes(previewInput().invoiceNumber));
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
  assert.match(renderLifecycleEmail('bar-onboarding', input).text, /Deixar de rebre consells de perfil/);
});

test('welcome is a short invitation, not an account-status report; only financial facts need a highlighted summary', () => {
  const welcome = renderLifecycleEmail('welcome', previewInput());
  assert.equal(welcome.subject, 'Benvingut a troBar');
  assert.doesNotMatch(welcome.html + welcome.text, /data-email-summary|Estat del compte|A punt per començar/);
  assert.match(welcome.html, /data-email-greeting[^>]*>Hola, Laia!<\/p>/);
  assert.match(welcome.html, />Descobrir troBar<\/span>/);
  assert.match(welcome.text, /Troba on veure el Barça/);
  assert.match(welcome.text, /dona a conèixer el teu bar/);
  assert.match(renderLifecycleEmail('bar-activated', previewInput()).html, /data-email-summary/);
  assert.match(renderLifecycleEmail('payment-received', previewInput()).html, /data-email-summary/);
  assert.doesNotMatch(renderLifecycleEmail('support-received', previewInput()).html, /data-email-summary/);
});

test('every email uses an editorial frame, centered action and external website/social footer', () => {
  for (const kind of kinds) {
    const mail = renderLifecycleEmail(kind, { ...previewInput(), logoUrl: 'https://www.trobar.cat/assets/logos/logo-red.png' });
    assert.match(mail.html, /logo-email-open-cloche\.png/);
    assert.doesNotMatch(mail.html, /src="[^"]*logo-(?:red|brand)\.png"/);
    assert.match(mail.html, /data-email-header align="center"/);
    assert.doesNotMatch(mail.html, /box-shadow|border-radius:16px/);
    assert.match(mail.html, /data-email-content[^>]*align="left"/);
    assert.doesNotMatch(mail.html, /href="https:\/\/www\.trobar\.cat\/(?:contacte|politica-privacitat)"/);
    assert.match(mail.html, /href="https:\/\/www\.instagram\.com\/trobarapp\/"/);
    assert.match(mail.html, /alt="Instagram de troBar"/);
    assert.doesNotMatch(mail.html + mail.text, /mailto:|(?:suport|facturacio)@trobar\.cat/);
    assert.doesNotMatch(mail.text, /Contacte:|Privacitat:/);
    assert.equal(mail.from, `troBar <${mail.replyTo}>`, 'real Reply-To mailboxes remain unchanged');
    if (mail.html.includes('data-email-action')) {
      assert.match(mail.html, /align="center"[^>]*style="max-width:100%;margin:0 auto 12px/);
      assert.match(mail.html, /data-email-action[^>]*display:block/);
    }
    assert.match(mail.html, /<\/table>\s*<table data-email-footer role="presentation"/);
    assert.doesNotMatch(mail.html, /data-email-content[^>]*(?:max-height:|overflow:\s*hidden)/);
  }
});

test('art direction varies by purpose, with real replaceable image files and no stock watermarks', () => {
  assert.equal(new Set(previewKinds.map(kind => getEmailDesign(kind).layout)).size, 5);
  const used = new Set();
  for (const kind of previewKinds) {
    const composition = getEmailDesign(kind);
    const preview = renderPreview(kind);
    assert.match(preview, new RegExp(`data-email-layout="${composition.layout}"`));
    for (const key of [composition.hero, ...(composition.gallery || [])].filter(Boolean)) {
      used.add(key);
      assert.match(preview, new RegExp(`assets/web/img/emails/${key}\\.png`));
      const image = fs.readFileSync(path.join(__dirname, '..', 'assets', 'web', 'img', 'emails', `${key}.png`));
      assert.equal(image.readUInt32BE(16), imageSlots[key].width);
      assert.equal(image.readUInt32BE(20), imageSlots[key].height);
      assert.ok(image.length < 200000, key);
      assert.match(imageUrl(key), /^https:\/\/www\.trobar\.cat\/assets\/img\/emails\//);
    }
    if (composition.gallery) {
      assert.ok(preview.indexOf('data-email-action') < preview.indexOf('data-email-gallery'), 'the primary action comes before the decorative gallery');
    }
    assert.doesNotMatch(preview, /community-poster|canopy-poster|glasses-beer-poster|allbirds|Artlist/i);
  }
  assert.deepEqual([...used].sort(), Object.keys(imageSlots).sort());
  for (const kind of ['password-reset', 'email-verification', 'payment-received', 'payment-failed', 'security-alert']) {
    assert.equal(designs[kind].hero, undefined, 'urgent account and billing actions are not pushed below photography');
  }
  assert.notEqual(designs.welcome.hero, designs['bar-onboarding'].hero);
  assert.notEqual(designs['trial-reminder-7'].hero, designs['trial-reminder-1'].hero);
  assert.throws(() => getEmailDesign('missing'), /Unknown email design/);
  assert.throws(() => imageUrl('../missing'), /Unknown email image/);
});

test('onboarding has a benefit-led heading and one editing action without a redundant establishment row', () => {
  const mail = renderLifecycleEmail('bar-onboarding', previewInput());
  assert.match(mail.text, /El partit també es viu al teu bar/);
  assert.match(mail.text, /Mostra les fotos de Bar del Partit/);
  assert.match(mail.text, /Editar el perfil/);
  assert.doesNotMatch(mail.html, /data-email-details/);
  assert.match(mail.text, /Continuaràs rebent els avisos de compte i facturació/);
});

test('editorial letters develop the story in readable paragraphs without padding urgent messages', () => {
  for (const kind of ['welcome', 'bar-onboarding']) {
    const mail = renderLifecycleEmail(kind, previewInput());
    assert.equal((mail.html.match(/data-email-paragraph/g) || []).length, 2);
    assert.ok(mail.text.split(/\s+/).length > 100, kind);
    assert.ok(mail.html.indexOf('data-email-paragraph') < mail.html.indexOf('data-email-action'));
  }
  assert.doesNotMatch(renderPreview('password-reset'), /data-email-paragraph/);
});

test('sharing only distributes the public website, never email content or private account actions', () => {
  const input = {
    ...previewInput(), displayName: 'PRIVATE_PERSON', barName: 'PRIVATE_BAR',
    manageUrl: 'https://example.invalid/subscription?token=PRIVATE_TOKEN',
  };
  for (const kind of kinds) {
    const { html, text } = renderLifecycleEmail(kind, input);
    const share = html.match(/<table data-email-share[\s\S]+?<\/table>/)[0];
    assert.match(share, />Comparteix troBar<\/td>/);
    assert.doesNotMatch(share, /PRIVATE_|example\.invalid|instagram-email\.png/);
    const links = [...share.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1].replaceAll('&amp;', '&')));
    assert.equal(links.length, 3);
    assert.equal(links[0].origin, 'https://wa.me');
    assert.match(links[0].searchParams.get('text'), /https:\/\/www\.trobar\.cat$/);
    assert.equal(links[1].searchParams.get('u'), 'https://www.trobar.cat');
    assert.equal(links[2].searchParams.get('url'), 'https://www.trobar.cat');
    assert.match(html, /aria-label="Seguir troBar a Instagram"/);
    const follow = html.match(/<table data-email-follow[\s\S]+?<\/table>/)[0];
    assert.match(follow, />Segueix-nos<\/td>/);
    assert.equal((follow.match(/href="/g) || []).length, 1);
    assert.match(follow, /href="https:\/\/www\.instagram\.com\/trobarapp\/"/);
    assert.doesNotMatch(share, /instagram\.com/);
    assert.doesNotMatch(follow, /intent\/tweet|sharer\.php|wa\.me/);
    assert.match(share, /aria-label="Compartir troBar a Twitter"/);
    assert.doesNotMatch(html, /x-email-cream\.png|>Contacte<|>Privacitat</);
    for (const icon of ['whatsapp', 'facebook', 'twitter', 'instagram']) {
      assert.match(html, new RegExp(`${icon}-email-cream\\.png`));
    }
    assert.match(text, /Comparteix troBar/);
    assert.doesNotMatch(renderPreview(kind), /PREVISUALITZACIÓ|Dades fictícies|Cap correu enviat/);
  }
});

test('email social icons are compact transparent PNG assets, not client-side color filters', () => {
  for (const name of ['whatsapp', 'facebook', 'twitter', 'instagram']) {
    const png = fs.readFileSync(path.join(__dirname, '..', 'assets', 'web', 'logos', `${name}-email-cream.png`));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 48);
    assert.equal(png.readUInt32BE(20), 48);
    assert.equal(png[25], 6, 'RGBA PNG preserves the transparent background in mail clients');
    assert.ok(png.length < 10000);
  }
  assert.doesNotMatch(renderPreview('welcome'), /filter:|instagram-email\.png/);
});
