# 🔍 troBar — Auditoria del projecte

> Tracklist de neteja, inconsistències i millores. Marca cada checkbox a mesura que es completi.
> Última actualització: 27/10/2026. La revisió següent és l'estat actual; les seccions posteriors conserven les revisions anteriors.

## Organització del repositori: 27/10/2026

Aquest document s'ha traslladat a `docs/reviews/`. L'índex actual és
[docs/README.md](../README.md); les rutes de codi citades a sota són relatives
a l'arrel del repositori. Les guies són a `docs/guides/`, les proves locals
a `tests/` i les regles, índexs, esquema i migracions a `firebase/`.
Els exports i logs de validacions anteriors s'han conservat a `.local/`,
ignorat per Git. No s'han desplegat regles ni executat migracions.

La correcció posterior del drag utilitza `PanResponder` amb captura després
de 250 ms, no el reconeixedor descrit a les revisions històriques següents.
La prova local s'ha adaptat a aquesta implementació, inclosos el llindar
exacte, els moviments verticals i els gestos amb més d'un dit.

## Retocs de fitxes, pins i drag: 27/10/2026

- Les fitxes registrades del mapa, normals i premium, tenen fons grana
  compartit, text blanc/rosat i acció de navegació clara. La premium manté
  la vora daurada i l'obertura explícita de totes les dades. El triangle
  de la bafarada i el marc d'escriptori utilitzen la mateixa paleta.
- El pin original i l'escut es redueixen conjuntament amb el zoom, amb
  escala limitada entre 0,32 i 1 i ancoratge inferior constant. El marcador
  es refresca en canviar de nivell de zoom per no retenir la mida anterior
  a la captura nativa. Es mantenen els punts grisos dels bars descoberts.
- El partit s'arrossega després de mantenir premut durant 280 ms. La targeta
  completa de l'altre partit queda al darrere i es revela durant el drag;
  el desplaçament suficient intercanvia els partits en deixar anar. Un toc
  curt continua filtrant. No s'ha definit `minDistance(0)`, perquè al web
  activava el reconeixedor immediatament i consumia els tocs curts.
- El peu del perfil ocupa menys espai i el botó de sortir s'ajusta al text.
  L'atribució d'Icons8 s'ha mogut al final dels termes del servei; no s'ha
  eliminat. Es conserven els enllaços legals, el contacte i la versió real.

Validació: 80 proves correctes i exportació iOS/Hermes final completada.
El navegador ha comprovat drag en ambdós sentits, inclosa entrada tàctil
simulada després de mantenir premut, i toc curt que activa el filtre seguit
de drag que el conserva. S'ha comprovat la fitxa grana d'El Clàssic a 390 px,
sense desbordament horitzontal, i el pin ha passat de 35 a 29 px amb un pas
de zoom. Perfil i crèdits reubicats coberts per regressió; no s'ha iniciat
cap sessió real per inspeccionar el perfil. Queda pendent la prova física
a l'iPhone. TypeScript manté els tres errors previs. No s'han modificat
dades remotes, fet desplegaments ni creat commits.

## Revisió visual i de gestos: 27/10/2026

- El fons compartit és `#7a0033`, definit a `app/src/theme/brandColors.json`.
  L'app, la navegació, l'accés, els documents legals i la càrrega React,
  HTML i de configuració nativa utilitzen aquest mateix color. Una prova
  comprova també les còpies estàtiques d'HTML i d'`app.json` per evitar
  que divergeixin. Els documents legals utilitzen Barlow i text clar.
- La targeta del mapa utilitza el reconeixedor natiu de
  `react-native-gesture-handler`, en lloc de `PanResponder`. S'ha eliminat
  el gest lateral que obria l'accés incondicionalment, desactivat el gest
  enrere de la ruta del mapa i protegit l'accés quan la sessió ja és activa.
- La icona central del peu del mapa ja no sobresurt; conserva l'acció
  de centrar la ubicació i queda al nivell de les altres icones.
- El radi té cinc passos: 500 m, 1 km, 2 km, 5 km i 10 km. S'utilitza el
  lliscador compatible amb Expo a natiu i un rang HTML accessible al web.
  Es desa en deixar anar el control, no a cada moviment; l'esquema local
  inclou les mateixes distàncies. La preferència es recupera al mapa.
