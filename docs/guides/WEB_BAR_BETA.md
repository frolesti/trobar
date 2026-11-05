# Beta web: registre de propietaris de bars

## Correus públics de Workspace (5 de novembre de 2026)

- [contactEmails.json](../../app/src/data/contactEmails.json) centralitza
  les tres bústies confirmades: `hola@trobar.cat` (consultes generals),
  `suport@trobar.cat` (ajuda i privacitat) i `facturacio@trobar.cat`
  (factures, cobraments i subscripcions).
- El peu del web utilitza contacte general; la pàgina de contacte diferencia
  els tres àmbits. Els textos legals compartits pel web i l'app utilitzen
  suport per a privacitat, i facturació a la secció de pagaments.
- Els enllaços legals del web i l'app exclouen el punt final de la frase.
  No es canvien bústies de clients ni les seves dades de compte.
- Validació: **11 proves dirigides correctes**, build Next i type-check
  de l'app correctes. L'actualització de textos no configura DNS ni activa
  correus automàtics de Firebase, Stripe o la campanya de prova.

## Indicador de passos al peu del formulari (5 de novembre de 2026)

- Els quatre passos es mostren sota els botons i els missatges d'estat,
  al peu de cadascuna de les cinc pantalles editables del registre.
  La verificació del correu continua formant part del pas del compte.
- El títol ja no té l'indicador a sobre. Es conserva la fletxa enrere
  i no s'afegeix cap indicador a la confirmació després de Stripe.
- Validació: **32 proves del formulari correctes** i build Next correcte.
  Ordre comprovat a totes cinc pantalles; primer pas al navegador a
  360/390/767/1440 px, sota «Continuar» i sense desbordament horitzontal.

## Espais i confirmació després de Checkout (5 de novembre de 2026)

- Es redueixen els paddings i les separacions del web: seccions de la portada
  de 48–64 px, sense mínims de 70–100 vh, i menys espai al web de bars,
  contacte, legals i peu de pàgina. Es conserven els controls tàctils de 44 px.
- La confirmació amaga el hero comercial i se situa just sota la capçalera.
  No mostra fletxa mentre consulta Stripe ni quan el bar ja està activat;
  tampoc es mostren fletxes durant altres operacions del formulari.
- `getSubscriptionStatus` ja retorna `trialEnd`, `currentPeriodEnd` i
  `cancelAtPeriodEnd`. El web mostra la data real en català i zona de
  Barcelona: primer cobrament, següent renovació o final d'accés si s'ha
  cancel·lat la renovació. No calcula una data fictícia sumant 14 dies.
- Renovació escollida: automàtica si no es cancel·la abans de la data.
  El recordatori per correu encara no està activat i el web no el promet.
  La [campanya de correus](TRIAL_EMAIL_CAMPAIGN.md) detalla els requisits.
- Stripe s'explica com la passarel·la segura per gestionar targetes i
  cobraments, al hero i abans de continuar al pagament.
- L'app encara no està publicada a les botigues. `StoreBadges` ara ho indica,
  en comptes d'enviar a les portades genèriques d'Apple i Google. Quan hi
  hagi fitxes reals, configurar `NEXT_PUBLIC_APP_STORE_URL` i/o
  `NEXT_PUBLIC_GOOGLE_PLAY_URL` a l'entorn del web i tornar a desplegar.
  El mateix component s'utilitza a portada i confirmació.
- Validació: **43 proves dirigides correctes** i build Next correcte.
  Render visual dels components reals, amb dades fictícies i sense accés a
  Firebase: confirmació a 360/390/767/1440 px, sense hero, fletxes ni overflow;
  separació capçalera-targeta de 27–31 px. La càrrega de Checkout tampoc
  mostra fletxa. Aquests renders no simulen un nou pagament.

## Favicon, peu de pàgina i progrés de Checkout (5 de novembre de 2026)

- El logo oficial identifica totes les pestanyes: ICO de 16/32/48 px,
  PNG de 32 px i icona Apple de 180 px, derivats de `logo-red.png`.
  Els originals es versionen a `assets/web/logos`; `sync-shared-assets.js`
  copia les imatges a `public/assets/logos` i l'ICO a `/favicon.ico`,
  també quan Vercel executa `next build` directament.
