const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Check if app is already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function removeDuplicates() {
  console.log('🔍 Buscant duplicats a la col·lecció "bars"...');
  const snapshot = await db.collection('bars').get();
  
  const seenNames = new Set();
  const batch = db.batch();
  let deleteCount = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const name = data.name;

    if (seenNames.has(name)) {
      // It's a duplicate
      console.log(`🗑️  Marcant per eliminar duplicat: "${name}" (ID: ${doc.id})`);
      batch.delete(doc.ref);
      deleteCount++;
    } else {
      seenNames.add(name);
    }
  });

  if (deleteCount > 0) {
    await batch.commit();
    console.log(`✅ ${deleteCount} duplicats eliminats correctament.`);
  } else {
    console.log('👍 No s\'han trobat duplicats. La base de dades està neta.');
  }
}

removeDuplicates().catch(console.error);
