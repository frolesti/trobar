import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, TouchableOpacity, Image, ScrollView, Linking, Animated, useWindowDimensions, Platform, Modal, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './AppText';
import AppIcon from './AppIcon';
import { SKETCH_THEME, sketchShadow } from '../theme/sketchTheme';
import { EDITORIAL } from '../theme/editorialTheme';
import AlertBannerHost, { showAlert } from './AlertBanner';
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
import GoogleRatingSection from './GoogleRatingSection';
import UserNotice from './UserNotice';
import { fetchDemoUserReviews, addDemoUserReview, deleteDemoUserReview } from '../services/premiumDemoReviewService';
import { enrichPremiumDemoBar, isPremiumDemoBar, getPremiumDemoReviews, getPremiumDemoHours, getPremiumDemoBroadcastMatches, isZuritoDevelopmentPreview, ZURITO_PREVIEW_NOTICE } from '../data/premiumDemoProfiles';
import VenuePhotoGallery from './VenuePhotoGallery';

// ── Tipus ──────────────────────────────────────────────

interface BarProfileModalProps {
    visible: boolean;
    bar: Bar | null;
    placeDetails: PlaceDetails | null;
    /** Tots els partits disponibles (el component filtra per broadcastingMatches) */
    allMatches?: Match[];
    onClose: () => void;
    onNavigate?: () => void;
    onRequestLogin?: () => void;
    embedded?: boolean;
    onReviewStatsChange?: (stats: BarReviewStats) => void;
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
const SOCIAL_CONFIG: Record<string, { label: string; icon: string; family: 'feather' | 'mci'; urlPrefix: string }> = {
    instagram: { label: 'Instagram', icon: 'instagram', family: 'feather', urlPrefix: 'https://instagram.com/' },
    facebook:  { label: 'Facebook', icon: 'facebook',  family: 'feather', urlPrefix: 'https://facebook.com/' },
    twitter:   { label: 'X', icon: 'twitter',   family: 'feather', urlPrefix: 'https://x.com/' },
    whatsapp:  { label: 'WhatsApp', icon: 'whatsapp',  family: 'mci',     urlPrefix: 'https://wa.me/' },
    telegram:  { label: 'Telegram', icon: 'send',      family: 'feather', urlPrefix: 'https://t.me/' },
    website:   { label: 'Web', icon: 'globe',     family: 'feather', urlPrefix: '' },
};

// ── Component ──────────────────────────────────────────

const BarProfileModal: React.FC<BarProfileModalProps> = ({
    visible, bar: originalBar, placeDetails, allMatches = [], onClose, onNavigate, onRequestLogin, embedded = false, onReviewStatsChange,
}) => {
    const bar = originalBar ? enrichPremiumDemoBar(originalBar) : null;
    const isDemo = isPremiumDemoBar(bar);
    const pd = isDemo ? null : placeDetails;
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();
    const translateY = useRef(new Animated.Value(screenHeight)).current;
    const [showHours, setShowHours] = useState(false);

    // ── Estat de ressenyes internes ──
    const [loadedReviews, setReviews] = useState<Review[]>([]);
    const [loadedReviewStats, setReviewStats] = useState<BarReviewStats>({ averageRating: 0, totalReviews: 0 });
    const reviews = isDemo && loadedReviews.length === 0 ? getPremiumDemoReviews(bar)! : loadedReviews;
    const reviewStats = isDemo ? {
        totalReviews: reviews.length,
        averageRating: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0,
    } : loadedReviewStats;
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
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewsError, setReviewsError] = useState<string | null>(null);
    const loadTarget = `${visible}:${bar?.id}:${isDemo}:${user?.id}`;
    const currentLoadTarget = useRef(loadTarget);
    currentLoadTarget.current = loadTarget;
    const notifyDemo = () => showAlert({
        tone: 'info',
        message: 'Aquesta opció encara no està disponible en aquest perfil.',
    });

