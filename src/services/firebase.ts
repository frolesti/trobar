import firestore from '@react-native-firebase/firestore';
import { Bar } from '../models/Bar';

export const getBars = async (): Promise<Bar[]> => {
  try {
    const barsSnapshot = await firestore().collection('bars').get();
    
    // Si no hi ha dades (primera execució o error de connexió), retornem array buit
    // (O podríem retornar les dummyBars com a fallback)
    if (barsSnapshot.empty) {
      console.log('No matching documents defined on Firestore.');
      return [];
    }

    const bars: Bar[] = [];
    barsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      // Mapegem les dades de Firestore a la nostra interfície Bar
      // Assegurem que l'ID ve del document ID
      bars.push({
        id: doc.id,
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        rating: data.rating,
        isOpen: data.isOpen,
        image: data.image,
        tags: data.tags,
        nextMatch: data.nextMatch,
      });
    });

    return bars;
  } catch (error) {
    console.error('Error fetching bars from Firestore:', error);
    // En cas d'error (ex: no configurat encara), retornem buit per no petar l'app
    return [];
  }
};
