# Trobar 📍🍺

Una aplicació mòbil i web feta amb React Native i Expo per trobar els millors bars on veure partits d'esports (especialment del Barça).

## Mapa del repositori

| Carpeta | Contingut |
| --- | --- |
| [app/src](app/src/) | Aplicació React Native: pantalles, components i serveis |
| [web-app](web-app/) | Web Next.js, amb dependències i configuració pròpies |
| [assets](assets/) | Originals compartits de les imatges i altres recursos |
| [firebase](firebase/) | Regles de Firestore i Storage, índexs, esquema i migracions |
| [functions](functions/) | Cloud Functions i les seves proves de backend |
| [scripts](scripts/) | Eines de desenvolupament, dades i preparació de desplegaments |
| [tests](tests/) | Proves locals de l'app i dels scripts |
| [docs](docs/README.md) | Índex de guies, revisions i documentació del projecte |
| [plugins](plugins/) | Plugins locals d'Expo |
| [public](public/) | Plantilla HTML i recursos públics d'Expo web |

Els fitxers d'entrada i configuració d'Expo, Firebase, TypeScript i npm es
conserven a l'arrel perquè les eines els descobreixin sense opcions especials.
`firebase.json` apunta a les regles i els índexs de `firebase/`.

Els imports d'imatges de l'app i la configuració d'Expo apunten directament
a `assets/app/`. No han de dependre de la junction local `app/assets`:
aquest enllaç no existeix als clons nets de Vercel o EAS.

Les sortides locals no es versionen: `.local/exports/` conté els exports de
validació, `.local/logs/` els logs, `.local/screenshots/` les captures i
`.local/diagnostics/` els diagnòstics. Els exports i logs antics s'hi han
traslladat, no eliminat. `.expo/`, `dist/`, `android/`, `functions/lib/` i
`web-app/.next/` es mantenen a les ubicacions estàndard de les eines.
No hi desis documentació o fonts; consulta [la guia](docs/README.md) per
triar la ubicació d'un fitxer nou.

### Ordres habituals

Executa-les des de l'arrel del repositori:

```powershell
npm test
npm run export:web
npm run export:ios
```

Les exportacions noves van a `.local/exports/web/` i `.local/exports/ios/`.
Les migracions són explícites: `npm run db:migrate:status`,
`npm run db:migrate:dry-run` i `npm run db:migrate`. Arrencar Expo no aplica
migracions. Aquestes ordres consulten la base configurada a l'entorn i
`db:migrate` hi escriu; revisa el projecte abans d'executar-les.

### Mapa i guies de l'app

El mapa permet girar i inclinar la vista. El botó d'ubicació torna a situar
la persona i orienta el mapa al nord sense canviar el nivell de zoom.
Arrossegar el mapa cancel·la els moviments automàtics pendents i el retorn
a la vista anterior d'una fitxa. Esborrar una cerca no recentra el mapa.
Els crèdits dels proveïdors de cerca són al desplegable mentre la cerca és
oberta; no substitueixen els crèdits propis del mapa base.

La primera visita mostra la cerca, els filtres, la fitxa del bar real més
proper, les indicacions, els partits i la descoberta i confirmació de locals.
La proximitat usa el GPS o, sense permisos, el centre original del mapa.
Els passos de fitxa només apareixen si hi ha un local real disponible; no
s'inventen locals. La descoberta consulta la zona i la confirmació es mostra
en mode de lectura: la guia no registra cap bar. En acabar o ometre-la, es
recuperen la vista i els filtres originals.
Els comptes de culers i propietaris tenen guies diferents. El progrés es desa
localment amb AsyncStorage: la guia bàsica per dispositiu i les de compte
per identificador i rol. L'inici ja queda registrat perquè una guia no es
repeteixi, encara que es tanqui l'app a mig procés. No hi ha botons de repetició.
Les guies esperen el consentiment legal i els controls disponibles, i no
creen locals ni dades de demostració.

La confirmació de locals necessita les regles actuals de Firestore: admeten
els identificadors de Google Places i d'OpenStreetMap sense atorgar propietat
ni Premium. Publicar l'app o el web no publica aquestes regles.
Després de validar-les amb `npm run test:firestore`, es despleguen explícitament
amb `firebase deploy --only firestore:rules --project trobar-1123f`.

## Web Next.js de trobar.cat

El web públic es construeix des de `web-app`, no des de l'export d'Expo.
`next.config.js` sincronitza els logos, imatges, vídeos i GIF originals
d'`assets/web` a `web-app/public/assets`, fins i tot amb `next build` directe.
Els directoris generats no es versionen; els originals sí.

El disseny final del web està integrat a `main`, recuperat de la revisió del
16 de novembre de `design/unified-brand`. No cal desplegar aquell worktree
separadament: els canvis del web es publiquen des de `main`. La paleta prové
de `brand/palette.json` i `app/src/theme/brandColors.json`; els titulars usen
Lora i la marca Monofett, amb fonts locals i llicències a `assets/web/fonts`.
El nom del logo és `TROBAR` en Monofett Regular, amb un espaiat del -1% i
una corba còncava sota el cambrer. Els SVG `wordmark-cream.svg` i
`wordmark-grana.svg` d'`assets/web/logos` contenen els glifs convertits a
traçats, sense dependre de fonts remotes. L'app utilitza el PNG d'alta resolució
derivat dels mateixos traçats i el splash HTML en comparteix l'SVG.
Les icones i variants que mostren només el cambrer no es modifiquen.
La capçalera conserva el logo animat amb alternativa estàtica per a moviment reduït.
Les superfícies del web són crema: `--brand-paper` usa `palette.cream` només
al web, sense modificar el color dels correus. El selector de facturació només
canvia els imports i l'estalvi; les prestacions es mostren una sola vegada,
fora de la targeta de preu, amb el registre vinculat al període seleccionat.

El web és una entrada d'alta per a l'app, no un portal de comptes.
Una visita normal a `/registra-bar` tanca la sessió heretada i comença de zero.
L'autenticació de l'alta dura només la sessió de la pestanya; un retorn de
Stripe només recupera automàticament el compte si coincideix amb el marcador
de Checkout d'aquella pestanya. Sense aquest marcador cal tornar a introduir
les credencials. L'estat real de la subscripció continua sent l'autoritat
abans d'obrir un altre pagament o mostrar l'activació.

