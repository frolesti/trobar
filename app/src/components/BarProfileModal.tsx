import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, TouchableOpacity, Image, ScrollView, Linking, Animated, useWindowDimensions, Platform, Modal, TextInput, Alert } from 'react-native';
import Text from './AppText';
import AppIcon from './AppIcon';
import { SKETCH_THEME, sketchShadow } from '../theme/sketchTheme';
import { EDITORIAL } from '../theme/editorialTheme';
import { showAlert } from './AlertBanner';
import { Bar, BarAmenity } from '../models/Bar';
import { PlaceDetails, isOpenNow } from '../services/placesService';
import { Match } from '../services/matchService';
import { Review, BarReviewStats } from '../models/Review';
import { fetchReviews, addReview, deleteReview, getBarReviewStats, getUserReview } from '../services/reviewService';
import { updateBarAmenities } from '../services/barService';
import { AMENITY_OPTIONS, AMENITY_MAP, AMENITY_CATEGORIES, AmenityOption } from '../data/amenities';
import { useAuth } from '../context/AuthContext';
import { subscribeToBar, unsubscribeFromBar, isSubscribedToBar } from '../services/barOwnerService';
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

const P = {
    bg: EDITORIAL.background,
    text: EDITORIAL.onBackground,
    textMuted: EDITORIAL.onBackgroundMuted,
    accent: EDITORIAL.onBackground,
    buttonText: EDITORIAL.background,
    separator: EDITORIAL.borderOnBackground,
    cardBg: 'rgba(255,255,255,0.06)',
    subtleBg: 'rgba(255,255,255,0.08)',
    selectedBg: 'rgba(255,255,255,0.16)',
    badgeOpen:   { bg: 'rgba(255,255,255,0.16)', text: EDITORIAL.onBackground, border: EDITORIAL.borderOnBackground },
    badgeClosed: { bg: 'rgba(255,255,255,0.06)', text: EDITORIAL.onBackgroundMuted, border: EDITORIAL.borderOnBackground },
};

// Mapa de xarxes socials a icones i URLs
const SOCIAL_CONFIG: Record<string, { icon: string; family: 'feather' | 'mci'; urlPrefix: string }> = {
    instagram: { icon: 'instagram', family: 'feather', urlPrefix: 'https://instagram.com/' },
    facebook:  { icon: 'facebook',  family: 'feather', urlPrefix: 'https://facebook.com/' },
    twitter:   { icon: 'twitter',   family: 'feather', urlPrefix: 'https://x.com/' },
    whatsapp:  { icon: 'whatsapp',  family: 'mci',     urlPrefix: 'https://wa.me/' },
    telegram:  { icon: 'send',      family: 'feather', urlPrefix: 'https://t.me/' },
    website:   { icon: 'globe',     family: 'feather', urlPrefix: '' },
};

// ── Component ──────────────────────────────────────────

