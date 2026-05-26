# 🔍 troBar — Auditoria del projecte

> Tracklist de neteja, inconsistències i millores. Marca cada checkbox a mesura que es completi.
> Última actualització: auditoria inicial.

---

## 1. 📦 Dependències a eliminar (root `package.json`)

Confirmat via `grep` — cap import a tot el codi font:

- [x] `axios ^1.13.5` — substituït per `fetch` natiu
- [x] `crypto-js ^4.2.0` — `expo-crypto` ja s'utilitza en lloc seu
- [x] `ical.js ^2.2.1` — sense ús
- [x] `@react-native-firebase/app ^19.0.0` — el projecte fa servir el SDK JS modular (`firebase` v12)
- [x] `@react-native-firebase/auth ^19.0.0` — idem
- [x] `@react-native-firebase/firestore ^19.0.0` — idem
- [x] `@react-native-community/hooks ^100.1.0` — sense ús
- [x] `@react-native-picker/picker 2.11.4` — sense ús
- [x] `expo-web-browser ~55.0.10` — sense ús
- [x] `expo-auth-session ~55.0.9` — sense ús (Apple/Google ja gestionats per altres SDKs)

**Acció:** ✅ `npm uninstall` executat — 24 paquets eliminats.

---

## 2. 🗑️ Fitxers / carpetes mortes

- [x] `app/src/utils/GoogleMaps.native.tsx` — re-exportació de `react-native-maps` no importada enlloc
- [x] `app/src/services/index.ts` — barrel file no importat enlloc (ningú fa `from '../services'`)
- [x] `dist-android/` — artifact de build (ja a `.gitignore`)
- [x] `functions/lib/` — output compilat de Cloud Functions (ja a `.gitignore`)
- [x] `web-app/.next/` i `web-app/tsconfig.tsbuildinfo` — artifacts de build (ja a `.gitignore`)
- [ ] `app/firestore/migrations/` — verificar si encara és rellevant o ja s'ha aplicat tot
- [x] `android/build/` — output de Gradle (`android/` a `.gitignore`)

---

## 3. 🌐 Compatibilitat web (estat: ✅ COMPLETAT)

- [x] Shim `react-native-maps` (placeholder amb branding Barça)
- [x] Shim `@react-native-google-signin/google-signin`
- [x] Shim `expo-apple-authentication`
- [x] Shim `@react-native-async-storage/async-storage`
- [x] Firebase auth amb `Platform.OS` guard
- [x] `sketchShadow()` retorna `boxShadow` al web i shadow* a natiu
- [x] `MatchCard` import de `Platform` afegit
- [x] CSS `background:` → `backgroundImage:` a `BarDashboardScreen.styles.ts`

---

## 4. ⚙️ Configuració TypeScript (estat: ✅ COMPLETAT)

- [x] `tsconfig.json` (root) — `ignoreDeprecations: "5.0"`
- [x] `app/tsconfig.json` — `ignoreDeprecations: "5.0"`
- [x] `web-app/tsconfig.json` — `ignoreDeprecations: "5.0"`
- [ ] Revisar duplicació entre `tsconfig.json` (root) i `app/tsconfig.json` — possible consolidació
- [ ] Considerar migració `moduleResolution: "node10"` → `"bundler"` (recomanat per TS 5+ amb Metro/Expo)

---

## 5. 🧹 Inconsistències i refactor menors

- [ ] `app/src/services/index.ts` — eliminar (no s'usa) o adoptar pattern barrel a tot arreu
- [ ] `MapScreen.tsx` (~2700 línies) — molt llarg, candidat a partició:
  - Extreure `BarMarker`, `MapControls`, `BarBottomSheet` com a components separats
  - Moure handlers d'esdeveniments a custom hooks (`useBarFilters`, `useMapBounds`)
- [ ] Estils inline repetits amb `Platform.select` a `MapScreen.tsx` (8+ ocurrències) — extreure a `sketchShadow()` o helpers a `theme/`
- [ ] Convenció de noms inconsistent: alguns serveis usen `fetchX` i altres `getX` (ex. `fetchAllMatches` vs `getOwnedBar`) — unificar a `fetchX` per coherència
- [ ] `app/src/screens/ReportBar/` — verificar si la pantalla està connectada al navigator

---

## 6. 🔐 Seguretat

- [ ] `android/app/google-services.json` — confirmar que NO conté secrets sensibles (només identificadors públics)
- [ ] `androidGoogleMapsApiKey` a `app.json` exposada en clar — restringir per package name + SHA-1 al Google Cloud Console
- [ ] Revisar `firestore.rules` — assegurar que no hi ha regles `allow read, write: if true`
- [ ] Cap `.env` ni claus privades commitejades (verificar amb `git log -p`)

---

## 7. 📚 Documentació pendent

- [ ] `README.md` — actualitzar instruccions de dev (`npx expo start --port 8081 --clear`)
- [ ] Documentar el patró de shims web a `app/src/shims/README.md`
- [ ] `docs/stripe-billing-setup.txt` — convertir a `.md` per coherència

---

## 8. 🚀 Millores futures (no bloquejants)

- [ ] Afegir tests (cap test al projecte actualment) — començar amb `services/` (lògica pura)
- [ ] Configurar ESLint + Prettier amb regles compartides
- [ ] CI/CD: GitHub Actions per `tsc --noEmit` + lint a cada PR
- [ ] Migrar `console.log` de debug a un logger configurable (ex. `app/src/utils/logger.ts`)
- [ ] Considerar React Query / TanStack Query per substituir `executeRequest` + estats manuals de loading

---

## 📊 Resum executiu

| Categoria | Total | Fets | Pendents |
|---|---|---|---|
| Dependències a treure | 10 | 0 | 10 |
| Fitxers morts | 7 | 0 | 7 |
| Web compat | 8 | 8 | 0 |
| TS config | 5 | 3 | 2 |
| Refactor | 5 | 0 | 5 |
| Seguretat | 4 | 0 | 4 |
| Docs | 3 | 0 | 3 |
| Millores | 5 | 0 | 5 |

**Prioritat suggerida:** 1 → 2 → 6 → 5 → 4 → 7 → 8
