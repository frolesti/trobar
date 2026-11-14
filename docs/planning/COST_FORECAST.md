# Previsió de despeses de Trobar

> **Model històric, substituït per al primer mes.** Les quotes de pagament i
> reserves d'aquest document no són les despeses confirmades de la beta.
> Consulta la [previsió actual per a 100 persones](FIRST_MONTH_FORECAST.md),
> l'[Excel nou d'un sol full](TROBAR_PRIMER_MES.xlsx) i el
> [PDF actual de dues pàgines](COST_FORECAST.pdf).
> Es conserva el model tècnic anterior per traçabilitat, no com a pressupost vigent.

Data de preparació: **2 de novembre de 2026**. Moneda del pressupost: **EUR**.

## Pressupost per començar: 100 persones

**[Excel anterior de 12 mesos](TROBAR_PRESSUPOST_EDITABLE.xlsx) ·
[Informe anterior de pressupost viu](APP_COST_PLAN.md).**
El resum numèric següent conserva la base tècnica anterior, ja substituïda,
per poder contrastar els càlculs. El PDF enllaçat a l'avís superior és el nou
informe del primer mes, no un resum d'aquest model històric.
El model tècnic i els CSV es conserven més avall per poder revisar els càlculs.
No s'ha canviat el codi ni el funcionament de les betes.

Parlem de **100 persones que utilitzen l'app durant un mes per buscar bars**,
no de 100 bars ni de 100 persones connectades alhora. «MAU», la sigla de les
taules tècniques antigues, volia dir precisament persones actives durant un mes.
No és el nombre de comptes registrats ni de descàrregues acumulades.

### Diners a reservar

| Activitat de les 100 persones | Despesa mensual | Mensual amb marge del 20% | Caixa per a 3 mesos amb marge i altes |
| --- | ---: | ---: | ---: |
| Poc ús | 122,40 | 146,88 | 568,20 |
| Ús de referència | 135,26 | 162,31 | 614,51 |
| Ús intensiu | 407,12 | 488,55 | 1.593,21 |

Imports en **EUR, sense IVA, sense comissions Stripe ni ingressos dels bars**.
Sense cobraments, no hi ha comissions per afegir. Les taules tècniques de més
avall sí que modelen bars de pagament i inclouen les seves comissions:
per això els seus totals són diferents.

**Proposta provisional: reservar 1.600 € per als primers tres mesos de
funcionament.** Cobreix l'escenari intensiu calculat, no qualsevol consum possible.
No és la inversió total del projecte: desenvolupament, sous, màrqueting,
assessoria i altres costos empresarials necessiten un pressupost separat.

