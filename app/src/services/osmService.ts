import { OSMBar } from '../models/OSMBar';
import { BarAmenity } from '../models/Bar';

export type { OSMBar };

/**
 * Mapeja tags d'OpenStreetMap a les amenitats de l'app.
 * OSM té tags estàndard ben documentats: https://wiki.openstreetmap.org/wiki/Map_Features
 * Això és GRATUÏT — aprofitem-ho al màxim.
 */
export const mapOSMTagsToAmenities = (tags: Record<string, string>): BarAmenity[] => {
    const amenities: BarAmenity[] = [];

    // Terrassa / seient exterior
    if (tags.outdoor_seating === 'yes' || tags['outdoor_seating:covered'] === 'yes' || tags.beer_garden === 'yes') {
        amenities.push('outdoor_seating');
    }

    // Accessibilitat
    if (tags.wheelchair === 'yes' || tags.wheelchair === 'limited') {
        amenities.push('accessible');
    }

    // Menjar
    if (tags.food === 'yes' || tags.cuisine || tags.diet) {
        amenities.push('food_served');
    }

    // WiFi
    if (tags.internet_access === 'wlan' || tags.internet_access === 'yes' || tags['internet_access:fee'] === 'no') {
        amenities.push('wifi');
    }

    // Aire condicionat
    if (tags.air_conditioning === 'yes') {
        amenities.push('air_conditioning');
    }

    // Reserves
    if (tags.reservation === 'yes' || tags.reservation === 'recommended' || tags.reservation === 'required') {
        amenities.push('reservations');
    }

    // Aparcament
    if (tags.parking && tags.parking !== 'no') {
        amenities.push('parking');
    }

    // Mascotes
    if (tags.dog === 'yes' || tags.pets === 'yes') {
        amenities.push('pet_friendly');
    }

    // Esports (televisió, projector)
    if (tags.sport === 'yes' || tags['sport:tv'] === 'yes' || tags.amenity === 'pub') {
        // Els pubs a OSM sovint tenen TV esportiva — no és segur, però és una bona heurística
        amenities.push('sports_bar');
    }

    return amenities;
};

const OVERPASS_SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://interpreter.lazus.de/'
];

// Auxiliar de debounce per evitar saturar l'API pública
let lastController: AbortController | null = null;

/** Timeout per a cada request individual a un servidor Overpass (ms) */
const PER_REQUEST_TIMEOUT = 10_000;

/** Pausa curta entre servidors per reduir 429s */
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Sistema de cache: emmagatzema resultats per cel·la de graella (aprox 1 km)
const cache: Record<string, { timestamp: number, data: OSMBar[] }> = {};
const CACHE_TTL = 1000 * 60 * 60; // 1 hora

const getGridCell = (lat: number, lon: number, radius: number) => {
    // Arrodonir lat/lon a ~100 m de precisió (3 decimals) per agrupar cerques properes
    // Incloure radi per diferenciar l'abast.
    return `${lat.toFixed(3)},${lon.toFixed(3)},r:${radius.toFixed(1)}`;
};

/** Distància Haversine en metres entre dos punts */
const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Elimina duplicats OSM (node+way del mateix bar) per proximitat + nom */
const deduplicateByProximity = (bars: OSMBar[]): OSMBar[] => {
    const PROXIMITY_METERS = 40;
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9àáèéíïòóúüçñ]/g, '');
    const result: OSMBar[] = [];
    for (const bar of bars) {
        const isDup = result.some(existing =>
            haversineMeters(existing.lat, existing.lon, bar.lat, bar.lon) < PROXIMITY_METERS &&
            normalize(existing.name) === normalize(bar.name)
        );
        if (!isDup) result.push(bar);
    }
    return result;
};

