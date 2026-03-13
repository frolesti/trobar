import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, Image, ScrollView, Linking,
    Animated, Dimensions, Platform, Modal, TextInput, Alert,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SKETCH_THEME, sketchShadow } from '../theme/sketchTheme';
import { Bar, BarAmenity } from '../models/Bar';
import { PlaceDetails, isOpenNow } from '../services/placesService';
import { Match } from '../services/matchService';
import { Review, BarReviewStats } from '../models/Review';
import { fetchReviews, addReview, deleteReview, getBarReviewStats, getUserReview } from '../services/reviewService';
import { updateBarAmenities } from '../services/barService';
import { AMENITY_OPTIONS, AMENITY_MAP, AMENITY_CATEGORIES, AmenityOption } from '../data/amenities';
import { useAuth } from '../context/AuthContext';
import MatchCard from './MatchCard';

// ── Tipus ──────────────────────────────────────────────

interface BarProfileModalProps {
    visible: boolean;
    bar: Bar | null;
    placeDetails: PlaceDetails | null;
    /** Tots els partits disponibles (el component filtra per broadcastingMatches) */
    allMatches?: Match[];
    onClose: () => void;
    onNavigate?: () => void;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Colors del tema premium (igual que la BarCard premium)
const P = {
    bg: SKETCH_THEME.colors.accent,                // Grana Barça
    text: 'white',
    textMuted: 'rgba(255,255,255,0.75)',
    accent: '#edbb00',                              // Or Barça
    separator: 'rgba(255,255,255,0.18)',
    cardBg: 'rgba(255,255,255,0.12)',
    badgeOpen: { bg: 'rgba(255,255,255,0.15)', text: '#A5D6A7', border: 'rgba(255,255,255,0.25)' },
    badgeClosed: { bg: 'rgba(255,255,255,0.1)', text: '#EF9A9A', border: 'rgba(255,255,255,0.2)' },
};

// Mapa de xarxes socials a icones i URLs
const SOCIAL_CONFIG: Record<string, { icon: string; family: 'feather' | 'mci'; urlPrefix: string }> = {
    instagram: { icon: 'instagram', family: 'feather', urlPrefix: 'https://instagram.com/' },
    facebook:  { icon: 'facebook',  family: 'feather', urlPrefix: 'https://facebook.com/' },
    whatsapp:  { icon: 'whatsapp',  family: 'mci',     urlPrefix: 'https://wa.me/' },
    telegram:  { icon: 'telegram',  family: 'mci',     urlPrefix: 'https://t.me/' },
};

// ── Component ──────────────────────────────────────────

const BarProfileModal: React.FC<BarProfileModalProps> = ({
    visible, bar, placeDetails: pd, allMatches = [], onClose, onNavigate,
}) => {
    const { user } = useAuth();
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const [showHours, setShowHours] = useState(false);

    // ── Estat de ressenyes internes ──
    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewStats, setReviewStats] = useState<BarReviewStats>({ averageRating: 0, totalReviews: 0 });
    const [myReview, setMyReview] = useState<Review | null>(null);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [newRating, setNewRating] = useState(5);
    const [newComment, setNewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    // ── Estat d'amenities editables ──
    const [editingAmenities, setEditingAmenities] = useState(false);
    const [selectedAmenities, setSelectedAmenities] = useState<Set<BarAmenity>>(new Set());
    const [savingAmenities, setSavingAmenities] = useState(false);

    // Carregar ressenyes quan s'obre el modal
    const loadReviews = useCallback(async () => {
        if (!bar?.id) return;
        try {
            const [revs, stats] = await Promise.all([
                fetchReviews(bar.id),
                getBarReviewStats(bar.id),
            ]);
            setReviews(revs);
            setReviewStats(stats);
            if (user) {
                const mine = revs.find(r => r.userId === user.id) || null;
                setMyReview(mine);
            }
        } catch (e) {
            console.error('Error loading reviews:', e);
        }
    }, [bar?.id, user]);

    useEffect(() => {
        if (visible && bar) {
            loadReviews();
            setShowReviewForm(false);
            setNewRating(5);
            setNewComment('');
            setEditingAmenities(false);
            setSelectedAmenities(new Set(bar.amenities ?? []));
        }
    }, [visible, bar?.id]);

    const handleSubmitReview = async () => {
        if (!bar || !user) return;
        setSubmittingReview(true);
        try {
            await addReview(bar.id, user.id, user.name || 'Anònim', user.avatar, newRating, newComment);
            setShowReviewForm(false);
            setNewComment('');
            setNewRating(5);
            await loadReviews();
        } catch (e) {
            console.error('Error submitting review:', e);
            Alert.alert('Error', "No s'ha pogut publicar la ressenya.");
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleDeleteReview = async (reviewId: string) => {
        if (!bar) return;
        try {
            await deleteReview(bar.id, reviewId);
            await loadReviews();
        } catch (e) {
            console.error('Error deleting review:', e);
        }
    };

    // ── Guardar amenities ──
    const handleSaveAmenities = async () => {
        if (!bar) return;
        setSavingAmenities(true);
        try {
            const arr = Array.from(selectedAmenities) as BarAmenity[];
            await updateBarAmenities(bar.id, arr);
            bar.amenities = arr;          // actualitzar in-memory
            setEditingAmenities(false);
        } catch (e) {
            console.error('Error saving amenities:', e);
            Alert.alert('Error', "No s'han pogut desar els serveis.");
        } finally {
            setSavingAmenities(false);
        }
    };

    const toggleAmenity = (key: BarAmenity) => {
        setSelectedAmenities(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    useEffect(() => {
        if (visible) {
            setShowHours(false);
            Animated.spring(translateY, {
                toValue: 0,
                damping: 22,
                stiffness: 200,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(translateY, {
                toValue: SCREEN_HEIGHT,
                duration: 280,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    if (!visible && !bar) return null;

    const displayName = bar?.name || pd?.displayName || '';
    const displayAddress = pd?.formattedAddress || bar?.address || 'Barcelona';
    const openStatus = pd?.currentOpeningHours?.openNow ?? isOpenNow(bar?.openingPeriods) ?? bar?.isOpen;
    const photos = pd?.photoUrls ?? [];
    const hours = pd?.currentOpeningHours?.weekdayDescriptions ?? [];
    const social = bar?.socialMedia;
    const hasSocial = social && Object.values(social).some(v => !!v);

    // Partits que el bar emet (filtrats des de la llista completa)
    const broadcastMatches = bar?.broadcastingMatches && bar.broadcastingMatches.length > 0
        ? allMatches.filter(m => bar.broadcastingMatches!.includes(m.id))
        : [];

    // Contingut interior del modal
    const modalContent = (
        <View style={{ flex: 1 }}>
            {/* Fons semitransparent per tancar */}
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
            />

            {/* Panell lliscant — fons verd premium */}
            <Animated.View
                style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: SCREEN_HEIGHT * 0.92,
                    backgroundColor: P.bg,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    transform: [{ translateY }],
                    ...Platform.select({
                        web: { boxShadow: '0px -6px 40px rgba(0,0,0,0.3)' } as any,
                        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.3, shadowRadius: 20 },
                        android: { elevation: 24 },
                    }),
                }}
            >
                {/* Indicador d'arrossegament */}
                <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                </View>

                {/* Botó de tancar */}
                <TouchableOpacity
                    onPress={onClose}
                    style={{
                        position: 'absolute', top: 14, right: 16, zIndex: 10,
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Feather name="x" size={20} color="white" />
                </TouchableOpacity>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }}
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
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                    }}
                                    resizeMode="cover"
                                />
                            ))}
                        </ScrollView>
                    )}

                    {/* ── NOM + INSÍGNIA PREMIUM ── */}
                    <View style={{ marginBottom: 6 }}>
                        <Text style={{
                            fontSize: 26, fontWeight: 'bold', color: P.text,
                            fontFamily: 'Lora', lineHeight: 32,
                        }}>
                            {displayName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <View style={{
                                backgroundColor: P.accent,
                                paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
                                flexDirection: 'row', alignItems: 'center',
                            }}>
                                <Feather name="star" size={11} color={P.bg} style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: P.bg, fontFamily: 'Lora', letterSpacing: 0.4 }}>
                                    PREMIUM
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* ── PUNTUACIÓ INTERNA + OBERT/TANCAT ── */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 10, gap: 12, flexWrap: 'wrap' }}>
                        {reviewStats.totalReviews > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {[1,2,3,4,5].map(s => (
                                    <MaterialCommunityIcons key={s} name="star" size={16} color={s <= Math.round(reviewStats.averageRating) ? '#edbb00' : 'rgba(255,255,255,0.25)'} style={{ marginRight: 1 }} />
                                ))}
                                <Text style={{ fontWeight: 'bold', fontSize: 15, color: P.text, fontFamily: 'Lora', marginLeft: 6 }}>
                                    {reviewStats.averageRating.toFixed(1)}
                                </Text>
                                <Text style={{ fontSize: 13, color: P.textMuted, fontFamily: 'Lora', marginLeft: 4 }}>
                                    ({reviewStats.totalReviews} {reviewStats.totalReviews === 1 ? 'ressenya' : 'ressenyes'})
                                </Text>
                            </View>
                        )}
                        {openStatus != null && (
                                <Text style={{
                                    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14, fontSize: 13,
                                    fontFamily: 'Lora', fontWeight: '600', overflow: 'hidden', borderWidth: 1,
                                    ...(openStatus
                                        ? { backgroundColor: P.badgeOpen.bg, color: P.badgeOpen.text, borderColor: P.badgeOpen.border }
                                        : { backgroundColor: P.badgeClosed.bg, color: P.badgeClosed.text, borderColor: P.badgeClosed.border }),
                                }}>
                                    {openStatus ? 'Obert ara' : 'Tancat'}
                                </Text>
                            )}
                        </View>

                    {/* ── SEPARADOR ── */}
                    <View style={{ height: 1, backgroundColor: P.separator, marginVertical: 6 }} />

                    {/* ── SECCIÓ D'INFORMACIÓ ── */}
                    <View style={{ marginTop: 14 }}>
                        <Text style={sectionTitleStyle}>Informació</Text>

                        {/* Adreça (text pla, sense link) */}
                        <View style={infoRowStyle}>
                            <Feather name="map-pin" size={17} color={P.accent} style={{ marginRight: 10 }} />
                            <Text style={[infoTextStyle, { flex: 1 }]}>{displayAddress}</Text>
                        </View>

                        {/* Telèfon */}
                        {pd?.phoneNumber && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(`tel:${pd.phoneNumber}`)}
                                style={infoRowStyle}
                            >
                                <Feather name="phone" size={17} color={P.accent} style={{ marginRight: 10 }} />
                                <Text style={infoTextStyle}>{pd.phoneNumber}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Lloc web */}
                        {pd?.websiteUri && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(pd.websiteUri!)}
                                style={infoRowStyle}
                            >
                                <Feather name="globe" size={17} color={P.accent} style={{ marginRight: 10 }} />
                                <Text numberOfLines={1} style={[infoTextStyle, { flex: 1 }]}>
                                    {pd.websiteUri.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ── AMENITIES / SERVEIS ── */}
                    {(() => {
                        const isOwner = !!(user && bar?.ownerId && user.id === bar.ownerId);
                        const amenities = bar?.amenities ?? [];
                        const hasAmenities = amenities.length > 0;

                        if (!hasAmenities && !isOwner && !editingAmenities) return null;

                        return (
                            <View style={{ marginTop: 20 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={sectionTitleStyle}>Serveis</Text>
                                    {isOwner && !editingAmenities && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedAmenities(new Set(amenities));
                                                setEditingAmenities(true);
                                            }}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Feather name="edit-2" size={16} color={P.accent} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {editingAmenities ? (
                                    /* ── Mode edició: totes les amenities agrupades per categoria ── */
                                    <View style={{ marginTop: 10 }}>
                                        {AMENITY_CATEGORIES.map(cat => (
                                            <View key={cat.key} style={{ marginBottom: 14 }}>
                                                <Text style={{
                                                    fontSize: 13, fontFamily: 'Lora', color: P.textMuted,
                                                    marginBottom: 6, textTransform: 'capitalize',
                                                }}>
                                                    {cat.label}
                                                </Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                    {AMENITY_OPTIONS.filter(a => a.category === cat.key).map(opt => {
                                                        const active = selectedAmenities.has(opt.key);
                                                        const IconComp = opt.iconFamily === 'mci' ? MaterialCommunityIcons : Feather;
                                                        return (
                                                            <TouchableOpacity
                                                                key={opt.key}
                                                                onPress={() => toggleAmenity(opt.key)}
                                                                style={{
                                                                    flexDirection: 'row', alignItems: 'center',
                                                                    backgroundColor: active ? 'rgba(237,187,0,0.25)' : 'rgba(255,255,255,0.08)',
                                                                    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
                                                                    borderWidth: 1,
                                                                    borderColor: active ? P.accent : 'rgba(255,255,255,0.15)',
                                                                }}
                                                                activeOpacity={0.7}
                                                            >
                                                                <IconComp name={opt.icon as any} size={14} color={active ? P.accent : P.textMuted} />
                                                                <Text style={{
                                                                    marginLeft: 6, fontSize: 13, fontFamily: 'Lora',
                                                                    color: active ? P.accent : P.textMuted,
                                                                }}>
                                                                    {opt.label}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        ))}

                                        {/* Botons desar / cancel·lar */}
                                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                            <TouchableOpacity
                                                onPress={handleSaveAmenities}
                                                disabled={savingAmenities}
                                                style={{
                                                    flex: 1, backgroundColor: P.accent, borderRadius: 10,
                                                    paddingVertical: 10, alignItems: 'center',
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={{ fontSize: 14, fontFamily: 'Lora', fontWeight: '700', color: '#1A1A2E' }}>
                                                    {savingAmenities ? 'Desant…' : 'Desar'}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => setEditingAmenities(false)}
                                                style={{
                                                    flex: 1, borderRadius: 10, paddingVertical: 10,
                                                    alignItems: 'center', borderWidth: 1, borderColor: P.separator,
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={{ fontSize: 14, fontFamily: 'Lora', color: P.textMuted }}>Cancel·la</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : hasAmenities ? (
                                    /* ── Mode lectura: xips de les amenities actives ── */
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                                        {amenities.map(key => {
                                            const opt = AMENITY_MAP.get(key);
                                            if (!opt) return null;
                                            const IconComp = opt.iconFamily === 'mci' ? MaterialCommunityIcons : Feather;
                                            return (
                                                <View
                                                    key={key}
                                                    style={{
                                                        flexDirection: 'row', alignItems: 'center',
                                                        backgroundColor: 'rgba(255,255,255,0.08)',
                                                        borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
                                                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                                                    }}
                                                >
                                                    <IconComp name={opt.icon as any} size={14} color={P.accent} />
                                                    <Text style={{
                                                        marginLeft: 6, fontSize: 13, fontFamily: 'Lora', color: P.text,
                                                    }}>
                                                        {opt.label}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ) : isOwner ? (
                                    /* ── Propietari sense amenities configurades ── */
                                    <TouchableOpacity
                                        onPress={() => { setSelectedAmenities(new Set()); setEditingAmenities(true); }}
                                        style={{
                                            marginTop: 10, flexDirection: 'row', alignItems: 'center',
                                            backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Feather name="plus-circle" size={16} color={P.accent} style={{ marginRight: 8 }} />
                                        <Text style={{ fontSize: 13, fontFamily: 'Lora', color: P.accent }}>
                                            Afegeix els serveis del teu bar
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        );
                    })()}

                    {/* ── HORARIS (desplegables) ── */}
                    {hours.length > 0 && (() => {
                        // Dia actual (Google Places weekdayDescriptions: índex 0 = dilluns … 6 = diumenge)
                        const jsDay = new Date().getDay(); // 0=dg, 1=dl … 6=ds
                        const todayIdx = jsDay === 0 ? 6 : jsDay - 1; // 0=dl … 6=dg
                        const todayLine = hours[todayIdx] ?? hours[0];
                        return (
                        <View style={{ marginTop: 20 }}>
                            <TouchableOpacity
                                onPress={() => setShowHours(h => !h)}
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                activeOpacity={0.7}
                            >
                                <Text style={sectionTitleStyle}>Horaris</Text>
                                <Feather
                                    name={showHours ? 'chevron-up' : 'chevron-down'}
                                    size={20}
                                    color={P.textMuted}
                                />
                            </TouchableOpacity>
                            {showHours && (
                                <View style={{ marginTop: 8 }}>
                                    {user ? (
                                        hours.map((line, i) => (
                                            <Text key={i} style={{
                                                fontSize: 14, color: P.textMuted,
                                                fontFamily: 'Lora', marginBottom: 4, lineHeight: 20,
                                            }}>
                                                {line}
                                            </Text>
                                        ))
                                    ) : (
                                        <>
                                            <Text style={{
                                                fontSize: 14, color: P.textMuted,
                                                fontFamily: 'Lora', marginBottom: 4, lineHeight: 20,
                                            }}>
                                                {todayLine}
                                            </Text>
                                            <View style={{
                                                flexDirection: 'row', alignItems: 'center', marginTop: 8,
                                                backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10,
                                            }}>
                                                <Feather name="lock" size={14} color={P.accent} style={{ marginRight: 8 }} />
                                                <Text style={{ fontSize: 13, color: P.accent, fontFamily: 'Lora', flex: 1 }}>
                                                    Inicia sessió per veure tots els horaris
                                                </Text>
                                            </View>
                                        </>
                                    )}
                                </View>
                            )}
                        </View>
                        );
                    })()}

                    {/* ── DESCRIPCIÓ DEL BAR ── */}
                    {bar?.description ? (
                        <View style={{ marginTop: 24 }}>
                            <Text style={sectionTitleStyle}>Sobre nosaltres</Text>
                            <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: 'Lora', lineHeight: 22 }}>
                                {bar.description}
                            </Text>
                        </View>
                    ) : null}

                    {/* ── TEXT PROMOCIONAL ── */}
                    {bar?.promotionalText ? (
                        <View style={{
                            marginTop: 20, backgroundColor: 'rgba(255,215,0,0.15)',
                            borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                <Feather name="zap" size={16} color={P.accent} style={{ marginRight: 6 }} />
                                <Text style={{ fontSize: 14, fontWeight: '700', color: P.accent, fontFamily: 'Lora' }}>Promoció</Text>
                            </View>
                            <Text style={{ fontSize: 14, color: P.text, fontFamily: 'Lora', lineHeight: 20 }}>
                                {bar.promotionalText}
                            </Text>
                        </View>
                    ) : null}

                    {/* ── PARTITS QUE EMET ── */}
                    <View style={{ marginTop: 24 }}>
                        <Text style={sectionTitleStyle}>Partits que emet</Text>
                        {broadcastMatches.length > 0 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginHorizontal: -20 }}
                                contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
                            >
                                {broadcastMatches.map(match => (
                                    <View key={match.id} style={{ width: Math.min(260, SCREEN_WIDTH * 0.65) }}>
                                        <MatchCard match={match} compact />
                                    </View>
                                ))}
                            </ScrollView>
                        ) : bar?.usuallyShowsBarca ? (
                            <View style={{ backgroundColor: P.cardBg, borderRadius: 14, padding: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Feather name="tv" size={18} color={P.accent} style={{ marginRight: 8 }} />
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: P.text, fontFamily: 'Lora' }}>
                                        Normalment emet el Barça
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 13, color: P.textMuted, fontFamily: 'Lora', lineHeight: 19 }}>
                                    Segons els usuaris, aquest bar sol emetre els partits del FC Barcelona.
                                </Text>
                            </View>
                        ) : (
                            <View style={{ backgroundColor: P.cardBg, borderRadius: 14, padding: 20, alignItems: 'center' }}>
                                <Feather name="tv" size={28} color={P.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: 'Lora', textAlign: 'center', lineHeight: 20 }}>
                                    Properament podràs veure els partits que aquest bar ha confirmat que emetrà.
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ── XARXES SOCIALS ── */}
                    <View style={{ marginTop: 24 }}>
                        <Text style={sectionTitleStyle}>Xarxes socials</Text>
                        {hasSocial ? (
                            <View style={{ gap: 10 }}>
                                {Object.entries(SOCIAL_CONFIG).map(([key, config]) => {
                                    const value = social?.[key as keyof typeof social];
                                    if (!value) return null;
                                    const url = value.startsWith('http') ? value : `${config.urlPrefix}${value}`;
                                    const displayHandle = value.replace(/^https?:\/\/(www\.)?[^/]+\/?/, '').replace(/\/$/, '') || value;
                                    return (
                                        <TouchableOpacity
                                            key={key}
                                            onPress={() => Linking.openURL(url)}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center',
                                                backgroundColor: P.cardBg,
                                                paddingVertical: 10, paddingHorizontal: 14,
                                                borderRadius: 14, gap: 10,
                                            }}
                                        >
                                            {config.family === 'mci' ? (
                                                <MaterialCommunityIcons name={config.icon as any} size={22} color={P.text} />
                                            ) : (
                                                <Feather name={config.icon as any} size={20} color={P.text} />
                                            )}
                                            <Text style={{ color: P.text, fontSize: 14, fontFamily: 'Lora', fontWeight: '600', flex: 1 }}>
                                                {displayHandle}
                                            </Text>
                                            <Feather name="external-link" size={14} color={P.textMuted} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={{ backgroundColor: P.cardBg, borderRadius: 14, padding: 20, alignItems: 'center' }}>
                                <Feather name="share-2" size={28} color={P.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: 'Lora', textAlign: 'center', lineHeight: 20 }}>
                                    Les xarxes socials d'aquest bar apareixeran aquí.
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ── MUR DE RESSENYES (INTERN) ── */}
                    <View style={{ marginTop: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <Text style={sectionTitleStyle}>Ressenyes</Text>
                            {user && !myReview && !showReviewForm && (
                                <TouchableOpacity
                                    onPress={() => setShowReviewForm(true)}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        backgroundColor: P.accent, paddingHorizontal: 12, paddingVertical: 6,
                                        borderRadius: 14,
                                    }}
                                >
                                    <Feather name="edit-3" size={13} color={P.bg} style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: P.bg, fontFamily: 'Lora' }}>Escriure</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Formulari de nova ressenya */}
                        {showReviewForm && (
                            <View style={{
                                backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14,
                                padding: 16, marginBottom: 16,
                            }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: P.text, fontFamily: 'Lora', marginBottom: 10 }}>
                                    La teva valoració
                                </Text>
                                {/* Selector d'estrelles */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 }}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <TouchableOpacity key={s} onPress={() => setNewRating(s)}>
                                            <MaterialCommunityIcons
                                                name="star"
                                                size={28}
                                                color={s <= newRating ? '#edbb00' : 'rgba(255,255,255,0.25)'}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {/* Camp de comentari */}
                                <Text style={{ fontSize: 13, color: P.textMuted, fontFamily: 'Lora', marginBottom: 8 }}>Comentari (opcional)</Text>
                                <TextInput
                                    placeholder="Què t'ha semblat aquest bar?"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    value={newComment}
                                    onChangeText={setNewComment}
                                    multiline
                                    numberOfLines={3}
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.08)',
                                        borderRadius: 10, padding: 12,
                                        color: P.text, fontFamily: 'Lora', fontSize: 14,
                                        minHeight: 70, textAlignVertical: 'top',
                                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                                    }}
                                />
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => { setShowReviewForm(false); setNewComment(''); setNewRating(5); }}
                                        style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                                    >
                                        <Text style={{ color: P.textMuted, fontFamily: 'Lora', fontSize: 14 }}>Cancel·lar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleSubmitReview}
                                        disabled={submittingReview || newRating === 0}
                                        style={{
                                            backgroundColor: P.accent, borderRadius: 10,
                                            paddingHorizontal: 18, paddingVertical: 8,
                                            opacity: (submittingReview || newRating === 0) ? 0.5 : 1,
                                        }}
                                    >
                                        <Text style={{ color: P.bg, fontWeight: 'bold', fontFamily: 'Lora', fontSize: 14 }}>
                                            {submittingReview ? 'Enviant...' : 'Publicar'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Llista de ressenyes */}
                        {reviews.length > 0 ? (
                            <View style={{ gap: 12 }}>
                                {reviews.map(review => (
                                    <View key={review.id} style={{
                                        backgroundColor: P.cardBg, borderRadius: 14, padding: 14,
                                    }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                            {review.userAvatar ? (
                                                <Image
                                                    source={{ uri: review.userAvatar }}
                                                    style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}
                                                />
                                            ) : (
                                                <View style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Feather name="user" size={16} color={P.textMuted} />
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '600', color: P.text, fontFamily: 'Lora' }}>
                                                    {review.userName}
                                                </Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <MaterialCommunityIcons key={s} name="star" size={12} color={s <= review.rating ? '#edbb00' : 'rgba(255,255,255,0.2)'} style={{ marginRight: 1 }} />
                                                    ))}
                                                    <Text style={{ fontSize: 11, color: P.textMuted, fontFamily: 'Lora', marginLeft: 6 }}>
                                                        {review.createdAt.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </Text>
                                                </View>
                                            </View>
                                            {/* Botó d'eliminar la ressenya pròpia */}
                                            {user && review.userId === user.id && (
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteReview(review.id)}
                                                    style={{ padding: 6 }}
                                                >
                                                    <Feather name="trash-2" size={14} color={P.textMuted} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        {review.comment ? (
                                            <Text style={{ fontSize: 14, color: P.text, fontFamily: 'Lora', lineHeight: 20 }}>
                                                {review.comment}
                                            </Text>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={{ backgroundColor: P.cardBg, borderRadius: 14, padding: 20, alignItems: 'center' }}>
                                <Feather name="message-circle" size={28} color={P.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: 'Lora', textAlign: 'center', lineHeight: 20 }}>
                                    Encara no hi ha ressenyes. Sigues el primer a opinar!
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ── BOTÓ DE NAVEGACIÓ ── */}
                    <TouchableOpacity
                        style={{
                            backgroundColor: 'white', borderRadius: 14,
                            paddingVertical: 16, paddingHorizontal: 20, marginTop: 30,
                            alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                            ...sketchShadow(),
                        }}
                        onPress={onNavigate}
                    >
                        <Feather name="navigation" size={20} color={P.bg} style={{ marginRight: 10 }} />
                        <Text style={{ color: P.bg, fontWeight: 'bold', fontSize: 17, fontFamily: 'Lora' }}>
                            Com arribar-hi
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </Animated.View>
        </View>
    );

    // Usar Modal natiu per bloquejar completament la interacció amb el mapa
    if (Platform.OS === 'web') {
        // Web: Portal absolut (Modal no funciona bé a web amb MapLibre)
        return (
            <View
                pointerEvents={visible ? 'auto' : 'none'}
                style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 10000,
                }}
            >
                {visible && modalContent}
            </View>
        );
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            {modalContent}
        </Modal>
    );
};

// ── Estils compartits ──────────────────────────────────────

const sectionTitleStyle = {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: P.text,
    fontFamily: 'Lora',
    marginBottom: 12,
};

const infoRowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
};

const infoTextStyle = {
    fontSize: 15,
    color: P.text,
    fontFamily: 'Lora',
    lineHeight: 21,
};

export default BarProfileModal;
