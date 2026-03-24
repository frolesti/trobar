import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView, Image,
    Platform, ActivityIndicator, Animated, Dimensions, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Bar, BarAmenity } from '../../models/Bar';
import { AMENITY_OPTIONS, AMENITY_MAP } from '../../data/amenities';
import { getOwnedBar, updateBarProfile } from '../../services/barOwnerService';
import { fetchAllMatches, Match } from '../../services/matchService';
import { fetchBarPlaceDetails, PlaceDetails, isOpenNow } from '../../services/placesService';
import { getBarReviewStats } from '../../services/reviewService';
import { BarReviewStats } from '../../models/Review';
import { registerPushNotifications, listenForegroundMessages, getNotificationPermissionStatus } from '../../services/notificationService';
import { getUserPreferences, updateUserPreferences } from '../../services/userService';
import { BarOwnerNotificationPreferences, DEFAULT_BAR_OWNER_NOTIFICATION_PREFS } from '../../models/UserProfile';
import {
    BillingCycle as StripeBillingCycle,
    BILLING_PLANS,
    changeBillingCycle as stripeChangeBillingCycle,
    cancelSubscription,
    getSubscriptionStatus,
    openCheckout,
} from '../../services/subscriptionService';
import BarCard from '../../components/BarCard';
import BarProfileModal from '../../components/BarProfileModal';
import { SKETCH_THEME, sketchShadow } from '../../theme/sketchTheme';
import styles from './BarDashboardScreen.styles';

/* ── MapLibre (web) ──────────────────────────────────────────────────────── */
let MapboxMap: any = null;
let MapboxMarker: any = null;
if (Platform.OS === 'web') {
    try {
        const rgl = require('react-map-gl/maplibre');
        MapboxMap = rgl.default;
        MapboxMarker = rgl.Marker;
    } catch (_e) { /* no disponible en natiu */ }
}

/* ── Constants ───────────────────────────────────────────────────────────── */
const SOCIAL_NETWORKS = [
    { key: 'instagram', label: 'Instagram', icon: 'instagram' as const, placeholder: '@elteupub' },
    { key: 'facebook',  label: 'Facebook',  icon: 'facebook'  as const, placeholder: 'facebook.com/elteupub' },
    { key: 'twitter',   label: 'X (Twitter)', icon: 'twitter' as const, placeholder: '@elteupub' },
    { key: 'whatsapp',  label: 'WhatsApp',  icon: 'phone'    as const, placeholder: '+34 612 345 678' },
    { key: 'telegram',  label: 'Telegram',  icon: 'send'     as const, placeholder: '@elteupub' },
    { key: 'website',   label: 'Pàgina web', icon: 'globe'   as const, placeholder: 'https://elteupub.cat' },
] as const;

type Section = 'description' | 'promotions' | 'socials' | 'amenities' | 'matches';
type Tab = 'map' | 'profile' | 'settings';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/* ════════════════════════════════════════════════════════════════════════════
   BarDashboardScreen — 3 pestanyes (Mapa / Perfil / Configuració)
   ════════════════════════════════════════════════════════════════════════════ */