- `_document.tsx` declara les variants i mides per a tot el web. Si Chrome
  conserva la icona antiga, recarrega amb Ctrl+F5 o comprova una pestanya
  d'incògnit. La icona dels controls de seguretat al costat de l'URL és
  del navegador i no es pot substituir pel logo.
- El peu mòbil es desplega amb un toc o clic normal, Enter o Espai:
  no hi ha pulsació llarga ni missatge «Mantén premut». Els controls mostren
  una fletxa, `aria-expanded` i `aria-controls`; els enllaços tancats queden
  ocults també per a teclat i lectors de pantalla.
- En obrir Checkout, «Obrint Stripe…» apareix només al botó, amb
  `aria-busy`, no es repeteix en un segon text d'estat. Els errors continuen
  sent visibles i permeten reintentar.
- Validació: **42 proves dirigides correctes** (formulari, Chrome web i
  facturació) i build Next correcte. Cap cobrament ni canvi de Stripe live.

### Prova manual de Stripe sandbox

1. Comprova que Checkout mostra **Sandbox**. No utilitzis cap targeta real.
2. Revisa el pla: l'anual és **348 EUR/any**, després de 14 dies gratuïts.
3. Usa `4242 4242 4242 4242`, caducitat futura, qualsevol CVC de tres xifres
   i nom fictici. Completa els altres camps que Stripe demani.
4. Confirma la prova i espera el retorn al web. El bar només es considera
   actiu quan el servidor confirma la subscripció `trialing` o `active`;
   el paràmetre `checkout=success` no és una prova de pagament.
5. A Stripe sandbox, comprova la subscripció i el seu final de prova.
   Completar Checkout amb trial no acredita encara el primer cobrament
   del període de pagament. El sandbox no mou diners.

