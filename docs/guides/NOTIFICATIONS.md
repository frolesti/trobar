# Backend Notifications

## Status And Integration

Client and backend infrastructure are integrated locally. **The backend, rules and indexes are not deployed, and remote delivery is not production-ready until the security and device gates below are completed.** No credentials were read or changed. No notifications were sent to production users.

The client now requests permission only after an explicit settings action, schedules a local test, registers private Expo tokens in a physical-device build, refreshes existing permission on login/foreground, and removes the current device before logout. Expo Go never requests a remote push token. Nearby consent is stored in a private subdocument, not in the readable user profile. Settings persist all four preferences and offer a default map app drawn only from installed native handlers.

`functions/src/notificationDelivery.ts` contains pure eligibility and an injectable Expo delivery engine. `functions/src/notificationFunctions.ts` guards Firebase Admin initialization and exposes these independent entry-point exports:

| Export | Source |
| --- | --- |
| `scheduledNotificationReminders` | Every five minutes; reminder discovery, queued fan-out, retry and receipt maintenance |
| `notificationMatchUpdated` | Updates to `matches/{matchId}` |
| `notificationBarUpdated` | Writes to `bars/{barId}`, including newly verified creation |
| `notificationPromotionPublished` | Creation or draft-to-published writes to `bars/{barId}/promotions/{promotionId}` |

`scripts/prepareNotificationsDeploy.cjs` prepares a dedicated `notifications` codebase under `.expo`, without importing Stripe. Do not add exports to the match-sync entry: `scheduledMatchSync.ts` is a separate deployed codebase. Merely compiling or preparing these files does not activate these exports. Deployment is intentionally gated on the security items below.

Triggers enqueue durable jobs, not unbounded immediate recipient scans. The five-minute scheduler advances those jobs and performs maintenance. This introduces up to a scheduling interval of additional delay, plus queue backlog and provider latency.

## Data Contracts

### Preferences

Read `users/{uid}.preferences.notifications`:

| Key | Default | Eligibility |
| --- | --- | --- |
| `matchReminder` | `60` | Exactly `0`, `30`, `60`, `120`; zero disables; malformed explicit values disable |
| `liveResults` | `true` | Explicit false disables; malformed explicit values disable |
| `newBarNearby` | `false` | Requires literal true |
| `barPromotions` | `false` | Requires literal true |

Missing fields retain individual defaults. Match reminders and results honor `preferences.display.defaultCategory` (`all`, `masculino`, `femenino`). Nearby radius comes from `preferences.display.searchRadius`: `500`, `1000`, `2000`, `5000` metres, default `2000`; unsupported values fail closed. Favorite-team or followed-bar targeting is not inferred.

### Devices And Consent

Store native installations at `users/{uid}/pushDevices/{sha256ExpoToken}`:

```text
token: ExpoPushToken[...] or ExponentPushToken[...]
platform: ios | android
updatedAt: Firestore Timestamp
```

Obtain an **Expo push token**, scoped to the correct EAS project, using `getExpoPushTokenAsync({ projectId })`. A raw APNs token from `getDevicePushTokenAsync` is not an FCM registration token and must never be routed through Firebase Messaging. This backend sends only via `https://exp.host/--/api/v2/push/send` and polls `https://exp.host/--/api/v2/push/getReceipts`.

Refresh the installation document after registration/token rotation; delete it on logout or revocation. Read at most 300 token documents per user in document-ID order, validate native platform/token/timestamp, and deduplicate equal tokens within that user. Invalid documents within the cap are skipped, not replaced by an unbounded scan. Cross-account stale registrations must be removed by the client. Tokens are never written into the delivery ledger or logged.

Nearby notifications additionally require `users/{uid}/notificationPrivate/area`:

```text
{
  latitude: number,
  longitude: number,
  consent: "foreground",
  updatedAt: Firestore Timestamp
}
```

Settings save this only after explicit foreground permission when enabling nearby bars or promotions. It is never inferred from IP, map centre, background tracking, favorites or a default city. Coordinates must be finite and in range; consent time must be no more than 30 days old and not in the future. Disabling both nearby switches removes the document. After moving to a different area, re-enable a nearby switch to refresh the saved zone. Distance is great-circle distance. Location and eligibility are reread during fan-out and before every send batch. Owner-only rules are included locally; other authenticated users cannot read this subdocument.

### Matches

Use the actual stored `timestamp` field (Firestore Timestamp), not the client-facing `date` property. Require `timeConfirmed === true`; older fixtures without an explicitly confirmed time are intentionally excluded. The parent must audit source writers before enabling this feature, not blindly set that flag on imported dates.

