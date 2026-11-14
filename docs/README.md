# Documentacio del projecte

Totes les ordres de les guies s'executen des de l'arrel del repositori,
excepte quan s'indica expressament un altre directori.

## Missatgeria i errors

Els errors capturats es tradueixen amb `getUserFriendlyError` abans d'arribar
a la vista: nomes es mostren missatges coneguts, mai `error.message`, codis,
respostes HTTP o traces. Els errors desconeguts tenen una resposta estandard
en catala. `executeOrThrow` conserva l'error original per mantenir els codis;
no s'ha de mostrar directament. `sanitizeUserMessage` afegeix un segon filtre
a la presentacio, pero no substitueix aquesta traduccio.

Els avisos transitoris fan servir `showAlert` i un unic host actiu.
Un modal natiu te un `AlertBannerHost` prioritari dins de la seva propia
superficie: els avisos no poden quedar amagats darrere del modal ni duplicats.
Els formularis i els errors contextuals fan servir `UserNotice`, amb la mateixa
tipografia, colors i accessibilitat. Els reintents conserven el seu context.
La superficie comuna es grana amb text crema, sense titols generics repetits.
El recompte/carrega de cerca del mapa tambe reutilitza `UserNotice`; la fitxa
del local comparteix colors i radi i disposa d'un host prioritari per als errors.
Els controls de tancar i les accions mantenen una zona tactil de 44 px.
Els dialegs natius es reserven per decisions (confirmar una eliminacio o
escollir una aplicacio), no per notificar errors.

Els errors gestionats es registren a la consola de desenvolupament amb
`console.info`, no amb `console.error`/`console.warn`, que React Native
converteix en avisos tecnics visibles de LogBox a Expo Go. No s'ha desactivat
LogBox globalment ni s'han amagat errors de renderitzat o de tercers.
La consola no es telemetria persistent de produccio: cal connectar un receptor
privat, amb redaccio de dades sensibles, abans d'activar monitoratge remot.

La recuperacio de contrasenya no confirma si un compte existeix; bloqueja
peticions simultanies i nomes confirma despres de la resposta del servei.
Un problema de xarxa no es presenta com un enviament correcte.

## Descoberta de locals al mapa

El panell del bar i els comptes normals comparteixen la ruta `Map`; no hi ha
un segon navegador per als propietaris. L'acces des del panell reutilitza aquesta
ruta amb `popTo` i conserva la transicio horitzontal de la pila. El component
natiu es munta immediatament i es conserva en perdre el focus, sense un segon
mapa ni canvis de proveidor. La carrega es local, no un splash opac global.
La disponibilitat continua depenent d'`onMapReady`, no de `onLayout`.
Els proveidors son MapKit a iOS i Google a Android i al web.

`barDiscoveryService.ts` combina OpenStreetMap amb Google Places **nomes en
cerques explicites**, mai en moure el mapa. La cerca escrita espera un segon
i demana un maxim de 5 locals; l'escaneig manual demana com a maxim 20 de
Google en un radi de fins a 5 km, a mes dels d'OSM. No es pot garantir un
cataleg exhaustiu: la interfície indica cobertura parcial quan falla una font.
La consulta publica «Zurito Terrassa» a Nominatim va retornar buida; la
comprovacio real de Places va retornar un local «Zurito Terrassa».
Els suggeriments de local ara son
seleccionables i obren la fitxa, en lloc de limitar-se a recentrar el mapa.

Hi ha reutilitzacio de peticions simultanies i recents (5 minuts, memoria de
sessio, no AsyncStorage), i un limit de 60 peticions Google per hora i instancia.
**No es un pressupost global de facturacio**: tancar/reobrir l'app el reinicia.
Configura quotes i alertes de pressupost a Google Cloud abans d'un desplegament
public i revisa els termes de Places/EEA i la retencio autoritzada del contingut.
Els Place IDs es poden conservar; no converteixis la reutilitzacio de sessio en
una replica permanent del cataleg Google.

