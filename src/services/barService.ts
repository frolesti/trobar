import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Bar } from '../data/dummyData';

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
        image: data.image || data.imageUrl || 'https://via.placeholder.com/150',
        tags: data.amenities || [], // Mapegem 'amenities' a 'tags'
        // Camps opcionals que potser no estan a totes les entrades
        nextMatch: data.nextMatch || undefined
    };
};

export const fetchBars = async (): Promise<Bar[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, 'bars'));
        const bars: Bar[] = [];
        const seenNames = new Set<string>();
        
        querySnapshot.forEach((doc) => {
            const bar = mapDocToBar(doc);
            
            // Deduplicate by name to prevent multiple markers for the same place
            // AND Filter: Only show bars that have a match scheduled
            if (!seenNames.has(bar.name) && bar.nextMatch) {
                seenNames.add(bar.name);
                bars.push(bar);
            }
        });
        return bars;
    } catch (error) {
        console.error("Error fetching bars:", error);
        return [];
    }
};

export const fetchBarById = async (id: string): Promise<Bar | null> => {
    try {
        const docRef = doc(db, 'bars', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return mapDocToBar(docSnap);
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching bar:", error);
        return null;
    }
};
