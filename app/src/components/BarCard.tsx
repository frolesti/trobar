import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { sketchShadow } from '../theme/sketchTheme';
import { EDITORIAL } from '../theme/editorialTheme';
import { PlaceDetails } from '../services/placesService';

// ── Tipus ──────────────────────────────────────────────

export interface BarCardProps {
    /** Nom del bar (alternativa si placeDetails no té displayName) */
    name: string;
    /** Adreça alternativa */
    address?: string;
    /** Coordenades per a l'enllaç de Google Maps */
    latitude: number;
    longitude: number;
    /** Detalls de Google Places (compartit per a verificats i no verificats) */
    placeDetails: PlaceDetails | null;
    /** Si els detalls de Place encara s'estan carregant */
    loadingPlaceDetails: boolean;
    gallery?: string[];
    /** És un bar verificat/registrat? Determina quins botons d'acció es mostren */
    verified: boolean;

    // ── Props només per a verificats ──
    /** Puntuació alternativa (de la nostra BD) — només per a bars verificats */
    fallbackRating?: number;
    /** Obert/tancat alternatiu de la nostra BD */
    fallbackIsOpen?: boolean;
    /** Text de distància ("5 min caminant (300 m)") */
    distanceText?: string;
    /** Navegar al bar (Google Maps extern) */
    onNavigate?: () => void;
    /** Tancar bafarada */
    onClose?: () => void;

    // ── Props només per a no verificats ──
    /** Confirmar / reportar aquest bar */
    onConfirm?: () => void;
    /** Cancel·lar / tornar enrere */
    onCancel?: () => void;
    /** Si la confirmació està en curs */
    isSubmitting?: boolean;

    /** Premium conserva la mateixa targeta i permet obrir totes les dades. */
    tier?: 'free' | 'premium';

    /** Obre el modal de perfil premium a pantalla completa */
    onProfileOpen?: () => void;

    /** Mitjana de ressenyes internes */
    reviewAvgRating?: number;
    /** Nombre total de ressenyes internes */
    reviewCount?: number;
}

// ── Auxiliars ────────────────────────────────────────────

const getCleanBarName = (name: string) => name.replace(/\s+\d+$/, '');

// ── Component ──────────────────────────────────────────