El mapa base conserva el proveidor original de cada plataforma: MapKit a iOS
i Google Maps a Android i web. No es pot forcar Google a iOS nomes canviant
el JavaScript: caldria una build nativa compatible, una clau i el SDK d'iOS
habilitat. Les atribucions no s'han d'ocultar. Cal revisar els termes aplicables
de Places: les restriccions EEA de contingut associat a qualsevol mapa no
desapareixen perque el mapa base sigui Google.
Al web, centre i zoom inicials es passen a `GoogleMap` mitjancant `options`
memoritzades. `defaultCenter` i `defaultZoom` no son propietats compatibles amb
`@react-google-maps/api`. Les opcions estables eviten reiniciar la camera quan
`idle` actualitza el pare; no hi ha una cadena de temporitzadors per recentrar.

Els punts grisos continuen sent de 16 px visuals, pero la zona tactil es de
44 x 44 px. Els nodes, ways i relations OSM utilitzen IDs separats
(`osm_node_123`, `osm_way_123`, `osm_relation_123`); els reports antics
`osm_123` continuen admesos. Noms iguals nomes es dedupliquen si tambe son
propers: un altre bar al costat ja no es descarta nomes per estar a menys de
50 metres. Les cerques descartades no poden sobreescriure l'entrada actual.

**Activacio del report:** desplega les regles Firestore actualitzades abans
de distribuir aquesta versio. Admeten els nous IDs OSM i `google_<placeId>`,
amb les mateixes restriccions de reports inactius. No s'han desplegat en
aquest canvi. Les proves de l'emulador cobreixen IDs nous/antics, Place ID
incoherent i intents d'assignar propietat o activar el local.

## Guies de configuracio

- **Perfil del bar:** un unic boto «Desar canvis» al final actualitza totes
  les seccions en una escriptura. Les xarxes retirades s'eliminen del mapa
  de xarxes, no es recuperen per una fusio de camps. Canviar de pestanya
  conserva l'esborrany. Mapa, enllacos legals, tancament de sessio i navegacio
  enrere demanen desar, descartar o continuar editant si hi ha canvis.
  Un error de desament conserva l'esborrany i no permet sortir com si s'hagues
  desat. Al web, tancar o recarregar la pestanya fa servir l'avis natiu del
  navegador; aquest no permet garantir escriptures asincròniques en tancar.

- [Beta web per a propietaris de bars](guides/WEB_BAR_BETA.md): correccions
  locals, proves amb emuladors, evidencia visual i bloquejos d'activacio.

