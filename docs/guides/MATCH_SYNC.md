# Match synchronization

`scheduledMatchSync` refreshes the full catalogue daily at **05:15 Europe/Madrid**
in europe-west1, independently of mobile clients and developer machines.
It uses Admin SDK transactions and
the existing `system/id_mappings` to preserve match references and broadcasts.
The old development-only updater is disabled to prevent competing writers.

`scheduledLiveMatchSync` checks Firestore **once per minute** for confirmed
Barcelona kickoffs between now minus four hours and now. Finished, postponed,
duplicate, unconfirmed-time and non-Barcelona records are excluded. When idle,
it makes **zero provider requests and zero writes**; the indexed query and
function invocation still have usage. It does not scan the full catalogue.
Cloud Scheduler has one-minute granularity, so there is no 30-second sleep loop.

During that window, requests are grouped by competition and UTC day. ESPN
scoreboards cover both leagues, both Champions competitions, both national cups
and men's Supercopa. Women's Supercopa uses the existing calendar: it can
publish final scores, but is **not a guaranteed live score feed**. Other provider
updates can also arrive late; minute polling does not guarantee minute-fresh data.
Unchanged scores do not write matches or notify clients. No provider data is
fabricated, and failures fail the invocation and are logged.

The minute job attempts an additional full refresh when it first confirms a
final result, to discover newly published knockout pairings. The daily refresh
remains the safety net for later calendar changes. Full refreshes share the
existing lease. Transactions protect concurrent kickoff edits and confirmed
results from stale live responses.

## Avoiding unchanged writes

The synchronizer compares provider fields with stored values before writing.
An identical match does not advance `updatedAt`, so realtime clients are not
notified just because the scheduled job ran. Timestamp comparison is by value;
extra stored fields are preserved. Real scores, phases and schedule changes
still persist, and confirmed results retain their existing protections.

Club/competition metadata is read transactionally, deduplicated within each
batch and written only when changed or missing. This adds comparison reads
but avoids unconditional writes. ID mappings, duplicate reconciliation and
crest caches also skip identical writes. Missing metadata is still repaired
even if its matches have not changed.

Regression tests assert that a warmed, unchanged run performs only three
`system/sync_status` writes (lease, health and release), with zero catalogue,
mapping or crest-cache writes. This is a controlled test, not a promise that
every production run has no changed fixtures.

Deployed to `scheduledMatchSync` only on 2026-11-03. Two real executions
completed successfully with 308 source fixtures, no failed sources and zero
pending results. Between those executions, all 698 inspected match, club,
competition, mapping and crest-cache documents retained their update times.
No catalogue documents were deleted. Those measurements preceded the cadence
change. Both daily and minute-gated jobs were subsequently deployed and verified
ENABLED on 2026-11-03; the idle live job logged no active match and returned
HTTP 200. Other functions and the unrelated VM were not changed.
The manually triggered daily run also completed at 14:26 UTC with fresh
`lastUpdated`, no failed sources, no pending results and its lease released.

## Supercopa de Espana 2027

The official RFEF schedule is available at
https://rfef.es/es/noticias/definida-la-hoja-de-ruta-de-la-supercopa-2027-que-se-celebrara-en-estambul
(published 17 September 2026).

- FC Barcelona - Club Atletico de Madrid: 2 February 2027, 20:00 Europe/Madrid.
- Final: 6 February, 20:00; add it only if Barcelona qualifies and the opponent is confirmed.

Only FC Barcelona fixtures belong in Trobar, for both men's and women's teams.
`supercopa.ts` contains the verified Barcelona semifinal, explicit phase, UTC kickoff
and RFEF provenance. The source only creates missing catalogue records: it never
reverts a stored score, live status or later schedule correction. It is not a
live results feed. The normal providers remain responsible for updates they
cover; otherwise results require a verified source update.

The app has a separate Supercopa filter for both categories; it does not reuse
the Copa del Rey logo for this competition. Barcelona's fixtures are available
through this filter even when it is outside the first page of upcoming games.

To preview, then explicitly import using the current gcloud login:

```powershell
npm --prefix functions run build
node --test functions\test\supercopa.test.cjs
node scripts\importSupercopa.cjs
node scripts\importSupercopa.cjs --apply
```

The importer reuses the same transactional ID allocation as scheduled ingestion,
preserves club IDs, is idempotent and reads back the catalogue record to verify
their competition, phase and kickoff. `--apply` is required for writes.
The deployment prepare script includes `supercopa.js`; deploying the updated
scheduler is separate from running this bounded catalogue import.