Reminders require `status === 'scheduled'`, no `duplicateOf`, `cancelled`, or `deleted`, and a future kickoff. For each user's chosen lead, the only allowed interval is `[kickoff - lead, kickoff - lead + 5 minutes)`. Missed windows are skipped, never backfilled. Event identity includes match ID, kickoff and lead. Changed preferences are reread and checked against the job's original lead and kickoff.

Results require nonnegative integer scores and either a score increase while live or a transition into finished, including an unchanged final score. Decreases and corrections to already-finished matches do not send. The previous document must have a recognized status and the same kickoff. The kickoff must be between now and four hours ago; updates older than 15 minutes are discarded. Duplicates, cancellation, future fixtures, unknown times, date corrections and historical imports are excluded. Results jobs expire 15 minutes after the source write; the current match must still have the event's scores at send time. Rapid score changes may suppress superseded results. Score/status-based identities suppress repeated imports.

The current result source runs **every 15 minutes**, and may not expose intermediate goals at all. These notifications are not an instant goal feed. A low-latency live provider plus a separately designed ingestion/rate-limiting policy is required for that goal.

### Newly Verified Bars And Promotions

The paid-owner gate is `source === 'verified'`, nonempty `ownerId`, `tier === 'premium'`, not deleted, and valid coordinates in either `location.{latitude,longitude}` or flat `latitude`/`longitude` fields. It assumes trusted billing/verification writers maintain these fields; this is not a Stripe lookup or independent proof of payment.

A new-bar event requires a transition from unverified/unowned to this gate, with finite `verifiedAt` not in the future and at most 15 minutes old. Ordinary edits and an already-verified free-to-premium upgrade do not generate a new-bar alert. The verification time is rechecked before delivery. Jobs expire after 24 hours.

**The current bar feed writes `bars/{barId}/posts`, and the current profile has `promotionalText`. Neither sends notifications.** The new, explicit promotion contract is:

```text
bars/{barId}/promotions/{promotionId}
  status: "draft" | "published"
  title: nonblank string, at most 120 characters
  body: nonblank string, at most 1000 characters
  expiresAt: Firestore Timestamp, required and in the future
```

Published creation or a transition into published can enqueue once per promotion ID; published edits and republishing the same ID do not repeat notifications. Title/body must still match at send time, and expiry/unpublication or loss of the paid gate stops delivery. The notification deadline is the earlier of expiry and 24 hours after publication. Use a new ID for a genuinely new campaign, subject to trusted-writer authorization and campaign abuse controls.

Recipients are **nearby, explicitly opted-in users only**, not followers. There is no verified persisted `users.favoriteBars` contract in the inspected user model, and subscription behavior is not inferred from comments on the existing posts service. A future follower feature needs its own consent and authorization design.

## Delivery And Failure Semantics

`notificationJobs/{sha256(eventKey)}` retains an ID-ordered user cursor and a transaction lease. Each scheduler run takes at most 10 jobs and two pages of 100 users per job. All recipients are paginated without loading the user collection into memory. Expired jobs stop even if the cursor is unfinished. Reminders scan at most two pages of 100 matches per lead; hitting that cap emits a non-sensitive warning and may skip excess fixtures. Jobs continue from saved cursors on later ticks, but short-lived reminders/results may expire before full coverage. This is bounded best-effort fan-out, not guaranteed delivery to every user at arbitrary scale. Measure backlog and shard/queue workers before increasing volume.

Per-user state lives at `users/{uid}/notificationDeliveries/{sha256(eventKey)}`. Transactional ten-minute leases fence concurrent workers and prevent ordinary duplicate event delivery. Before each HTTP request, the hashed token items are durably marked `sending`. Each request has at most 100 messages and a 15-second timeout; payload TTL never exceeds event expiry. Preferences, source eligibility and current token registrations are checked before each chunk. A consent/token change after that check cannot retract a request already in flight.

Accepted tickets are persisted and polled after 15 minutes, including after message expiry. Missing receipts are retried at 15-minute intervals until 24 hours after acceptance, then marked unknown. Poll requests are also capped at 100 IDs. Tickets and receipts with `DeviceNotRegistered` delete only the installation whose current token hash still matches, protecting rotated registrations. Other permanent errors fail without retry. Receipt errors never resend accepted messages.

Only explicit HTTP 429 or ticket `MessageRateExceeded` causes a resend, at most three attempts, no sooner than one minute apart (in practice the next scheduler tick). Network timeouts, malformed tickets, 5xx responses and abandoned `sending` items are **unknown**, not blindly resent, because Expo may already have accepted them. A crash after send but before persisting its ticket may lose receipt tracking and delivery may be lost. A crash after claiming may also leave conservative unknown work. This design deliberately favors avoiding duplicate pushes over filling uncertain gaps. **It does not promise exactly once**, or device presentation even after Expo/APNs/FCM acceptance.

