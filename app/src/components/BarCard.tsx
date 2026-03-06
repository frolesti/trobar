import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Linking, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SKETCH_THEME, sketchShadow } from '../theme/sketchTheme';
import { PlaceDetails } from '../services/placesService';

// ── Types ──────────────────────────────────────────────

export interface BarCardProps {
    /** Bar name (fallback if placeDetails has no displayName) */
    name: string;
    /** Address fallback */
    address?: string;
    /** Coordinates for Google Maps link */
    latitude: number;
    longitude: number;
    /** Google Places details (shared for both verified and unverified) */
    placeDetails: PlaceDetails | null;
    /** Whether Place details are still loading */
    loadingPlaceDetails: boolean;
    /** Is this a verified/registered bar? Drives which action buttons show */
    verified: boolean;

    // ── Verified-only props ──
    /** Rating fallback (from our own DB) — only used for verified bars */
    fallbackRating?: number;
    /** Open/closed fallback from our own DB */
    fallbackIsOpen?: boolean;
    /** Distance text ("5 min caminant (300 m)") */
    distanceText?: string;
    /** Navigate to bar (Google Maps external) */
    onNavigate?: () => void;
    /** Close bubble */
    onClose?: () => void;

    // ── Unverified-only props ──
    /** Confirm / report this bar */
    onConfirm?: () => void;
    /** Cancel / go back */
    onCancel?: () => void;
    /** Whether confirm is in progress */
    isSubmitting?: boolean;

    /** Bar tier: 'premium' shows enhanced card, 'free' shows minimal */
    tier?: 'free' | 'premium';

    /** Opens the full-screen premium profile modal */
    onProfileOpen?: () => void;

    /** Fallback images when no Google photos */
    fallbackImages?: any[];
}

// ── Helpers ────────────────────────────────────────────

const getCleanBarName = (name: string) => name.replace(/\s+\d+$/, '');