- El perfil no inclou l'opció «Aplicació de mapes». La primera elecció
  oberta correctament es recorda; si l'app deixa d'estar instal·lada,
  es torna a demanar. S'ha eliminat la segona pregunta «Només ara/Sempre».
- Termes, privacitat i contacte són al peu, amb crèdits i versió real.
  Eliminar el compte és l'última opció de configuració, després de sortir.
  Els recordatoris ocupen dues files equilibrades en pantalles estretes.

Validació: 79 proves correctes, `expo install --check` correcte i
exportació iOS/Hermes final completada. Al navegador s'han comprovat
els cinc radis amb teclat, persistència després de recarregar i una sola
escriptura per arrossegament. Perfil i documents legals no presenten
desbordament horitzontal a les amplades comprovades de 320, 390 i 1280 px.
S'han capturat el peu mòbil, els textos legals i l'accés amb el nou fons.
Al mapa real, els gestos tàctils simulats intercanvien els dos partits en
ambdós sentits, conserven el filtre activat, respecten el moviment reduït
i ignoren el gest vertical. El gest lateral de mapa no ha obert l'accés.
La comprovació física a l'iPhone continua pendent; tampoc s'ha validat
una sessió autenticada real al navegador. TypeScript manté només els
tres errors previs de SplashScreen, AppNavigator i el to d'alerta del mapa.
Els canvis de splash natiu requereixen reconstruir els binaris propis.

### Targeta premium unificada: 27/10/2026

Implementada segons la concreció posterior: la targeta premium del mapa
utilitza la mateixa estructura que la normal i només es diferencia per
una vora daurada de 2 px (`EDITORIAL.matchday`) i l'acció final
«Veure totes les dades», amb un desplegable indicat per un xebró.
S'ha retirat l'eyebrow «Premium · Veure perfil».

Es conserven el nom, la valoració interna quan existeix, l'estat obert/tancat,
les fotos, l'adreça, la distància i «Com arribar-hi». La galeria pròpia i les
fotos públiques es combinen sense duplicats també a la targeta compacta.
Només l'acció explícita obre el panell complet existent; en tancar-lo es
conserva la selecció al mapa. El panell manté serveis, emissions, contacte,
xarxes, seguiment i ressenyes. El tancament té contrast i un objectiu de 44 px.
El marc i el tancament de la targeta compacta són coherents a mòbil i
escriptori; la barra lateral permet desplaçar el contingut si no hi cap.

Validació d'aquesta concreció: 80 proves correctes i exportació iOS/Hermes
completada. Comprovació visual al mapa real amb El Clàssic Sports Bar,
obertura i tancament del panell, captures mòbil i escriptori i absència de
desbordament horitzontal a 320, 390 i 1280 px. La nova regressió comprova
que premium conserva les dades i accions de la normal, combina les fotos
i no obre el panell automàticament. Els pins i escuts no s'han modificat.
TypeScript conserva els mateixos tres errors previs. No s'han desplegat
canvis ni fet commits; queda pendent la validació física a l'iPhone.

Inventari actual sense els fitxers temporals de previsualització:
164 fitxers de treball i 72 retirades de neteja de l'índex, 236 en total.
El recompte de 232 de la revisió següent és històric. No s'han fet commits,
desplegaments ni canvis remots; els bars PROVA es conserven.

## Revisió del control de versions: 26/10/2026

El recompte original de 215 pendents acumulava diverses tasques anteriors:
migració d'Expo, mapa, perfil, partits, icones, escuts i serveis. No correspon
només a l'últim redisseny. No s'han descartat canvis funcionals per reduir
artificialment el recompte.

- 56 PNG antics sense referències s'han apartat a una còpia local ignorada,
  `.expo/unused-icons-before-vector-cleanup/`. Es conserven els 8 bitmaps
  de marques i pins que encara utilitza `AppIcon`; la resta són vectors.
- 51 fitxers de memòria cau d'Expo i 21 còpies d'assets han sortit de l'índex
  amb `git rm --cached`. Tots continuen al disc. Les 21 còpies s'han comparat
  byte a byte amb els originals canònics versionats abans de retirar-les.
