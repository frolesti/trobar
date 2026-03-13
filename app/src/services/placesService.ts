/**
 * Google Places API (New) — Cerca i detalls de llocs
 * Utilitza la Places API v1 amb text search per trobar bars per nom+coordenades
 * i retornar dades completes (horaris, telèfon, fotos, valoració, etc.)
 */

import { BarAmenity, OpeningPeriod } from '../models/Bar';
export type { OpeningPeriod };

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const PLACES_BASE = 'https://places.googleapis.com/v1/places';

export interface PlaceDetails {
    placeId: string;
    displayName: string;
    formattedAddress: string;
    rating: number;
    userRatingCount: number;
    phoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    currentOpeningHours?: {
        openNow: boolean;
        weekdayDescriptions: string[];
    };
    /** Períodes d'obertura regulars — per calcular obert/tancat localment */
    openingPeriods?: OpeningPeriod[];
    priceLevel?: string;
    photoUrls: string[];
    types: string[];
}

/**
 * Cerca un bar per nom i coordenades usant Text Search (New).
 * Retorna el place ID del resultat més rellevant.
 */
export async function searchPlace(name: string, lat: number, lng: number): Promise<string | null> {
    try {
        // Forçar "Bar" o "Pub" a la consulta per evitar trobar ciutats/carrers amb el mateix nom
        // e.g. "Lleida" -> "Bar Lleida" or "Pub Lleida" or "Lleida bar"
        const query = `${name} bar`;
        
        const response = await fetch(`${PLACES_BASE}:searchText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryType',
            },
            body: JSON.stringify({
                textQuery: query,
                locationBias: {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: 200, // Radi de 200 m
                    },
                },
                maxResultCount: 3, // Obtenir-ne uns quants per filtrar per tipus si cal
            }),
        });

        if (!response.ok) {
            if (response.status === 403) {
                console.warn('Places API (New) not enabled. Enable "Places API (New)" at https://console.cloud.google.com/apis/library/places-backend.googleapis.com');
            }
            return null;
        }

        const data = await response.json();
        
        // Filtrar entitats administratives evidents (ciutats, barris)
        if (data.places && data.places.length > 0) {
            // Trobar la millor coincidència que sigui probablement un bar/restaurant
            const bestMatch = data.places.find((p: any) => {
                const type = p.primaryType || '';
                // Evitar localitats, estacions de trànsit, etc.
                const badTypes = ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'train_station'];
                return !badTypes.includes(type);
            });

            if (bestMatch) return bestMatch.id;
            // Alternativa: usar el primer resultat si res és explícitament "dolent", o si el filtratge ha estat massa agressiu
            return data.places[0].id;
        }
        return null;
    } catch (error) {
        console.error('Places searchText error:', error);
        return null;
    }
}

const DETAIL_FIELDS = [
    'id',
    'displayName',
    'formattedAddress',
    'rating',
    'userRatingCount',
    'nationalPhoneNumber',
    'internationalPhoneNumber',
    'websiteUri',
    'googleMapsUri',
    'currentOpeningHours',
    'regularOpeningHours',
    'priceLevel',
    'photos',
    'types',
].join(',');

/**
 * Obté tots els detalls d'un lloc per place ID.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
        const response = await fetch(`${PLACES_BASE}/${placeId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': DETAIL_FIELDS,
            },
        });

        const place = await response.json();
        if (!place.id) return null;

        // Construir URLs de fotos (màxim 3)
        const photoUrls: string[] = [];
        if (place.photos && place.photos.length > 0) {
            const maxPhotos = Math.min(place.photos.length, 3);
            for (let i = 0; i < maxPhotos; i++) {
                const photoName = place.photos[i].name; // format: places/{id}/photos/{ref}
                photoUrls.push(
                    `${PLACES_BASE}/${placeId}/photos/${photoName.split('/photos/')[1]}/media?maxWidthPx=400&key=${API_KEY}`
                );
            }
        }

        // Parsejar períodes d'obertura regulars (structured)
        const openingPeriods: OpeningPeriod[] = [];
        const regHours = place.regularOpeningHours || place.currentOpeningHours;
        if (regHours?.periods) {
            for (const p of regHours.periods) {
                if (p.open && p.close) {
                    openingPeriods.push({
                        openDay: p.open.day ?? 0,
                        openHour: p.open.hour ?? 0,
                        openMinute: p.open.minute ?? 0,
                        closeDay: p.close.day ?? 0,
                        closeHour: p.close.hour ?? 0,
                        closeMinute: p.close.minute ?? 0,
                    });
                }
            }
        }

        return {
            placeId: place.id,
            displayName: place.displayName?.text || '',
            formattedAddress: place.formattedAddress || '',
            rating: place.rating || 0,
            userRatingCount: place.userRatingCount || 0,
            phoneNumber: place.internationalPhoneNumber || place.nationalPhoneNumber,
            websiteUri: place.websiteUri,
            googleMapsUri: place.googleMapsUri,
            currentOpeningHours: place.currentOpeningHours
                ? {
                      openNow: place.currentOpeningHours.openNow,
                      weekdayDescriptions: place.currentOpeningHours.weekdayDescriptions || [],
                  }
                : undefined,
            openingPeriods: openingPeriods.length > 0 ? openingPeriods : undefined,
            priceLevel: place.priceLevel,
            photoUrls,
            types: place.types || [],
        };
    } catch (error) {
        console.error('Places getDetails error:', error);
        return null;
    }
}

