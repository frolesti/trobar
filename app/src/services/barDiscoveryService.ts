import { fetchWithTimeout } from '../api/core';
import { Bar } from '../models/Bar';
import { OSMBar } from '../models/OSMBar';
import { discoverUnregisteredBars, OSMSearchError } from './osmService';
import { mapGooglePlaceTypesToAmenities } from '../utils/googlePlaceAmenities';

type Bounds = { south: number; west: number; north: number; east: number };
export type MapSuggestion = { display_name: string; lat: string; lon: string; venue?: OSMBar };
type GooglePlace = {
    id: string;
    displayName?: { text: string };
    location?: { latitude: number; longitude: number };
    formattedAddress?: string;
    types?: string[];
    attributions?: { provider: string; providerUri: string }[];
};

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const NEARBY_TYPE_GROUPS = [
    ['bar', 'pub', 'sports_bar', 'wine_bar', 'cocktail_bar', 'brewpub', 'beer_garden', 'irish_pub', 'gastropub', 'lounge_bar'],
    ['cafe', 'coffee_shop', 'cafeteria', 'tea_house'],
    ['restaurant', 'bar_and_grill', 'bistro', 'fast_food_restaurant', 'food_court', 'night_club'],
];
const VENUE_TYPES = new Set(NEARBY_TYPE_GROUPS.flat());
const fields = 'places.id,places.displayName,places.location,places.formattedAddress,places.types,places.attributions';
const cache = new Map<string, { expires: number; bars: OSMBar[] }>();
const pending = new Map<string, Promise<OSMBar[]>>();
let windowStart = 0;
let requestCount = 0;

export const venueDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const rad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const venueDescriptors = new Set(['bar', 'cafe', 'cafeteria', 'coffee', 'shop', 'restaurant', 'restaurante', 'pub', 'tapas']);
const nameCore = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(token => token && !venueDescriptors.has(token)).join('');
type VenueIdentity = Pick<Bar, 'id' | 'name' | 'latitude' | 'longitude' | 'googlePlaceId'> & {
    tags?: OSMBar['tags'] | Bar['tags'];
    formattedAddress?: string;
    address?: string;
};
const houseNumber = (venue: { tags?: OSMBar['tags'] | Bar['tags']; formattedAddress?: string; address?: string }) =>
    normalize((!Array.isArray(venue.tags) && venue.tags?.['addr:housenumber']) ||
        (venue.formattedAddress || venue.address || '').match(/\b\d+[a-z]?\b/i)?.[0] || '');

export const isSameVenue = (candidate: OSMBar, existing: VenueIdentity, exactNameRadius = 50): boolean => {
    if (candidate.id && candidate.id === existing.id) return true;
    if (candidate.googlePlaceId && existing.googlePlaceId) return candidate.googlePlaceId === existing.googlePlaceId;
    const distance = venueDistanceMeters(candidate.lat, candidate.lon, existing.latitude, existing.longitude);
    if (!Number.isFinite(distance) || distance > exactNameRadius) return false;
    const candidateNumber = houseNumber(candidate), existingNumber = houseNumber(existing);
    if (candidateNumber && existingNumber && candidateNumber !== existingNumber) return false;
    const name = normalize(candidate.name);
    if (name && name === normalize(existing.name)) return true;
    const core = nameCore(candidate.name);
    return distance < 35 && core.length >= 4 && core === nameCore(existing.name);
};

export const mergeDiscoveredBars = (existing: OSMBar[], incoming: OSMBar[]) => {
    const result: OSMBar[] = [];
    for (const venue of [...existing, ...incoming]) {
        const index = result.findIndex(item => isSameVenue(venue, {
            ...item, latitude: item.lat, longitude: item.lon,
        }));
        const source = venue.source || (venue.googlePlaceId ? 'google' : 'openstreetmap');
        if (index < 0) result.push({ ...venue, sources: [...new Set([...(venue.sources || []), source])] });
        else {
            const previous = result[index];
            const preferPrevious = !!previous.googlePlaceId && !venue.googlePlaceId;
            const preferred = preferPrevious ? previous : venue;
            const other = preferPrevious ? venue : previous;
            result[index] = {
                ...other, ...preferred, id: previous.id,
                googlePlaceId: preferred.googlePlaceId || other.googlePlaceId,
                formattedAddress: preferred.formattedAddress || other.formattedAddress,
                tags: { ...other.tags, ...preferred.tags },
                amenities: [...new Set([...(previous.amenities || []), ...(venue.amenities || [])])],
                sources: [...new Set([...(previous.sources || []), ...(venue.sources || []), source])],
                attributions: [...new Map([...(previous.attributions || []), ...(venue.attributions || [])]
                    .map(item => [`${item.name}:${item.uri}`, item])).values()],
            };
        }
    }
    return result;
};

const validPoint = (lat: number, lon: number) =>
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

async function requestGoogle(kind: 'searchNearby' | 'searchText', body: object): Promise<OSMBar[]> {
    if (!API_KEY) throw new Error('PLACES_NOT_CONFIGURED');
    const key = `${kind}:${JSON.stringify(body)}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.bars;
    const active = pending.get(key);
    if (active) return active;
    // Session-only request reuse; nothing is written to device storage.
    if (Date.now() - windowStart >= 3600000) { windowStart = Date.now(); requestCount = 0; }
    if (requestCount >= 60) throw new Error('PLACES_SESSION_LIMIT');
    requestCount++;
    const request = (async () => {
        const response = await fetchWithTimeout(`https://places.googleapis.com/v1/places:${kind}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': fields },
            body: JSON.stringify(body),
        }, `places.${kind}`);
        if (!response.ok) throw new Error(`PLACES_HTTP_${response.status}`);
        const data: { places?: GooglePlace[] } = await response.json();
        const bars: OSMBar[] = (data.places || []).filter(place =>
            place.id && place.displayName?.text && place.location &&
            validPoint(place.location.latitude, place.location.longitude) &&
            place.types?.some(type => VENUE_TYPES.has(type))
        ).map(place => ({
            id: `google_${place.id}`, googlePlaceId: place.id, source: 'google',
            name: place.displayName!.text, lat: place.location!.latitude, lon: place.location!.longitude,
            formattedAddress: place.formattedAddress, type: 'bar', tags: {},
            amenities: mapGooglePlaceTypesToAmenities(place.types || []),
            attributions: place.attributions?.map(item => ({ name: item.provider, uri: item.providerUri })),
        }));
        if (cache.size >= 60) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: Date.now() + 300000, bars });
        return bars;
    })().finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
}