La columna de caixa assumeix tres mesos amb la mateixa activitat i pagar ara
Apple (99 USD = 91,08 €/any), domini (20 €/any) i Google Play (25 USD = 23 €
una vegada). Se substitueix la part mensual d'Apple i domini per les quotes
completes, sense duplicar-les. Fórmula:
**(3 × despesa mensual + 106,31 € d'ajust per pagaments inicials) × 1,20**.
Si les altes ja estan pagades, cal ajustar la caixa, no tornar-les a pagar.

Els **135,26 €/mes de referència** es desglossen així:

| Concepte | EUR/mes |
| --- | ---: |
| Google: cerques, fitxes i fotos de bars | 12,70 |
| Firebase / Google Cloud: consum calculat | 1,43 |
| Reserva per altres operacions de Google Cloud | 10,00 |
| Plans, domini, correu i provisions de contingut | 111,14 |

Els components arrodonits poden diferir un cèntim del total.
Els 111,14 € assumeixen Vercel (18,40 €), Expo (17,48 €), Apple
repartit entre 12 mesos (7,59 €), domini i correu (7,67 €), dades esportives
(30 €) i llicències de contingut (30 €).
**No són factures confirmades:** els dos imports de 30 € són provisions
pendents de validar amb els contractes. Cal comprovar els plans reals i evitar
comptar dues vegades serveis ja coberts. El canvi utilitzat és 0,92 EUR/USD;
cal adaptar l'IVA a cada factura, no afegir un 21% indiscriminadament.

### Fotografies: quatre conceptes diferents

- **Fotos de bars servides per Google Places:** peticions que descarreguen
  les imatges del local des de Google. No són fotos pujades a Trobar i no
  es factura necessàriament una sola vegada per foto diferent.
- **Fotos de perfil pujades a Trobar:** emmagatzematge i descàrregues a Firebase.
- **Galeries de bars pujades pels propietaris:** també emmagatzematge i
  descàrregues a Firebase; no s'aplica la tarifa de fotos de Google.
- **Imatges i vídeos del web comercial:** transferència des de Vercel;
  no formen part de les fotos de Google ni de Firebase.

Per conservadorisme es manté la provisió original de **300 perfils de 0,2 MiB
i 5 galeries de 5 MiB**. Són dades acumulades pressupostades, no participants
autoritzats ni bars que necessàriament pagaran. Les descàrregues de Firebase
estan agrupades: encara no hi ha mesures per repartir-les entre perfils i
galeries. El cas de referència assumeix 10 MiB de descàrregues combinades per
persona i mes. Un MiB és aproximadament un MB.
El web comercial assumeix 1.050 visites mensuals i 30 MiB per visita.

### D'on surt l'estimació d'ús?

| Per persona durant un mes | Poc ús | Referència | Intensiu |
| --- | ---: | ---: | ---: |
| Entrades a l'app | 2 | 6 | 15 |
| Fitxes consultades per entrada | 1 | 2 | 4 |
| Fotos de Google carregades per fitxa | 1 | 2 | 3 |
| Descàrregues combinades de perfils i galeries de Trobar | 3 MiB | 10 MiB | 40 MiB |

Exemple de referència: **100 × 6 entrades × 2 fitxes × 2 fotos =
2.400 peticions de fotos de Google al mes**.
Amb 1.000 peticions gratuïtes assumides i 7 USD per mil addicionals:
**(2.400 − 1.000) / 1.000 × 7 × 0,92 = 9,02 €**.
Les 1.200 consultes de fitxes afegeixen 3,68 €, fins als 12,70 € de Google.
Les 1.050 cerques de text i 300 cerques properes queden dins les franquícies
assumides. S'assumeix que altres aplicacions no les han consumit.

### Procés per convertir-ho en un pressupost fiable

1. **Confirmar factures i contractes:** substituir provisions per imports reals,
   distingir pagaments anuals de mensuals i eliminar duplicats.
2. **Mesurar dues setmanes:** persones que entren, peticions de Google per
   tipus, fitxes consultades, descàrregues de perfils i galeries, trànsit del
   web i feina automàtica del servidor. El nombre de participants, tot sol,
   no determina el consum.
3. **Projectar un mes per servei:** persones × activitat per persona, més
   processos automàtics i web. Aplicar franquícies i trams, sumar plans i
   reservar un 20%. No multiplicar tota la factura de 100 persones per deu.
4. **Comparar setmanalment previsió i consum:** recalcular abans d'ampliar
   participants. Les alertes de facturació no aturen per si soles la despesa.

L'Excel permet variar el nombre de persones i recalcula cada servei; els CSV
conserven les comparacions fins a 100.000 persones. Les tarifes i les hipòtesis tècniques no s'han
canviat: s'ha corregit la presentació i s'ha separat el pressupost operatiu
dels cobraments i de la caixa inicial. Els tres usos no són probabilitats ni
límits garantits.

---

## Detall tècnic del model original

Les taules següents conserven l'escenari original, **incloses les comissions
dels bars de pagament assumits**. Per al pressupost operatiu sense cobraments,
utilitzeu el resum anterior o la columna `infrastructure` del CSV.

## 1. Abast i interpretació

Aquest és un **model de planificació**, no una lectura de les factures ni una
auditoria dels recursos desplegats. Combina el codi disponible al repositori,
tarifes públiques i hipòtesis explícites d'activitat. No s'han consultat secrets,
canviat plans, activat serveis, fet cobraments ni desplegat res per preparar-lo.

S'hi inclouen infraestructura, mapes, dades externes, distribució, web, contingut,
correu i comissions de cobrament. Se n'exclouen sous, màrqueting/adquisició,
assessoria, assegurances i altres despeses generals de l'empresa. Les visites
orgàniques al web sí que generen despesa tècnica i estan modelades.

**MAU** vol dir usuaris actius mensuals de l'app, no comptes registrats,
instal·lacions acumulades, clients de pagament ni visites al web comercial.
Els bars que paguen es modelen a part. Un usuari pot fer moltes peticions:
no hi ha una tarifa única «per usuari de Firebase».

- Escales: **100, 1.000, 10.000, 50.000 i 100.000 MAU**.
- Tres escenaris d'intensitat: baix, central i intensiu. **No són intervals de
  confiança estadístics**, ni el baix és una garantia de cost màxim.
- Imports sense IVA; vegeu l'apartat fiscal.
- Canvi de treball: **1 USD = 0,92 EUR**, una hipòtesi editable, **no una
  cotització comprovada del dia**. No s'ha fingit que USD i EUR siguin iguals.
- Mes de 30 dies; cost anual = 12 mesos amb la mateixa activitat, no la previsió
  d'un any de creixement ni una factura que es pagarà íntegra cada mes.
- No es resten crèdits promocionals, ajuts de startup ni ingressos dels bars
  dels totals de despesa. Les comissions Stripe es mostren separades.

### Resum econòmic: quant reservar

**Conclusió:** no és defensable pressupostar aquesta app com «Firebase gairebé
gratuït» i prou. Amb els fluxos actuals, la descoberta de locals, resolució de
Place IDs, fitxes Enterprise i fotografies Google poden dominar la factura.
Les següents xifres **no són una predicció de facturació observada**: mostren
què passaria si es compleixen les hipòtesis d'ús de l'apartat 3, sense haver
optimitzat aquests fluxos.

**Despesa mensual total estimada, EUR sense IVA, inclòs Stripe, sense reserva:**

| MAU | Baix | Central | Intensiu |
| ---: | ---: | ---: | ---: |
| 100 | 127,04 | 139,90 | 411,76 |
| 1.000 | 152,53 | 641,80 | 4.719,31 |
| 10.000 | 846,43 | 7.391,88 | 36.703,52 |
| 50.000 | 4.960,90 | 31.518,83 | 104.631,83 |
| 100.000 | 9.751,08 | 53.038,58 | 149.504,68 |

**Desglossament mensual de l'escenari central, EUR:**

| MAU | Maps / Places | Firebase / GCP | Distribució / serveis | Stripe | Total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 12,70 | 11,43 | 111,14 | 4,64 | 139,90 |
| 1.000 | 512,44 | 13,58 | 111,14 | 4,64 | 641,80 |
| 10.000 | 7.125,40 | 42,31 | 177,74 | 46,43 | 7.391,88 |
| 50.000 | 30.592,76 | 244,31 | 449,62 | 232,14 | 31.518,83 |
| 100.000 | 50.989,16 | 770,66 | 814,48 | 464,28 | 53.038,58 |

**Pressupost central amb marge i projecció anual:**

| MAU | Total mensual sense marge | Reserva mensual 20% inclosa | Despesa anual sense marge |
| ---: | ---: | ---: | ---: |
| 100 | 139,90 | 167,88 | 1.678,83 |
| 1.000 | 641,80 | 770,16 | 7.701,55 |
| 10.000 | 7.391,88 | 8.870,26 | 88.702,57 |
| 50.000 | 31.518,83 | 37.822,60 | 378.225,99 |
| 100.000 | 53.038,58 | 63.646,30 | 636.463,01 |

A 10.000 MAU centrals, Maps/Places representa aproximadament **96,4%**
del total. A aquesta escala, els 50 bars de pagament assumits aportarien
1.760 EUR/mes bruts periodificats, clarament per sota de la despesa prevista.
El punt mort només tècnic seria d'uns **215 bars de pagament**, mantenint
constant la càrrega i abans de fiscalitat i costos empresarials exclosos.
A 100.000 MAU serien uns **1.535 bars**, no els 500 assumits.

**Recomanació:** abans d'escalar la beta, mesurar Places per SKU i pressupostar
o redissenyar la càrrega de fitxes/fotos. No comprometre una beta il·limitada
amb aquests supòsits sense quotes i seguiment. El baix és plausible amb poc ús,
però **no s'ha d'escollir perquè sigui més còmode econòmicament**.

### Fitxers i recàlcul

| Fitxer | Funció |
| --- | --- |
| [cost-assumptions.json](cost-assumptions.json) | Activitat, catàleg, canals, cobraments, canvi i reserves |
| [cost-rates.json](cost-rates.json) | Tarifes i franquícies utilitzades |
| [cost-forecast-summary.csv](cost-forecast-summary.csv) | Els 15 escenaris, subtotals i pressupost recomanat |
| [cost-forecast-breakdown.csv](cost-forecast-breakdown.csv) | Quantitats i imports de cada servei, inclòs Stripe |
| [forecastCosts.cjs](../../scripts/forecastCosts.cjs) | Calculadora Node, sense dependències noves |
| [testCostForecast.cjs](../../tests/testCostForecast.cjs) | Proves aritmètiques, llindars i coherència dels CSV |

Des de l'arrel del repositori:

```powershell
node scripts\forecastCosts.cjs
node scripts\forecastCosts.cjs --write
node --test tests\testCostForecast.cjs
```

La segona ordre regenera els dos CSV, no aquest document. Si es canvien
hipòtesis o tarifes, cal actualitzar també les taules d'aquest informe.
Els CSV utilitzen coma com a separador, punt decimal i sis decimals per
evitar errors d'arrodoniment; es poden importar a Excel/Sheets. Els imports
de l'informe s'arrodoneixen: sumar cel·les visibles pot diferir uns cèntims.

## 2. Què genera cost en aquesta aplicació

| Superfície real | Evidència al repositori | Implicació econòmica |
| --- | --- | --- |
| Mapa natiu Google a iOS/Android i mapa JavaScript al web | [MapScreen.tsx](../../app/src/screens/Map/MapScreen.tsx), [shim web](../../app/src/shims/react-native-maps.web.tsx) | No confondre el mapa natiu amb les cerques Places; el web pot generar Dynamic Maps |
| Cerca escrita i escaneig manual de locals | [barDiscoveryService.ts](../../app/src/services/barDiscoveryService.ts) | Places Text Search Pro i Nearby Search Pro; el màxim de resultats no limita el preu per petició |
| Obertura d'una fitxa de local | [placesService.ts](../../app/src/services/placesService.ts) | El field mask inclou telèfon, web, valoracions i horaris: **Place Details Enterprise**, no només Essentials |
| Local sense Place ID vàlid | [selecció de local](../../app/src/screens/Map/MapScreen.tsx#L1446) | Pot requerir una cerca Text addicional abans de Details; el desament del Place ID està restringit a propietari/admin |
| Fotografies de Google | [placesService.ts](../../app/src/services/placesService.ts) | Fins a 3 URL de fotos per fitxa; es pressuposten descàrregues reals, no la mera creació d'URL |
| Bars de Firestore | [barService.ts](../../app/src/services/barService.ts) | Hi ha càrregues de tota la col·lecció, no només dels pins visibles |
| Zona visible del mapa | [fetchBarsInBounds](../../app/src/services/barService.ts#L87) | Dues consultes de latitud, fins a 300 documents cadascuna; filtrar longitud/deduplicar després no elimina lectures facturables |
| Partits, ressenyes i perfils | [matchService.ts](../../app/src/services/matchService.ts), [reviewService.ts](../../app/src/services/reviewService.ts), [userService.ts](../../app/src/services/userService.ts) | Consultes, lectures inicials dels listeners, actualitzacions, agregacions, escriptures i trànsit |
| Sincronització esportiva | [scheduledMatchSync.ts](../../functions/src/scheduledMatchSync.ts), [matchSync.ts](../../functions/src/matchSync.ts) | Cada 15 minuts: 2.880 execucions en 30 dies, independentment dels MAU |
| Notificacions | [notificationFunctions.ts](../../functions/src/notificationFunctions.ts), [notificationDelivery.ts](../../functions/src/notificationDelivery.ts) | Transport Expo/FCM sense preu per missatge, però escaneig d'usuaris, ledger, tokens, reintents i còmput sí que poden costar |
| Fotos pròpies | [userService.ts](../../app/src/services/userService.ts), [regles Storage](../../firebase/storage/storage.rules) | Emmagatzematge, operacions i sobretot descàrregues; límit d'avatar 5 MiB, però el model assumeix 0,2 MiB de mitjana |
| Web i vídeos | [BackgroundVideo.tsx](../../web-app/components/BackgroundVideo.tsx), [Hero.tsx](../../web-app/components/Hero.tsx), [index.tsx](../../web-app/pages/index.tsx) | Transferència Vercel diferent del trànsit de l'app; autoplay pot descarregar vídeos encara que l'usuari no els miri sencers |
| Subscripcions de bars | [Pricing.tsx](../../web-app/components/Pricing.tsx), [Functions Stripe](../../functions/src/index.ts) | Comissió de targeta més Stripe Billing; no es cobra a tots els MAU |

### Estat de desplegament i limitacions

El repositori conté canvis locals de registre/Stripe/notificacions que **no
equivalen a funcionalitats confirmades en producció**. El model pressuposta
la beta amb aquestes funcions activades. La guia de
[notificacions](../guides/NOTIFICATIONS.md) descriu explícitament els passos
pendents de desplegament; la de [sincronització](../guides/MATCH_SYNC.md)
documenta un cron prèviament desplegat al projecte existent.

El projecte existent es considera **dev**. La configuració de **prod** continua
pendent; no s'ha creat cap tercer entorn ni s'assumeix que prod ja funcioni.
Les Functions estan configurades a `europe-west1`; **això no demostra la regió
real de Firestore ni del bucket**. El pressupost de dades assumeix serveis
regionals a Bèlgica; cal verificar la ubicació abans de contractar/configurar prod.
Una base multiregió o un bucket antic poden tenir tarifes/franquícies diferents.

No hi ha Firebase Hosting configurat com a allotjament del web a
[firebase.json](../../firebase.json): no es duplica un cost de Firebase Hosting
amb Vercel. Hi ha dos projectes Vercel vinculats al repositori; no s'ha comprovat
quin pla paguen ni si tots dos serveixen trànsit. Es modela **un equip Pro,
un seient i un únic volum total de visites**, no dos abonaments automàticament.

## 3. Hipòtesis d'activitat

Totes les quantitats següents són **supòsits**, no mètriques observades.
Les cerques són peticions facturables després de la reutilització local de sessió.

| Per MAU o sessió | Baix | Central | Intensiu |
| --- | ---: | ---: | ---: |
| Sessions / MAU / mes | 2 | 6 | 15 |
| Nearby / sessió | 0,25 | 0,5 | 1 |
| Text explícit / sessió | 0,3 | 0,75 | 2 |
| Details / sessió | 1 | 2 | 4 |
| Fitxes que requereixen Text addicional per manca de Place ID | 20% | 50% | 80% |
| Fotos Google efectivament descarregades / Details | 1 | 2 | 3 |
| Sessions fetes al web de l'app | 5% | 10% | 20% |
| Altres lectures Firestore / sessió, a banda del catàleg | 80 | 160 | 400 |
| Escriptures d'usuari / sessió | 2 | 4 | 10 |
| Esdeveniments push globals / mes | 6 | 12 | 30 |
| Comptes elegibles / esdeveniment | 25% | 50% | 80% |
| Descàrregues de Storage / MAU / mes | 3 MiB | 10 MiB | 40 MiB |
| Visites web comercial addicionals / MAU | 0,25 | 0,5 | 1 |
| Transferència web comercial / visita | 8 MiB | 30 MiB | 55 MiB |
| MAU que reben alguna actualització OTA en el mes | 10% | 30% | 60% |

Hipòtesis comunes:

- Comptes registrats acumulats = **3 × MAU**. És una aproximació d'estoc per
  al pressupost, no un forecast de retenció. Aquests comptes també es poden
  escanejar en un fan-out encara que no hagin obert l'app aquell mes.
- Catàleg Firestore = **màxim(500, 0,02 × MAU)** bars, arrodonit amunt.
  Els resultats OSM/Google no es pressuposen tots persistits a Firestore.
- Una lectura completa del catàleg per sessió. No és un límit del codi:
  altres càrregues per focus/filtres poden fer-ne més.
- Bars de pagament = **màxim(5, 0,005 × MAU)**: 5, 5, 50, 250 i 500 bars.
  Es manté igual entre escenaris per aïllar l'efecte de la intensitat.
- Fotos pròpies: 0,2 MiB per compte registrat i 5 MiB per bar de pagament.
  No es compten fotos Google com si fossin objectes guardats a Firebase.
- Firestore: 10 KiB aproximats per compte incloent documents/índexs i
  40 KiB per bar, expressats al JSON en GiB aproximats. El creixement d'històrics,
  ressenyes, posts i índexs pot superar aquesta provisió.
- Lectura client: **2 KiB de resposta mitjana per document** per estimar egress.
  No es factura trànsit intern del cron com si tot sortís cap a internet.
- 1.000 visites comercials base al mes, a més de les associades als MAU.
- OTA: 15 MiB per destinatari durant el mes. Una reinstal·lació des de
  l'App Store/Play Store no es tracta com una descàrrega OTA d'Expo.
- Còmput: 1 vCPU, 0,5 GiB, concurrència efectiva 1; 10 s per sincronització,
  2 s base per cron de notificacions, 0,02 s per destinatari push i
  0,2 callables de 0,3 s per sessió. No són mesures de latència.
  S'assumeix escala a zero sense instàncies mínimes reservades; verificar la
  configuració desplegada, perquè un mínim sempre actiu té cost addicional.
- Cada cron de partits: 1.500 lectures i 350 escriptures; el volum de fixtures
  i reconciliació actual justifica pressupostar activitat fins i tot sense usuaris.
- Cron de notificacions: 8.640 execucions/mes i 30 lectures base per execució.
  Per esdeveniment s'escaneja l'estoc de comptes: 3 lectures per compte;
  per destinatari s'afegeixen 12 lectures, 6 escriptures i 1 eliminació.
  Són mitjanes prudents per elegibilitat, tokens, ledger, receipts i neteja,
  no el recompte exacte de cada camí del codi.

**Important sobre notificacions:** a 100.000 MAU hi ha 300.000 comptes en
aquest model. El backend actual pagina i té límits de treball i expiració.
Pressupostar un fan-out complet **no prova que l'arquitectura el pugui lliurar
a temps**. Cal prova de càrrega, segmentació i política de cua abans d'aquesta escala.

### Fórmules principals

```text
S = MAU × sessions
Text = S × (Text_explícit + Details × fracció_sense_PlaceID)
Nearby = S × Nearby_per_sessió
Details = S × Details_per_sessió
Photos = Details × fotos_descarregades_per_Details
Dynamic_Maps = S × fracció_web

Lectures_client = S × (bars_catàleg + lectures_addicionals)
Destinataris_push = comptes_registrats × esdeveniments × fracció_elegible
Lectures_totals = lectures_client + lectures_cron + lectures_fanout
GiB_egress_Firestore = lectures_client × 2 / 1.048.576

Cost_infra = Maps + Firebase/GCP + distribució/serveis
Cost_total = Cost_infra + comissions_Stripe
Pressupost_recomanat = Cost_total × 1,20
```

La franquícia diària de Firestore es modela com `franquícia × 30`
**només assumint consum uniforme cada dia**. No es pot traspassar crèdit sobrant
d'un dia a un altre. El cron ja consumeix part d'aquesta franquícia.
En un partit amb un pic de trànsit concentrat hi haurà menys franquícia efectiva.
En el cas extrem, perdre les franquícies dels altres 29 dies afegeix aproximadament
el preu de 1,45 milions de lectures i 580.000 escriptures respecte del model:
cal aplicar les tarifes de la taula, no considerar-ho una cobertura de pics.

## 4. Tarifes, franquícies i pressupostos de proveïdor

Les tarifes verificades i els imports provisionals es distingeixen també al CSV:

- `tariff`: tarifa pública, però volum d'ús hipotètic.
- `budget-rate`: tarifa de treball conservadora per a variables com egress/regió;
  no pressuposa un pressupost contractual universal.
- `budget`: provisió editable; **no és una tarifa confirmada ni una despesa
  que s'hagi comprovat que Trobar estigui pagant**.

No s'han de sumar tots els serveis gratuïts d'una pàgina comercial com si totes
les seves franquícies fossin aplicables alhora al nostre bucket/regió/compte.
Les franquícies compartides de Maps/Cloud Run es modelen disponibles per a prod:
si dev o altres projectes les gasten, el cost real serà més alt.

**Blaze no és una subscripció mensual fixa:** habilita facturació per ús.
Functions, recursos programats i els requisits actuals de Cloud Storage per
Firebase fan que no sigui prudent planificar aquesta beta com una aplicació
Spark sense compte de facturació. Activar Blaze no significa que tot comenci
a facturar des de la primera petició, ni que hi hagi un límit automàtic de despesa.

No s'apliquen al bucket europeu les franquícies específiques de buckets GCS
elegibles als EUA ni s'assumeix que una franquícia antiga de
`*.appspot.com` existeixi en un bucket nou `*.firebasestorage.app`.
El model carrega tot l'emmagatzematge de fotos europeu i el seu egress.

Les reserves mensuals en EUR són: **6 correu corporatiu + 30 dades esportives
+ 30 contingut/llicències**, domini **20 EUR/any**, i monitoratge dedicat
**0**. S'afegeix la reserva OSM de **0/0/50/150/300 EUR** segons escala i una
petita reserva GCP operativa definida al fitxer de tarifes. Aquests imports
no substitueixen una oferta de proveïdor ni proven el cost de la llicència
Artlist existent. Cal reemplaçar-los pels contractes reals abans d'aprovar despesa.

### 4.1 Google Maps i Places New

[Tarifes oficials per SKU](https://developers.google.com/maps/billing-and-pricing/pricing).
Imports USD **per 1.000 peticions**, un cop aplicada la franquícia mensual de
cada SKU. Els intervals són de **volum total acumulat**, no blocs que tornin
a començar després de la franquícia. La calculadora aplica trams marginals,
no el preu del darrer tram a totes les peticions.

| SKU usada | Gratuïtes/mes | Fins 100.000 | 100.001-500.000 | 500.001-1 M | 1-5 M | Més de 5 M |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Dynamic Maps web | 10.000 | 7,00 | 5,60 | 4,20 | 2,10 | 0,53 |
| Nearby Search Pro | 5.000 | 32,00 | 25,60 | 19,20 | 9,60 | 2,40 |
| Text Search Pro | 5.000 | 32,00 | 25,60 | 19,20 | 9,60 | 2,40 |
| Place Details Enterprise | 1.000 | 20,00 | 16,00 | 12,00 | 6,00 | 1,51 |
| Place Details Photos | 1.000 | 7,00 | 5,60 | 4,20 | 2,10 | 0,53 |

Maps SDK natiu Android/iOS no té càrrec per les càrregues de mapa sota la SKU
actual corresponent; **Places segueix sent de pagament**. No s'ha restat
un crèdit genèric històric de 200 USD a més de les franquícies actuals per SKU.

El [llistat oficial de camps de Details](https://developers.google.com/maps/documentation/places/web-service/place-details)
confirma que `rating`, `userRatingCount`, `currentOpeningHours`, telèfons,
`priceLevel` i `websiteUri` activen **Enterprise**, no necessàriament
Enterprise + Atmosphere. El nostre field mask no demana `reviews` ni els
camps Atmosphere. Per tant, no s'ha sobrepressupostat aquest nivell més car.
Un canvi de field mask pot canviar la SKU i obliga a recalcular.

Exemple **10.000 MAU centrals**:

| Tipus | Peticions/mes | Cost EUR/mes |
| --- | ---: | ---: |
| Dynamic Maps | 6.000 | 0,00 |
| Nearby Pro | 30.000 | 736,00 |
| Text Pro, inclosa resolució de Place ID | 105.000 | 2.914,56 |
| Details Enterprise | 120.000 | 2.116,00 |
| Photos | 240.000 | 1.358,84 |
| **Total** | | **7.125,40** |

Exemple de càlcul Text Pro:
`((100.000 - 5.000)/1.000 × 32 + 5.000/1.000 × 25,60) × 0,92 = 2.914,56 EUR`.
Una petició Nearby que retorna 20 locals **no són 20 peticions Nearby**;
si després s'obren les 20 fitxes, sí que hi pot haver 20 Details addicionals.

### 4.2 Firebase i Google Cloud

| Servei | Tarifa utilitzada, USD | Franquícia assumida | Comentari |
| --- | --- | --- | --- |
| Firestore regional: lectures | 0,03 / 100.000 documents | 50.000/dia | [Font](https://cloud.google.com/firestore/pricing); exclou índexs addicionals fora de les hipòtesis |
| Firestore: escriptures | 0,09 / 100.000 | 20.000/dia | Cron i clients comparteixen franquícia |
| Firestore: eliminacions normals | 0,01 / 100.000 | 20.000/dia | TTL no té aquesta franquícia |
| Firestore: dades i índexs | 0,000205479/GiB/h, uns 0,148/GiB en 30 dies | 1 GiB | No confondre preu horari amb mensual |
| Firestore: egress a internet | 0,12/GiB, provisió de treball | 10 GiB/mes | Depèn de destinació; canviar si factura/SKU difereix |
| Storage regional Standard | Aproximadament 0,02/GiB/mes | Cap franquícia EUA | [Font](https://cloud.google.com/storage/pricing); regió i antiguitat del bucket pendents |
| Storage: descàrregues internet | 0,12/GiB, provisió | 0 | No duplicar aquests bytes com egress Firestore |
| Storage: operacions Class A / B | 0,005 / 0,0004 per 1.000 | 0 | Verificar classe/regió exactes de cada operació |
| Cloud Run request-based: CPU | 0,000024/vCPU-s | 180.000 vCPU-s/mes | [Font](https://cloud.google.com/run/pricing), regió Tier 1 |
| Cloud Run: memòria | 0,0000025/GiB-s | 360.000 GiB-s/mes | No s'utilitza el preu instance-based de 0,000018 com si fos request-based |
| Cloud Run: peticions | 0,40/milió | 2 milions/mes | Functions v2 no s'afegeix una segona vegada |
| Cloud Scheduler | 0,10/job/mes | 3 jobs/compte de facturació | [Font](https://cloud.google.com/scheduler/pricing); 2 jobs previstos, no 11.520 jobs |
| Auth email/social estàndard | 0 per aquest concepte | Segons tipus de servei i quotes | Sense SMS ni upgrade Identity Platform assumit |
| Expo Push / FCM transport | 0 per missatge | Subjecte a límits operatius | Firestore/Functions del fan-out sí es pressuposten |

El model tracta les consultes de latitud amb un sol camp de rang segons el
codi actual; consultes amb més camps de rang, agregacions i les regles poden
afegir lectures d'índex/document. No es pot inferir el cost del nombre de
documents que finalment es mostren a la pantalla.

**Exemple Firebase/GCP a 10.000 MAU centrals:**

| Concepte | Volum mensual | EUR/mes |
| --- | ---: | ---: |
| Lectures Firestore | 47.419.200 documents | 12,67 |
| Escriptures Firestore | 2.328.000 documents | 1,43 |
| Eliminacions normals | 180.000 documents | 0,00 |
| Egress Firestore client | 75,53 GiB | 7,23 |
| Storage de fotos | 6,10 GiB | 0,11 |
| Egress de fotos | 97,66 GiB | 10,78 |
| Operacions Storage | 1.000 Class A + 200.000 Class B | 0,08 |
| CPU / RAM / invocacions | 53.280 vCPU-s; 26.640 GiB-s; 23.520 peticions | 0,00 sota franquícies |
| Scheduler i dades Firestore sota franquícia | 2 jobs; 0,32 GiB | 0,00 |
| Reserva operativa GCP | Secrets, builds, imatges, logs, còpies/egress menor | 10,00 |
| **Total** | | **42,31** |

**La reserva de 10 EUR no és un càlcul de capacitat dels serveis auxiliars.**
Referències de control, que **no se sumen de nou** al model:

- [Secret Manager](https://cloud.google.com/secret-manager/pricing): 6 versions
  actives i 10.000 accessos sense cost; després aproximadament 0,06 USD/versió/mes
  i 0,03 USD/10.000 accessos.
- [Artifact Registry](https://cloud.google.com/artifact-registry/pricing):
  0,5 GiB sense cost, després aproximadament 0,10 USD/GiB/mes.
- [Cloud Build](https://cloud.google.com/build/pricing): franquícia i tarifa
  segons màquina; com a referència 2.500 minuts elegibles i 0,006 USD/min
  `e2-standard-2`. No donar per vàlids tots els minuts gratuïts per a qualsevol
  generació/màquina de build.
- [Cloud Logging](https://cloud.google.com/products/observability/pricing):
  primers 50 GiB/projecte/mes inclosos, després 0,50 USD/GiB d'ingestió;
  retenció addicional 0,01 USD/GiB/mes. Controlar volum, no només nombre d'usuaris.
- PITR, backups, restauracions i TTL tenen condicions pròpies; no s'han activat
  ni dimensionat com si la seva disponibilitat fos prova d'una còpia existent.

### 4.3 Allotjament, distribució i serveis externs

| Concepte | Model utilitzat | Font / estat |
| --- | --- | --- |
| Vercel Pro | 20 USD/mes, un equip i un seient | [Pla Pro](https://vercel.com/docs/plans/pro-plan); crèdit mensual d'infraestructura de 20 USD |
| CDN web on-demand | Provisió de 0,20 USD/GB + 2 USD/milió de requests, restant el crèdit anterior una sola vegada | [Ús CDN](https://vercel.com/docs/manage-cdn-usage); transferència és una provisió regional, no tarifa universal confirmada |
| EAS Starter | 19 USD/mes | [Plans Expo](https://expo.dev/pricing), amb 45 USD de crèdit per builds; no es resta de l'OTA |
| EAS Update Starter | 3.000 usuaris actualitzats + 100 GiB; després 0,005 USD/usuari i 0,10 USD/GiB excedent | [Càlcul oficial](https://docs.expo.dev/billing/usage-based-pricing/); cada usuari addicional inclou 40 MiB |
| Apple Developer | 99 USD/any, uns 7,59 EUR/mes | [Inscripció](https://developer.apple.com/programs/enroll/); confirmar factura/divisa local |
| Google Play Console | 25 USD una vegada | [Alta Play](https://support.google.com/googleplay/android-developer/answer/6112435); no inclosa als totals recurrents |
| Dades esportives | Reserva de 30 EUR/mes | [football-data.org](https://www.football-data.org/pricing) publica opcions des de 29/49 EUR; no és garantia que la reserva cobreixi tots els proveïdors/competicions |
| Domini, correu, contingut i OSM | Reserves de l'apartat anterior | Imports de planificació sense contracte verificat |

**Vercel:** la documentació actual diferencia on-demand i
[Flat Rate CDN](https://vercel.com/docs/pricing/flat-rate-cdn). Aquest últim
inclou 1 M de peticions / 1 TB al nivell base; el següent nivell és 20 USD/mes
per 10 M / 50 TB. Però exclou certs usos amb distribució massiva de mitjans com
a majoria del trànsit. **No s'ha donat per feta l'elegibilitat del nostre web
amb MP4 pesants**. Per prudència es modela on-demand sense afegir alhora 1 TB
gratuït i després tornar a restar el crèdit com si fossin dues franquícies
garantides per al mateix mode. Confirmar mode, regió i condicions al compte.
No s'ha contractat ni canviat cap pla.

**Expo:** els MAU facturables d'Update són els usuaris que descarreguen almenys
una OTA durant el cicle, no tots els que executen l'app. El pressupost manté
Starter per transparència; a 100.000 MAU intensius, 60.000 receptors OTA farien
que Production pogués resultar uns **55 USD/mes més barat** (249 vs 304 USD,
amb els volums assumits). Això no autoritza una migració automàtica de pla.
Builds superiors als 45 USD de crèdit, concurrències extra i suport es pressuposten
a part si calen. Els crèdits no utilitzats no són un ingrés ni es converteixen
en descompte sobre totes les altres despeses.

## 5. Cobraments Stripe i bars de pagament

El web anuncia 39 EUR mensuals, 99 EUR trimestrals i 348 EUR anuals, amb
14 dies de prova. S'utilitza un mix de bars: **50% mensual, 30% trimestral,
20% anual**. No s'assumeix que tots els consumidors paguin.

Per cada bar actiu de pagament:

```text
Volum cobrat mitjà mensual = 0,5×39 + 0,3×99/3 + 0,2×348/12 = 35,20 EUR
Transaccions equivalents/mes = 0,5 + 0,3/3 + 0,2/12 = 0,616667
Processament = volum × 1,5% + transaccions × 0,25 EUR
Billing = volum × 0,7%
Comissió total = 0,928567 EUR/bar/mes
Volum menys comissions = 34,271433 EUR/bar/mes
```

Un pla anual es cobra d'una vegada: aquestes fórmules **periodifiquen** ingressos
i despeses. Una cohort que es doni d'alta tota el mateix mes tindrà cobraments i
comissions concentrats. La prova gratuïta, impagaments, baixes i reemborsaments
redueixen els cobraments efectius; no s'han inclòs com a ingressos garantits.

| MAU | Bars de pagament assumits | Volum mensual periodificat | Comissions Stripe aproximades |
| ---: | ---: | ---: | ---: |
| 100 | 5 | 176 EUR | 4,64 EUR |
| 1.000 | 5 | 176 EUR | 4,64 EUR |
| 10.000 | 50 | 1.760 EUR | 46,43 EUR |
| 50.000 | 250 | 8.800 EUR | 232,14 EUR |
| 100.000 | 500 | 17.600 EUR | 464,28 EUR |

Hipòtesi de targeta: estàndard de l'EEE. Les targetes premium/internacionals,
conversió de moneda, disputes, reemborsaments, Stripe Tax i productes opcionals
poden afegir cost. No es pressuposa una segona comissió per utilitzar Checkout
estàndard ni que Stripe Billing sigui gratuït només perquè Checkout ho sigui.
Si el contracte Stripe és diferent del pagament per ús, cal substituir les tarifes.

**Grau de verificació:** la pàgina oficial de
[Stripe Espanya](https://stripe.com/es/pricing) confirma Billing al 0,7%,
però l'extracció pública consultada només mostrava explícitament tarifes de
targetes UK/internacionals per a Payments. Per això, **l'1,5% + 0,25 EUR és
una hipòtesi de treball pendent de confirmar al compte espanyol**, marcada
`budget-rate` al CSV, no una tarifa domèstica que s'afirmi verificada aquí.
No s'ha substituït incorrectament pel 2,5% de targetes UK.
Com a sensibilitat, passar d'1,5% a 2,5% afegiria **176 EUR/mes**
amb 500 bars i 17.600 EUR de volum, mantenint la part fixa.

La contribució del CSV és cobraments menys Stripe menys infraestructura:
**no és benefici**, no descompta IVA repercutit, sous ni altres costos exclosos.
Si els 39/99/348 EUR inclouen IVA, l'ingrés disponible real és menor.
El punt mort de bars també és merament tècnic i manté constant la infraestructura:
afegir bars pot afegir trànsit, fotos i notificacions.

## 6. Despeses eventuals i no incloses com a càrrec automàtic

| Concepte | Tractament |
| --- | --- |
| Alta Google Play Console | 25 USD una vegada, aproximadament 23 EUR amb el canvi del model; afegir-la al mes d'alta, no cada mes |
| Apple Developer | Renovació anual, periodificada a les taules; confirmar factura local i impostos |
| Builds que superin els crèdits EAS | Addicional segons plataforma/màquina; nombre de builds depèn del ritme de releases, no dels MAU |
| SMS / autenticació telefònica / MFA SMS | No utilitzats en el pressupost base; preu per país, intents, antifrau i validació. No és part del «login gratuït» |
| Identity Platform / autenticació avançada | No suposar activada; tarifació MAU i proveïdors empresarials diferents de Firebase Auth estàndard |
| Correu transaccional extern | Firebase gestiona els fluxos d'auth actuals; no s'ha acreditat un proveïdor SMTP comercial actiu. Afegir pla/volum si es contracta |
| Mapes offline, rutes, geocodificació i Autocomplete | No s'han inventat crides a APIs que el flux inspeccionat no utilitza; incorporar-les si s'afegeixen |
| Proveïdor OSM/geocodificació amb SLA | Reserva al model de 0/0/50/150/300 EUR segons escala; pendent d'oferta i capacitat. Un 0 a beta no autoritza ús contrari a la política pública, i una reserva no és un SLA contractat |
| Dades esportives en directe i llicències comercials | La reserva mensual no garanteix cobertura femenina, totes les competicions, baixa latència o drets de redistribució |
| Artlist, música, imatges, tipografies i escuts | Reserva de contingut, no comprovació jurídica d'una llicència concreta. La confirmació d'ús del material existent no fixa el cost de futures renovacions |
| Backups/PITR/exportacions i retenció | Reserva operativa petita; dimensionar còpies i restauració segons GiB i requisits reals, sense assumir que ja estan habilitats |
| GitHub Actions/CI | No s'ha afegit una quota de pagament sense evidència d'ús facturable; minuts, repositori privat i runners especials poden canviar-ho |
| Monitoratge/APM addicional | 0 EUR de pla dedicat en aquest model; no significa que logs, mètriques custom o ingestió il·limitada siguin gratuïts |
| Suport de proveïdor, domini premium, SSL especial, certificats | No pressupostats fora de la provisió de domini i del TLS gestionat inclòs a l'allotjament |
| Comissions App Store / Google Play sobre venda digital | **No aplicar automàticament un 15-30% a tots els cobraments Stripe**. Revisar classificació del servei a negocis, flux de compra, país i política de cada botiga abans de distribuir |

La reserva del **20%** és prudència pressupostària, no una garantia contra
ús abusiu o una mala política de càrrega. Una configuració errònia de Places
pot superar-la àmpliament.

Sobre **Identity Platform**, la [taula Firebase](https://firebase.google.com/pricing)
publica 50.000 MAU inclosos per aquest servei i 50 MAU SAML/OIDC; l'excés
depèn de la [tarifa corresponent](https://cloud.google.com/identity-platform/pricing).
No s'ha aconseguit aïllar de manera fiable la taula MAU en la consulta pública
(la pàgina retornava principalment preus SMS per país). Per tant, no s'ha
inventat una tarifa ni s'ha confós un SMS amb un MAU. **Si prod té Identity
Platform activat, cal confirmar i afegir aquesta línia abans d'aprovar el
pressupost a 50.000-100.000 MAU.** El cost base de 0 d'Auth és condicional a
la configuració estàndard declarada, no una garantia universal per a Firebase Auth.

## 7. IVA, canvi i efecte de tenir dev i prod

- Les taules són sense IVA dels proveïdors. La quota real depèn del NIF-IVA,
  entitat que factura, localització i possible inversió del subjecte passiu.
- Com a il·lustració de tresoreria, una factura de **100 EUR amb IVA espanyol
  del 21%** es paga a 121 EUR. No s'aplica cegament un 21% a totes les línies:
  algunes poden tenir un tractament diferent, i IVA deduïble no és despesa neta.
- L'IVA de les subscripcions venudes és un altre flux: si 39 EUR és preu final
  amb 21% d'IVA, la base és **32,23 EUR**, mentre Stripe pot calcular la comissió
  sobre els 39 EUR cobrats. Confirmar la política fiscal i `Price` de Stripe.
- Si el canvi passa de 0,92 a 1,02 EUR/USD, la part denominada en USD puja
  aproximadament **10,87%**; les reserves EUR i comissions Stripe EUR no canvien.
- Model principal: càrrega de prod més cron/serveis previstos per a la beta.
  No incorpora una segona base amb tot el trànsit real duplicat a dev.
- Dev amb emuladors redueix consum remot; un cron de dev mantingut actiu
  igual que prod costa encara que no hi entrin usuaris. Desactivar-lo només
  amb una decisió explícita, no com a conseqüència d'aquest informe.
- Franquícies de Firestore són per projecte/base elegible; altres com Maps,
  Cloud Run o Scheduler poden compartir-se a nivell de compte de facturació.
  No s'han duplicat gratuïtats per anomenar dos entorns.
- No sumar una factura «Firebase» i una altra «Google Cloud» sobre el mateix
  consum: Firestore, Storage i Functions són recursos facturats a Google Cloud.
  Aquí Functions v2 es modela amb recursos Cloud Run una sola vegada.

## 8. Principals riscos i prioritats de control

1. **Places és el risc variable principal.** El field mask determina la SKU
   més cara requerida per aquella petició. No sumar tarifes Essentials + Pro +
   Enterprise per la mateixa resposta, però tampoc pressupostar-la com Essentials.
   Carregar telèfon/web/horaris només si l'usuari els necessita pot canviar el cost.
   No cal fer-ho ara per calcular, i qualsevol optimització ha de preservar UX.
2. **La cerca de resolució de Place ID també compta.** No tots els locals OSM
   tenen ID Google. En el flux actual, els usuaris normals no en poden persistir
   sempre l'enllaç; ignorar aquesta cerca addicional infravalora el pressupost.
3. **Fotos Google:** evitar carregues invisibles o repetides; cada foto que
   s'arriba a recuperar pot afegir cost. Fer lazy loading sense trencar atribucions.
4. **Catàleg Firestore:** `fetchBars`, `fetchBroadcastMatchIds` i
   `fetchBarsForMatch` fan lectures completes. Paginació/índex espacial i
   consultes de servidor poden evitar creixement proporcional a sessions × catàleg.
   La cache d'UI no converteix totes les lectures futures en gratuïtes.
5. **Listeners i agregacions:** un listener paga la càrrega inicial i
   actualitzacions; reconnexions, ressenyes, index entries i comprovacions de
   regles poden augmentar lectures. Mesurar també consultes buides i reintents.
6. **Vídeos web:** els tres MP4 actuals sumen aproximadament **46 MiB / 48,3 MB**.
   Un sol recorregut complet de la pàgina pot carregar gairebé això abans
   d'altres assets; rangs repetits/cache/loops depenen del navegador.
   Comprimir, variants mòbils, `faststart`, lazy loading i CDN adequat tenen
   impacte directe. No es canvien els vídeos aprovats en aquest treball.
7. **OSM públic no és quota infinita.** Nominatim i Overpass requereixen
   atribució, polítiques d'ús i control de ritme. Els límits per instància de
   l'app no garanteixen respectar límits globals del servei. No extrapolar
   aquest accés públic a 100.000 usuaris sense arquitectura/proveïdor validats.
   La [política de Nominatim](https://operations.osmfoundation.org/policies/nominatim/)
   fixa **1 petició/segon per aplicació en total**, no per usuari, i
   **prohibeix l'autocompletat client**, encara que tingui debounce. El flux
   de cerca durant l'escriptura requereix revisió abans de donar per viable
   el servei públic. Cal capacitat contractada, servei propi o un flux compatible;
   no s'ha estimat que un simple augment de MAU doni dret a més servei gratuït.
8. **Dades esportives:** 96 sincronitzacions/dia fan aproximadament 2.880 crides
   mensuals per font regular abans d'enriquiments/reintents. No creixen
   directament amb MAU, però un directe més ràpid exigeix una nova estimació.
9. **Logs i històrics:** no registrar tokens/dades personals; fixar retenció,
   evitar logs per destinatari en fan-outs massius i mesurar mida d'índexs.
10. **Control econòmic:** els avisos de pressupost **no aturen la facturació**.
    Configurar quotes/rate limits de cada API i un interruptor de funcionalitat
    no essencial; validar degradació visible i recuperar servei amb control.
    El límit de 60 cerques/hora/instància i `maxInstances` no són un topall global
    de despesa ni limiten tots els serveis.

No s'ha proposat replicar indefinidament contingut Google com a «cache gratuïta».
Cal respectar termes de Maps/Places i les condicions aplicables a l'EEE,
atribució, retenció autoritzada i excepcions per a Place IDs.

## 9. Mesures per convertir aquesta previsió en pressupost real

Abans d'obrir beta:

1. Confirmar projecte prod, regió Firestore/bucket, compte de facturació,
   Identity Platform sí/no, pla Vercel/equip i pla Expo.
2. Inventariar recursos desplegats: crons habilitats, min instances, jobs,
   buckets antics/nous, secrets, repositoris d'imatges i retenció de logs.
3. Separar etiquetes de prod/dev i activar exportació de Billing, si escau.
   BigQuery també pot facturar emmagatzematge/consultes: no cal exportar tot
   sense límits ni afegir-lo silenciosament al cost zero.
4. Pressupost inicial amb alertes al 50/75/90/100% i quotes d'API coherents
   amb els consums previstos; decidir qui rep els avisos i qui pot actuar.
5. Restringir claus per plataforma/API i protegir backend/Storage/Auth contra
   ús no autoritzat. Una clau restringida redueix risc, no substitueix quotes.

Durant les primeres 2-4 setmanes de beta, recollir com a mínim:

| Mètrica | Per què |
| --- | --- |
| MAU, DAU, sessions, plataforma i comptes totals | Separar actius, estoc registrat i web |
| Requests per SKU Maps, facturables i cache hit local | Determinar cost real de cada flux i cobertura del Place ID |
| Details oberts, fotos realment sol·licitades i reobertures | Distingir navegació de prefetch o duplicacions |
| Lectures/escriptures/eliminacions Firestore per flux i cron | Mesurar catàleg complet, listeners i fan-out |
| Document size, índexs, GiB Storage i GiB descarregats | Egress pot superar el cost d'emmagatzematge |
| Execucions, vCPU-s, GiB-s, durada, reintents i concurrència | Substituir el còmput teòric pel facturat |
| Destinataris, cua i antiguitat de jobs, errors push | No confondre baix cost amb notificacions no lliurades |
| Visites web, GB servits, hits de cache i descàrregues MP4 | Ajustar hosting independentment dels MAU |
| EAS builds per plataforma, MAU amb OTA i bytes descarregats | El pla depèn de releases, no només de descàrregues de l'app |
| Bars actius de pagament, import brut, mix de targetes i cicles | Comissions reals, prova gratuïta i tresoreria |

Revisar el model setmanalment durant la beta i mensualment després. Fer
proves controlades de 1.000/10.000 sessions abans d'acceptar una extrapolació
a 100.000 MAU. Qualsevol prova de càrrega sobre serveis de pagament necessita
pressupost i autorització previs; aquest treball no n'ha executat.

## 10. Fonts, verificació i actualització

Fonts públiques consultades el **02/11/2026**: els enllaços de cada taula
permeten revisar preus i condicions. Les pàgines poden canviar, mostrar
selectors de regió o condicions particulars del compte. El fitxer
[cost-rates.json](cost-rates.json) conserva les URL i valors utilitzats,
no una còpia contractual de la factura.

Verificacions executades: 15 combinacions calculades, CSV de resum i detall
regenerats, coherència de totals i períodes, llindars de volum Maps,
franquícies Firestore compartides amb el cron, exemple oficial de facturació
EAS amb 40 MiB addicionals per usuari i correspondència de les taules d'aquest
informe amb la calculadora. Les proves són locals i no generen càrrecs.

Punts encara pendents de confirmar amb la propietat dels comptes:
**Stripe domèstic, upgrade d'Auth, regió/base/bucket reals, mode CDN i
facturació Vercel, quotes compartides, contractes d'OSM i dades esportives,
llicències i pla/builds Expo**. Aquests pendents es documenten perquè una
previsió detallada no s'interpreti com una certificació de costos de producció.