    // Carregar ressenyes quan s'obre el modal
    const loadReviews = useCallback(async () => {
        if (!bar?.id) return;
        const target = loadTarget;
        setReviewsLoading(true);
        setReviewsError(null);
        try {
            const [revs, stats, ownReview] = isDemo
                ? await fetchDemoUserReviews(bar).then(local => {
                    const combined = [...local, ...getPremiumDemoReviews(bar)!];
                    return [combined, {
                        totalReviews: combined.length,
                        averageRating: combined.reduce((sum, review) => sum + review.rating, 0) / combined.length,
                    }, local.find(review => review.userId === user?.id) ?? null] as const;
                })
                : await Promise.all([
                    fetchReviews(bar.id), getBarReviewStats(bar.id), user ? getUserReview(bar.id, user.id) : null,
                ]);
            if (currentLoadTarget.current !== target) return;
            setReviews(ownReview && !revs.some(review => review.id === ownReview.id) ? [ownReview, ...revs] : revs);
            setReviewStats(stats);
            setMyReview(ownReview);
            onReviewStatsChange?.(stats);
        } catch (e) {
            console.info('Error loading reviews:', e);
            if (currentLoadTarget.current === target) setReviewsError("No s'han pogut carregar les ressenyes de troBar. Torna-ho a provar.");
        } finally {
            if (currentLoadTarget.current === target) setReviewsLoading(false);
        }
    }, [bar?.id, user?.id, isDemo, loadTarget, onReviewStatsChange]);

    useEffect(() => {
        if (visible && bar) {
            setReviews([]);
            setReviewStats({ averageRating: 0, totalReviews: 0 });
            setMyReview(null);
            loadReviews();
            setShowReviewForm(false);
            setNewRating(5);
            setNewComment('');
            setSubmittingReview(false);
            setTogglingSubscription(false);
            setEditingAmenities(false);
            setSelectedAmenities(new Set(bar.amenities ?? []));
            // Comprovar subscripció
            setIsSubscribed(false);
            if (!isDemo && user && bar.tier === 'premium') {
                const target = loadTarget;
                isSubscribedToBar(user.id, bar.id).then(value => {
                    if (currentLoadTarget.current === target) setIsSubscribed(value);
                }).catch(error => {
                    console.info('Error carregant el seguiment:', error);
                    if (currentLoadTarget.current === target) showAlert({ tone: 'error', message: "No s'ha pogut comprovar si segueixes aquest bar." });
                });
            }
        }
    }, [visible, bar?.id, user?.id, isDemo]);

    const handleToggleSubscription = async () => {
        if (isDemo) { notifyDemo(); return; }
        if (!user || !bar) {
            showAlert({ tone: 'info', message: 'Inicia sessió per seguir aquest bar.' });
            return;
        }
        const target = loadTarget;
        setTogglingSubscription(true);
        try {
            if (isSubscribed) {
                await unsubscribeFromBar(user.id, bar.id);
                if (currentLoadTarget.current === target) setIsSubscribed(false);
            } else {
                await subscribeToBar(user.id, bar.id);
                if (currentLoadTarget.current === target) setIsSubscribed(true);
            }
        } catch (e) {
            console.info('Error toggling subscription:', e);
            showAlert({ tone: 'error', message: "No s'ha pogut actualitzar el seguiment. Torna-ho a provar." });
        } finally {
            if (currentLoadTarget.current === target) setTogglingSubscription(false);
        }
    };

    const handleSubmitReview = async () => {
        if (!bar || !user) {
            showAlert({ tone: 'info', message: 'Inicia sessió per escriure una ressenya.' });
            return;
        }
        if (submittingReview) return;
        const target = loadTarget;
        setSubmittingReview(true);
        try {
            if (isDemo) await addDemoUserReview(bar, { ...user, name: user.name || 'Usuari' }, newRating, newComment);
            else await addReview(bar.id, user.id, user.name || 'Usuari', user.avatar, newRating, newComment);
            if (currentLoadTarget.current !== target) return;
            setShowReviewForm(false);
            setNewComment('');
            setNewRating(5);
            await loadReviews();
        } catch (e) {
            console.info('Error submitting review:', e);
            showAlert({ tone: 'error', message: "No s'ha pogut publicar la ressenya." });
        } finally {
            if (currentLoadTarget.current === target) setSubmittingReview(false);
        }
    };

    const handleDeleteReview = async (reviewId: string) => {
        if (!bar || !user) return;
        const target = loadTarget;
        try {
            if (isDemo) await deleteDemoUserReview(bar, reviewId, user.id);
            else await deleteReview(bar.id, reviewId);
            if (currentLoadTarget.current === target) await loadReviews();
        } catch (e) {
            console.info('Error deleting review:', e);
            showAlert({ tone: 'error', message: "No s'ha pogut eliminar la ressenya." });
        }
    };

