/** @type {import('next').NextConfig} */

// Carreguem les env vars de Firebase des del .env del projecte arrel
// (compartides amb l'app Expo — EXPO_PUBLIC_FIREBASE_*)
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })
const path = require('path')

const nextConfig = {
  turbopack: {
    // Pugem el root un nivell: necessitem importar app/src/data/legalContent.ts
    // que viu fora del web-app per compartir la dada amb l'app mòbil.
    root: path.resolve(__dirname, '..'),
  },
  // Per a Webpack (build de producció a Vercel sense Turbopack)
  webpack: (config) => {
    config.resolve.alias['@shared'] = path.resolve(__dirname, '..', 'app', 'src', 'data')
    return config
  },
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  // Exposar les claus Firebase al client (NEXT_PUBLIC_*)
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  },
};

module.exports = nextConfig;
