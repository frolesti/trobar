# Trobar: pressupost viu i inversió pendent

> **Document històric; aquest model s'ha descartat per massa complex.**
> La versió vigent és la [previsió del primer mes](FIRST_MONTH_FORECAST.md),
> amb l'[Excel nou d'un sol full](TROBAR_PRIMER_MES.xlsx).
> El [PDF](COST_FORECAST.pdf) també correspon ara a aquesta nova previsió,
> no al pressupost de dotze mesos conservat aquí.

**2 de novembre de 2026 · EUR · previsió, no factures confirmades**

## 1. Quin model encaixa amb Trobar?

El model adequat és **costos fixos i variables, comparant pressupost i despesa
real**, amb una previsió de caixa de dotze mesos. S'inspira en l'opció
*Business Startup Costs with Variable and Fixed Expenses* de Smartsheet.
El llibre és original i adaptat al projecte; no és una còpia de la plantilla.
No s'hi inclouen inventaris, locals ni altres apartats que no ens aporten valor.

**[Excel anterior de dotze mesos](TROBAR_PRESSUPOST_EDITABLE.xlsx)**

### Separar tres preguntes

| Pregunta | Què pressupostem | Com ho calculem |
| --- | --- | --- |
| Què falta per tenir una versió preparada? | Feina pendent, proves, publicació i equips necessaris | Hores pendents × tarifa; només la fracció pagada surt de caixa |
| Què costa mantenir-la en funcionament? | Google, Firebase, web, distribució, serveis i suport | Consum per servei + quotes + manteniment planificat |
| Quants diners necessitem i quan? | Pagaments inicials, quotes anuals, cobraments i marge | Saldo acumulat mensual, no només una mitjana de despesa |

Trobar ja té una app Expo/React Native, un web Next.js i integracions amb
Firebase i Stripe. **No pressupostem construir-ho tot des de zero**, ni donem
per acabat allò que encara necessita proves o configuració.

### Punt de partida econòmic

Amb **100 persones que utilitzen l'app durant un mes**, l'ús de referència del
model anterior dona **135,26 €/mes equivalents**, sense comissions Stripe.
Amb quotes inicials i marge del 20%, la caixa de tres mesos és **614,51 €**.
L'escenari intensiu puja a **1.593,21 €**; d'aquí la reserva provisional de 1.600 €.

**Aquests imports no són la inversió total.** Falten per valorar hores de
preparació i manteniment, impostos i possibles serveis addicionals. El llibre
deixa les hores i tarifes buides i mostra **22 paquets pendents de valorar**:
10 de preparació i un de manteniment per cada mes.

La previsió inicial manté 100 persones durant dotze mesos, sense ingressos:
necessitaria **1.975,34 € amb marge**, abans d'afegir aquests imports pendents.
No és una predicció de creixement ni una promesa de despesa màxima.

<!-- pagebreak -->

## 2. Què aprofitem de l'ebook?

La guia de Make it in Ukraine és del **2020**. Ens serveix el mètode: validar
les hipòtesis importants, descompondre la feina, pressupostar proves i mantenir
el producte després del llançament. **No reutilitzem salaris, imports globals,
hores genèriques ni un percentatge automàtic de manteniment.**

| Bloc aplicable a Trobar | Què cal valorar o comprovar |
| --- | --- |
| Demanda i ús real | Proves petites amb persones i bars; definir abans què justificaria ampliar la inversió |
| Disseny i usabilitat | Llegibilitat, imatges, vídeos i recorreguts essencials, no un redisseny complet per defecte |
| Comptes i dades | Registre, recuperació, persistència i permisos; feina pendent més proves |
| Mapes i dades de bars | Precisió del catàleg, peticions a Google i dependència de proveïdors externs |
| Cobraments, si s'activen | Checkout, confirmacions, cancel·lacions i errors; integració i comissions són costos diferents |
| Servidor i administració | Tasques automàtiques, gestió d'incidències i necessitats reals d'administració |
| Proves i publicació | iOS, Android i web, dispositius reals, permisos, revisions i materials de botiga |
| Manteniment i suport | Errors, dependències, canvis de sistema operatiu i serveis externs, més resposta a incidències |

**No cal contractar una persona per cada funció.** Anàlisi, disseny,
desenvolupament, proves i coordinació poden repartir-se entre les persones
disponibles. L'Excel calcula per paquet: hores × €/h × fracció externa.
El valor del temps propi queda separat del pagament.