- [Correus d'autenticacio](guides/AUTH_EMAIL.md): disseny compartit,
  recuperacio i verificacio, vistes previes i requisits d'enviament i domini.

- [Sincronitzacio de partits](guides/MATCH_SYNC.md): fonts, desplegament
  independent, recuperacio de fases i proves.
- [Notificacions](guides/NOTIFICATIONS.md): contractes, permisos i requisits
  pendents abans d'activar el backend.
- [Fotos de perfil i Storage](guides/PROFILE_PHOTO_STORAGE.md): regles,
  verificacio a Firebase Console i proves al dispositiu.
- [Facturacio amb Stripe](guides/stripe-billing-setup.txt): configuracio i
  flux de subscripcions.

## Revisions i planificacio

- [Previsio vigent del primer mes](planning/FIRST_MONTH_FORECAST.md):
  100 persones, iPhone/TestFlight, registre de bars gratuit i cap premium.
  [Excel nou d'un sol full](planning/TROBAR_PRIMER_MES.xlsx) i
  [PDF de dues pagines](planning/COST_FORECAST.pdf): pagaments confirmats,
  consum previst i comparativa de mes us; sense quotes inventades.
  El [model tecnic anterior](planning/COST_FORECAST.md) i el
  [pressupost de dotze mesos descartat](planning/APP_COST_PLAN.md)
  es conserven nomes per tracabilitat.
- [Auditoria i historial de revisions](reviews/AUDIT.md). Les dates i els
  recomptes son historics; no substitueixen una execucio actual de les proves.
- `planning/`: material de planificacio i candidatures; s'hi conserva la
  carpeta local de la candidatura Impulsa Startup 2026.
- `local/`: apunts personals ignorats per Git, inclosa la guia local de
  l'emulador si existeix en aquesta maquina. No hi posis documentacio comuna.

## On posar cada cosa

| Tipus | Ubicacio |
| --- | --- |
| Guia compartida | `docs/guides/` |
| Revisio o auditoria | `docs/reviews/` |
| Planificacio del projecte | `docs/planning/` |
| Regles, indexs, esquema i migracions | [firebase/](../firebase/) |
| Proves de l'app i les eines | [tests/](../tests/) |
| Proves de Cloud Functions | [functions/test/](../functions/test/) |
| Eines executables de manteniment | [scripts/](../scripts/) |
| Exports, logs, captures i diagnostics locals | `.local/`, ignorat per Git |

Els secrets i fitxers d'entorn continuen en els llocs que esperen les eines.
No els moguis a documentacio, no els copiïs als exports i no els versionis.

## Firebase

- [Regles Firestore](../firebase/firestore/firestore.rules)
- [Indexs Firestore](../firebase/firestore/firestore.indexes.json)
- [Esquema de dades](../firebase/firestore/schema.json)
- [Migracions](../firebase/firestore/migrations/)
- [Regles Storage](../firebase/storage/storage.rules)
- [Configuracio CLI](../firebase.json)

Les rutes de `firebase.json` son relatives a l'arrel. El trasllat no canvia
el contingut dels permisos ni desplega res. Les migracions i els seeds nomes
s'executen explicitament; iniciar Expo no ha de modificar dades remotes.

## Presentacio dels bars premium de demostracio

El panell del propietari obre una vista de gestio amb fons crema, targetes
blanques i accents grana: identitat del local, proper partit, acces a l'edicio,
previsualitzacio publica, serveis, promocio, mapa i ressenyes reals de troBar.
No inventa visites ni ingressos. La separacio entre operativa, perfil public
i configuracio s'inspira en les guies publiques de MyStore de Too Good To Go:
[edicio del perfil](https://tgtg.zendesk.com/hc/en-us/articles/36408427319058-How-do-I-change-or-update-my-store-name)
i [estadistiques](https://tgtg.zendesk.com/hc/en-us/articles/36408818828818-How-do-I-review-my-store-s-performance-statistics).
No s'ha inspeccionat el portal privat. L'editor conserva la paleta grana local,
sense modificar els colors globals.
L'ordre d'edicio es descripcio, promocio, serveis, partits, xarxes i finalment
la visibilitat de la puntuacio de Google. Aquesta preferencia continua sent
opcional i independent de les ressenyes de troBar.
Totes les seccions es mostren directament a l'editor, amb un unic Desar al final.
Els accessos de la vista de gestio desplacen fins a la seccio corresponent.
Desar torna al resum nomes quan ha tingut exit; una fallada conserva l'esborrany.
Tornar al resum o a configuracio no descarta els canvis. Sortir del panell
continua demanant desar o descartar.
La capcalera conserva la identitat grana i mostra la primera fotografia propia
quan n'hi ha. Els filtres i les targetes de partits fan servir els colors
`EDITORIAL.masculine` i `EDITORIAL.feminine`, amb noms accessibles i sense
simbols de genere. No hi ha filtre Tots: cap seleccio mostra tots els partits,
i tornar a tocar el genere actiu elimina el filtre. Seleccionar tots nomes
afecta els partits del filtre actiu.
Els enllacos de termes, privacitat i contacte son al peu de configuracio,
amb els mateixos estils compactes dels comptes normals i la versio configurada.
El contingut de configuracio omple l'altura disponible: el grup de compte i el
peu legal queden a baix, sense afegir un espai fix ni limitar el desplacament.
Canviar subscripcio mostra les tres periodicitats del mateix Premium. En locals
de prova nomes canvia la simulacio de la sessio; no invoca Stripe. En locals
reals l'estat s'obte de Stripe, es comparteixen les lectures simultanies i es
torna a comprovar en recuperar l'app despres del pagament extern.
El boto Mapa del panell obre el mateix `MapScreen` que els comptes normals:
cerca, filtres, partits, GPS, fitxes i rutes no tenen una versio reduida per a
propietaris. Des del mapa, Perfil retorna al panell si el compte es de bar.
El mapa es conserva en recuperar el focus, amb la camera, seleccions i dades.
En entrar-hi amb un compte de bar, es consulta la propietat real, se centra el
local i s'obre nomes la fitxa compacta. El pin «El teu bar» queda destacat i fora
de les agrupacions. No es demana GPS automaticament; el boto d'ubicacio demana
permis explicit i una peticio tardana del local no sobreescriu aquesta eleccio.
Sense ubicacio GPS no es calcula cap ruta de pagament del local cap a si mateix.
Les entrades i els canvis entre resum, editor i configuracio llisquen
horitzontalment, respectant la preferencia del sistema de reduir moviment.
El layout no es considera una carrega correcta: cal `onMapReady`.
La carrega es local i no bloqueja el splash global; el control d'error no
canvia el proveidor ni crea un segon mapa.

`app/src/data/premiumDemoProfiles.ts` completa localment nomes els tres IDs
`test-terrassa-pantalles`, `test-terrassa-terrassa` i
`test-terrassa-accessible`, sempre amb `isTestData === true` i
`tier === 'premium'`. No identifica demos pel nom ni modifica Firestore.
Els noms, adreces, ofertes, perfils socials i ressenyes son ficticis; les
fotografies son illustratives. Es conserven les coordenades, el propietari,
el tier i els enllaços als partits reals dels documents originals.

`enrichPremiumDemoBar(bar)` retorna la presentacio enriquida (o el mateix
objecte per a qualsevol altre bar). `getPremiumDemoReviews(bar)`,
`getPremiumDemoReviewStats(bar)` i `getPremiumDemoHours(bar)` retornen dades
locals deterministes o `null` per seguir el flux normal. Les estadistiques
de la fitxa compacta i del modal han de venir del mateix helper.
`isPremiumDemoBar(bar)` es la porta d'entrada comuna.

La presentacio utilitza textos naturals, sense repetir etiquetes de demostracio.
`ownerDemoCopy` substitueix nomes els textos exactes originals del seeder;
conserva les edicions del propietari, inclosos els camps buits.
Els botons socials i de seguiment
mostren un avis intern, sense obrir comptes externs ni escriure dades.
No permet editar serveis d'aquests perfils. Els usuaris identificats poden
afegir i eliminar la seva ressenya de prova: es desa nomes en aquest dispositiu
amb AsyncStorage, separada de les ressenyes sintetiques i de Firestore.
Les ressenyes sintetiques no s'han de desar com a valoracions publiques.

El panell i el mapa comparteixen `OwnerBottomNav`: Mapa, Perfil i Configuracio,
amb la pestanya seleccionada i espai per a la zona segura. Els usuaris normals
conserven el seu navegador. El dialeg de canvis pendents te una X, una accio
principal de desar i sortir i una secundaria de descartar; desar ha de completar-se
abans de navegar.

El mapa es munta immediatament i conserva el proveidor original de cada
plataforma: Apple MapKit a iOS, Google Maps a Android i Google Maps JavaScript
al web. Es el mateix per a usuaris i propietaris. No canvia de proveidor per
temporitzador ni es desmunta en perdre el focus. Un control de 8 segons mostra
un error si no arriba `onMapReady`; no retarda la carrega ni crea un segon mapa.
Nomes el boto de reintent pot recrear la vista. El layout no es considera prova
que el mapa estigui preparat.

La regressio es va introduir en forcar Google tambe a iOS, on anteriorment
s'utilitzava MapKit. L'auditoria de Google Cloud del 2026-11-03 va confirmar
el SDK de Maps per a Android habilitat i la clau nativa alineada amb la configuracio
de l'app. El SDK de Maps per a iOS no estava habilitat; no s'activa perque aquesta
plataforma torna a MapKit. Places, fotos, cerques i rutes externes son independents
del proveidor del mapa base. La comprovacio web no substitueix la prova nativa.

## Splash i logo animat

`GlobalSplash` es mante muntat durant la carrega de fonts; no se substitueix per
una altra instancia. El GIF empaquetat es precarrega en natiu i es mostra amb `expo-image`,
amb reproduccio automatica i cache. El titol nomes apareix quan les fonts estan
preparades i `onDisplay` confirma que la imatge s'ha dibuixat. Cada nova aparicio
espera el seu propi esdeveniment. Un error de descodificacio es registra i activa
el PNG empaquetat; no es presenta el titol sol com si el GIF hagues funcionat.
El GIF anima el logo sense afegir oscil·lacions JavaScript.
Al web, el splash HTML segueix el mateix ordre imatge/titol i no desapareix
per un temporitzador arbitrari mentre React encara no esta preparat.

No es consulten ni mostren opinions escrites de Google Maps. El perfil pot
mostrar nomes la mitjana i el recompte de valoracions, amb atribucio a Google
Maps i separats del mur de troBar. Es reutilitzen els detalls de Places.
`showGoogleRating` es un boolea editable pel propietari al panell; nomes
`true` activa aquesta seccio. Els perfils demo mai mostren puntuacions reals
de Google. Cal desplegar les regles actualitzades per desar la preferencia.

`npm run test:firestore` executa les regles contra `demo-trobar-reviews` a
`127.0.0.1:8085`. Requereix Firebase CLI i Java, no desplega regles ni modifica
dades remotes. Els IDs antics de ressenya es mantenen; les noves fan servir
l'UID de l'autor per evitar duplicats concurrents. Els agregats es llegeixen
del servidor, no es recalculen amb escriptures del client.

La bateria de l'emulador tambe cobreix tots els camins Firestore del client:
lectures publiques de partits/competicions/equips/bars; reports OSM anonims i
autenticats; edicio del bar, galeria, emissions i posts del propietari;
perfils/preferencies propis; seguiment, dispositius push i area privada.
Els rols i la propietat no es poden autoassignar. Les col-leccions internes
de sincronitzacio i notificacions queden per al backend amb Admin SDK.
L'enriquiment de Places nomes s'escriu si el visitant es el propietari o
administrador; consultar el bar no depen d'aquesta escriptura de cache.

Validacio focalitzada:
`node --test tests\testPremiumDemoProfiles.cjs tests\testBarProfileModal.cjs`.

## Contacte de la beta

El formulari natiu/web de l'app es a `/contacte`, accessible des del perfil
i del panell de propietari. Requereix sessio i consentiment; no obre el correu.
La funcio `submitContact` desa consultes a `contactMessages` (bustia privada
per a administradors), amb la referència retornada al formulari. Els reintents
amb la mateixa referencia no dupliquen missatges; un limit transaccional
d'un enviament per minut/usuari protegeix la bustia. `contactRateLimits` es
privada i no conte el text de la consulta. No hi ha notificacio automatica
per correu: l'equip consulta la bustia a Firestore.

La preparacio i el desplegament aillat son a `scripts\prepareContactDeploy.cjs`;
no inclou Stripe ni la sincronitzacio esportiva. La guia principal detalla
les ordres. Proves: `node --test functions\test\contact.test.cjs` despres de
compilar functions, i `node --test tests\testContactScreen.cjs tests\testContactService.cjs`.
La prova d'integracio `functions\test\contact.emulator.cjs` executa el callable
i les transaccions reals contra l'emulador, mai contra produccio.
