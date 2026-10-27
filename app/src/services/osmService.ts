import { OSMBar } from '../models/OSMBar';
import { BarAmenity } from '../models/Bar';
import { fetchWithTimeout } from '../api/core';

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
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
];

/** Timeout per a cada request individual a un servidor Overpass (ms) */
const PER_REQUEST_TIMEOUT = 4_000;

/** Pausa curta entre servidors per reduir 429s */
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Sistema de cache: emmagatzema resultats per cel·la de graella (aprox 1 km)
const cache: Record<string, { timestamp: number, data: OSMBar[] }> = {};
const CACHE_TTL = 1000 * 60 * 60; // 1 hora
const pending = new Map<string, Promise<OSMBar[]>>();
const serverRetryAfter = new Map<string, number>();
let retryAfter = 0;

export class OSMSearchError extends Error {
    constructor(public readonly code: 'OSM_AREA_TOO_LARGE' | 'OSM_OVERPASS_UNAVAILABLE' | 'OSM_INVALID_COORDINATES') {
        super(code);
        this.name = 'OSMSearchError';
    }
}

const validCoordinates = (lat: number, lon: number) =>
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

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

const searchOSM = async (gridKey: string, selector: string): Promise<OSMBar[]> => {
    const cached = cache[gridKey];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    const existing = pending.get(gridKey);
    if (existing) return existing;
    if (Date.now() < retryAfter) throw new OSMSearchError('OSM_OVERPASS_UNAVAILABLE');
    const request = requestOSM(selector).then(bars => {
        if (Object.keys(cache).length >= 100) delete cache[Object.keys(cache)[0]];
        cache[gridKey] = { timestamp: Date.now(), data: bars };
        return bars;
    }).finally(() => pending.delete(gridKey));
    pending.set(gridKey, request);
    return request;
};

const requestOSM = async (selector: string): Promise<OSMBar[]> => {
    const query = `[out:json][timeout:3];nwr["amenity"~"^(bar|pub|cafe|restaurant|nightclub|club)$"]${selector};out center tags qt;`;
    for (let i = 0; i < OVERPASS_SERVERS.length; i++) {
        const server = OVERPASS_SERVERS[i];
        if (Date.now() < (serverRetryAfter.get(server) || 0)) continue;
        try {
            const response = await fetchWithTimeout(server, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Trobar/1.0 (bar discovery application)',
                },
                body: `data=${encodeURIComponent(query)}`,
            }, `osm.radius.server-${i + 1}`, PER_REQUEST_TIMEOUT, 'warn');

            if (response.status === 429 || response.status === 504 || !response.ok) {
                serverRetryAfter.set(server, Date.now() + 30_000);
                console.warn(`[OSM] Server ${server} failed with ${response.status} (${response.headers?.get('content-type') || 'unknown content type'}). Trying next...`);
                if (i < OVERPASS_SERVERS.length - 1) await delay(500);
                continue;
            }

            const data = await response.json();
            if (data.remark || !Array.isArray(data.elements)) throw new Error('Incomplete Overpass response');
            const elements = data.elements;

            const bars: OSMBar[] = elements
                .filter((el: any) => {
                    return el.tags && (el.tags.name || el.tags['name:ca'] || el.tags['name:es']);
                })
                .map((el: any) => {
                    const osmTags = el.tags || {};
                    return {
                        id: `osm_${el.id}`,
                        name: osmTags.name || osmTags['name:ca'] || osmTags['name:es'] || 'Bar sense nom',
                        lat: el.lat ?? el.center?.lat,
                        lon: el.lon ?? el.center?.lon,
                        type: osmTags.amenity,
                        tags: osmTags,
                        amenities: mapOSMTagsToAmenities(osmTags),
                    };
                }).filter((bar: OSMBar) => validCoordinates(bar.lat, bar.lon));

            // Deduplicar per proximitat: node+way del mateix bar = duplicat
            // Si dos punts estan a < 40 m i tenen el mateix nom normalitzat, eliminem el segon
            const dedupedBars = deduplicateByProximity(bars);
            
            // Emmagatzemar a la cache
            return dedupedBars;

        } catch (error: any) {
            serverRetryAfter.set(server, Date.now() + 30_000);
            console.warn(`[OSM] Error fetching from server ${i + 1}:`, error);
            if (i < OVERPASS_SERVERS.length - 1) await delay(500);
        }
    }

    retryAfter = Date.now() + 30_000;
    throw new OSMSearchError('OSM_OVERPASS_UNAVAILABLE');
};

export const fetchBarsFromOSM = async (lat: number, lon: number, radiusKm: number): Promise<OSMBar[]> => {
    if (!validCoordinates(lat, lon) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
        throw new OSMSearchError('OSM_INVALID_COORDINATES');
    }
    const radius = Math.min(radiusKm, 5);
    return searchOSM(getGridCell(lat, lon, radius), `(around:${radius * 1000},${lat},${lon})`);
};

/**
 * Cerca bars per bounding box (visible bounds del mapa).
 * Overpass utilitza la sintaxi (south, west, north, east).
 */