Compartir codi amb React Native evita pressupostar dues apps natives completes,
però **no elimina les proves ni les publicacions específiques d'iOS i Android**.
Tampoc té sentit carregar a Trobar exemples de trucades, streaming en directe
o altres funcionalitats de l'ebook que no formen part del nostre abast.

### Fotografies i vídeos: costos diferents

- **Google Places:** peticions que descarreguen fotos de bars des de Google.
- **Firebase:** emmagatzematge i descàrregues de fotos de perfil i galeries
  pujades pels propietaris. L'Excel permet variar-les per separat.
- **Vercel:** transferència d'imatges i vídeos del web comercial.

El repartiment inicial de descàrregues de Firebase, 2 MiB de perfils i 8 MiB de
galeries per persona i mes, és una **hipòtesi de treball no mesurada**. Conserva
els 10 MiB totals del model anterior; cal substituir-lo per dades observades.
Les 300 fotos de perfil i 5 galeries inicials són una provisió de dades guardades,
no una regla d'accés ni una previsió de bars de pagament.

<!-- pagebreak -->

## 3. Com actualitzarem el pressupost?

**Primera passada: començar pels fulls `Guia`, `Configuracio`, `Hipotesis`,
`Fixos` i `Treball`.** Les cel·les blaves són editables; les grises es calculen.
Els 1.600 € de caixa inicial són una proposta, no fons confirmats.

| Full de l'Excel | Utilitat |
| --- | --- |
| Resum | Saldo, capital i dades pendents; saldo revisat amb reals tancats i previsió futura |
| Hipotesis | Persones, activitat, fotos, visites, cobraments, impostos i finançament de cada mes |
| Fixos / Treball | Quotes, mes de pagament i feina pendent; evitar comptar una feina dues vegades |
| Previsio | Projecció recalculada de pagaments, marge i saldo |
| Pressupost | Base guardada per comparar; només es revisa quan s'aprova una nova versió |
| Reals | Moviments pagats o cobrats, amb base i IVA separats; els incomplets s'assenyalen |
| Tarifes / Calcul / Fonts | Preus editables, fórmules detallades i procedència dels supòsits |

### Cicle de revisió

1. **Confirmar contractes i factures.** Especialment Vercel, Expo, Apple,
   dades esportives i llicències. Els 30 € de dades i 30 € de contingut són
   provisions. Moure les quotes anuals al mes que toca; si ja estan pagades
   i no renoven dins de l'any previst, indicar mes inicial 13.
2. **Mesurar dues setmanes.** Persones que entren, fitxes consultades,
   peticions de Google per tipus, descàrregues Firebase i trànsit del web.
   Afegir els processos automàtics: també poden costar diners amb zero usuaris.
3. **Projectar i comparar.** Actualitzar la previsió amb l'activitat observada,
   registrar moviments reals i marcar un mes com a tancat només quan estigui
   conciliat. Un mes sense dades no es presenta com una despesa de zero:
   es marca com a parcial o pendent de conciliació.
4. **Decidir la següent inversió.** Revisar demanda, incidències i consum abans
   d'ampliar. Definir els criteris amb l'equip; no assumir que 100 participants
   limiten la factura ni que una alerta de cost talla automàticament el servei.

**Impostos i marges:** les tarifes tècniques es calculen sense IVA. S'afegeixen
a la previsió els impostos que realment s'espera pagar; no un 21% universal.
El marge és una reserva separada de les factures. Els cobraments previstos són
diners que entren, no beneficis ni finançament garantit.

### Fonts i límits

- [Smartsheet: costos fixos i variables](https://www.smartsheet.com/content/start-up-business-budget-template#business-startup-costs-with-variable-and-fixed-expenses-template).
- [Ebook de Make it in Ukraine](https://uploads-ssl.webflow.com/5e31728f83dd6609145501da/5eeb3dab6a8fdd545217bba5_Ebook%20How%20To%20Estimate%20The%20Cost%20of%20Building%20A%20Mobile%20App.pdf):
  pàg. 8–10 (validació), 12–17 (factors i manteniment), 19–21 (funcions i proves).
- [Model tècnic i fonts de tarifes](COST_FORECAST.md). Base del 02/11/2026:
  canvi de treball 0,92 EUR/USD, quotes i consum pendents de contrastar amb la
  regió i els contractes reals. L'Excel no es connecta a cap compte.

**Abast d'aquesta entrega:** documentació i planificació financera.
No s'ha canviat el codi, l'accés a les betes, els serveis ni la producció.
