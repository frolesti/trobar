import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { EDITORIAL } from '../theme/editorialTheme';
import { PlaceDetails } from '../services/placesService';
import PremiumProfileSlider from './PremiumProfileSlider';
import VenuePhotoGallery from './VenuePhotoGallery';
import BarReservationAction from './BarReservationAction';
import { reservationUrl as safeReservationUrl, isBarFullForMatch } from '../utils/barReservations';

export interface BarCardProps {
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    placeDetails: PlaceDetails | null;
    loadingPlaceDetails: boolean;
    gallery?: string[];
    verified: boolean;
    fallbackRating?: number;
    fallbackIsOpen?: boolean;
    distanceText?: string;
    onNavigate?: () => void;
    onClose?: () => void;
    onConfirm?: () => void;
    onCancel?: () => void;
    isSubmitting?: boolean;
    promotionalText?: string;
    tier?: 'free' | 'premium';
    onProfileOpen?: () => void;
    profileHandleHidden?: boolean;
    dense?: boolean;
    reviewAvgRating?: number;
    reviewCount?: number;
    demo?: boolean;
    reservationUrl?: string;
    fullMatchIds?: string[];
    matchId?: string;
}

const BarCard: React.FC<BarCardProps> = ({
    name, address, placeDetails: pd, loadingPlaceDetails, gallery = [], verified,
    fallbackIsOpen, distanceText, onNavigate, onClose, onConfirm, onCancel, isSubmitting,
    promotionalText, tier, onProfileOpen, profileHandleHidden, dense = false,
    reviewAvgRating, reviewCount, demo = false, reservationUrl, fullMatchIds, matchId,
}) => {
    const displayName = name.replace(/\s+\d+$/, '');
    const displayAddress = pd?.formattedAddress || address || 'Adreça no disponible';
    const photos = [...new Set([...gallery, ...(pd?.photoUrls || [])])];
    const openStatus = pd?.currentOpeningHours?.openNow ?? fallbackIsOpen;
    const isPremium = verified && tier === 'premium';
    const close = onClose || onCancel;
    const hasReservation = isPremium && (!!safeReservationUrl(reservationUrl) || isBarFullForMatch({ tier, fullMatchIds }, matchId));

    return (
        <View testID={isPremium ? 'premium-bar-summary' : 'venue-bar-summary'} style={{ backgroundColor: EDITORIAL.background }}>
            {isPremium && onProfileOpen && !profileHandleHidden && (
                <PremiumProfileSlider name={displayName} onOpen={onProfileOpen} />
            )}
            <View testID="venue-card-header" style={{ minHeight: 32, justifyContent: 'center', marginBottom: dense ? 4 : 6, paddingRight: 36 }}>
                <Text numberOfLines={2} style={{ color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: dense ? 17 : 20, lineHeight: dense ? 20 : 24 }}>
                    {displayName}
                </Text>
                {close && (
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Tancar la fitxa de ${displayName}`}
                        disabled={isSubmitting}
                        onPress={close}
                        style={{ position: 'absolute', top: -6, right: -6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Feather name="x" size={20} color={EDITORIAL.onBackground} />
                    </TouchableOpacity>
                )}
            </View>
                <View testID="venue-card-status" style={{ height: 24, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: dense ? 6 : 8 }}>
                    {isPremium && (
                        <Text style={{ color: EDITORIAL.background, backgroundColor: EDITORIAL.matchday, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontFamily: EDITORIAL.fontBold, fontSize: 10, lineHeight: 14 }}>PREMIUM</Text>
                    )}
                    {demo && <Text style={{ color: EDITORIAL.matchday, fontFamily: EDITORIAL.fontBold, fontSize: 10 }}>DEMO</Text>}
                    {openStatus != null && !loadingPlaceDetails && (
                        <Text style={{ color: EDITORIAL.onBackground, borderWidth: 1, borderColor: EDITORIAL.borderOnBackground, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontFamily: EDITORIAL.fontRegular, fontSize: 11, lineHeight: 14 }}>
                            {openStatus ? 'Obert' : 'Tancat'}
                        </Text>
                    )}
                    {verified && reviewAvgRating != null && reviewAvgRating > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <MaterialCommunityIcons name="star" size={14} color={EDITORIAL.matchday} />
                            <Text style={{ color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: 12 }}>
                                {reviewAvgRating.toFixed(1)}
                            </Text>
                            {!!reviewCount && <Text style={{ color: EDITORIAL.onBackgroundMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 11 }}>({reviewCount})</Text>}
                        </View>
                    )}
                    {loadingPlaceDetails && <ActivityIndicator accessibilityLabel="Carregant detalls del bar" size="small" color={EDITORIAL.onBackground} style={{ marginLeft: 'auto' }} />}
                </View>
            <View style={{ marginBottom: dense ? 6 : 8 }}>
                <VenuePhotoGallery testID="venue-card-gallery" name={displayName} photos={photos} height={dense ? 72 : 96} photoWidth={dense ? 112 : 152} loading={loadingPlaceDetails} />
            </View>
            <View testID="venue-card-details" style={{ marginBottom: dense ? 6 : 10 }}>
                <View style={{ minWidth: 0, gap: 4 }}>
                    <View style={{ height: 32, flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                        <Feather name="map-pin" size={14} color={EDITORIAL.onBackground} style={{ marginTop: 1 }} />
                        <Text numberOfLines={2} accessibilityLabel={displayAddress} style={{ flex: 1, color: EDITORIAL.onBackgroundMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 12, lineHeight: 16 }}>{displayAddress}</Text>
                    </View>
                    {distanceText && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Feather name="clock" size={14} color={EDITORIAL.onBackground} />
                            <Text numberOfLines={1} style={{ flex: 1, color: EDITORIAL.onBackgroundMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 12, lineHeight: 16 }}>{distanceText}</Text>
                        </View>
                    )}
                </View>
            </View>
            {isPremium && promotionalText && (
                <View style={{ borderLeftWidth: 3, borderLeftColor: EDITORIAL.matchday, paddingLeft: 8, marginBottom: dense ? 6 : 8 }}>
                    <Text numberOfLines={2} accessibilityLabel={promotionalText} style={{ color: EDITORIAL.matchday, fontFamily: EDITORIAL.fontRegular, fontSize: 12, lineHeight: 16 }}>{promotionalText}</Text>
                </View>
            )}
            {verified ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                {hasReservation && <View style={{ flex: 1 }}><BarReservationAction bar={{ tier, reservationUrl, fullMatchIds }} matchId={matchId} demo={demo} /></View>}
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Com arribar a ${displayName}`}
                    onPress={onNavigate}
                    style={{ flex: 1, minHeight: 48, backgroundColor: EDITORIAL.onBackground, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}
                >
                    <Text style={{ color: EDITORIAL.background, fontFamily: EDITORIAL.fontBold, fontSize: 14 }}>Com arribar-hi</Text>
                </TouchableOpacity>
                </View>
            ) : (
                <View testID="venue-card-report">
                    <Text style={{ color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: 14, lineHeight: 18, marginBottom: dense ? 6 : 8 }}>Es poden veure partits aquí?</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={onConfirm}
                            disabled={isSubmitting}
                            style={{ flex: 1, minHeight: 48, borderRadius: 6, backgroundColor: EDITORIAL.onBackground, alignItems: 'center', justifyContent: 'center', padding: 8 }}
                        >
                            {isSubmitting ? <ActivityIndicator color={EDITORIAL.background} /> : <Text style={{ color: EDITORIAL.background, fontFamily: EDITORIAL.fontBold, fontSize: 14, textAlign: 'center' }}>Sí, avisa tothom!</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={onCancel}
                            disabled={isSubmitting}
                            style={{ flex: 1, minHeight: 48, borderRadius: 6, borderWidth: 1, borderColor: EDITORIAL.borderOnBackground, alignItems: 'center', justifyContent: 'center', padding: 8 }}
                        >
                            <Text style={{ color: EDITORIAL.onBackgroundMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 14, textAlign: 'center' }}>No n'estic segur</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

export default BarCard;
