import type { Camera } from 'react-native-maps';

export type MapRegion = {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
};

export function isValidMapRegion(region: MapRegion): boolean {
    return [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta].every(Number.isFinite)
        && Math.abs(region.latitude) <= 90 && Math.abs(region.longitude) <= 180
        && region.latitudeDelta > 0 && region.longitudeDelta > 0;
}

export function hasMapSearchAreaChanged(previous: MapRegion | null, current: MapRegion | null): boolean {
    if (!previous || !current || !isValidMapRegion(previous) || !isValidMapRegion(current)) return false;
    return Math.abs(current.latitude - previous.latitude) >= previous.latitudeDelta * 0.25
        || Math.abs(current.longitude - previous.longitude) >= previous.longitudeDelta * 0.25
        || Math.abs(current.latitudeDelta - previous.latitudeDelta) >= previous.latitudeDelta * 0.25
        || Math.abs(current.longitudeDelta - previous.longitudeDelta) >= previous.longitudeDelta * 0.25;
}

export function cameraForRegion(camera: Camera, previous: MapRegion, next: MapRegion): Camera {
    if (!isValidMapRegion(previous) || !isValidMapRegion(next)) throw new Error('Invalid map region');
    const scale = next.longitudeDelta / previous.longitudeDelta;
    return {
        ...camera,
        center: { latitude: next.latitude, longitude: next.longitude },
        ...(typeof camera.zoom === 'number' && Number.isFinite(camera.zoom) ? { zoom: camera.zoom - Math.log2(scale) } : {}),
        ...(typeof camera.altitude === 'number' && Number.isFinite(camera.altitude) ? { altitude: camera.altitude * scale } : {}),
    };
}

export function selectionRegion(region: MapRegion, coordinate: { latitude: number; longitude: number }, pinY: number, height: number): MapRegion {
    return {
        ...region,
        latitude: coordinate.latitude + ((pinY - height / 2) / height) * region.latitudeDelta,
        longitude: coordinate.longitude,
    };
}

export function mapMarkerSize(zoom: number, selected: boolean) {
    return Math.round((selected ? 64 : 52) * Math.min(1, Math.max(0.32, 2 ** ((zoom - 15) / 4))));
}

export function mapBubbleLayout(pin: { x: number; y: number }, height: number, width: number, topInset: number, bottomInset: number, cardHeight: number, markerHeight = 64) {
    const bottom = height - bottomInset;
    const aboveEnd = Math.max(topInset, Math.min(bottom, pin.y - markerHeight - 12));
    const belowStart = Math.min(bottom, Math.max(topInset, pin.y + 12));
    const above = Math.max(0, aboveEnd - topInset);
    const below = Math.max(0, bottom - belowStart);
    const placement = above >= Math.min(cardHeight, 120) || above >= below ? 'above' : 'below';
    const maxHeight = Math.max(0, placement === 'above' ? above : below);
    const visibleHeight = Math.min(cardHeight, maxHeight);
    const top = placement === 'above' ? aboveEnd - visibleHeight : belowStart;
    return {
        top: Math.max(topInset, top),
        maxHeight: Math.min(maxHeight, Math.max(0, bottom - top)),
        placement,
        triangleLeft: Math.min(Math.max(pin.x - 9, 26), width - 44),
        triangleTop: placement === 'above' ? top + visibleHeight : top - 9,
    };
}
