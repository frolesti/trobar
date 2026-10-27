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

## 🚀 Funcionalitats

- **Mapa Interactiu**: Visualitza bars propers amb un estil personalitzat (tipus esbós/llegible).
- **Filtres**: Cerca per esport o equip.
- **Detalls del Bar**: Informació sobre partits, horaris i rutes a peu.
- **Autenticació**: Registre d'usuaris amb Firebase.

Al mapa, mantén premuda la targeta del partit un quart de segon i arrossega-la
horitzontalment per passar-la al darrere i mostrar l'altra categoria. Un toc curt
continua activant o desactivant el filtre; un arrossegament curt torna al lloc.
Els pins dels bars es redueixen en allunyar el mapa. Les fitxes dels bars tenen
fons grana i les premium conserven la vora daurada.
El perfil agrupa els enllaços legals en un peu compacte; els crèdits d'icones
es poden consultar a l'apartat «Crèdits» dels termes del servei.

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

Per iniciar el projecte en mode desenvolupament:

```bash
npx expo start --clear
```

El port `8081` queda reservat a Expo: `npx expo start --clear` atura el procés que l'ocupi,
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

### Provar a l'iPhone amb Expo Go (Windows)

El projecte utilitza Expo SDK 58, React Native 0.88 i React 19.3. Cal una versió
d'Expo Go compatible amb SDK 58. Després d'actualitzar dependències, comprova-les
amb `npx expo install --check` i arrenca Metro amb `--clear`.

Les builds natives pròpies de SDK 57 s'han de regenerar i recompilar per a SDK 58;
actualitzar Metro no les actualitza. Conserva les personalitzacions natives en
regenerar-les. No publiquis una OTA de SDK 58 amb el mateix `runtimeVersion` de
les builds de SDK 57: la política actual `appVersion` requereix una versió d'app
diferent abans de publicar aquesta OTA.

Fes servir una finestra PowerShell normal, situada a l'arrel del repositori:

```powershell
cd C:\Users\USER\Repos\trobar
.\scripts\startIphone.ps1
```

Aquest script allibera els ports d’Expo, utilitza una caché de Metro dins del projecte i anuncia automàticament la IP LAN activa del PC. Deixa el terminal obert i escaneja el QR que hi apareix amb Expo Go o amb la càmera de l’iPhone.

La URL esperada té aquest format:

```text
exp://<IP-LAN-DEL-PC>:8081
```

Per iniciar explícitament Expo Go a l'iPhone (el repo també té `expo-dev-client`, que altrament fa que Expo seleccioni el development build):

```powershell
npx expo start --go --clear
```

Amb Expo Go, email/password i Sign in with Apple fan servir els mòduls inclosos a Expo Go. Google fa servir `expo-auth-session` amb el redirect proxy d'Expo, ja que `@react-native-google-signin/google-signin` necessita codi natiu i no és present a Expo Go. El proxy d'Expo és deprecated i pot fallar en navegadors que bloquegen cookies. El client OAuth web existent ha d'autoritzar `https://auth.expo.io/@frolesti/trobar-ios` com a redirect URI. El login Google natiu continua disponible en builds que inclouen `RNGoogleSignin`. EAS no és necessari per iniciar Expo Go; `npx expo start --clear` només neteja Metro. El login amb Google al web continua fent servir Firebase Popup.

L'iPhone i el PC han d'estar a la mateixa Wi-Fi. Si Expo Go mostra “There was a problem running the requested project”, comprova primer la connectivitat des del PC:

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
- **Escanejar QR** : Utilitza l'app **Expo Go** al teu mòbil (Android/iOS).
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
