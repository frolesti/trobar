export type MapRegion = {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
};

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