export default function BarDashboardScreen() {
    const { user, logout, deleteAccount } = useAuth();
    const navigation = useNavigation<any>();

    const [bar, setBar] = useState<Bar | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('profile');

    /* ── Dades editables ──────────────────────────────────────────────────── */
    const [description, setDescription] = useState('');
    const [promotionalText, setPromotionalText] = useState('');
    const [socials, setSocials] = useState<Record<string, string>>({});
    const [selectedAmenities, setSelectedAmenities] = useState<Set<BarAmenity>>(new Set());
    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
    const [broadcastingIds, setBroadcastingIds] = useState<Set<string>>(new Set());

    /* ── Mapa ─────────────────────────────────────────────────────────────── */
    const [mapLoaded, setMapLoaded] = useState(false);
    const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
    const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);
    const [reviewStats, setReviewStats] = useState<BarReviewStats>({ averageRating: 0, totalReviews: 0 });
    const [showBarProfile, setShowBarProfile] = useState(false);

    /* ── Bottom sheet (per edició) ────────────────────────────────────────── */
    const [activeSection, setActiveSection] = useState<Section | null>(null);
    const [matchGenderFilter, setMatchGenderFilter] = useState<'all' | 'masculino' | 'femenino'>('all');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
    const [isDeleting, setIsDeleting] = useState(false);
    const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    /* ── Modals de subscripció i eliminació ────────────────────────────────── */
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [showBillingConfirm, setShowBillingConfirm] = useState(false);
    const [pendingBillingCycle, setPendingBillingCycle] = useState<'monthly' | 'quarterly' | 'annual' | null>(null);
    const [isChangingPlan, setIsChangingPlan] = useState(false);
    const [subscriptionActive, setSubscriptionActive] = useState(true);

    /* ── Notificacions ────────────────────────────────────────────────────── */
    const [showNotifPrefs, setShowNotifPrefs] = useState(false);
    const [notifPrefs, setNotifPrefs] = useState<BarOwnerNotificationPreferences>(DEFAULT_BAR_OWNER_NOTIFICATION_PREFS);
    const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; time: Date }>>([]);

    /* ── Toast ────────────────────────────────────────────────────────────── */
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const toastOpacity = useRef(new Animated.Value(0)).current;

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        toastOpacity.setValue(0);
        setToast({ message, type });
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2500),
            Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setToast(null));
    }, [toastOpacity]);

    /* ── Obrir / tancar bottom sheet amb spring ───────────────────────────── */
    const openSheet = useCallback((section: Section) => {
        setActiveSection(section);
        Animated.spring(sheetTranslateY, {
            toValue: 0, damping: 22, stiffness: 200, useNativeDriver: true,
        }).start();
    }, [sheetTranslateY]);

    const closeSheet = useCallback(() => {
        Animated.timing(sheetTranslateY, {
            toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true,
        }).start(() => setActiveSection(null));
    }, [sheetTranslateY]);

    /* ── MapLibre CSS + JS (web) ─────────────────────────────────────────── */
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        // Si ja està carregat globalment (MapScreen ja l'ha carregat)
        if ((window as any).maplibregl) { setMapLoaded(true); return; }
        // CSS
        if (!document.querySelector('link[href*="maplibre-gl"]')) {
            const link = document.createElement('link');
            link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        // JS
        if (!document.querySelector('script[src*="maplibre-gl"]')) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
            script.onload = () => setMapLoaded(true);
            script.onerror = () => console.error('MapLibre failed to load');
            document.head.appendChild(script);
        } else {
            // Script ja existeix, esperem una mica
            const check = setInterval(() => {
                if ((window as any).maplibregl) { setMapLoaded(true); clearInterval(check); }
            }, 100);
            return () => clearInterval(check);
        }
    }, []);

    /* ── Càrrega inicial ──────────────────────────────────────────────────── */
    useEffect(() => {
        if (!user) return;
        (async () => {
            setLoading(true);
            try {
                const ownedBar = await getOwnedBar(user.id);
                if (ownedBar) {
                    setBar(ownedBar);
                    setDescription(ownedBar.description || '');
                    setPromotionalText(ownedBar.promotionalText || '');
                    setSocials({
                        instagram: ownedBar.socialMedia?.instagram || '',
                        facebook:  ownedBar.socialMedia?.facebook  || '',
                        twitter:   ownedBar.socialMedia?.twitter   || '',
                        whatsapp:  ownedBar.socialMedia?.whatsapp  || '',
                        telegram:  ownedBar.socialMedia?.telegram  || '',
                        website:   ownedBar.socialMedia?.website   || '',
                    });
                    // Filtrar amenitats invàlides/legacy que no existeixen a AMENITY_OPTIONS
                    const validKeys = new Set(AMENITY_OPTIONS.map(o => o.key));
                    setSelectedAmenities(new Set((ownedBar.amenities || []).filter(a => validKeys.has(a))));
                    setBroadcastingIds(new Set(ownedBar.broadcastingMatches || []));

                    // Carregar placeDetails i ressenyes per a la previsualització
                    const cleanName = ownedBar.name.replace(/\s+\d+$/, '');
                    setLoadingPlaceDetails(true);
                    fetchBarPlaceDetails(cleanName, ownedBar.latitude, ownedBar.longitude, ownedBar.googlePlaceId)
                        .then(details => setPlaceDetails(details))
                        .catch(() => setPlaceDetails(null))
                        .finally(() => setLoadingPlaceDetails(false));
                    getBarReviewStats(ownedBar.id)
                        .then(stats => setReviewStats(stats))
                        .catch(() => {});

                    // Carregar preferències de notificacions
                    getUserPreferences(user.id)
                        .then(prefs => {
                            if (prefs.barOwnerNotifications) setNotifPrefs(prefs.barOwnerNotifications);
                        })
                        .catch(() => {});

                    // Carregar estat de la subscripció
                    getSubscriptionStatus()
                        .then(status => {
                            if (status.billingCycle) setBillingCycle(status.billingCycle);
                            setSubscriptionActive(status.active);
                        })
                        .catch(() => {});
                }

                // Comprovar permís de notificacions
                setNotifPermission(getNotificationPermissionStatus());

                const { matches } = await fetchAllMatches();
                const now = new Date();
                const future = matches
                    .filter(m => {
                        const d = (m.date as any)?.toDate ? (m.date as any).toDate() : new Date(m.date as any);
                        return d > now;
                    })
                    .sort((a, b) => {
                        const dA = (a.date as any)?.toDate ? (a.date as any).toDate() : new Date(a.date as any);
                        const dB = (b.date as any)?.toDate ? (b.date as any).toDate() : new Date(b.date as any);
                        return dA.getTime() - dB.getTime();
                    })
                    .slice(0, 20);
                setUpcomingMatches(future);
            } catch (e) {
                console.error('Error loading bar dashboard:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [user]);

    /* ── Notificacions push (registrar token + escoltar en primer pla) ───── */
    useEffect(() => {
        if (!user) return;
        let unsubscribe: (() => void) | null = null;

        (async () => {
            const result = await registerPushNotifications(user.id);
            setNotifPermission(result === 'granted' ? 'granted' : result === 'blocked' ? 'denied' : getNotificationPermissionStatus());
            unsubscribe = await listenForegroundMessages((payload: { title: string; body: string }) => {
                showToast(`${payload.title}: ${payload.body}`, 'success');
                setNotifications(prev => [
                    { id: Date.now().toString(), title: payload.title, body: payload.body, time: new Date() },
                    ...prev,
                ].slice(0, 50));
            });
        })();

        return () => { if (unsubscribe) unsubscribe(); };
    }, [user, showToast]);

    /* ── Helpers ───────────────────────────────────────────────────────────── */
    const configuredSocials = Object.values(socials).filter(v => v.trim()).length;

    /* ── Desar per secció ─────────────────────────────────────────────────── */
    const handleSaveSection = async (section: Section) => {
        if (!bar) return;
        setSaving(true);
        try {
            let localUpdate: Partial<Bar> = {};
            switch (section) {
                case 'description':
                    localUpdate = { description: description.trim() };
                    await updateBarProfile(bar.id, localUpdate);
                    break;
                case 'promotions':
                    localUpdate = { promotionalText: promotionalText.trim() || undefined };
                    await updateBarProfile(bar.id, { promotionalText: promotionalText.trim() || null } as any);
                    break;
                case 'socials': {
                    const clean: Record<string, string> = {};
                    for (const net of SOCIAL_NETWORKS) {
                        const val = socials[net.key]?.trim();
                        if (val) clean[net.key] = val;
                    }
                    localUpdate = { socialMedia: clean as any };
                    await updateBarProfile(bar.id, { socialMedia: clean as any });
                    break;
                }
                case 'amenities':
                    localUpdate = { amenities: Array.from(selectedAmenities) };
                    await updateBarProfile(bar.id, { amenities: Array.from(selectedAmenities) });
                    break;
                case 'matches':
                    localUpdate = { broadcastingMatches: Array.from(broadcastingIds) };
                    await updateBarProfile(bar.id, { broadcastingMatches: Array.from(broadcastingIds) });
                    break;
            }
            // Actualitzar l'estat local perquè la targeta reflecteixi els canvis
            setBar(prev => prev ? { ...prev, ...localUpdate } : prev);
            showToast('Canvis desats correctament', 'success');
            closeSheet();
        } catch (e) {
            console.error('Error saving:', e);
            showToast('Error en desar els canvis', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigation.reset({ index: 0, routes: [{ name: 'Map' }] });
    };

    /* ── Definició seccions perfil ─────────────────────────────────────────── */
    const profileSections: { key: Section; icon: any; title: string; subtitle: string; hasContent: boolean }[] = [
        {
            key: 'description', icon: 'file-text', title: 'Descripció',
            subtitle: description.trim()
                ? description.trim().substring(0, 50) + (description.trim().length > 50 ? '…' : '')
                : 'No definida',
            hasContent: !!description.trim(),
        },
        {
            key: 'promotions', icon: 'zap', title: 'Promoció',
            subtitle: promotionalText.trim()
                ? promotionalText.trim().substring(0, 50) + (promotionalText.trim().length > 50 ? '…' : '')
                : 'Cap promoció activa',
            hasContent: !!promotionalText.trim(),
        },
        {
            key: 'socials', icon: 'share-2', title: 'Xarxes Socials',
            subtitle: configuredSocials > 0
                ? `${configuredSocials} ${configuredSocials === 1 ? 'configurada' : 'configurades'}`
                : 'Cap configurada',
            hasContent: configuredSocials > 0,
        },
        {
            key: 'amenities', icon: 'check-circle', title: 'Serveis',
            subtitle: selectedAmenities.size > 0
                ? `${selectedAmenities.size} ${selectedAmenities.size === 1 ? 'seleccionat' : 'seleccionats'}`
                : 'Cap seleccionat',
            hasContent: selectedAmenities.size > 0,
        },
        {
            key: 'matches', icon: 'tv', title: 'Partits que emets',
            subtitle: broadcastingIds.size > 0
                ? `${broadcastingIds.size} ${broadcastingIds.size === 1 ? 'partit marcat' : 'partits marcats'}`
                : 'Cap configurat',
            hasContent: broadcastingIds.size > 0,
        },
    ];

    /* ═══════════════════════════════════════════════════════════════════════
       LOADING / EMPTY
    ═══════════════════════════════════════════════════════════════════════ */
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="white" />
                    <Text style={styles.loadingText}>Carregant…</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!bar) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <View style={{ width: 36 }} />
                    <Text style={styles.headerTitle}>Panell del bar</Text>
                    <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
                        <Feather name="log-out" size={18} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                </View>
                <View style={styles.centered}>
                    <Feather name="alert-circle" size={48} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.emptyTitle}>No s'ha trobat cap bar assignat</Text>
                    <Text style={styles.emptySubtitle}>
                        Contacta amb nosaltres per vincular el teu bar.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    /* ═══════════════════════════════════════════════════════════════════════
       TAB 1: MAPA — Previsualització del bar tal com el veuen els usuaris
    ═══════════════════════════════════════════════════════════════════════ */
    const renderMapTab = () => (
        <View style={{ flex: 1, position: 'relative' }}>
            {/* Mapa a pantalla completa */}
            <View style={styles.mapFullContainer}>
                {Platform.OS === 'web' && MapboxMap && mapLoaded ? (
                    <MapboxMap
                        mapLib={(window as any).maplibregl}
                        initialViewState={{
                            longitude: bar.longitude,
                            latitude: bar.latitude,
                            zoom: 15,
                        }}
                        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
                        style={{ width: '100%', height: '100%' }}
                        attributionControl={false}
                    />
                ) : (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color="white" />
                        <Text style={styles.loadingText}>Carregant mapa…</Text>
                    </View>
                )}
            </View>

            {/* Overlay: targeta + fletxa + pin, centrats sobre el mapa */}
            {Platform.OS === 'web' && MapboxMap && mapLoaded && (
                <View style={styles.mapPinOverlay} pointerEvents="box-none">
                    {/* Columna que creix cap amunt des del centre del viewport */}
                    <View style={styles.mapPinColumn}>
                        <View style={styles.mapPopupCard}>
                            <BarCard
                                name={bar.name}
                                address={bar.address}
                                latitude={bar.latitude}
                                longitude={bar.longitude}
                                placeDetails={placeDetails}
                                loadingPlaceDetails={loadingPlaceDetails}
                                verified={true}
                                fallbackRating={bar.rating}
                                fallbackIsOpen={isOpenNow(bar.openingPeriods)}
                                tier={bar.tier || 'premium'}
                                onProfileOpen={() => setShowBarProfile(true)}
                                onNavigate={() => {
                                    const q = encodeURIComponent(`${bar.name}, ${bar.address || 'Barcelona'}`);
                                    if (Platform.OS === 'web') {
                                        window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
                                    }
                                }}
                                reviewAvgRating={reviewStats.averageRating}
                                reviewCount={reviewStats.totalReviews}
                            />
                        </View>
                        {/* Fletxa apuntant cap avall */}
                        <View style={styles.mapPopupArrow} />
                        {/* Pin 3D */}
                        <View style={{ alignItems: 'center' }}>
                            <View style={{ position: 'relative' }}>
                                <View style={{
                                    width: 34, height: 34, borderRadius: 17,
                                    borderBottomRightRadius: 2,
                                    transform: [{ rotate: '45deg' }],
                                    justifyContent: 'center', alignItems: 'center',
                                    backgroundColor: SKETCH_THEME.colors.primary,
                                    ...Platform.select({
                                        web: {
                                            background: `linear-gradient(135deg, ${SKETCH_THEME.colors.primary} 0%, #003270 100%)`,
                                            boxShadow: '0px 4px 10px rgba(0,0,0,0.35), inset 0px 1px 2px rgba(255,255,255,0.3)',
                                        },
                                    }),
                                }}>
                                    <View style={{
                                        width: 16, height: 16, borderRadius: 8,
                                        backgroundColor: 'white',
                                        transform: [{ rotate: '-45deg' }],
                                        ...Platform.select({
                                            web: { boxShadow: 'inset 0px 1px 3px rgba(0,0,0,0.15), 0px 1px 1px rgba(255,255,255,0.4)' },
                                        }),
                                    }} />
                                </View>
                                {/* Insígnia premium */}
                                <View style={{
                                    position: 'absolute', top: -4, right: -6,
                                    width: 20, height: 20, borderRadius: 10,
                                    backgroundColor: '#edbb00', justifyContent: 'center', alignItems: 'center',
                                    borderWidth: 2, borderColor: 'white',
                                    ...Platform.select({
                                        web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.3)' },
                                    }),
                                }}>
                                    <Feather name="star" size={10} color="white" />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );

    /* ═══════════════════════════════════════════════════════════════════════
       TAB 2: PERFIL (targetes de secció)
    ═══════════════════════════════════════════════════════════════════════ */
    const renderProfileTab = () => (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.panelSubtitle}>Gestiona el teu bar</Text>
            {profileSections.map(sec => (
                <TouchableOpacity
                    key={sec.key}
                    style={styles.sectionCard}
                    onPress={() => openSheet(sec.key)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.sectionCardIcon, sec.hasContent && styles.sectionCardIconActive]}>
                        <Feather name={sec.icon} size={20} color={sec.hasContent ? 'white' : 'rgba(255,255,255,0.4)'} />
                    </View>
                    <View style={styles.sectionCardInfo}>
                        <Text style={styles.sectionCardTitle}>{sec.title}</Text>
                        <Text
                            style={[styles.sectionCardSubtitle, sec.hasContent && styles.sectionCardSubtitleActive]}
                            numberOfLines={1}
                        >{sec.subtitle}</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    /* ═══════════════════════════════════════════════════════════════════════
       TAB 3: CONFIGURACIÓ
    ═══════════════════════════════════════════════════════════════════════ */
    const currentTier = bar.tier || 'premium';

    const NOTIF_OPTIONS: { key: keyof BarOwnerNotificationPreferences; label: string; desc: string; icon: string }[] = [
        { key: 'newReviews', label: 'Noves ressenyes', desc: 'Quan algú escriu una ressenya al teu bar', icon: 'message-circle' },
        { key: 'newRatings', label: 'Noves valoracions', desc: 'Quan algú puntua el teu bar', icon: 'star' },
        { key: 'upcomingMatches', label: 'Partits propers', desc: 'Recordatori dels partits que emets', icon: 'tv' },
        { key: 'newFollowers', label: 'Nous seguidors', desc: 'Quan algú comença a seguir el teu bar', icon: 'user-plus' },
    ];

    const handleSaveNotifPrefs = async () => {
        if (!user) return;
        try {
            await updateUserPreferences(user.id, { barOwnerNotifications: notifPrefs } as any);
            showToast('Preferències desades', 'success');
            setShowNotifPrefs(false);
        } catch (e) {
            showToast('Error en desar les preferències', 'error');
        }
    };

    const renderSettingsTab = () => (
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Pla actual */}
                <Text style={styles.settingSectionTitle}>Subscripció</Text>
                <View style={styles.planCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="award" size={20} color="#ffd700" />
                            <Text style={styles.planName}>  {currentTier === 'premium' ? 'Premium' : 'Gratuït'}</Text>
                        </View>
                        <View style={{ backgroundColor: subscriptionActive ? 'rgba(255,215,0,0.2)' : 'rgba(165,0,68,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ color: subscriptionActive ? '#ffd700' : '#a50044', fontSize: 11, fontWeight: '700' }}>
                                {subscriptionActive ? 'ACTIU' : 'INACTIU'}
                            </Text>
                        </View>
                    </View>

                    {currentTier === 'premium' && (
                        <View style={{ marginTop: 12 }}>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 10 }}>Periodicitat</Text>
                            <View style={{ flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                                {([{ key: 'monthly' as const, label: 'Mensual', price: '39€/mes', save: null },
                                   { key: 'quarterly' as const, label: 'Trimestral', price: '33€/mes', save: '-15%' },
                                   { key: 'annual' as const, label: 'Anual', price: '29€/mes', save: '-25%' }]
                                ).map(opt => (
                                    <TouchableOpacity
                                        key={opt.key}
                                        style={{
                                            flex: 1, paddingVertical: 10, alignItems: 'center',
                                            backgroundColor: billingCycle === opt.key ? '#edbb00' : 'rgba(255,255,255,0.06)',
                                        }}
                                        onPress={() => {
                                            if (opt.key === billingCycle) return;
                                            setPendingBillingCycle(opt.key);
                                            setShowBillingConfirm(true);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>{opt.label}</Text>
                                        <Text style={{ color: billingCycle === opt.key ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{opt.price}</Text>
                                        {opt.save && (
                                            <Text style={{ color: billingCycle === opt.key ? 'white' : '#edbb00', fontSize: 10, fontWeight: '700', marginTop: 1 }}>{opt.save}</Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
                                {billingCycle === 'monthly' ? 'Facturat 39€/mes' : billingCycle === 'quarterly' ? 'Facturat 99€ cada 3 mesos · Estalvies 72€/any' : 'Facturat 348€/any · Estalvies 120€/any'}
                            </Text>

                            {/* Botó gestionar pagament */}
                            {!subscriptionActive && (
                                <TouchableOpacity
                                    style={{
                                        marginTop: 12, paddingVertical: 10, paddingHorizontal: 16,
                                        borderRadius: 10, backgroundColor: '#edbb00',
                                        alignItems: 'center',
                                    }}
                                    onPress={() => openCheckout(billingCycle).catch(e => showToast('Error obrint el pagament: ' + e.message, 'error'))}
                                    activeOpacity={0.7}
                                >
                                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Activar subscripció</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                <View style={styles.settingDivider} />

                {/* Notificacions */}
                <Text style={styles.settingSectionTitle}>Notificacions</Text>

                <View style={styles.planCard}>
                    {/* Botó de configurar preferències */}
                    <TouchableOpacity
                        style={{
                            flexDirection: 'row', alignItems: 'center', marginTop: 10,
                            paddingVertical: 10, paddingHorizontal: 14,
                            borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)',
                            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                        }}
                        onPress={() => setShowNotifPrefs(true)}
                        activeOpacity={0.7}
                    >
                        <Feather name="sliders" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 10 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>Preferències de notificacions</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 1 }}>
                                Tria quines notificacions vols rebre
                            </Text>
                        </View>
                        <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                </View>

                <View style={styles.settingDivider} />

                {/* Legal */}
                <Text style={styles.settingSectionTitle}>Legal i suport</Text>

                <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => navigation.navigate('TermsOfService')}
                    activeOpacity={0.6}
                >
                    <View style={styles.settingRowLeft}>
                        <View style={styles.settingRowIcon}>
                            <Feather name="file-text" size={16} color="rgba(255,255,255,0.6)" />
                        </View>
                        <Text style={styles.settingRowText}>Termes del servei</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => navigation.navigate('PrivacyPolicy')}
                    activeOpacity={0.6}
                >
                    <View style={styles.settingRowLeft}>
                        <View style={styles.settingRowIcon}>
                            <Feather name="shield" size={16} color="rgba(255,255,255,0.6)" />
                        </View>
                        <Text style={styles.settingRowText}>Política de privacitat</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => {
                        const email = 'contacte@trobar.cat';
                        if (Platform.OS === 'web') {
                            window.open(`mailto:${email}`, '_blank');
                        }
                    }}
                    activeOpacity={0.6}
                >
                    <View style={styles.settingRowLeft}>
                        <View style={styles.settingRowIcon}>
                            <Feather name="mail" size={16} color="rgba(255,255,255,0.6)" />
                        </View>
                        <Text style={styles.settingRowText}>Contactar amb suport</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>

                {/* Logout + eliminar + versió (dins del scroll) */}
                <View style={styles.settingsFooter}>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
                        <Feather name="log-out" size={16} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.logoutText}>  Tancar sessió</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            setDeleteStep(1);
                            setDeleteConfirmText('');
                            setShowDeleteModal(true);
                        }}
                        disabled={isDeleting}
                        style={{ alignSelf: 'center', padding: 10, marginTop: 4, opacity: isDeleting ? 0.4 : 0.7 }}
                    >
                        <Text style={{ color: 'rgba(255,255,255,0.45)', fontWeight: '600', fontSize: 12, textDecorationLine: 'underline' }}>
                            {isDeleting ? 'Eliminant...' : 'Eliminar el compte'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.versionText}>troBar v1.3.0 · @frolesti · 2026</Text>
                </View>
            </ScrollView>
        </View>
    );

    /* ═══════════════════════════════════════════════════════════════════════
       CONTINGUT BOTTOM SHEET (edició)
    ═══════════════════════════════════════════════════════════════════════ */
    const renderSheetContent = () => {
        switch (activeSection) {
            case 'description':
                return (
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        multiline value={description} onChangeText={setDescription}
                        placeholder="Escriu una descripció del teu bar…"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        textAlignVertical="top"
                    />
                );
            case 'promotions':
                return (
                    <View>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 10, lineHeight: 18 }}>
                            Escriu una promoció que es mostrarà destacada al perfil del teu bar. Deixa-ho buit per treure-la.
                        </Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            multiline value={promotionalText} onChangeText={setPromotionalText}
                            placeholder="Ex: Happy Hour els dies de partit: 2x1 en cerveses fins al xiulet inicial!"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            textAlignVertical="top"
                        />
                    </View>
                );
            case 'socials':
                return (
                    <View>
                        {SOCIAL_NETWORKS.map(net => (
                            <View key={net.key} style={styles.socialRow}>
                                <View style={styles.socialIconWrap}>
                                    <Feather name={net.icon} size={16} color={
                                        socials[net.key]?.trim() ? 'white' : 'rgba(255,255,255,0.35)'
                                    } />
                                </View>
                                <View style={styles.socialInputWrap}>
                                    <Text style={styles.socialLabel}>{net.label}</Text>
                                    <TextInput
                                        style={styles.socialInput}
                                        value={socials[net.key] || ''}
                                        onChangeText={v => setSocials(prev => ({ ...prev, [net.key]: v }))}
                                        placeholder={net.placeholder}
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        autoCapitalize="none" autoCorrect={false}
                                        keyboardType={net.key === 'whatsapp' ? 'phone-pad' : 'url'}
                                    />
                                </View>
                                {socials[net.key]?.trim() ? (
                                    <TouchableOpacity style={styles.socialClear}
                                        onPress={() => setSocials(prev => ({ ...prev, [net.key]: '' }))}>
                                        <Feather name="x" size={14} color="rgba(255,255,255,0.5)" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ))}
                    </View>
                );
            case 'amenities':
                return (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {AMENITY_OPTIONS.map(opt => {
                            const isActive = selectedAmenities.has(opt.key);
                            const IconComp = opt.iconFamily === 'mci' ? MaterialCommunityIcons : Feather;
                            return (
                                <TouchableOpacity
                                    key={opt.key}
                                    style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                                    onPress={() => {
                                        setSelectedAmenities(prev => {
                                            const next = new Set(prev);
                                            next.has(opt.key) ? next.delete(opt.key) : next.add(opt.key);
                                            return next;
                                        });
                                    }}
                                >
                                    <IconComp name={opt.icon as any} size={14} color={isActive ? 'white' : 'rgba(255,255,255,0.4)'} />
                                    <Text style={[styles.chipText, { color: isActive ? 'white' : 'rgba(255,255,255,0.4)' }]}>{opt.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                );
            case 'matches': {
                const getTeam = (t: any) => {
                    if (typeof t === 'object' && t !== null) {
                        return { name: t.shortName || t.name || '', crest: t.crest || t.badge || null };
                    }
                    return { name: String(t || ''), crest: null };
                };

                const isFemenino = (m: Match) =>
                    m.category === 'FEMENI' || m.category === 'femenino'
                    || (m.competition?.name || '').toLowerCase().match(/femen|women|uwcl|liga\s*f/);

                const filteredMatches = matchGenderFilter === 'all'
                    ? upcomingMatches
                    : matchGenderFilter === 'femenino'
                        ? upcomingMatches.filter(m => isFemenino(m))
                        : upcomingMatches.filter(m => !isFemenino(m));

                const allFilteredSelected = filteredMatches.length > 0 && filteredMatches.every(m => broadcastingIds.has(m.id));

                const resolveCompLogo = (m: Match) => {
                    const name = (m.competition?.name || '').toLowerCase();
                    if (name.includes('women') && name.includes('champions')) return require('../../../assets/img/competicions/champions-w.png');
                    if (name.includes('uwcl')) return require('../../../assets/img/competicions/champions-w.png');
                    if (name.includes('champions')) return require('../../../assets/img/competicions/champions.png');
                    if (name.includes('copa') && (name.includes('reina') || name.includes('queen'))) return require('../../../assets/img/competicions/copa-reina.png');
                    if (name.includes('copa') || name.includes('king')) return require('../../../assets/img/competicions/copa-del-rey.png');
                    if (name.includes('liga f') || name.includes('femen')) return require('../../../assets/img/competicions/ligaf.png');
                    if (name.includes('primera') || name.includes('la liga') || name.includes('liga')) return require('../../../assets/img/competicions/liga.png');
                    return null;
                };

                return (
                    <View>
                        {/* Filtre gènere */}
                        <View style={styles.genderFilterRow}>
                            {(['all', 'masculino', 'femenino'] as const).map(g => (
                                <TouchableOpacity
                                    key={g}
                                    style={[styles.genderFilterBtn, matchGenderFilter === g && styles.genderFilterBtnActive]}
                                    onPress={() => setMatchGenderFilter(g)}
                                >
                                    <Text style={[styles.genderFilterText, matchGenderFilter === g && styles.genderFilterTextActive]}>
                                        {g === 'all' ? 'Tots' : g === 'masculino' ? '♂ Masculí' : '♀ Femení'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Botó seleccionar / deseleccionar tots */}
                        {filteredMatches.length > 0 && (
                            <TouchableOpacity
                                style={styles.selectAllBtn}
                                onPress={() => {
                                    setBroadcastingIds(prev => {
                                        const next = new Set(prev);
                                        if (allFilteredSelected) {
                                            filteredMatches.forEach(m => next.delete(m.id));
                                        } else {
                                            filteredMatches.forEach(m => next.add(m.id));
                                        }
                                        return next;
                                    });
                                }}
                                activeOpacity={0.7}
                            >
                                <Feather name={allFilteredSelected ? 'x-square' : 'check-square'} size={14} color="#edbb00" />
                                <Text style={styles.selectAllText}>
                                    {allFilteredSelected ? 'Deseleccionar tots' : 'Seleccionar tots'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {filteredMatches.map(match => {
                            const isSelected = broadcastingIds.has(match.id);
                            const home = getTeam(match.homeTeam);
                            const away = getTeam(match.awayTeam);
                            const d = (match.date as any)?.toDate ? (match.date as any).toDate() : new Date(match.date as any);
                            const dateStr = d.toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                            const isFem = isFemenino(match);
                            const compLogo = resolveCompLogo(match);
                            return (
                                <TouchableOpacity
                                    key={match.id}
                                    style={[styles.matchRow, isSelected && styles.matchRowActive]}
                                    onPress={() => {
                                        setBroadcastingIds(prev => {
                                            const next = new Set(prev);
                                            next.has(match.id) ? next.delete(match.id) : next.add(match.id);
                                            return next;
                                        });
                                    }}
                                >
                                    <View style={[styles.matchCheck, isSelected && styles.matchCheckActive]}>
                                        {isSelected && <Feather name="check" size={14} color="white" />}
                                    </View>
                                    {/* Escuts junts amb competició entremig */}
                                    <View style={styles.matchCrests}>
                                        {home.crest ? (
                                            <Image source={{ uri: home.crest }} style={styles.matchCrest} resizeMode="contain" />
                                        ) : (
                                            <Ionicons name="shield-outline" size={22} color="rgba(255,255,255,0.3)" />
                                        )}
                                        {compLogo ? (
                                            <Image source={compLogo} style={styles.matchCompLogo} resizeMode="contain" />
                                        ) : (
                                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginHorizontal: 2 }}>vs</Text>
                                        )}
                                        {away.crest ? (
                                            <Image source={{ uri: away.crest }} style={styles.matchCrest} resizeMode="contain" />
                                        ) : (
                                            <Ionicons name="shield-outline" size={22} color="rgba(255,255,255,0.3)" />
                                        )}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.matchTeams} numberOfLines={1}>
                                            {home.name} vs {away.name}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                            <Text style={styles.matchDate}>{dateStr}</Text>
                                            {isFem && (
                                                <View style={styles.matchGenderBadge}>
                                                    <Text style={styles.matchGenderBadgeText}>♀ Fem</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                        {filteredMatches.length === 0 && (
                            <Text style={styles.emptySubtitle}>
                                {matchGenderFilter === 'all' ? 'No hi ha partits programats.' : 'No hi ha partits d\'aquesta categoria.'}
                            </Text>
                        )}
                    </View>
                );
            }
            default: return null;
        }
    };

    const SHEET_TITLES: Record<Section, string> = {
        description: 'Descripció',
        promotions: 'Promoció',
        socials: 'Xarxes Socials',
        amenities: 'Serveis',
        matches: 'Partits que emets',
    };

    /* ═══════════════════════════════════════════════════════════════════════
       RENDER PRINCIPAL
    ═══════════════════════════════════════════════════════════════════════ */
    return (
        <SafeAreaView style={styles.container}>
            {/* ── Capçalera ── (oculta si estem al mapa) ──── */}
            {activeTab !== 'map' && (
                <View style={styles.header}>
                    <View style={{ width: 36 }} />
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {activeTab === 'settings' ? 'Configuració' : bar.name}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowNotifications(prev => !prev)}
                        style={styles.headerBtn}
                    >
                        <Feather name="bell" size={18} color="rgba(255,255,255,0.7)" />
                        {notifications.length > 0 && (
                            <View style={{
                                position: 'absolute', top: 2, right: 2,
                                minWidth: 16, height: 16, borderRadius: 8,
                                backgroundColor: '#a50044',
                                alignItems: 'center', justifyContent: 'center',
                                paddingHorizontal: 4,
                            }}>
                                <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>
                                    {notifications.length > 99 ? '99+' : notifications.length}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Contingut de la pestanya activa ─────────────────── */}
            <View style={{ flex: 1 }}>
                {activeTab === 'map' && renderMapTab()}
                {activeTab === 'profile' && renderProfileTab()}
                {activeTab === 'settings' && renderSettingsTab()}
            </View>

            {/* ── Toast ───────────────────────────────────────────── */}
            {toast && (
                <Animated.View style={[
                    styles.toast,
                    toast.type === 'error' ? styles.toastError : styles.toastSuccess,
                    { opacity: toastOpacity },
                ]}>
                    <Feather
                        name={toast.type === 'error' ? 'alert-circle' : 'check-circle'}
                        size={16} color="white"
                    />
                    <Text style={styles.toastText}>{toast.message}</Text>
                </Animated.View>
            )}

            {/* ── Bottom sheet d'edició ────────────────────────────── */}
            {activeSection !== null && (
                <View style={styles.sheetOverlay} pointerEvents="box-none">
                    {/* Fons tàctil per tancar */}
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={closeSheet}
                        style={styles.sheetBackdrop}
                    />
                    <Animated.View style={[
                        styles.sheetContainer,
                        { transform: [{ translateY: sheetTranslateY }] },
                    ]}>
                        {/* Indicador drag */}
                        <View style={styles.sheetDragBar} />

                        {/* Capçalera */}
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>
                                {activeSection ? SHEET_TITLES[activeSection] : ''}
                            </Text>
                            <TouchableOpacity onPress={closeSheet} style={styles.sheetCloseBtn}>
                                <Feather name="x" size={20} color="white" />
                            </TouchableOpacity>
                        </View>

                        {/* Cos */}
                        <ScrollView
                            contentContainerStyle={styles.sheetBody}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {renderSheetContent()}
                        </ScrollView>

                        {/* Botó desar */}
                        <View style={styles.sheetFooter}>
                            <TouchableOpacity
                                onPress={() => activeSection && handleSaveSection(activeSection)}
                                style={styles.saveButton}
                                disabled={saving} activeOpacity={0.8}
                            >
                                {saving ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Desar canvis</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            )}

            {/* ── Barra de navegació inferior ─────────────────────── */}
            <View style={styles.bottomNav}>
                {/* Mapa */}
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => { closeSheet(); setActiveTab('map'); }}
                >
                    <Ionicons
                        name={activeTab === 'map' ? 'map' : 'map-outline'}
                        size={24}
                        color={activeTab === 'map' ? 'white' : SKETCH_THEME.colors.mutedInverse}
                    />
                    <Text style={[styles.navLabel, activeTab === 'map' && styles.navLabelActive]}>
                        Mapa
                    </Text>
                </TouchableOpacity>

                {/* Perfil */}
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => { closeSheet(); setActiveTab('profile'); }}
                >
                    <Ionicons
                        name={activeTab === 'profile' ? 'home' : 'home-outline'}
                        size={24}
                        color={activeTab === 'profile' ? 'white' : SKETCH_THEME.colors.mutedInverse}
                    />
                    <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>
                        Perfil
                    </Text>
                </TouchableOpacity>

                {/* Configuració */}
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => { closeSheet(); setActiveTab('settings'); }}
                >
                    <Ionicons
                        name={activeTab === 'settings' ? 'settings' : 'settings-outline'}
                        size={24}
                        color={activeTab === 'settings' ? 'white' : SKETCH_THEME.colors.mutedInverse}
                    />
                    <Text style={[styles.navLabel, activeTab === 'settings' && styles.navLabelActive]}>
                        Configuració
                    </Text>
                </TouchableOpacity>
            </View>
            {/* ── Panell de notificacions (dropdown) ─────────────── */}
            {showNotifications && (
                <View style={{
                    position: 'absolute', top: 60, right: 12, width: 320,
                    maxHeight: 400, borderRadius: 14,
                    backgroundColor: '#3a0018',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                    zIndex: 200,
                    ...Platform.select({
                        web: { boxShadow: '0 8px 32px rgba(0,0,0,0.5)' },
                    }),
                }}>
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 16, paddingVertical: 12,
                        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)',
                    }}>
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Notificacions</Text>
                        {notifications.length > 0 && (
                            <TouchableOpacity onPress={() => setNotifications([])}>
                                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>Esborrar tot</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                        {notifications.length === 0 ? (
                            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                                <Feather name="bell-off" size={32} color="rgba(255,255,255,0.2)" />
                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 10 }}>
                                    Cap notificació encara
                                </Text>
                            </View>
                        ) : (
                            notifications.map(n => (
                                <View key={n.id} style={{
                                    paddingHorizontal: 16, paddingVertical: 12,
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                    borderBottomColor: 'rgba(255,255,255,0.06)',
                                }}>
                                    <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>{n.title}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>{n.body}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 }}>
                                        {n.time.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            )}

            {/* Backdrop per tancar notificacions */}
            {showNotifications && (
                <TouchableOpacity
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 199 }}
                    activeOpacity={1}
                    onPress={() => setShowNotifications(false)}
                />
            )}

            {/* ── Modal preferències de notificacions ─────────────── */}
            {showNotifPrefs && (
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 300, justifyContent: 'center', alignItems: 'center',
                }}>
                    {/* Backdrop */}
                    <TouchableOpacity
                        style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                        }}
                        activeOpacity={1}
                        onPress={() => setShowNotifPrefs(false)}
                    />
                    <View style={{
                        width: '90%', maxWidth: 400, borderRadius: 18,
                        backgroundColor: '#3a0018',
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                        ...Platform.select({
                            web: { boxShadow: '0 12px 40px rgba(0,0,0,0.6)' },
                        }),
                    }}>
                        {/* Capçalera modal */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingHorizontal: 20, paddingVertical: 16,
                            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)',
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Feather name="bell" size={20} color="#ffd700" />
                                <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Preferències</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowNotifPrefs(false)} style={styles.headerBtn}>
                                <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>

                        {/* Opcions */}
                        <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 14 }}>
                                Tria quines notificacions vols rebre al teu dispositiu.
                            </Text>
                            {NOTIF_OPTIONS.map(opt => {
                                const isActive = notifPrefs[opt.key];
                                return (
                                    <TouchableOpacity
                                        key={opt.key}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center',
                                            paddingVertical: 14,
                                            borderBottomWidth: StyleSheet.hairlineWidth,
                                            borderBottomColor: 'rgba(255,255,255,0.06)',
                                        }}
                                        onPress={() => setNotifPrefs(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{
                                            width: 36, height: 36, borderRadius: 10,
                                            backgroundColor: isActive ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)',
                                            alignItems: 'center', justifyContent: 'center',
                                            marginRight: 12,
                                        }}>
                                            <Feather name={opt.icon as any} size={16} color={isActive ? '#ffd700' : 'rgba(255,255,255,0.35)'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>{opt.label}</Text>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 }}>{opt.desc}</Text>
                                        </View>
                                        {/* Toggle */}
                                        <View style={{
                                            width: 44, height: 26, borderRadius: 13,
                                            backgroundColor: isActive ? '#edbb00' : 'rgba(255,255,255,0.12)',
                                            justifyContent: 'center',
                                            paddingHorizontal: 2,
                                        }}>
                                            <View style={{
                                                width: 22, height: 22, borderRadius: 11,
                                                backgroundColor: 'white',
                                                alignSelf: isActive ? 'flex-end' : 'flex-start',
                                                ...Platform.select({
                                                    web: { boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
                                                }),
                                            }} />
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Botó desar */}
                        <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
                            <TouchableOpacity
                                style={[styles.saveButton, { marginHorizontal: 0 }]}
                                onPress={handleSaveNotifPrefs}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.saveButtonText}>Desar preferències</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* ── Perfil premium modal ───────────────────────────── */}
            {bar && (
                <BarProfileModal
                    visible={showBarProfile}
                    bar={bar}
                    placeDetails={placeDetails}
                    allMatches={upcomingMatches}
                    onClose={() => setShowBarProfile(false)}
                    onNavigate={() => {
                        if (bar) {
                            const query = encodeURIComponent(`${bar.name}, ${bar.address || 'Barcelona'}`);
                            if (Platform.OS === 'web') {
                                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                            }
                        }
                    }}
                />
            )}

            {/* ═══════════════════════════════════════════════════════════════
               MODAL: Confirmació canvi de pla de facturació
            ═══════════════════════════════════════════════════════════════ */}
            {showBillingConfirm && pendingBillingCycle && (
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 400, justifyContent: 'center', alignItems: 'center',
                }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
                        activeOpacity={1}
                        onPress={() => { setShowBillingConfirm(false); setPendingBillingCycle(null); }}
                    />
                    <View style={{
                        width: '90%', maxWidth: 420, borderRadius: 18,
                        backgroundColor: '#3a0018',
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                        ...Platform.select({ web: { boxShadow: '0 12px 40px rgba(0,0,0,0.6)' } }),
                    }}>
                        {/* Capçalera */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingHorizontal: 20, paddingVertical: 16,
                            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)',
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Feather name="credit-card" size={20} color="#edbb00" />
                                <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Canviar pla</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setShowBillingConfirm(false); setPendingBillingCycle(null); }} style={styles.headerBtn}>
                                <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>

                        {/* Cos */}
                        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
                            {/* De → A */}
                            <View style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                gap: 16, marginBottom: 20,
                            }}>
                                <View style={{
                                    flex: 1, padding: 12, borderRadius: 12,
                                    backgroundColor: 'rgba(255,255,255,0.06)',
                                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                                    alignItems: 'center',
                                }}>
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>PLA ACTUAL</Text>
                                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{BILLING_PLANS[billingCycle].label}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }}>{BILLING_PLANS[billingCycle].priceLabel}</Text>
                                </View>
                                <Feather name="arrow-right" size={20} color="#edbb00" />
                                <View style={{
                                    flex: 1, padding: 12, borderRadius: 12,
                                    backgroundColor: 'rgba(237,187,0,0.1)',
                                    borderWidth: 1, borderColor: 'rgba(237,187,0,0.3)',
                                    alignItems: 'center',
                                }}>
                                    <Text style={{ color: '#edbb00', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>NOU PLA</Text>
                                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{BILLING_PLANS[pendingBillingCycle].label}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }}>{BILLING_PLANS[pendingBillingCycle].priceLabel}</Text>
                                </View>
                            </View>

                            {/* Info de facturació */}
                            <View style={{
                                padding: 14, borderRadius: 12,
                                backgroundColor: 'rgba(255,255,255,0.04)',
                                marginBottom: 16,
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Feather name="info" size={14} color="rgba(255,255,255,0.5)" style={{ marginRight: 8 }} />
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' }}>Detalls del canvi</Text>
                                </View>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18 }}>
                                    {`• Nou preu: ${BILLING_PLANS[pendingBillingCycle].totalLabel}\n`}
                                    {BILLING_PLANS[pendingBillingCycle].saveYear > 0
                                        ? `• Estalvies ${BILLING_PLANS[pendingBillingCycle].saveYear}€/any respecte al pla mensual\n`
                                        : ''}
                                    {'• El canvi s\'aplicarà immediatament\n'}
                                    {'• Es prorratejarà el que ja has pagat del cicle actual'}
                                </Text>
                            </View>

                            {/* Icona de seguretat Stripe */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                                <Feather name="lock" size={12} color="rgba(255,255,255,0.35)" />
                                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>Pagament segur via Stripe</Text>
                            </View>

                            {/* Botons */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    style={{
                                        flex: 1, paddingVertical: 14, borderRadius: 12,
                                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                                        alignItems: 'center',
                                    }}
                                    onPress={() => { setShowBillingConfirm(false); setPendingBillingCycle(null); }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 }}>Cancel·lar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{
                                        flex: 2, paddingVertical: 14, borderRadius: 12,
                                        backgroundColor: '#edbb00', alignItems: 'center',
                                        opacity: isChangingPlan ? 0.6 : 1,
                                    }}
                                    onPress={async () => {
                                        if (!pendingBillingCycle || isChangingPlan) return;
                                        setIsChangingPlan(true);
                                        try {
                                            await stripeChangeBillingCycle(pendingBillingCycle);
                                            setBillingCycle(pendingBillingCycle);
                                            showToast(`Pla canviat a ${BILLING_PLANS[pendingBillingCycle].label}`, 'success');
                                            setShowBillingConfirm(false);
                                            setPendingBillingCycle(null);
                                        } catch (e: any) {
                                            const msg = e?.message?.replace(/^.*?:\s*/, '') || 'Error canviant el pla';
                                            showToast(msg, 'error');
                                        } finally {
                                            setIsChangingPlan(false);
                                        }
                                    }}
                                    disabled={isChangingPlan}
                                    activeOpacity={0.7}
                                >
                                    {isChangingPlan ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Confirmar canvi</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {/* ═══════════════════════════════════════════════════════════════
               MODAL: Eliminació de compte (2 passos)
            ═══════════════════════════════════════════════════════════════ */}
            {showDeleteModal && (
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 400, justifyContent: 'center', alignItems: 'center',
                }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}
                        activeOpacity={1}
                        onPress={() => { if (!isDeleting) { setShowDeleteModal(false); setDeleteStep(1); setDeleteConfirmText(''); } }}
                    />
                    <View style={{
                        width: '90%', maxWidth: 420, borderRadius: 18,
                        backgroundColor: '#3a0018',
                        borderWidth: 1, borderColor: 'rgba(165,0,68,0.4)',
                        ...Platform.select({ web: { boxShadow: '0 12px 40px rgba(0,0,0,0.6)' } }),
                    }}>
                        {/* Capçalera */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingHorizontal: 20, paddingVertical: 16,
                            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(165,0,68,0.3)',
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Feather name="alert-triangle" size={20} color="#a50044" />
                                <Text style={{ color: '#a50044', fontSize: 18, fontWeight: '700' }}>
                                    {deleteStep === 1 ? 'Eliminar compte' : 'Confirmació final'}
                                </Text>
                            </View>
                            {!isDeleting && (
                                <TouchableOpacity onPress={() => { setShowDeleteModal(false); setDeleteStep(1); setDeleteConfirmText(''); }} style={styles.headerBtn}>
                                    <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Pas 1: Advertència */}
                        {deleteStep === 1 && (
                            <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
                                <View style={{
                                    padding: 16, borderRadius: 14,
                                    backgroundColor: 'rgba(165,0,68,0.1)',
                                    borderWidth: 1, borderColor: 'rgba(165,0,68,0.2)',
                                    marginBottom: 20,
                                }}>
                                    <Text style={{ color: 'white', fontSize: 15, fontWeight: '600', marginBottom: 12 }}>
                                        Estàs segur que vols eliminar el teu compte?
                                    </Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20 }}>
                                        Aquesta acció és <Text style={{ color: '#a50044', fontWeight: '700' }}>irreversible</Text> i comportarà:
                                    </Text>
                                    <View style={{ marginTop: 12 }}>
                                        {[
                                            { icon: 'credit-card', text: 'Cancel·lació immediata de la subscripció' },
                                            { icon: 'x-circle', text: 'Eliminació de les dades del bar del mapa' },
                                            { icon: 'trash-2', text: 'Pèrdua de totes les ressenyes i valoracions' },
                                            { icon: 'user-x', text: 'Eliminació permanent del compte' },
                                        ].map((item, i) => (
                                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                                                <Feather name={item.icon as any} size={14} color="#a50044" style={{ marginRight: 10 }} />
                                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1 }}>{item.text}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        style={{
                                            flex: 1, paddingVertical: 14, borderRadius: 12,
                                            borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                                            alignItems: 'center',
                                        }}
                                        onPress={() => { setShowDeleteModal(false); setDeleteStep(1); }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 }}>No, mantenir</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{
                                            flex: 1, paddingVertical: 14, borderRadius: 12,
                                            backgroundColor: 'rgba(165,0,68,0.15)',
                                            borderWidth: 1, borderColor: 'rgba(165,0,68,0.3)',
                                            alignItems: 'center',
                                        }}
                                        onPress={() => setDeleteStep(2)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: '#a50044', fontWeight: '700', fontSize: 14 }}>Sí, continuar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Pas 2: Confirmació escrivint ELIMINAR */}
                        {deleteStep === 2 && (
                            <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                                    Per confirmar l'eliminació, escriu <Text style={{ color: '#a50044', fontWeight: '700' }}>ELIMINAR</Text> al camp de sota:
                                </Text>
                                <TextInput
                                    style={{
                                        width: '100%', padding: 14, borderRadius: 12,
                                        backgroundColor: 'rgba(255,255,255,0.06)',
                                        borderWidth: 1,
                                        borderColor: deleteConfirmText === 'ELIMINAR' ? 'rgba(165,0,68,0.5)' : 'rgba(255,255,255,0.1)',
                                        color: 'white', fontSize: 16, fontWeight: '700',
                                        textAlign: 'center', letterSpacing: 2,
                                    }}
                                    value={deleteConfirmText}
                                    onChangeText={setDeleteConfirmText}
                                    placeholder="ELIMINAR"
                                    placeholderTextColor="rgba(255,255,255,0.2)"
                                    autoCapitalize="characters"
                                    autoFocus
                                />

                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                                    <TouchableOpacity
                                        style={{
                                            flex: 1, paddingVertical: 14, borderRadius: 12,
                                            borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                                            alignItems: 'center',
                                        }}
                                        onPress={() => { setDeleteStep(1); setDeleteConfirmText(''); }}
                                        disabled={isDeleting}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 }}>← Enrere</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{
                                            flex: 2, paddingVertical: 14, borderRadius: 12,
                                            backgroundColor: deleteConfirmText === 'ELIMINAR' ? '#a50044' : 'rgba(165,0,68,0.2)',
                                            alignItems: 'center',
                                            opacity: isDeleting ? 0.6 : 1,
                                        }}
                                        onPress={async () => {
                                            if (deleteConfirmText !== 'ELIMINAR' || isDeleting) return;
                                            setIsDeleting(true);
                                            try {
                                                await deleteAccount();
                                                // Si hem arribat aquí, el compte s'ha eliminat
                                                // La navegació es fa automàticament via onAuthStateChanged
                                            } catch (e: any) {
                                                showToast(e?.message || 'Error eliminant el compte', 'error');
                                                setIsDeleting(false);
                                            }
                                        }}
                                        disabled={deleteConfirmText !== 'ELIMINAR' || isDeleting}
                                        activeOpacity={0.7}
                                    >
                                        {isDeleting ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <ActivityIndicator color="white" size="small" />
                                                <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Eliminant...</Text>
                                            </View>
                                        ) : (
                                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                                                Eliminar definitivament
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}