`/contacte` envia consultes públiques amb `submitWebContact` (europe-west1).
No crea usuaris ni requereix iniciar sessió. Desa el missatge a la col·lecció
privada `webContactMessages` i només confirma l'enviament quan Resend accepta
el correu intern a la bústia corporativa seleccionada. No envia res a
l'adreça del visitant ni activa els correus de clients. Requereix el secret
existent `RESEND_API_KEY`; les destinacions provenen de `contactEmails.json`.
Inclou consentiment, honeypot, límits d'un missatge per minut i deu per dia
per IP pseudonimitzada, i reintents idempotents durant menys de 23 hores.
Un desplegament del formulari requereix publicar primer aquesta funció:
`firebase deploy --only functions:submitWebContact`.

Els blocs «L'app» i «Comunitat» alternen vídeo esquerra/dreta en escriptori.
Fins a 600 px s'apilen, amb el vídeo abans del text en tots dos blocs.
Els vídeos tenen posters locals i conserven la marca d'aigua existent.
El propietari ha confirmat permís de publicació del material d'Artlist.

```powershell
node --test tests\testWebVisuals.cjs tests\testWebBarSignup.cjs tests\testWebContact.cjs functions\test\webContact.test.cjs
npm --prefix functions run build
npm --prefix web-app run build
npm --prefix web-app run dev
```

Després de publicar, verifica imatges i vídeos a trobar.cat: un HTTP 200/206
amb `Content-Type: text/html` pot ser una pàgina d'error, no un asset vàlid.

## 🚀 Funcionalitats

### Filtres i controls del mapa

El panell inclou 19 opcions: disponibilitat («Oberts ara», «Amagar complets»),
reserves («Reservable», «Amb reserva en línia»), esports, serveis, ambient
i accessibilitat. Les 16 amenitats d'[amenities.ts](app/src/data/amenities.ts)
continuen disponibles; «Reservable» es mostra al grup de reserves, sense duplicar-se
a serveis. Les opcions es combinen amb criteri AND i s'apliquen igual als locals
registrats i als descoberts.
Una amenitat només coincideix si consta explícitament a les dades, excepte
«Reservable», que també admet un enllaç de reserves Premium vàlid.
«Amb reserva en línia» exigeix aquest enllaç; tenir només l'amenitat no és suficient.
«Amagar complets» és opcional i exclou exclusivament els Premium marcats com a
complets per al partit seleccionat o, si no hi ha selecció, el partit visible.
Sense partit es desactiva el control. No equival a garantir disponibilitat.
«Oberts ara» exclou els locals sense horari conegut.
Els filtres de reserves mantenen una subscripció a la col·lecció de bars mentre
el mapa té focus; s'atura en treure'ls o sortir de la pantalla. Això implica lectures
Firestore addicionals, sense polling. Un error desactiva aquests filtres i avisa
l'usuari, en lloc de mantenir una disponibilitat aparentment actualitzada.
Totes les opcions són accessibles amb scroll, selecció visible,
«Netejar tot» i «Veure resultats».

Els avisos apareixen a baix, al costat dels controls originals de cerca i
ubicació, sense envair-ne la columna. Els escuts es carreguen directament:
si no hi ha imatge o falla, l'espai queda buit, sense inicials ni placeholders.

El panell de filtres conserva el fons grana: la selecció és groga, amb un
signe menys per desactivar-la. El botó de resultats no porta fletxa.
Els avisos transitoris utilitzen `react-native-toast-message`, amb el mateix
component visual que els missatges del mapa. El missatge és centrat i la
bombolla s'ajusta al contingut; durant la cerca només gira la icona del mapa.
L'host del mapa reserva espai per als controls i alinea també els avisos
transitoris a baix. Mentre n'hi ha un de visible, s'oculten temporalment els
missatges de cerca o de partit per evitar que les bombolles se superposin.

La pila de partits reserva 48 px en un marc frontal no animat, separat de la
targeta posterior absoluta. Les capes són explícites i els gestos, animacions
i reinicis comparteixen el driver JS també a iOS. Un canvi de partits o el
desmuntatge invalida les finalitzacions pendents perquè no intercanviïn dades
noves amb callbacks antics. La mida mesurada actualitza el recorregut del gest.
La detecció de categoria és compartida entre càrrega, intercanvi i renderitzat,
incloent-hi les categories antigues `FEMENI`/`MASCULI` i els partits en directe.

Validació: `node --test tests\testMapFilters.cjs tests\testMapOverlayLayout.cjs tests\testMatchCard.cjs tests\testMapMatchFilter.cjs tests\testUserMessaging.cjs`.

### Acceptació legal del compte

Només en crear el compte amb Google, Apple o correu cal completar la lectura
dels dos documents i marcar explícitament cadascuna de les acceptacions.
Els inicis de sessió i la restauració de comptes existents no exigeixen
acceptar-los, encara que no tinguin registre o les versions siguin antigues.
Un registre interromput es reprèn al mateix dispositiu gràcies a una marca
local associada al UID, que s'elimina després de confirmar el desament.
Google i Apple distingeixen un compte nou amb `getAdditionalUserInfo().isNewUser`.
Es pot rebutjar
tancant la sessió. Arribar al final és un requisit d'interfície, no una prova
que la persona hagi comprès el text.

Es desa `users/{uid}.legalAcceptance` amb les dues versions, les confirmacions
de lectura, la plataforma i `acceptedAt` amb timestamp del servidor. No es
desbloqueja la interfície fins que Firestore confirma la persistència. Un
error de xarxa manté el formulari i permet reintentar sense repetir la lectura.
Això no substitueix ni activa permisos de localització o màrqueting.

Les versions es defineixen a [legalContent.ts](app/src/data/legalContent.ts)
i es validen a [firestore.rules](firebase/firestore/firestore.rules).
**Cal desplegar aquestes regles abans de distribuir l'app nova**; les regles
anteriors no permeten el camp nou. En canviar els documents, actualitza les
versions i les regles conjuntament. Tant els documents de l'app com els del
web acaben amb «fet per frolesti» i un enllaç a https://frolesti.cat.

```powershell
node --test tests\testLegalConsent.cjs
firebase emulators:exec --only firestore --project demo-trobar-legal "node --test tests\firestoreLegalConsent.emulator.cjs"
```

