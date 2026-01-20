import { doc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const seedDatabase = async () => {
    // console.log("Iniciant sembra de dades Estesa...");
    try {
        const batch = writeBatch(db);
        
        // 1. Definim una llista extensa de partits per testejar filtres
        const matches = [
            // BARÇA MATCHES (per test el filtre 'FC Barcelona')
            { teamHome: 'FC Barcelona', teamAway: 'Real Madrid', competition: 'La Liga', time: '21:00' },
            { teamHome: 'Napoli', teamAway: 'FC Barcelona', competition: 'Champions League', time: '21:00' },
            { teamHome: 'FC Barcelona', teamAway: 'Valencia CF', competition: 'La Liga', time: '16:15' },
            { teamHome: 'Athletic Club', teamAway: 'FC Barcelona', competition: 'Copa del Rey', time: '21:30' },
            
            // ALTRES EQUIPS (per verificar que s'amaguen amb el filtre)
            { teamHome: 'RCD Espanyol', teamAway: 'Girona FC', competition: 'La Liga', time: '18:00' },
            { teamHome: 'Girona FC', teamAway: 'Real Betis', competition: 'La Liga', time: '16:00' },
            { teamHome: 'Atletico Madrid', teamAway: 'Sevilla', competition: 'La Liga', time: '21:00' },
            { teamHome: 'Manchester City', teamAway: 'Liverpool', competition: 'Premier League', time: '17:30' },
            { teamHome: 'PSG', teamAway: 'Marseille', competition: 'Ligue 1', time: '20:45' },
            { teamHome: 'Bayern Munich', teamAway: 'Dortmund', competition: 'Bundesliga', time: '18:30' },
            { teamHome: 'Arsenal', teamAway: 'Tottenham', competition: 'Premier League', time: '15:00' },
            { teamHome: 'Inter', teamAway: 'AC Milan', competition: 'Serie A', time: '20:45' }
        ];

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

            const match = matches[i % matches.length];
            const name = barNames[i % barNames.length] + " " + (i+1);

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
                nextMatch: match
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