export const fetchBarsFromOSMBounds = async (
    south: number, west: number, north: number, east: number
): Promise<OSMBar[]> => {
    if (!validCoordinates(south, west) || !validCoordinates(north, east) || south >= north || west >= east) {
        throw new OSMSearchError('OSM_INVALID_COORDINATES');
    }
    if (haversineMeters(south, west, north, west) > 10_000 || haversineMeters(south, west, south, east) > 10_000) {
        throw new OSMSearchError('OSM_AREA_TOO_LARGE');
    }
    const gridKey = `bb:${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
    return searchOSM(gridKey, `(${south},${west},${north},${east})`);
};

export interface DiscoveredBars {
    bars: OSMBar[];
    provider: 'openstreetmap';
    limitedArea?: boolean;
}

export const discoverUnregisteredBars = async (
    lat: number, lon: number, radiusKm: number,
    bounds?: { south: number; west: number; north: number; east: number },
): Promise<DiscoveredBars> => {
    if (!validCoordinates(lat, lon) || !Number.isFinite(radiusKm) || radiusKm <= 0) throw new OSMSearchError('OSM_INVALID_COORDINATES');
    if (bounds) {
        if (!validCoordinates(bounds.south, bounds.west) || !validCoordinates(bounds.north, bounds.east) || bounds.south >= bounds.north || bounds.west >= bounds.east) throw new OSMSearchError('OSM_INVALID_COORDINATES');
        if (haversineMeters(bounds.south, bounds.west, bounds.north, bounds.west) > 10_000 || haversineMeters(bounds.south, bounds.west, bounds.south, bounds.east) > 10_000) throw new OSMSearchError('OSM_AREA_TOO_LARGE');
    }
    const preferMap = bounds ? bounds.north - bounds.south <= 0.01 && bounds.east - bounds.west <= 0.01 : radiusKm <= 0.4;
    if (preferMap) {
        try { return await discoverFromMap(lat, lon, radiusKm, bounds); }
        catch { console.warn('[OSM] Small-area map request unavailable; trying Overpass.'); }
    }
    try {
        const bars = bounds
            ? await fetchBarsFromOSMBounds(bounds.south, bounds.west, bounds.north, bounds.east)
            : await fetchBarsFromOSM(lat, lon, radiusKm);
        return { bars, provider: 'openstreetmap' };
    } catch (error) {
        if (!(error instanceof OSMSearchError) || error.code !== 'OSM_OVERPASS_UNAVAILABLE') throw error;
        if (preferMap) throw error;
    }
    return discoverFromMap(lat, lon, radiusKm, bounds);
};

const discoverFromMap = async (
    lat: number, lon: number, radiusKm: number,
    bounds?: { south: number; west: number; north: number; east: number },
): Promise<DiscoveredBars> => {
    const centerLat = bounds ? (bounds.south + bounds.north) / 2 : lat;
    const centerLon = bounds ? (bounds.west + bounds.east) / 2 : lon;
    const halfLat = Math.min(radiusKm * 1000 / 111_320, 0.005);
    const halfLon = Math.min(halfLat / Math.max(Math.cos(centerLat * Math.PI / 180), 0.1), 0.005);
    const area = {
        south: Math.max(centerLat - halfLat, bounds?.south ?? -90),
        west: Math.max(centerLon - halfLon, bounds?.west ?? -180),
        north: Math.min(centerLat + halfLat, bounds?.north ?? 90),
        east: Math.min(centerLon + halfLon, bounds?.east ?? 180),
    };
    const key = `map:${area.south.toFixed(4)},${area.west.toFixed(4)},${area.north.toFixed(4)},${area.east.toFixed(4)}`;
    const limitedArea = bounds
        ? area.south > bounds.south || area.west > bounds.west || area.north < bounds.north || area.east < bounds.east
        : radiusKm * 1000 > Math.min(halfLat * 111_320, halfLon * 111_320 * Math.cos(centerLat * Math.PI / 180));
    const cached = cache[key];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return { bars: cached.data, provider: 'openstreetmap', limitedArea };
    const existing = pending.get(key);
    if (existing) return { bars: await existing, provider: 'openstreetmap', limitedArea };
    const request = (async () => {
        const response = await fetchWithTimeout(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${area.west},${area.south},${area.east},${area.north}`, {
            headers: { 'User-Agent': 'Trobar/1.0 (bar discovery application)' },
        }, 'osm.mapFallback', 10_000, 'warn');
        if (!response.ok) throw new OSMSearchError('OSM_OVERPASS_UNAVAILABLE');
        const data = await response.json();
        if (!Array.isArray(data.elements)) throw new OSMSearchError('OSM_OVERPASS_UNAVAILABLE');
        const nodes = new Map<number, { lat: number; lon: number }>(data.elements.filter((element: any) => element.type === 'node').map((element: any) => [element.id, element]));
        const bars: OSMBar[] = [];
        for (const element of data.elements) {
            const tags = element.tags || {};
            const name = tags.name || tags['name:ca'] || tags['name:es'];
            if (!name || !/^(bar|pub|cafe|restaurant|nightclub|club)$/.test(tags.amenity)) continue;
            const points = element.type === 'node' ? [element] : (element.nodes || []).map((id: number) => nodes.get(id)).filter(Boolean);
            if (!points.length) continue;
            const latitude = points.reduce((sum: number, point: any) => sum + point.lat, 0) / points.length;
            const longitude = points.reduce((sum: number, point: any) => sum + point.lon, 0) / points.length;
            if (!validCoordinates(latitude, longitude) || latitude < area.south || latitude > area.north || longitude < area.west || longitude > area.east) continue;
            bars.push({ id: `osm_${element.id}`, name, lat: latitude, lon: longitude, type: tags.amenity, tags, amenities: mapOSMTagsToAmenities(tags) });
        }
        const result = deduplicateByProximity(bars);
        if (Object.keys(cache).length >= 100) delete cache[Object.keys(cache)[0]];
        cache[key] = { timestamp: Date.now(), data: result };
        return result;
    })().finally(() => pending.delete(key));
    pending.set(key, request);
    return { bars: await request, provider: 'openstreetmap', limitedArea };
};