- `.gitignore` ja excloïa aquestes rutes. No ha calgut afegir exclusions de
  codi, proves, escuts o configuració per amagar canvis pendents.
- Les 72 retirades apareixen com a eliminacions preparades fins al pròxim
  commit. No són 72 fitxers funcionals nous ni s'han esborrat originals.

Inventari del treball pendent després de la neteja, sense previsualitzacions:

| Grup | Fitxers | Criteri |
| --- | ---: | --- |
| Codi de l'app | 54 | Canvis acumulats de les funcionalitats anteriors i del perfil actual |
| Configuració i manteniment | 19 | Expo, dependències, Firebase, migracions i scripts explícits |
| Backend | 7 | Fonts i configuració existents; no s'han desplegat en aquesta revisió |
| Web | 1 | Millora preexistent dels errors de registre; conservada |
| Assets canònics | 53 | 41 escuts femenins, 8 bitmaps d'icones i 4 assets de mapa |
| Proves de regressió | 21 | Cobreixen funcionalitats reals; no són mockups de l'app |
| Documentació | 5 | Guies i auditoria sincronitzades amb els canvis |
| Retirades de l'índex | 72 | Només memòria cau i duplicats locals |

Són 160 fitxers de treball i 72 retirades de neteja, no 232 funcionalitats
modificades. No s'ha fet cap commit ni s'ha esborrat informació remota.
Els scripts administratius de dades PROVA continuen sent explícits i no
s'executen en iniciar l'app. Els bars PROVA creats anteriorment no s'han
eliminat de Firebase.

El perfil integra ara les preferències a la mateixa pàgina i desa noms i
cognoms automàticament; no hi ha modal de configuració, desament manual,
botó de notificació de prova ni versió fictícia. `storage.rules` coincideix
amb les regles publicades, comprovat amb consultes de lectura.

Validació: 77 proves de regressió correctes i exportació iOS/Hermes
completada. Perfil comprovat al navegador a 320 i 1280 píxels, amb
persistència després de recarregar i sense desbordament horitzontal.
Al mapa real, els gestos tàctils simulats intercanvien Køge–Barça i
Barça–Alavés en ambdós sentits, sense activar el filtre accidentalment
i conservant-lo si ja estava activat. També s'han comprovat sis
intercanvis seguits del component, moviment reduït i gestos verticals.
Queda pendent la comprovació física a l'iPhone, inclosa la foto de perfil.
TypeScript conserva tres errors previs, aliens a aquesta revisió.

---

## 1. 📦 Dependències a eliminar (root `package.json`)

Confirmat via `grep` — cap import a tot el codi font:

- [x] `axios ^1.13.5` — substituït per `fetch` natiu
- [x] `crypto-js ^4.2.0` — `expo-crypto` ja s'utilitza en lloc seu
- [x] `ical.js ^2.2.1` — sense ús
- [x] `@react-native-firebase/app ^19.0.0` — el projecte fa servir el SDK JS modular (`firebase` v12)
- [x] `@react-native-firebase/auth ^19.0.0` — idem
- [x] `@react-native-firebase/firestore ^19.0.0` — idem
- [x] `@react-native-community/hooks ^100.1.0` — sense ús
- [x] `@react-native-picker/picker 2.11.4` — sense ús
- [x] `expo-web-browser ~55.0.10` — sense ús
- [x] `expo-auth-session ~55.0.9` — sense ús (Apple/Google ja gestionats per altres SDKs)

**Acció:** ✅ `npm uninstall` executat — 24 paquets eliminats.

---

## 2. 🗑️ Fitxers / carpetes mortes

- [x] `app/src/utils/GoogleMaps.native.tsx` — re-exportació de `react-native-maps` no importada enlloc
- [x] `app/src/services/index.ts` — barrel file no importat enlloc (ningú fa `from '../services'`)
- [x] `dist-android/` — artifact de build (ja a `.gitignore`)
- [x] `functions/lib/` — output compilat de Cloud Functions (ja a `.gitignore`)
- [x] `web-app/.next/` i `web-app/tsconfig.tsbuildinfo` — artifacts de build (ja a `.gitignore`)
- [ ] `firebase/firestore/migrations/` — verificar si encara és rellevant o ja s'ha aplicat tot
- [x] `android/build/` — output de Gradle (`android/` a `.gitignore`)