export const fetchBarsFromOSM = async (lat: number, lon: number, radiusKm: number): Promise<OSMBar[]> => {
    // Comprovar cache primer amb clau més estricta
    const gridKey = getGridCell(lat, lon, radiusKm);
    const cached = cache[gridKey];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        // console.log('[OSM] Returned from cache:', gridKey);
        return cached.data;
    }

    // Ara usem estrictament el radi de l'usuari, fins a un límit raonable de 5 km.
    const queryRadiusMeters = Math.min(radiusKm * 1000, 5000); 

    if (lastController) {
        lastController.abort();
    }
    lastController = new AbortController();
    const signal = lastController.signal;

    // Consulta Overpass QL
    // Busquem nodes i ways (edificis) amb amenity = bar/pub/restaurant/cafe
    // Timeout augmentat a 25 s per a millor fiabilitat
    const query = `
        [out:json][timeout:25];
        (
          node["amenity"~"bar|pub"](around:${queryRadiusMeters},${lat},${lon});
          way["amenity"~"bar|pub"](around:${queryRadiusMeters},${lat},${lon});
        );
        out center;
    `;

    for (let i = 0; i < OVERPASS_SERVERS.length; i++) {
        const server = OVERPASS_SERVERS[i];
        try {
            if (signal.aborted) return [];

            // Timeout individual per evitar que un servidor lent congeli l'app
            const timeoutId = setTimeout(() => lastController?.abort(), PER_REQUEST_TIMEOUT);
            const response = await fetch(server, {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
                signal: signal
            });
            clearTimeout(timeoutId);

            if (response.status === 429 || response.status === 504 || !response.ok) {
                console.warn(`[OSM] Server ${server} failed with ${response.status}. Trying next...`);
                if (i < OVERPASS_SERVERS.length - 1) await delay(500);
                continue;
            }

            const data = await response.json();
            const elements = data.elements || [];

            const bars: OSMBar[] = elements
                .filter((el: any) => {
                    return el.tags && (el.tags.name || el.tags['name:ca'] || el.tags['name:es']);
                })
                .map((el: any) => {
                    const osmTags = el.tags || {};
                    return {
                        id: `osm_${el.id}`,
                        name: osmTags.name || osmTags['name:ca'] || osmTags['name:es'] || 'Bar sense nom',
                        lat: el.lat || el.center?.lat,
                        lon: el.lon || el.center?.lon,
                        type: osmTags.amenity,
                        tags: osmTags,
                        amenities: mapOSMTagsToAmenities(osmTags),
                    };
                });

            // Deduplicar per proximitat: node+way del mateix bar = duplicat
            // Si dos punts estan a < 40 m i tenen el mateix nom normalitzat, eliminem el segon
            const dedupedBars = deduplicateByProximity(bars);
            
            // Emmagatzemar a la cache
            cache[gridKey] = { timestamp: Date.now(), data: dedupedBars };
            return dedupedBars;

        } catch (error: any) {
            if (error.name === 'AbortError') return []; // L'usuari ha cancel·lat o timeout
            console.warn(`[OSM] Error fetching from ${server}:`, error);
            if (i < OVERPASS_SERVERS.length - 1) await delay(500);
        }
    }

    console.error('[OSM] All servers failed.');
    return [];
};

/**
 * Cerca bars per bounding box (visible bounds del mapa).
 * Overpass utilitza la sintaxi (south, west, north, east).
 */
export const fetchBarsFromOSMBounds = async (
    south: number, west: number, north: number, east: number
): Promise<OSMBar[]> => {
    // Clau de cache basada en els bounds arrodonits a 3 decimals
    const gridKey = `bb:${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
    const cached = cache[gridKey];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    if (lastController) {
        lastController.abort();
    }
    lastController = new AbortController();
    const signal = lastController.signal;

    const query = `
        [out:json][timeout:25];
        (
          node["amenity"~"bar|pub"](${south},${west},${north},${east});
          way["amenity"~"bar|pub"](${south},${west},${north},${east});
        );
        out center;
    `;

    for (let i = 0; i < OVERPASS_SERVERS.length; i++) {
        const server = OVERPASS_SERVERS[i];
        try {
            if (signal.aborted) return [];

            const timeoutId = setTimeout(() => lastController?.abort(), PER_REQUEST_TIMEOUT);
            const response = await fetch(server, {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
                signal: signal,
            });
            clearTimeout(timeoutId);

            if (response.status === 429 || response.status === 504 || !response.ok) {
                console.warn(`[OSM] Server ${server} failed with ${response.status}. Trying next...`);
                if (i < OVERPASS_SERVERS.length - 1) await delay(500);
                continue;
            }

            const data = await response.json();
            const elements = data.elements || [];

            const bars: OSMBar[] = elements
                .filter((el: any) => el.tags && (el.tags.name || el.tags['name:ca'] || el.tags['name:es']))
                .map((el: any) => {
                    const osmTags = el.tags || {};
                    return {
                        id: `osm_${el.id}`,
                        name: osmTags.name || osmTags['name:ca'] || osmTags['name:es'] || 'Bar sense nom',
                        lat: el.lat || el.center?.lat,
                        lon: el.lon || el.center?.lon,
                        type: osmTags.amenity,
                        tags: osmTags,
                        amenities: mapOSMTagsToAmenities(osmTags),
                    };
                });

            const dedupedBars = deduplicateByProximity(bars);
            cache[gridKey] = { timestamp: Date.now(), data: dedupedBars };
            return dedupedBars;

        } catch (error: any) {
            if (error.name === 'AbortError') return [];
            console.warn(`[OSM] Error fetching from ${server}:`, error);
            if (i < OVERPASS_SERVERS.length - 1) await delay(500);
        }
    }

    console.error('[OSM] All servers failed.');
    return [];
};
