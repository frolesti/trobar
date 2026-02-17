import { Platform } from 'react-native';
import { OSMBar } from '../models/OSMBar';

export type { OSMBar };

const OVERPASS_SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://interpreter.lazus.de/'
];

// Debounce helper to avoid spamming the public API
let lastController: AbortController | null = null;

// Caching system: stores results by grid cell (approx 1km)
const CACHE_GRID_SIZE = 0.01; // ~1km
const cache: Record<string, { timestamp: number, data: OSMBar[] }> = {};
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

const getGridCell = (lat: number, lon: number, radius: number) => {
    // Round lat/lon to ~100m precision (3 decimals) to group nearby searches
    // Include radius to differentiate scope.
    return `${lat.toFixed(3)},${lon.toFixed(3)},r:${radius.toFixed(1)}`;
};

export const fetchBarsFromOSM = async (lat: number, lon: number, radiusKm: number): Promise<OSMBar[]> => {
    // Check Cache first with stricter key
    const gridKey = getGridCell(lat, lon, radiusKm);
    const cached = cache[gridKey];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        // console.log('[OSM] Returned from cache:', gridKey);
        return cached.data;
    }

    // We strictly use the user's radius now, up to a reasonable safety limit of 5km.
    const queryRadiusMeters = Math.min(radiusKm * 1000, 5000); 

    if (lastController) {
        lastController.abort();
    }
    lastController = new AbortController();
    const signal = lastController.signal;

    // Overpass QL query
    // We look for nodes and ways (buildings) with amenity = bar/pub/restaurant/cafe
    // Increased timeout to 25s for better reliability
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
                continue; // Try next server
            }

            const data = await response.json();
            const elements = data.elements || [];

            const bars: OSMBar[] = elements
                .filter((el: any) => {
                    // Filter out unnamed places if we want quality, or keep them if we just want points.
                    // Usually for "Claiming", having a name helps.
                    return el.tags && (el.tags.name || el.tags['name:ca'] || el.tags['name:es']);
                })
                .map((el: any) => ({
                    id: `osm_${el.id}`,
                    name: el.tags.name || el.tags['name:ca'] || el.tags['name:es'] || 'Bar sense nom',
                    // For 'way' (buildings), Overpass 'out center' gives us a 'center' property
                    lat: el.lat || el.center?.lat,
                    lon: el.lon || el.center?.lon,
                    type: el.tags.amenity,
                    tags: el.tags || {} 
                }));
            
            // Store cache
            cache[gridKey] = { timestamp: Date.now(), data: bars };
            return bars; // Success! Return immediately

        } catch (error: any) {
            if (error.name === 'AbortError') return []; // User cancelled
            console.warn(`[OSM] Error fetching from ${server}:`, error);
            // Continue loop to next server
        }
    }

    console.error('[OSM] All servers failed.');
    return [];
};
