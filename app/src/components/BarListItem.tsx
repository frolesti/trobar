import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SKETCH_THEME } from '../theme/sketchTheme';
import { Bar } from '../models/Bar';

const DEFAULT_BAR_IMAGE = require('../../assets/img/bar-fallout.jpg');

interface BarListItemProps {
    bar: Bar;
    distanceKm: number;
    onPress: () => void;
    imageError?: boolean;
    onImageError?: () => void;
}

/** Helper to strip numeric suffix from bar name */
const getCleanBarName = (name: string) => {
    return name.replace(/\s+\d+$/, '');
};

const getBarImageSource = (img: string | undefined | null) => {
    if (img && typeof img === 'string' && img.startsWith('http') && img !== 'null' && img !== 'undefined' && img.trim() !== '') {
        return { uri: img };
    }
    return DEFAULT_BAR_IMAGE;
};

const BarListItem: React.FC<BarListItemProps> = ({
    bar,
    distanceKm,
    onPress,
    imageError,
    onImageError,
}) => {
    return (
        <TouchableOpacity
            style={{
                flexDirection: 'row', padding: 10, marginBottom: 8,
                backgroundColor: SKETCH_THEME.colors.bg, borderRadius: 12,
                borderWidth: 1, borderColor: '#D7CCC8',
                ...Platform.select({
                    web: { boxShadow: '2px 2px 0px rgba(62,39,35,0.1)' },
                    default: {
                        shadowColor: '#3E2723', shadowOffset: { width: 1, height: 1 },
                        shadowOpacity: 0.1, shadowRadius: 2, elevation: 2
                    }
                })
            }}
            onPress={onPress}
        >
            <Image
                source={imageError ? DEFAULT_BAR_IMAGE : getBarImageSource(bar.image)}
                style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#eee', borderWidth: 1, borderColor: '#D7CCC8' }}
                resizeMode="cover"
                onError={onImageError}
            />
            <View style={{ marginLeft: 12, justifyContent: 'center', flex: 1 }}>
                <Text style={{
                    fontWeight: 'bold', fontSize: 16, fontFamily: 'Lora',
                    color: SKETCH_THEME.colors.text, marginBottom: 2
                }}>
                    {getCleanBarName(bar.name)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Feather name="map-pin" size={10} color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 12, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora' }}>
                        {distanceKm.toFixed(1)} km
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="star" size={12} color="#FFA000" style={{ marginRight: 2 }} />
                    <Text style={{ fontSize: 12, color: SKETCH_THEME.colors.text, fontFamily: 'Lora', fontWeight: 'bold' }}>
                        {bar.rating}
                    </Text>
                    {(bar.usuallyShowsBarca || (bar.broadcastingMatches && bar.broadcastingMatches.length > 0)) && (
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', marginLeft: 12,
                            backgroundColor: SKETCH_THEME.colors.primary,
                            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4
                        }}>
                            <Feather name="tv" size={10} color="white" style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 10, color: 'white', fontFamily: 'Lora', fontWeight: 'bold' }}>PARTIT</Text>
                        </View>
                    )}
                </View>
            </View>
            <View style={{ justifyContent: 'center' }}>
                <Feather name="chevron-right" size={20} color={SKETCH_THEME.colors.accent} />
            </View>
        </TouchableOpacity>
    );
};

export default BarListItem;
