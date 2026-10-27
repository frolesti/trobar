import { EDITORIAL } from '../theme/editorialTheme';
import React from 'react';
import { View, TouchableOpacity, Image, Platform } from 'react-native';
import Text from './AppText';
import AppIcon from './AppIcon';
import { SKETCH_THEME } from '../theme/sketchTheme';
import { Bar } from '../models/Bar';


interface BarListItemProps {
    bar: Bar;
    distanceKm: number;
    onPress: () => void;
    imageError?: boolean;
    onImageError?: () => void;
}

/** Auxiliar per eliminar el sufix numèric del nom del bar */
const getCleanBarName = (name: string) => {
    return name.replace(/\s+\d+$/, '');
};

const getBarImageSource = (img: string | undefined | null) => {
    if (img && typeof img === 'string' && img.startsWith('http') && img !== 'null' && img !== 'undefined' && img.trim() !== '') {
        return { uri: img };
    }
    return null;
};

const BarListItem: React.FC<BarListItemProps> = ({
    bar,
    distanceKm,
    onPress,
    imageError,
    onImageError,
}) => {
    const imageSource = imageError ? null : getBarImageSource(bar.gallery?.[0] || bar.image);
    return (
        <TouchableOpacity
            style={{
                flexDirection: 'row', padding: 10, marginBottom: 8,
                backgroundColor: EDITORIAL.card, borderRadius: 8,
                borderWidth: 1, borderColor: EDITORIAL.hairline,
                ...Platform.select({
                    web: { boxShadow: '0 2px 8px rgba(32,38,49,0.06)' },
                    default: {
                        shadowColor: '#3E2723', shadowOffset: { width: 1, height: 1 },
                        shadowOpacity: 0.1, shadowRadius: 2, elevation: 2
                    }
                })
            }}
            onPress={onPress}
        >
            {imageSource ? <Image
                source={imageSource}
                style={{ width: 80, height: 88, borderRadius: 8, backgroundColor: EDITORIAL.paperAlt }}
                resizeMode="cover"
                onError={onImageError}
            /> : <View style={{ width: 80, height: 88, borderRadius: 8, backgroundColor: EDITORIAL.granaSoft, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="tv" size={40} /></View>}
            <View style={{ marginLeft: 12, justifyContent: 'center', flex: 1 }}>
                <Text style={{
                    fontWeight: 'bold', fontSize: 22, fontFamily: EDITORIAL.fontSport,
                    color: SKETCH_THEME.colors.text, marginBottom: 2
                }}>
                    {getCleanBarName(bar.name)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <AppIcon name="map-pin" size={10} color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 12, color: SKETCH_THEME.colors.textMuted, fontFamily: EDITORIAL.fontRegular }}>
                        {distanceKm.toFixed(1)} km
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                    <AppIcon name="star" size={14} color="#FFFFFF" style={{ marginRight: 2 }} />
                    <Text style={{ fontSize: 12, color: SKETCH_THEME.colors.text, fontFamily: EDITORIAL.fontRegular, fontWeight: 'bold' }}>
                        {bar.rating}
                    </Text>
                    {(bar.usuallyShowsBarca || (bar.broadcastingMatches && bar.broadcastingMatches.length > 0)) && (
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', marginLeft: 4,
                            backgroundColor: EDITORIAL.matchdaySoft,
                            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8
                        }}>
                            <AppIcon name="tv" size={10} color="white" style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 12, color: EDITORIAL.ink, fontFamily: EDITORIAL.fontBold }}>PARTITS</Text>
                        </View>
                    )}
                </View>
            </View>
            <View style={{ justifyContent: 'center' }}>
                <AppIcon name="chevron-right" size={20} color={SKETCH_THEME.colors.accent} />
            </View>
        </TouchableOpacity>
    );
};

export default BarListItem;
