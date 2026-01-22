import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Bar } from '../data/dummyData';
import { executeRequest } from '../api/core';

// Mapegem les dades de Firestore a la nostra interfície 'Bar'
const mapDocToBar = (doc: any): Bar => {
    const data = doc.data();
    
    // Intentem obtenir lat/lng de diferents formats possibles (GeoPoint o camps solts)
    let lat = 41.3874;
    let lng = 2.1686;

    if (data.location && data.location.latitude) {
        lat = data.location.latitude;
        lng = data.location.longitude;
    } else if (data.latitude && data.longitude) {
        lat = data.latitude;
        lng = data.longitude;
    }

    return {
        id: doc.id,
        name: data.name || doc.id, // Si no té nom, usem l'ID (ex: 'bar-mut')
        address: data.address || '',
        latitude: lat,
        longitude: lng,
        rating: data.rating || 4.0,
        isOpen: data.isOpen ?? true,
        image: (data.image && data.image.startsWith('http')) ? data.image : undefined, 
        tags: data.amenities || [], // Mapegem 'amenities' a 'tags'
        // Camps opcionals que potser no estan a totes les entrades
        nextMatch: data.nextMatch || undefined
    };
};

export const fetchBars = async (): Promise<Bar[]> => {
    // Utilitzem el nou wrapper 'executeRequest' per estandaritzar la crida
    const result = await executeRequest(async () => {
        const q = query(collection(db, 'bars'), where('nextMatch', '!=', null));
        const querySnapshot = await getDocs(q);
        
        const bars: Bar[] = [];
        const seenNames = new Set<string>();
        
        querySnapshot.forEach((doc) => {
            const bar = mapDocToBar(doc);
            if (!seenNames.has(bar.name)) {
                seenNames.add(bar.name);
                bars.push(bar);
            }
        });
        return bars;
    }, 'fetchBars');

    // Si falla, retornem array buit (behavior per defecte en aquest servei)
    return result.success && result.data ? result.data : [];
};

export const fetchBarById = async (id: string): Promise<Bar | null> => {
    const result = await executeRequest(async () => {
        const docRef = doc(db, 'bars', id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? mapDocToBar(docSnap) : null;
    }, `fetchBarById:${id}`);

    return result.data;
};