- **Mapa Interactiu**: Visualitza bars propers amb un estil personalitzat (tipus esbós/llegible).
- **Filtres**: Cerca per esport o equip.
- **Detalls del Bar**: Informació sobre partits, horaris i rutes a peu.
- **Autenticació**: Registre d'usuaris amb Firebase.

Al mapa, mantén premuda la targeta del partit un quart de segon i arrossega-la
verticalment (amunt o avall) per passar-la al darrere i mostrar l'altra categoria. Un toc curt
continua activant o desactivant el filtre; un arrossegament curt torna al lloc.
Només la targeta del davant mostra el filtre actiu; en seleccionar un partit,
un avís de 2,4 segons confirma que es mostren els locals que l'han confirmat.
Els avisos del mapa queden a baix, al costat dels controls i sense tapar-los.
La bombolla sencera queda centrada a la pantalla, amb la mateixa reserva
d'espai a esquerra i dreta. Els avisos de cerca i resultats desapareixen al
cap de 3,5 segons; l'estat de càrrega continua indicat a la icona.
La lupa i el posicionament conserven les icones 3D; en mostrar resultats,
la lupa es converteix en un símbol de prohibició 3D per amagar-los.
Els pins registrats utilitzen la imatge 3D grana. El pin premium incorpora
l'escut a dalt a la dreta, en un únic PNG compost, sense transformacions de perspectiva natives.
Els locals descoberts fan servir el mateix pin 3D que els registrats, en blanc
amb contorn negre gruixut. El traç interior delimita també tota la vora del
forat i la separació entre la cara frontal i el lateral; aquests traços es
conserven a `pin-white-inner-strokes.svg` i formen part del PNG precarregat.
Els premium conserven l'escut a dalt a la dreta i utilitzen un grana vi més
fosc i fred que el vermell dels registrats. Les dues variants PNG deriven
del pin registrat original i conserven el relleu, la punta i la transparència.
Cap dels tres pins de locals no porta anells a la base: el pin original es
conserva com a font i `pin-body-mask.svg` n'aïlla el cos per als PNG del mapa.
La comparativa ampliada i a 52 px és a [map-pins-no-rings.png](docs/previews/map-pins-no-rings.png).
La X del perfil premium conserva una àrea tàctil de 44 px, amb 8 px de marge
interior superior i lateral, sense trepitjar la galeria.
Abans de muntar la navegació es descodifiquen les sis icones crítiques amb
`expo-image`, es retenen les imatges en memòria i es precarreguen les fonts
d'icones. Els pins i controls utilitzen aquestes mateixes imatges descodificades.
Si falla la càrrega, la pantalla inicial bloqueja l'accés i ofereix reintentar;
no s'obre el mapa amb icones absents.
El mapa manté el seguiment de la imatge fins que es carrega, abans de congelar
la captura nativa del marcador. Tots dos pins es redueixen en allunyar el mapa.
A Apple Maps, `centerOffset` complementa l'ancoratge inferior de Google Maps;
la separació de la bafarada es calcula amb l'alçada real del marcador.
Les fitxes de locals registrats i descoberts comparteixen plantilla i contenidor,
amb alçada intrínseca, sense desplaçament vertical del resum. Seleccionar un local
el situa prop del peu del mapa, sempre per sobre de la navegació, utilitzant la
projecció real. Es conserva la càmera completa (zoom/altitud, rumb i inclinació);
els gestos manuals de rotació i inclinació continuen habilitats. Seleccionar
un local no modifica l'orientació que l'usuari havia escollit.
Tancar la fitxa recupera la vista anterior a la
primera selecció, encara que s'hagi canviat de local entremig.
Les fitxes dels bars tenen
fons grana, la mateixa capçalera, estat, foto i adreça. Les premium afegeixen
l'etiqueta daurada i la promoció; les descobertes mostren la pregunta de confirmació
amb l'acció positiva destacada i la cancel·lació secundària al costat.
Els bars Premium poden desar un enllaç HTTPS de reserves a «Perfil > Reserves».
La targeta compacta mostra «Reservar» en groc al costat de «Com arribar-hi»;
el perfil desplegat conserva la reserva al peu i a cada partit que emet.
A «Partits que emets», el propietari pot marcar un partit com a «Complet»:
es mostra l'avís per a aquell partit i es desactiva la reserva, sense canviar
l'estat obert/tancat ni afectar altres partits. Els canvis s'apliquen amb
«Desar canvis»; desmarcar una emissió també n'esborra l'estat de complet.
Firestore desa `reservationUrl` i `fullMatchIds` al document del bar, amb
escriptura restringida al propietari Premium i aforament limitat als partits
que emet. La fitxa oberta al mapa escolta els canvis del document en temps real.
Les reserves són externes: troBar no crea reserves ni garanteix places.
Els permisos d'aquests camps estan desplegats a Firebase de producció.
El desplegament ha conservat la resta de regles publicades, sense incorporar
altres diferències locals.
Una línia discreta als perfils premium, sense text ni icones, permet
desplegar la mateixa targeta: segueix el dit mentre s'arrossega i s'assenta
oberta o plegada en deixar-la anar. També es pot plegar arrossegant avall.
Cada resum té una mesura associada a la identitat i origen del local,
per no heretar una alçada retallada. No té scroll vertical: resumeix
la valoració, l'estat, l'adreça, la distància i la promoció. Les fotos pròpies
i públiques es dedupliquen en una galeria horitzontal de tota l'amplada,
també als locals descoberts i gratuïts. Les dades extenses són a la fitxa
premium desplegada. Al mòbil,
la pila de partits es plega mentre hi ha qualsevol local seleccionat per
deixar espai a tota la targeta. A la pila de partits
només es renderitza una targeta per partit, també durant l'intercanvi.
La targeta respecta el peu de navegació. Amb un local obert al mòbil, els controls
de cerca i ubicació s'alineen en una fila sota la fitxa, sense tapar-la ni tapar el pin.
Aplicar o canviar el
filtre de partit esborra la ruta i la selecció anteriors.

