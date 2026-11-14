'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderPasswordResetEmail } = require('../emails/passwordReset.cjs');
const { renderPreview } = require('../emails/renderPreview.cjs');
const { renderEmailVerification } = require('../emails/emailVerification.cjs');
const { renderEmail } = require('../emails/template.cjs');

const options = {
  resetUrl: 'https://auth.example.invalid/__/auth/action?mode=resetPassword&oobCode=TEST_ONLY_NOT_A_TOKEN&lang=ca',
  allowedActionOrigins: ['https://auth.example.invalid'],
  logoUrl: 'https://images.example.invalid/logo.png',
};

test('renders branded accessible HTML and equivalent text without HTML in the subject', () => {
  const { subject, html, text } = renderPasswordResetEmail(options);
  assert.equal(subject, 'Restableix la teva contrasenya de troBar');
  assert.doesNotMatch(subject, /[\r\n<>]/);
  assert.match(html, /<html lang="ca">/);
  assert.match(html, /alt="Logotip de troBar"/);
  assert.match(html, /role="presentation"/);
  assert.match(html, /#7a0033/);
  assert.match(html, /max-width:560px/);
  assert.match(html, /&amp;oobCode=TEST_ONLY_NOT_A_TOKEN&amp;lang=ca/);
  assert.equal((html.match(/href="/g) || []).length, 2);
  assert.ok(text.includes(options.resetUrl));
  assert.match(text, /Si no has fet aquesta sol·licitud/);
  assert.doesNotMatch(text, /<\/?(html|table|a|strong)\b/i);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  const header = html.match(/<td data-email-header[\s\S]+?<\/td>/)[0];
  assert.match(header, /troBar/);
  assert.match(header, /<img/);
  assert.match(header, /wordmark-brand\.png/);
  assert.match(html, /width="40" height="40"/);
  assert.ok(html.indexOf('alt="Logotip de troBar"') < html.indexOf('<h1'));
  assert.doesNotMatch(html.slice(html.indexOf('data-email-footer')), /<img/);
  assert.match(html, /data-email-content[^>]+align="left"[^>]+text-align:left/);
  assert.match(html, /<table role="presentation"[^>]+margin:0 0 14px/);
  assert.doesNotMatch(header, /<h[1-6]|EL TEU COMPTE|El partit t'espera/);
  assert.doesNotMatch(html, />[^<]*TEST_ONLY_NOT_A_TOKEN/);
});

test('escapes names, link attributes and visible link text', () => {
  const { html, text, subject } = renderPasswordResetEmail({
    ...options,
    displayName: '<img src=x onerror="alert(1)"> & \'amic\'',
    resetUrl: `${options.resetUrl}&label=%22%3E%3Cscript%3E&quote='`,
    logoUrl: `${options.logoUrl}'?size=88&quote='`,
  });
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; &#39;amic&#39;/);
  assert.match(html, /&amp;quote=%27/);
  assert.match(html, /logo\.png&#39;\?size=88&amp;quote=%27/);
  assert.doesNotMatch(html, /<img src=x|<script/);
  assert.ok(text.includes('<img src=x'));
  assert.equal(subject, 'Restableix la teva contrasenya de troBar');
});

test('rejects unsafe URLs and credentials without echoing action tokens', () => {
  for (const resetUrl of [
    'javascript:alert(1)', 'http://auth.example.invalid/reset', '/relative',
    'https://evil.example.invalid/reset', 'https://auth.example.invalid.evil.invalid/reset',
    'https://user:password@auth.example.invalid/reset',
    'https://auth.example.invalid/reset\r\nBcc: injected',
    'https://auth.example.invalid/reset?x=%0d%0aBcc:injected',
    ' https://auth.example.invalid/reset', 'not a url',
  ]) {
    assert.throws(() => renderPasswordResetEmail({ ...options, resetUrl }), (error) => {
      assert.doesNotMatch(error.message, /Bcc|password@|oobCode/);
      return error instanceof TypeError;
    });
  }
  assert.throws(() => renderPasswordResetEmail({ ...options, logoUrl: 'data:image/svg+xml,test' }));
});

test('requires a fixed, explicit origin allowlist and rejects header/control injection', () => {
  for (const allowedActionOrigins of [undefined, [], ['http://auth.example.invalid'], ['https://auth.example.invalid/path']]) {
    assert.throws(() => renderPasswordResetEmail({ ...options, allowedActionOrigins }));
  }
  for (const displayName of ['Name\r\nBcc: injected', 'Name\u0000', 'Name\u2028injected', 'x'.repeat(121)]) {
    assert.throws(() => renderPasswordResetEmail({ ...options, displayName }));
  }
});

test('persistent previews match renderers, use the optimized local logo and have no real action credentials', () => {
  for (const kind of ['password-reset', 'email-verification']) {
    const previewPath = path.resolve(__dirname, '..', 'docs', 'previews', `${kind}.html`);
    const html = fs.readFileSync(previewPath, 'utf8');
    assert.equal(html, renderPreview(kind));
    assert.match(html, /PREVISUALITZACIÓ/);
    assert.match(html, /https:\/\/example\.invalid\/(?:reset-password|verify-email)\?preview=1/);
    assert.doesNotMatch(html, /oobCode|apiKey|TEST_ONLY_NOT_A_TOKEN|https:\/\/[^"]+@/i);
    assert.match(html, /mailto:suport@trobar\.cat/);
    const logo = html.match(/<img src="([^"]+)"/)[1];
    assert.ok(fs.existsSync(path.resolve(path.dirname(previewPath), logo)));
    const image = fs.readFileSync(path.resolve(path.dirname(previewPath), logo));
    assert(image.length < 200000);
    assert.equal(image.readUInt32BE(16), image.readUInt32BE(20));
    assert.doesNotMatch(html, /<script|<iframe|<form|https:\/\/(?!example\.invalid)/i);
  }
  assert.throws(() => renderPreview('invalid'), TypeError);
});

test('verification and recovery share exactly the same brand header, frame and footer hierarchy', () => {
  const reset = renderPasswordResetEmail(options);
  const verification = renderEmailVerification({
    ...options,
    verificationUrl: options.resetUrl.replace('resetPassword', 'verifyEmail'),
    displayName: 'Laia',
  });
  const header = html => html.match(/<td data-email-header[\s\S]+?<\/td>/)[0];
  assert.equal(header(reset.html), header(verification.html));
  assert.match(verification.html, /Hola, Laia!/);
  assert.match(verification.html, /Confirma el teu correu/);
  assert.match(verification.text, /mode=verifyEmail/);
  assert.equal((verification.html.match(/<h1\b/g) || []).length, 1);
  assert.equal((verification.html.match(/href="/g) || []).length, 2);
  assert.doesNotMatch(verification.text, /contrasenya nova/);
  assert.throws(() => renderEmailVerification({ ...options, verificationUrl: 'https://evil.invalid/action' }), TypeError);
});

test('shared template supports informative emails without a forced button and escapes every content field', () => {
  const email = {
    subject: 'Consulta rebuda', title: 'Ja tenim la teva consulta',
    preheader: '<img src=x>', greeting: '<b>Hola</b>', message: '<script>private</script>',
    notice: '<iframe>notice</iframe>', footerNote: '<b>Suport</b>', logoUrl: options.logoUrl,
  };
  const { html, text } = renderEmail(email);
  assert.doesNotMatch(html, /El botó|<script>|<iframe>|<b>/);
  assert.equal((html.match(/href=/g) || []).length, 1);
  assert.match(html, /&lt;script&gt;private&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.ok(text.includes(email.message));
  assert.throws(() => renderEmail({ ...email, subject: 'Subject\r\nBcc: injected' }), TypeError);
  assert.throws(() => renderEmail({ ...email, title: ' ' }), TypeError);
  const actionEmail = renderEmail({ ...email, action: { url: options.resetUrl, label: '<img onerror=alert(1)>' }, allowedActionOrigins: options.allowedActionOrigins });
  assert.match(actionEmail.html, /&lt;img onerror=alert\(1\)&gt;/);
});

test('the previous preview URL stays current without the old image banner', () => {
  const standard = renderPreview();
  const previewPath = path.resolve(__dirname, '..', 'docs', 'previews', 'password-reset-pattern.html');
  assert.equal(fs.readFileSync(previewPath, 'utf8'), standard);
  assert.match(standard, /logo-brand\.png/);
  assert.doesNotMatch(standard, /PROVA DE DISSENY|experimental|logo-white-email\.png/);
});

test('every official email uses the same top logo and Gmail-compatible high-contrast action', () => {
  const reset = renderPasswordResetEmail(options);
  const verification = renderEmailVerification({ ...options, verificationUrl: options.resetUrl });
  const notification = renderEmail({
    subject: 'Actualització de troBar', preheader: 'Consulta les novetats',
    title: 'Tens novetats', message: 'Consulta les actualitzacions del teu compte.',
    logoUrl: options.logoUrl, action: { url: options.resetUrl, label: 'Veure les novetats' },
    allowedActionOrigins: options.allowedActionOrigins,
  });
  const header = html => html.match(/<td data-email-header[\s\S]+?<\/td>/)[0];
  for (const { html } of [reset, verification, notification]) {
    assert.equal(header(html), header(reset.html));
    const button = html.match(/<a data-email-action[^>]*>/)[0];
    assert.match(button, /color:#ffffff/i);
    assert.match(html, /gmail-blend-screen/);
    assert.match(html, /gmail-blend-difference/);
    assert.match(header(html), /<img/);
    assert.match(html, /prefers-color-scheme:dark/);
    assert.match(html, /supported-color-schemes/);
    assert.match(html, /Lora-SemiBold\.ttf/);
  }
});
