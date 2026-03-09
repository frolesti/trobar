import React, { useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, Image, ScrollView, Linking,
    Animated, Dimensions, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SKETCH_THEME, sketchShadow } from '../theme/sketchTheme';
import { Bar } from '../models/Bar';
import { PlaceDetails } from '../services/placesService';

// ── Tipus ──────────────────────────────────────────────

interface BarProfileModalProps {
    visible: boolean;
    bar: Bar | null;
    placeDetails: PlaceDetails | null;
    onClose: () => void;
    onNavigate?: () => void;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Component ──────────────────────────────────────────

const BarProfileModal: React.FC<BarProfileModalProps> = ({
    visible, bar, placeDetails: pd, onClose, onNavigate,
}) => {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    damping: 22,
                    stiffness: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: SCREEN_HEIGHT,
                    duration: 280,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!visible && !bar) return null;

    const displayName = pd?.displayName || bar?.name || '';
    const displayAddress = pd?.formattedAddress || bar?.address || 'Barcelona';
    const displayRating = pd?.rating ?? bar?.rating ?? 0;
    const ratingCount = pd?.userRatingCount;
    const openStatus = pd?.currentOpeningHours?.openNow ?? bar?.isOpen;
    const photos = pd?.photoUrls ?? [];

    const openGoogleMaps = () => {
        if (bar) {
            const query = encodeURIComponent(`${bar.name}, ${displayAddress}`);
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
        }
    };

