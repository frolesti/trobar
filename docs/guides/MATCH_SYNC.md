# Match synchronization

`scheduledMatchSync` runs in europe-west1 every 15 minutes, independently of
mobile clients and developer machines. It uses Admin SDK transactions and
the existing `system/id_mappings` to preserve match references and broadcasts.
The old development-only updater is disabled to prevent competing writers.

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
node --test functions/test/matchSync.test.cjs
node scripts/prepareMatchSyncDeploy.cjs
npm --prefix .expo/match-sync-functions install --ignore-scripts
npx firebase-tools deploy --config .expo/match-sync.firebase.json --only functions:match-sync --project trobar-1123f --non-interactive
```

The original deployment was blocked by unrelated Stripe secrets. The Scheduler
now has its own entry point and codebase, built from the same matchSync module,
without importing billing handlers. The prepare script generates the isolated
deployment package/config under .expo. No Stripe secret was changed or faked.

Deployed successfully on 2026-10-16. Scheduler job is ENABLED, every 15 minutes.
A real invocation returned HTTP 200; system/sync_status recorded 307 fixtures,
no failed sources and no pending results in the recent 60-day check. Firestore
matches 464 and 465 now contain finished scores 3-0 and 1-4, respectively.

After deployment verify the Cloud Scheduler job is enabled and use **Run now**
in Google Cloud Scheduler. Read function logs and `system/sync_status`:

- `lastAttempt` records successful or partially failed attempts.
- `lastUpdated` advances only when every configured source succeeded.
- `failedSources` identifies provider failures, which also fail the invocation
  so Scheduler retries with backoff.
- `pendingResultIds` identifies recent past fixtures still missing scores.

Configure a Cloud Monitoring alert on function errors and on absence of
successful executions for 45 minutes. A deployment alone is not proof that
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
clock when kickoff is unconfirmed. Current calendar feeds expose no stages
(230 women's events and 31 men's Copa events checked). Men's Champions stages
are available from football-data.org. Calendar phases are not inferred from
fixture dates: historical gaps can be recovered from ESPN's explicit round
metadata with the following one-off tool, authenticated through gcloud:

```powershell
node scripts/recoverMatchStages.cjs
node scripts/recoverMatchStages.cjs --apply
```

The first command previews changes without writing. The second updates only
stage and its provenance, matching competition, UTC day and both home/away
teams. Existing phases, duplicate documents and ambiguous or unmatched fixtures
are left untouched. Firestore update-time preconditions prevent overwriting a
document changed since the initial read. On 2026-10-23, 77 historical fixtures
were updated with verified phases; scores, dates and references were unchanged.
This is a historical backfill, not a new scheduled source or complete coverage.

A missing score never erases a confirmed final result. Zero is a valid score.
Past calendar dates alone are not evidence a fixture finished. Incomplete
results stay pending, not invented. Independent sources continue if another
source fails. Transactions prevent duplicate ordinal IDs on retries, and a
short Firestore lease prevents overlapping scheduled invocations.

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