    // ── Guardar amenities ──
    const handleSaveAmenities = async () => {
        if (isDemo) { notifyDemo(); return; }
        if (!bar) return;
        setSavingAmenities(true);
        try {
            const arr = Array.from(selectedAmenities) as BarAmenity[];
            await updateBarAmenities(bar.id, arr);
            bar.amenities = arr;          // actualitzar in-memory
            setEditingAmenities(false);
        } catch (e) {
            console.info('Error saving amenities:', e);
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
        if (embedded) return;
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
    }, [visible, screenHeight, translateY, embedded]);

    if (!visible && !bar) return null;

    const displayName = bar?.name || pd?.displayName || '';
    const displayAddress = pd?.formattedAddress || bar?.address || 'Barcelona';
    // Prioritat: 1) Google Places real-time, 2) càlcul local amb períodes cachejats
    // NO usem bar.isOpen (sempre true per defecte a Firestore) → evitem flicker
    const openStatus = pd?.currentOpeningHours?.openNow ?? isOpenNow(bar?.openingPeriods);
    const photos = [...new Set([...(bar?.gallery || []), ...(pd?.photoUrls || [])])];
    const hours = getPremiumDemoHours(bar) ?? pd?.currentOpeningHours?.weekdayDescriptions ?? [];
    const social = bar?.socialMedia;
    const hasSocial = social && Object.values(social).some(v => !!v);