const BarProfileModal: React.FC<BarProfileModalProps> = ({
    visible, bar, placeDetails: pd, allMatches = [], onClose, onNavigate,
}) => {
    const { user } = useAuth();
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();
    const translateY = useRef(new Animated.Value(screenHeight)).current;
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

    // ── Estat de subscripció ──
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [togglingSubscription, setTogglingSubscription] = useState(false);

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
            // Comprovar subscripció
            if (user && bar.tier === 'premium') {
                isSubscribedToBar(user.id, bar.id).then(setIsSubscribed).catch(() => {});
            }
        }
    }, [visible, bar?.id]);

    const handleToggleSubscription = async () => {
        if (!user || !bar) return;
        setTogglingSubscription(true);
        try {
            if (isSubscribed) {
                await unsubscribeFromBar(user.id, bar.id);
                setIsSubscribed(false);
            } else {
                await subscribeToBar(user.id, bar.id);
                setIsSubscribed(true);
            }
        } catch (e) {
            console.error('Error toggling subscription:', e);
        } finally {
            setTogglingSubscription(false);
        }
    };

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
            showAlert({ tone: 'error', message: "No s'ha pogut publicar la ressenya." });
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
            showAlert({ tone: 'error', message: "No s'han pogut desar els serveis." });
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
                toValue: screenHeight,
                duration: 280,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, screenHeight, translateY]);

    if (!visible && !bar) return null;

    const displayName = bar?.name || pd?.displayName || '';
    const displayAddress = pd?.formattedAddress || bar?.address || 'Barcelona';
    // Prioritat: 1) Google Places real-time, 2) càlcul local amb períodes cachejats
    // NO usem bar.isOpen (sempre true per defecte a Firestore) → evitem flicker
    const openStatus = pd?.currentOpeningHours?.openNow ?? isOpenNow(bar?.openingPeriods);
    const photos = [...new Set([...(bar?.gallery || []), ...(pd?.photoUrls || [])])];
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

            {/* Panell lliscant */}
            <Animated.View
                testID="premium-bar-panel"
                style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: screenHeight * 0.92,
                    backgroundColor: P.bg,
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    borderTopWidth: 4,
                    borderTopColor: EDITORIAL.matchday,
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
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: P.separator }} />
                </View>

                {/* Botó de tancar */}
                <TouchableOpacity
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Tancar les dades del bar"
                    style={{
                        position: 'absolute', top: 14, right: 16, zIndex: 10,
                        width: 44, height: 44, borderRadius: 8,
                        backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <AppIcon name="x" size={20} color={P.accent} />
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
                                        width: Math.min(300, screenWidth * 0.7),
                                        height: 200,
                                        borderRadius: 8,
                                        backgroundColor: P.subtleBg,
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
                            fontFamily: EDITORIAL.fontSport, lineHeight: 32,
                        }}>
                            {displayName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                            <View style={{
                                backgroundColor: EDITORIAL.matchday,
                                paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
                                flexDirection: 'row', alignItems: 'center',
                            }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: P.bg, fontFamily: EDITORIAL.fontRegular, letterSpacing: 0 }}>
                                    PREMIUM
                                </Text>
                            </View>

                            {/* Botó de subscripció / notificacions */}
                            {user && bar?.tier === 'premium' && (
                                <TouchableOpacity
                                    onPress={handleToggleSubscription}
                                    disabled={togglingSubscription}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${isSubscribed ? 'Deixar de seguir' : 'Seguir'} ${displayName}`}
                                    accessibilityState={{ busy: togglingSubscription }}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        minHeight: 44,
                                        backgroundColor: isSubscribed ? P.selectedBg : P.subtleBg,
                                        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                                        marginLeft: 8,
                                        borderWidth: 1,
                                        borderColor: isSubscribed ? P.accent : P.separator,
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={{
                                        fontSize: 12, fontWeight: '600', fontFamily: EDITORIAL.fontRegular,
                                        color: P.text,
                                    }}>
                                        {togglingSubscription ? '…' : isSubscribed ? 'Seguint' : 'Seguir'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* ── PUNTUACIÓ INTERNA + OBERT/TANCAT ── */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 10, gap: 12, flexWrap: 'wrap' }}>
                        {reviewStats.totalReviews > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {[1,2,3,4,5].map(s => (
                                    <AppIcon key={s} name="star" size={16} color={s <= Math.round(reviewStats.averageRating) ? EDITORIAL.matchday : P.separator} style={{ marginRight: 1 }} />
                                ))}
                                <Text style={{ fontWeight: 'bold', fontSize: 16, color: P.text, fontFamily: EDITORIAL.fontRegular, marginLeft: 6 }}>
                                    {reviewStats.averageRating.toFixed(1)}
                                </Text>
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, marginLeft: 4 }}>
                                    ({reviewStats.totalReviews} {reviewStats.totalReviews === 1 ? 'ressenya' : 'ressenyes'})
                                </Text>
                            </View>
                        )}
                        {openStatus != null && (
                                <Text style={{
                                    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, fontSize: 14,
                                    fontFamily: EDITORIAL.fontRegular, fontWeight: '600', overflow: 'hidden', borderWidth: 1,
                                    ...(openStatus
                                        ? { backgroundColor: P.badgeOpen.bg, color: P.badgeOpen.text, borderColor: P.badgeOpen.border }
                                        : { backgroundColor: P.badgeClosed.bg, color: P.badgeClosed.text, borderColor: P.badgeClosed.border }),
                                }}>
                                    {openStatus ? 'Obert ara' : 'Tancat'}
                                </Text>
                            )}
                        </View>

                    {/* ── SEPARADOR ── */}
                    <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: P.separator, marginVertical: 6 }} />

                    {/* ── SECCIÓ D'INFORMACIÓ ── */}
                    <View style={{ marginTop: 14 }}>
                        <Text style={sectionTitleStyle}>Informació</Text>

                        {/* Adreça (text pla, sense link) */}
                        <View style={infoRowStyle}>
                            <AppIcon name="map-pin" size={17} color={P.accent} style={{ marginRight: 10 }} />
                            <Text style={[infoTextStyle, { flex: 1 }]}>{displayAddress}</Text>
                        </View>

                        {/* Telèfon */}
                        {pd?.phoneNumber && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(`tel:${pd.phoneNumber}`)}
                                style={infoRowStyle}
                                accessibilityRole="link"
                                accessibilityLabel={`Trucar al ${pd.phoneNumber}`}
                            >
                                <Text style={infoTextStyle}>{pd.phoneNumber}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Lloc web */}
                        {pd?.websiteUri && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(pd.websiteUri!)}
                                style={infoRowStyle}
                                accessibilityRole="link"
                                accessibilityLabel={`Obrir el web de ${displayName}`}
                            >
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
                                            accessibilityRole="button"
                                            accessibilityLabel="Editar serveis del bar"
                                        >
                                            <AppIcon name="edit-2" size={16} color={P.accent} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {editingAmenities ? (
                                    /* ── Mode edició: totes les amenities agrupades per categoria ── */
                                    <View style={{ marginTop: 10 }}>
                                        {AMENITY_CATEGORIES.map(cat => (
                                            <View key={cat.key} style={{ marginBottom: 14 }}>
                                                <Text style={{
                                                    fontSize: 14, fontFamily: EDITORIAL.fontRegular, color: P.textMuted,
                                                    marginBottom: 6, textTransform: 'capitalize',
                                                }}>
                                                    {cat.label}
                                                </Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                    {AMENITY_OPTIONS.filter(a => a.category === cat.key).map(opt => {
                                                        const active = selectedAmenities.has(opt.key);
                                                        return (
                                                            <TouchableOpacity
                                                                key={opt.key}
                                                                onPress={() => toggleAmenity(opt.key)}
                                                                accessibilityRole="checkbox"
                                                                accessibilityState={{ checked: active }}
                                                                style={{
                                                                    flexDirection: 'row', alignItems: 'center',
                                                                    minHeight: 44,
                                                                    backgroundColor: active ? P.selectedBg : P.subtleBg,
                                                                    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
                                                                    borderWidth: 1,
                                                                    borderColor: active ? P.accent : P.separator,
                                                                }}
                                                                activeOpacity={0.7}
                                                            >
                                                                <Text style={{
                                                                    fontSize: 14, fontFamily: EDITORIAL.fontRegular,
                                                                    color: active ? P.text : P.textMuted,
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
                                                    flex: 1, minHeight: 44, backgroundColor: P.accent, borderRadius: 8,
                                                    paddingVertical: 10, alignItems: 'center',
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={{ fontSize: 14, fontFamily: EDITORIAL.fontRegular, fontWeight: '700', color: P.buttonText }}>
                                                    {savingAmenities ? 'Desant…' : 'Desar'}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => setEditingAmenities(false)}
                                                style={{
                                                    flex: 1, borderRadius: 8, paddingVertical: 10,
                                                    alignItems: 'center', borderWidth: 1, borderColor: P.separator,
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={{ fontSize: 14, fontFamily: EDITORIAL.fontRegular, color: P.textMuted }}>Cancel·la</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : hasAmenities ? (
                                    /* ── Mode lectura: xips de les amenities actives ── */
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                                        {amenities.map(key => {
                                            const opt = AMENITY_MAP.get(key);
                                            if (!opt) return null;
                                            const IconComp = AppIcon;
                                            return (
                                                <View
                                                    key={key}
                                                    style={{
                                                        flexDirection: 'row', alignItems: 'center',
                                                        backgroundColor: P.subtleBg,
                                                        borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                                                        borderWidth: 1, borderColor: P.separator,
                                                    }}
                                                >
                                                    <IconComp name={opt.icon as any} size={14} color={P.accent} />
                                                    <Text style={{
                                                        marginLeft: 6, fontSize: 14, fontFamily: EDITORIAL.fontRegular, color: P.text,
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
                                            backgroundColor: P.subtleBg, borderRadius: 8, padding: 12,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ fontSize: 14, fontFamily: EDITORIAL.fontRegular, color: P.accent }}>
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
                                accessibilityRole="button"
                                accessibilityState={{ expanded: showHours }}
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                activeOpacity={0.7}
                            >
                                <Text style={sectionTitleStyle}>Horaris</Text>
                                <AppIcon
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
                                                fontFamily: EDITORIAL.fontRegular, marginBottom: 4, lineHeight: 20,
                                            }}>
                                                {line}
                                            </Text>
                                        ))
                                    ) : (
                                        <>
                                            <Text style={{
                                                fontSize: 14, color: P.textMuted,
                                                fontFamily: EDITORIAL.fontRegular, marginBottom: 4, lineHeight: 20,
                                            }}>
                                                {todayLine}
                                            </Text>
                                            <View style={{
                                                flexDirection: 'row', alignItems: 'center', marginTop: 8,
                                                backgroundColor: P.subtleBg, borderRadius: 8, padding: 10,
                                            }}>
                                                <AppIcon name="lock" size={14} color={P.accent} style={{ marginRight: 8 }} />
                                                <Text style={{ fontSize: 14, color: P.accent, fontFamily: EDITORIAL.fontRegular, flex: 1 }}>
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
                            <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, lineHeight: 22 }}>
                                {bar.description}
                            </Text>
                        </View>
                    ) : null}

                    {/* ── TEXT PROMOCIONAL ── */}
                    {bar?.promotionalText ? (
                        <View style={{
                            marginTop: 20, backgroundColor: P.subtleBg,
                            borderRadius: 8, padding: 16, borderWidth: 1, borderColor: EDITORIAL.matchday,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                <AppIcon name="zap" size={16} color={P.accent} style={{ marginRight: 6 }} />
                                <Text style={{ fontSize: 14, fontWeight: '700', color: P.accent, fontFamily: EDITORIAL.fontRegular }}>Promoció</Text>
                            </View>
                            <Text style={{ fontSize: 14, color: P.text, fontFamily: EDITORIAL.fontRegular, lineHeight: 20 }}>
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
                                {broadcastMatches.map((match, idx) => (
                                    <View key={match.id} style={{ width: Math.min(260, screenWidth * 0.65) }}>
                                        <MatchCard match={match} compact isNextMatch={idx === 0} />
                                    </View>
                                ))}
                            </ScrollView>
                        ) : bar?.broadcastingMatches && bar.broadcastingMatches.length > 0 ? (
                            <View style={{ backgroundColor: P.cardBg, borderRadius: 8, padding: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <AppIcon name="tv" size={18} color={P.accent} style={{ marginRight: 8 }} />
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: P.text, fontFamily: EDITORIAL.fontRegular }}>
                                        {bar.broadcastingMatches.length} {bar.broadcastingMatches.length === 1 ? 'partit configurat' : 'partits configurats'}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, lineHeight: 19 }}>
                                    Els partits configurats apareixeran aquí quan hi hagi partits propers disponibles.
                                </Text>
                            </View>
                        ) : bar?.usuallyShowsBarca ? (
                            <View style={{ backgroundColor: P.cardBg, borderRadius: 8, padding: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <AppIcon name="tv" size={18} color={P.accent} style={{ marginRight: 8 }} />
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: P.text, fontFamily: EDITORIAL.fontRegular }}>
                                        Normalment emet el Barça
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, lineHeight: 19 }}>
                                    Segons els usuaris, aquest bar sol emetre els partits del FC Barcelona.
                                </Text>
                            </View>
                        ) : (
                            <View style={{ backgroundColor: P.cardBg, borderRadius: 8, padding: 20, alignItems: 'center' }}>
                                <AppIcon name="tv" size={28} color={P.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, textAlign: 'center', lineHeight: 20 }}>
                                    Properament podràs veure els partits que aquest bar ha confirmat que emetrà.
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ── XARXES SOCIALS ── */}
                    <View style={{ marginTop: 24 }}>
                        <Text style={sectionTitleStyle}>Xarxes socials</Text>
                        {hasSocial ? (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                {Object.entries(SOCIAL_CONFIG).map(([key, config]) => {
                                    const value = social?.[key as keyof typeof social];
                                    if (!value) return null;
                                    const url = value.startsWith('http') ? value : `${config.urlPrefix}${value}`;
                                    return (
                                        <TouchableOpacity
                                            key={key}
                                            onPress={() => Linking.openURL(url)}
                                            style={{
                                                width: 48, height: 48, borderRadius: 24,
                                                backgroundColor: P.cardBg,
                                                alignItems: 'center', justifyContent: 'center',
                                                borderWidth: 1, borderColor: P.separator,
                                            }}
                                            activeOpacity={0.7}
                                            accessibilityRole="link"
                                            accessibilityLabel={`Obrir ${key}`}
                                        >
                                            {config.family === 'mci' ? (
                                                <AppIcon name={config.icon as any} size={24} color={P.text} />
                                            ) : (
                                                <AppIcon name={config.icon as any} size={22} color={P.text} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={{ backgroundColor: P.cardBg, borderRadius: 8, padding: 20, alignItems: 'center' }}>
                                <AppIcon name="share-2" size={28} color={P.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, textAlign: 'center', lineHeight: 20 }}>
                                    Les xarxes socials d'aquest bar apareixeran aquí.
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ── MUR DE RESSENYES (INTERN) ── */}
                    <View style={{ marginTop: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <Text style={sectionTitleStyle}>Ressenyes</Text>
                            {user && !myReview && !showReviewForm && !(user.id === bar?.ownerId) && (
                                <TouchableOpacity
                                    onPress={() => setShowReviewForm(true)}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        backgroundColor: P.accent, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6,
                                        borderRadius: 8,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: P.buttonText, fontFamily: EDITORIAL.fontRegular }}>Escriure</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Formulari de nova ressenya */}
                        {showReviewForm && (
                            <View style={{
                                backgroundColor: P.subtleBg, borderRadius: 8,
                                padding: 16, marginBottom: 16,
                            }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: P.text, fontFamily: EDITORIAL.fontRegular, marginBottom: 10 }}>
                                    La teva valoració
                                </Text>
                                {/* Selector d'estrelles */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 }}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <TouchableOpacity key={s} onPress={() => setNewRating(s)} accessibilityRole="radio" accessibilityLabel={`${s} ${s === 1 ? 'estrella' : 'estrelles'}`} accessibilityState={{ checked: newRating === s }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                                            <AppIcon
                                                name="star"
                                                size={28}
                                                color={s <= newRating ? EDITORIAL.matchday : P.separator}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {/* Camp de comentari */}
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, marginBottom: 8 }}>Comentari (opcional)</Text>
                                <TextInput
                                    placeholder="Què t'ha semblat aquest bar?"
                                    placeholderTextColor={P.textMuted}
                                    value={newComment}
                                    onChangeText={setNewComment}
                                    multiline
                                    numberOfLines={3}
                                    style={{
                                        backgroundColor: P.bg,
                                        borderRadius: 8, padding: 12,
                                        color: P.text, fontFamily: EDITORIAL.fontRegular, fontSize: 14,
                                        minHeight: 70, textAlignVertical: 'top',
                                        borderWidth: 1, borderColor: P.separator,
                                    }}
                                />
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => { setShowReviewForm(false); setNewComment(''); setNewRating(5); }}
                                        style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                                    >
                                        <Text style={{ color: P.textMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 14 }}>Cancel·lar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleSubmitReview}
                                        disabled={submittingReview || newRating === 0}
                                        style={{
                                            backgroundColor: P.accent, borderRadius: 8,
                                            paddingHorizontal: 18, paddingVertical: 8,
                                            opacity: (submittingReview || newRating === 0) ? 0.5 : 1,
                                        }}
                                    >
                                        <Text style={{ color: P.buttonText, fontWeight: 'bold', fontFamily: EDITORIAL.fontRegular, fontSize: 14 }}>
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
                                        backgroundColor: P.cardBg, borderRadius: 8, padding: 14,
                                    }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                            {review.userAvatar ? (
                                                <Image
                                                    source={{ uri: review.userAvatar }}
                                                    style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10, borderWidth: 1.5, borderColor: P.separator }}
                                                />
                                            ) : (
                                                <View style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: P.subtleBg, alignItems: 'center', justifyContent: 'center' }}>
                                                    <AppIcon name="user" size={16} color={P.textMuted} />
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '600', color: P.text, fontFamily: EDITORIAL.fontRegular }}>
                                                    {review.userName}
                                                </Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <AppIcon key={s} name="star" size={12} color={s <= review.rating ? EDITORIAL.matchday : P.separator} style={{ marginRight: 1 }} />
                                                    ))}
                                                    <Text style={{ fontSize: 12, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, marginLeft: 6 }}>
                                                        {review.createdAt.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </Text>
                                                </View>
                                            </View>
                                            {/* Botó d'eliminar la ressenya pròpia */}
                                            {user && review.userId === user.id && (
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteReview(review.id)}
                                                    style={{ padding: 6 }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Eliminar la meva ressenya"
                                                >
                                                    <AppIcon name="trash-2" size={14} color={P.textMuted} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        {review.comment ? (
                                            <Text style={{ fontSize: 14, color: P.text, fontFamily: EDITORIAL.fontRegular, lineHeight: 20 }}>
                                                {review.comment}
                                            </Text>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={{ backgroundColor: P.cardBg, borderRadius: 8, padding: 20, alignItems: 'center' }}>
                                <AppIcon name="message-circle" size={28} color={P.textMuted} style={{ marginBottom: 8, opacity: 0.5 }} />
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, textAlign: 'center', lineHeight: 20 }}>
                                    Encara no hi ha ressenyes. Sigues el primer a opinar!
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ── BOTÓ DE NAVEGACIÓ ── */}
                    <TouchableOpacity
                        style={{
                            backgroundColor: P.accent, borderRadius: 8,
                            paddingVertical: 16, paddingHorizontal: 20, marginTop: 30,
                            alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                            ...sketchShadow(),
                        }}
                        onPress={onNavigate}
                        accessibilityRole="button"
                        accessibilityLabel={`Com arribar a ${displayName}`}
                    >
                        <Text style={{ color: P.buttonText, fontWeight: 'bold', fontSize: 18, fontFamily: EDITORIAL.fontRegular }}>
                            Com arribar-hi
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </Animated.View>
        </View>
    );

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
    fontSize: 22,
    fontWeight: 'bold' as const,
    color: P.text,
    fontFamily: EDITORIAL.fontSport,
    marginBottom: 12,
};

const infoRowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
};

const infoTextStyle = {
    fontSize: 16,
    color: P.text,
    fontFamily: EDITORIAL.fontRegular,
    lineHeight: 21,
};

export default BarProfileModal;
