import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Linking, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SKETCH_THEME } from '../theme/sketchTheme';
import { Bar } from '../models/Bar';
import { PlaceDetails } from '../services/placesService';

interface BarDetailCardProps {
    bar: Bar;
    placeDetails: PlaceDetails | null;
    loadingPlaceDetails: boolean;
    /** Distance info from Routes API or straight-line */
    distanceText: string;
    onClose: () => void;
    onNavigate: () => void;
}

/** Helper to strip numeric suffix from bar name */
const getCleanBarName = (name: string) => {
    return name.replace(/\s+\d+$/, '');
};

const BarDetailCard: React.FC<BarDetailCardProps> = ({
    bar,
    placeDetails: pd,
    loadingPlaceDetails,
    distanceText,
    onClose,
    onNavigate,
}) => {
    const [showHours, setShowHours] = useState(false);

    const openStatus = pd?.currentOpeningHours?.openNow ?? bar.isOpen;
    const displayRating = pd?.rating ?? bar.rating;
    const ratingCount = pd?.userRatingCount;

    const priceLabel = pd?.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? '€'
        : pd?.priceLevel === 'PRICE_LEVEL_MODERATE' ? '€€'
        : pd?.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? '€€€'
        : pd?.priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE' ? '€€€€'
        : null;

    return (
        <View>
            {/* Bar Name */}
            <Text style={{
                fontSize: 20, fontWeight: 'bold', color: SKETCH_THEME.colors.text,
                fontFamily: 'Lora', marginBottom: 6, paddingRight: 30
            }}>
                {pd?.displayName || getCleanBarName(bar.name)}
            </Text>

            {/* Rating + Open/Closed + Price */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="star" size={14} color="#FFA000" style={{ marginRight: 3 }} />
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: SKETCH_THEME.colors.text, fontFamily: 'Lora' }}>
                        {displayRating.toFixed(1)}
                    </Text>
                    {ratingCount != null && (
                        <Text style={{ fontSize: 12, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora', marginLeft: 3 }}>
                            ({ratingCount})
                        </Text>
                    )}
                </View>
                <Text style={{
                    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 12,
                    overflow: 'hidden', fontFamily: 'Lora', borderWidth: 1,
                    ...(openStatus
                        ? { backgroundColor: '#E8F5E9', color: '#2E7D32', borderColor: '#C8E6C9' }
                        : { backgroundColor: '#FFEBEE', color: '#C62828', borderColor: '#FFCDD2' })
                }}>
                    {openStatus ? 'Obert' : 'Tancat'}
                </Text>
                {priceLabel && (
                    <Text style={{ fontSize: 12, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora' }}>
                        {priceLabel}
                    </Text>
                )}
            </View>

            {/* Address */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                <Feather name="map-pin" size={14} color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 6, marginTop: 2 }} />
                <Text style={{ fontSize: 13, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora', flex: 1 }}>
                    {pd?.formattedAddress || bar.address || 'Barcelona'}
                </Text>
            </View>

            {/* Distance / Walking time */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Feather name="navigation" size={14} color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora' }}>
                    {distanceText}
                </Text>
            </View>

            {/* Phone */}
            {pd?.phoneNumber && (
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                    onPress={() => Linking.openURL(`tel:${pd.phoneNumber}`)}
                >
                    <Feather name="phone" size={14} color={SKETCH_THEME.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: SKETCH_THEME.colors.primary, fontFamily: 'Lora' }}>
                        {pd.phoneNumber}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Website */}
            {pd?.websiteUri && (
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                    onPress={() => Linking.openURL(pd.websiteUri!)}
                >
                    <Feather name="globe" size={14} color={SKETCH_THEME.colors.primary} style={{ marginRight: 6 }} />
                    <Text numberOfLines={1} style={{ fontSize: 13, color: SKETCH_THEME.colors.primary, fontFamily: 'Lora', flex: 1 }}>
                        {pd.websiteUri.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Opening Hours */}
            {pd?.currentOpeningHours?.weekdayDescriptions && pd.currentOpeningHours.weekdayDescriptions.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => setShowHours(!showHours)}
                    >
                        <Feather name="clock" size={14} color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora' }}>
                            Horaris
                        </Text>
                        <Feather name={showHours ? 'chevron-up' : 'chevron-down'} size={14} color={SKETCH_THEME.colors.textMuted} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                    {showHours && (
                        <View style={{ marginTop: 6, marginLeft: 20 }}>
                            {pd.currentOpeningHours.weekdayDescriptions.map((line, i) => (
                                <Text key={i} style={{ fontSize: 12, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora', marginBottom: 2 }}>
                                    {line}
                                </Text>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* Loading indicator */}
            {loadingPlaceDetails && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <ActivityIndicator size="small" color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora' }}>Carregant detalls...</Text>
                </View>
            )}

            {/* Photos carousel */}
            {pd?.photoUrls && pd.photoUrls.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                    contentContainerStyle={{ gap: 8 }}
                >
                    {pd.photoUrls.map((url, i) => (
                        <Image
                            key={i}
                            source={{ uri: url }}
                            style={{ width: 140, height: 100, borderRadius: 10, backgroundColor: '#eee' }}
                            resizeMode="cover"
                        />
                    ))}
                </ScrollView>
            )}

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: SKETCH_THEME.colors.border, marginVertical: 10 }} />

            {/* Navigate button */}
            <TouchableOpacity
                style={{
                    backgroundColor: SKETCH_THEME.colors.primary, borderRadius: 12,
                    paddingVertical: 14, paddingHorizontal: 20,
                    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                }}
                onPress={onNavigate}
            >
                <Feather name="navigation" size={18} color="white" style={{ marginRight: 8 }} />
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16, fontFamily: 'Lora' }}>Com arribar-hi</Text>
            </TouchableOpacity>
        </View>
    );
};

export default BarDetailCard;