Referència: [targetes i pagaments de prova de Stripe](https://docs.stripe.com/testing).

## Revisió UX i confirmació a Stripe (4 de novembre de 2026)

- Navegació enrere també des de la cerca i la verificació del correu.
  Cada pantalla té una fletxa esquerra sense text visible, amb nom accessible.
  Torna al pas anterior; al primer pas torna a la pàgina anterior del navegador
  (o a `/per-a-bars` si s'ha entrat directament).
  Les dades escrites es conserven durant la navegació del formulari; no es
  persisteixen contrasenyes ni esborranys personals al navegador.
- Camps obligatoris amb `*`, opcionals identificats explícitament i ubicació
  al mapa marcada com a obligatòria. Placeholders grisos en cursiva, valors
  foscos sobre blanc i estat d'error amb text, vora i `aria-invalid`.
- Continuar destaca tots els camps incorrectes, associa cada explicació amb
  `aria-describedby` i fa focus/scroll al primer error. Escriure no mou el
  focus a un altre camp. Els canvis de pas enfoquen el títol i tornen a la
  capçalera del formulari; es respecta `prefers-reduced-motion`.
- Etiqueta fiscal única: «NIF del titular o de la societat». S'elimina de la
  UI el paràgraf tècnic de validació, no la validació de format/control ni
  el suport als NIF de persones i societats. Els detalls opcionals expliquen
  com ajuden els aficionats a triar el local, sense prometre clients.
- El botó final «Continuar a Stripe» prepara les dades i obre Checkout en
  la mateixa acció. No mostra benvinguda ni registre complet abans de Stripe.
  El resum mostra l'import real del cicle (39, 99 o 348 EUR), no només
  l'equivalent mensual.
- `registerBar` desa un esborrany `status=pending_checkout`, `isActive=false`,
  `tier=free`, `premium=false`. El mapa, els enllaços a bars i les emissions
  exclouen aquests esborranys. El webhook només els activa i passa a
  `registered` quan Stripe confirma `active` o `trialing`.
- Els esborranys es poden corregir sense duplicar el bar. Amb una reserva de
  Checkout oberta, un reintent idèntic es permet, però no canviar les dades
  o el pla fins que caduqui. No se sobreescriuen bars ja activats.
- En tornar o recarregar, es recuperen les dades des del servidor. Una
  alta pendent reprèn Checkout automàticament després de comprovar que no
  existeix una subscripció activa, també per a les altes antigues sense ID
  de subscripció. No mostra una pantalla intermèdia explicativa.
  Una cancel·lació torna al pas de facturació sense reobrir Stripe; un retorn `success`
  només inicia una consulta d'estat amb reintents acotats. Un error de
  consulta no equival a una subscripció inactiva ni ofereix repetir el
  pagament a cegues. Si falla obrir Checkout, només s'ofereix reintentar
  i la fletxa per tornar al pas anterior; no hi ha reintents automàtics
  en bucle. Es mantenen els 14 dies de prova.

Correcció posterior de navegació i represa: **38 proves dirigides correctes**
(formulari, Checkout i estat de facturació) i build Next correcte. Cobreix
represa automàtica única, altes antigues, error sense bucle, retorn cancel·lat,
retorn d'èxit sense pagament duplicat i fletxes amb conservació de dades.

Validació de la revisió inicial: **60 proves dirigides correctes**, builds de
Next i Functions i type-check de l'app correctes. **Dues proves amb emuladors
correctes**, una amb el handler i una amb el transport HTTP real dels callables:
esborrany inactiu, propietat, NIF privat, claims, reintents i denegació a un
altre usuari. Emuladors aturats i fixtures/secrets ficticis temporals retirats.

Navegador local sobre projecte `demo-trobar-beta`: alta i verificació local,
navegació enrere, dades conservades, errors de camps/condicions i focus/scroll,
pas directe al destí Checkout simulat i recuperació en cancel·lar. Lectura
independent de Firestore confirma `pending_checkout`, `isActive=false`,
`premium=false`. Amplades CSS reals 360, 390, 767 i 1440 sense desbordament
dels controls. Google Places i Checkout s'han simulat només en aquesta prova
visual; **no acredita un pagament ni un webhook real de Stripe**.

Publicació autoritzada posterior: `registerBar` i `stripeWebhook` desplegats
a `trobar-1123f`, regió `europe-west1`. El web i el filtre de descobriment
es publiquen amb el commit de la revisió pel circuit Git/Vercel existent.
Cal verificar els dos projectes Vercel (landing Next i web Expo) i el domini
públic. Això no distribueix una versió nova a App Store o Google Play.
No s'han modificat secrets ni activat cobraments live; Stripe continua en
sandbox. La [campanya de correus de trial](TRIAL_EMAIL_CAMPAIGN.md) està
dissenyada, però encara no està implementada ni activada.

## NIF i localització

- El formulari i `registerBar` fan servir [`stdnum`](https://github.com/koblas/stdnum-js)
  per validar NIF (DNI, NIE i casos K/L/M) i CIF: format i dígit de control.
  Normalitzen minúscules, separadors i prefix ES abans de desar. No consulten
  cap cens, no envien el NIF a tercers i no acrediten existència o titularitat.
  La [comprovació censal de l'AEAT](https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/presentacion-declaraciones-ayuda-tecnica/modelo-030/comprobacion-nif-terceros-efectos-censales.html)
  és un servei diferent amb identificació; VIES no és un cens de tots els bars.
- El NIF i la constància `taxIdValidation.method=checksum` es desen al document
  **privat** `barOwners/{uid}`, no al bar de lectura pública. No s'afegeix
  `verifiedAt`. Això no migra NIF públics de registres antics.
- L'alta nova queda pendent de Stripe (`status=pending_checkout`,
  `isActive=false`), sense revisió manual obligatòria. Un NIF vàlid no
  publica el bar ni concedeix premium. No es limita a un bar per NIF:
  una societat pot tenir diversos establiments.
- `searchRegistrationLocations` i `getRegistrationLocationDetails`, callables
  a `europe-west1`, requereixen sessió i email verificat. Fan servir Google
  Places Autocomplete (New) i Place Details amb el secret de servidor
  `GOOGLE_PLACES_API_KEY`, timeout de 10 s i un mateix token UUID de sessió.
  La clau necessita accés a Places API (New) i facturació activa; no s'envia
  al navegador. No es desa una cache de resultats de Google.
- Les coincidències apareixen després de 3 caràcters i 450 ms sense escriure,
  sense botó de cerca; es poden seleccionar amb teclat o ratolí. Les respostes
  antigues no substitueixen una consulta més recent. La selecció consulta els
  detalls i desa també `googlePlaceId`. Hi ha atribució visible a Google Maps.
  Això substitueix Nominatim, que no permet autocomplete al servei públic.
- `registrationLocationLimits/{sha256(uid)}` limita cada compte a 60 peticions
  per minut i deixa almenys 250 ms entre cerques; seleccionar immediatament
  un resultat està permès. No hi ha bloqueig global entre propietaris.
  La col·lecció només és accessible des del servidor o per administradors.
  Errors de quota/proveïdor són explícits i no es confonen amb zero resultats.
- La selecció desa `location.latitude/longitude`, el format consumit pel mapa.
  Per a dades manuals cal localitzar l'adreça i seleccionar el resultat.
  Editar adreça, ciutat o codi postal invalida la selecció anterior. El backend
  rebutja registres sense coordenades numèriques vàlides. Aquestes coordenades
  situen el local; no són una verificació de titularitat.
- Cal publicar **junts** el web i els callables `registerBar`,
  `searchRegistrationLocations`, `getRegistrationLocationDetails` i
  `stripeWebhook`. El web es
  publica amb la integració Git de Vercel des de `main`; les funcions es despleguen a
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
comprova autenticació i validació dels callables de localització i registra
coordenades de prova. Els tests unitaris cobreixen suggeriments/detalls amb
respostes Google simulades; l'emulador no consulta Places ni consumeix quota.
No comprova enviament real d'emails ni Checkout/webhooks de Stripe reals.
Per provar `getSubscriptionStatus` sense consultar Secret Manager, prepara
`functions/.secret.local` amb `STRIPE_SECRET_KEY=sk_test_emulator_only` i
`STRIPE_WEBHOOK_SECRET=whsec_emulator_only`; són valors ficticis, no credencials
Stripe vàlides. Afegeix també `GOOGLE_PLACES_API_KEY=emulator_only`, sense una
clau real. No sobreescriguis secrets locals ja existents ni els versionis.

Resultats de la primera publicació: **34 proves dirigides i 2 proves amb emuladors correctes**, i builds
de Functions i Next correctes. La prova HTTP va revelar un error real amb
`admin.firestore.FieldValue` dins del runtime de Functions: registre i
facturació ara importen `FieldValue` directament de `firebase-admin/firestore`.
El harness antic de facturació també s'ha alineat amb les dependències actuals
dels handlers i el requisit d'email verificat.

Comprovació de la primera publicació al navegador contra un projecte **demo local**: compte sintètic
verificat, cerca real de «Plaça de Catalunya, Barcelona» a Nominatim, selecció
d'ubicació, NIF amb control incorrecte rebutjat, NIF normalitzat acceptat,
confirmació final i recuperació del registre després de recarregar. Lectura
independent de Firestore confirma coordenades desades, NIF privat, estat
`registered` i `premium=false`. No s'ha activat Stripe ni enviat correu real.
La resta del document recull revisions anteriors; les referències a
`pending_review` descriuen el comportament anterior a aquesta alta immediata.

## UX del compte i correu de verificació

Validació d'aquesta iteració: **44 proves dirigides i 2 proves amb emuladors
correctes**, més builds de Functions i Next. Consulta real de «Zurito Terrassa»
amb Autocomplete i Place Details: HTTP 200, adreça i coordenades correctes.
Comprovació al navegador: error de correu només després de sortir del camp,
ocult en tornar a editar, cap logo al formulari ni desbordament horitzontal.
Els tests cobreixen també teclat, cancel·lació del debounce, respostes fora
d'ordre, límit de quota, selecció de coordenades i registre HTTP persistent.

El formulari no mostra logos decoratius; la navegació enrere utilitza una
icona de fletxa esquerra amb nom accessible. L'error de format
del correu apareix en sortir del camp, no mentre s'escriu. Les instruccions de
verificació només apareixen després de crear el compte i enviar el correu.

Firebase Auth continua enviant els correus, sense substituir el proveïdor.
`trobar.cat` i `www.trobar.cat` estan autoritzats a Firebase Auth. La pàgina
corporativa `/auth/action` ofereix continuar el registre després de verificar.
**No és encara el destí dels correus enviats**: els intents de configurar
`notification.sendEmail.callbackUri` i les plantilles mitjançant Identity Toolkit
Admin v2 retornen `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, fins i tot sense canviar
el cos del missatge. Cal desbloquejar-ho a Firebase abans d'activar aquesta
personalització. Afegir dominis autoritzats no canvia la plantilla ni el remitent.
No s'ha configurat SMTP ni s'han alterat enviaments operatius. Sense les
capçaleres del correu rebut no es pot atribuir de manera fiable l'entrada a spam.

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