The bounded import was applied and read back successfully: catalogue ID
`559` (Barcelona - Atletico). The earlier import also created `560`
(Real Sociedad - Real Madrid), incorrectly. All app match-service surfaces now
exclude non-Barcelona records, including this one, and scheduled ingestion
filters providers before enrichment and rejects non-Barcelona persistence.
The historical record has not been deleted or falsely marked as a duplicate.
The initial bounded import did not redeploy the scheduler. Its source is now
included in the efficiency deployment documented above.

## Configuration

Secret Manager secret `MATCH_SYNC_CONFIG` is JSON with these properties:

- `footballDataApiKey`: football-data.org token for FC Barcelona men.
- `womenCalendarUrl`: existing women's ICS feed URL.
- `menCalendarUrl`: existing men's ICS feed URL, Copa events only.
- `apiFootballKey`: optional API-Sports key with access to current seasons
  for women's scores absent from the calendar. Free plans may not cover them.

Never place these secrets in EXPO_PUBLIC variables or commit them.
The initial secret was configured in project `trobar-1123f` during this fix.

## Deployment

```powershell
npm --prefix functions run build
node --test functions\test\liveMatchSync.test.cjs functions\test\matchSync.test.cjs functions\test\cupData.test.cjs functions\test\stageData.test.cjs functions\test\supercopa.test.cjs
node scripts\prepareMatchSyncDeploy.cjs
# Install deployment dependencies only if they are missing.
npx firebase-tools deploy --config .expo\match-sync.firebase.json --only functions:match-sync --project trobar-1123f --non-interactive
```

The original deployment was blocked by unrelated Stripe secrets. The Scheduler
now has its own entry point and codebase, built from the same matchSync module,
without importing billing handlers. The prepare script generates the isolated
deployment package/config under .expo. No Stripe secret was changed or faked.

Originally deployed on 2026-10-16, then running every 15 minutes.
A real invocation returned HTTP 200; system/sync_status recorded 307 fixtures,
no failed sources and no pending results in the recent 60-day check. Firestore
matches 464 and 465 now contain finished scores 3-0 and 1-4, respectively.

After deployment verify both Cloud Scheduler jobs are enabled:
`firebase-schedule-scheduledMatchSync-europe-west1` (`15 5 * * *`,
Europe/Madrid) and `firebase-schedule-scheduledLiveMatchSync-europe-west1`
(`every 1 minutes`, UTC). Use **Run now** for each. Read function logs,
`system/sync_status`, and, for active live runs, `system/live_sync_status`:

- `lastAttempt` records successful or partially failed attempts.
- `lastUpdated` advances only when every configured source succeeded.
- `failedSources` identifies provider failures, which also fail the invocation.
  The daily job retries with backoff; the minute job has no automatic retries
  and checks again on its next scheduled tick.
- `pendingResultIds` identifies recent past fixtures still missing scores.

The live health record lists active matches, updates, finals and failed sources;
idle ticks intentionally leave it untouched, so it is not an idle heartbeat.
Configure a Cloud Monitoring alert on function errors and on absence of
successful daily executions for 26 hours. Use invocation logs for the minute
job, not freshness of the active-only health record. A deployment alone is not proof that
the provider supports all competitions or that a Scheduler run succeeded.

## Result integrity

All competitions now use stable fixture identity from category, competition,
UTC day and normalized home/away names, including FC Barcelona/Barcelona
aliases. Each scheduled run reconciles existing documents without deleting
them, preserves ordinal references and marks redundant records with duplicateOf.
The 2026-10-20 production audit found six women's Champions duplicate pairs;
after deployment and reconciliation, all seven competitions had zero active
duplicate groups, zero conflicting-score groups and no malformed active records.
Run `node scripts/auditMatchData.cjs` for a read-only audit using gcloud login.

Stage, group, round and explicit kickoff confirmation are preserved from
providers. MatchCard translates supported phases into Catalan and omits the
clock when kickoff is unconfirmed. The inspected calendar feeds exposed no
stages (230 women's events and 31 men's Copa events checked). Men's Champions
stages are available from football-data.org. `stageData.ts` now normalizes
explicit provider phases for both Champions competitions and both Spanish
cups. Scheduled ingestion supplements missing phases from ESPN, including
future fixtures, grouped by competition and UTC year. Cup enrichment/history
imports use the same phase normalizer. Stage-source failures are reported in
`failedSources` with a `-stages` suffix; other ingestion continues.

