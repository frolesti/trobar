'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, '.expo', 'email-functions');
const enableInternalBilling = process.argv.includes('--enable-internal-billing');
const enableTransactional = process.argv.includes('--enable-public-transactional');
const transactionalSince = process.argv.find(value => value.startsWith('--transactional-since='))?.split('=').slice(1).join('=');
if (enableTransactional && (!transactionalSince || !Number.isFinite(Date.parse(transactionalSince)))) {
  throw new Error('Public transactional delivery requires --transactional-since=<ISO timestamp>');
}
fs.mkdirSync(path.join(destination, 'lib'), { recursive: true });
const modules = path.join(destination, 'node_modules');
if (!fs.existsSync(modules)) fs.symlinkSync(path.join(root, 'functions', 'node_modules'), modules, 'junction');
fs.copyFileSync(path.join(root, 'functions', 'lib', 'emailDelivery.js'), path.join(destination, 'lib', 'emailDelivery.js'));
fs.copyFileSync(path.join(root, 'functions', 'lib', 'accountEmailEvents.js'), path.join(destination, 'lib', 'accountEmailEvents.js'));
const source = fs.readFileSync(path.join(root, 'functions', 'src', 'index.ts'), 'utf8');
const parsed = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
const names = new Set([
  'stripeSecretKey', 'stripeWebhookSecret', 'STRIPE_PRICE_IDS', 'getStripe', 'db',
  'isBillingCycle', 'subscriptionCycle', 'subscriptionPeriodEnd', 'assertBillableBar',
  'assertOwnedSubscription', 'syncSubscriptionState', 'createBillingPortalSession', 'getSubscriptionStatus', 'stripeWebhook',
]);
const selected = [];
for (const statement of parsed.statements) {
  const name = ts.isFunctionDeclaration(statement) ? statement.name?.text
    : ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1
      ? statement.declarationList.declarations[0].name.getText(parsed) : null;
  if (names.delete(name)) selected.push(statement.getText(parsed));
}
if (names.size) throw new Error(`Missing billing declarations: ${[...names].join(', ')}`);
const billingSource = [
  'import * as admin from "firebase-admin";',
  'import { FieldValue } from "firebase-admin/firestore";',
  'import { defineSecret } from "firebase-functions/params";',
  'import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";',
  'import Stripe from "stripe";',
  'import { planSubscriptionEmails, planRefundEmail } from "./emailDelivery";',
  ...selected,
].join('\n');
const functionsRoot = path.join(root, 'functions');
const config = ts.readConfigFile(path.join(functionsRoot, 'tsconfig.json'), ts.sys.readFile);
const options = { ...ts.parseJsonConfigFileContent(config.config, ts.sys, functionsRoot).options, noEmit: true };
const virtualFile = path.join(functionsRoot, 'src', '__emailBillingCheck.ts');
const host = ts.createCompilerHost(options);
const readSource = host.getSourceFile.bind(host);
host.getSourceFile = (name, ...args) => path.resolve(name) === virtualFile
  ? ts.createSourceFile(name, billingSource, ts.ScriptTarget.Latest, true) : readSource(name, ...args);
const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([virtualFile], options, host));
if (diagnostics.length) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
}
const compiled = ts.transpileModule(billingSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
if (compiled.diagnostics?.length) throw new Error('Isolated billing compilation failed');
fs.writeFileSync(path.join(destination, 'lib', 'billing.js'), compiled.outputText);
fs.writeFileSync(path.join(destination, 'lib', 'index.js'),
  "const admin = require('firebase-admin');\nadmin.initializeApp();\nmodule.exports = { ...require('./emailDelivery.js'), ...require('./accountEmailEvents.js'), ...require('./billing.js') };\n");
for (const name of ['emails', 'app', 'brand']) {
  fs.cpSync(path.join(root, 'functions', 'lib', name), path.join(destination, 'lib', name), { recursive: true });
}
const dependencies = require('../functions/package.json').dependencies;
fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({
  name: 'trobar-email-internal', private: true, main: 'lib/index.js', engines: { node: '22' },
  dependencies: Object.fromEntries(['firebase-admin', 'firebase-functions', 'stripe', 'resend'].map(name => [name, dependencies[name]])),
}, null, 2));
const deployed = JSON.parse(execFileSync(process.env.ComSpec, ['/d', '/s', '/c',
  'gcloud.cmd functions describe stripeWebhook --v2 --region=europe-west1 --project=trobar-1123f --format=json(serviceConfig.environmentVariables.STRIPE_PRICE_MONTHLY,serviceConfig.environmentVariables.STRIPE_PRICE_QUARTERLY,serviceConfig.environmentVariables.STRIPE_PRICE_ANNUAL)'],
{ windowsVerbatimArguments: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const prices = ['STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_QUARTERLY', 'STRIPE_PRICE_ANNUAL'].map(key => {
  const value = deployed.serviceConfig?.environmentVariables?.[key];
  if (!/^price_[A-Za-z0-9]+$/.test(value || '')) throw new Error(`Missing deployed Stripe price: ${key}`);
  return `${key}=${value}`;
});
fs.writeFileSync(path.join(destination, '.env.trobar-1123f'), [
  `EMAIL_DELIVERY_MODE=${enableTransactional ? 'transactional' : 'internal'}`, 'EMAIL_INTERNAL_RECIPIENTS=frolesti4@gmail.com',
  ...(enableTransactional ? [`EMAIL_TRANSACTIONAL_SINCE=${transactionalSince}`] : []),
  `EMAIL_PORTAL_READY=${enableInternalBilling}`, 'STRIPE_ALLOW_LIVE_BILLING=false', ...prices, '',
].join('\n'));
fs.writeFileSync(path.join(root, '.expo', 'email.firebase.json'), JSON.stringify({
  functions: [{ source: 'email-functions', codebase: 'default' }],
}, null, 2));
console.log(`Prepared isolated email exports; delivery ${enableTransactional ? 'transactional, future events only' : 'internal recipients only'}; billing emails ${enableInternalBilling ? 'enabled after portal verification' : 'gated off'}. Live billing remains disabled.`);
