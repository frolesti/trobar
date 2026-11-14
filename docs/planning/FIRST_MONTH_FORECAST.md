# Trobar: quant necessitem per al primer mes?

**2 de novembre de 2026 · 100 persones · iPhone · sense bars premium**

Contrast de facturació i consum actualitzat el **3 de novembre** en aquest
document. L'Excel i el PDF enllaçats mantenen la versió del 2 de novembre;
la reserva de referència de 40 € per a Google no ha canviat.

**Reservaria 150 € per començar**, si mantenim els plans actuals de cost zero.
No és una factura garantida ni un límit de consum. Amb més activitat, la
comparativa puja a **300 € de reserva**. El nombre de persones no limita les
vegades que poden consultar Google.

**[Excel nou: un sol full editable](TROBAR_PRIMER_MES.xlsx) ·
[Aquest informe en PDF](COST_FORECAST.pdf)**

### Què s'hauria de pagar aquest primer mes?

| Servei | Import previst | Motiu |
| --- | ---: | --- |
| Apple Developer | **98,99 €** | Alta anual encara no pagada. Preu publicat a Espanya; confirmar al checkout. |
| Google Cloud, TOT inclòs | **40 € de reserva, abans d'impostos** | Places estimat en 34,42 € + resta de Firebase/Cloud; arrodonit amb marge. |
| Vercel, Expo i API de partits | **0 € amb els plans actuals** | Segons el que has confirmat; cal respectar les seves condicions i quotes. |
| Domini | **0 € ara** | Ja pagat; aproximadament 10 € quan toqui renovar l'any. |
| Stripe / bars premium | **0 €** | No hi haurà cobraments ni bars premium en aquesta fase. |
| **Total d'aquests imports** | **138,99 €** | Apple al preu local publicat; Cloud encara sense impostos. |
| **Si s'aplica un 21% d'IVA a Cloud** | **147,39 €** | Exemple de caixa, no determinació de la situació fiscal. |

Els **20 € que havies proposat per a Google són una provisió conjunta**,
no una quota contractada. Amb l'activitat acordada, Places sol ja dona
34,42 € abans d'impostos. **No he sumat 20 € + Maps + Firebase.**

### Dues condicions que poden canviar la reserva

- **Vercel Hobby és per a ús personal no comercial.** Una beta gratuïta d'un
  negoci no esdevé automàticament elegible. Si cal Pro, parteix de 20 USD/mes,
  uns **17,83 € abans d'impostos**: amb un 21% també en aquest servei, reservaria
  **175 € en lloc de 150 €**. No s'ha contractat ni migrat res.
- **Expo continua a 0 € si ens quedem dins del pla gratuït:** 15 compilacions
  d'iOS i actualitzacions per a 1.000 persones al mes, a més de la resta de límits.
  No he pressupostat un pla de pagament que ara no utilitzes.

### Per als primers iPhone: TestFlight

Permet distribuir la beta sense publicar-la al catàleg públic de l'App Store.
Cal pagar Apple igualment: **TestFlight no té una quota addicional**, i passar
després a l'App Store no implica una segona alta anual. Els participants serien
testers externs; la primera compilació externa necessita revisió beta i cada
compilació caduca als 90 dies. El límit de testers no substitueix un límit de
comptes al servidor. **No he implementat cap restricció de beta.**

<!-- pagebreak -->

## D'on surt el cost de Google?

L'escenari de referència és el que has acceptat:
**100 persones × 8 entrades al mes × 2 fitxes per entrada × fins a 3 fotos**.
No són 100 bars. No hi ha cap objectiu de registres de bars.

| Activitat i resultat del mes | Ús acordat | Més ús, mateixes 100 persones |
| --- | ---: | ---: |
| Entrades per persona / fitxes per entrada | 8 / 2 | 16 / 3 |
| Fitxes consultades a Google | 1.600 | 4.800 |
| Fotos de Google carregades | 4.800 | 14.400 |
| Cost de les fitxes, abans d'impostos | 10,70 € | 67,76 € |
| Cost de les fotos, abans d'impostos | 23,72 € | 83,63 € |
| Cerques i rutes, amb els supòsits de sota | 0 € | 0 € |
| **Google Maps / Places calculat** | **34,42 €** | **151,39 €** |
| **Reserva conjunta Google Cloud** | **40 €** | **155 €** |
| **Primer mes amb Apple i exemple d'IVA Cloud del 21%** | **147,39 €** | **286,54 €** |
| **Diners a reservar, amb els plans actuals de cost zero** | **150 €** | **300 €** |

**Càlcul reproduïble:** les primeres 1.000 fitxes i 1.000 fotos mensuals són
gratuïtes. Després, en aquest tram, 20 USD per 1.000 fitxes i 7 USD per 1.000
fotos. Referència: `(600 × 20 / 1.000 + 3.800 × 7 / 1.000) / 1,1216 = 34,42 €`.
El canvi del BCE és **1 € = 1,1216 USD**; la conversió facturada pot diferir.

**Quines fotografies?** Les imatges dels locals recuperades de Google, fins a
tres per fitxa segons el codi actual, també en bars gratuïts. No són fotos de
perfil d'usuaris ni un servei de galeries pujades pels propietaris. Comptem
que es carreguen totes tres, sense donar per fet un estalvi per memòria cau.

**Cerques i rutes:** suposem 0,75 cerques de text i 0,5 de proximitat per entrada,
i una cerca de text addicional en la meitat de les fitxes. Resultat: 1.400/3.600
cerques de text i 400/800 de proximitat, per sota de les 5.000 gratuïtes de cada
tipus. Una ruta a peu per fitxa dona 1.600/4.800, per sota de les 10.000
gratuïtes d'aquesta tarifa. El mapa natiu no té cost per càrrega del Maps SDK.

