import { collection, getDocs, doc, getDoc, query, where, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Bar } from '../models/Bar';
import { OSMBar } from './osmService';
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

export const addUserReportedBar = async (osmBar: OSMBar, userId: string): Promise<void> => {
    // @ts-ignore
    return await executeRequest(async () => {
        const barRef = doc(db, 'bars', osmBar.id); // Use OSM ID as Document ID
        await setDoc(barRef, {
            name: osmBar.name,
            location: { latitude: osmBar.lat, longitude: osmBar.lon }, // Store as map for consistency with mapDocToBar
            address: '', // OSM doesn't always give address
            amenities: [osmBar.type],
            source: 'user_reported',
            reportedBy: userId,
            createdAt: serverTimestamp(),
            isActive: false, // "estat desactivat" - Needs admin/owner confirmation to become full verified
            isOpen: true,
            rating: 0 // No rating yet
        }, { merge: true });
    }, 'addUserReportedBar').then(res => {
        if (!res.success) throw res.error;
    });
};