const BarCard: React.FC<BarCardProps> = (props) => {
    const {
        name, address,
        placeDetails: pd, loadingPlaceDetails, verified,
        fallbackRating, fallbackIsOpen,
        distanceText, onNavigate, onClose,
        onConfirm, onCancel, isSubmitting,
        tier, onProfileOpen, reviewAvgRating, reviewCount,
    } = props;

    const displayName = getCleanBarName(name);
    const displayAddress = pd?.formattedAddress || address || 'Barcelona';
    const photos = [...new Set([...(props.gallery || []), ...(pd?.photoUrls || [])])];
    // Prioritat: 1) Google Places real-time, 2) fallback local (períodes cachejats)
    // NO usem bar.isOpen de Firestore (sempre true, no fiable) → evitem flicker Obert→Tancat
    const openStatus = pd?.currentOpeningHours?.openNow ?? fallbackIsOpen;

    const openGoogleMaps = () => {
        const query = encodeURIComponent(`${name}, ${displayAddress}`);
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    };

    // ── Renderitzat ─────────────────────────────────────────

    const isPremium = tier === 'premium';

    const C = {
        text: EDITORIAL.onBackground,
        muted: EDITORIAL.onBackgroundMuted,
        icon: EDITORIAL.onBackground,
        // Obert = pastilla grana subtil (positiu, en paleta).
        // Tancat = aspecte "deshabilitat" (ink atenuat sobre paperAlt, sense vermell).
        badgeOpen:   { bg: 'rgba(255,255,255,0.16)', color: EDITORIAL.onBackground, border: EDITORIAL.borderOnBackground },
        badgeClosed: { bg: 'rgba(255,255,255,0.06)', color: EDITORIAL.onBackgroundMuted, border: EDITORIAL.borderOnBackground },
        btnBg: EDITORIAL.onBackground,
        btnText: EDITORIAL.background,
    };

    // ── BAR VERIFICAT (free o premium) — mateixa estructura, colors diferenciats ──
    if (verified) {
        return (
            <View style={{ backgroundColor: EDITORIAL.background }}>
                {onClose && (
                    <TouchableOpacity
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel={`Tancar la fitxa de ${displayName}`}
                        style={{ position: 'absolute', top: -8, right: -8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
                    >
                        <Feather name="x" size={18} color={C.icon} />
                    </TouchableOpacity>
                )}
                {/* Nom */}
                <Text
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    style={{
                        fontSize: 20, color: C.text,
                        fontFamily: EDITORIAL.fontBold, marginBottom: 8, lineHeight: 26,
                        letterSpacing: 0, paddingRight: 28,
                    }}
                >
                    {displayName}
                </Text>

                {/* Puntuació interna + Obert/Tancat */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                    {(reviewAvgRating != null && reviewAvgRating > 0) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="star" size={16} color={EDITORIAL.matchday} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 14, color: C.text, fontFamily: EDITORIAL.fontBold }}>
                                {reviewAvgRating.toFixed(1)}
                            </Text>
                            {(reviewCount != null && reviewCount > 0) && (
                                <Text style={{ fontSize: 12, color: C.muted, fontFamily: EDITORIAL.fontRegular, marginLeft: 4 }}>
                                    ({reviewCount})
                                </Text>
                            )}
                        </View>
                    )}
                    {openStatus != null && !loadingPlaceDetails && (
                        <Text style={{
                            paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4, fontSize: 11,
                            overflow: 'hidden', fontFamily: EDITORIAL.fontBold, borderWidth: 1,
                            letterSpacing: 0,
                            backgroundColor: openStatus ? C.badgeOpen.bg : C.badgeClosed.bg,
                            color: openStatus ? C.badgeOpen.color : C.badgeClosed.color,
                            borderColor: openStatus ? C.badgeOpen.border : C.badgeClosed.border,
                        }}>
                            {openStatus ? 'Obert' : 'Tancat'}
                        </Text>
                    )}
                </View>

                {/* Fotos del bar (Google Places) */}
                {renderPhotos(photos)}

                {/* Adreça */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                    <Feather name="map-pin" size={14} color={C.icon} style={{ marginRight: 8, marginTop: 3 }} />
                    <Text numberOfLines={2} style={{ fontSize: 14, color: C.muted, fontFamily: EDITORIAL.fontRegular, flex: 1, lineHeight: 20 }}>
                        {displayAddress}
                    </Text>
                </View>

                {/* Distància */}
                {distanceText && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                        <Feather name="clock" size={14} color={C.icon} style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 14, color: C.muted, fontFamily: EDITORIAL.fontRegular }}>
                            {distanceText}
                        </Text>
                    </View>
                )}

                {/* Botó de navegació */}
                <TouchableOpacity
                    style={{
                        backgroundColor: C.btnBg, borderRadius: 6,
                        paddingVertical: 13, paddingHorizontal: 16,
                        alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                    }}
                    onPress={onNavigate}
                    accessibilityRole="button"
                    accessibilityLabel={`Com arribar a ${displayName}`}
                >
                    <Text style={{ color: C.btnText, fontSize: 14, fontFamily: EDITORIAL.fontBold, letterSpacing: 0 }}>Com arribar-hi</Text>
                </TouchableOpacity>
                {isPremium && onProfileOpen && (
                    <TouchableOpacity
                        onPress={onProfileOpen}
                        accessibilityRole="button"
                        accessibilityLabel={`Veure totes les dades de ${displayName}`}
                        accessibilityHint="Obre la fitxa completa del bar"
                        activeOpacity={0.7}
                        style={{ minHeight: 44, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                        <Text style={{ color: C.icon, fontSize: 14, fontFamily: EDITORIAL.fontBold, flexShrink: 1 }}>
                            Veure totes les dades
                        </Text>
                        <Feather name="chevron-down" size={18} color={C.icon} />
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    // ── BAR NO VERIFICAT (flux de report OSM) — sense canvis ──
    return (
        <View>
            <Text 
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                    fontSize: 18, color: EDITORIAL.grana,
                    fontFamily: EDITORIAL.fontBold, marginBottom: 8, paddingRight: 28, lineHeight: 24
                }}
            >
                {displayName}
            </Text>

            {/* Adreça */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                <Feather name="map-pin" size={15} color={EDITORIAL.inkMuted} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={{ fontSize: 14, color: EDITORIAL.inkMuted, fontFamily: EDITORIAL.fontRegular, flex: 1, lineHeight: 20 }}>
                    {displayAddress}
                </Text>
            </View>

            {/* Carregant */}
            {loadingPlaceDetails && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <ActivityIndicator size="small" color={EDITORIAL.inkMuted} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, color: EDITORIAL.inkMuted, fontFamily: EDITORIAL.fontRegular }}>Carregant detalls...</Text>
                </View>
            )}

            {/* Fotos */}
            {renderPhotos(photos)}

            <View style={{ height: 1, backgroundColor: EDITORIAL.hairline, marginVertical: 14 }} />

            {/* Acció de report */}
            <View>
                <Text style={{ fontSize: 16, fontFamily: EDITORIAL.fontBold, marginBottom: 15, textAlign: 'center', color: EDITORIAL.grana }}>
                    Es poden veure partits aquí?
                </Text>

                <TouchableOpacity
                    style={{
                        backgroundColor: EDITORIAL.grana,
                        paddingVertical: 14, borderRadius: EDITORIAL.radius.md,
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
                            <Text style={{ color: 'white', fontSize: 16, fontFamily: EDITORIAL.fontBold }}>Sí, avisa tothom!</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onCancel}
                    style={{ alignItems: 'center', padding: 10 }}
                >
                    <Text style={{ color: EDITORIAL.inkMuted, textDecorationLine: 'underline', fontFamily: EDITORIAL.fontRegular }}>No n'estic segur</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ── Sub-renderitzat de fotos ──────────────────────────────────

const renderPhotos = (photos: string[]) => {
    if (photos.length === 0) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 14, marginTop: 4 }}
            contentContainerStyle={{ gap: 10 }}
        >
            {photos.map((url, i) => (
                <Image
                    key={i}
                    source={{ uri: url }}
                    style={{ width: 150, height: 110, borderRadius: 8, backgroundColor: EDITORIAL.paperAlt }}
                    resizeMode="cover"
                />
            ))}
        </ScrollView>
    );
};

export default BarCard;
