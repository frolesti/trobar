const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicialitzar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Dades dels bars (Còpia de src/data/dummyData.ts)
const barsData = [
  {
    name: "Bar Sport 'El Camp Nou'",
    latitude: 41.380896,
    longitude: 2.122820,
    address: 'Carrer de Aristides Maillol, 12, Barcelona',
    rating: 4.5,
    isOpen: true,
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1000&auto=format&fit=crop',
    tags: ['Terrassa', 'Projector', 'Wifi'],
    filterInfo: { // Camps auxiliars per filtres fàcils
        hasTerrace: true,
        hasProjector: true,
        isOpenNow: true
    }
  },
  {
    name: "La Cerveseria del Barri",
    latitude: 41.382500,
    longitude: 2.125000,
    address: 'Av. Diagonal, 600, Barcelona',
    rating: 4.2,
    isOpen: false,
    image: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=1000&auto=format&fit=crop',
    tags: ['Cervesa Artesana', 'Futbolí'],
    filterInfo: {
        hasTerrace: false,
        hasProjector: false,
        isOpenNow: false
    }
  },
  {
    name: "The Irish Rover",
    latitude: 41.385000,
    longitude: 2.120000,
    address: 'Carrer de Sants, 100, Barcelona',
    rating: 4.8,
    isOpen: true,
    image: 'https://images.unsplash.com/photo-1575444758702-4a6b9222336e?q=80&w=1000&auto=format&fit=crop',
    tags: ['TV Gegant', 'Guinness', 'Obert ara'],
    filterInfo: {
        hasTerrace: false,
        hasProjector: true,
        isOpenNow: true
    }
  }
];

async function seedDatabase() {
  const collectionRef = db.collection('bars');

  console.log('🗑️  Esborrant col·lecció "bars" existent...');
  // Opcional: Esborrar tot abans de re-popular (per evitar duplicats en desenvolupament)
  const snapshot = await collectionRef.get();
  const batchDisplay = admin.firestore().batch();
  snapshot.docs.forEach((doc) => {
    batchDisplay.delete(doc.ref);
  });
  await batchDisplay.commit();

  console.log('🌱 Inserint nous documents...');
  
  const batch = admin.firestore().batch();

  barsData.forEach((bar) => {
    const docRef = collectionRef.doc(); // Generar ID automàtic
    batch.set(docRef, bar);
  });

  await batch.commit();
  console.log(`✅ Base de dades poblada correctament amb ${barsData.length} bars!`);
}

seedDatabase().catch(console.error);
