# troBar: campanya de prova gratuïta i primer cobrament

## Estat i objectiu

**Estat vigent: 6 de novembre de 2026. Beta amb Stripe sandbox i enviaments
restringits a `frolesti4@gmail.com`. No s'han activat càrrecs ni correus a clients.**

### Verificacions i canvis completats avui

- Alta amb un compte sintètic a Firebase real: peticions sense sessió i sense
  verificació rebutjades, registre idempotent, bar inactiu abans de Checkout.
- Cerca i selecció d'adreça comprovades contra els callables desplegats:
  Google Places retorna coincidències i dades completes amb coordenades.
  Els límits temporals del compte de prova també s'han netejat.
- Checkout allotjat completat amb targeta Stripe de proves; el webhook ha
  activat Premium i `trialing` a Firestore. Sessions duplicades reutilitzades.
- Portal obert amb el compte sintètic: factures i targeta visibles; cancel·lació
  programada comprovada sense retirar l'accés vigent. Corregida la consulta
  d'estat perquè també reconegui `cancel_at`, no només `cancel_at_period_end`.
- Final de prova simulat i primera factura de **39 EUR** pagada al sandbox.
  No s'han mogut diners reals. Compte, bar i documents sintètics eliminats;
  client Stripe de prova eliminat i subscripció cancel·lada. La subscripció
  preexistent continua en `trialing`, sense modificar.
- Les 18 plantilles de Resend s'han actualitzat al disseny aprovat: Lora,
  logo de 40 px i paleta compartida amb el web. IDs i variables conservats.
- Sis missatges lliurats realment a l'adreça interna: benvinguda, alta del bar,
  avisos de 7 dies i 24 hores, rebut i pagament fallit. La prova utilitza
  Auth/Firestore emulats i dades de facturació fictícies; no accelera trials
  de comptes reals. Test: `functions/test/emailDelivery.billing.resend.cjs`.
- Un setè missatge ha passat per la cua Firestore, el planificador i les
  funcions realment desplegades: Resend confirma `delivered`,
  ID `01a1b1c9-67ef-7c61-aa11-5759657fe8ab`. Job de prova netejat.
- Backend desplegat de manera aïllada: `recordFirstLogin`, `processEmailQueue`,
  `createBillingPortalSession`, `getSubscriptionStatus` i `stripeWebhook`.
  Configuració comprovada: `EMAIL_PORTAL_READY=true`,
  `EMAIL_DELIVERY_MODE=internal`, destinatari intern únic i
  `STRIPE_ALLOW_LIVE_BILLING=false`. El planificador continua cada cinc minuts.
- Web publicat amb avís explícit de beta a registre, tarifes i subscripció.
  El primer accés verificat al web registra la benvinguda al servidor;
  el servidor conserva les restriccions de destinatari, antiguitat i deduplicació.
  Desplegament inicial `dpl_3pZR7sgMM7oa9cCysa2iaKspmp8L`.
  La versió amb preferències de correu és `dpl_ApVdbj8Yy4eqZA4DAg27tQ9czter`,
  a `https://www.trobar.cat`; afegeix `/consells-bar` i l'observació de seguretat.
- 53 proves de registre/facturació/correu/autenticació i dues proves noves
  de la integració web correctes. Build Next.js i Functions correctes.

### Què està automatitzat i què no

| Àmbit | Estat actual |
|---|---|
| Alta, activació Premium i estat de subscripció | Operatiu amb Stripe sandbox |
| Cancel·lació, canvi de targeta i consulta de factures | Portal sandbox verificat |
| Benvinguda i cinc correus de facturació/prova | Automatització interna activa; cap altre destinatari |
| Verificació i recuperació del compte | Firebase, no Resend; codis reals sintètics aplicats i segon ús rebutjat |
| Altres cinc correus Stripe | Disparadors desplegats per baixa programada, final, canvi de pla, autenticació bancària i reemborsament |
| Consulta rebuda i resposta de suport | Disparadors de Firestore; resposta aprovada mitjançant callable exclusiu d'administradors |
| Compte eliminat | Trigger d'eliminació real de Firebase Auth; comprovació d'absència abans d'enviar |
| Canvi de seguretat | Comparació autoritativa en el següent accés verificat; primer accés només estableix la referència |
| Consell opcional del perfil | Acceptació expressa, un únic avís al cap de 24 h i només si el perfil encara és incomplet |
| Benvinguda nativa | Flag desactivat per defecte; no s'ha publicat cap build nativa |

### Ampliació de les automatitzacions del 6 de novembre

Els deu casos addicionals ja tenen connexió amb la cua interna. En una prova
completa, Resend ha confirmat `delivered` per als deu correus. S'han utilitzat
comptes i documents dels emuladors `demo-trobar-email`, dades Stripe fictícies
i un rellotge avançat només dins de la prova del consell. No és una prova de
deu esdeveniments financers reals ni d'una espera real de 24 hores.
Test reproduïble: `functions/test/emailDelivery.extra.resend.cjs`.

- Webhook sandbox de troBar: ara escolta també `invoice.payment_action_required`,
  `refund.created` i `refund.updated`. No s'ha modificat cap webhook live ni d'Aparador.
- La baixa programada es comprova de nou abans d'enviar: si s'ha desfet, l'avís
  se suprimeix. El final de Premium només es comunica amb una subscripció acabada.
- Els canvis de pla requereixen diferències reals de preu/quantitat; una actualització
  ordinària no genera aquest correu. Els canvis superats per un altre pla se suprimeixen.
- La petició d'autenticació es revalida amb el PaymentIntent i apunta a la factura
  allotjada de Stripe. Els reemborsaments s'enllacen amb la factura i subscripció
  del propietari; només es comunica l'import real del reemborsament completat.
- La consulta de suport es confirma quan queda desada. Una resposta només s'envia
  després de l'aprovació d'un compte amb la claim `role=admin`, mitjançant
  `replyToContact({messageId, replyId, text})`. `replyId` és un UUID que s'ha de
  conservar en reintents. No hi ha un nou panell d'operador ni s'han concedit
  permisos d'administrador a cap compte.
- Respostes de suport: text d'un paràgraf de fins a 1.800 caràcters, subjecte a
  la validació del límit escapat del proveïdor. No es pot triar un destinatari
  arbitrari. Respondre directament des de Workspace no crea un esdeveniment
  d'aquest sistema: la bústia de Google i l'eina interna continuen separades.
