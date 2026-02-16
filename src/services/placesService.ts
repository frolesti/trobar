/**
 * Google Places API (New) — Cerca i detalls de llocs
 * Utilitza la Places API v1 amb text search per trobar bars per nom+coordenades
 * i retornar dades completes (horaris, telèfon, fotos, valoració, etc.)
 */

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
        // Force "Bar" or "Pub" into the query to avoid finding cities/streets with the same name
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
                        radius: 200, // 200m radius
                    },
                },
                maxResultCount: 3, // Fetch a few to filter by type if needed
            }),
        });

        if (!response.ok) {
            if (response.status === 403) {
                console.warn('Places API (New) not enabled. Enable "Places API (New)" at https://console.cloud.google.com/apis/library/places-backend.googleapis.com');
            }
            return null;
        }

        const data = await response.json();
        
        // Filter out obvious administrative entities (cities, neighborhoods)
        if (data.places && data.places.length > 0) {
            // Find the best match that is likley a bar/restaurant
            const bestMatch = data.places.find((p: any) => {
                const type = p.primaryType || '';
                // Avoid localities, transit stations, etc.
                const badTypes = ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'train_station'];
                return !badTypes.includes(type);
            });

            if (bestMatch) return bestMatch.id;
            // Fallback: use first result if nothing is explicitly "bad", or if filtering was too aggressive
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
 * Retorna null si no troba el lloc.
 */
export async function fetchBarPlaceDetails(
    barName: string,
    lat: number,
    lng: number
): Promise<PlaceDetails | null> {
    const placeId = await searchPlace(barName, lat, lng);
    if (!placeId) return null;
    return getPlaceDetails(placeId);
}
