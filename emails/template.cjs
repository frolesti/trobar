'use strict';

const { background: grana, primary: accent } = require('../app/src/theme/brandColors.json');
const palette = require('../brand/palette.json');
const contactEmails = require('../app/src/data/contactEmails.json');
const { cream, paper, ink, muted, rule, night, nightCard, nightMuted } = palette;
const darkRules = [
  ['.email-background', `background-color:${night}!important;`],
  ['.email-card', `background-color:${nightCard}!important;`],
  ['.email-heading,.email-value', `color:${cream}!important;`],
  ['.email-copy', `color:${cream}!important;`],
  ['.email-muted', `color:${nightMuted}!important;`],
  ['.email-summary', `background-color:${grana}!important;`],
  ['.email-rule', `border-color:${nightMuted}!important;`],
  ['.email-link', `color:${cream}!important;`],
  ['.email-cta-bg,.email-cta', `background-color:${cream}!important;background-image:none!important;border-color:${cream}!important;color:${grana}!important;`],
];
const darkCss = prefix => darkRules.map(([selectors, rules]) =>
  `${selectors.split(',').map(selector => prefix + selector).join(',')}{${rules}}`).join('\n');

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function singleLine(value, field) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) {
    throw new TypeError(`${field} must be a single-line string`);
  }
  return value;
}