- La prova sobre el `submitContact` real ha detectat i corregit un error
  d'inicialització: Firebase Functions pot tenir una app anomenada sense app
  per defecte. Ara s'assegura explícitament `[DEFAULT]`. Funció desplegada amb
  el codebase `contact`; alta de consulta real sintètica comprovada i netejada.
- `recordAccountSecurity` consulta Firebase Auth, no accepta descripcions del
  client i compara correu, proveïdors i validesa de les sessions. No és un detector
  de login sospitós ni una notificació immediata del canvi de contrasenya: el
  canvi s'observa en el següent accés verificat. Web connectat; codi natiu preparat,
  sense publicació d'una versió mòbil.
- Consells: desactivats per defecte. El consentiment té versió i data guardades
  al servidor. Es poden activar/desactivar a la configuració del bar de l'app
  o a `https://www.trobar.cat/consells-bar`, amb sessió del propietari.
  Només s'envia un avís per bar, després de 24 h des de la primera acceptació.
  Es comprova que Premium continuï actiu i que falti descripció, galeria o serveis.
  El mateix correu inclou l'enllaç de baixa; cap opció ve premarcada.
- Una prova addicional amb compte i bar sintètics a Firebase real ha comprovat
  preferència inicial desactivada, alta expressa, baixa, consulta i rebuig de
  respostes de suport d'un compte no administrador. S'han eliminat les dades
  de prova; no s'han creat recursos Stripe ni enviat correus a aquesta adreça.
  També s'ha verificat que el trigger real de baixa d'Auth elimina el consentiment:
  la baixa neteja la referència de seguretat, els seus esdeveniments i el consentiment
  de consells. Els canvis de seguretat porten una seqüència perquè tornar a un estat
  anterior no amagui un canvi nou. Build de Functions i 26 proves finals superades.

Les funcions afegides són `onContactEmail`, `replyToContact`,
`onSupportReplyEmail`, `onAccountDeletedEmail`, `recordAccountSecurity`,
`onAccountSecurityEmail`, `getBarEmailTips` i `setBarEmailTips`.
S'han actualitzat `processEmailQueue` i `stripeWebhook`, mantenint els flags
interns i el planificador de cinc minuts. Els jobs acceptats, suprimits o
fallits definitivament eliminen destinatari, contingut i payload de la cua.

### Pendent de configuració manual de Firebase

L'API oficial ha retornat `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` tant per als
camps de plantilla com per al canvi d'URL d'acció. No s'ha forçat cap accés
alternatiu ni canviat el transport. L'URL actual continua sent
`https://trobar-1123f.firebaseapp.com/__/auth/action`.