Maintenance selects at most 100 retry ledgers and 100 receipt ledgers per scheduler tick. Opt-outs/expired retries are removed from the retry queue. Queue progress is durable, but prolonged failures/backlogs still need monitoring. Exceptions are generic; do not add logging of token documents, HTTP bodies, user locations, credentials or raw provider errors.

## Parent Integration And Production Gates

- Dedicated entry preparation is available: run `npm --prefix functions run build`, then `node scripts/prepareNotificationsDeploy.cjs`. Do not deploy before the remaining gates pass.
- Harden rules/trusted writes first: the inspected existing bar rule allows any authenticated user to write bar fields. `ownerId`, `source`, `tier`, `verifiedAt` must be server-controlled, or the owner-paid gate is forgeable. Authorize promotion publishing to the verified owner with server-controlled payment checks and abuse/rate controls. Functions use Admin and bypass rules.
- Local rules include owner-only token and private-location subcollections with token/platform/timestamp and coordinate validation. Delivery ledgers and jobs remain denied to clients. Deploy and test these rules in staging before using a remote token. Never move private location into the generally readable user document.
- The required collection-group **single-field ascending indexes** on `notificationDeliveries.retryAt` and `notificationDeliveries.receiptAt` are declared in `firebase/firestore/firestore.indexes.json`, but not deployed. Standard collection-scope single-field indexes cover jobs `runAt` and matches `timestamp`. Confirm queries in staging.
- Configure optional Firestore TTL on `cleanupAt` for jobs and delivery ledgers (30 days). TTL deletion ends the dedup retention guarantee; replay within eligibility windows remains suppressed while records exist. Restrict any administrative replay tooling.
- Confirmed match times, explicit promotion publishing and device delivery need staging acceptance. The existing `promotionalText` editor does not publish notification campaigns. Promotion documents remain Admin-only until an authorized, rate-limited publisher is supplied; do not expose a client write rule as a shortcut.
- Run Firestore emulator integration/load tests for real transactions, cursors, leases, indexes, IAM, trigger retry and expiry/backlog behavior before production. Unit tests mock the database adapter and do not prove cloud delivery or security rules.

## SDK 57 Device Testing And Credentials

Use an Expo SDK 57 **development build on a physical iPhone/Android device** to validate remote push. Compatible notification/device/constants packages and the plugin are installed/configured. Expo Go can test local notifications, but a local notification does not prove remote delivery. Android Expo Go has no remote-push support from SDK 53 onward; this client intentionally uses an own-build policy on both platforms.

For an Expo Go local smoke test, open **Perfil > Configuracio > Provar notificacio**, allow notifications and expect the test after five seconds. Repeat while the app is backgrounded. This does not require backend deployment or register a token, and does not exercise APNs/FCM. Focus/Do Not Disturb settings can suppress presentation.

For the physical iPhone build, use `npx eas-cli build --platform ios --profile development-device`, then `npx expo start --dev-client`. The old `development` profile targets a simulator; the new profile explicitly targets a physical device. Device registration, Apple signing and credentials must be handled directly in EAS, never pasted into chat. Android can use `--platform android --profile development` and requires a rebuilt native application.

Map app checks use `comgooglemaps`, `maps` and `waze` URL schemes; Android also declares `google.navigation`. The project declares native queries, but cannot change Expo Go's installed manifest. Expo Go may therefore omit an installed app that its host does not allow querying. Verify Google-only, Apple-only, Waze, preference reset and uninstall scenarios in an own build. Native navigation never falls back to Safari; browser navigation still opens web Google Maps.

Remote delivery needs the correct EAS project ID and bundle/package identifiers, iOS APNs credentials/provisioning and Android FCM v1 service-account credentials configured in EAS, plus notification capabilities/channels. Manage those through the secure credential workflow, not source files or chat. If Expo push access-token protection is enabled, the sender requires secret-managed Authorization integration before activation.

First test a development token with a controlled opted-in staging user, then exercise opt-outs, token rotation/logout, stale location, cancelled/duplicate/unknown-time matches, publish/unpublish and expired promotions. Verify ticket/receipt cleanup without logging token values. Never use production recipient scans as a smoke test.

## Local Verification

```powershell
npm --prefix functions run build
node --test functions/test/notifications.test.cjs
node --test tests/testNotifications.cjs tests/testMapApps.cjs tests/testRegisteredBarMarker.cjs
```

The tests execute the real pure predicates and delivery engine, mock Expo HTTP responses, and exercise the real Firestore adapter with mocked transactions. They cover boundary windows, defaults/opt-outs, historic results, nearby consent/radius, promotions, 100-message chunks, event/user deduplication, lease fencing, throttling, ambiguous failures, ticket/receipt invalid-token cleanup and rotated-token protection. They do not contact Expo/Firebase or deploy anything.