# Trobar 📍🍺

Una aplicació mòbil i web feta amb React Native i Expo per trobar els millors bars on veure partits d'esports (especialment del Barça).

## 🚀 Funcionalitats

- **Mapa Interactiu**: Visualitza bars propers amb un estil personalitzat (tipus esbós/llegible).
- **Filtres**: Cerca per esport o equip.
- **Detalls del Bar**: Informació sobre partits, horaris i rutes a peu.
- **Autenticació**: Registre d'usuaris amb Firebase.

## 🛠️ Requisits Previs

- [Node.js](https://nodejs.org/) (versió LTS recomanada)
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
npm start
```

`npm start` arrenca Expo i també el proxy local d'ICS (CORS) a `http://localhost:8787`.

Si tens algun procés vell ocupant ports (p. ex. Metro a `8081`), `npm start` els intenta tancar automàticament.
Si algun port l'està ocupant una altra cosa “desconeguda”, pots forçar-ho amb:

```bash
# Mata processos node desconeguts en aquests ports
$env:TROBAR_DEV_FORCE=1; npm start

# (perillós) Mata qualsevol procés en aquests ports
$env:TROBAR_DEV_KILL_ALL=1; npm start
```

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
