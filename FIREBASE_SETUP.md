# Guia de Configuració de Firebase per a Trobar

Segueix aquests passos per configurar el backend de Firebase, habilitar la base de dades i connectar-la amb l'aplicació.

## 1. Crear el Projecte a Firebase Console
1. Ves a [console.firebase.google.com](https://console.firebase.google.com/).
2. Clica a **"Add project"**.
3. Posa-li de nom: `Trobar`.
4. Pots desactivar Google Analytics per a aquest MVP.
5. Clica **"Create Project"**.

## 2. Configurar Apps (Android & iOS)
Necessitem registrar l'app per obtenir els fitxers de configuració.

### Per a Android:
1. Al panell esquerre, clica la roda dentada (Project Settings).
2. A "Your apps", clica la icona d'**Android**.
3. **Android package name**: `com.example.trobar` (o el que tinguis a `app.json`).
4. Clica **Register app**.
5. Descarrega el fitxer `google-services.json`.
6. **Important:** Mou aquest fitxer a l'arrel del teu projecte `trobar/google-services.json`.

### Per a iOS:
1. Afegeix una nova app (icona "+") i selecciona **iOS**.
2. **iOS bundle ID**: `com.example.trobar`.
3. Clica **Register app**.
4. Descarrega `GoogleService-Info.plist`.
5. **Important:** Mou aquest fitxer a l'arrel de `trobar/GoogleService-Info.plist`.

## 3. Habilitar Firestore Database
1. Al menú esquerre, ves a **Build > Firestore Database**.
2. Clica **Create database**.
3. Selecciona una ubicació propera (ex: `eur3` - Europe West).
4. Tria **Start in test mode** (per facilitar el desenvolupament ara mateix).
5. Clica **Create**.

## 4. Obtindre Credencials d'Administrador (per al script de dades)
Per poder omplir la base de dades automàticament amb el script, necessitem una clau privada.

1. A Firebase Console, ves a **Project Settings > Service accounts**.
2. Assegura't que "Firebase Admin SDK" està seleccionat.
3. Clica **Generate new private key**.
4. Es descarregarà un fitxer `.json`.
5. Canvia-li el nom a `serviceAccountKey.json` i posa'l a la carpeta `scripts/` del projecte.
6. **ATENCIÓ:** Aquest fitxer conté claus secretes. Mai el pugis a GitHub (afegeix-lo al `.gitignore`).

## 5. Popular la Base de Dades
Un cop tinguis el fitxer `serviceAccountKey.json` a la carpeta `scripts/`:

1.  Obre un terminal a l'arrel del projecte.
2.  Executa el script de preparació (instal·larà firebase-admin temporalment):
    ```bash
    cd scripts
    npm install firebase-admin
    node seedFirestore.js
    ```
3.  Si tot va bé, veuràs "Base de dades poblada correctament!".

## 6. Configurar el Prebuild (Expo)
Com que fem servir llibreries natives (`@react-native-firebase`), no podem utilitzar "Expo Go" normal per executar l'app final, necessitem generar un "Development Build" o fer prebuild.

Però per ara, si només vols provar l'estructura, assegura't que tens els fitxers `.json` i `.plist` a lloc i executa:
```bash
npx expo prebuild
```
Això generarà les carpetes `android` i `ios` amb la configuració de Firebase injectada.
