import { doc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { fetchAllMatches } from '../services/matchService';

export const seedDatabase = async () => {
    // console.log("Iniciant sembra de dades Estesa...");
    try {
        const batch = writeBatch(db);

        // 1. Carregar partits reals des d'una font online (sense fixtures hardcodejats)
        let remoteNextMatches: Array<{ teamHome: string; teamAway: string; competition: string; time: string }> = [];
        try {
            const { matches } = await fetchAllMatches();
            remoteNextMatches = matches
                .filter(m => m?.teamHome && m?.teamAway && m?.competition && m?.date)
                .slice(0, 200)
                .map(m => ({
                    teamHome: m.teamHome,
                    teamAway: m.teamAway,
                    competition: m.competition,
                    time: m.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }));
        } catch (e) {
            // If offline or fetch fails, we seed bars without nextMatch.
            remoteNextMatches = [];
        }

        // 2. Noms de bars aleatoris
        const barNames = [
            "Bar Sport", "La Cerveseria", "The Irish Pub", "Taverna del Barri", 
            "Champions Corner", "Penya Barcelonista", "El Racó del Futbol", 
            "Sports Bar 123", "Gol Nord", "Tercer Temps", "La Pròrroga",
            "Bar L'Estadi", "Casa Pepe", "Frankfurt Pedralbes", "Michael Collins",
            "George Payne", "Snooker", "Bar Velòdrom", "Ovella Negra", "Garage Beer"
        ];

        // 3. Generar 20 bars distribuïts per Barcelona
        for (let i = 0; i < 20; i++) {
            const barId = `bar-gen-${i}`;
            const barRef = doc(db, 'bars', barId);
            
            // Coordinate Base (Barcelona Eixample/Centre)
            const baseLat = 41.3874;
            const baseLng = 2.1686;
            
            // Random offset (approx 3-4km radius)
            // 0.01 graus ~ 1.1km
            const latOffset = (Math.random() - 0.5) * 0.06; 
            const lngOffset = (Math.random() - 0.5) * 0.06;

            const match = remoteNextMatches.length > 0
                ? remoteNextMatches[Math.floor(Math.random() * remoteNextMatches.length)]
                : undefined;
            // Fix: Clean name without random number suffix for better Google Maps integration
            const name = barNames[i % barNames.length]; 

            const barData = {
                id: barId,
                name: name,
                address: `Carrer de l'Esport, ${i+1}, Barcelona`,
                latitude: baseLat + latOffset,
                longitude: baseLng + lngOffset,
                rating: Number((3.5 + Math.random() * 1.5).toFixed(1)),
                isOpen: true,
                image: `https://source.unsplash.com/random/800x600/?bar,pub,${i}`,
                tags: ['Tv', 'Terrassa', 'Tapes'],
                ...(match ? { nextMatch: match } : {})
            };
            
            batch.set(barRef, barData);
        }

        await batch.commit();
        // console.log("SEMBRA DE DADES COMPLETADA: 20 bars amb partits variats.");
        return true;
    } catch (e) {
        // console.error("Error seeding database:", e);
        return false;
    }
}