A [Firebase Authentication, Templates](https://console.firebase.google.com/project/trobar-1123f/authentication/emails),
revisar verificació i recuperació:

1. Nom del remitent: `troBar`; resposta a `suport@trobar.cat`.
2. Assumptes: «Confirma el teu correu de troBar» i «Canvia la contrasenya de troBar».
3. Si la consola ho permet, personalitzar l'URL d'acció a
   `https://www.trobar.cat/auth/action`, ja desplegada i amb proves.
4. Enviar una verificació i una recuperació noves al compte intern i revisar-les.
   No cal compartir cap contrasenya ni enllaç amb codi. Les 18 plantilles de
   Resend no substitueixen per si soles els dos enviaments de Firebase.

El disseny nou de Resend s'ha revisat al navegador; la confirmació anterior
de Gmail iPhone corresponia al disseny previ. Falta comprovar els missatges
que han arribat avui al dispositiu abans d'obrir enviaments generals.

Per reproduir les proves internes autoritzades:

```powershell
npm --prefix functions run build
$env:EMAIL_REAL_SEND_CONFIRM='trobar-internal'
firebase emulators:exec --config firebase.json --only "auth,firestore" --project demo-trobar-email "node functions\test\emailDelivery.billing.resend.cjs"
# Els deu casos nous; torna a enviar correus reals només a l'adreça interna:
firebase emulators:exec --config firebase.json --only "auth,firestore" --project demo-trobar-email "node functions\test\emailDelivery.extra.resend.cjs"
```

La preparació de desplegament manté el bloqueig per defecte. Després de
verificar el portal, l'opció explícita activa només el destinatari intern:

```powershell
node scripts\prepareEmailDeploy.cjs --enable-internal-billing
firebase deploy --config .expo\email.firebase.json --only "functions:recordFirstLogin,functions:processEmailQueue,functions:createBillingPortalSession,functions:getSubscriptionStatus,functions:stripeWebhook" --project trobar-1123f --non-interactive
# Els triggers nous tenen reintents i requereixen --force en el primer desplegament:
firebase deploy --config .expo\email.firebase.json --only "functions:onContactEmail,functions:replyToContact,functions:onSupportReplyEmail,functions:onAccountDeletedEmail,functions:recordAccountSecurity,functions:onAccountSecurityEmail,functions:getBarEmailTips,functions:setBarEmailTips" --project trobar-1123f --non-interactive --force
# El formulari de contacte conserva el seu codebase propi:
node scripts\prepareContactDeploy.cjs
firebase deploy --config .expo\contact.firebase.json --only "functions:contact:submitContact" --project trobar-1123f --non-interactive
```

### Abans d'obrir contractacions reals

Cal una autorització nova. Encara s'han de preparar el compte i els preus
Stripe de producció de troBar, la informació fiscal de factures i impostos,
el webhook i el portal de producció, la política d'enviaments a clients,
la revisió dels consentiments i la gestió operativa de suport. L'usuari ha escollit expressament continuar
amb beta, no activar aquests passos.

## Històric del 5 de novembre

Les notes següents documenten l'estat anterior; els flags, el disseny i les
comprovacions vigents són els de l'apartat del 6 de novembre.

### Configuració completada el 5 de novembre de 2026

- Domini `trobar.cat` verificat a Resend, regió `eu-west-1`, TLS obligatori,
  recepció desactivada i sense seguiment de clics/obertures.
  Domini Resend: `e9f493ed-d0d5-4740-b5aa-df026927bfe0`.
- DNS afegits amb autorització: DKIM `resend._domainkey`, MX/TXT de `send`,
  CNAME `rsend` i DMARC `v=DMARC1; p=none;`. MX de Workspace i SPF
  preexistent de Google/Firebase conservats i verificats.
- Clau **troBar internal delivery**, ID `4594d200-4294-4695-bd01-4d6c78dc5389`,
  només `sending_access` i restringida al domini. Guardada directament a
  Secret Manager, projecte `trobar-1123f`, secret `RESEND_API_KEY`, versió 1.
  El valor no s'ha mostrat al xat, escrit al repositori ni passat al frontend.
  L'accés administratiu de preparació queda separat al perfil CLI
  `trobar-setup`, protegit pel Windows Credential Manager.
- Les 18 plantilles són a [Resend](https://resend.com/templates).
  [Manifest d'identificadors i variables](../../emails/resendTemplates.json).
  El servidor envia l'ID publicat i variables exactes amb l'SDK oficial,
  no HTML inline. Tots els assumptes automàtics porten `[PROVA INTERNA]`.
- Funcions desplegades de manera aïllada: `recordFirstLogin`,
  `processEmailQueue`, `createBillingPortalSession` i `stripeWebhook`.
  No s'han desplegat els canvis aliens de la resta del workspace.
  Configuració: `EMAIL_DELIVERY_MODE=internal`,
  `EMAIL_INTERNAL_RECIPIENTS=frolesti4@gmail.com`,
  `EMAIL_PORTAL_READY=false`, `STRIPE_ALLOW_LIVE_BILLING=false`.
- Planificador cada cinc minuts, comprovat amb resposta HTTP 200.
  Els callables rebutgen peticions sense autenticar; el webhook rebutja
  esdeveniments sense signatura vàlida.
- Portal Stripe creat només al sandbox troBar `acct_1UXk1DAUryIYBpYR`:
  `bpc_1UYVMCAUryIYBpYRU1aS5un3`. Permet factures, actualitzar el mètode
  de pagament i cancel·lar al final del període, sense eliminar el compte.
  No permet canviar de pla des del portal ni s'ha cancel·lat cap subscripció existent.
- Prova real pel mateix handler de primer accés i la cua, amb Auth/Firestore
  aïllats als emuladors `demo-trobar-email`, sense crear usuaris a producció.
  Dos intents amb la mateixa clau han retornat un únic ID; el compte de Resend
  ha creat un sol correu per execució. La cua elimina contingut i destinatari després d'acceptar.
- Correu real `01a1acf9-079e-769b-b398-3c12ba3d5da7`: **`delivered`**,
  destinatari `frolesti4@gmail.com`, remitent `suport@trobar.cat`.
  Variables resoltes, escapament HTML correcte, alternativa de text present,
  HTML de 4.757 bytes i logo públic amb HTTP 200.
  [Lliurament i Insights](https://resend.com/emails/01a1acf9-079e-769b-b398-3c12ba3d5da7?tab=insights).
  `delivered` no acredita que Gmail l'hagi col·locat a Principal en comptes de correu brossa.

### Què queda per gestionar

1. **Verificació humana i portal.** La recepció del primer correu ja està
   confirmada per l'usuari. Revisar ara el nou disseny a Gmail, aspecte en
   mòbil i resposta a `suport@trobar.cat`.
   Obrir `https://www.trobar.cat/subscripcio` amb el compte del bar de sandbox,
   entrar a Stripe i comprovar factures i cancel·lació. No confirmar la
   cancel·lació d'un bar que es vulgui conservar; utilitzar un cas de prova.
   La pàgina ja està publicada: HTTP 200 i formulari de login comprovats.
   El primer desplegament web s'ha encallat a Vercel i s'ha cancel·lat;
   el reintent de la mateixa instantània neta ha acabat en **Ready**, sense
   incloure altres canvis locals. Desplegament verificat:
   [Vercel](https://vercel.com/frolestis-projects/trobar-landing/9UviS8qnvPEb2q5ZT9cCnk61S79J).
   La comprovació del portal amb el compte del propietari encara requereix
   iniciar sessió privadament; no cal compartir la contrasenya al xat.
2. **Activació de beta, no clients reals.** Només després de la comprovació
   del portal, posar `EMAIL_PORTAL_READY=true` al servidor per al planificador
   i webhook. Per provar la benvinguda des de l'app local:

   ```powershell
   $env:EXPO_PUBLIC_ENABLE_LIFECYCLE_EMAILS='true'
   npm run start:raw -- --web --port 8088
   ```

   Comprovar que el log indica Firebase `trobar-1123f`; si indica un altre
   projecte, aturar la prova i revisar l'entorn abans de registrar comptes.
   Cal un compte verificat creat fa menys de set dies, amb l'adreça autoritzada:
   un compte antic no rep benvingudes retrospectivament.
   No eliminar cap compte existent per repetir aquesta prova: per a això hi
   ha la prova aïllada amb emuladors, ja executada amb Resend real.
   Aquesta variable no obre enviaments a altres adreces. Per a una build beta
   publicada cal configurar-hi el mateix flag i desplegar el client explícitament;
   no s'ha publicat cap versió nativa ni els canvis aliens de l'app.

Operació de backend des de l'arrel del repositori:

```powershell
npm --prefix functions run build
node scripts\prepareEmailDeploy.cjs
```

La preparació deixa **sempre** `EMAIL_PORTAL_READY=false`. Un cop el portal
estigui verificat, obrir la configuració generada i canviar només aquesta línia
a `true`; no posar-hi cap secret ni canviar la llista de destinataris:

```powershell
notepad .expo\email-functions\.env.trobar-1123f
firebase deploy --config .expo\email.firebase.json --only "functions:recordFirstLogin,functions:processEmailQueue,functions:createBillingPortalSession,functions:stripeWebhook" --project trobar-1123f --non-interactive
```

No executar el desplegament general de totes les funcions. La preparació
extreu i comprova els handlers necessaris, conserva els IDs de preus ja
desplegats i exclou les funcions de partits/contacte i altres canvis aliens.
Les credencials es continuen obtenint de Secret Manager.
Els canvis de codi continuen al workspace sense commit automàtic. Abans del
pròxim desplegament des de Git, incloure la integració i la pàgina de subscripció
per no substituir accidentalment aquesta publicació amb una versió antiga.

`npm audit --omit=dev` de Functions informa de 22 avisos (3 crítics, 7 alts,
11 moderats i 1 baix); no assenyala `resend` com a dependència directa afectada.
No s'han aplicat actualitzacions alienes ni `audit fix --force`. Revisar l'arbre
de dependències abans d'obrir enviaments i facturació a clients reals.

## Implementació del 5 de novembre de 2026

### Disseny i catàleg

[Galeria de les 18 plantilles](../previews/index.html).
Totes reutilitzen [template.cjs](../../emails/template.cjs): logo de 56 px i
marca al capdamunt, sense mosaic de logos ni eslògans repetits; títol únic;
salutació separada; bloc destacat només quan hi ha dades útils com imports;
una acció principal. El peu queda reservat al contacte.
HTML amb taules i CSS inline, contingut escapats i alternativa de text pla.

### Revisió del to i les entrades de gestió

Referències públiques consultades:
[Airbnb](https://pageflows.com/emails/product/airbnb/),
[OpenTable](https://pageflows.com/emails/product/open-table/) i
[Spotify](https://pageflows.com/emails/product/spotify/).
Les galeries serveixen per comparar intencions: descobrir una proposta,
confirmar una acció i comunicar una subscripció no necessiten el mateix missatge.
No s'ha copiat HTML ni text propietari; les plantilles i el redactat són originals.

- Benvinguda: «Benvingut a troBar», una invitació curta a trobar el pròxim
  partit i una única acció. Sense panell d'«Estat del compte», frase sobre
  la freqüència d'enviament ni etiqueta «Correu automàtic».
- Alta, prova i cobrament: data i hora reals, import previst o confirmat,
  periodicitat i acció corresponent. Un avís de renovació no és un rebut.
  Els recordatoris no diuen «demà»: el retard de la cua pot travessar mitjanit.
- Suport: la referència va als detalls, no ocupa un gran panell.
  Es manté la invitació a respondre al mateix fil.
- Seguretat, renovació automàtica, cancel·lació i baixa dels consells opcionals:
  es conserven perquè afecten el destinatari, no perquè expliquin la implementació.
- Títol destacat, menys ornaments, paràgrafs llegibles, un sol enllaç d'acció
  en HTML i logo al començament.
- Els correus de prova mantenen `[PROVA INTERNA]` a l'assumpte.
  Aquesta protecció no forma part del redactat destinat a clients.

**Recomanació de gestió:** mantenir app com a entrada principal i
`https://www.trobar.cat/subscripcio` com a alternativa des dels correus,
ordinador o sense l'app instal·lada. Les dues entrades han d'obrir el mateix
Customer Portal autenticat; no cal crear dos sistemes de facturació.
El botó **«Gestionar la subscripció» de l'app ja crida
`createBillingPortalSession`**: factures, targeta i cancel·lació ordinària del
mateix portal que el web. El selector de periodicitat té un botó separat.
A iOS/Android s'obre el navegador integrat i es refresca l'estat en tornar.
Al web s'obre una pestanya des del gest de l'usuari abans de la crida asíncrona,
se'n desconnecta l'opener i també es refresca en recuperar el focus.
Demo, doble clic, errors i respostes d'origen no permès estan controlats.
La cancel·lació associada a eliminar el compte continua sent una acció diferent.
La integració nativa és al codi local; no s'ha publicat una build ni OTA de l'app.

### Tipografia i modes de color: Gmail iPhone

El destinatari ha indicat que utilitza **Gmail a l'iPhone**. Referències:
[Litmus: compatibilitat de mode fosc](https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers)
i [Rémi Parmentier: inversió de Gmail iOS i blend modes](https://www.hteumeuleu.com/2021/fixing-gmail-dark-mode-css-blend-modes/).

- Logo al capdamunt. Marca **Oi** en PNG complet, amb fons crema preservat;
  URL nova `wordmark-email-oi.png` per evitar la imatge anterior a la memòria
  cau de Gmail. Els títols fan servir Barlow Condensed Bold, amb alternatives
  del sistema quan el client no admet fonts web. Gmail no admet `@font-face`.
- Font original i llicències OFL conservades a [fonts](../../assets/web/fonts/).
  `sync-shared-assets.js` les materialitza, juntament amb els logos, per als
  desplegaments. Font pública: HTTP 200, `font/ttf` i CORS `*`.
- Mode fosc explícit per a Apple Mail i clients compatibles, sense blanc sobre
  blanc. A Gmail iOS, gradients de color constant preserven la base de marca
  i dues capes de blend eviten que el blanc del botó es converteixi en negre.
  És una adaptació de compatibilitat, no un canvi del contingut del missatge.
- 72 combinacions de previsualització comprovades: 18 plantilles × dos modes
  × amplades 360/390 px; sense desbordament ni imatges fallides. Contrast mínim
  mesurat del text: **5,50:1**, superior al llindar **4,5:1**.
- Type-check de l'app, 40 proves focalitzades i bundle iOS han passat.
  La prova de captura addicional del render de Gmail no s'ha completat:
  el navegador integrat ha deixat de respondre. Les previsualitzacions i el
  contrast CSS no substitueixen una comprovació visual al Gmail real de l'iPhone.
- **Comprovació al dispositiu completada:** l'usuari ha indicat «Es veu bé»
  tant per al mode clar com per al mode fosc. Últim correu:
  `01a1adf6-27a4-71cc-a369-5344b7b3bcd7`, estat Resend **`delivered`**,
  amb logo al capdamunt, imatge nova, paleta fosca, capes Gmail, text pla i
  variables resoltes. Doble petició idempotent amb un únic ID.
  [Correu final](https://resend.com/emails/01a1adf6-27a4-71cc-a369-5344b7b3bcd7?tab=insights).
- Les 18 plantilles s'han tornat a llegir i comprovar amb el contingut final.
  Una petició de lectura ha patit timeout; el mateix comandament ha reprès
  l'operació verificant les versions ja actualitzades, sense tornar-les a publicar.
  No s'han activat enviaments a clients ni canviat les proteccions de sandbox.
- Assets publicats de forma aïllada sobre la versió web coneguda, preservant
  el portal i els altres canvis publicats:
  [Vercel](https://vercel.com/frolestis-projects/trobar-landing/HyHpCyfJFEGwHXAZ1SHioJdUR7fy).

**Revisió verificada:** les 18 versions noves s'han publicat i tornat a llegir
de Resend amb HTML, assumpte i variables exactes. IDs i esquemes es mantenen:
no ha calgut tornar a desplegar el backend ni canviar les proteccions internes.
Han passat 36 proves focalitzades i el build de Functions. Benvinguda, alta,
rebut i recordatori s'han comprovat a 360 i 1440 px, sense desbordament,
amb un únic títol i el logo carregat.

El nou correu de prova, `01a1ad74-97e9-7d2c-950e-084aa93abc1b`, està
**`delivered`** a `frolesti4@gmail.com`. Assumpte:
`[PROVA INTERNA] Benvingut a troBar`. HTML de 3.371 bytes, salutació «Hola!»,
text pla present, sense variables pendents, panel d'estat ni notes sobre
l'automatització. El mateix handler i la cua han acceptat dos intents amb
un únic ID de proveïdor.
[Correu revisat](https://resend.com/emails/01a1ad74-97e9-7d2c-950e-084aa93abc1b?tab=insights).
Els correus ja rebuts no es modifiquen retroactivament.

| Família | Plantilles | Automatització preparada |
|---|---|---|
| Compte | Verificació, recuperació, benvinguda al primer accés verificat | Només benvinguda; verificació/recuperació mantenen Firebase fins a migració explícita |
| Alta de bar | Bar Premium actiu, dates i import previst | Checkout/subscripció confirmada `trialing` |
| Prova | Avís T−7 i T−1 | Cua programada segons `trial_end` real |
| Pagaments | Rebut, fallada, autenticació bancària pendent | Rebut i fallada; autenticació pendent només dissenyada |
| Subscripció | Renovació cancel·lada, final de Premium, canvi de pla | Només disseny, pendent de disparadors |
| Reemborsament | Import reemborsat confirmat | Només disseny; exigir reemborsament `succeeded` abans d'enviar |
| Suport | Consulta rebuda i resposta amb contingut | Només disseny |
| Seguretat | Compte eliminat i canvi de seguretat | Només disseny; només després de completar realment l'operació |
| Opcional | Consells per completar el perfil del bar | Només disseny; requereix preferències i baixa funcional |

### Què fa l'automatització

- [emailDelivery.ts](../../functions/src/emailDelivery.ts) gestiona una cua
  privada `emailJobs`. Clau estable per fita, transaccions, reserva de treball,
  màxim cinc intents i finestra inferior a les 24 h d'idempotència de Resend.
- `processEmailQueue` consulta els treballs vençuts cada cinc minuts. Els
  recordatoris caduquen al cap d'una hora: no s'envien dies després com si
  encara fossin a temps. Canvis de `trial_end` creen noves fites; les antigues
  es descarten després de rellegir Stripe.
- `recordFirstLogin` només fa servir el compte autenticat i verificat.
  La benvinguda és única per UID i no es recupera per a comptes creats fa més
  de set dies. L'app la registra després de carregar el perfil, només si
  `EXPO_PUBLIC_ENABLE_LIFECYCLE_EMAILS=true`. No rep cap destinatari del client.
- El cobrament continua sent responsabilitat de Stripe al final de la prova.
  **No hi ha un cron que cobri ni que anunciï un cobrament sense prova.**
  El webhook signat `invoice.paid`, amb factura `paid` i `amount_paid > 0`,
  crea el rebut. El correu arriba després de la confirmació, normalment en
  els minuts següents, no necessàriament a mitjanit ni al minut exacte.
- `invoice.payment_failed` crea un avís diferent. Abans d'enviar, es rellegeix
  la factura: si ja està pagada no s'envia la fallada. Una factura inicial de
  0 EUR no crea cap rebut de cobrament.
- Abans de cada enviament es comproven l'email verificat actual, propietat
  del bar/subscripció/factura, estat del trial, cancel·lació i destinatari intern.
  Imports de previsió venen de `invoices.createPreview`; rebuts, de la factura.
- Un reintent reutilitza exactament el mateix cos i `Idempotency-Key`.
  L'SDK tracta explícitament `{ data, error }`; errors 4xx definitius no es
  reintenten. Errors de xarxa, 429 i 5xx es reintenten dins dels límits,
  respectant `Retry-After` tant en segons com en data HTTP.
  `accepted` significa acceptació per Resend, no lliurament a la safata.
  En acceptar s'eliminen cos, destinatari i dades de contingut de la cua,
  conservant el registre mínim per evitar duplicats.
- `/subscripcio` autentica el propietari i crida `createBillingPortalSession`.
  Els emails apunten a aquesta ruta estable, no a una sessió efímera.
  La sessió Stripe es crea al clicar, sense permetre customer ni retorn
  arbitrari. Aquest portal no elimina el compte ni el customer.

### Posada en marxa: només proves internes autoritzades

1. **Completat:** compte de Resend i `trobar.cat` verificats amb els seus DNS.
   No substituir els MX de Workspace ni duplicar SPF. Configurar DKIM i
   DMARC i comprovar enviament/resposta de les bústies existents.
2. **Completat:** clau restringida guardada fora del xat. Per a futures rotacions:
   `firebase functions:secrets:set RESEND_API_KEY --project trobar-1123f`.
   No versionar-la ni posar-la al frontend.
3. Customer Portal de Stripe **sandbox** configurat; comprovar cancel·lació
   al final del període i provar que cancel·lar no exigeix eliminar el compte.
   Desplegar i provar la ruta `/subscripcio` i el callable abans de marcar
   `EMAIL_PORTAL_READY=true`. L'email de facturació espera aquesta comprovació.
4. A la configuració servidor, establir `EMAIL_DELIVERY_MODE=internal`,
   `EMAIL_INTERNAL_RECIPIENTS` amb les adreces exactes autoritzades i
   `EMAIL_PORTAL_READY=true` només després de la prova del portal.
   Sense aquesta configuració, no es programa ni envia cap correu a clients.
   El codi rebutja també les subscripcions live: no existeix un mode de
   lliurament general habilitable simplement amb una variable.
5. Backend desplegat de manera dirigida. Per a futures actualitzacions,
   fer build de Functions: inclou els CJS compartits i els JSON de marca/contacte
   dins del paquet de desplegament mitjançant `prepareEmailFunctions.cjs`.
   Desplegar de manera dirigida `recordFirstLogin`, `processEmailQueue`,
   `createBillingPortalSession` i `stripeWebhook`, i publicar el web/app
   corresponents. No desplegar funcions alienes ni activar live.
6. Habilitar el flag de l'app només per a la beta interna. Provar alta,
   primer accés, canvi de dates, cancel·lació, fallada, pagament confirmat,
   duplicats i lliurament real a les adreces autoritzades.
7. Abans de clients reals: aprovar desplegament/live, completar comprovacions
   Gmail/Outlook, rebots/lliurament i política de retenció d'errors. Revisar els
   avisos natius de Stripe per no duplicar T−7 o rebuts. No desactivar-los
   anticipadament ni activar la campanya opcional sense consentiment.

Validació del disseny anterior: **88 proves dirigides correctes**, builds de Next
i Functions i type-check de l'app correctes. Després de la integració Resend:
**49 proves dirigides correctes**, build de Functions, una integració amb Auth
i Firestore i una prova real Resend amb deduplicació, totes correctes.
La integració amb Auth
i Firestore als emuladors aïllats `demo-trobar-email`: compte verificat,
deduplicació concurrent, denegació de lectura/escriptura des de client,
reserva concurrent, acceptació amb transport simulat, eliminació del contingut
després d'acceptar i caducitat. La prova separada de Resend ha enviat un únic
missatge real al destinatari intern autoritzat.
Els 18 exemples s'han revisat al navegador a 360 i 1440 px, sense
desbordament i amb el logo carregat. Això no substitueix proves a Gmail/Outlook.

Comandes de validació específiques:

```powershell
node emails\renderPreview.cjs
node --test tests\testResendTemplates.cjs tests\testPasswordResetEmail.cjs tests\testLifecycleEmails.cjs tests\testLifecycleClient.cjs functions\test\emailDelivery.test.cjs
npm --prefix functions run build
firebase emulators:exec --only "auth,firestore" --project demo-trobar-email "node --test functions\test\emailDelivery.emulator.cjs"
```

La prova de proveïdor real requereix confirmació explícita. Cada execució crea
una prova nova i pot enviar **un correu real** a `frolesti4@gmail.com`:

```powershell
$env:EMAIL_REAL_SEND_CONFIRM='trobar-internal'
firebase emulators:exec --only "auth,firestore" --project demo-trobar-email "node functions\test\emailDelivery.resend.cjs"
Remove-Item Env:\EMAIL_REAL_SEND_CONFIRM
```

Les plantilles allotjades es poden editar a Resend sense desplegar el servidor.
No canviar els noms/tipus de variables sense actualitzar el manifest i el codi.
`node scripts\publishEmailTemplates.cjs` crea/publica les que falten i verifica
les variables; no sobreescriu el contingut de plantilles ja registrades.
Per substituir expressament el disseny i el text de les plantilles existents:

```powershell
node scripts\publishEmailTemplates.cjs --update
```

La CLI oficial ja instal·lada s'executa des de la memòria cau (`--offline`),
sense reinstal·lar-la a cada petició; les crides a Resend continuen sent en línia.
El mode d'actualització conserva IDs i exigeix el mateix esquema de variables.
Resol una vegada la CLI oficial de la memòria cau i reutilitza el seu entrypoint.
Si la versió publicada ja coincideix amb les fonts, la verifica sense generar
un altre esborrany; una operació interrompuda es pot reprendre amb el mateix comandament.
Publica i torna a llegir HTML, assumpte, estat i variables per comprovar-los:
Resend retorna la versió publicada fins que es publica el nou esborrany.
Si canvien els noms de variables, s'atura i exigeix una migració coordinada.
No activa cap disparador ni amplia els destinataris autoritzats.
Les fonts locals es mantenen per autoria i previsualització reproduïbles.

### Decisions confirmades el 5 de novembre de 2026

- Renovació **automàtica** en acabar el trial si el titular no cancel·la.
  El recordatori informa de data/import i permet gestionar la subscripció:
  no demana una segona autorització ni condiciona el cobrament a respondre
  el correu.
- La confirmació del web mostra la data de Stripe, però no promet cap
  recordatori mentre no s'hagi habilitat i provat el lliurament.
- L'app encara no té fitxes publicades a les botigues; els correus no han
  d'incloure enllaços genèrics de descàrrega ni botons sense destinació real.

### Correu dedicat a l'aplicació: ordre de posada en marxa

1. **Bústies creades a Google Workspace:** `hola@trobar.cat` per a consultes
   generals i col·laboracions; `suport@trobar.cat` per a incidències, ajuda
   i privacitat; `facturacio@trobar.cat` per a factures, cobraments i
   subscripcions. Són les úniques adreces públiques de troBar.
   La font canònica del web i l'app és
   [contactEmails.json](../../app/src/data/contactEmails.json).
2. **DNS del domini:** verificar propietat i configurar els MX del proveïdor
   per rebre correus. Activar SPF, DKIM i DMARC seguint els valors exactes
   del proveïdor; no crear registres SPF duplicats ni inventar claus DKIM.
3. **Enviaments automàtics:** seleccionar un servei transaccional, per
   exemple Resend, i verificar els emissors existents. Utilitzar
   `facturacio@trobar.cat` com a emissor i `Reply-To` dels recordatoris de
   cobrament i rebuts; `suport@trobar.cat` per a correus de compte i ajuda.
   No introduir altres adreces públiques. Una bústia no activa, per si sola,
   els recordatoris de l'app.
4. **Integració:** guardar credencials al servidor/Secret Manager, mai al
   navegador; preparar plantilles i automatització amb idempotència,
   cancel·lació i dates reals descrites més avall.
5. **Stripe i cancel·lació:** activar el recordatori natiu de 7 dies abans
   només quan toqui operar en live; completar Customer Portal perquè el
   titular pugui cancel·lar sense eliminar el compte. El recordatori propi
   de 24 h requereix el planificador de troBar.
6. **Prova i activació:** verificar lliurament i respostes amb comptes interns.
   Només després anunciar a la UI que s'enviarà un recordatori. Els avisos
   natius de Stripe no s'envien en sandbox.

Punts pendents: la creació de les tres bústies l'ha confirmat el titular;
cal verificar els DNS i provar la recepció i l'enviament real abans de donar
el servei per operatiu. Aquesta actualització no modifica DNS ni configura
emissors a Stripe o Firebase. El formulari web de contacte actual simula l'enviament: no s'ha
d'utilitzar com a canal de cancel·lació o suport operatiu fins a connectar-lo
a un servei real. Els enllaços directes de correu utilitzen les bústies creades.

Objectiu: ajudar el titular a posar el perfil a punt i assegurar que sap
**quan s'acaba la prova, quant pagarà i com pot cancel·lar abans del cobrament**.
Sense urgències artificials, promeses de nous clients ni càrrecs sorpresa.

## Regla de facturació

- L'inici és la creació de la subscripció a Stripe en completar Checkout,
  **no** crear l'usuari Firebase, verificar el correu o guardar l'esborrany.
- La integració actual utilitza `subscription_data.trial_period_days=14`.
  No cal modificar-la per ajornar el primer cobrament.
- La prova dura 14 dies complets. Si l'alta és el «dia 1», el període de
  pagament comença el «dia 15», exactament a `subscription.trial_end`.
- Exemple: alta el **4 de novembre de 2026 a les 22:30**; final de prova i
  inici del període de pagament el **18 de novembre de 2026 a les 22:30**,
  hora de Barcelona. No es factura retroactivament la prova ni s'espera al
  primer dia del mes següent.
- Stripe genera la factura al final de la prova i intenta cobrar després de
  finalitzar-la. L'instant del moviment bancari pot ser posterior: comunicar
  **data prevista**, no garantir una hora de càrrec.
- Plans publicats: mensual **39 EUR/mes**, trimestral **99 EUR/3 mesos**,
  anual **348 EUR/any**. Un anual no es cobra a 29 EUR: això és l'equivalent
  mensual. La data de final del període pagat es llegeix de Stripe, sense
  sumar 30/90/365 dies manualment.
- Els imports dels emails han de reflectir la factura real: impostos,
  descomptes i moneda inclosos quan correspongui. No assumir ni anunciar
  «IVA inclòs» mentre la política fiscal no estigui configurada i aprovada.
- No acabar anticipadament proves existents ni canviar el cicle per activar
  aquesta campanya.

## Calendari recomanat

`T` és el valor actual de `trial_end`, no una data calculada al navegador.
Els dies són orientatius; la planificació treballa amb timestamps.

| Moment | Enviament | Naturalesa | Condició |
|---|---|---|---|
| Inici de prova, dia 1 | La prova ja està activa | Servei | Subscripció `trialing` confirmada |
| 48 h després, aproximadament dia 3 | Posa el perfil a punt | Onboarding opcional | Perfil incomplet i preferències/base legal que permetin aquest missatge |
| T − 7 dies, aproximadament dia 8 | Data i import del primer cobrament | Facturació | Prova vigent, amb renovació prevista |
| T − 24 h, aproximadament dia 14 | Últim recordatori clar | Facturació | Continua en prova i no està cancel·lada ni programada per cancel·lar |
| Després del primer cobrament no nul | Pagament rebut i nou període | Facturació | `invoice.paid`, import pagat > 0 i vinculat al primer període de pagament |
| Si falla el cobrament | Actualitza el mètode de pagament | Facturació | Fallada confirmada; no enviar el rebut d'èxit |

No enviar més missatges per defecte. El `customer.subscription.trial_will_end`
arriba habitualment uns tres dies abans: pot servir com a comprovació i
replanificació. **No afegir un altre correu a T − 3 dies** si ja s'han previst
els de T − 7 i T − 1; evitar saturar el client.

### Qui envia què

- Recomanació inicial: **Stripe envia T − 7 i els rebuts/impagaments**;
  troBar envia l'activació, el recordatori T − 1 i l'onboarding opcional.
- Stripe permet activar recordatoris de prova a Billing → Subscriptions
  and emails. Amb aquests emails habilitats, el recordatori de prova és
  set dies abans. **Stripe no envia aquests recordatoris en sandbox.**
- Si es necessita tota la seqüència amb la plantilla pròpia, troBar ha
  d'assumir tots els avisos i validar els requisits de les xarxes de targetes.
  No apagar l'avís natiu fins que l'alternativa estigui provada.
- Un únic emissor per a cada fita. No duplicar rebut natiu + rebut propi,
  ni recordatori natiu + recordatori propi al mateix moment.

## Disseny visual

Reutilitzar la base existent [template.cjs](../../emails/template.cjs):
marca i logo al capdamunt, paletes clara/fosca, un títol funcional, text breu,
**un únic botó principal**, data/import llegibles i alternativa de text pla.
No copiar el disseny fosc de la web a emails.

En recordatoris, posar la data i l'import abans del botó. La cancel·lació
ha de ser fàcil de trobar, també en text pla. No ocultar-la al peu legal.
Les variables són dades de servidor escapades pel renderitzador.

## Esborrany inicial de la campanya

Els textos següents documenten la proposta inicial, no la versió publicada.
El redactat actual és a [lifecycle.cjs](../../emails/lifecycle.cjs) i es pot
veure a la [galeria](../previews/index.html); el publicador deriva les plantilles
d'aquestes fonts, no d'aquesta secció.

Variables:

- `{nom}`: persona de contacte; salutació sense nom si no consta.
- `{bar}`: nom real del local.
- `{data_final}`: data de `trial_end` en català i zona `Europe/Madrid`.
- `{hora_final}`: hora local amb zona explícita si es mostra un termini.
- `{import_primer}`: import total previst o confirmat, amb moneda.
- `{periodicitat}`: «cada mes», «cada tres mesos» o «cada any».
- `{data_renovacio}`: final del període facturat segons Stripe.
- `{enllac_gestio}`: enllaç segur que autentica i obre un portal de facturació.
- `{enllac_perfil}`: destinació real del perfil del propietari.
- `{enllac_factura}`: factura allotjada de Stripe corresponent al pagament.

La gestió ja disposa de `https://www.trobar.cat/subscripcio`. La resta
d'enllaços de l'esborrany descriuen destinacions necessàries, no garanteixen
rutes implementades. No escriure un URL de dashboard inventat ni enviar un botó inoperant.

### 1. Activació de la prova

**Assumpte:** {bar}: els teus 14 dies de prova ja han començat

**Precapçalera:** Prova activa fins al {data_final}. Aquí tens els següents passos.

**Títol:** El teu bar ja és a troBar

Hola, {nom}!

La subscripció de **{bar}** ja està confirmada. Tens accés Premium durant
14 dies de prova, fins al **{data_final}, a les {hora_final}**.

Si mantens la subscripció, el primer cobrament previst serà de
**{import_primer}** a partir d'aquesta data. Després es renovarà
**{periodicitat}**.

Comença explicant com es viu el partit al teu bar: les pantalles, l'ambient
i l'horari ajuden els aficionats a decidir on anar.

**Botó:** Completar el perfil del bar → `{enllac_perfil}`

Pots gestionar o cancel·lar la subscripció abans que s'acabi la prova des
de `{enllac_gestio}`. T'avisarem abans del primer cobrament.

### 2. Onboarding opcional i condicional

**Assumpte:** Dona més motius per triar {bar}

**Precapçalera:** Completar el perfil ajuda els aficionats a saber què hi trobaran.

**Títol:** Mostra com es viu el partit al teu bar

Hola, {nom}!

Al perfil de **{bar}** encara hi ha detalls per completar. Explica'n
l'ambient i afegeix la informació que falta sobre les pantalles o l'horari.
Ajuda qui busca un lloc per veure el partit a saber què hi trobarà.

**Botó:** Revisar el perfil → `{enllac_perfil}`

La prova continua fins al **{data_final}**.

Adaptar el missatge als camps realment incomplets; no dir que falten fotos,
pantalles o horari si ja hi són. Respectar preferències de comunicació i
incloure baixa dels missatges opcionals. No barrejar aquesta promoció amb
els avisos imprescindibles de cobrament.

### 3. Recordatori set dies abans

Aquest text és l'alternativa de marca si en el futur substituïm l'avís natiu
de Stripe; **no enviar tots dos**.

**Assumpte:** {bar}: la prova s'acaba el {data_final}

**Precapçalera:** Primer cobrament previst: {import_primer}. Revisa la subscripció.

**Títol:** Encara tens una setmana de prova

Hola, {nom}!

La prova gratuïta de **{bar}** s'acaba el **{data_final}, a les {hora_final}**.
Si no cancel·les abans, començarà el període de pagament i Stripe intentarà
cobrar **{import_primer}** al mètode de pagament desat.

La subscripció es renovarà **{periodicitat}**. Els 14 dies de prova no es
cobraran.

**Botó:** Gestionar la subscripció → `{enllac_gestio}`

Des d'aquest mateix enllaç pots revisar el pla, actualitzar la targeta o
cancel·lar abans de la data indicada per evitar el primer cobrament.

### 4. Recordatori 24 hores abans

**Assumpte:** Demà s'acaba la prova de {bar}

**Precapçalera:** Data prevista: {data_final}. Import: {import_primer}.

**Títol:** La prova s'acaba demà

Hola, {nom}!

Et recordem que la prova de **{bar}** s'acaba el **{data_final}, a les
{hora_final}**. A partir d'aquell moment començarà el període de pagament,
amb un primer cobrament previst de **{import_primer}**.

Si vols continuar, no has de fer res. Si prefereixes cancel·lar, fes-ho
abans d'aquesta data des de la gestió de la subscripció.

**Botó:** Revisar o cancel·lar → `{enllac_gestio}`

Si el job no s'executa 24 hores abans, no enviar un «demà» incorrecte:
utilitzar l'assumpte i títol «La prova s'acaba el {data_final}».

### 5. Primer cobrament confirmat

Utilitzar preferentment el rebut/factura natiu de Stripe. Alternativa pròpia:

**Assumpte:** Pagament rebut: {import_primer} · {bar}

**Precapçalera:** La prova ha acabat i el primer període de pagament està actiu.

**Títol:** Pagament confirmat

Hola, {nom}!

Hem rebut el pagament de **{import_primer}** de la subscripció de **{bar}**.
El període facturat comença després de la prova gratuïta i acaba el
**{data_renovacio}**.

**Botó:** Veure la factura → `{enllac_factura}`

La subscripció es renovarà **{periodicitat}**, tret que la cancel·lis.
Pots gestionar-la des de `{enllac_gestio}`.

No disparar aquest correu amb `checkout.session.completed`, una factura de
0 EUR, `trialing`, `invoice.created` ni només `customer.subscription.updated`.

### 6. Cobrament fallit, només si passa

**Assumpte:** Cal revisar el pagament de {bar}

**Precapçalera:** No hem pogut completar el cobrament. Revisa el mètode de pagament.

**Títol:** El pagament no s'ha completat

Hola, {nom}!

Stripe no ha pogut completar el cobrament de la subscripció de **{bar}**.
Revisa el mètode de pagament i l'estat de la factura.

**Botó:** Revisar el pagament → `{enllac_gestio}`

No afirmem que s'hagi cobrat ni prometem que el servei continua actiu si
l'estat real de la subscripció no ho permet. Els reintents i el calendari
de recuperació han de coincidir amb la configuració de Stripe.

## Activació: requisits abans de cap enviament

1. **Cancel·lació funcional:** habilitar i integrar Customer Portal amb sessions
   generades al servidor i permisos del propietari. Cancel·lar durant el trial
   no ha d'exigir eliminar el compte de troBar. Decidir si conserva accés fins
   a `trial_end`; recomanació: cancel·lació programada amb accés fins al final.
2. **Fiscalitat i facturació:** confirmar impostos, preus finals, política de
   renovació i dades fiscals. Renderitzar sempre import i data de Stripe.
3. **Emissor:** seleccionar proveïdor/SMTP, credencials a Secret Manager,
   domini verificat amb SPF/DKIM/DMARC i adreça de suport monitorada.
4. **Preferències:** separar notificacions de servei de comunicacions opcionals.
   No considerar que acceptar les condicions equival a acceptar màrqueting.
5. **Esdeveniments:** afegir i provar `customer.subscription.trial_will_end` si
   la seqüència pròpia l'utilitza. Encara no està afegit al webhook desplegat.
6. **Planificador:** sincronitzar `trial_end` des del servidor i recalcular els
   avisos si canvia. Abans de cada enviament, rellegir Stripe i propietat.
   Ometre avisos de càrrec si la subscripció està cancel·lada, programada per
   cancel·lar, pausada, o si la prova ha acabat.
7. **Idempotència:** registre privat per
   `accountId:subscriptionId:trial_end:tipusAvis`, reserva atòmica, idempotency
   key del proveïdor si en disposa i reintents acotats amb errors explícits.
   No marcar «enviat» abans que el proveïdor accepti el missatge.
8. **Dades reals:** consultar el pla actual; no utilitzar imports antics de
   metadades ni dades inventades. No enviar correus a trials antics per omplir
   retrospectivament fites ja passades. No afirmar cobrament per avançat.
9. **Proves:** rellotges de prova de Stripe per simular final de trial i
   renovacions; provar canvi de pla, ampliació de trial, cancel·lació,
   targeta fallida, webhooks duplicats, reintents i canvi d'hora a Barcelona.
   El sandbox no envia l'avís natiu: verificar el proveïdor propi amb
   destinataris de prova autoritzats, sense enviar a clients reals.
10. **Activació gradual:** habilitar primer per comptes interns. Revisar
    acceptació/lliurament, rebots, duplicats i enllaços abans d'obrir-la.

## Fonts

- [Stripe: períodes de prova gratuïts](https://docs.stripe.com/billing/subscriptions/trials/free-trials)
- [Stripe: requisits i recordatoris de prova](https://docs.stripe.com/billing/subscriptions/trials/manage-trial-compliance)
- [Stripe: configurar proves a Checkout](https://docs.stripe.com/payments/checkout/free-trials)
- [Stripe: portal de client](https://docs.stripe.com/customer-management)
