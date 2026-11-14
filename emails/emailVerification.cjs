'use strict';

const { renderEmail, formatGreeting } = require('./template.cjs');

/** verificationUrl must come from Firebase Admin with a fixed origin allowlist. */
function renderEmailVerification({ verificationUrl, allowedActionOrigins, logoUrl, displayName = '' }) {
  return renderEmail({
    subject: 'Confirma el teu correu de troBar',
    preheader: 'Un últim pas per tenir el teu compte a punt.',
    title: 'Confirma el teu correu',
    greeting: formatGreeting(displayName),
    message: 'Per acabar el registre, confirma que aquesta adreça de correu és teva.',
    logoUrl,
    allowedActionOrigins,
    action: { url: verificationUrl, label: 'Confirmar el correu' },
    actionHint: "Aquest enllaç és personal. No el comparteixis.",
    notice: "Si no has creat aquest compte, pots ignorar aquest correu.",
  });
}

module.exports = { renderEmailVerification };
