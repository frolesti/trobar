const fs = require('node:fs');
const path = require('node:path');
const assumptions = require('../docs/planning/cost-assumptions.json');

function excess(quantity, included) {
  return Math.max(0, quantity - included);
}

function tieredCost(quantity, free, bands) {
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(free) || free < 0) {
    throw new Error('Quantities and allowances must be finite nonnegative numbers.');
  }
  let cost = 0;
  let start = free;
  let previous = 0;
  for (const [upper, pricePerThousand] of bands) {
    if (upper <= previous || upper < free || pricePerThousand < 0) throw new Error('Invalid price tiers.');
    cost += Math.max(0, Math.min(quantity, upper) - start) / 1000 * pricePerThousand;
    start = upper;
    previous = upper;
  }
  if (quantity > start) throw new Error('Quantity exceeds the configured pricing tiers.');
  return cost;
}

function paymentCosts(bars, config = assumptions.payment) {
  const { mix } = config;
  if (Math.abs(mix.monthly + mix.quarterly + mix.annual - 1) > 1e-9) throw new Error('Payment mix must sum to 1.');
  const gross = bars * (mix.monthly * config.monthlyGrossEur +
    mix.quarterly * config.quarterlyGrossEur / 3 + mix.annual * config.annualGrossEur / 12);
  const transactions = bars * (mix.monthly + mix.quarterly / 3 + mix.annual / 12);
  const processing = gross * config.stripeEeaPercent + transactions * config.stripeEeaFixedEur;
  const billing = gross * config.stripeBillingPercent;
  return { gross, transactions, processing, billing, total: processing + billing, grossLessFees: gross - processing - billing };
}

function easUpdateCost(recipients, gib, rate) {
  const extraUsers = excess(recipients, rate.includedUpdateMau);
  const bandwidthIncluded = rate.includedUpdateGiB + extraUsers * rate.includedMiBPerExtraMau / 1024;
  return extraUsers * rate.perUpdateMau + excess(gib, bandwidthIncluded) * rate.perUpdateGiB;
}

