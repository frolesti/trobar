# Correus de troBar: disseny compartit i lliurament

## Estat real

**Actualització del 6 de novembre de 2026:** les 18 plantilles s'han publicat
amb el disseny aprovat de Lora, logo de 40 px i paleta compartida amb el web.
Els sis correus interns principals s'han lliurat a `frolesti4@gmail.com`;
una altra prova també ha recorregut la cua i el planificador desplegats.
`EMAIL_PORTAL_READY=true` només desbloqueja la facturació interna.
No hi ha enviaments generals ni cobraments reals.

Verificació i recuperació continuen a Firebase. Amb un usuari sintètic real
s'han comprovat els codis de verificació i canvi de contrasenya, i el rebuig
del segon ús. Això no prova el lliurament d'un nou missatge de Firebase.
L'API ha rebutjat els canvis de plantilla/URL amb
`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`; l'URL activa encara és la predeterminada
de Firebase. Passos manuals i estat complet a la
[guia de campanya](TRIAL_EMAIL_CAMPAIGN.md#pendent-de-configuració-manual-de-firebase).
El nom/assumpte personalitzats i el transport Resend per a autenticació no
s'han d'anunciar com a actius.

La confirmació de Gmail iPhone del 5 de novembre correspon a l'aspecte
anterior. Els nous missatges ja lliurats requereixen aquesta revisió real.

### Històric i arquitectura del 5 de novembre

**Disseny renovat i 18 plantilles publicades a Resend el 5 de novembre de 2026.**
Domini verificat i clau restringida guardada a Secret Manager. Backend de
benvinguda/cua desplegat només per proves internes; correus de prova lliurats
a `frolesti4@gmail.com`, amb deduplicació comprovada. L'usuari ha confirmat
que l'última versió es veu bé a Gmail iPhone en mode clar i fosc.
Les 18 versions revisades estan publicades amb els
mateixos IDs i variables; actualitzar-ne la còpia no ha requerit desplegament.
**Verificació i recuperació continuen enviant-se amb Firebase**, no amb Resend.

Els 18 correus comparteixen `emails/template.cjs`: logo i marca al capdamunt,
un títol funcional amb més personalitat, salutació separada i una acció principal
opcional. Sense mosaic d'imatges ni eslògans repetits.
Els blocs destacats es reserven per a imports i dades que cal comprovar:
la benvinguda no inclou un informe d'estat del compte. No es mostra
«Correu automàtic» ni un segon enllaç que repeteixi el botó en HTML;
el text pla conserva la destinació de l'acció.
La marca està rasteritzada perquè Gmail no carrega fonts web;
els títols fan servir **Barlow Condensed Bold**, amb Avenir Next Condensed,
Arial Narrow i Arial com a alternatives. Font allotjada al domini propi amb
CORS públic; fonts originals i llicències OFL a `assets/web/fonts/`.
La marca completa és `assets/web/logos/wordmark-email-oi.png`, renderitzada
directament des del TTF amb Sharp/Pango a 474 × 120 px i mostrada a 158 × 40 px.

Grana de marca, fons crema, cos blanc i botons amb text blanc per mantenir
contrast a Gmail iOS. Paleta fosca explícita per a clients compatibles amb
`prefers-color-scheme`, selectors d'Outlook i tractament específic de Gmail:
gradients de color constant i dues capes de blend per preservar el text blanc.
Chrome no és una prova real de Gmail iPhone: la comprovació final dels dos
modes l'ha fet l'usuari amb el correu lliurat
`01a1adf6-27a4-71cc-a369-5344b7b3bcd7`.
El contingut es passa com a text i s'escapa; no es
creen composicions HTML independents per a cada funcionalitat.

Recuperació (`emails/passwordReset.cjs`), verificació (`emails/emailVerification.cjs`)
i 16 correus de cicle de vida (`emails/lifecycle.cjs`) reutilitzen la base.
La [guia de campanya](TRIAL_EMAIL_CAMPAIGN.md) diferencia els sis enviaments
amb automatització interna preparada de les plantilles encara sense disparador.
El servidor utilitza l'SDK oficial i IDs de plantilles publicades amb variables
exactes. [IDs i variables](../../emails/resendTemplates.json).
El flag de primer accés del client continua desactivat per defecte; els altres
disparadors no s'activen només pel fet de publicar una plantilla.

El flux actual de `app/src/screens/LoginModal/LoginModal.tsx` crida
`sendPasswordResetEmail` del client Firebase. Google genera i envia el correu
amb la configuració d'Authentication del projecte. Crear HTML en aquest
repositori **no modifica** aquella plantilla. El registre de `AuthContext.tsx`
també manté `sendEmailVerification`: la nova variant tampoc no és activa.
La web `web-app/components/ContactForm.tsx` té dues crides més a
`sendEmailVerification` (registre i reenviament); també s'han de migrar al
mateix enviador quan s'activi. Canviar només Expo deixaria la web amb els
correus predeterminats.
Contacte desa consultes a Firestore, no envia correus. Els correus gestionats
per proveïdors externs, com Stripe, necessiten la seva configuració de marca;
no passen automàticament per aquest renderitzador. Els avisos dins de l'app
i les notificacions push continuen utilitzant els seus components propis.

La configuració Firebase versionada inclou Functions, regles i emulador,
però no declara Firebase Hosting. La web Next.js és a `web-app/`, amb
configuració de build per a Vercel. Els DNS de `trobar.cat` són a Vercel,
Google Workspace manté la recepció i Resend només envia. S'han conservat
els MX i l'SPF existents de Google/Firebase. L'estat operatiu i les passes
pendents són a la [guia de campanya](TRIAL_EMAIL_CAMPAIGN.md).

## Veure el disseny

Obre [la galeria](../previews/index.html) al navegador. Inclou els 18 exemples
amb dades fictícies. El logo `assets/web/logos/logo-red.png` apareix a 44 × 44
a la signatura. La marca i tot el contingut important són text: continuen
llegibles si el client bloqueja imatges. Tipografia de sistema i serif de
reserva, sense fonts web, scripts ni píxels de seguiment. El grana prové de
`app/src/theme/brandColors.json`; els contactes de `app/src/data/contactEmails.json`.
Taules de presentació i CSS inline mantenen la compatibilitat de correu.
La nota superior només pertany a la previsualització.

`docs/previews/password-reset-pattern.html` conserva l'enllaç anterior i
es regenera amb el disseny modern de `password-reset.html`. Les proves comproven
la capçalera comuna i el color crema dels botons en recuperació, verificació
i un missatge informatiu de mostra.

El botó apunta a `https://example.invalid/reset-password?preview=1`:
és deliberadament inoperant, no conté cap codi de recuperació ni cap
adreça de destinatari. No utilitzis aquesta previsualització per a enviar.

Regenera-la i comprova les proves des de l'arrel:

```powershell
node emails\renderPreview.cjs
node --test tests\testPasswordResetEmail.cjs
```

Opcionalment, per veure-la amb un servidor local (atura'l després amb Ctrl+C):

```powershell
python -m http.server 8766 --bind 127.0.0.1
```

Visita `http://127.0.0.1:8766/docs/previews/password-reset.html`.
El servidor exposa l'arrel del repositori només a la màquina local; no el
publiquis ni el lliguis a `0.0.0.0`.

El disseny utilitza taules de presentació, CSS inline, alternativa textual,
text explicatiu amb imatges desactivades i CTA amb contrast alt. Cal validar
el resultat final a Outlook, Gmail i mòbil: un navegador no és un client
de correu i alguns clients ignoren arrodoniments o altres detalls.

## Què permet Firebase

### Pàgina pròpia per als enllaços d'autenticació

La web Next.js inclou `/auth/action`, amb la marca de troBar i
botons grana/crema. No és només una previsualització: comprova els codis amb
Firebase, permet desar i confirmar una contrasenya nova i aplicar la verificació
de correu. Els enllaços caducats, reutilitzats o incorrectes tenen missatges
segurs; no es mostren errors tècnics. No admet accions arbitràries ni redirigeix
al `continueUrl` de la URL. Utilitza el projecte Firebase configurat a la web,
mai un `apiKey` proporcionat per l'enllaç.

Per activar-la, **després de desplegar i comprovar la web en HTTPS**:

1. Verifica la configuració Firebase de `web-app/` i afegeix el domini propi a
   Authentication → Settings → Authorized domains, quan correspongui.
2. A Authentication → Templates → Password reset → **Customize action URL**,
   posa `https://<domini-propi>/auth/action`. Comprova també la plantilla de
   verificació de correu. Firebase adjuntarà `mode` i `oobCode` als correus nous;
   no escriguis cap codi ni destinatari en aquesta configuració.
3. Amb un compte de prova, envia un correu nou i comprova recuperació,
   verificació, codi caducat i segon ús. Els enllaços ja enviats no es
   reescriuen. Mantén el handler anterior mentre no s'hagi validat el nou.
4. Si més endavant l'enviament passa al backend propi amb Admin SDK, assegura
   que també genera enllaços amb aquest handler; `continueUrl` per si sol no
   substitueix la pàgina d'acció.

Aquest canvi **no modifica la plantilla del correu enviat**: pàgina d'acció i
enviador HTML són peces separades. No s'ha desplegat ni canviat la consola.
La ruta té `Cache-Control: no-store` i `Referrer-Policy: no-referrer`, elimina
el codi de la barra d'adreces un cop llegit i no el persisteix. Configura també
la redacció dels paràmetres sensibles als logs del proxy/allotjament; no
enganxis enllaços reals a incidències, captures o analítica.

Validació local: `node --test tests\testAuthAction.cjs`, i des de `web-app/`,
`npm run build`. Obrir `/auth/action` sense paràmetres mostra l'estat segur
d'enllaç incorrecte, sense enviar correus ni consumir cap codi real.

### Activació recomanada per a troBar

No hi ha una opció de Firebase que llegeixi automàticament els fitxers HTML
o CJS del repositori. Per conservar exactament el disseny i centralitzar
també futurs avisos oficials, la via recomanada és:

1. **Domini i correu transaccional.** Tria un domini controlat i un proveïdor
   amb API o SMTP, verifica el remitent i configura SPF/DKIM i DMARC.
   Defineix també un Reply-To atès. No activis enviament des d'una adreça
   d'un domini que no controles.
2. **Imatge pública.** Publica `logo-red.png` en una URL HTTPS
   estable sense autenticació. Aquest és el `logoUrl` de tots els renderitzadors;
   la ruta relativa de les previsualitzacions no serveix en un correu real.
3. **Servidor Firebase.** Implementa Cloud Functions per a recuperació i
   verificació. Amb Admin SDK, genera els enllaços mitjançant
   `generatePasswordResetLink` i `generateEmailVerificationLink`. Firebase
   continua gestionant usuaris i codis; generar un enllaç no envia cap correu.
4. **Un sol enviador.** Les funcions han d'utilitzar el mateix enviador de
   plantilles allotjades que la benvinguda: ID publicat i variables, no HTML inline.
   Les fonts de `emails/template.cjs` continuen servint per autoria i previews.
   Configura remitent, imatge i dominis autoritzats al servidor, no al client.
   Conserva les credencials a Secret Manager. Els detalls de seguretat i
   d'empaquetat són a la Via B.
5. **Connectar tots els clients.** Després de validar el servei, substitueix
   `sendPasswordResetEmail` a Login i `sendEmailVerification` al registre
   d'Expo i als dos camins de la web. Per verificar, el servidor obté el
   destinatari de l'usuari autenticat, no d'un correu arbitrari de la petició.
   Per recuperar l'accés, limita abusos i respon de manera que no reveli si
   el compte existeix. No deixis l'enviament antic en paral·lel.
6. **Validar i desplegar.** Prova HTML i text, imatges bloquejades, enllaços
   vàlids/caducats/reutilitzats, reenviaments i lliurament a comptes autoritzats.
   Mantén inicialment el handler d'acció Firebase verificat: no canviïs
   «Customize action URL» per apuntar a la home o a una previsualització.
   Desplega les funcions i els clients només amb configuració real i autorització.

**Pendent d'activació:** domini/remitent, proveïdor, URL pública de la
capçalera, servei backend d'enviament i canvi de les crides dels clients.
El disseny aprovat i el renderitzador ja estan preparats; aquests passos
d'infraestructura encara no s'han executat.

Fonts oficials revisades el 30-10-2026:

1. [Personalització de correus de compte](https://support.google.com/firebase/answer/7000714?hl=en):
   Firebase permet personalitzar remitent, resposta, assumpte i, per a
   recuperació, el missatge. Documenta `%LINK%`, `%APP_NAME%`,
   `%DISPLAY_NAME%` i altres marcadors. Això **no garanteix** que l'editor
   estàndard accepti qualsevol HTML/CSS o reprodueixi aquest disseny.
2. [Enllaços d'acció amb Admin SDK](https://firebase.google.com/docs/auth/admin/email-action-links):
   Google descriu els correus del client com a plantilles de personalització
   limitada. Per a disseny, logos i lliurament propis, documenta generar
   l'enllaç al servidor i enviar-lo amb el servei de correu escollit.
3. [Domini propi per a correus Firebase](https://firebase.google.com/docs/auth/email-custom-domain):
   a Authentication → Templates → editar → Customize domain, afegeix el
   domini; publica exactament els TXT/CNAME indicats; espera la verificació
   (pot trigar 24 hores) i prem Apply Custom Domain. Aquesta configuració
   cobreix el domini del From i dels enllaços d'acció. No és només canviar
   `authDomain` a l'app. En multi-tenant cal revisar l'herència del tenant.
4. [Configuració d'Identity Platform](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config#SendEmail):
   documenta `CUSTOM_SMTP`, host, port, usuari, contrasenya i SSL/START_TLS;
   també `EmailTemplate.bodyFormat = HTML` i els marcadors. L'existència
   d'aquesta API no prova que la consola o el projecte actual tinguin totes
   aquestes opcions disponibles ni que acceptin qualsevol HTML. Cal revisar
   el producte habilitat, permisos i restriccions abans d'escollir aquesta via.
   SMTP només canvia el transport: no activa automàticament aquest renderitzador.
   Si el projecte disposa d'aquestes opcions, és una alternativa per mantenir
   el disparador del client: cal configurar expressament el cos HTML a cada
   plantilla i verificar que respecta el disseny. No és simplement seleccionar
   un fitxer local a la consola, ni implica que l'editor estàndard ofereixi
   totes les opcions de l'API d'Identity Platform.

### Via A: millorar el flux Firebase actual, sense backend nou

1. Confirma el projecte de producció i el nom públic `troBar`.
2. Revisa Authentication → Templates → Password reset: nom del remitent,
   adreça, Reply-To monitoritzat, assumpte en català i missatge permès
   per l'editor, mantenint `%LINK%`. No enganxis aquest mòdul JavaScript
   a la consola. No assumeixis que tota la composició HTML hi funcionarà.
3. Verifica un domini que controleu amb el procediment oficial anterior.
   Si ja té SPF, combina els remitents en **un únic** registre SPF;
   no substitueixis els serveis existents.
4. Si el projecte ofereix SMTP personalitzat, verifica requisits de producte,
   credencials, TLS, límits i autenticació del domini amb el proveïdor abans
   d'activar-lo. Conserva una còpia de la configuració anterior.
5. Envia només proves autoritzades, comprova els headers originals i la carpeta
   d'arribada. Cap canvi de frontend garanteix que el missatge deixi de ser spam.

### Via B: activar exactament aquesta plantilla amb enviament propi

Prerequisits: domini controlat i DNS, compte transaccional aprovat amb API o
SMTP TLS, remitent verificat, bústia Reply-To monitoritzada, URL HTTPS pública
del logo i entorn backend de confiança amb Firebase Admin. El logo local de
la previsualització **no funciona en un correu real**: publica l'asset existent
en un URL estable sense autenticació i comprova'n el tipus PNG i accés públic.
No s'ha verificat que la ruta de logo de la web ja estigui publicada.

1. Implementa un endpoint de recuperació separat i revisat: valida entrada,
   limita freqüència/abús per IP i compte, mantén resposta genèrica per no
   revelar si existeix l'usuari, i no permetis From, logo, destinació o dominis
   arbitraris enviats pel client. Planifica cues, reintents limitats i gestió
   de rebots sense generar enviaments duplicats.
2. Al servidor, genera l'URL amb
   `getAuth().generatePasswordResetLink(email, actionCodeSettings)`.
   Configura només continue URLs autoritzats i conserva el handler Firebase
   verificat. No apuntis el handler a la home ni a aquesta previsualització.
   Un [handler propi](https://firebase.google.com/docs/auth/custom-email-handler)
   requereix verificar el codi i confirmar la contrasenya; no està implementat
   aquí. No assumeixis que el domini del continue URL és el de l'enllaç generat.
3. Carrega `emails/passwordReset.cjs`, `emails/template.cjs` i el JSON de marca, i crida
   `renderPasswordResetEmail({ resetUrl, allowedActionOrigins, logoUrl })`.
   `allowedActionOrigins` és una llista fixa de configuració del servidor amb
   els orígens HTTPS reals de l'enllaç generat. No la construeixis a partir
   d'una petició. `displayName` és opcional i s'escapa; el nom no va a headers.
   El mòdul retorna `{ subject, html, text }`, no envia res. Inclou el mòdul
   i la seva dependència de marca al paquet del servidor: avui viuen fora
   de `functions/` i **no** es despleguen amb aquell codebase automàticament.
   Per verificar el correu, genera l'enllaç amb
   `getAuth().generateEmailVerificationLink(email, actionCodeSettings)` i
   crida `renderEmailVerification({ verificationUrl, allowedActionOrigins,
   logoUrl, displayName })`. Els dos fluxos han de passar pel mateix enviador
   i la mateixa base visual abans de retirar els enviadors Firebase actuals.
4. Passa aquestes tres parts a l'SDK del proveïdor com a
   `multipart/alternative` UTF-8. Defineix From, Reply-To i destinatari amb
   l'API estructurada del proveïdor, mai concatenant headers. Conserva les
   claus a Secret Manager o equivalent, mai a Expo, `EXPO_PUBLIC_*` ni Git.
   Desactiva tracking de clics/obertures i escurçadors en correus de seguretat.
   No registris el reset URL, el codi, el cos del correu ni dades personals.
5. Prova lliurament real només amb comptes autoritzats, HTML i text, imatges
   bloquejades, mòbil i Outlook; verifica també caducitat, reutilització i
   errors del codi. El renderitzador valida HTTPS, controls i origen però no
   certifica que un enllaç contingui un codi Firebase vàlid.
6. Només després de validar-ho, canvia el client al nou endpoint i evita
   mantenir dos enviadors actius. Cap d'aquests passos d'activació s'ha fet.

## Reduir el risc de spam

Un logo o HTML atractiu no autentica el remitent i **no garanteix la safata
d'entrada**. El domini, reputació, queixes, volum i filtre del destinatari
continuen sent determinants.

- SPF: autoritza els servidors de l'emissor amb els valors exactes del
  proveïdor. Un únic registre `v=spf1` per domini; comprova límits de consultes.
- DKIM: publica les claus/selectors indicats i comprova que el missatge
  real surt signat. No reutilitzis claus d'exemple.
- DMARC: alinea el domini visible From amb el domini que passa SPF o DKIM;
  comença amb monitoratge i informes controlats, inventaria tots els remitents
  legítims i endureix la política després de revisar-los. No publiquis
  `p=reject` a cegues ni inventis una bústia d'informes.
- Utilitza TLS, identitat i dominis coherents, PTR/rDNS gestionat pel proveïdor,
  contingut transaccional sense promocions, volum prudent i gestió de rebots/
  queixes. No afegeixis aquests correus a llistes de màrqueting.
- A Outlook/Gmail, inspecciona el missatge rebut: `Authentication-Results`
  amb `spf=pass`, `dkim=pass`, `dmarc=pass` i dominis alineats; revisa els logs
  de lliurament i rebots del proveïdor. “Delivered” no significa “Inbox”.
  No comparteixis headers complets sense eliminar destinataris i tokens.

Fonts oficials:

- [Microsoft: autenticació SPF/DKIM/DMARC i filtratge](https://learn.microsoft.com/en-us/defender-office-365/email-authentication-about).
  Microsoft tracta l'autenticació com a senyal, no com una exempció de filtre.
- [Microsoft: configurar SPF](https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure),
  [DKIM](https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure)
  i [DMARC](https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure).
- [Google: requisits de remitents Gmail](https://support.google.com/a/answer/81126?hl=en):
  SPF o DKIM per a tots; SPF, DKIM i DMARC per a grans remitents, TLS,
  DNS correcte i baixa taxa de spam. La baixa amb un clic es requereix
  per màrqueting/subscripcions, no per convertir un reset puntual en promoció.

Abans d'activar: cal decidir **quin domini controleu**, **qui en gestiona
el DNS** i **quin proveïdor enviarà els correus**. No hi ha credencials,
tokens ni dades de captures en aquests fitxers.
