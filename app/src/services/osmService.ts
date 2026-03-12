import { OSMBar } from '../models/OSMBar';

export type { OSMBar };

const OVERPASS_SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://interpreter.lazus.de/'
];

// Auxiliar de debounce per evitar saturar l'API pública
let lastController: AbortController | null = null;

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

    for (const server of OVERPASS_SERVERS) {
        try {
            if (signal.aborted) return [];

            const response = await fetch(server, {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
                signal: signal
            });

            if (response.status === 429 || response.status === 504 || !response.ok) {
                console.warn(`[OSM] Server ${server} failed with ${response.status}. Trying next...`);
                continue; // Provar el servidor següent
            }

            const data = await response.json();
            const elements = data.elements || [];

            const bars: OSMBar[] = elements
                .filter((el: any) => {
                    return el.tags && (el.tags.name || el.tags['name:ca'] || el.tags['name:es']);
                })
                .map((el: any) => ({
                    id: `osm_${el.id}`,
                    name: el.tags.name || el.tags['name:ca'] || el.tags['name:es'] || 'Bar sense nom',
                    lat: el.lat || el.center?.lat,
                    lon: el.lon || el.center?.lon,
                    type: el.tags.amenity,
                    tags: el.tags || {} 
                }));

            // Deduplicar per proximitat: node+way del mateix bar = duplicat
            // Si dos punts estan a < 40 m i tenen el mateix nom normalitzat, eliminem el segon
            const dedupedBars = deduplicateByProximity(bars);
            
            // Emmagatzemar a la cache
            cache[gridKey] = { timestamp: Date.now(), data: dedupedBars };
            return dedupedBars;

        } catch (error: any) {
            if (error.name === 'AbortError') return []; // L'usuari ha cancel·lat
            console.warn(`[OSM] Error fetching from ${server}:`, error);
            // Continuar el bucle al servidor següent
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

    for (const server of OVERPASS_SERVERS) {
        try {
            if (signal.aborted) return [];

            const response = await fetch(server, {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
                signal: signal,
            });

            if (response.status === 429 || response.status === 504 || !response.ok) {
                console.warn(`[OSM] Server ${server} failed with ${response.status}. Trying next...`);
                continue;
            }

            const data = await response.json();
            const elements = data.elements || [];

            const bars: OSMBar[] = elements
                .filter((el: any) => el.tags && (el.tags.name || el.tags['name:ca'] || el.tags['name:es']))
                .map((el: any) => ({
                    id: `osm_${el.id}`,
                    name: el.tags.name || el.tags['name:ca'] || el.tags['name:es'] || 'Bar sense nom',
                    lat: el.lat || el.center?.lat,
                    lon: el.lon || el.center?.lon,
                    type: el.tags.amenity,
                    tags: el.tags || {},
                }));

            const dedupedBars = deduplicateByProximity(bars);
            cache[gridKey] = { timestamp: Date.now(), data: dedupedBars };
            return dedupedBars;

        } catch (error: any) {
            if (error.name === 'AbortError') return [];
            console.warn(`[OSM] Error fetching from ${server}:`, error);
        }
    }

    console.error('[OSM] All servers failed.');
    return [];
};