/**
 * Helper: Cerca + Detalls en un sol pas.
 * Si ja tenim el placeId (de Firestore), saltem la cerca i estalviem 1 crida API.
 * Retorna null si no troba el lloc.
 */
export async function fetchBarPlaceDetails(
    barName: string,
    lat: number,
    lng: number,
    existingPlaceId?: string,
): Promise<PlaceDetails | null> {
    // Si ja tenim el placeId, directament detalls (1 crida en comptes de 2)
    if (existingPlaceId) {
        return getPlaceDetails(existingPlaceId);
    }
    // Si no, cerca + detalls (2 crides, però guardem el placeId per la pròxima)
    const placeId = await searchPlace(barName, lat, lng);
    if (!placeId) return null;
    return getPlaceDetails(placeId);
}

// ── Utilitat: obert/tancat local amb períodes cachejats ──────────────

/**
 * Determina si un bar és obert ARA basant-se en els períodes d'obertura
 * cachejats (ja guardats a Firestore des de la darrera visita a Google Places).
 * Retorna undefined si no tenim dades d'horaris.
 */
export function isOpenNow(periods: OpeningPeriod[] | undefined): boolean | undefined {
    if (!periods || periods.length === 0) return undefined;

    const now = new Date();
    const day = now.getDay(); // 0=Sunday, 1=Monday, ...
    const totalMins = day * 24 * 60 + now.getHours() * 60 + now.getMinutes();

    return periods.some(p => {
        const openMins = p.openDay * 24 * 60 + p.openHour * 60 + p.openMinute;
        let closeMins = p.closeDay * 24 * 60 + p.closeHour * 60 + p.closeMinute;
        // Si close <= open, el bar tanca la setmana següent (e.g. obre dissabte nit, tanca diumenge matí)
        if (closeMins <= openMins) closeMins += 7 * 24 * 60;
        const adjusted = totalMins < openMins ? totalMins + 7 * 24 * 60 : totalMins;
        return adjusted >= openMins && adjusted < closeMins;
    });
}

// ── Google Places types → BarAmenity mapping ────────────────────────────
// Referència: https://developers.google.com/maps/documentation/places/web-service/place-types
// Només fem SERVIR això per bars verificats (amb googlePlaceId) i guardem el resultat a Firestore.
// Així cada bar només costa 1 crida d'API — MAI MÉS.

/**
 * Mapeja els tipus de Google Places (New) a les amenitats de l'app.
 * Complementa les dades d'OSM, NO les substitueix.
 */
export const mapGooglePlaceTypesToAmenities = (
    types: string[],
    placeDetails?: Partial<PlaceDetails>
): BarAmenity[] => {
    const amenities: BarAmenity[] = [];
    const typeSet = new Set(types);

    // Menjar
    if (typeSet.has('restaurant') || typeSet.has('food') || typeSet.has('meal_delivery') ||
        typeSet.has('meal_takeaway') || typeSet.has('bakery') || typeSet.has('dine_in')) {
        amenities.push('food_served');
    }

    // Bar esportiu
    if (typeSet.has('sports_bar') || typeSet.has('sports_club')) {
        amenities.push('sports_bar');
    }

    // Cervesa artesana -> craft_beer (si conté "brewery")  
    if (typeSet.has('brewery')) {
        amenities.push('craft_beer');
    }

    // Música en viu
    if (typeSet.has('live_music_venue') || typeSet.has('night_club')) {
        amenities.push('live_music');
    }

    // Nit (bars nocturns)
    if (typeSet.has('night_club') || typeSet.has('bar')) {
        amenities.push('late_night');
    }

    // Accessibilitat — Google Places (New) pot tenir-ho a `accessibilityOptions`
    if (typeSet.has('wheelchair_accessible_entrance')) {
        amenities.push('accessible');
    }

    // Aparcament
    if (typeSet.has('parking')) {
        amenities.push('parking');
    }

    // WiFi — inferim si el bar té ressenyes que ho mencionen (futur) 
    // Per ara, no ho podem saber directament dels types

    return amenities;
};

/**
 * Combina dues llistes d'amenitats sense duplicats.
 */
export const mergeAmenities = (existing: BarAmenity[], newOnes: BarAmenity[]): BarAmenity[] => {
    const set = new Set<BarAmenity>(existing);
    for (const a of newOnes) set.add(a);
    return Array.from(set);
};
