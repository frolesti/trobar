/**
 * Google Places API (New) — Cerca i detalls de llocs
 * Utilitza la Places API v1 amb text search per trobar bars per nom+coordenades
 * i retornar dades completes (horaris, telèfon, fotos, valoració, etc.)
 */

import { BarAmenity, OpeningPeriod } from '../models/Bar';
import { fetchWithTimeout } from '../api/core';
import { searchGoogleVenues, isSameVenue } from './barDiscoveryService';
export { mapGooglePlaceTypesToAmenities } from '../utils/googlePlaceAmenities';
export type { OpeningPeriod };

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const PLACES_BASE = 'https://places.googleapis.com/v1/places';
const pendingDetails = new Map<string, Promise<PlaceDetails | null>>();
const pendingBars = new Map<string, Promise<PlaceDetails | null>>();
const knownPlaceIds = new Map<string, string>();

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
        const candidates = await searchGoogleVenues(name, lat, lng);
        const match = candidates.find(place => isSameVenue(place, { id: '', name, latitude: lat, longitude: lng }, 250));
        return match?.googlePlaceId || null;
    } catch (error) {
        console.info('Places searchText error:', error);
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
function requestPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    const active = pendingDetails.get(placeId);
    if (active) return active;
    const request = (async (): Promise<PlaceDetails | null> => {
        const response = await fetchWithTimeout(`${PLACES_BASE}/${placeId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': DETAIL_FIELDS,
            },
        }, 'places.getDetails', 15000);

        // Place ID antic / movent / no v\u00e0lid → no escupim error a la consola
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`PLACES_DETAILS_HTTP_${response.status}`);

        const place = await response.json();
        if (!place.id) throw new Error('PLACES_DETAILS_INVALID_RESPONSE');

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
    })().finally(() => pendingDetails.delete(placeId));
    pendingDetails.set(placeId, request);
    return request;
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
        return await requestPlaceDetails(placeId);
    } catch (error) {
        console.info('Places getDetails error:', error);
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
    const key = JSON.stringify([barName.trim().toLowerCase(), lat, lng, existingPlaceId || '']);
    const active = pendingBars.get(key);
    if (active) return active;
    const request = (async () => {
        try {
            const previousId = knownPlaceIds.get(key) || existingPlaceId;
            let details = previousId ? await requestPlaceDetails(previousId) : null;
            if (!details) {
                knownPlaceIds.delete(key);
                const placeId = await searchPlace(barName, lat, lng);
                if (!placeId || placeId === previousId) return null;
                details = await requestPlaceDetails(placeId);
            }
            if (details) {
                if (!knownPlaceIds.has(key) && knownPlaceIds.size >= 200) knownPlaceIds.delete(knownPlaceIds.keys().next().value!);
                knownPlaceIds.set(key, details.placeId);
            }
            return details;
        } catch (error) {
            console.info('Places bar details error:', error);
            return null;
        }
    })().finally(() => pendingBars.delete(key));
    pendingBars.set(key, request);
    return request;
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

/**
 * Combina dues llistes d'amenitats sense duplicats.
 */
export const mergeAmenities = (existing: BarAmenity[], newOnes: BarAmenity[]): BarAmenity[] => {
    const set = new Set<BarAmenity>(existing);
    for (const a of newOnes) set.add(a);
    return Array.from(set);
};
