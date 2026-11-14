import React from 'react';
import { Image } from 'expo-image';
import { Bar } from '../models/Bar';
import { getMapIcon } from '../utils/mapIcons';

export function isVerifiedBar(bar: Pick<Bar, 'ownerId' | 'tier'>): boolean {
    return !!bar.ownerId && bar.tier === 'premium';
}

export default function VerifiedBarBadge({ bar, onLoad, size = 52 }: { bar: Pick<Bar, 'ownerId' | 'tier'>; onLoad: () => void; size?: number }) {
    if (!isVerifiedBar(bar)) return null;
    // MapKit snapshots one raster instead of flattening perspective-transformed crest layers.
    return (
        <Image testID="confirmed-bar-pin" source={getMapIcon('premium')} contentFit="contain" transition={0} style={{ width: size, height: size }} accessibilityLabel="Bar verificat" onDisplay={onLoad} />
    );
}