function estimate(mau, scenarioName, config = assumptions, prices = require('../docs/planning/cost-rates.json')) {
  const scenario = config.scenarios[scenarioName];
  if (!scenario || !Number.isInteger(mau) || mau <= 0) throw new Error('Select a known scenario and a positive integer MAU.');
  const days = config.daysPerMonth;
  const backend = config.backend;
  const accounts = mau * config.registeredAccountsPerMau;
  const catalogueBars = Math.max(config.catalogue.minimumBars, Math.ceil(mau * config.catalogue.barsPerMau));
  const premiumBars = Math.max(config.premiumBars.minimum, Math.ceil(mau * config.premiumBars.barsPerMau));
  const sessions = mau * scenario.sessionsPerMau;
  const pushRecipients = accounts * scenario.pushEventsPerMonth * scenario.pushRecipientFraction;
  const syncCalls = backend.syncCallsPerDay * days;
  const notificationCalls = backend.notificationCallsPerDay * days;
  const clientReads = sessions * (catalogueBars + scenario.additionalReadsPerSession);
  const syncReads = syncCalls * backend.syncDocumentsReadPerCall;
  const pushReads = accounts * scenario.pushEventsPerMonth * backend.pushReadsPerScannedAccount +
    pushRecipients * backend.pushAdditionalReadsPerRecipient;
  const reads = clientReads + syncReads + pushReads + notificationCalls * backend.notificationBaseReadsPerCall;
  const writes = sessions * scenario.userWritesPerSession + syncCalls * backend.syncDocumentsWrittenPerCall +
    pushRecipients * backend.pushWritesPerRecipient;
  const deletes = pushRecipients * backend.pushDeletesPerRecipient;
  const firestoreGiB = accounts * backend.firestoreGiBPerRegisteredAccount + catalogueBars * backend.firestoreGiBPerBar;
  const firestoreEgressGiB = clientReads * backend.firestoreEgressKiBPerRead / 1024 ** 2;
  const storageGiB = (accounts * backend.avatarMiBPerRegisteredAccount + premiumBars * backend.galleryMiBPerPremiumBar) / 1024;
  const storageEgressGiB = mau * scenario.storageDownloadMiBPerMau / 1024;
  const callableCalls = sessions * backend.callableCallsPerSession;
  const functionCalls = syncCalls + notificationCalls + callableCalls;
  const functionSeconds = syncCalls * backend.syncSecondsPerCall + notificationCalls * backend.notificationSecondsPerCall +
    pushRecipients * backend.pushSecondsPerRecipient + callableCalls * backend.callableSecondsPerCall;
  const marketingVisits = backend.marketingBaselineVisits + mau * scenario.marketingVisitsPerMau;
  const marketingTransferGB = marketingVisits * scenario.marketingMiBPerVisit * 1024 ** 2 / 1e9;
  const marketingRequests = marketingVisits * backend.marketingRequestsPerVisit;
  const otaRecipients = mau * scenario.otaRecipientFraction;
  const otaGiB = otaRecipients * backend.otaMiBPerRecipient / 1024;
  const usd = value => value * config.usdToEur;
  const lines = [];
  const add = (category, item, quantity, unit, costEur, status = 'tariff') => {
    if (![quantity, costEur].every(value => Number.isFinite(value) && value >= 0)) throw new Error(`Invalid output for ${item}.`);
    lines.push({ category, item, quantity, unit, costEur, status });
  };
  for (const [key, count] of Object.entries({
    dynamicMaps: sessions * scenario.webSessionFraction,
    nearby: sessions * scenario.nearbyPerSession,
    text: sessions * (scenario.textPerSession + scenario.detailsPerSession * scenario.detailsMissingPlaceIdFraction),
    details: sessions * scenario.detailsPerSession,
    photos: sessions * scenario.detailsPerSession * scenario.photoRequestsPerDetail,
  })) {
    const rate = prices.maps[key];
    add('Google Maps / Places', key, count, 'requests', usd(tieredCost(count, rate.free, rate.bands)));
  }
  add('Firebase / GCP', 'authEmailSocialStandard', mau, 'app-MAU-not-auth-MAU', 0);
  add('Firebase / GCP', 'pushTransport', pushRecipients, 'deliveries', 0);
  add('Firebase / GCP', 'firestoreReads', reads, 'documents', usd(excess(reads, prices.firestore.freeReadsPerDay * days) / 100000 * prices.firestore.readsPer100k));
  add('Firebase / GCP', 'firestoreWrites', writes, 'documents', usd(excess(writes, prices.firestore.freeWritesPerDay * days) / 100000 * prices.firestore.writesPer100k));
  add('Firebase / GCP', 'firestoreDeletes', deletes, 'documents', usd(excess(deletes, prices.firestore.freeDeletesPerDay * days) / 100000 * prices.firestore.deletesPer100k));
  add('Firebase / GCP', 'firestoreStorage', firestoreGiB, 'GiB-month', usd(excess(firestoreGiB, prices.firestore.freeGiB) * prices.firestore.storagePerGiB));
  add('Firebase / GCP', 'firestoreEgress', firestoreEgressGiB, 'GiB', usd(excess(firestoreEgressGiB, prices.firestore.freeEgressGiB) * prices.firestore.egressPerGiB), 'budget-rate');
  add('Firebase / GCP', 'photoStorage', storageGiB, 'GiB-month', usd(storageGiB * prices.storage.storagePerGiB));
  add('Firebase / GCP', 'photoEgress', storageEgressGiB, 'GiB', usd(storageEgressGiB * prices.storage.egressPerGiB), 'budget-rate');
  add('Firebase / GCP', 'storageClassA', mau * backend.storageClassAOperationsPerMau, 'operations', usd(mau * backend.storageClassAOperationsPerMau / 1000 * prices.storage.classAPer1000));
  add('Firebase / GCP', 'storageClassB', mau * backend.storageClassBOperationsPerMau, 'operations', usd(mau * backend.storageClassBOperationsPerMau / 1000 * prices.storage.classBPer1000));
  add('Firebase / GCP', 'cloudRunRequests', functionCalls, 'requests', usd(excess(functionCalls, prices.cloudRun.freeRequests) / 1e6 * prices.cloudRun.perMillionRequests));
  add('Firebase / GCP', 'cloudRunCpu', functionSeconds * backend.vcpu, 'vCPU-seconds', usd(excess(functionSeconds * backend.vcpu, prices.cloudRun.freeVcpuSeconds) * prices.cloudRun.perVcpuSecond));
  add('Firebase / GCP', 'cloudRunMemory', functionSeconds * backend.memoryGiB, 'GiB-seconds', usd(excess(functionSeconds * backend.memoryGiB, prices.cloudRun.freeGiBSeconds) * prices.cloudRun.perGiBSecond));
  add('Firebase / GCP', 'scheduler', 2, 'jobs', usd(excess(2, prices.scheduler.freeJobs) * prices.scheduler.perJob));
  add('Firebase / GCP', 'operationalReserve', 1, 'monthly-envelope', prices.operationalReserveEur, 'budget');
  add('Distribucio / serveis', 'vercelPro', 1, 'seat-month', usd(prices.vercel.proMonthly));
  const vercelUsage = excess(marketingTransferGB, prices.vercel.includedTransferGB) * prices.vercel.transferPerGB +
    excess(marketingRequests, prices.vercel.includedRequests) / 1e6 * prices.vercel.perMillionRequests;
  add('Distribucio / serveis', 'vercelUsage', marketingTransferGB, 'GB-transfer', usd(excess(vercelUsage, prices.vercel.usageCredit)), 'budget-rate');
  add('Distribucio / serveis', 'easPlan', 1, 'month', usd(prices.expo.planMonthly));
  const updateOverage = easUpdateCost(otaRecipients, otaGiB, prices.expo);
  add('Distribucio / serveis', 'easUpdateOverage', otaRecipients, 'update-MAU', usd(updateOverage));
  add('Distribucio / serveis', 'appleDeveloper', 1 / 12, 'year', usd(prices.appleAnnual / 12));
  for (const [item, amount] of Object.entries(config.fixedBudgetEur)) {
    add('Distribucio / serveis', item, 1, item.endsWith('Annual') ? 'annual-amortized' : 'month',
      item.endsWith('Annual') ? amount / 12 : amount, 'budget');
  }
  const osmBudget = config.osmBudgetEurByMau[mau];
  if (!Number.isFinite(osmBudget)) throw new Error('Add an explicit OSM budget for this MAU level before forecasting it.');
  add('Distribucio / serveis', 'osmProviderReserve', 1, 'monthly-envelope', osmBudget, 'budget');
  const categoryTotal = category => lines.filter(line => line.category === category).reduce((sum, line) => sum + line.costEur, 0);
  const maps = categoryTotal('Google Maps / Places');
  const firebase = categoryTotal('Firebase / GCP');
  const distribution = categoryTotal('Distribucio / serveis');
  const infrastructure = maps + firebase + distribution;
  const stripe = paymentCosts(premiumBars, config.payment);
  const total = infrastructure + stripe.total;
  return {
    scenario: scenarioName, mau, accounts, catalogueBars, premiumBars, sessions,
    maps, firebase, distribution, infrastructure,
    stripe: stripe.total, stripeProcessing: stripe.processing, stripeBilling: stripe.billing,
    paymentLines: [
      { category: 'Stripe', item: 'cardProcessing', quantity: stripe.transactions, unit: 'charges-amortized',
        costEur: stripe.processing, status: 'budget-rate' },
      { category: 'Stripe', item: 'subscriptionBilling', quantity: stripe.gross, unit: 'EUR-volume',
        costEur: stripe.billing, status: 'tariff' },
    ],
    total, contingency: total * config.contingencyFraction,
    recommendedBudget: total * (1 + config.contingencyFraction),
    annualRunRate: total * 12,
    stripeGross: stripe.gross,
    contributionBeforeOtherCosts: stripe.grossLessFees - infrastructure,
    costsPerMau: total / mau,
    breakEvenPremiumBars: Math.ceil(infrastructure / paymentCosts(1, config.payment).grossLessFees),
    lines,
  };
}

