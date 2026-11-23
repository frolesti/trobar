'use strict';

const { renderLifecycleEmail, kinds, date, money } = require('./lifecycle.cjs');
const { renderPasswordResetEmail } = require('./passwordReset.cjs');
const { renderEmailVerification } = require('./emailVerification.cjs');
const { formatGreeting } = require('./template.cjs');
const templates = require('./resendTemplates.json');

const origin = 'https://www.trobar.cat';
const escape = value => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const readers = {
  GREETING: input => formatGreeting(input.displayName),
  BAR_NAME: input => input.barName,
  AMOUNT: input => money(input.amount, input.currency),
  BILLING_CYCLE: input => ({ monthly: 'Cada mes', quarterly: 'Cada tres mesos', annual: 'Cada any' })[input.billingCycle],
  TRIAL_END: input => date(input.trialEnd),
  PERIOD_START: input => date(input.periodStart),
  PERIOD_END: input => date(input.periodEnd),
  INVOICE_NUMBER: input => input.invoiceNumber,
  REFERENCE: input => input.reference,
  SUPPORT_SUBJECT: input => input.supportSubject,
  REPLY_TEXT: input => input.replyText,
  SECURITY_CHANGE: input => input.securityChange,
  APP_URL: input => new URL(input.appUrl).href,
  MANAGE_URL: input => new URL(input.manageUrl).href,
  INVOICE_URL: input => new URL(input.invoiceUrl).href,
  PROFILE_URL: input => new URL(input.profileUrl).href,
  PREFERENCES_URL: input => new URL(input.unsubscribeUrl).href,
  RESET_URL: input => new URL(input.resetUrl).href,
  VERIFICATION_URL: input => new URL(input.verificationUrl).href,
};
const fieldKinds = ['email-verification', 'password-reset', ...kinds];

function render(kind, input) {
  if (kind === 'email-verification') return renderEmailVerification(input);
  if (kind === 'password-reset') return renderPasswordResetEmail(input);
  return renderLifecycleEmail(kind, input);
}

function authoringInput() {
  return {
    displayName: 'TROBAR_NAME_VARIABLE', barName: 'TROBAR_BAR_VARIABLE', billingCycle: 'quarterly',
    amount: 12345, currency: 'eur', trialEnd: 1795077000,
    periodStart: 1795163400, periodEnd: 1826699400, invoiceNumber: 'TROBAR_INVOICE_VARIABLE',
    reference: 'TROBAR_REFERENCE_VARIABLE', supportSubject: 'TROBAR_SUPPORT_SUBJECT_VARIABLE',
    replyText: 'TROBAR_REPLY_VARIABLE', securityChange: 'TROBAR_SECURITY_VARIABLE',
    logoUrl: `${origin}/assets/logos/logo-red.png`, allowedActionOrigins: [origin],
    ...Object.fromEntries(['app', 'manage', 'invoice', 'profile', 'unsubscribe', 'reset', 'verification']
      .map(name => [`${name}Url`, `${origin}/__email_variable__/${name}`])),
  };
}

function createHostedTemplate(kind) {
  if (!fieldKinds.includes(kind)) throw new TypeError('Unknown hosted email kind');
  const input = authoringInput();
  const mail = render(kind, input);
  let html = mail.html;
  let subject = `{{{SUBJECT_PREFIX}}}${mail.subject}`;
  const variables = [{ key: 'SUBJECT_PREFIX', type: 'string' }];
  for (const [key, read] of Object.entries(readers)) {
    const value = read(input);
    if (html.includes(escape(value))) {
      html = html.split(escape(value)).join(`{{{${key}}}}`);
      variables.push({ key, type: 'string' });
    }
    if (subject.includes(value)) {
      subject = subject.split(value).join(`{{{SUBJECT_${key}}}}`);
      variables.push({ key: `SUBJECT_${key}`, type: 'string' });
    }
  }
  if (/TROBAR_\w+_VARIABLE|__email_variable__/.test(html + subject)) {
    throw new Error(`Unbound authoring field in ${kind}`);
  }
  return { name: `troBar - ${kind}`, alias: `trobar-${kind}`, from: mail.from, replyTo: mail.replyTo, subject, html, variables };
}

function createHostedMessage(kind, input, { internalTest = true } = {}) {
  const entry = templates[kind];
  if (!entry?.id || !entry.published || !Array.isArray(entry.variables)) {
    throw new Error(`Published Resend template missing: ${kind}`);
  }
  // Reuse the canonical validation of names, Stripe facts and trusted action URLs.
  const { from, replyTo } = render(kind, input);
  const variables = {};
  for (const key of entry.variables) {
    if (key === 'SUBJECT_PREFIX') { variables[key] = internalTest ? '[PROVA INTERNA] ' : ''; continue; }
    const isSubject = key.startsWith('SUBJECT_');
    const read = readers[isSubject ? key.slice(8) : key];
    if (!read) throw new Error(`Unknown Resend variable: ${key}`);
    const value = read(input);
    if (typeof value !== 'string' || value.length > 2000 || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) {
      throw new TypeError(`Invalid Resend variable: ${key}`);
    }
    variables[key] = isSubject ? value : escape(value);
    if (variables[key].length > 2000) throw new TypeError(`Resend variable too long: ${key}`);
  }
  return { from, replyTo, template: { id: entry.id, variables } };
}

module.exports = { createHostedTemplate, createHostedMessage, fieldKinds, authoringInput };
