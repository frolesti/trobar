'use strict';

const { renderEmail, formatGreeting } = require('./template.cjs');

/** resetUrl must come from Firebase Admin, never from a client-supplied link. */
function renderPasswordResetEmail({ resetUrl, allowedActionOrigins, logoUrl, displayName = '' }) {
  return renderEmail({
    subject: 'Restableix la teva contrasenya de troBar',
    preheader: 'Tria una contrasenya nova per al teu compte.',
    title: 'Restableix la contrasenya',
    greeting: formatGreeting(displayName),
    message: 'Fes servir aquest enllaç per triar una contrasenya nova.',
    logoUrl,
    allowedActionOrigins,
    action: { url: resetUrl, label: 'Canviar la contrasenya' },
    actionHint: "L'enllaç només es pot fer servir un cop. No el comparteixis.",
    notice: "Si no has fet aquesta sol·licitud, pots ignorar aquest correu. La contrasenya no canviarà. Si l'enllaç ha caducat, demana'n un de nou des de l'app.",
  });
}

module.exports = { renderPasswordResetEmail };