export async function searchGoogleVenues(query: string, lat: number, lon: number): Promise<OSMBar[]> {
    if (!validPoint(lat, lon)) throw new OSMSearchError('OSM_INVALID_COORDINATES');
    const textQuery = query.trim().slice(0, 160);
    if (textQuery.length < 3) return [];
    return requestGoogle('searchText', {
        textQuery, maxResultCount: 5, languageCode: 'ca',
        locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: 5000 } },
    });
}

export async function discoverMapBars(lat: number, lon: number, radiusKm: number, bounds?: Bounds) {
    if (!validPoint(lat, lon) || !Number.isFinite(radiusKm) || radiusKm <= 0 ||
        (bounds && (!validPoint(bounds.south, bounds.west) || !validPoint(bounds.north, bounds.east) ||
            bounds.south >= bounds.north || bounds.west >= bounds.east))) {
        throw new OSMSearchError('OSM_INVALID_COORDINATES');
    }
    if (bounds && (venueDistanceMeters(bounds.south, bounds.west, bounds.north, bounds.west) > 10000 ||
        venueDistanceMeters(bounds.south, bounds.west, bounds.south, bounds.east) > 10000)) {
        throw new OSMSearchError('OSM_AREA_TOO_LARGE');
    }
    const latitude = bounds ? (bounds.south + bounds.north) / 2 : lat;
    const longitude = bounds ? (bounds.west + bounds.east) / 2 : lon;
    const radius = Math.min(5000, bounds
        ? venueDistanceMeters(latitude, longitude, bounds.north, bounds.east)
        : radiusKm * 1000);
    // Separate caps prevent nearby restaurants from consuming every slot meant for bars.
    const [osm, ...google] = await Promise.allSettled([
        discoverUnregisteredBars(lat, lon, radiusKm, bounds),
        ...NEARBY_TYPE_GROUPS.map(includedTypes => requestGoogle('searchNearby', {
            includedTypes,
            maxResultCount: 20, rankPreference: 'DISTANCE', languageCode: 'ca',
            locationRestriction: { circle: { center: { latitude, longitude }, radius } },
        })),
    ] as const);
    if (osm.status === 'rejected') console.info('[Discovery] OSM unavailable', osm.reason);
    google.forEach((result, index) => {
        if (result.status === 'rejected') console.info('[Discovery] Google category unavailable', NEARBY_TYPE_GROUPS[index], result.reason);
    });
    if (osm.status === 'rejected' && google.every(result => result.status === 'rejected')) {
        throw google[0].status === 'rejected' ? google[0].reason : osm.reason;
    }
    const googleBars = google.flatMap(result => result.status === 'fulfilled' ? result.value : []).filter(bar => !bounds ||
        (bar.lat >= bounds.south && bar.lat <= bounds.north && bar.lon >= bounds.west && bar.lon <= bounds.east));
    return {
        bars: mergeDiscoveredBars(osm.status === 'fulfilled' ? osm.value.bars : [], googleBars),
        partial: osm.status === 'rejected' || google.some(result => result.status === 'rejected' || result.value.length >= 20) ||
            (osm.status === 'fulfilled' && !!osm.value.limitedArea),
    };
}

export async function searchMapLocations(query: string, lat: number, lon: number): Promise<{ suggestions: MapSuggestion[]; partial: boolean }> {
    const [google, osm] = await Promise.allSettled([
        searchGoogleVenues(query, lat, lon),
        (async (): Promise<MapSuggestion[]> => {
            const response = await fetchWithTimeout(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=es&accept-language=ca`,
                undefined, 'nominatim.search', 10000,
            );
            if (!response.ok) throw new Error(`NOMINATIM_HTTP_${response.status}`);
            const data: MapSuggestion[] = await response.json();
            if (!Array.isArray(data)) throw new Error('NOMINATIM_INVALID_RESPONSE');
            return data.filter(item => typeof item.display_name === 'string' &&
                typeof item.lat === 'string' && item.lat.trim() !== '' &&
                typeof item.lon === 'string' && item.lon.trim() !== '' &&
                validPoint(Number(item.lat), Number(item.lon)));
        })(),
    ]);
    if (google.status === 'rejected') console.info('[Discovery] Venue search unavailable', google.reason);
    if (osm.status === 'rejected') console.info('[Discovery] Location search unavailable', osm.reason);
    if (google.status === 'rejected' && osm.status === 'rejected') throw google.reason;
    return {
        suggestions: [
            ...(google.status === 'fulfilled' ? google.value.map(venue => ({
                display_name: [venue.name, venue.formattedAddress].filter(Boolean).join(', '),
                lat: String(venue.lat), lon: String(venue.lon), venue,
            })) : []),
            ...(osm.status === 'fulfilled' ? osm.value : []),
        ].slice(0, 8),
        partial: google.status === 'rejected' || osm.status === 'rejected',
    };
}