function csv(rows, columns) {
  const escape = value => `"${String(value).replace(/"/g, '""')}"`;
  return [columns, ...rows.map(row => columns.map(key => typeof row[key] === 'number' ? row[key].toFixed(6) : row[key]))]
    .map(row => row.map(escape).join(',')).join('\n') + '\n';
}

if (require.main === module) {
  const results = Object.keys(assumptions.scenarios).flatMap(name => assumptions.mauLevels.map(mau => estimate(mau, name)));
  if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--write')) throw new Error('Usage: node scripts\\forecastCosts.cjs [--write]');
  if (process.argv[2] === '--write') {
    const output = path.resolve(__dirname, '../docs/planning');
    const columns = ['scenario', 'mau', 'accounts', 'catalogueBars', 'premiumBars', 'sessions',
      'maps', 'firebase', 'distribution', 'infrastructure', 'stripeProcessing', 'stripeBilling', 'stripe', 'total', 'contingency',
      'recommendedBudget', 'annualRunRate', 'stripeGross', 'contributionBeforeOtherCosts', 'costsPerMau', 'breakEvenPremiumBars'];
    fs.writeFileSync(path.join(output, 'cost-forecast-summary.csv'), csv(results, columns));
    const breakdown = results.flatMap(result => [...result.lines, ...result.paymentLines]
      .map(line => ({ scenario: result.scenario, mau: result.mau, ...line })));
    fs.writeFileSync(path.join(output, 'cost-forecast-breakdown.csv'), csv(breakdown,
      ['scenario', 'mau', 'category', 'item', 'quantity', 'unit', 'costEur', 'status']));
  }
  console.table(results.map(({ scenario, mau, maps, firebase, distribution, stripe, total, recommendedBudget }) =>
    Object.fromEntries(Object.entries({ scenario, mau, maps, firebase, distribution, stripe, total, recommendedBudget })
      .map(([key, value]) => [key, typeof value === 'number' && key !== 'mau' ? value.toFixed(2) : value]))));
}

module.exports = { excess, tieredCost, paymentCosts, easUpdateCost, estimate, csv };