**Firebase i servidor:** inspecció només de lectura del projecte `trobar-1123f`,
compartit amb Maps i amb facturació activa. Les mesures següents corresponen
a l'antiga sincronització cada 15 minuts, independent dels usuaris.
Entre el 27 d'octubre i el 3 de novembre
(UTC), Monitoring registra 671.025 lectures, 339.588 escriptures i 674
invocacions del sincronitzador. Són aproximadament 96.000 lectures i 48.500
escriptures al dia, no setmanals. No es poden multiplicar per 100 usuaris:
una part important correspon al treball periòdic del servidor. Una provisió
de **2–5 €/mes per a Firebase i petits serveis auxiliars**, sumada als 34,42 €
de Places, dona aproximadament 36–40 €; no és una factura garantida. El bucket actual
de fotos de perfil és als EUA i té franquícies gratuïtes, no és el bucket europeu
que pressuposava el model antic.

**Registrar bars és gratuït per a la persona**, però consultar Google i guardar
dades pot tenir consum tècnic. Les obertures de formulari s'inclouen en les
fitxes del model; si són obertures addicionals, augmenta aquest valor a l'Excel.
No s'hi inventa una quantitat de registres ni una comissió Stripe.

Les franquícies de Firestore s'apliquen al projecte. **Google Maps agrega
l'ús dels projectes vinculats al mateix compte de facturació**: les 1.000
fitxes/fotos gratuïtes del càlcul han d'estar disponibles; no es poden concedir
de nou a cada projecte. El consum d'altres apps pot elevar aquesta previsió.
No s'han descomptat crèdits promocionals. Impostos, canvi, repeticions
de peticions i ús real poden variar. No s'hi inclouen desenvolupament, màrqueting
ni serveis nous. Revisa consum i factures la primera setmana, abans d'ampliar.

### Contrast amb les captures d'octubre

- L'informe de Google Cloud mostra **62,76 € en total**, dels quals **17,25 €**
  nets corresponen al projecte troBar i **45,51 €** a l'altre projecte.
  Són costos de l'informe, no comprovants bancaris; els impostos no hi consten.
- El projecte troBar també allotja `sepe-bot`, una VM `e2-small` amb un disc
  estàndard de 20 GB, en funcionament des del març. Has confirmat que és aliena
  a Trobar: **s'ha d'excloure del pressupost de l'app**, encara que aparegui al
  mateix projecte. No s'ha aturat ni modificat.
- La primera captura de Firebase mostrava 22,27 €: 1,50 € de Firestore,
  0,14 € de Functions i 20,63 € de serveis no Firebase. **No se suma a la
  factura de Google Cloud**, ni es pot atribuir tot el bloc de 20,63 € a Maps.
  L'informe nou mostra 19,36 € d'ús i 17,25 € nets després dels ajustos mostrats.
  Cal el desglossament per servei/SKU amb el mateix període per conciliar
  les dues vistes i separar l'import exacte de la VM.
- Monitoring d'octubre registra 168 peticions de fitxa de Places (5 amb 404),
  463 de fotos, 69 cerques de text, 4 de proximitat i 140 rutes. No són imports
  facturats ni permeten suposar que les franquícies del compte estan lliures.
- L'estalvi amb més potencial en l'escenari de 100 persones és evitar carregar
  automàticament tres fotos de Google a cada fitxa. Amb només una foto per
  obertura, i les mateixes franquícies disponibles, Places passaria de 34,42 €
  a **14,44 €**. Les fotos addicionals consultades incrementarien aquest import.
  Aquesta és una comparativa, **no una optimització aplicada al carrusel**:
  es mantenen fins a **3 fotos de Google**, no una ni cinc.
- S'han implementat comparacions abans d'escriure partits, equips,
  competicions, identificadors i escuts: només s'escriuen els canvis reals.
  El catàleg complet passa de 96 execucions diàries a una a les 05:15,
  més un intent quan es confirma un final. Un control cada minut consulta
  només la franja de joc: sense partits actius no consulta proveïdors ni escriu.
  Això implica unes 43.200 invocacions i consultes curtes en 30 dies,
  no 43.200 sincronitzacions completes. Aquest control també consumeix recursos.
  S'afegeix un job de Scheduler; no suposem un cost zero ni un estalvi facturat
  fins que hi hagi mesures amb la nova cadència. No es canvia la reserva de 40 €.
  L'estat del desplegament es documenta a [Match sync](../guides/MATCH_SYNC.md).
- A Places, les peticions simultànies comparteixen la mateixa consulta;
  el nou registre de reutilització conserva només identificadors de lloc,
  fins a 200 entrades en memòria.
  Les obertures posteriors consulten detalls i referències de fotos frescos,
  però eviten repetir la cerca del lloc. Els errors temporals o de quota
  no desencadenen cerques addicionals; només un 404 permet recuperar l'ID.
  L'enriquiment dels bars a Firestore també omet escriptures idèntiques
  i pot corregir un ID antic. Això requereix carregar el nou codi de l'app.
  No es promet un percentatge d'estalvi sense mesurar l'ús real.

**Fonts:** [Google Maps](https://developers.google.com/maps/billing-and-pricing/pricing) ·
[Agregació de Maps per compte](https://developers.google.com/maps/billing-and-pricing/overview) ·
[Firebase](https://firebase.google.com/pricing) ·
[Apple Espanya](https://apps.apple.com/es/app/apple-developer/id640199958) ·
[TestFlight](https://developer.apple.com/testflight/) ·
[Expo](https://expo.dev/pricing) ·
[Vercel](https://vercel.com/docs/plans/hobby) ·
[BCE](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml).
