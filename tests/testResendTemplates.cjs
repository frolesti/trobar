const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHostedTemplate, createHostedMessage, fieldKinds, authoringInput } = require('../emails/resend.cjs');
const { renderLifecycleEmail } = require('../emails/lifecycle.cjs');
const manifest = require('../emails/resendTemplates.json');

test('all 18 hosted designs declare exactly their placeholders and contain no preview links or data', () => {
  assert.equal(fieldKinds.length, 18);
  for (const kind of fieldKinds) {
    const template = createHostedTemplate(kind);
    const used = [...new Set([...(template.html + template.subject).matchAll(/\{\{\{(\w+)\}\}\}/g)].map(match => match[1]))].sort();
    assert.deepEqual(used, template.variables.map(variable => variable.key).sort(), kind);
    assert.doesNotMatch(template.html, /example\.invalid|TROBAR_\w+_VARIABLE|__email_variable__/);
    assert.match(template.html, /assets\/logos\/logo-brand.png/);
    assert.equal(template.text, undefined);
  }
});

test('published runtime messages contain only the hosted ID and exact variables, with safe HTML and raw subject text', () => {
  for (const kind of fieldKinds.filter(kind => !['email-verification', 'password-reset'].includes(kind))) {
    const input = { ...authoringInput(), displayName: 'Laia & <equip>', barName: 'Bar & <Local>' };
    const mail = createHostedMessage(kind, input);
    assert.equal(mail.html, undefined);
    assert.equal(mail.text, undefined);
    assert.equal(mail.subject, undefined);
    assert.equal(mail.template.id, manifest[kind].id);
    assert.deepEqual(Object.keys(mail.template.variables).sort(), [...manifest[kind].variables].sort());
    const template = createHostedTemplate(kind);
    const interpolate = value => value.replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => mail.template.variables[key]);
    const local = renderLifecycleEmail(kind, input);
    assert.equal(interpolate(template.html).replace('<title>[PROVA INTERNA] ', '<title>'), local.html);
    assert.equal(interpolate(template.subject), `[PROVA INTERNA] ${local.subject}`);
  }
});

test('hosted message validation rejects unsafe actions, header controls and provider-oversize fields', () => {
  const input = authoringInput();
  assert.throws(() => createHostedMessage('welcome', { ...input, appUrl: 'https://evil.invalid' }), /not allowed/);
  assert.throws(() => createHostedMessage('welcome', { ...input, displayName: 'bad\r\nname' }), /single-line/);
  assert.throws(() => createHostedMessage('support-reply', { ...input, replyText: 'x'.repeat(2001) }), /Invalid Resend variable/);
});
