'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { renderPasswordResetEmail } = require('./passwordReset.cjs');
const { renderEmailVerification } = require('./emailVerification.cjs');
const { renderLifecycleEmail, kinds } = require('./lifecycle.cjs');
const palette = require('../brand/palette.json');
const { background: grana } = require('../app/src/theme/brandColors.json');

const previewKinds = ['email-verification', 'password-reset', ...kinds];
const labels = {
  'email-verification': 'Verificació del correu', 'password-reset': 'Recuperació de contrasenya',
  welcome: 'Primer accés verificat', 'bar-activated': 'Alta de bar i prova Premium',
  'trial-reminder-7': 'Avís set dies abans', 'trial-reminder-1': 'Avís 24 hores abans',
  'payment-received': 'Cobrament confirmat', 'payment-failed': 'Cobrament fallit',
  'payment-action-required': 'Autenticació bancària pendent', 'subscription-cancelled': 'Renovació cancel·lada',
  'subscription-ended': 'Final de Premium', 'subscription-updated': 'Canvi de pla',
  'refund-confirmed': 'Reemborsament confirmat', 'support-received': 'Consulta rebuda',
  'support-reply': 'Resposta de suport', 'account-deleted': 'Compte eliminat',
  'security-alert': 'Canvi de seguretat', 'bar-onboarding': 'Consells de perfil · opcional',
};

function previewInput() {
  return {
    displayName: 'Laia', barName: 'Bar del Partit', billingCycle: 'annual',
    amount: 34800, currency: 'eur', trialEnd: 1795077000,
    periodStart: 1795077000, periodEnd: 1826613000, invoiceNumber: 'EXEMPLE-2026-001',
    reference: 'CONSULTA-DE-MOSTRA', supportSubject: 'Informació del perfil del bar',
    replyText: 'Hem revisat la consulta i hem actualitzat la informació del perfil. Gràcies per ajudar-nos a millorar troBar.',
    securityChange: 'Contrasenya actualitzada',
    logoUrl: 'https://example.invalid/logo.png', allowedActionOrigins: ['https://example.invalid'],
    appUrl: 'https://example.invalid/app', manageUrl: 'https://example.invalid/subscription',
    invoiceUrl: 'https://example.invalid/invoice', profileUrl: 'https://example.invalid/profile',
    unsubscribeUrl: 'https://example.invalid/preferences',
  };
}

function renderPreview(kind = 'password-reset') {
  if (!previewKinds.includes(kind)) throw new TypeError('Unknown preview kind');
  const renderer = kind === 'password-reset' ? renderPasswordResetEmail : renderEmailVerification;
  const options = {
    ...previewInput(),
    ...(kind === 'password-reset'
      ? { resetUrl: 'https://example.invalid/reset-password?preview=1' }
      : { verificationUrl: 'https://example.invalid/verify-email?preview=1' }),
    allowedActionOrigins: ['https://example.invalid'],
    logoUrl: 'https://example.invalid/logo.png',
  };
  const { html } = kinds.includes(kind) ? renderLifecycleEmail(kind, options) : renderer(options);
  return html
    .replaceAll('https://www.trobar.cat/assets/fonts/', '../../assets/web/fonts/')
    .replaceAll('https://www.trobar.cat/assets/logos/wordmark-brand.png', '../../assets/web/logos/wordmark-brand.png')
    .replace('src="https://example.invalid/logo.png"', 'src="../../assets/web/logos/logo-brand.png"')
    .replace('  <table role="presentation" width="100%"',
      `  <p role="note" style="margin:0;padding:8px 16px;background:${palette.cream};color:${palette.muted};font:12px/18px Arial,Helvetica,sans-serif;text-align:center;">PREVISUALITZACIÓ · Exemple sense enviament ni enllaços actius.</p>\n  <table role="presentation" width="100%"`);
}

if (require.main === module) {
  for (const kind of previewKinds) {
    const target = path.resolve(__dirname, '..', 'docs', 'previews', `${kind}.html`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, renderPreview(kind), 'utf8');
    console.log(`Preview: docs\\previews\\${kind}.html`);
  }
  const patternTarget = path.resolve(__dirname, '..', 'docs', 'previews', 'password-reset-pattern.html');
  fs.writeFileSync(patternTarget, renderPreview(), 'utf8');
  console.log('Preview: docs\\previews\\password-reset-pattern.html');
  const gallery = `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>troBar · Correus de servei</title><style>
@font-face{font-family:Heading;src:url('../../assets/web/fonts/Lora-SemiBold.ttf')}body{margin:0;background:${palette.cream};color:${palette.ink};font:16px/1.6 Arial,sans-serif}main{max-width:980px;padding:40px 24px;margin:auto}h1{font:600 40px/1.2 Heading,Georgia,serif;color:${grana}}a{color:${grana}}ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0;padding:0;list-style:none}li a{display:block;padding:22px;border-top:1px solid ${palette.rule};text-decoration:none}small{display:block;color:${palette.muted}}p{max-width:720px}
</style></head><body><main><h1>Els correus de troBar</h1><p>Dades fictícies. Cap correu enviat ni cobrament real.</p><ul>${previewKinds.map(kind => `<li><a href="${kind}.html">${labels[kind]}<small>Veure el correu</small></a></li>`).join('')}</ul><p>Les plantilles no impliquen que tots aquests enviaments estiguin activats. La guia de campanya diferencia automatització, proves internes i dissenys preparats.</p></main></body></html>`;
  fs.writeFileSync(path.resolve(__dirname, '..', 'docs', 'previews', 'index.html'), gallery, 'utf8');
}

module.exports = { renderPreview, previewInput, previewKinds, previewLabels: labels };
