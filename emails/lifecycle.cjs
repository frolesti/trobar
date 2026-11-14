'use strict';

const { renderEmail, formatGreeting } = require('./template.cjs');

const kinds = [
  'welcome', 'bar-activated', 'trial-reminder-7', 'trial-reminder-1',
  'payment-received', 'payment-failed', 'payment-action-required',
  'subscription-cancelled', 'subscription-ended', 'subscription-updated', 'refund-confirmed',
  'support-received', 'support-reply', 'account-deleted', 'security-alert', 'bar-onboarding',
];

function required(value, field, max = 300) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) {
    throw new TypeError(`Invalid ${field}`);
  }
  return value;
}

function date(seconds) {
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 8640000000000) throw new TypeError('Invalid date');
  return new Intl.DateTimeFormat('ca-ES', {
    timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(seconds * 1000));
}

function money(amount, currency) {
  if (!Number.isSafeInteger(amount) || amount < 0 || currency !== 'eur') throw new TypeError('Invalid Stripe amount or currency');
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(amount / 100);
}

function renderLifecycleEmail(kind, input) {
  if (!kinds.includes(kind)) throw new TypeError('Unknown lifecycle email');
  const base = {
    logoUrl: input.logoUrl, allowedActionOrigins: input.allowedActionOrigins,
    greeting: formatGreeting(input.displayName), channel: 'support',
  };
  const action = (label, field) => ({ label, url: required(input[field], field) });
  const row = (label, value) => ({ label, value });
  const bar = () => required(input.barName, 'barName');
  const amount = () => money(input.amount, input.currency);
  const cycle = () => {
    const labels = { monthly: 'Cada mes', quarterly: 'Cada tres mesos', annual: 'Cada any' };
    if (!Object.hasOwn(labels, input.billingCycle)) throw new TypeError('Invalid billing cycle');
    return labels[input.billingCycle];
  };
  let content;
  switch (kind) {
    case 'welcome':
      content = {
        subject: 'Benvingut a troBar',
        preheader: 'Troba un bar per veure el pròxim partit.',
        title: 'On veuràs el pròxim partit?',
        message: 'Gràcies per sumar-te a troBar. Aquí trobaràs bars on veure el Barça i podràs compartir amb altres culers els llocs que coneixes.',
        action: action('Descobrir troBar', 'appUrl'),
      };
      break;
    case 'bar-activated':
      content = {
        channel: 'billing',
        subject: `${bar()}: la prova Premium ja està activa`,
        preheader: `Primer cobrament previst: ${amount()}. Prova fins al ${date(input.trialEnd)}.`,
        title: 'El teu bar ja és a troBar',
        message: `Ja pots preparar el perfil de ${bar()} amb Premium. No t’hem cobrat res: ara tens temps de provar-lo i veure si et va bé.`,
        summary: row('Primer cobrament previst', date(input.trialEnd)),
        details: [row('Establiment', bar()), row('Pla', cycle()), row('Primer import previst', amount()), row('Renovació', 'Automàtica si no cancel·les abans')],
        action: action('Gestionar la subscripció', 'manageUrl'),
        notice: 'En acabar la prova, passarem la primera quota al mètode de pagament que has desat. Pots cancel·lar abans des del teu compte. Si canvies el pla o les dades fiscals, l’import pot variar.',
      };
      break;
    case 'trial-reminder-7':
    case 'trial-reminder-1':
      content = {
        channel: 'billing',
        subject: `${bar()}: la prova s’acaba el ${date(input.trialEnd)}`,
        preheader: `Cobrament previst: ${amount()}. Pots revisar o cancel·lar la subscripció.`,
        title: kind === 'trial-reminder-7' ? 'La prova Premium s’acaba aviat' : 'El primer cobrament s’acosta',
        message: `La prova de ${bar()} s’acaba el ${date(input.trialEnd)}. Si vols continuar amb Premium, no cal que facis res: a partir d’aquell moment passarem la quota al mètode de pagament que has desat.`,
        summary: row('Primer import previst', amount()),
        details: [row('Final de la prova', date(input.trialEnd)), row('Establiment', bar()), row('Periodicitat', cycle())],
        action: action('Revisar o cancel·lar la subscripció', 'manageUrl'),
        notice: 'Si prefereixes no continuar, pots cancel·lar abans que acabi la prova. Ho pots fer des de la gestió de la subscripció.',
      };
      break;
    case 'payment-received':
      if (input.amount <= 0) throw new TypeError('A zero invoice is not a collected payment');
      if (input.periodEnd <= input.periodStart) throw new TypeError('Invalid invoice period');
      content = {
        channel: 'billing',
        subject: `Pagament rebut: ${amount()} · ${bar()}`,
        preheader: 'Aquí tens el resum del cobrament i l’accés a la factura.',
        title: 'Ja hem rebut el teu pagament',
        message: `La quota de ${bar()} ja està pagada. Et deixem el resum i la factura perquè els tinguis a mà.`,
        summary: row('Import cobrat', amount()),
        details: [row('Establiment', bar()), row('Factura', required(input.invoiceNumber, 'invoiceNumber')), row('Període des de', date(input.periodStart)), row('Període fins a', date(input.periodEnd))],
        action: action('Veure la factura', 'invoiceUrl'),
        secondaryAction: action('Gestionar la subscripció', 'manageUrl'),
      };
      break;
    case 'payment-failed':
    case 'payment-action-required':
      content = {
        channel: 'billing',
        subject: `${bar()}: cal revisar el pagament`,
        preheader: 'El pagament no està confirmat. Revisa el mètode de pagament.',
        title: kind === 'payment-failed' ? 'El cobrament no s’ha completat' : 'Falta confirmar el pagament',
        message: kind === 'payment-failed' ? 'No hem pogut completar el cobrament. Entra al teu compte per revisar la targeta o fer servir un altre mètode de pagament.' : 'El teu banc necessita que confirmis el pagament. Pots fer-ho a la pàgina de pagament de Stripe.',
        summary: row('Import pendent', amount()), details: [row('Establiment', bar())],
        action: action('Revisar el pagament', 'manageUrl'),
      };
      break;
    case 'subscription-cancelled':
      content = {
        channel: 'billing',
        subject: `${bar()}: renovació cancel·lada`, preheader: 'Aquí tens la data de final del teu accés.',
        title: 'La subscripció no es renovarà',
        message: `Ja hem aturat la renovació de ${bar()}. Pots fer servir Premium fins a la data que veus aquí.`,
        summary: row('Accés fins al', date(input.periodEnd)),
        action: action('Consultar la subscripció', 'manageUrl'),
        notice: 'No et cobrarem cap altra renovació. Si havia quedat alguna factura pendent, la pots consultar des del teu compte.',
      };
      break;
    case 'subscription-ended':
      content = {
        channel: 'billing', subject: `${bar()}: ha finalitzat l’accés Premium`,
        preheader: 'Consulta l’estat del teu bar i les opcions disponibles.', title: 'Ha acabat l’accés Premium',
        message: `El període Premium de ${bar()} s’ha acabat. Les factures i l’estat de la subscripció continuen disponibles al teu compte.`,
        action: action('Consultar el compte', 'manageUrl'),
      };
      break;
    case 'subscription-updated':
      content = {
        channel: 'billing', subject: `${bar()}: hem actualitzat la subscripció`,
        preheader: 'Revisa la nova periodicitat i l’import previst.', title: 'El nou pla ja està desat',
        message: 'Ja hem desat el canvi que ens has demanat. Aquí tens la quota i la data de la pròxima renovació.',
        summary: row('Pròxim import previst', amount()),
        details: [row('Establiment', bar()), row('Periodicitat', cycle()), row('Pròxima renovació', date(input.periodEnd))],
        action: action('Revisar la subscripció', 'manageUrl'), notice: 'Si el canvi comporta un ajust de l’import, el trobaràs a la factura de Stripe.',
      };
      break;
    case 'refund-confirmed':
      if (input.amount <= 0) throw new TypeError('Invalid refund amount');
      content = {
        channel: 'billing', subject: `Reemborsament confirmat: ${amount()}`,
        preheader: 'Ja hem tramitat la devolució.', title: 'Ja hem tramitat la devolució',
        message: 'Stripe ha confirmat la devolució de l’import. Pot ser que el banc trigui uns dies a mostrar-la al teu compte.',
        summary: row('Import reemborsat', amount()), details: [row('Establiment', bar())],
        action: action('Consultar la factura', 'invoiceUrl'),
      };
      break;
    case 'support-received':
    case 'support-reply':
      content = {
        subject: kind === 'support-received' ? 'Hem rebut la teva consulta' : 'Tens una resposta de l’equip de troBar',
        preheader: 'Conserva la referència per fer el seguiment de la consulta.',
        title: kind === 'support-received' ? 'Ja tenim el teu missatge' : 'Et responem',
        message: kind === 'support-received' ? 'Gràcies per escriure’ns. Llegirem el que ens expliques i et respondrem per correu. Si vols afegir-hi alguna cosa, pots respondre aquest missatge.' : required(input.replyText, 'replyText', 3000),
        details: [row('Referència', required(input.reference, 'reference')), row('Assumpte', required(input.supportSubject, 'supportSubject'))],
        notice: 'Per seguretat, no ens enviïs contrasenyes, dades de targeta ni codis de verificació.',
      };
      break;
    case 'account-deleted':
      content = {
        subject: 'Hem eliminat el teu compte de troBar',
        preheader: 'Confirmació de la sol·licitud d’eliminació.', title: 'El compte s’ha eliminat',
        message: 'Ja hem eliminat el compte que ens has demanat. Les dades que la llei ens obliga a conservar es tractaran d’acord amb la política de privacitat.',
        notice: 'Si tenies factures pendents, l’eliminació del compte no les anul·la.',
      };
      break;
    case 'security-alert':
      content = {
        subject: 'S’ha actualitzat la seguretat del teu compte',
        preheader: 'Si no reconeixes aquest canvi, contacta amb suport.', title: 'Revisa aquest canvi',
        message: 'T’escrivim perquè s’ha fet aquest canvi al teu compte. Si l’has fet tu, no cal que facis res.',
        summary: row('Canvi confirmat', required(input.securityChange, 'securityChange')),
        notice: 'Si no reconeixes aquest canvi, contacta amb suport. No comparteixis contrasenyes ni codis de verificació.',
      };
      break;
    case 'bar-onboarding':
      content = {
        subject: `${bar()}: mostra com es viu el partit al teu bar`,
        preheader: 'Revisa els detalls que ajuden els aficionats a triar.',         title: 'Posa al dia el perfil del teu bar',
        message: 'Com es viu un partit a casa vostra? Afegeix fotos del local i explica quines pantalles teniu, què s’hi pot menjar i quin ambient s’hi troba.',
        details: [row('Establiment', bar())], action: action('Revisar el perfil', 'profileUrl'),
        secondaryAction: action('Deixar de rebre consells de perfil', 'unsubscribeUrl'),
        notice: 'Pots deixar de rebre aquests consells des de l’enllaç de baixa. Continuaràs rebent els avisos de compte i facturació.',
      };
      break;
  }
  return renderEmail({ ...base, ...content });
}

module.exports = { renderLifecycleEmail, kinds, date, money };
