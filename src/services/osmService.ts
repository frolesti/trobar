import { Platform } from 'react-native';

export interface OSMBar {
    id: string; // OSM ID
    name: string;
    lat: number;
    lon: number;
    type: string; // 'bar', 'restaurant', 'cafe'
}

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Debounce helper to avoid spamming the public API
let lastController: AbortController | null = null;

export const fetchBarsFromOSM = async (lat: number, lon: number, radiusKm: number): Promise<OSMBar[]> => {
    // We strictly use the user's radius now, up to a reasonable safety limit of 5km.
    const queryRadiusMeters = Math.min(radiusKm * 1000, 5000); 

    if (lastController) {
        lastController.abort();
    }
    lastController = new AbortController();

    // Overpass QL query
    // We look for nodes and ways (buildings) with amenity = bar/pub/restaurant/cafe
    const query = `
        [out:json][timeout:15];
        (
          node["amenity"~"bar|pub"](around:${queryRadiusMeters},${lat},${lon});
          way["amenity"~"bar|pub"](around:${queryRadiusMeters},${lat},${lon});
        );
        out center;
    `;

    try {
        const response = await fetch(OVERPASS_API, {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            signal: lastController.signal
        });

        if (!response.ok) {
            console.warn('[OSM] Request failed', response.status);
            return [];
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
                type: el.tags.amenity
            }));
            
        return bars;

    } catch (error: any) {
        if (error.name === 'AbortError') return []; // Ignore aborted requests
        console.error('[OSM] Error fetching:', error);
        return [];
    }
};
