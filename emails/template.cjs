'use strict';

const { background: grana } = require('../app/src/theme/brandColors.json');
const palette = require('../brand/palette.json');
const contactEmails = require('../app/src/data/contactEmails.json');
const { getEmailDesign, imageSlots, imageUrl } = require('./artDirection.cjs');
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
  subject, preheader, title, greeting = '', message, paragraphs = [], logoUrl,
  action, allowedActionOrigins, actionHint = '', notice = '',
  summary, details = [], secondaryAction,
  channel = 'support',
  footerNote = '',
  design = 'service',
}) {
  const composition = getEmailDesign(design);
  const renderImage = (key, width) => {
    const image = imageSlots[key];
    return `<img src="${imageUrl(key)}" alt="${escapeHtml(image.mood)}" width="${width}" height="${width * image.height / image.width}" style="display:block;width:100%;height:auto;border:0;">`;
  };
  for (const [field, value] of Object.entries({ subject, preheader, title, message })) {
    if (!singleLine(value, field).trim()) throw new TypeError(`${field} must not be empty`);
  }
  for (const [field, value] of Object.entries({ greeting, actionHint, notice, footerNote })) singleLine(value, field);
  if (!Array.isArray(paragraphs) || paragraphs.length > 4) throw new TypeError('Invalid email paragraphs');
  for (const paragraph of paragraphs) {
    if (!singleLine(paragraph, 'paragraph').trim()) throw new TypeError('Empty email paragraph');
  }
  if (!Object.hasOwn(contactEmails, channel)) throw new TypeError('Unknown email channel');
  if (!Array.isArray(details) || details.length > 12) throw new TypeError('Invalid email details');
  for (const item of [...details, ...(summary ? [summary] : [])]) {
    for (const key of ['label', 'value']) {
      if (!singleLine(item[key], key).trim()) throw new TypeError(`Empty ${key}`);
    }
  }
  const logo = httpsUrl(logoUrl, 'logoUrl');
  const brandLogo = /^https:\/\/www\.trobar\.cat\/assets\/logos\/logo-(?:red|brand)\.png$/.test(logo.href)
    ? 'https://www.trobar.cat/assets/logos/logo-email-open-cloche.png' : logo.href;
  const instagramUrl = 'https://www.instagram.com/trobarapp/';
  const publicUrl = 'https://www.trobar.cat';
  const sharing = [
    { name: 'WhatsApp', icon: 'whatsapp', url: `https://wa.me/?text=${encodeURIComponent(`Troba on veure el Barça amb troBar. ${publicUrl}`)}` },
    { name: 'Facebook', icon: 'facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}` },
    { name: 'Twitter', icon: 'twitter', url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent('El partit es viu al bar. Descobreix troBar.')}` },
  ];
  const actionUrl = action ? trustedActionUrl(action.url, allowedActionOrigins) : null;
  if (action && !singleLine(action.label, 'action.label').trim()) throw new TypeError('action.label must not be empty');
  const secondaryUrl = secondaryAction ? trustedActionUrl(secondaryAction.url, allowedActionOrigins) : null;
  if (secondaryAction && !singleLine(secondaryAction.label, 'secondaryAction.label').trim()) throw new TypeError('Empty secondary action');
  const link = actionUrl ? escapeHtml(actionUrl) : '';
  const text = [
    title, greeting, message, ...paragraphs, summary ? `${summary.label}: ${summary.value}` : '',
    ...details.map(item => `${item.label}: ${item.value}`),
    action ? `${action.label}:\n${actionUrl}` : '', actionHint,
    secondaryAction ? `${secondaryAction.label}:\n${secondaryUrl}` : '', notice,
    'troBar', footerNote, 'Comparteix troBar', ...sharing.map(item => `${item.name}: ${item.url}`),
    'Segueix-nos', `Instagram: ${instagramUrl}`,
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
    @font-face{font-family:'troBar Heading';font-style:normal;font-weight:700;src:url('https://www.trobar.cat/assets/fonts/BarlowCondensed-Bold.ttf') format('truetype');}
    @media(prefers-color-scheme:dark){
      ${darkCss('')}
    }
    ${darkCss('[data-ogsc] ')}
    u + .body .gmail-blend-screen{background:#000;mix-blend-mode:screen;}
    u + .body .gmail-blend-difference{background:#000;mix-blend-mode:difference;}
  </style>
  <!--[if mso]><style>.email-heading{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
</head>
<body class="body email-background" style="margin:0;padding:0;background-color:${cream};color:${ink};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;word-wrap:break-word;overflow-wrap:anywhere;">
  <div style="display:none;font-size:1px;color:${cream};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-background" bgcolor="${cream}" style="width:100%;background-color:${cream};">
    <tr><td align="center" style="padding:20px 16px 12px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table data-email-layout="${composition.layout}" align="center" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" bgcolor="${paper}" style="width:100%;max-width:560px;margin:0 auto;table-layout:fixed;background-color:${paper};">
        <tr><td data-email-header align="center" style="padding:20px 24px 12px;text-align:center;">
          <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="${cream}" style="background-color:${cream};background-image:linear-gradient(${cream},${cream});"><tr>
            <td style="padding:8px 12px;"><img src="${escapeHtml(brandLogo)}" alt="Logotip de troBar amb la pilota fora de la campana" width="32" height="52" style="display:block;width:32px;height:52px;object-fit:contain;border:0;"></td>
            <td style="padding:8px 16px 8px 0;"><img src="https://www.trobar.cat/assets/logos/wordmark-brand.png" alt="troBar" width="106" height="27" style="display:block;width:106px;height:27px;border:0;"></td>
          </tr></table>
        </td></tr>
${composition.hero ? `        <tr><td data-email-hero="${composition.hero}">${renderImage(composition.hero, 560)}</td></tr>` : ''}
        <tr><td data-email-content class="email-card" align="left" bgcolor="${paper}" style="padding:${composition.hero ? '28px' : '12px'} 24px 24px;background-color:${paper};text-align:left;">
          <h1 class="email-heading" style="margin:0 0 12px;font-family:'troBar Heading',Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;font-weight:700;color:${grana};">${escapeHtml(title)}</h1>
          ${greeting ? `<p data-email-greeting class="email-copy" style="margin:0 0 8px;font-size:16px;line-height:24px;color:${ink};">${escapeHtml(greeting)}</p>` : ''}
          <p class="email-copy" style="margin:0 0 16px;font-size:16px;line-height:24px;color:${ink};">${escapeHtml(message)}</p>
${paragraphs.map(paragraph => `          <p data-email-paragraph class="email-copy" style="margin:0 0 16px;font-size:16px;line-height:24px;color:${ink};">${escapeHtml(paragraph)}</p>`).join('\n')}
          ${summary ? `<table data-email-summary class="email-summary" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${cream}" style="margin:0 0 16px;background-color:${cream};text-align:left;"><tr><td style="padding:12px 16px;">
            <p class="email-muted" style="margin:0 0 4px;font-size:13px;line-height:20px;color:${muted};">${escapeHtml(summary.label)}</p>
            <p class="email-value" style="margin:0;font-size:${composition.layout === 'receipt' ? '30px;line-height:36px' : '22px;line-height:28px'};font-weight:bold;font-variant-numeric:tabular-nums;color:${grana};">${escapeHtml(summary.value)}</p>
          </td></tr></table>` : ''}
${details.length ? `          <table data-email-details class="email-rule" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border-top:1px solid ${rule};table-layout:fixed;text-align:left;">
            ${details.map(item => `<tr><td class="email-muted email-rule" width="38%" style="width:38%;padding:8px 10px 8px 0;border-bottom:1px solid ${rule};font-size:14px;line-height:22px;color:${muted};vertical-align:top;">${escapeHtml(item.label)}</td><td class="email-value email-rule" align="right" style="padding:8px 0;border-bottom:1px solid ${rule};font-size:15px;line-height:22px;font-weight:bold;font-variant-numeric:tabular-nums;color:${ink};vertical-align:top;">${escapeHtml(item.value)}</td></tr>`).join('')}
          </table>` : ''}
          ${action ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="max-width:100%;margin:0 auto 12px;">
            <tr><td class="email-cta-bg" align="center" bgcolor="${grana}" style="background-color:${grana};background-image:linear-gradient(${grana},${grana});border-radius:8px;mso-padding-alt:12px 20px;">
              <a data-email-action class="email-cta" href="${link}" style="display:block;padding:12px 20px;border:1px solid transparent;border-radius:8px;color:#ffffff;font-size:15px;line-height:22px;font-weight:bold;text-align:center;text-decoration:none;"><span class="gmail-blend-screen" style="display:block;"><span class="gmail-blend-difference" style="display:block;">${escapeHtml(action.label)}</span></span></a>
            </td></tr>
          </table>` : ''}
          ${actionHint ? `<p class="email-muted" style="margin:0 0 12px;font-size:13px;line-height:20px;color:${muted};">${escapeHtml(actionHint)}</p>` : ''}
          ${secondaryAction ? `<p style="margin:0 0 12px;font-size:14px;line-height:22px;"><a data-email-secondary class="email-link" href="${escapeHtml(secondaryUrl)}" style="display:inline-block;padding:10px 0;color:${grana};text-decoration:underline;">${escapeHtml(secondaryAction.label)}</a></p>` : ''}
          ${notice ? `<p class="email-muted email-rule" style="margin:0;padding-top:12px;border-top:1px solid ${rule};font-size:13px;line-height:20px;color:${muted};">${escapeHtml(notice)}</p>` : ''}
        </td></tr>
${composition.gallery ? `        <tr><td data-email-gallery><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;"><tr>${composition.gallery.map(key => `<td width="50%" valign="top">${renderImage(key, 280)}</td>`).join('')}</tr></table></td></tr>` : ''}
      </table>
      <table data-email-footer role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${grana}" style="width:100%;max-width:560px;margin:0 auto;background-color:${grana};">
        <tr><td align="center" style="padding:16px 8px 8px;text-align:center;">
            ${footerNote ? `<p style="margin:0;font-size:12px;line-height:19px;color:${cream};">${escapeHtml(footerNote)}</p>` : ''}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;"><tr>
              <td width="65%" align="center" valign="top" style="width:65%;">
                <table data-email-share role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                  <tr><td colspan="3" align="center" style="font-size:13px;line-height:24px;color:${cream};">Comparteix troBar</td></tr>
                  <tr>${sharing.map(item => `<td><a href="${escapeHtml(item.url)}" aria-label="Compartir troBar a ${item.name}" style="display:inline-block;padding:10px;line-height:24px;"><img src="https://www.trobar.cat/assets/logos/${item.icon}-email-cream.png" alt="Compartir a ${item.name}" width="24" height="24" style="display:block;width:24px;height:24px;border:0;"></a></td>`).join('')}</tr>
                </table>
              </td>
              <td width="35%" align="center" valign="top" style="width:35%;border-left:1px solid ${rule};">
                <table data-email-follow role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                  <tr><td align="center" style="font-size:13px;line-height:24px;color:${cream};">Segueix-nos</td></tr>
                  <tr><td align="center"><a href="${instagramUrl}" aria-label="Seguir troBar a Instagram" style="display:inline-block;padding:10px;line-height:24px;"><img src="https://www.trobar.cat/assets/logos/instagram-email-cream.png" alt="Instagram de troBar" width="24" height="24" style="display:block;width:24px;height:24px;border:0;"></a></td></tr>
                </table>
              </td>
            </tr></table>
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