    return (
        <Animated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 10000,
                opacity,
            }}
        >
            {/* Fons */}
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                }}
            />

            {/* Panell lliscant */}
            <Animated.View
                style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: SCREEN_HEIGHT * 0.92,
                    backgroundColor: 'white',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    transform: [{ translateY }],
                    ...Platform.select({
                        web: { boxShadow: '0px -6px 40px rgba(0,0,0,0.2)' } as any,
                        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.2, shadowRadius: 20 },
                        android: { elevation: 24 },
                    }),
                }}
            >
                {/* Indicador d'arrossegament */}
                <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc' }} />
                </View>

                {/* Botó de tancar */}
                <TouchableOpacity
                    onPress={onClose}
                    style={{
                        position: 'absolute', top: 14, right: 16, zIndex: 10,
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Feather name="x" size={20} color={SKETCH_THEME.colors.text} />
                </TouchableOpacity>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* ── FOTOS PRINCIPALS ── */}
                    {photos.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ marginBottom: 20, marginHorizontal: -20, marginTop: 4 }}
                            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
                        >
                            {photos.map((url, i) => (
                                <Image
                                    key={i}
                                    source={{ uri: url }}
                                    style={{
                                        width: Math.min(300, SCREEN_WIDTH * 0.7),
                                        height: 200,
                                        borderRadius: 16,
                                        backgroundColor: '#eee',
                                    }}
                                    resizeMode="cover"
                                />
                            ))}
                        </ScrollView>
                    )}

                    {/* ── NOM + INSÍGNIA PREMIUM ── */}
                    <View style={{ marginBottom: 6 }}>
                        <Text style={{
                            fontSize: 26, fontWeight: 'bold', color: SKETCH_THEME.colors.text,
                            fontFamily: 'Lora', lineHeight: 32,
                        }}>
                            {displayName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <View style={{
                                backgroundColor: SKETCH_THEME.colors.primary,
                                paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
                                flexDirection: 'row', alignItems: 'center',
                            }}>
                                <Feather name="star" size={11} color="white" style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: 'white', fontFamily: 'Lora', letterSpacing: 0.4 }}>
                                    PREMIUM
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* ── PUNTUACIÓ + OBERT/TANCAT ── */}
                    {displayRating > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 10, gap: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Feather name="star" size={16} color="#FFA000" style={{ marginRight: 4 }} />
                                <Text style={{ fontWeight: 'bold', fontSize: 16, color: SKETCH_THEME.colors.text, fontFamily: 'Lora' }}>
                                    {displayRating.toFixed(1)}
                                </Text>
                                {ratingCount != null && (
                                    <Text style={{ fontSize: 13, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora', marginLeft: 4 }}>
                                        ({ratingCount} ressenyes)
                                    </Text>
                                )}
                            </View>
                            {openStatus != null && (
                                <Text style={{
                                    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14, fontSize: 13,
                                    fontFamily: 'Lora', fontWeight: '600', overflow: 'hidden',
                                    ...(openStatus
                                        ? { backgroundColor: '#E8F5E9', color: '#2E7D32' }
                                        : { backgroundColor: '#FFEBEE', color: '#C62828' }),
                                }}>
                                    {openStatus ? 'Obert ara' : 'Tancat'}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* ── SEPARADOR ── */}
                    <View style={{ height: 1, backgroundColor: SKETCH_THEME.colors.border, marginVertical: 6 }} />

                    {/* ── SECCIÓ D'INFORMACIÓ ── */}
                    <View style={{ marginTop: 14 }}>
                        <Text style={sectionTitle}>Informació</Text>

                        {/* Adreça */}
                        <TouchableOpacity onPress={openGoogleMaps} style={infoRow}>
                            <Feather name="map-pin" size={17} color={SKETCH_THEME.colors.primary} style={{ marginRight: 10 }} />
                            <Text style={[infoText, { textDecorationLine: 'underline' }]}>{displayAddress}</Text>
                        </TouchableOpacity>

                        {/* Telèfon */}
                        {pd?.phoneNumber && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(`tel:${pd.phoneNumber}`)}
                                style={infoRow}
                            >
                                <Feather name="phone" size={17} color={SKETCH_THEME.colors.primary} style={{ marginRight: 10 }} />
                                <Text style={infoText}>{pd.phoneNumber}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Lloc web */}
                        {pd?.websiteUri && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(pd.websiteUri!)}
                                style={infoRow}
                            >
                                <Feather name="globe" size={17} color={SKETCH_THEME.colors.primary} style={{ marginRight: 10 }} />
                                <Text numberOfLines={1} style={[infoText, { flex: 1 }]}>
                                    {pd.websiteUri.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* Google Maps */}
                        {pd?.googleMapsUri && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(pd.googleMapsUri!)}
                                style={infoRow}
                            >
                                <Feather name="map" size={17} color="#E53935" style={{ marginRight: 10 }} />
                                <Text style={[infoText, { color: '#E53935' }]}>Veure a Google Maps</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ── HORARI D'OBERTURA ── */}
                    {pd?.currentOpeningHours?.weekdayDescriptions && pd.currentOpeningHours.weekdayDescriptions.length > 0 && (
                        <View style={{ marginTop: 20 }}>
                            <Text style={sectionTitle}>Horaris</Text>
                            {pd.currentOpeningHours.weekdayDescriptions.map((line, i) => (
                                <Text key={i} style={{
                                    fontSize: 14, color: SKETCH_THEME.colors.textMuted,
                                    fontFamily: 'Lora', marginBottom: 4, lineHeight: 20,
                                }}>
                                    {line}
                                </Text>
                            ))}
                        </View>
                    )}

                    {/* ── SECCIÓ D'EMISSIONS (marcador de posició) ── */}
                    <View style={{ marginTop: 24 }}>
                        <Text style={sectionTitle}>Partits que emet</Text>
                        <View style={{
                            backgroundColor: '#f8f8f8', borderRadius: 14,
                            padding: 20, alignItems: 'center',
                        }}>
                            <Feather name="tv" size={28} color={SKETCH_THEME.colors.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                            <Text style={{
                                fontSize: 14, color: SKETCH_THEME.colors.textMuted,
                                fontFamily: 'Lora', textAlign: 'center', lineHeight: 20,
                            }}>
                                Properament podràs veure els partits que aquest bar ha confirmat que emetrà.
                            </Text>
                        </View>
                    </View>

                    {/* ── MENÚ / CARTA (marcador de posició) ── */}
                    <View style={{ marginTop: 24 }}>
                        <Text style={sectionTitle}>Carta</Text>
                        <View style={{
                            backgroundColor: '#f8f8f8', borderRadius: 14,
                            padding: 20, alignItems: 'center',
                        }}>
                            <Feather name="book-open" size={28} color={SKETCH_THEME.colors.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                            <Text style={{
                                fontSize: 14, color: SKETCH_THEME.colors.textMuted,
                                fontFamily: 'Lora', textAlign: 'center', lineHeight: 20,
                            }}>
                                La carta d'aquest bar estarà disponible aviat.
                            </Text>
                        </View>
                    </View>

                    {/* ── XARXES SOCIALS (marcador de posició) ── */}
                    <View style={{ marginTop: 24 }}>
                        <Text style={sectionTitle}>Xarxes socials</Text>
                        <View style={{
                            backgroundColor: '#f8f8f8', borderRadius: 14,
                            padding: 20, alignItems: 'center',
                        }}>
                            <Feather name="share-2" size={28} color={SKETCH_THEME.colors.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                            <Text style={{
                                fontSize: 14, color: SKETCH_THEME.colors.textMuted,
                                fontFamily: 'Lora', textAlign: 'center', lineHeight: 20,
                            }}>
                                Les xarxes socials d'aquest bar apareixeran aquí.
                            </Text>
                        </View>
                    </View>

                    {/* ── BOTÓ DE NAVEGACIÓ ── */}
                    <TouchableOpacity
                        style={{
                            backgroundColor: SKETCH_THEME.colors.primary, borderRadius: 14,
                            paddingVertical: 16, paddingHorizontal: 20, marginTop: 30,
                            alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                            ...sketchShadow(),
                        }}
                        onPress={onNavigate}
                    >
                        <Feather name="navigation" size={20} color="white" style={{ marginRight: 10 }} />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 17, fontFamily: 'Lora' }}>
                            Com arribar-hi
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </Animated.View>
        </Animated.View>
    );
};

// ── Estils compartits ──────────────────────────────────────

const sectionTitle = {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: SKETCH_THEME.colors.text,
    fontFamily: 'Lora',
    marginBottom: 12,
};

const infoRow = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
};

const infoText = {
    fontSize: 15,
    color: SKETCH_THEME.colors.text,
    fontFamily: 'Lora',
    lineHeight: 21,
};

export default BarProfileModal;
