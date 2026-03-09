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
                    // Filtrar llocs sense nom si volem qualitat, o mantenir-los si només volem punts.
                    // Normalment per a 'Claiming', tenir un nom ajuda.
                    return el.tags && (el.tags.name || el.tags['name:ca'] || el.tags['name:es']);
                })
                .map((el: any) => ({
                    id: `osm_${el.id}`,
                    name: el.tags.name || el.tags['name:ca'] || el.tags['name:es'] || 'Bar sense nom',
                    // Per a 'way' (edificis), Overpass 'out center' ens dona una propietat 'center'
                    lat: el.lat || el.center?.lat,
                    lon: el.lon || el.center?.lon,
                    type: el.tags.amenity,
                    tags: el.tags || {} 
                }));
            
            // Emmagatzemar a la cache
            cache[gridKey] = { timestamp: Date.now(), data: bars };
            return bars; // Èxit! Retornar immediatament

        } catch (error: any) {
            if (error.name === 'AbortError') return []; // L'usuari ha cancel·lat
            console.warn(`[OSM] Error fetching from ${server}:`, error);
            // Continuar el bucle al servidor següent
        }
    }

    console.error('[OSM] All servers failed.');
    return [];
};