    // Partits que el bar emet (filtrats des de la llista completa)
    const broadcastMatches = getPremiumDemoBroadcastMatches(bar, allMatches) ?? (bar?.broadcastingMatches && bar.broadcastingMatches.length > 0
        ? allMatches.filter(m => bar.broadcastingMatches!.includes(m.id))
        : []);
    const broadcastSection = (
        <View testID="premium-broadcasts" style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: P.separator }}>
            <Text style={sectionTitleStyle}>Partits que emet</Text>
            {isZuritoDevelopmentPreview(bar) && <Text style={{ color: P.textMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 12, marginBottom: 8 }}>Exemples d’emissió · no confirmats pel local</Text>}
            {broadcastMatches.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, alignItems: 'stretch' }}>
                    {broadcastMatches.map((match, index) => (
                        <View key={match.id} style={{ width: Math.min(340, screenWidth - 44) }}>
                            <MatchCard match={match} compact isNextMatch={index === 0} style={{ flex: 1 }} />
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <Text style={{ color: P.textMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 14, lineHeight: 20 }}>
                    {bar?.broadcastingMatches?.length ? `${bar.broadcastingMatches.length} partits configurats. La programació encara no està disponible.` : bar?.usuallyShowsBarca ? 'Normalment emet el Barça' : 'Encara no hi ha emissions confirmades.'}
                </Text>
            )}
        </View>
    );

    // Contingut interior del modal
    const profileContent = (
        <>
                {/* Indicador d'arrossegament */}
                {!embedded && <View style={{ height: 56, alignItems: 'center', paddingTop: 10 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: P.separator }} />
                </View>}

                {/* Botó de tancar */}
                <TouchableOpacity
                    onPress={onClose}
                    testID="premium-profile-close"
                    accessibilityRole="button"
                    accessibilityLabel="Tancar les dades del bar"
                    style={{
                        position: 'absolute', top: embedded ? -20 : 8, right: 8, zIndex: 10,
                        width: 44, height: 44,
                        alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <AppIcon name="x" size={20} color={P.accent} />
                </TouchableOpacity>

                <ScrollView
                    testID="premium-profile-scroll"
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ── FOTOS PRINCIPALS ── */}
                    <View style={{ marginTop: embedded ? 28 : 4, marginBottom: 14 }}>
                        <VenuePhotoGallery testID="premium-profile-gallery" name={displayName} photos={photos} height={164} photoWidth={Math.min(280, screenWidth * 0.74)} />
                    </View>

                    {/* ── NOM + INSÍGNIA PREMIUM ── */}
                    <View testID="premium-profile-heading" style={{ marginBottom: 4 }}>
                        <Text style={{
                            fontSize: 24, color: P.text,
                            fontFamily: EDITORIAL.fontBold, lineHeight: 28,
                        }}>
                            {displayName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4, gap: 8, justifyContent: 'space-between' }}>
                            <View style={{
                                paddingVertical: 3,
                                flexDirection: 'row', alignItems: 'center',
                            }}>
                                <Text style={{ fontSize: 11, color: EDITORIAL.matchday, fontFamily: EDITORIAL.fontBold, letterSpacing: 0.5 }}>
                                    PREMIUM
                                </Text>
                            </View>

                            {/* Botó de subscripció / notificacions */}
                            {user && bar?.tier === 'premium' && (
                                <TouchableOpacity
                                    testID="premium-follow-button"
                                    onPress={handleToggleSubscription}
                                    disabled={togglingSubscription}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${isSubscribed ? 'Deixar de seguir' : 'Seguir'} ${displayName}`}
                                    accessibilityState={{ busy: togglingSubscription, disabled: togglingSubscription, selected: isSubscribed }}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                        minHeight: 44,
                                        backgroundColor: isSubscribed ? P.selectedBg : P.subtleBg,
                                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: P.separator,
                                        opacity: togglingSubscription ? 0.6 : 1,
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={{
                                        fontSize: 13, lineHeight: 18, fontFamily: EDITORIAL.fontBold,
                                        color: P.text,
                                    }}>
                                        {togglingSubscription ? 'Desant…' : isSubscribed ? 'Deixar de seguir' : 'Seguir el bar'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* ── PUNTUACIÓ INTERNA + OBERT/TANCAT ── */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                        {reviewStats.totalReviews > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {[1,2,3,4,5].map(s => (
                                    <AppIcon key={s} name="star-filled" size={16} color={s <= Math.round(reviewStats.averageRating) ? EDITORIAL.matchday : P.separator} style={{ marginRight: 1 }} />
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

                    {isZuritoDevelopmentPreview(bar) && <Text testID="zurito-preview-notice" style={{ color: P.textMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 12, lineHeight: 17 }}>{ZURITO_PREVIEW_NOTICE}</Text>}
                    {broadcastSection}

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
                        const isOwner = !isDemo && !!(user && bar?.ownerId && user.id === bar.ownerId);
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
                                            onPress={() => isDemo ? notifyDemo() : Linking.openURL(url)}
                                            style={{
                                                minHeight: 44, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', gap: 8,
                                                backgroundColor: P.cardBg,
                                                alignItems: 'center', justifyContent: 'center',
                                                borderWidth: 1, borderColor: P.separator,
                                            }}
                                            activeOpacity={0.7}
                                            accessibilityRole={isDemo ? 'button' : 'link'}
                                            accessibilityLabel={`Obrir ${key}`}
                                        >
                                            {config.family === 'mci' ? (
                                                <AppIcon name={config.icon as any} size={24} color={P.text} />
                                            ) : (
                                                <AppIcon name={config.icon as any} size={22} color={P.text} />
                                            )}
                                            <Text style={{ color: P.text, fontSize: 13, fontFamily: EDITORIAL.fontRegular }}>{config.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <View>
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, lineHeight: 20 }}>
                                    Les xarxes socials d'aquest bar apareixeran aquí.
                                </Text>
                            </View>
                        )}
                    </View>

                    <GoogleRatingSection enabled={bar?.showGoogleRating === true} placeDetails={pd} isDemo={isDemo} />

                    {/* ── MUR DE RESSENYES (INTERN) ── */}
                    <View testID="trobar-reviews" style={{ marginTop: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                            <Text style={sectionTitleStyle}>Ressenyes de troBar</Text>
                            {user && !myReview && !showReviewForm && !reviewsLoading && !reviewsError && !(user.id === bar?.ownerId) && (
                                <TouchableOpacity
                                    onPress={() => setShowReviewForm(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Escriure una ressenya a troBar"
                                    style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        backgroundColor: P.accent, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6,
                                        borderRadius: 8,
                                    }}
                                >
                                    <Text style={{ fontSize: 14, color: P.buttonText, fontFamily: EDITORIAL.fontBold }}>Escriure</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text style={{ color: P.textMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
                            {isDemo ? 'Les teves ressenyes es desen només en aquest dispositiu.' : 'Opinions de la comunitat troBar · Independents de Google Maps.'}
                        </Text>
                        {!user && (
                            <TouchableOpacity
                                onPress={() => onRequestLogin ? onRequestLogin() : showAlert({ tone: 'info', message: 'Inicia sessió des del teu perfil per escriure una ressenya.' })}
                                accessibilityRole="button"
                                style={{ backgroundColor: P.accent, padding: 12, borderRadius: 8, minHeight: 44, alignItems: 'center', marginBottom: 12 }}
                            >
                                <Text style={{ color: P.bg, fontFamily: EDITORIAL.fontBold }}>Inicia sessió per escriure una ressenya</Text>
                            </TouchableOpacity>
                        )}
                        {user?.id === bar?.ownerId && <Text style={{ color: P.textMuted, marginBottom: 12 }}>No pots ressenyar el teu propi bar.</Text>}
                        {myReview && !showReviewForm && <Text style={{ color: P.textMuted, marginBottom: 12 }}>Ja has publicat la teva ressenya en aquest bar.</Text>}
                        {reviewsLoading && <Text accessibilityLiveRegion="polite" style={{ color: P.textMuted, marginBottom: 12 }}>Carregant ressenyes de troBar…</Text>}
                        {reviewsError && (
                            <View style={{ marginBottom: 12, gap: 8 }}>
                                <UserNotice tone="error" message={reviewsError} />
                                <TouchableOpacity onPress={loadReviews} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                                    <Text style={{ color: P.text, fontFamily: EDITORIAL.fontBold, textDecorationLine: 'underline' }}>Reintentar les ressenyes de troBar</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Formulari de nova ressenya */}
                        {user && showReviewForm && (
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
                                                name="star-filled"
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
                                    maxLength={2000}
                                    accessibilityLabel="Comentari de la ressenya de troBar"
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
                                        accessibilityRole="button"
                                        accessibilityLabel={isDemo ? 'Desar la ressenya en aquest dispositiu' : 'Publicar la ressenya a troBar'}
                                        accessibilityState={{ busy: submittingReview }}
                                        disabled={submittingReview || newRating === 0}
                                        style={{
                                            backgroundColor: P.accent, borderRadius: 8,
                                            paddingHorizontal: 18, paddingVertical: 8, minHeight: 44, justifyContent: 'center',
                                            opacity: (submittingReview || newRating === 0) ? 0.5 : 1,
                                        }}
                                    >
                                        <Text style={{ color: P.buttonText, fontWeight: 'bold', fontFamily: EDITORIAL.fontRegular, fontSize: 14 }}>
                                            {submittingReview ? 'Enviant...' : isDemo ? 'Desar' : 'Publicar'}
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
                                                        <AppIcon key={s} name="star-filled" size={12} color={s <= review.rating ? EDITORIAL.matchday : P.separator} style={{ marginRight: 1 }} />
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
                        ) : !reviewsLoading && !reviewsError ? (
                            <View>
                                <Text style={{ fontSize: 14, color: P.textMuted, fontFamily: EDITORIAL.fontRegular, lineHeight: 20 }}>
                                    Encara no hi ha ressenyes. Sigues el primer a opinar!
                                </Text>
                            </View>
                        ) : null}
                    </View>

                </ScrollView>
                <View testID="premium-profile-actions" style={{ borderTopWidth: 1, borderTopColor: P.separator, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(12, insets.bottom) }}>
                    <TouchableOpacity
                        style={{
                            backgroundColor: P.accent, borderRadius: 8,
                            minHeight: 48, paddingVertical: 12, paddingHorizontal: 20,
                            alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                            ...sketchShadow(),
                        }}
                        onPress={onNavigate}
                        accessibilityRole="button"
                        accessibilityLabel={`Com arribar a ${displayName}`}
                    >
                        <Text style={{ color: P.buttonText, fontSize: 16, fontFamily: EDITORIAL.fontBold }}>
                            Com arribar-hi
                        </Text>
                    </TouchableOpacity>
                </View>
        </>
    );

    if (embedded) return <View style={{ flex: 1 }}>{profileContent}</View>;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={{ flex: 1 }}>
                <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                <Animated.View
                    testID="premium-bar-panel"
                    style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0, height: screenHeight * 0.92,
                        backgroundColor: P.bg, borderTopLeftRadius: 8, borderTopRightRadius: 8,
                        borderTopWidth: 4, borderTopColor: EDITORIAL.matchday, transform: [{ translateY }],
                        ...Platform.select({
                            web: { boxShadow: '0px -6px 40px rgba(0,0,0,0.3)' },
                            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.3, shadowRadius: 20 },
                            android: { elevation: 24 },
                        }),
                    }}
                >
                    {profileContent}
                </Animated.View>
                <AlertBannerHost active={visible} priority={1} defaultPosition="top" topOffset={16} />
            </View>
        </Modal>
    );
};

// ── Estils compartits ──────────────────────────────────────

const sectionTitleStyle = {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: P.text,
    fontFamily: EDITORIAL.fontBold,
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
