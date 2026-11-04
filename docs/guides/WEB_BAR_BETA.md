# Beta web: registre de propietaris de bars

## Alta immediata: NIF i localització

- El formulari i `registerBar` fan servir [`stdnum`](https://github.com/koblas/stdnum-js)
  per validar NIF (DNI, NIE i casos K/L/M) i CIF: format i dígit de control.
  Normalitzen minúscules, separadors i prefix ES abans de desar. No consulten
  cap cens, no envien el NIF a tercers i no acrediten existència o titularitat.
  La [comprovació censal de l'AEAT](https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/presentacion-declaraciones-ayuda-tecnica/modelo-030/comprobacion-nif-terceros-efectos-censales.html)
  és un servei diferent amb identificació; VIES no és un cens de tots els bars.
- El NIF i la constància `taxIdValidation.method=checksum` es desen al document
  **privat** `barOwners/{uid}`, no al bar de lectura pública. No s'afegeix
  `verifiedAt`. Això no migra NIF públics de registres antics.
- L'alta nova és immediata (`status=registered`, `isActive=true`), sense
  revisió manual obligatòria. Continua sent gratuïta fins a una subscripció
  confirmada; un NIF vàlid no concedeix premium. No es limita a un bar per NIF:
  una societat pot tenir diversos establiments.
- `searchRegistrationLocations`, callable a `europe-west1`, requereix sessió
  i email verificat. Consulta Nominatim des del servidor, valida HTTP/JSON i
  coordenades, aplica timeout de 12 s i cache de 24 h. Una reserva global
  a Firestore serialitza peticions i deixa almenys 1,1 s entre consultes.
  Una cerca ocupada retorna `resource-exhausted`; no es confon amb zero resultats.
  Les col·leccions `registrationLocationCache` i `registrationLocationLimits`
  només són accessibles des del servidor o per administradors.
- Es respecta la [política de Nominatim](https://operations.osmfoundation.org/policies/nominatim/):
  cerca explícita, no autocomplete, identificació de troBar i atribució visible.
  Només s'hi han d'introduir noms/adreces públiques de locals. El proveïdor es
  pot canviar al servidor amb `REGISTRATION_NOMINATIM_URL` (URL HTTPS de cerca
  compatible); el servei públic no ofereix SLA i no és adequat per volum elevat.
- La selecció desa `location.latitude/longitude`, el format consumit pel mapa.
  Per a dades manuals cal localitzar l'adreça i seleccionar el resultat.
  Editar adreça, ciutat o codi postal invalida la selecció anterior. El backend
  rebutja registres sense coordenades numèriques vàlides. Aquestes coordenades
  situen el local; no són una verificació de titularitat.
- Cal publicar **junts** el web i els callables `registerBar` i
  `searchRegistrationLocations`. El web es publica amb la integració Git de
  Vercel des de `main`; les dues funcions es despleguen explícitament a
  `trobar-1123f`, regió `europe-west1`. La publicació del registre no activa
  cobraments ni modifica secrets o configuració de Stripe. Les comprovacions
  de pagament reals encara requereixen Stripe test configurat.

Proves locals del flux:

```powershell
npm --prefix functions run build
node --test tests\testWebBarSignup.cjs functions\test\barRegistration.test.cjs functions\test\registrationLocations.test.cjs functions\test\billingCheckout.test.cjs functions\test\stripeWebhook.test.cjs functions\test\subscriptionBilling.test.cjs
$env:BAR_SIGNUP_FUNCTIONS_EMULATOR_HOST = '127.0.0.1:5001'
firebase emulators:exec --only "auth,firestore,functions" --project demo-trobar-beta "node --test functions\test\barSignupTransport.emulator.cjs functions\test\barRegistration.emulator.cjs"
npm --prefix web-app run build
```

La prova de transport utilitza Auth, Firestore i callables HTTP locals reals;
la cerca es precàrrega amb una resposta de prova per no dependre d'OSM. No
comprova enviament real d'emails ni Checkout/webhooks de Stripe reals.
Per provar `getSubscriptionStatus` sense consultar Secret Manager, prepara
`functions/.secret.local` amb `STRIPE_SECRET_KEY=sk_test_emulator_only` i
`STRIPE_WEBHOOK_SECRET=whsec_emulator_only`; són valors ficticis, no credencials
Stripe vàlides. No sobreescriguis secrets locals ja existents ni els versionis.

Resultats: **34 proves dirigides i 2 proves amb emuladors correctes**, i builds
de Functions i Next correctes. La prova HTTP va revelar un error real amb
`admin.firestore.FieldValue` dins del runtime de Functions: registre i
facturació ara importen `FieldValue` directament de `firebase-admin/firestore`.
El harness antic de facturació també s'ha alineat amb les dependències actuals
dels handlers i el requisit d'email verificat.

Comprovació al navegador contra un projecte **demo local**: compte sintètic
verificat, cerca real de «Plaça de Catalunya, Barcelona» a Nominatim, selecció
d'ubicació, NIF amb control incorrecte rebutjat, NIF normalitzat acceptat,
confirmació final i recuperació del registre després de recarregar. Lectura
independent de Firestore confirma coordenades desades, NIF privat, estat
`registered` i `premium=false`. No s'ha activat Stripe ni enviat correu real.
La resta del document recull revisions anteriors; les referències a
`pending_review` descriuen el comportament anterior a aquesta alta immediata.

Abast: `https://trobar.cat` → `https://www.trobar.cat/`, el web **Next.js de
`web-app`**, no l'export d'Expo. Revisió pública només de lectura; cap compte,
cobrament, desplegament, migració ni recurs extern modificat.

## Defectes reproduïts i correccions locals

- **Imatges**: al web públic hi havia 404 per `logo-red.png`, `logo-white.png`
  i `bar-fallout.jpg` (imatges completades amb `naturalWidth = 0`). Els assets
  existien a `assets/web`, però `web-app/public/assets` contenia junctions
  absolutes de Windows ignorades per Git. `sync-shared-assets.js`, executat
  per `prebuild`, ara materialitza **img, logos, videos i gif** en directoris
  reals. Conserva la prioritat de GIF web/app i la capçalera de correu existent.
- **Tipografia**: públic, amplada CSS real 1440: h2 «Tot el que necessites»
  `clientWidth=480/scrollWidth=703`; «Disponible a iOS i Android»
  `640/677`; h1 `/per-a-bars` `720/1202`, 129,6 px;
  `/registra-bar` `720/830`, 129,6 px. A 360 px, h1 bars `309/434`
  i registre `313/333`. S'han reduït els límits de la font Oi, eliminat
  l'override gran del hero, habilitat wrap i mantingut focus visible i zoom.
- **Registre**: abans s'assignaven claims abans dels documents, les escriptures
  eren separades, faltava `users/{uid}` amb `ownedBars`, i el bar naixia premium
  sense subscripció. Ara `barRegistration.ts` valida al servidor i desa
  `bars`, `barOwners` i `users` atòmicament; `tier=free`, `premium=false`,
  pendent de revisió. Claims després del commit, conservant altres claims.
  Un reintent reutilitza el bar i repara claims/perfil sense duplicar-lo.
  Comptes admin i vinculacions inconsistents no es converteixen silenciosament.
- **Client**: email duplicat amb contrasenya correcta permet reprendre; una
  sessió restaurada recupera el propietari. Verificació i registre refresquen
  el token. El pas final exigeix lectura del perfil i propietari **del servidor**
  i claims renovades, no només `ok=true`. Errors de xarxa/verificació permeten
  recuperar. Si només existeix Auth, cal reomplir les dades encara no enviades
  del local; no es desen contrasenyes ni esborranys personals al navegador.
- **Stripe**: el web ara obre el callable `createCheckoutSession` des del
  registre complet. Preus obligatoris, sense placeholders ni fallback:
  39 EUR/mes, 99 EUR/3 mesos, 348 EUR/any. Comprovació de moneda, import,
  recurrència, preu actiu i autorització explícita de mode live. Es manté la
  **prova de 14 dies**; només `active`/`trialing` són elegibles.
  Customer amb idempotency key, reserva de Checkout d'una hora amb key estable
  i detecció de subscripcions Stripe encara no sincronitzades per webhook.
  Un pla diferent amb Checkout pendent es bloqueja fins a caducar la reserva.
  URLs de retorn a `/registra-bar`, no al dashboard inexistent del web; l'app
  també deixa d'enviar aquell dashboard. El pla triat a preus es transporta
  amb `?billing=...`.
- **Webhook**: signatura sobre `rawBody`, transacció amb registre privat
  `stripeEvents/{eventId}`, watermark d'esdeveniment i consulta d'estat actual
  per actualitzacions/factures. S'atenen creació, canvi, baixa, factura pagada
  i fallida; la baixa usa el snapshot signat. Cap premium per estat impagat.
  Cancel·lació fallida ja no retorna èxit ni oblida els IDs de Stripe.

## Validació executada

Les proves amb dobles no fan peticions a Firebase/Stripe reals.

- `node --test tests\testWebBarSignup.cjs tests\testWebBetaAssets.cjs
  functions\test\barRegistration.test.cjs functions\test\billingCheckout.test.cjs
  functions\test\stripeWebhook.test.cjs`: **22 proves locals** (recuperació,
  persistència, errors parcials, preus, autorització, reintents, estats i signatures).
- `firebase emulators:exec --config firebase.json --only "auth,firestore"
  --project demo-trobar-beta "node --test functions\test\barRegistration.emulator.cjs"`:
  **1 prova d'integració correcta**, Auth local i Firestore local reals.
  Comprova email duplicat/no verificat, token renovat, perfil/claims/propietat
  persistits, sign-out/sign-in, registre idempotent i permisos denegats a un
  altre usuari. Executa `registerBar.run` (handler real), **no** el transport
  HTTP del callable desplegat. Projecte demo, guardes d'host loopback i neteja.
  El log `PERMISSION_DENIED` és el cas negatiu esperat. Emuladors aturats.
- `node --test tests\testAuthAction.cjs tests\testPasswordResetEmail.cjs
  tests\testBarDashboard.cjs`: **17 regressions correctes**.
- `npm --prefix functions run build`: correcte (TypeScript).
- `npm --prefix web-app run build`: correcte (TypeScript i Next optimitzat,
  incloent `/`, `/per-a-bars`, `/registra-bar`, `/auth/action`).
- Type-check global Expo: falla preexistent a
  `app/src/components/SplashScreen.tsx:99`, `position: "fixed"` incompatible
  amb `ViewStyle`. Fitxer no modificat en aquesta tasca.
- Abans de les correccions, les **3 proves Stripe existents fallaven**:
  mocks sense `console.info`, metadades/transactions inexistents i expectatives
  de trials contràries al backend i a l'oferta pública. Harness actualitzat i
  cobertura ampliada, mantenint l'oferta de prova.
- Navegador sobre build local `http://localhost:3107`: `/`, `/per-a-bars`,
  `/registra-bar`, amb **innerWidth CSS real 360, 390, 768, 1440**.
  Cap h1/h2 amb `scrollWidth > clientWidth + 1`, cap imatge trencada.
  `logo-red.png naturalWidth=512`, `logo-white.png=2362`,
  `bar-fallout.jpg=1660`, GIF=520. H1 desktop 64 px; mòbil 30–32 px.
  Les peticions de vídeo cancel·lades en canviar de pàgina són `ERR_ABORTED`,
  no 404. No s'ha enviat el formulari del navegador a producció.
  El camp email amb `:focus-visible` mostra outline solid de 2 px.

## Fitxers canviats en aquesta revisió

S'han integrat els canvis existents sense revertir-los. Els altres canvis del
worktree (incloses les pàgines Auth ja presents) no són noves modificacions
d'aquesta revisió.

- `firebase.json`
- `functions/src/index.ts`
- `functions/src/barRegistration.ts`
- `functions/test/betaHarness.cjs`
- `functions/test/barRegistration.test.cjs`
- `functions/test/barRegistration.emulator.cjs`
- `functions/test/billingCheckout.test.cjs`
- `functions/test/stripeWebhook.test.cjs`
- `web-app/components/ContactForm.tsx`
- `web-app/components/Hero.tsx`
- `web-app/components/Pricing.tsx`
- `web-app/lib/firebase.ts`
- `web-app/next.config.js`
- `web-app/scripts/sync-shared-assets.js`
- `web-app/styles/globals.css`
- `app/src/services/subscriptionService.ts`
- `tests/testWebBarSignup.cjs`
- `tests/testWebBetaAssets.cjs`
- `docs/README.md`
- `docs/guides/stripe-billing-setup.txt`
- `docs/guides/WEB_BAR_BETA.md`

## Routing i condicions d'activació

### Revisió visual posterior (1 de novembre de 2026)

- Els títols i subtítols informatius utilitzen Inter en lloc d'Oi. La font
  decorativa es conserva només per a la marca del footer, sense negreta
  artificial. Les característiques ja no imposen Oi a 22 px i pes 700.
- El header mostra la icona oficial completa, sense ampliar-la ni retallar-la,
  i el nom troBar llegible. El menú compacte s'activa fins a 900 px.
- Els tres vídeos comparteixen posicionament absolut dins dels seus
  contenidors i un fotograma JPEG real com a `poster`: hi ha contingut visible
  mentre carreguen o si el navegador no pot reproduir-los. Un error de vídeo
  es registra explícitament a la consola.
- La sincronització d'assets també s'executa des de `next.config.js`, cobrint
  els hosts que executen `next build` sense el lifecycle `prebuild` d'npm.
  Els fitxers generats continuen ignorats per Git; els originals i els posters
  s'han d'incloure al desplegament.
- Al web públic revisat, les peticions de logos i MP4 retornaven l'HTML
  «404: This page could not be found», fins i tot amb HTTP 200/206 i
  `Content-Type: text/html`. Per tant, un codi HTTP correcte **no** valida
  aquests mitjans. Després de desplegar, comprova MIME, signatura del fitxer,
  `naturalWidth` de les imatges i `readyState`/`videoWidth` dels vídeos.
- Els blocs «L'app» i «Comunitat» alternen vídeo esquerra/dreta en escriptori.
  Fins a 900 px es conserva el vídeo abans del text a tots dos.
- L'usuari ha autoritzat la publicació dels canvis visuals a trobar.cat i ha
  confirmat que té permís o llicència per publicar els vídeos d'Artlist.
  Es conserva la marca d'aigua. Autenticació, Stripe i els altres canvis
  pendents no formen part d'aquesta pujada visual.
- Publicació visual confirmada: commit `f235acb` a `main`; Vercel ha completat
  els desplegaments `trobar-landing` i `trobar`. Comprovat a
  `https://www.trobar.cat/` sense paràmetres de previsualització: logos i fotos
  carregats, tres vídeos en reproducció amb `readyState=4` i `videoWidth=1920`.
  Alternança correcta a 1024/1440 px i apilat correcte a 390/900 px, sense
  desbordament horitzontal. La instantània exacta del commit ha passat cinc
  proves visuals i un build optimitzat abans de pujar-la.
- Validació: 10 proves de visuals/assets/registre correctes, type-check web
  correcte i build directe de Next correcte. Navegador a 360, 390, 768, 900 i
  1440 px sobre inici, bars i registre: cap títol desbordat ni imatge trencada.
  En el build optimitzat, els tres vídeos arriben a `readyState=4`,
  `videoWidth=1920` i reproducció activa; els posters retornen JPEG vàlids.
  Amb una fallada de vídeo simulada, el poster de 1280×720 continua disponible
  al contenidor de 480 px d'alçada.

`firebase.json` configura Functions/Firestore/Storage, **no Firebase Hosting**.
La redirecció pública i la UI identifiquen Next, però el proveïdor, projecte
de hosting, deploy actual i variables de producció no han estat autenticats
ni verificats. No s'ha afegit un hosting inventat.

Per al desplegament del web cal configurar l'arrel `web-app`, executar
`npm run build` (no només `next build`, que omet `prebuild`) i servir Next amb
el seu adaptador/server. No publicar `dist` d'Expo a `www.trobar.cat`.
Els assets generats estan ignorats per Git expressament: han de regenerar-se
durant cada build. No compartir aquest domini amb un export diferent.

Checklist pendent, requereix accés/autorització:

1. Confirmar hosting i domini canònic, revisar deploy i rollback del **Next**
   correcte; desplegar només amb autorització explícita. Repetir els HTTP
   dels assets i les mateixes mides de pantalla després.
2. Revisar només noms/metadades de `NEXT_PUBLIC_FIREBASE_*` del web i projecte
   escollit. Ara Next prioritza aquests noms davant `EXPO_PUBLIC_FIREBASE_*`.
   `.firebaserc` selecciona `trobar-1123f` per defecte; això **no** demostra
   que el bundle públic utilitzi aquell projecte.
3. Habilitar/provar proveïdor email/password, dominis Auth `trobar.cat` i
   `www.trobar.cat`, verificació/recuperació i handler `/auth/action`.
   Validar emails reals només amb comptes i entorn autoritzats.
4. Verificar desplegament del callable `registerBar` i billing a
   `europe-west1`, regles efectives i lectura de `users`, `barOwners`,
   vinculació `bars.ownerId`. Auditar manualment registres parcials antics;
   no s'ha migrat ni reparat cap document de producció.
5. Configurar al servidor `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_QUARTERLY`, `STRIPE_PRICE_ANNUAL`.
   Els preus han de correspondre a imports/recurrència publicats, fiscalitat
   i condicions legals aprovades. Confirmar mateix compte i mode test/live;
   cap secret ni valor real s'ha llegit en aquesta tasca.
6. Retorns per defecte només als dos dominis trobar.cat. Orígens addicionals
   requereixen `STRIPE_ALLOWED_RETURN_ORIGINS` (separats per comes).
   HTTP localhost només quan `FUNCTIONS_EMULATOR=true`.
   `STRIPE_ALLOW_LIVE_BILLING=true` és un **bloqueig d'activació explícita**
   del Checkout/change-plan live, no una autorització concedida aquí.
7. Webhook `stripeWebhook` de Functions, signatura vàlida i subscripció a
   esdeveniments gestionats; provar renovació, trial, impagat, cancel·lació,
   reintents i ordre amb Stripe **test** autoritzat. No hi ha prova d'una
   sessió Stripe real, credencials, webhook HTTP ni cobrament real.
8. Monitoratge d'errors callable/webhook, alertes de sincronització, retenció
   del registre `stripeEvents`, costos i procediment de rollback. El login
   del web i de l'app són sessions separades: el retorn des de l'app pot
   requerir iniciar sessió al web; no s'injecten credencials al retorn.
9. Els links App Store/Google Play continuen sent genèrics; calen URLs reals
   aprovades abans de prometre descàrregues. Revisar també l'estat de revisió
   manual dels bars i comunicació de l'oferta abans d'obrir beta.

**Conclusió:** registre/persistència verificats amb emuladors locals, Stripe
verificat amb dobles locals, UI verificada al build local. La producció
continua pendent de configuració, desplegament autoritzat i revalidació.