const getPriceLabel = (priceLevel?: string) => {
    if (priceLevel === 'PRICE_LEVEL_INEXPENSIVE') return '€';
    if (priceLevel === 'PRICE_LEVEL_MODERATE') return '€€';
    if (priceLevel === 'PRICE_LEVEL_EXPENSIVE') return '€€€';
    if (priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE') return '€€€€';
    return null;
};

// ── Component ──────────────────────────────────────────

const BarCard: React.FC<BarCardProps> = (props) => {
    const {
        name, address, latitude, longitude,
        placeDetails: pd, loadingPlaceDetails, verified,
        fallbackRating, fallbackIsOpen,
        distanceText, onNavigate, onClose,
        onConfirm, onCancel, isSubmitting,
        fallbackImages, tier, onProfileOpen,
    } = props;

    const [showHours, setShowHours] = useState(false);

    const displayName = pd?.displayName || getCleanBarName(name);
    const displayAddress = pd?.formattedAddress || address || 'Barcelona';
    const displayRating = pd?.rating ?? fallbackRating ?? 0;
    const ratingCount = pd?.userRatingCount;
    const openStatus = pd?.currentOpeningHours?.openNow ?? fallbackIsOpen;
    const priceLabel = getPriceLabel(pd?.priceLevel);

    const openGoogleMaps = () => {
        const query = encodeURIComponent(`${name}, ${displayAddress}`);
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    };

    // ── Render ─────────────────────────────────────────

    const isPremium = tier === 'premium';

    // ── FREE BAR: Minimal card (name, address, distance, navigate) ──
    if (!isPremium && verified) {
        return (
            <View>
                <Text 
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    style={{
                        fontSize: 18, fontWeight: 'bold', color: SKETCH_THEME.colors.text,
                        fontFamily: 'Lora', marginBottom: 8, lineHeight: 24
                    }}
                >
                    {displayName}
                </Text>

                {/* Rating + Open/Closed */}
                {displayRating > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="star" size={14} color="#FFA000" style={{ marginRight: 3 }} />
                            <Text style={{ fontWeight: 'bold', fontSize: 14, color: SKETCH_THEME.colors.text, fontFamily: 'Lora' }}>
                                {displayRating.toFixed(1)}
                            </Text>
                        </View>
                        {openStatus != null && (
                            <Text style={{
                                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 12,
                                overflow: 'hidden', fontFamily: 'Lora', borderWidth: 1,
                                ...(openStatus
                                    ? { backgroundColor: '#E8F5E9', color: '#2E7D32', borderColor: '#C8E6C9' }
                                    : { backgroundColor: '#FFEBEE', color: '#C62828', borderColor: '#FFCDD2' })
                            }}>
                                {openStatus ? 'Obert' : 'Tancat'}
                            </Text>
                        )}
                    </View>
                )}

                {/* Address */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                    <Feather name="map-pin" size={15} color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 8, marginTop: 2 }} />
                    <Text numberOfLines={2} style={{ fontSize: 14, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora', flex: 1, lineHeight: 20 }}>
                        {displayAddress}
                    </Text>
                </View>

                {/* Distance */}
                {distanceText && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Feather name="navigation" size={15} color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 14, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora' }}>
                            {distanceText}
                        </Text>
                    </View>
                )}

                {/* Navigate button */}
                <TouchableOpacity
                    style={{
                        backgroundColor: SKETCH_THEME.colors.primary, borderRadius: 12,
                        paddingVertical: 12, paddingHorizontal: 16,
                        alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                    }}
                    onPress={onNavigate}
                >
                    <Feather name="navigation" size={16} color="white" style={{ marginRight: 8 }} />
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15, fontFamily: 'Lora' }}>Com arribar-hi</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ── PREMIUM BAR: Full card with green inverted background ──
    if (isPremium && verified) {
        return (
            <View>
                {/* Clickable name → opens profile */}
                <TouchableOpacity onPress={onProfileOpen} activeOpacity={0.7}>
                    <Text 
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={{
                            fontSize: 18, fontWeight: 'bold', color: 'white',
                            fontFamily: 'Lora', marginBottom: 4, paddingRight: 28, lineHeight: 24,
                            textDecorationLine: 'underline',
                        }}
                    >
                        {displayName}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <Feather name="star" size={11} color="#FFD700" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFD700', fontFamily: 'Lora', letterSpacing: 0.3 }}>
                            PREMIUM · Veure perfil
                        </Text>
                        <Feather name="chevron-right" size={13} color="#FFD700" style={{ marginLeft: 2 }} />
                    </View>
                </TouchableOpacity>

                {/* Rating + Open/Closed + Price */}
                {displayRating > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="star" size={14} color="#FFA000" style={{ marginRight: 3 }} />
                            <Text style={{ fontWeight: 'bold', fontSize: 14, color: 'white', fontFamily: 'Lora' }}>
                                {displayRating.toFixed(1)}
                            </Text>
                            {ratingCount != null && (
                                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'Lora', marginLeft: 3 }}>
                                    ({ratingCount})
                                </Text>
                            )}
                        </View>
                        {openStatus != null && (
                            <Text style={{
                                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 12,
                                overflow: 'hidden', fontFamily: 'Lora', borderWidth: 1,
                                ...(openStatus
                                    ? { backgroundColor: 'rgba(255,255,255,0.15)', color: '#A5D6A7', borderColor: 'rgba(255,255,255,0.25)' }
                                    : { backgroundColor: 'rgba(255,255,255,0.1)', color: '#EF9A9A', borderColor: 'rgba(255,255,255,0.2)' })
                            }}>
                                {openStatus ? 'Obert' : 'Tancat'}
                            </Text>
                        )}
                        {priceLabel && (
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'Lora' }}>
                                {priceLabel}
                            </Text>
                        )}
                    </View>
                )}

                {/* Address */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                    <Feather name="map-pin" size={15} color="rgba(255,255,255,0.6)" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: 'Lora', flex: 1, lineHeight: 20 }}>
                        {displayAddress}
                    </Text>
                </View>

                {/* Distance */}
                {distanceText && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <Feather name="navigation" size={15} color="rgba(255,255,255,0.6)" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: 'Lora' }}>
                            {distanceText}
                        </Text>
                    </View>
                )}

                {/* Phone */}
                {pd?.phoneNumber && (
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
                        onPress={() => Linking.openURL(`tel:${pd.phoneNumber}`)}
                    >
                        <Feather name="phone" size={15} color="rgba(255,255,255,0.8)" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'Lora' }}>
                            {pd.phoneNumber}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Photos carousel */}
                {renderPhotos(pd, fallbackImages)}

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 14 }} />

                {/* Navigate button — white on green */}
                <TouchableOpacity
                    style={{
                        backgroundColor: 'white', borderRadius: 12,
                        paddingVertical: 14, paddingHorizontal: 20,
                        alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                    }}
                    onPress={onNavigate}
                >
                    <Feather name="navigation" size={18} color={SKETCH_THEME.colors.primary} style={{ marginRight: 8 }} />
                    <Text style={{ color: SKETCH_THEME.colors.primary, fontWeight: 'bold', fontSize: 16, fontFamily: 'Lora' }}>Com arribar-hi</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ── UNVERIFIED BAR (OSM report flow) — unchanged ──
    return (
        <View>
            <Text 
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                    fontSize: 18, fontWeight: 'bold', color: SKETCH_THEME.colors.text,
                    fontFamily: 'Lora', marginBottom: 8, paddingRight: 28, lineHeight: 24
                }}
            >
                {displayName}
            </Text>

            {/* Address */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                <Feather name="map-pin" size={15} color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={{ fontSize: 14, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora', flex: 1, lineHeight: 20 }}>
                    {displayAddress}
                </Text>
            </View>

            {/* Google Maps link */}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }} onPress={openGoogleMaps}>
                <Feather name="map" size={14} color="#E53935" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, color: '#E53935', textDecorationLine: 'underline', fontFamily: 'Lora' }}>
                    Veure a Google Maps
                </Text>
            </TouchableOpacity>

            {/* Loading */}
            {loadingPlaceDetails && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <ActivityIndicator size="small" color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora' }}>Carregant detalls...</Text>
                </View>
            )}

            {/* Photos */}
            {renderPhotos(pd, fallbackImages)}

            <View style={{ height: 1, backgroundColor: SKETCH_THEME.colors.border, marginVertical: 14 }} />

            {/* Report action */}
            <View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', fontFamily: 'Lora', marginBottom: 15, textAlign: 'center' }}>
                    Es poden veure partits aquí?
                </Text>

                <TouchableOpacity
                    style={{
                        backgroundColor: SKETCH_THEME.colors.primary,
                        paddingVertical: 14, borderRadius: 12,
                        alignItems: 'center', marginBottom: 12,
                        ...sketchShadow()
                    }}
                    onPress={onConfirm}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="check-circle" size={18} color="white" style={{ marginRight: 8 }} />
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16, fontFamily: 'Lora' }}>Sí, avisa tothom!</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onCancel}
                    style={{ alignItems: 'center', padding: 10 }}
                >
                    <Text style={{ color: SKETCH_THEME.colors.textMuted, textDecorationLine: 'underline', fontFamily: 'Lora' }}>No n'estic segur</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ── Photos sub-render ──────────────────────────────────

const renderPhotos = (pd: PlaceDetails | null, fallbackImages?: any[]) => {
    const hasGooglePhotos = pd?.photoUrls && pd.photoUrls.length > 0;
    const hasFallback = fallbackImages && fallbackImages.length > 0;

    if (!hasGooglePhotos && !hasFallback) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 14, marginTop: 4 }}
            contentContainerStyle={{ gap: 10 }}
        >
            {hasGooglePhotos
                ? pd!.photoUrls.map((url, i) => (
                    <Image
                        key={i}
                        source={{ uri: url }}
                        style={{ width: 150, height: 110, borderRadius: 12, backgroundColor: '#eee' }}
                        resizeMode="cover"
                    />
                ))
                : fallbackImages!.map((img, i) => (
                    <Image
                        key={i}
                        source={img}
                        style={{ width: 150, height: 110, borderRadius: 12, backgroundColor: '#eee' }}
                        resizeMode="cover"
                    />
                ))
            }
        </ScrollView>
    );
};

export default BarCard;
