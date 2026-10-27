# Fotos de perfil: Firebase Storage

## Estat verificat el 26/10/2026

Les regles publicades s'han comprovat de nou amb una consulta de lectura:
coincideixen amb [storage.rules](../../firebase/storage/storage.rules). Els avatars només es
poden modificar amb la sessió del seu propietari, fins a 5 MB i amb tipus
`image/*`. Les carpetes `competition-logos`, `competitions`, `team-badges`
i `teams` tenen lectura pública, però cap escriptura des del client.

La regla anterior que provocava el bloqueig era:

```text
allow read, write: if request.time < timestamp.date(2026, 2, 21);
```

La regla caducada ja no està publicada. L'actualització l'ha fet el titular
del projecte a Firebase Console; la verificació posterior no ha desplegat
ni modificat cap regla remota. La pujada autenticada des de l'iPhone encara
s'ha de comprovar amb el dispositiu.

No cal reinstal·lar Firebase ni Expo. El client d'iOS ja puja el fitxer amb
`expo-file-system/legacy`, sense passar per la conversió a Blob que fallava
a React Native. Canviar aquesta via no resol unes regles caducades.

## Guia pas a pas a Firebase Console

1. Obre [Firebase Console](https://console.firebase.google.com/) i selecciona
   **trobar-1123f**. No canviïs el projecte ni la configuració de l'app.
2. Entra a **Build > Storage** i comprova que el bucket seleccionat sigui
   **trobar-1123f.firebasestorage.app**. Si la consola demana inicialitzar
   Storage o habilitar un pla, revisa aquest requisit amb el titular del
   projecte; no obris els permisos per intentar evitar-lo.
3. Obre **Rules**, no les regles de Firestore. Les regles ja estan publicades:
   no cal tornar-les a publicar per provar una foto. No introdueixis una
   autorització global amb `true` ni tornis a posar una data de caducitat.
4. Revisa les regles d'avatars de [storage.rules](../../firebase/storage/storage.rules). El bloc
   que ha de quedar dins de `match /b/{bucket}/o` és:

   ```text
   match /avatars/{userId} {
     allow read: if request.auth != null;
     allow create, update: if request.auth != null
       && request.auth.uid == userId
       && request.resource.size > 0
       && request.resource.size <= 5 * 1024 * 1024
       && request.resource.contentType.matches('image/.*');
     allow delete: if request.auth != null && request.auth.uid == userId;
   }
   ```

   L'objecte s'anomena `avatars/{uid}`, sense nom de fitxer addicional.
   Conserva `rules_version = '2';`, `service firebase.storage` i el bloc del
   bucket. Si hi ha altres rutes amb permisos vàlids, conserva-les: el
   fitxer local defineix avatars i la lectura dels escuts i logos, però no
   autoritza altres pujades, com les fotos dels bars.
   Retira l'autorització global caducada, no la converteixis en una regla
   global permissiva.
5. Si has fet una modificació intencionada, prem **Publish** i espera que
   la consola confirmi la publicació. Per a la prova actual no cal fer-ho. Cal
   tenir permisos d'administració de regles al projecte; si no els tens,
   demana aquesta publicació a qui l'administra.
6. A l'iPhone, tanca la sessió de l'app i torna-la a obrir. Entra a **Perfil**,
   prem la càmera i selecciona una imatge de menys de **5 MB**. No cal
   reinstal·lar Expo Go per canviar les regles.
7. La foto seleccionada ha de substituir l'anterior sense mostrar l'error.
   A **Storage > Files > avatars**, comprova que hi hagi l'objecte del teu
   UID. A Firestore, `users/{uid}.avatar` ha de contenir la URL retornada.
   No publiquis ni comparteixis tokens de sessió o URLs privades de prova.
8. Tanca i torna a obrir l'app: la foto pròpia ha de continuar apareixent.
   Si encara reps `storage/unauthorized`, comprova que el UID de l'objecte
   sigui el de la sessió actual, que les regles siguin les publicades del
   bucket correcte i que el fitxer tingui un tipus `image/*`.

## Foto de Google i Apple

- La foto pròpia desada a Firestore té prioritat i no se sobreescriu en
  tornar a entrar amb Google.
- Sense foto pròpia, s'utilitza la foto de Firebase Auth o la del proveïdor
  Google vinculat al compte. Si Google no retorna cap foto, es manté
  l'avatar genèric. No cal pujar aquesta foto externa a Storage.
- Sign in with Apple no retorna una foto de perfil. No es pot recuperar
  automàticament l'avatar de l'Apple ID amb aquest inici de sessió; l'usuari
  pot seleccionar una foto pròpia amb el mateix botó de càmera.
- El nom i els cognoms es desen automàticament després d'una pausa curta
   d'escriptura, en deixar el camp i abans de sortir del perfil. Si falla
   el desament, els camps es conserven i es pot reintentar. No hi ha botó
   de desament manual. La foto es puja en seleccionar-la.

## Detalls del client

El client puja la imatge a `avatars/{uid}` i desa la URL retornada a
`users/{uid}.avatar` a Firestore. El projecte de desenvolupament es
`trobar-1123f` i el bucket configurat es
`trobar-1123f.firebasestorage.app`.

## Comprovar una fallada

1. Inicia sessio i selecciona una imatge de menys de 5 MB al perfil.
2. Revisa el missatge de pantalla i el log `[API FAIL] uploadProfileImage`.
3. Si apareix `storage/unauthorized`, comprova les regles publicades a
   Firebase Console > Storage > Rules. Les regles de Firestore no donen
   permisos a Storage.
4. Si apareix `storage/bucket-not-found`, comprova que Storage estigui
   inicialitzat i que el nom del bucket coincideixi amb la configuracio.
5. Si apareix `storage/quota-exceeded`, revisa la quota i la facturacio del
   projecte. Obrir les regles no resol una quota superada.

## Alternativa amb CLI

`storage.rules` permet als usuaris autenticats llegir avatars i nomes al
propietari pujar, substituir o eliminar el seu avatar. Accepta imatges
de fins a 5 MB. Els escuts i logos de les quatre carpetes indicades tenen
lectura pública; les altres rutes queden denegades per defecte.

Si prefereixes CLI, revisa abans el fitxer local i conserva els permisos
necessaris per a altres carpetes. Aquesta ordre substitueix les regles de
Storage del projecte pel fitxer configurat a `firebase.json`; no la facis
servir si has corregit només la consola i el fitxer local encara no reflecteix
totes les rutes necessàries.

Quan les regles s'hagin revisat, desplega nomes Storage des de l'arrel:

```powershell
firebase deploy --only storage --project trobar-1123f
```

## Prova de funcionament

- La pujada amb el mateix usuari ha de finalitzar i conservar la foto
  despres de recarregar el perfil.
- Un altre usuari no ha de poder escriure a `avatars/{uid}` d'aquest perfil.
- Un fitxer que no sigui una imatge o superi 5 MB ha de ser rebutjat.

Una consulta anonima amb HTTP 403 no demostra que les pujades
autenticades fallin. Cal el resultat d'un intent amb sessio iniciada.