No phase is inferred from dates, opponents or results. Supported source labels
include legacy `quarter-finals` / `semi-finals`, round-of-32/16, group/league
phases, playoffs and named first/second/third/fourth rounds. A named fourth
round remains `FOURTH_ROUND`, rather than assuming a bracket size from a date.
Team aliases are explicit, and matching still requires the source competition,
UTC day and ordered home/away teams. Ambiguous events never supply a stage.

The read-only recovery tool audits **all active scoped fixtures**, including
existing and future phases, rather than silently ignoring unmatched records.
Build before running it, using existing gcloud authentication:

```powershell
npm --prefix functions run build
node scripts\recoverMatchStages.cjs
# Optional: persist the full preview in an existing local directory.
node scripts\recoverMatchStages.cjs --report .local\match-stages-preview.json
# Only after explicit approval of that preview:
node scripts\recoverMatchStages.cjs --apply
```

Without `--apply` it never writes to Firestore. The report includes total
scope, missing phases, every verified fixture/source event, exact proposed
updates with previous values, and unresolved IDs with reasons. An explicit,
unique source phase can correct a conflicting stored stage; already canonical,
matching phases need no update. Duplicate documents remain untouched.
`--apply` updates only stage and its provenance. Firestore update-time
preconditions prevent overwriting a document changed since the initial read.
On 2026-10-23, 77 historical fixtures were updated with verified phases.

The 2026-10-29 preview checked 156 active scoped documents:
20 men's Champions, 50 women's Champions, 67 Copa del Rey and 19 Copa de la
Reina. It verified all 156 phases, proposed filling 56 missing stages (4 men's
Champions, 23 women's Champions, 29 men's Copa), and reported **zero unresolved
fixtures and zero conflicting existing phases**. All 15 recently recovered
women's cup fixtures (IDs 544–558) already had the correct explicit stage.
After explicit user authorization, the narrowly scoped recovery applied all
56 stage/provenance patches with zero update-time conflicts. A fresh read-only
audit then verified **156/156**, **zero missing stages**, **zero unresolved
fixtures**, and **zero proposed updates**. No fixture IDs, scores, timestamps,
or other match data were changed or deleted. No function was deployed as part
of this phase recovery; the scheduled enrichment changes still require a
separately approved deployment.