La galeria, l'estat i l'adreça del resum reserven la mida des del primer render,
abans de rebre Google Places o descarregar cap foto. La fitxa es fa visible
després de la primera mesura completa; carregar imatges no en canvia la posició.
Una foto fallida es registra i mostra un estat explícit dins del mateix espai.
El perfil premium desplegat té una capçalera sense un segon marc interior,
seguiment secundari, emissions a prop de la capçalera i «Com arribar-hi» fix
fora del scroll, respectant l'àrea segura. Les seccions buides no ocupen grans
targetes decoratives. Referències de jerarquia:
[Apple Maps Place Cards](https://www.apple.com/ae/business/enterprise/connect/)
i [FANZO](https://www.fanzo.com/en/lokale/1644/pavilion-end).

Les targetes del carrusel d'emissions comparteixen l'alçada de la més alta,
sense retallar dates, fases o noms d'equip. Les estrelles del resum, les
ressenyes i el selector de valoració són plenes; el color distingeix les
estrelles puntuades de les restants.

Amb `EXPO_PUBLIC_TROBAR_ENV=development`, només el Zurito registrat amb ID
`8lyFejxdbgvn58YIZIYF` mostra tres ressenyes locals d'exemple, xarxes fictícies
i fins a tres partits de la programació com a exemples d'emissió. El resum
mostra «DEMO» i el perfil identifica les dades d'exemple. No es modifica el
document del bar ni es publiquen emissions o ressenyes a Firestore; les
accions externes de demostració continuen protegides. En producció no
s'aplica aquesta previsualització, ni tan sols amb `isTestData=true`.
La cerca manual combina OSM amb tres consultes de Google amb límits separats:
bars/pubs, cafeteries i restauració/oci nocturn (fins a 20 per grup).
Inclou bars esportius, de vins i còctels, cerveseries, cafeteries i restaurants;
OSM també inclou jardins de cervesa, menjar ràpid i zones de restauració.
Es mantenen la deduplicació, la memòria cau i el pressupost de 60 peticions
Google per hora i sessió. Les categories fallides o saturades conserven la marca
interna de cobertura parcial, sense descartar els resultats de la resta.
Les fallades de fonts queden als logs, sense avisos tècnics a la interfície;
si tota la cerca falla, es manté l'avís per tornar-ho a provar.

La descoberta conserva Google Places i OpenStreetMap, sense migrar ni fusionar
documents remots. Els resultats d'una sessió s'unifiquen per identificador o,
si no hi ha IDs de Google contradictoris, per nom normalitzat i proximitat
(50 m). Variants com «Avril's» i «Avril's Café» també coincideixen a menys
de 35 m si el nom distintiu és igual; números de portal coneguts diferents
impedeixen la fusió. Es conserva l'ID del primer pin i es prefereixen el nom,
el Place ID i l'adreça de Google, sense perdre etiquetes i serveis d'OSM.
La consulta de detalls reutilitza el mateix criteri; només els noms exactes
mantenen el radi anterior de 250 m.

Els crèdits dels resultats s'integren dins la barra de cerca existent, amb
text blanc llegible sobre el grana i enllaços a les
fonts presents i als proveïdors que ho requereixin. Les fitxes del mapa no
repeteixen aquesta línia i no hi ha cap franja de crèdits flotant al peu del
mapa. Els desplegables es posicionen segons l'alçada real de la barra de cerca,
també quan els crèdits ocupen més d'una línia. L'atribució nativa del mapa es conserva i, quan ja
identifica Google Maps, no es duplica. No es traslladen tots els crèdits als
textos legals: cal respectar les
[condicions de Google Places](https://developers.google.com/maps/documentation/places/web-service/policies)
i les [directrius d'OSM](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines).

La llista de partits acaba amb un text de calendari en lloc d'una icona.
Si una competició no té partits futurs, ho indica i, en les eliminatòries,
explica que els nous encreuaments apareixeran quan estiguin confirmats.
L'absència de partits no es tracta com una prova d'eliminació: les dades
actuals no proporcionen un estat de participació que permeti afirmar-ho.

El perfil agrupa els enllaços legals en un peu compacte; els crèdits d'icones
es poden consultar a l'apartat «Crèdits» dels termes del servei.

La interfície utilitza Barlow per a textos, títols i botons; Barlow Condensed
queda per als partits i Monofett per al nom corbat de la marca. Les antigues referències Lora són
àlies de Barlow, no una quarta família visible.

A l'accés, la mascota queda centrada a dalt, sense cercle, i el títol és
només «troBar». La imatge amb la campana oberta prové del fotograma 14
(índex des de zero) del GIF local de la mascota.

Les puntuacions i ressenyes mantenen orígens independents:
- **Google Maps**: només puntuació mitjana i recompte, identificats com a font
  externa. No es consulten ni es mostren ressenyes escrites de Google.
  El propietari pot activar «Puntuació de Google Maps» al panell del bar;
  per defecte és oculta (`showGoogleRating: false`). La puntuació reutilitza
  els detalls de Places, sense cap petició addicional ni còpia a Firestore.
- **troBar**: els usuaris identificats poden publicar una ressenya per bar
  premium i eliminar la seva. El propietari no pot ressenyar el seu local.
  Es conserven les ressenyes anteriors, inclosos els IDs antics; les mitjanes
  es calculen al servidor sense sobreescriure els documents agregats antics.
- **Demo**: les ressenyes noves es desen només en aquest dispositiu, amb una
  indicació explícita. Mai es presenten com a opinions reals de Google.

Les regles de ressenyes i seguiment són a `firebase/firestore/firestore.rules`.
Cal desplegar-les per habilitar les operacions contra el backend real.
`npm run test:firestore` les comprova amb l'emulador local (Firebase CLI i Java
necessaris); no toca el projecte de producció.
Les regles preserven les lectures públiques de partits, competicions, equips
i bars, els reports OSM i les operacions del propietari. Només el propietari
o un administrador pot desar l'enriquiment de Google al document del bar;
la resta de visitants poden consultar-lo sense escriure la memòria cau.
Els rols, les vinculacions de propietat i les dades de facturació es gestionen
des del backend, no des del perfil editable de l'usuari.

A Partits hi ha només tres filtres de competició, amb logotips: Lliga,
Champions i Copa. Cada filtre agrupa les competicions masculina i femenina;
la selecció de gènere en determina els partits i el logotip. Sense gènere
seleccionat es mostren totes dues categories. Els resultats no porten
l'etiqueta redundant «Final»; es conserva la fase de l'eliminatòria.
La navegació lateral de Partits i Perfil també està activada explícitament
al web, amb la transició inversa en tornar al mapa.
La càrrega de Partits es mostra dins de la pantalla amb un indicador local:
no activa el splash global que amagava l'animació lateral. Els controls de
gènere i competició tenen tots 40 px d'alçada, amb àrea tàctil ampliada.

### Contacte durant la beta

«Contacte i suport» del perfil i del panell de propietari obre `/contacte`,
no el client de correu. Els usuaris identificats poden enviar incidències,
millores o altres consultes amb assumpte, missatge i consentiment explícit.
El formulari conserva el text si falla l'enviament i només confirma l'èxit
quan rep una referència de la funció `submitContact`.

La bústia privada és la col·lecció `contactMessages` de Firestore: només
l'equip administrador la pot consultar. Els clients no poden llegir-la ni
escriure-hi directament; la funció valida les dades, vincula l'UID i el correu
del compte, limita els enviaments a un per minut i evita duplicats en reintents.
`contactRateLimits` és també privada. No s'envien correus automàtics.

Desplegament aïllat, sense tocar Stripe ni la sincronització de partits:
`npm --prefix functions run build`, `node scripts/prepareContactDeploy.cjs`,
i `firebase deploy --config .expo/contact.firebase.json --only functions:contact:submitContact --project trobar-1123f`.
Les dependències d'aquest paquet generat s'han d'instal·lar abans del primer
desplegament. Les regles existents ja reserven aquestes col·leccions als
administradors; `npm run test:firestore` comprova que no hi ha accés directe.

## 🛠️ Requisits Previs

- [Node.js](https://nodejs.org/): 22.13+ dins la branca 22, 24.3+ dins la branca 24, o 26+ (requisit d'Expo SDK 58).
- Gestor de paquets `npm` o `yarn`.

## 📦 Instal·lació

1. Clona el repositori (si no ho has fet ja):
   ```bash
   git clone <URL_DEL_REPOSITORI>
   cd trobar
   ```

2. Instal·la les dependències:
   ```bash
   npm install
   ```

3. Configura les variables d'entorn:
   Crea un fitxer `.env` a l'arrel del projecte amb les següents claus (necessitaràs les teves pròpies claus de Google Maps i Firebase):
   ```env
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
   
   # Firebase Configuration
   EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   ```

## ▶️ Execució

### Entorn de dades: dev o prod

Hi ha dues configuracions locals, independents del tipus de build d'Expo:

- `npm run env:dev`: selecciona `.env.development`, l'entorn habitual de treball.
- `npm run env:prod`: selecciona `.env.production`, només quan estigui configurat.

La base definitiva és `(default)` del projecte Firebase `trobar-1123f`.
El web i TestFlight `1.0.0 (2)` i `1.0.0 (3)` ja utilitzen aquest projecte; no cal recompilar
l'app per començar a utilitzar les dades definitives. Les fitxes de bars,
altes de propietari i dades de facturació de prova s'han retirat el 24/11/2026
després d'una còpia privada a Cloud Storage, a la UE. S'han conservat els
comptes personals i el catàleg esportiu. Stripe continua en sandbox.

Les etiquetes `development` i `production` no aïllen les dades: si els dos
fitxers apunten al mateix projecte, comparteixen la mateixa base. No executis
imports de demostració ni proves destructives contra `trobar-1123f`.
Les proves automatitzades de regles s'executen amb `npm run test:firestore`
contra l'emulador local, no contra producció.

El selector valida Firebase i les etiquetes d'entorn abans de canviar res.
Genera `.env` per als scripts existents i `.env.local` per a Expo; no són
entorns addicionals. `.env.local` evita que el mode de Metro
(`development`) o d'exportació (`production`) substitueixi l'entorn escollit.
No afegeixis overrides `.env.development.local` o `.env.production.local`.
Reinicia Metro després de canviar d'entorn. Un fitxer prod amb placeholders
es rebutja sense substituir el dev actiu; això no configura ni valida producció.
L'emulador Android també selecciona dev per defecte; prod requereix `-Env prod`.

El missatge **Using development build** apareix perquè hi ha `expo-dev-client`
instal·lat: indica el runtime natiu que obre el QR, no una base de dades nova.
`--clear` només neteja la memòria cau; no canvia Firebase ni recompila iOS.

Per iniciar el projecte en mode desenvolupament:

```bash
npx expo start --dev-client
```

El port `8081` queda reservat a Expo: `npx expo start --dev-client` atura el procés que l'ocupi,
comprova que s'hagi alliberat i inicia Expo al mateix terminal, sense passar al
8082. No el facis servir per a altres serveis. Si el sistema denega l'aturada,
l'ordre falla explícitament i mostra el PID, en lloc d'arrencar en un altre port.

```powershell
node scripts/devStart.js --free-only
```

Expo s'executa al mateix procés del terminal, sense un procés fill deslligat.
Pots aturar-lo amb `Ctrl+C`; si la interrupció no arriba a Expo, el terminal
s'ha tancat o Metro s'ha quedat penjat, executa `node scripts/devStart.js --free-only` des d'un altre
terminal. Aquesta ordre atura l'arbre de processos i comprova que el port es
pugui reservar de nou. La següent arrencada també el recupera automàticament,
incloses les arrencades registrades que encara no havien obert el port.
No s'arrenca cap proxy ICS.

La neteja s'integra a la configuració local i s'executa una sola vegada per
procés, només amb `expo start`, abans de seleccionar el port. No modifica Expo
ni afecta les ordres de build, exportació o consulta de configuració.
`--clear` continua netejant la memòria cau de Metro, com sempre.
No cal afegir-lo a cada arrencada: provoca expressament l'avís de memòria cau
buida i una reconstrucció del bundle. Reserva'l per a problemes de memòria cau.
Els avisos d'actualització de paquets són una comprovació diferent; es revisen
amb `npx expo install --check`, no netejant Metro.

Abans d'arrencar amb `npx expo start` (també amb `--clear`) o `npm start`,
es revisen les versions compatibles mitjançant `expo install --check --json`.
La consulta conserva els valors de l'entorn actiu, però neutralitza només en
el procés fill el marcador de logging heretat d'Expo. El lector accepta els
missatges inicials `env: load`/`env: export` i els codis de color abans del JSON;
una resposta malformada o text inesperat continua mostrant un error explícit.
Si hi ha canvis, es mostren els paquets i les versions i es demana confirmació
(`s` per acceptar; Enter per ajornar). Només després d'acceptar s'executa
`expo install --fix --npm`, que actualitza el manifest i el lockfile segons el SDK
actual, sense saltar a un SDK major nou ni fer un `npm update` general.
Després d'instal·lar, l'arrencada acaba correctament (codi 0), sense presentar
un error de configuració: torna a executar la mateixa ordre per
evitar continuar amb mòduls de la CLI antiga carregats en memòria.
Si canvien dependències natives, cal recompilar i reinstal·lar la development build.

La revisió s'executa una vegada per procés, no durant builds, exports ni consultes
de configuració. S'omet amb `--offline`, `EXPO_OFFLINE=1`, en CI, sense terminal
interactiu o amb `TROBAR_EXPO_UPDATE_CHECK=0`. Per això l'ordre d'iPhone, que
utilitza `--offline`, no consulta versions. Un error de consulta es mostra i no
impedeix iniciar Metro; una instal·lació fallida sí que atura l'arrencada.
Per consultar explícitament sense instal·lar ni iniciar Metro:

```powershell
node scripts/expoUpdates.js --check-only
```

### Preparació per a App Store

La configuració de compilació no equival a una app aprovada ni preparada per
enviar a revisió pública. La versió iOS `1.0.0 (3)`, amb la pilota visible a
la icona i el logo Monofett, està processada per Apple (`VALID`) i disponible
per a proves internes a TestFlight després de la compilació amb EAS i l'enviament
a App Store Connect. L'app registrada és `6838633050`; les proves externes
requereixen la configuració de testers i la revisió beta que correspongui.

El grup extern «Beta pública» està creat amb l'enllaç públic habilitat i un
límit verificat de 100 testers. Encara no té cap compilació aprovada per a
proves externes: la versió 3 hi està associada i continua a
`READY_FOR_BETA_SUBMISSION`, sense enviament a revisió. La descripció de la beta,
el correu de comentaris, els URL públics i les instruccions de prova estan
configurats a Apple en l'idioma principal de la fitxa (`en-US`). El titular
completarà directament a App Store Connect el contacte de revisió pendent;
cal confirmar també els accessos de prova que requereixi Apple abans d'enviar-la.
No s'ha de publicar el botó de descàrrega al web ni al portfoli fins que
l'enllaç permeti instal·lar una compilació aprovada.

Els esdeveniments Stripe signats que arribin després de retirar un bar
s'accepten sense recrear-ne les dades ni enviar correus de facturació.
Les discrepàncies de propietat entre registres existents continuen rebutjant-se.

L'enviament transaccional està activat amb `EMAIL_DELIVERY_MODE=transactional`
i `EMAIL_TRANSACTIONAL_SINCE=2026-11-24T11:34:57.690Z`: només s'envien
esdeveniments nous a destinataris verificats, sense recuperar correus històrics
ni activar consells comercials. `STRIPE_ALLOW_LIVE_BILLING=false` manté Stripe
en proves i els correus corresponents porten el prefix `[PROVA STRIPE]`.
S'ha verificat l'acceptació d'un correu real per Resend, no el lliurament final
a la bústia. Una clau restringida a enviar no permet consultar aquest
lliurament amb l'API; un 401 d'aquesta consulta no indica un error d'enviament.

Per instal·lar-la, cal instal·lar TestFlight des de l'App Store de l'iPhone,
obrir-hi el correu d'invitació i prémer «View in TestFlight», «Accept» i
«Install». No necessita Expo Go ni Metro. Les noves compilacions apareixen
com a actualitzacions dins de TestFlight; cada compilació caduca als 90 dies
de la pujada. La beta no equival a una publicació pública a l'App Store.

Preparació tècnica inclosa:

- Perfil EAS `production` amb distribució `store`, entorn `production`,
  dispositiu físic, sense development client i numeració incremental remota.
- Bundle ID `com.trobar.app` i versió comercial `1.0.0`.
- Icona iOS de 1024 × 1024, PNG RGB opac, derivada del recurs corporatiu existent.
  Usa `assets/app/img/logo/mascot-open-cloche.png`, amb la pilota visible i el
  personatge complet: alçada de 864 px, centrat amb 80 px de marge vertical,
  crema corporatiu sobre fons grana. iOS aplica les cantonades arrodonides.
  Canviar aquesta icona requereix una nova compilació i enviament a TestFlight;
  no s'actualitza desplegant el web ni amb una actualització JavaScript.
- Plugin natiu de Sign in with Apple.
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` configura tant el client Google de l'app
  com el seu esquema de retorn natiu. Ha de ser un client OAuth **iOS**
  registrat per a `com.trobar.app`, no el client web existent. És un identificador
  públic, no un secret de client.

Comprovació local sense compilació, càrrecs ni enviament:

```powershell
npm run ios:check
```

Valida l'entorn Firebase de troBar, la presència de configuració pública,
la coherència del retorn Google, Sign in with Apple i el format de la icona.
No valida restriccions de claus a Google Cloud, credencials Apple, variables
remotes d'EAS, manifests del binari compilat ni el compliment de les normes.
Si el terminal té l'entorn de desenvolupament actiu, el control falla expressament.
No s'ha canviat automàticament l'entorn local: `.env.local` té prioritat sobre
`.env.production`. Les variables públiques verificades de Firebase, Maps i
OAuth iOS ja estan configurades a l'entorn `production` d'EAS. Es pot executar
el control amb aquest entorn sense modificar la configuració local:

```powershell
npx eas-cli@latest env:exec production "npm run ios:check"
```

Els fitxers `.env` locals no es versionen ni es donen per disponibles al núvol.
No hi posis claus Stripe privades, comptes de servei o claus Apple.

Comprovacions per a la publicació pública i la revisió beta que correspongui:

1. **Alta a Apple Developer.** Cal un Apple Account amb doble factor i la
   subscripció de pagament. Si publica una entitat legal, valorar l'alta
   d'organització (amb D-U-N-S); amb alta individual el nom legal personal
   apareix com a venedor. No cal un compte per cada bar: els bars són comptes
   del nostre servei, no apps ni desenvolupadors Apple independents.
2. **App Store Connect i signatura.** L'app i la signatura de distribució ja
   estan configurades; `submit.production.ios.ascAppId` apunta a l'app real.
   Verificar el proveïdor Sign in with Apple a Firebase Auth i les
   credencials APNs a EAS amb proves natives.
   Gestionar totes les credencials amb Apple/EAS, mai al repositori ni al xat.
3. **Google natiu.** El client OAuth iOS s'ha recuperat de l'app Firebase
   existent i s'ha configurat a EAS. Verificar les restriccions de Maps per
   bundle ID i provar el login real: una compilació correcta no autentica.
4. **Premium i pagaments.** L'app actual obre Stripe per comprar i gestionar
   funcions digitals Premium. Cal definir el flux iOS segons els països
   de distribució i les regles 3.1.1/3.1.3: no assumir que vendre a bars n'eximeix.
   troBar també mostra els perfils promocionats, de manera que no es pot
   donar per aplicable l'excepció d'app exclusivament de gestió publicitària.
   Valorar IAP o un flux permès i verificar-lo abans de distribuir.
   Les reserves de serveis físics al bar són un cas diferent.
   No s'han activat cobraments reals ni alterat Stripe durant aquesta preparació.
5. **Ressenyes i contingut de tercers.** Les ressenyes actuals no tenen un flux
   integrat de denúncia/bloqueig; cal completar filtratge, denúncies, moderació
   i tractament d'usuaris abusius segons la regla 1.2. Revisar també fotos i textos
   publicats pels bars, així com els drets d'ús d'imatges i escuts.
6. **Mapa d'iOS.** El mapa natiu actual utilitza Apple Maps a iOS i també
   consulta Google Places. Abans de publicar cal alinear el proveïdor/dades
   amb les condicions de Google; no n'hi ha prou amb mostrar l'atribució.
7. **Privacitat.** Completar App Privacy amb les dades reals (compte, ubicació,
   fotos/ressenyes, identificadors de notificació, suport i dades del negoci),
   revisar els manifests `PrivacyInfo.xcprivacy` agregats al binari i els
   permisos. No declarar que no es recullen dades. Provar eliminació de compte,
   cancel·lació quan pertoqui i revocació Apple, així com permisos denegats.
   Validar la política pública a https://www.trobar.cat/politica-privacitat.
8. **Fitxa i revisió.** Preparar descripció, categoria, qüestionari d'edat,
   captures reals d'iPhone i iPad (l'app declara suport de tauleta), suport,
   contacte i accessos de prova per als rols d'usuari i propietari.
   Excloure dades fictícies del catàleg públic i documentar els casos de revisió.
9. **Prova nativa.** Verificar en una build real d'iPhone/iPad login amb
   correu/Google/Apple, mapa/GPS, reserves, complets/filtres, notificacions,
   permisos i eliminació. Una exportació JS o Expo Go no substitueixen aquesta prova.
   Confirmar la imatge EAS amb Xcode/SDK admesos per Apple en el moment de construir.

Per a les següents compilacions beta, amb les credencials d'EAS preparades
i després d'autoritzar qualsevol possible cost:

```powershell
npx eas-cli@latest env:exec production "npm run ios:build:production"
npm run ios:submit:production
```

L'ordre de build passa primer el control local, però no certifica compliment.
La pujada arriba a App Store Connect/TestFlight; publicar exigeix una revisió
posterior d'Apple. Windows permet EAS Build/Submit, però no compilar iOS localment.
Per consultar el processament i la disponibilitat reals a Apple:

```powershell
npx eas-cli@latest submit:status --platform ios --non-interactive
```

Fonts: [alta Apple](https://developer.apple.com/programs/enroll/),
[normes de revisió](https://developer.apple.com/app-store/review/guidelines/),
[enviament amb EAS](https://docs.expo.dev/submit/ios/),
[privacitat nativa](https://docs.expo.dev/guides/apple-privacy/).

### Provar a l'iPhone amb la build de desenvolupament (Windows)

El projecte utilitza Expo SDK 58, React Native 0.88 i React 19.3. El flux
principal és una **development build pròpia**, no Expo Go. Després de canviar
SDK, plugins o dependències natives, cal recompilar i instal·lar aquesta build:
actualitzar Metro no actualitza el binari de l'iPhone.

Per crear-la explícitament amb EAS (requereix compte, permisos i pot tenir cost):

```powershell
npx eas-cli@latest build --platform ios --profile development-device
```

`development-device` és per a l'iPhone físic; `development` és per al simulador.
Instal·la la build des de l'enllaç d'EAS abans d'obrir Metro. La configuració
nativa inclou Google Maps, però el mapa actual només selecciona aquest proveïdor
a Android; a iOS encara utilitza Apple Maps. Disposar del mòdul natiu no equival
a activar-lo: abans de publicar cal alinear el proveïdor d'iOS amb les condicions
d'ús de Google Places quan es representen les seves dades sobre un mapa.
Cal habilitar **Maps SDK for iOS** i **Places API (New)** al projecte de la clau.
La política `runtimeVersion: fingerprint` separa les futures OTA segons les
dependències natives; no repara ni actualitza les builds antigues instal·lades.

Fes servir una finestra PowerShell normal, situada a l'arrel del repositori:

```powershell
cd C:\Users\USER\Repos\trobar
.\scripts\startIphone.ps1
```

Aquest script utilitza una memòria cau de Metro dins del projecte, anuncia
la IP LAN activa i executa `expo start --dev-client --lan --offline`,
conservant la memòria cau. Si necessites reconstruir-la expressament, executa
`.\scripts\startIphone.ps1 -Clear`.
Deixa el terminal obert i obre el QR amb la càmera o amb la development build
troBar instal·lada. La configuració de desenvolupament pot recuperar el port
8081: no arrenquis una segona sessió si n'hi ha una que vols conservar.

L'enllaç de desenvolupament conté aquest servidor Metro:

```text
http://<IP-LAN-DEL-PC>:8081
```

Si necessites provar expressament Expo Go, només amb una versió compatible
amb SDK 58 i amb les seves limitacions natives:

```powershell
.\scripts\startIphone.ps1 -Runtime go
```

Amb Expo Go, email/password i Sign in with Apple fan servir els mòduls inclosos a Expo Go. Google fa servir `expo-auth-session` amb el redirect proxy d'Expo, ja que `@react-native-google-signin/google-signin` necessita codi natiu i no és present a Expo Go. El proxy d'Expo és deprecated i pot fallar en navegadors que bloquegen cookies. El client OAuth web existent ha d'autoritzar `https://auth.expo.io/@frolesti/trobar-ios` com a redirect URI. El login Google natiu continua disponible en builds que inclouen `RNGoogleSignin`. EAS no és necessari per iniciar Expo Go; `npx expo start --clear` només neteja Metro. El login amb Google al web continua fent servir Firebase Popup.

`Cannot find native module 'ExpoAsset'` i l'avís d'`ExponentConstants` indiquen
que el runtime executat no exposa aquests mòduls. Les dependències JavaScript
estan instal·lades i l'autolinking Apple les inclou. Reconstrueix i instal·la
el binari correcte; no afegeixis mocks ni confiïs només en `--clear`.
`main has not been registered` pot ser conseqüència de l'error anterior.
Comprova primer `npx expo install --check` i l'autolinking local:

```powershell
node node_modules\expo-modules-autolinking\bin\expo-modules-autolinking resolve --platform apple
```

Si apareixen `ExpoAsset` i `expo-constants` però l'iPhone no els troba, revisar
el JavaScript no repara el binari instal·lat. Cal una build compatible amb
l'SDK i els mòduls actuals. A Windows no es pot compilar iOS localment;
utilitza una build compatible existent o compila en un Mac amb Xcode.
No s'ha d'iniciar automàticament una build remota ni publicar una OTA com a
substitut: una OTA tampoc no afegeix mòduls natius.

En un inici normal, conserva la memòria cau: `npx expo start --dev-client --lan`
o `npm run start:iphone`. Reserva `--clear` per a problemes de memòria cau:
obliga a reconstruir el bundle i pot allargar molt la primera connexió.
Si iOS mostra «Could not connect to development server» durant aquesta
compilació, espera que acabi i torna a carregar. Si persisteix, comprova
l'accés des del telèfon; que Metro hagi compilat no prova que la descàrrega
hagi arribat al dispositiu.

L'iPhone i el PC han d'estar a la mateixa Wi-Fi. Si no troba Metro,
obre `http://<IP-LAN-DEL-PC>:8081/status` a Safari **de l'iPhone**:
ha de mostrar `packager-status:running`. Una prova des del mateix PC no
demostra que l'iPhone pugui connectar-hi. Comprova també des del PC:

```powershell
Test-NetConnection <IP-LAN-DEL-PC> -Port 8081
```

El resultat correcte és `TcpTestSucceeded: True`. Si `http://127.0.0.1:8081` respon però `192.168.1.187:8081` falla, Metro funciona i el bloqueig és de Windows Firewall, la xarxa Wi-Fi (xarxa de convidats/isolació de clients) o una VPN. Cal permetre Node.js a la xarxa privada de Windows i desactivar temporalment la VPN; no cal reinstal·lar Expo Go ni les dependències.

Si Windows Firewall bloqueja el port, obre PowerShell **com a administrador** i executa una vegada:

```powershell
New-NetFirewallRule -DisplayName "troBar Metro 8081" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8081 -Profile Private
```

Després torna a executar `npm run start:iphone` i comprova de nou `Test-NetConnection`. Si continua fallant, el router probablement té activada la isolació de clients o el PC i l'iPhone no són a la mateixa xarxa privada.

Per aturar Expo, prem `Ctrl+C` al mateix terminal.

Això obrirà el Metro Bundler. Des del terminal pots introduir les opcions:
- **`w`** : Per obrir la versió **Web** al navegador.
- **Escanejar QR** : Obre la development build de **troBar** instal·lada.
- **`a`** : Per obrir en un emulador Android (requereix Android Studio).
- **`i`** : Per obrir en un simulador iOS (només macOS, requereix Xcode).

## 📱 Tecnologies

- **Frontend**: React Native, Expo, React Navigation.
- **Mapes**: React Native Maps (natiu), Google Maps JS API (web).
- **Backend / BaaS**: Firebase (Authentication, Firestore Database).
- **Llenguatge**: TypeScript.

## Proves Premium a Terrassa

Hi ha tres bars ficticis a la base actual, identificats amb `PROVA` i
`isTestData: true`. No representen negocis reals, les fotografies són
il·lustratives i no tenen cap subscripció Stripe. El compte de proves vinculat
entra al panell del propietari després de tancar i tornar a obrir sessió.
El panell actual edita un únic bar principal: **PROVA - Pantalles Terrassa**.
Per comprovar el mapa com a client, utilitza una altra sessió o entra com a convidat.

| Bar | Emissions explícites inicials | Combinacions de serveis |
| --- | --- | --- |
| PROVA - Pantalles Terrassa | Barça - Alavés, 31/10/2026; Køge - Barça, 29/10/2026 | Projector + múltiples pantalles + wifi; reserves + menjar |
| PROVA - Terrassa exterior | Barça - Aston Villa, 03/11/2026 | Terrassa + mascotes + wifi + cervesa artesana |
| PROVA - Accessible Terrassa | Badalona - Barça, 01/11/2026 | Accessible + aire condicionat + múltiples pantalles + aparcament |

La regla existent continua vigent: el pròxim partit global apareix implícitament
a tots els bars registrats. Per comprovar emissions exclusives, selecciona un
altre partit; per exemple, Barça - Alavés + projector mostra Pantalles, mentre
que Barça - Alavés + accessible no ha de donar resultats. Les emissions de la
taula són les inicials: poden canviar si les edites al panell o si els partits
deixen de ser futurs. El panell de proves no consulta Google Places ni ofereix
controls de facturació real.

El seed consulta partits reals existents i exigeix un compte d'Auth existent.
Per defecte només previsualitza. Necessita `gcloud` autenticat amb permisos
d'administració al projecte `trobar-1123f`:

```powershell
node scripts/seedPremiumBars.js --owner-email=correu-del-compte
node scripts/seedPremiumBars.js --owner-email=correu-del-compte --apply
node --test tests/testSeedPremiumBars.cjs
```

`--apply` crea només els documents de prova que falten, conserva els bars ja
editats, vincula el bar principal i assigna el rol `bar_owner`. No sobreescriu
altres propietaris ni comptes administradors. Les escriptures Firestore són
atòmiques i condicionades a la versió llegida o a la inexistència del document.
La còpia local `.expo/terrassa-premium-backup.json` conserva el rol i les
vinculacions anteriors per poder-los restaurar; no la comparteixis ni la
versionis. La retirada dels fixtures és administrativa, no hi ha una ordre
automàtica de neteja: no eliminis el compte ni les seves dades personals per
retirar aquests bars.