function httpsUrl(value, field) {
  singleLine(value, field);
  if (value !== value.trim() || !/^https:\/\//i.test(value) || /%0[ad]/i.test(value)) {
    throw new TypeError(`${field} must be an absolute HTTPS URL`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${field} must be an absolute HTTPS URL`);
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new TypeError(`${field} must be an HTTPS URL without credentials`);
  }
  return url;
}

function trustedActionUrl(value, allowedActionOrigins) {
  if (!Array.isArray(allowedActionOrigins) || allowedActionOrigins.length === 0) {
    throw new TypeError('allowedActionOrigins must contain trusted HTTPS origins');
  }
  const origins = allowedActionOrigins.map((origin) => {
    const url = httpsUrl(origin, 'allowedActionOrigins');
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new TypeError('allowedActionOrigins must contain origins, not paths');
    }
    return url.origin;
  });
  const action = httpsUrl(value, 'actionUrl');
  if (!origins.includes(action.origin)) throw new TypeError('actionUrl origin is not allowed');
  return action.href;
}

function formatGreeting(displayName = '') {
  const name = singleLine(displayName, 'displayName').trim();
  if (name.length > 120) throw new TypeError('displayName is too long');
  return name ? `Hola, ${name}!` : 'Hola!';
}

/** Shared presentation only. Delivery and trusted URLs belong to the server. */
function renderEmail({
  subject, preheader, title, greeting = '', message, logoUrl,
  action, allowedActionOrigins, actionHint = '', notice = '',
  summary, details = [], secondaryAction,
  channel = 'support',
  footerNote = '',
}) {
  for (const [field, value] of Object.entries({ subject, preheader, title, message })) {
    if (!singleLine(value, field).trim()) throw new TypeError(`${field} must not be empty`);
  }
  for (const [field, value] of Object.entries({ greeting, actionHint, notice, footerNote })) singleLine(value, field);
  if (!Object.hasOwn(contactEmails, channel)) throw new TypeError('Unknown email channel');
  if (!Array.isArray(details) || details.length > 12) throw new TypeError('Invalid email details');
  for (const item of [...details, ...(summary ? [summary] : [])]) {
    for (const key of ['label', 'value']) {
      if (!singleLine(item[key], key).trim()) throw new TypeError(`Empty ${key}`);
    }
  }
  const logo = httpsUrl(logoUrl, 'logoUrl');
  const brandLogo = logo.href === 'https://www.trobar.cat/assets/logos/logo-red.png'
    ? 'https://www.trobar.cat/assets/logos/logo-brand.png' : logo.href;
  const actionUrl = action ? trustedActionUrl(action.url, allowedActionOrigins) : null;
  if (action && !singleLine(action.label, 'action.label').trim()) throw new TypeError('action.label must not be empty');
  const secondaryUrl = secondaryAction ? trustedActionUrl(secondaryAction.url, allowedActionOrigins) : null;
  if (secondaryAction && !singleLine(secondaryAction.label, 'secondaryAction.label').trim()) throw new TypeError('Empty secondary action');
  const link = actionUrl ? escapeHtml(actionUrl) : '';
  const text = [
    title, greeting, message, summary ? `${summary.label}: ${summary.value}` : '',
    ...details.map(item => `${item.label}: ${item.value}`),
    action ? `${action.label}:\n${actionUrl}` : '', actionHint,
    secondaryAction ? `${secondaryAction.label}:\n${secondaryUrl}` : '', notice,
    'troBar', footerNote, `Contacte: ${contactEmails[channel]}`,
  ].filter(Boolean).join('\n\n');

  const html = `<!doctype html>
<html lang="ca">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(subject)}</title>
  <style>
    :root{color-scheme:light dark;supported-color-schemes:light dark;}
    @font-face{font-family:'troBar Heading';font-style:normal;font-weight:600;src:url('https://www.trobar.cat/assets/fonts/Lora-SemiBold.ttf') format('truetype');}
    @media(prefers-color-scheme:dark){
      ${darkCss('')}
    }
    ${darkCss('[data-ogsc] ')}
    u + .body .gmail-blend-screen{background:#000;mix-blend-mode:screen;}
    u + .body .gmail-blend-difference{background:#000;mix-blend-mode:difference;}
  </style>
  <!--[if mso]><style>.email-heading{font-family:Georgia,'Times New Roman',serif!important;}</style><![endif]-->
</head>
<body class="body email-background" style="margin:0;padding:0;background-color:${cream};color:${ink};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;word-wrap:break-word;overflow-wrap:anywhere;">
  <div style="display:none;font-size:1px;color:${cream};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-background" bgcolor="${cream}" style="width:100%;background-color:${cream};">
    <tr><td align="center" style="padding:24px 16px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;table-layout:fixed;">
        <tr><td data-email-header style="padding:0 0 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${cream}" style="padding:12px;background-color:${cream};background-image:linear-gradient(${cream},${cream});">
            <img src="${escapeHtml(brandLogo)}" alt="Logotip de troBar" width="40" height="40" style="display:inline-block;vertical-align:middle;width:40px;height:40px;border:0;margin-right:12px;">
            <img src="https://www.trobar.cat/assets/logos/wordmark-brand.png" alt="troBar" width="118" height="30" style="display:inline-block;vertical-align:middle;width:118px;height:30px;border:0;">
          </td></tr></table>
        </td></tr>
        <tr><td data-email-content class="email-card" align="left" bgcolor="${paper}" style="padding:32px 28px;background-color:${paper};text-align:left;">
          <h1 class="email-heading" style="margin:0 0 28px;font-family:'troBar Heading',Georgia,'Times New Roman',serif;font-size:30px;line-height:39px;font-weight:600;color:${grana};">${escapeHtml(title)}</h1>
          ${greeting ? `<p data-email-greeting class="email-copy" style="margin:0 0 12px;font-size:16px;line-height:26px;color:${ink};">${escapeHtml(greeting)}</p>` : ''}
          <p class="email-copy" style="margin:0 0 24px;font-size:16px;line-height:26px;color:${ink};">${escapeHtml(message)}</p>
          ${summary ? `<table data-email-summary class="email-summary" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${cream}" style="margin:0 0 28px;background-color:${cream};"><tr><td style="padding:18px;">
            <p class="email-muted" style="margin:0 0 6px;font-size:13px;line-height:20px;color:${muted};">${escapeHtml(summary.label)}</p>
            <p class="email-value" style="margin:0;font-size:23px;line-height:31px;font-weight:bold;font-variant-numeric:tabular-nums;color:${grana};">${escapeHtml(summary.value)}</p>
          </td></tr></table>` : ''}
          ${details.length ? `<table data-email-details class="email-rule" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid ${rule};table-layout:fixed;">
            ${details.map(item => `<tr><td class="email-muted email-rule" style="padding:12px 10px 12px 0;border-bottom:1px solid ${rule};font-size:14px;line-height:22px;color:${muted};vertical-align:top;">${escapeHtml(item.label)}</td><td class="email-value email-rule" align="right" style="padding:12px 0;border-bottom:1px solid ${rule};font-size:15px;line-height:23px;font-weight:bold;font-variant-numeric:tabular-nums;color:${ink};vertical-align:top;">${escapeHtml(item.value)}</td></tr>`).join('')}
          </table>` : ''}
          ${action ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
            <tr><td class="email-cta-bg" align="center" bgcolor="${accent}" style="background-color:${accent};background-image:linear-gradient(${accent},${accent});mso-padding-alt:14px 20px;">
              <a data-email-action class="email-cta" href="${link}" style="display:inline-block;padding:14px 20px;border:1px solid transparent;color:#ffffff;font-size:15px;line-height:22px;font-weight:bold;text-align:center;text-decoration:none;"><span class="gmail-blend-screen" style="display:block;"><span class="gmail-blend-difference" style="display:block;">${escapeHtml(action.label)}</span></span></a>
            </td></tr>
          </table>` : ''}
          ${actionHint ? `<p class="email-muted" style="margin:0 0 24px;font-size:13px;line-height:20px;color:${muted};">${escapeHtml(actionHint)}</p>` : ''}
          ${secondaryAction ? `<p style="margin:0 0 24px;font-size:14px;line-height:22px;"><a data-email-secondary class="email-link" href="${escapeHtml(secondaryUrl)}" style="color:${grana};text-decoration:underline;">${escapeHtml(secondaryAction.label)}</a></p>` : ''}
          ${notice ? `<p class="email-muted email-rule" style="margin:0;padding-top:20px;border-top:1px solid ${rule};font-size:13px;line-height:21px;color:${muted};">${escapeHtml(notice)}</p>` : ''}
        </td></tr>
        <tr><td data-email-footer style="padding:20px 4px 0;">
            ${footerNote ? `<p class="email-muted" style="margin:0;font-size:12px;line-height:19px;color:${muted};">${escapeHtml(footerNote)}</p>` : ''}
            <p style="margin:4px 0 0;font-size:13px;line-height:21px;"><a class="email-link" href="mailto:${contactEmails[channel]}" style="color:${grana};text-decoration:underline;">${contactEmails[channel]}</a></p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
`;
  return { subject, html, text, from: `troBar <${contactEmails[channel]}>`, replyTo: contactEmails[channel] };
}

module.exports = { renderEmail, formatGreeting };
