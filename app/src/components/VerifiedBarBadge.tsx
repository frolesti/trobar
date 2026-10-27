import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Bar } from '../models/Bar';

const CREST = require('../../../assets/app/img/map-icons/barca-crest.png');

export function isVerifiedBar(bar: Pick<Bar, 'ownerId' | 'tier'>): boolean {
    return !!bar.ownerId && bar.tier === 'premium';
}

export default function VerifiedBarBadge({ bar, onLoad, scale = 1 }: { bar: Pick<Bar, 'ownerId' | 'tier'>; onLoad: () => void; scale?: number }) {
    if (!isVerifiedBar(bar)) return null;
    const crest = { ...styles.crest, width: 23 * scale, height: 27 * scale };
    return (
        <View style={{ ...styles.badge, width: 25 * scale, height: 30 * scale, right: -4 * scale }} pointerEvents="none">
            <Image source={CREST} resizeMode="contain" style={[crest, { ...styles.edge, top: 2 * scale, left: scale }]} accessible={false} />
            <Image source={CREST} resizeMode="contain" style={crest} accessibilityLabel="Bar verificat" onLoad={onLoad} />
            <Image source={CREST} resizeMode="contain" style={[crest, { ...styles.sheen, top: -0.5 * scale, left: -0.5 * scale }]} accessible={false} />
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        position: 'absolute', width: 25, height: 30, top: 0, right: -4,
        transform: [{ perspective: 160 }, { rotateZ: '-18deg' }, { rotateY: '-24deg' }, { rotateX: '10deg' }],
        ...Platform.select({
            ios: { shadowColor: '#3B0A12', shadowOffset: { width: 1, height: 2 }, shadowOpacity: 0.5, shadowRadius: 1.5 },
            web: { filter: 'drop-shadow(1px 2px 1px rgba(59,10,18,0.5))' } as any,
        }),
    },
    crest: { position: 'absolute', width: 23, height: 27, top: 0, left: 0 },
    edge: { top: 2, left: 1, tintColor: '#652836' },
    sheen: { top: -0.5, left: -0.5, tintColor: '#FFF0D6', opacity: 0.12 },
});