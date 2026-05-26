import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SKETCH_THEME, sketchShadow } from '../theme/sketchTheme';
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

    /** Nivell del bar: 'premium' mostra targeta ampliada, 'free' mostra la mínima */
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
        distanceText, onNavigate,
        onConfirm, onCancel, isSubmitting,
        tier, onProfileOpen, reviewAvgRating, reviewCount,
    } = props;

    const displayName = getCleanBarName(name);
    const displayAddress = pd?.formattedAddress || address || 'Barcelona';
    // Prioritat: 1) Google Places real-time, 2) fallback local (períodes cachejats)
    // NO usem bar.isOpen de Firestore (sempre true, no fiable) → evitem flicker Obert→Tancat
    const openStatus = pd?.currentOpeningHours?.openNow ?? fallbackIsOpen;

    const openGoogleMaps = () => {
        const query = encodeURIComponent(`${name}, ${displayAddress}`);
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    };

    // ── Renderitzat ─────────────────────────────────────────

    const isPremium = tier === 'premium';

    // ── Paleta editorial unificada (paper + ink + grana) per a totes les targetes.
    //    Premium només afegeix un eyebrow GRANA "PREMIUM" + estrella; el fons es
    //    manté cremos per coherència editorial i llegibilitat.
    const C = {
        text: EDITORIAL.ink,
        muted: EDITORIAL.inkMuted,
        icon: EDITORIAL.grana,
        // Obert = pastilla grana subtil (positiu, en paleta).
        // Tancat = aspecte "deshabilitat" (ink atenuat sobre paperAlt, sense vermell).
        badgeOpen:   { bg: EDITORIAL.granaSoft,                          color: EDITORIAL.grana,    border: 'rgba(165,0,68,0.18)' },
        badgeClosed: { bg: EDITORIAL.paperAlt,                           color: EDITORIAL.inkMuted, border: EDITORIAL.hairline },
        btnBg: EDITORIAL.grana,
        btnText: '#FFFFFF',
        btnIcon: '#FFFFFF',
    };

    // ── BAR VERIFICAT (free o premium) — mateixa estructura, colors diferenciats ──
    if (verified) {
        return (
            <View>
                {/* Nom */}
                <Text
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    style={{
                        fontSize: 20, color: C.text,
                        fontFamily: EDITORIAL.fontBold, marginBottom: isPremium ? 4 : 8, lineHeight: 26,
                        letterSpacing: -0.2,
                    }}
                >
                    {displayName}
                </Text>

                {/* Eyebrow PREMIUM + Veure perfil (només premium) */}
                {isPremium && (
                    <TouchableOpacity
                        onPress={onProfileOpen}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
                    >
                        <MaterialCommunityIcons name="star" size={12} color={EDITORIAL.grana} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 11, color: EDITORIAL.grana, fontFamily: EDITORIAL.fontBold, letterSpacing: 2.0, textTransform: 'uppercase' }}>
                            Premium · Veure perfil
                        </Text>
                        <Feather name="chevron-right" size={13} color={EDITORIAL.grana} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                )}

                {/* Puntuació interna + Obert/Tancat */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                    {(reviewAvgRating != null && reviewAvgRating > 0) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="star" size={16} color={EDITORIAL.grana} style={{ marginRight: 4 }} />
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
                            letterSpacing: 1.4, textTransform: 'uppercase',
                            backgroundColor: openStatus ? C.badgeOpen.bg : C.badgeClosed.bg,
                            color: openStatus ? C.badgeOpen.color : C.badgeClosed.color,
                            borderColor: openStatus ? C.badgeOpen.border : C.badgeClosed.border,
                        }}>
                            {openStatus ? 'Obert' : 'Tancat'}
                        </Text>
                    )}
                </View>

                {/* Fotos del bar (Google Places) */}
                {renderPhotos(pd)}

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
                >
                    <Text style={{ color: C.btnText, fontSize: 13, fontFamily: EDITORIAL.fontBold, letterSpacing: 2.0, textTransform: 'uppercase' }}>Com arribar-hi</Text>
                </TouchableOpacity>
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
                    fontSize: 18, fontWeight: 'bold', color: SKETCH_THEME.colors.text,
                    fontFamily: 'Lora', marginBottom: 8, paddingRight: 28, lineHeight: 24
                }}
            >
                {displayName}
            </Text>

            {/* Adreça */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                <Feather name="map-pin" size={15} color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={{ fontSize: 14, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora', flex: 1, lineHeight: 20 }}>
                    {displayAddress}
                </Text>
            </View>

            {/* Carregant */}
            {loadingPlaceDetails && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <ActivityIndicator size="small" color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora' }}>Carregant detalls...</Text>
                </View>
            )}

            {/* Fotos */}
            {renderPhotos(pd)}

            <View style={{ height: 1, backgroundColor: SKETCH_THEME.colors.border, marginVertical: 14 }} />

            {/* Acció de report */}
            <View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', fontFamily: 'Lora', marginBottom: 15, textAlign: 'center', color: SKETCH_THEME.colors.primary }}>
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

// ── Sub-renderitzat de fotos ──────────────────────────────────

const renderPhotos = (pd: PlaceDetails | null) => {
    const hasGooglePhotos = pd?.photoUrls && pd.photoUrls.length > 0;
    if (!hasGooglePhotos) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 14, marginTop: 4 }}
            contentContainerStyle={{ gap: 10 }}
        >
            {pd!.photoUrls.map((url, i) => (
                <Image
                    key={i}
                    source={{ uri: url }}
                    style={{ width: 150, height: 110, borderRadius: 12, backgroundColor: '#eee' }}
                    resizeMode="cover"
                />
            ))}
        </ScrollView>
    );
};

export default BarCard;
