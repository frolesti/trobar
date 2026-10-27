export interface Coordinates {
    latitude: number;
    longitude: number;
}

export function validBarCoordinates(value: unknown): value is Coordinates {
    if (!value || typeof value !== 'object') return false;
    const coordinates = value as Coordinates;
    return Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude)
        && Math.abs(coordinates.latitude) <= 90 && Math.abs(coordinates.longitude) <= 180;
}

export function getBarCoordinates(data: { location?: unknown; latitude?: unknown; longitude?: unknown }): Coordinates | null {
    if (validBarCoordinates(data.location)) return data.location;
    const flat = { latitude: data.latitude, longitude: data.longitude };
    return validBarCoordinates(flat) ? flat : null;
}

export function buildBarNavigationUrls(coordinates: Coordinates) {
    if (!validBarCoordinates(coordinates)) throw new Error('Invalid bar coordinates');
    const destination = `${coordinates.latitude},${coordinates.longitude}`;
    return {
        googleUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`,
        wazeUrl: `https://waze.com/ul?ll=${destination}&navigate=yes`,
        appleMapsUrl: `https://maps.apple.com/?daddr=${destination}&dirflg=w`,
    };
}