ESPN yearly scoreboards supplied 154 verifications. Its 2017 UWCL coverage
omits the Avaldsnes tie; the importer fetches official UEFA match IDs
[2023207](https://match.uefa.com/v5/matches/2023207) and
[2023223](https://match.uefa.com/v5/matches/2023223) and reads
`round.metaData.name` (`Round of 32`). These are source identifiers, not
hard-coded phases. The source competition and ordered fixture identity are
still checked. Their official kickoff times differ from stored calendar times;
recovery changes no timestamps or results.

A missing score never erases a confirmed final result. Zero is a valid score.
Past calendar dates alone are not evidence a fixture finished. Incomplete
results stay pending, not invented. Independent sources continue if another
source fails. Transactions prevent duplicate ordinal IDs on retries, and a
short Firestore lease prevents overlapping scheduled invocations.

### Cup crests and women's cup scores

The scheduled calendar path now supplements Copa del Rey / Copa de la Reina
fixtures from ESPN's public yearly scoreboards, without an API-Sports key.
It matches the competition, UTC day and both teams (including explicit
Albacete Balompie/Albacete and CD Guadalajara/Guadalajara aliases).
Ambiguous or unmatched events are skipped. Only completed events with two
valid non-negative integer scores supply results; confirmed scores and
existing badges are not replaced. Resolved crests are cached in the existing
`system/men_team_crests` and `system/women_team_crests` documents. Provider
errors are recorded in `failedSources` as `men-calendar-cups` or
`women-calendar-cups`, while calendar persistence still proceeds.
ESPN's CD Guadalajara record (Spanish club ID 11484) has an empty logo.
For that exact source, ID and name only, the importer uses the PNG published
on the [club's official crest page](https://www.cdguadalajara.es/escudo-c-d-guadalajara/).

The retired `scripts/updateMatches.js` has not been re-enabled: its static
fallback names and historical API-Sports Liga F/UWCL queries cannot repair
current cup coverage. The scheduled deployment package must include the new
`cupData.js` and `stageData.js` modules; `prepareMatchSyncDeploy.cjs` includes both.

For existing records, build first and preview the narrowly scoped recovery:

```powershell
npm --prefix functions run build
node --test functions\test\matchSync.test.cjs functions\test\cupData.test.cjs tests\testRecoverCupData.cjs
node scripts\recoverCupData.cjs
```

The preview uses existing gcloud authentication, writes nothing, and lists
exact fields and ESPN event IDs. Only after approving its output, use
`node scripts\recoverCupData.cjs --apply`. The recovery updates missing
embedded match badges and incomplete women's cup results only, using
Firestore update-time preconditions. It never creates fixtures, replaces a
confirmed result, changes IDs, or edits duplicate documents. A second preview
should report zero proposed updates. It does not update standalone team
documents; the next scheduled ingestion synchronizes those from its crest
cache/provider.

The read-only 2026-10-28 audit found two missing men's badges:
match 285 (Albacete Balompie) and 419 (CD Guadalajara). All four stored
women's cup fixtures already had finished scores (4–1, 0–0, 0–4, 1–6);
this is not evidence that the stored fixture list covers every later round.

### Missing women's cup history: verified recovery on 2026-10-28

The production women's fixtur.es feed returned HTTP 200 and 230 events, but
all were Liga F (183) or UWCL (47): there were **zero cup events or cup
summary tags**. The production config also had no API-Sports key. Successful
calendar synchronization therefore did not establish women's cup coverage.
The four existing cup records were earlier ESPN imports, not calendar events:

| Match ID | UTC date | Fixture | Score | ESPN event |
| --- | --- | --- | --- | --- |
| 365 | 2025-12-21 | Alavés – Barcelona | 1–6 | 761031 |
| 364 | 2026-02-05 | Real Madrid – Barcelona | 0–4 | 401846984 |
| 363 | 2026-03-12 | FC Badalona – Barcelona | 0–0 | 401859859 |
| 362 | 2026-03-18 | Barcelona – FC Badalona | 4–1 | 401859860 |

These match ESPN by women's cup competition, UTC day, home/away teams and
both scores. Historical scoreboards exposed 16 absent completed Barcelona
fixtures during 2022–2026, not score fields missing from those four documents.
One must not be copied as reported: ESPN event 658106 still shows the
on-field Osasuna 0–9 Barcelona result from 2023, although Barça were later
disqualified for fielding an ineligible player. The history tool explicitly
excludes that event rather than inventing or choosing an administrative score.

After authorization, `recoverWomenCupHistory.cjs --apply` created 15 verified
fixtures as matches **544–558**, two previously absent team documents
**125–126**, and updated only `system/id_mappings` for the new references.
The two badge-only corrections to matches **285** and **419** were also
applied. No existing women's result was rewritten and no function was deployed.
New fixtures store the provider event ID/link, explicit source stage, and
recovery time. The commit reserves ordinal IDs atomically, guards the mapping
with its read update-time, and requires every new match/team document not to
exist. A repeated history preview proposes no additions.

```powershell
npm --prefix functions run build
node --test functions\test\cupData.test.cjs functions\test\matchSync.test.cjs tests\testRecoverCupData.cjs tests\testRecoverWomenCupHistory.cjs
node scripts\recoverWomenCupHistory.cjs
# Only after approving its exact preview:
node scripts\recoverWomenCupHistory.cjs --apply
node scripts\recoverWomenCupHistory.cjs
node scripts\recoverCupData.cjs
```

Sources: [ESPN women's cup 2022 scoreboard](https://site.api.espn.com/apis/site/v2/sports/soccer/esp.copa_de_la_reina/scoreboard?dates=2022&limit=1000)
(also queried with years 2023, 2024, 2025 and 2026).
Official club reports independently confirm the finals in
[2024 (8–0)](https://www.fcbarcelona.com/en/football/womens-football/news/4019679/barca-8-0-real-sociedad-cup-winners),
[2025 (2–0)](https://www.fcbarcelona.com/en/football/womens-football/news/4280451/barca-2-0-atletico-madrid-pina-wins-the-crown-for-the-queens-of-the-cup)
and [2026 (3–1)](https://www.fcbarcelona.com/en/football/womens-football/news/4504620/fc-barcelona-3-1-atletico-madrid-cup-winners).

**Coverage limits:** ESPN queries for 2017–2021 returned no completed Barcelona
cup records; that is a provider-coverage gap, not proof no fixtures existed.
Those years and the annulled 2023 event remain outside this recovery. The
calendar supplement only enriches fixtures supplied to it; it does not create
cup fixtures omitted by the calendar. This historical tool is not an ongoing
women's cup fixture source, and future cup coverage still requires one.

The app subscribes to loaded match documents so new scores arrive without
restarting it. Removed the one-hour in-memory match cache and the screen's
forced scheduled status. Navigation uses exact selected bar coordinates.

## Checks

```powershell
node --test tests/testOsmService.cjs
node --test tests/testBarNavigation.cjs
node --test tests/testMatchService.cjs
node --test tests/testMatchCard.cjs
node --test tests/testMapMatchFilter.cjs tests/testMatchesScreen.cjs tests/testRecoverMatchStages.cjs
node --test functions/test/matchSync.test.cjs
```

OSM searches reject viewports wider or taller than 10 km before requesting,
share concurrent identical requests, retry independent global mirrors, reject
partial provider responses, and back off for 30 seconds after total failure.
Registered bars and previous scanned results remain available on failure.
Overpass is a public best-effort service, not an uptime-guaranteed backend.

The verified Kumi failure was HTTP 429 with a message requiring a meaningful
User-Agent. The exact same Barcelona POST with
`Trobar/1.0 (bar discovery application)` returned HTTP 200 and 46 elements.
Native requests now include that identity. Browsers control their own
User-Agent; the native transport still needs a physical-device acceptance test.
The Germany endpoint returned HTTP 406 in this environment and is no longer
used. The fallback provider can also be unavailable; this is a handled error,
not evidence there are no bars nearby.

Subsequent requests reproduced HTTP 500 / HTML from both Kumi and
private.coffee, including the native User-Agent. The header is not an uptime
fix. A complete service call at 41.381197, 2.15061 returned these two errors,
then HTTP 200 / 20 places from Google Places Nearby. Failed OSM mirrors are
skipped for 30 seconds, including when another mirror succeeds.

The Google list fallback was removed: it changed the requested map workflow.
After Overpass unavailability, discovery now uses the OSM read map API and
feeds the existing scanned-pin path, including the report-bar interaction.
Its bbox is capped at 0.01 degrees per dimension, centered on the visible
area (about 800 x 1100 m in Barcelona). It does not cover the entire viewport
when zoomed out. Cache lasts one hour and identical concurrent requests share
one download. Nodes and ways with named hospitality amenities are mapped;
way coordinates are calculated from their nodes. Google Places is not called.
The actual service returned 138 locals at 41.381197, 2.15061 after both
Overpass mirrors returned 500. The response was about 6.9 MB: this remains a
bounded, manual, best-effort fallback, not an uptime-guaranteed POI backend.

Competition filters now come from Firestore competitions, not only the
currently loaded fixtures. Selecting one queries its league IDs directly.
Verified the actual service reads 202 Copa del Rey documents, all with valid
dates; the latest is 2026-03-03. The current men's calendar contains 31 Copa
events, all past. This does not establish future fixtures absent from a source.

AppIcon no longer tints multicolor PNGs automatically. MatchCard uses local
competition logos and expo-image for remote crests, including SVG, with an
error fallback. iOS export and browser checks do not replace an Expo Go
acceptance test on the physical iPhone.

Browser QA rendered the actual MatchCard in normal and compact variants at
desktop and mobile sizes. All nine preview images loaded (Copa logo and SVG
team crests). Find-bars and dismiss actions passed. The check caught nested
HTML buttons; the compact filter action now wraps only the teams area, leaving
dismiss independent. The temporary preview entry was removed after checking.

The condensed card now shows the competition logo once, between the two goals,
without repeating the competition name in text. The metadata row is 32px
instead of 60px; the normal teams section is 96px instead of 124px. Upcoming
fixtures show kickoff below the logo, without the redundant local-time caption.
The automated render regression checks goal/logo/goal order and no duplicate
competition text. Browser image loading and all three card actions passed;
the mobile preview had no horizontal overflow. Actual map discovery was also
exercised in the browser: Overpass failed, OSM fallback completed, the control
changed to hide-unconfirmed-bars, and gray marker clusters appeared on-map.

Bars without valid stored coordinates are excluded rather than assigned the
old fictitious central-Barcelona point. Their source documents need correction;
the client must not invent destinations to keep them visible.

At diagnosis, football-data.org returned final scores 3-0 for fixture 564700
and 1-4 for fixture 575344, while Firestore still stored scheduled/null.
These documents were subsequently updated by the deployed synchronizer,
not by one-off manual score edits.