---

## 3. 🌐 Compatibilitat web (estat: ✅ COMPLETAT)

- [x] Shim `react-native-maps` (placeholder amb branding Barça)
- [x] Shim `@react-native-google-signin/google-signin`
- [x] Shim `expo-apple-authentication`
- [x] Shim `@react-native-async-storage/async-storage`
- [x] Firebase auth amb `Platform.OS` guard
- [x] `sketchShadow()` retorna `boxShadow` al web i shadow* a natiu
- [x] `MatchCard` import de `Platform` afegit
- [x] CSS `background:` → `backgroundImage:` a `BarDashboardScreen.styles.ts`

---

## 4. ⚙️ Configuració TypeScript (estat: ✅ COMPLETAT)

- [x] `tsconfig.json` (root) — `ignoreDeprecations: "5.0"`
- [x] `app/tsconfig.json` — `ignoreDeprecations: "5.0"`
- [x] `web-app/tsconfig.json` — `ignoreDeprecations: "5.0"`
- [ ] Revisar duplicació entre `tsconfig.json` (root) i `app/tsconfig.json` — possible consolidació
- [ ] Considerar migració `moduleResolution: "node10"` → `"bundler"` (recomanat per TS 5+ amb Metro/Expo)

---

## 5. 🧹 Inconsistències i refactor menors

- [ ] `app/src/services/index.ts` — eliminar (no s'usa) o adoptar pattern barrel a tot arreu
- [ ] `MapScreen.tsx` (~2700 línies) — molt llarg, candidat a partició:
  - Extreure `BarMarker`, `MapControls`, `BarBottomSheet` com a components separats
  - Moure handlers d'esdeveniments a custom hooks (`useBarFilters`, `useMapBounds`)
- [ ] Estils inline repetits amb `Platform.select` a `MapScreen.tsx` (8+ ocurrències) — extreure a `sketchShadow()` o helpers a `theme/`
- [ ] Convenció de noms inconsistent: alguns serveis usen `fetchX` i altres `getX` (ex. `fetchAllMatches` vs `getOwnedBar`) — unificar a `fetchX` per coherència
- [ ] `app/src/screens/ReportBar/` — verificar si la pantalla està connectada al navigator

---

## 6. 🔐 Seguretat

- [ ] `android/app/google-services.json` — confirmar que NO conté secrets sensibles (només identificadors públics)
- [ ] `androidGoogleMapsApiKey` a `app.json` exposada en clar — restringir per package name + SHA-1 al Google Cloud Console
- [ ] Revisar `firestore.rules` — assegurar que no hi ha regles `allow read, write: if true`
- [ ] Cap `.env` ni claus privades commitejades (verificar amb `git log -p`)

---

## 7. 📚 Documentació pendent

- [ ] `README.md` — actualitzar instruccions de dev (`npx expo start --port 8081 --clear`)
- [ ] Documentar el patró de shims web a `app/src/shims/README.md`
- [ ] `docs/stripe-billing-setup.txt` — convertir a `.md` per coherència

---

## 8. 🚀 Millores futures (no bloquejants)

- [ ] Afegir tests (cap test al projecte actualment) — començar amb `services/` (lògica pura)
- [ ] Configurar ESLint + Prettier amb regles compartides
- [ ] CI/CD: GitHub Actions per `tsc --noEmit` + lint a cada PR
- [ ] Migrar `console.log` de debug a un logger configurable (ex. `app/src/utils/logger.ts`)
- [ ] Considerar React Query / TanStack Query per substituir `executeRequest` + estats manuals de loading

---

## 📊 Resum executiu

| Categoria | Total | Fets | Pendents |
|---|---|---|---|
| Dependències a treure | 10 | 0 | 10 |
| Fitxers morts | 7 | 0 | 7 |
| Web compat | 8 | 8 | 0 |
| TS config | 5 | 3 | 2 |
| Refactor | 5 | 0 | 5 |
| Seguretat | 4 | 0 | 4 |
| Docs | 3 | 0 | 3 |
| Millores | 5 | 0 | 5 |

**Prioritat suggerida:** 1 → 2 → 6 → 5 → 4 → 7 → 8
