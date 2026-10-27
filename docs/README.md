# Documentacio del projecte

Totes les ordres de les guies s'executen des de l'arrel del repositori,
excepte quan s'indica expressament un altre directori.

## Guies tecniques

- [Sincronitzacio de partits](guides/MATCH_SYNC.md): fonts, desplegament
  independent, recuperacio de fases i proves.
- [Notificacions](guides/NOTIFICATIONS.md): contractes, permisos i requisits
  pendents abans d'activar el backend.
- [Fotos de perfil i Storage](guides/PROFILE_PHOTO_STORAGE.md): regles,
  verificacio a Firebase Console i proves al dispositiu.
- [Facturacio amb Stripe](guides/stripe-billing-setup.txt): configuracio i
  flux de subscripcions.

## Revisions i planificacio

- [Auditoria i historial de revisions](reviews/AUDIT.md). Les dates i els
  recomptes son historics; no substitueixen una execucio actual de les proves.
- `planning/`: material de planificacio i candidatures; s'hi conserva la
  carpeta local de la candidatura Impulsa Startup 2026.
- `local/`: apunts personals ignorats per Git, inclosa la guia local de
  l'emulador si existeix en aquesta maquina. No hi posis documentacio comuna.

## On posar cada cosa

| Tipus | Ubicacio |
| --- | --- |
| Guia compartida | `docs/guides/` |
| Revisio o auditoria | `docs/reviews/` |
| Planificacio del projecte | `docs/planning/` |
| Regles, indexs, esquema i migracions | [firebase/](../firebase/) |
| Proves de l'app i les eines | [tests/](../tests/) |
| Proves de Cloud Functions | [functions/test/](../functions/test/) |
| Eines executables de manteniment | [scripts/](../scripts/) |
| Exports, logs, captures i diagnostics locals | `.local/`, ignorat per Git |

Els secrets i fitxers d'entorn continuen en els llocs que esperen les eines.
No els moguis a documentacio, no els copiïs als exports i no els versionis.

## Firebase

- [Regles Firestore](../firebase/firestore/firestore.rules)
- [Indexs Firestore](../firebase/firestore/firestore.indexes.json)
- [Esquema de dades](../firebase/firestore/schema.json)
- [Migracions](../firebase/firestore/migrations/)
- [Regles Storage](../firebase/storage/storage.rules)
- [Configuracio CLI](../firebase.json)

Les rutes de `firebase.json` son relatives a l'arrel. El trasllat no canvia
el contingut dels permisos ni desplega res. Les migracions i els seeds nomes
s'executen explicitament; iniciar Expo no ha de modificar dades remotes.
