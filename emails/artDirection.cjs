'use strict';

const imageSlots = {
  'match-night-together': { mood: 'Nit de partit, tots a una', brief: 'Culers mirant la pantalla en un bar ple.', width: 1120, height: 600, tone: 'grana' },
  'shared-table': { mood: 'La taula compartida', brief: 'Mans, tapes i begudes abans del partit.', width: 560, height: 480, tone: 'cream' },
  'goal-celebration': { mood: 'El gol que ens uneix', brief: 'Alegria espontània entre amics al bar.', width: 560, height: 480, tone: 'rose' },
  'bar-interior-warm': { mood: 'Un bar que convida a entrar', brief: 'Interior acollidor, llum càlida i taules a punt.', width: 1120, height: 600, tone: 'cream' },
  'screen-ready': { mood: 'Tot a punt per al futbol', brief: 'Pantalla ben situada i local preparat.', width: 560, height: 480, tone: 'grana' },
  'tapas-closeup': { mood: 'El que ve de gust compartir', brief: 'Detall de tapes i especialitats del local.', width: 560, height: 480, tone: 'rose' },
  'bar-doors-open': { mood: 'Una nova etapa al bar', brief: 'Porta oberta, llum de tarda i benvinguda.', width: 1120, height: 400, tone: 'rose' },
  'evening-bar-lights': { mood: 'Encara queden partits per viure', brief: 'Ambient de vespre amb el bar en marxa.', width: 1120, height: 320, tone: 'grana' },
  'kickoff-countdown': { mood: 'El partit és a tocar', brief: 'La calma del bar just abans de començar.', width: 1120, height: 320, tone: 'cream' },
  'bar-after-match': { mood: 'Fins al pròxim partit', brief: 'Taules recollides i llum suau de final de dia.', width: 1120, height: 400, tone: 'rose' },
  'bar-preparing-match': { mood: 'Una nova manera de preparar el partit', brief: 'Equip del bar posant el local a punt.', width: 1120, height: 320, tone: 'cream' },
};

const designs = {
  service: { layout: 'letter' },
  'email-verification': { layout: 'letter' },
  'password-reset': { layout: 'letter' },
  welcome: { layout: 'story', hero: 'match-night-together', gallery: ['shared-table', 'goal-celebration'] },
  'bar-onboarding': { layout: 'story', hero: 'bar-interior-warm', gallery: ['screen-ready', 'tapas-closeup'] },
  'bar-activated': { layout: 'feature', hero: 'bar-doors-open' },
  'trial-reminder-7': { layout: 'panorama', hero: 'evening-bar-lights' },
  'trial-reminder-1': { layout: 'panorama', hero: 'kickoff-countdown' },
  'payment-received': { layout: 'receipt' },
  'payment-failed': { layout: 'letter' },
  'payment-action-required': { layout: 'letter' },
  'subscription-cancelled': { layout: 'letter' },
  'subscription-ended': { layout: 'feature', hero: 'bar-after-match' },
  'subscription-updated': { layout: 'panorama', hero: 'bar-preparing-match' },
  'refund-confirmed': { layout: 'receipt' },
  'support-received': { layout: 'letter' },
  'support-reply': { layout: 'letter' },
  'account-deleted': { layout: 'letter' },
  'security-alert': { layout: 'letter' },
};

function getEmailDesign(kind) {
  if (!Object.hasOwn(designs, kind)) throw new TypeError('Unknown email design');
  return designs[kind];
}

function imageUrl(key) {
  if (!Object.hasOwn(imageSlots, key)) throw new TypeError('Unknown email image');
  return `https://www.trobar.cat/assets/img/emails/${key}.png`;
}

module.exports = { designs, imageSlots, getEmailDesign, imageUrl };
