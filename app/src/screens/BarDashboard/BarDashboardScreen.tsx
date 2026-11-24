import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, StyleSheet, Linking, Platform, Switch, AppState, Modal, Animated, Easing, AccessibilityInfo, useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';
import Text from '../../components/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, usePreventRemove, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import AppIcon from '../../components/AppIcon';
import { useAuth } from '../../context/AuthContext';
import { useScreenLoading } from '../../context/SplashContext';
import { Bar, BarAmenity } from '../../models/Bar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { AMENITY_OPTIONS, AMENITY_MAP } from '../../data/amenities';
import { getOwnedBar, updateBarProfile } from '../../services/barOwnerService';
import { fetchAllMatches, Match } from '../../services/matchService';
import { fetchBarPlaceDetails, PlaceDetails, isOpenNow } from '../../services/placesService';
import { getBarReviewStats } from '../../services/reviewService';
import { BarReviewStats } from '../../models/Review';
import { registerPushNotifications, listenForegroundMessages, getNotificationPermissionStatus } from '../../services/notificationService';
import { getUserPreferences, updateUserPreferences } from '../../services/userService';
import BarEmailTips from '../../components/BarEmailTips';
import { BarOwnerNotificationPreferences, DEFAULT_BAR_OWNER_NOTIFICATION_PREFS } from '../../models/UserProfile';
import {
    BillingCycle as StripeBillingCycle,
    BILLING_PLANS,
    changeBillingCycle as stripeChangeBillingCycle,
    cancelSubscription,
    getSubscriptionStatus,
    openCheckout,
    openBillingPortal,
    SubscriptionStatus,
} from '../../services/subscriptionService';
import BarCard from '../../components/BarCard';
import BarProfileModal from '../../components/BarProfileModal';
import { SKETCH_THEME, sketchShadow } from '../../theme/sketchTheme';
import styles, { DASHBOARD_THEME as EDITORIAL } from './BarDashboardScreen.styles';
import profileFooterStyles from '../Profile/SettingsModal.styles';
import { webScreenContainer, webScreenScroll } from '../../utils/webScreenStyles';
import { showAlert } from '../../components/AlertBanner';
import { getUserFriendlyError } from '../../utils/errorHandler';
import { barProfileDraft } from '../../utils/barProfileDraft';
import { reservationUrl } from '../../utils/barReservations';
import OwnerBottomNav from '../../components/OwnerBottomNav';
import { ownerDemoCopy } from '../../data/premiumDemoProfiles';
import MatchCard from '../../components/MatchCard';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';

/* ── Constants ───────────────────────────────────────────────────────────── */
const SOCIAL_NETWORKS = [
    { key: 'instagram', label: 'Instagram', icon: 'instagram' as const, placeholder: 'elnostrebar' },
    { key: 'facebook',  label: 'Facebook',  icon: 'facebook'  as const, placeholder: 'Enllaç a la pàgina del bar' },
    { key: 'twitter',   label: 'X (Twitter)', icon: 'twitter' as const, placeholder: 'elnostrebar' },
    { key: 'whatsapp',  label: 'WhatsApp',  icon: 'phone'    as const, placeholder: '+34 612 345 678' },
    { key: 'telegram',  label: 'Telegram',  icon: 'send'     as const, placeholder: 'elnostrebar' },
    { key: 'website',   label: 'Pàgina web', icon: 'globe'   as const, placeholder: 'Enllaç al web del bar' },
] as const;

type Section = 'description' | 'promotions' | 'socials' | 'amenities' | 'matches' | 'googleRating' | 'reservations';
type Tab = 'profile' | 'settings';

/* ════════════════════════════════════════════════════════════════════════════
   BarDashboardScreen — 3 pestanyes (Mapa / Perfil / Configuració)
   ════════════════════════════════════════════════════════════════════════════ */
export default function BarDashboardScreen() {
    const { user, logout, deleteAccount } = useAuth();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'BarDashboard'>>();
    const isFocused = useIsFocused();
    const route = useRoute<RouteProp<RootStackParamList, 'BarDashboard'>>();
    const insets = useSafeAreaInsets();

    const [bar, setBar] = useState<Bar | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const savedProfile = useRef('');
    const [showUnsavedChanges, setShowUnsavedChanges] = useState(false);
    const [allowLeave, setAllowLeave] = useState(false);
    const leaveAction = useRef<(() => void) | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [profileMode, setProfileMode] = useState<'overview' | 'edit'>('overview');
    const editorScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
    const overviewScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
    const pendingEditorSection = useRef<Section | null>(null);
    const contentSlide = useRef(new Animated.Value(0)).current;
    const previousView = useRef('profile:overview');
    const [reduceMotion, setReduceMotion] = useState(false);
    const { width } = useWindowDimensions();
    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); })
            .catch(error => console.info('[Dashboard] Reduced motion preference unavailable', error));
        const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => { mounted = false; listener.remove(); };
    }, []);
    useEffect(() => {
        const view = `${activeTab}:${profileMode}`;
        if (previousView.current === view) { contentSlide.setValue(0); return; }
        const forward = activeTab === 'settings' || (activeTab === 'profile' && profileMode === 'edit');
        previousView.current = view;
        contentSlide.stopAnimation();
        contentSlide.setValue(reduceMotion ? 0 : (forward ? 1 : -1) * Math.min(width, 480));
        const animation = Animated.timing(contentSlide, { toValue: 0, duration: reduceMotion ? 0 : 280, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
        animation.start();
        return () => animation.stop();
    }, [activeTab, profileMode, reduceMotion, width, contentSlide]);
    const openEditor = (section?: Section) => {
        pendingEditorSection.current = section ?? null;
        setProfileMode('edit');
    };
    useEffect(() => { if (isFocused && route.params?.tab) setActiveTab(route.params.tab); }, [isFocused, route.params?.tab]);

    /* ── Dades editables ──────────────────────────────────────────────────── */
    const [description, setDescription] = useState('');
    const [showGoogleRating, setShowGoogleRating] = useState(false);
    const [promotionalText, setPromotionalText] = useState('');
    const [socials, setSocials] = useState<Record<string, string>>({});
    const [selectedAmenities, setSelectedAmenities] = useState<Set<BarAmenity>>(new Set());
    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
    const [broadcastingIds, setBroadcastingIds] = useState<Set<string>>(new Set());
    const [reservationLink, setReservationLink] = useState('');
    const [fullMatchIds, setFullMatchIds] = useState<Set<string>>(new Set());
    const profileUpdate = barProfileDraft({
        description, promotionalText, socialMedia: socials,
        amenities: Array.from(selectedAmenities), broadcastingMatches: Array.from(broadcastingIds), showGoogleRating,
        reservationUrl: reservationLink, fullMatchIds: Array.from(fullMatchIds),
    });
    const profileDraftRef = useRef(profileUpdate);
    profileDraftRef.current = profileUpdate;
    const hasChanges = !!bar && JSON.stringify(profileUpdate) !== savedProfile.current;

    const requestLeave = (action: () => void) => {
        if (savingRef.current || showUnsavedChanges) return;
        if (!hasChanges) { action(); return; }
        leaveAction.current = action;
        setShowUnsavedChanges(true);
    };
    const continueLeaving = () => {
        setShowUnsavedChanges(false);
        setAllowLeave(true);
    };
    usePreventRemove((hasChanges || saving) && !allowLeave, ({ data }) => {
        requestLeave(() => navigation.dispatch(data.action));
    });
    useEffect(() => {
        if (!allowLeave) return;
        const action = leaveAction.current;
        leaveAction.current = null;
        action?.();
    }, [allowLeave]);
    useEffect(() => { if (isFocused) setAllowLeave(false); }, [isFocused]);
    useEffect(() => {
        if (Platform.OS !== 'web' || !hasChanges) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [hasChanges]);

    /* ── Mapa ─────────────────────────────────────────────────────────────── */
    const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
    const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);
    const [reviewStats, setReviewStats] = useState<BarReviewStats>({ averageRating: 0, totalReviews: 0 });
    const [showBarProfile, setShowBarProfile] = useState(false);

    const [matchGenderFilter, setMatchGenderFilter] = useState<'masculino' | 'femenino' | null>(null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
    const [isDeleting, setIsDeleting] = useState(false);

    /* ── Modals de subscripció i eliminació ────────────────────────────────── */
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [showBillingConfirm, setShowBillingConfirm] = useState(false);
    const [pendingBillingCycle, setPendingBillingCycle] = useState<'monthly' | 'quarterly' | 'annual' | null>(null);
    const [isChangingPlan, setIsChangingPlan] = useState(false);
    const [subscriptionActive, setSubscriptionActive] = useState(false);
    const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
    const [showBillingPlans, setShowBillingPlans] = useState(false);
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionStatus | null>(null);
    const billingOperationRef = useRef(false);
    const subscriptionRequestRef = useRef<Promise<void> | null>(null);

    /* ── Notificacions ────────────────────────────────────────────────────── */
    const [showNotifPrefs, setShowNotifPrefs] = useState(false);
    const [notifPrefs, setNotifPrefs] = useState<BarOwnerNotificationPreferences>(DEFAULT_BAR_OWNER_NOTIFICATION_PREFS);
    const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; time: Date }>>([]);

    /* ── Toast ────────────────────────────────────────────────────────────── */
    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        showAlert({ message, tone: type });
    }, []);

    const refreshSubscription = useCallback((): Promise<void> => {
        if (subscriptionRequestRef.current) return subscriptionRequestRef.current;
        const request = Promise.resolve().then(async () => {
            try {
                const status = await getSubscriptionStatus();
                setSubscriptionDetails(status);
                if (status.billingCycle) setBillingCycle(status.billingCycle);
                setSubscriptionActive(status.active);
                setSubscriptionLoaded(true);
                setBar(previous => previous && !previous.isTestData
                    ? { ...previous, tier: status.active ? 'premium' : 'free' } : previous);
            } catch (error) {
                setSubscriptionDetails(null);
                setSubscriptionLoaded(false);
                console.info('[Dashboard] Subscription status unavailable', error);
                showToast("No s'ha pogut comprovar la subscripció. Torna-ho a provar.", 'error');
            } finally {
                subscriptionRequestRef.current = null;
            }
        });
        subscriptionRequestRef.current = request;
        return request;
    }, [showToast]);

    useEffect(() => {
        if (!bar || bar.isTestData) return;
        const listener = AppState.addEventListener('change', state => {
            if (state === 'active') void refreshSubscription();
        });
        const onFocus = () => { void refreshSubscription(); };
        if (Platform.OS === 'web') window.addEventListener('focus', onFocus);
        return () => {
            listener.remove();
            if (Platform.OS === 'web') window.removeEventListener('focus', onFocus);
        };
    }, [bar?.id, bar?.isTestData, refreshSubscription]);

    const handleManageSubscription = async () => {
        if (!bar || billingOperationRef.current) return;
        if (bar.isTestData) {
            showAlert({ message: 'La demostració no té factures ni cap subscripció real.', tone: 'info' });
            return;
        }
        billingOperationRef.current = true;
        setIsOpeningPortal(true);
        try {
            await openBillingPortal();
            await refreshSubscription();
        } catch (error) {
            console.info('[Dashboard] Billing portal unavailable', error instanceof Error ? error.name : 'unknown');
            showToast(getUserFriendlyError(error, "No s'ha pogut obrir la gestió de la subscripció. Torna-ho a provar."), 'error');
        } finally {
            billingOperationRef.current = false;
            setIsOpeningPortal(false);
        }
    };

    const dismissBillingConfirmation = () => {
        if (billingOperationRef.current) return;
        setShowBillingConfirm(false);
        setPendingBillingCycle(null);
    };

    const handleConfirmBillingChange = async () => {
        if (!bar || !pendingBillingCycle || billingOperationRef.current) return;
        if (!bar.isTestData && !subscriptionLoaded) {
            showToast("Comprova l'estat de la subscripció abans de continuar.", 'error');
            return;
        }
        const cycle = pendingBillingCycle;
        billingOperationRef.current = true;
        setIsChangingPlan(true);
        try {
            if (bar.isTestData) {
                setBillingCycle(cycle);
                showAlert({ message: 'Selecció guardada per a aquesta sessió. No s’ha fet cap càrrec.', tone: 'info' });
            } else if (subscriptionActive) {
                await stripeChangeBillingCycle(cycle);
                setBillingCycle(cycle);
                showToast(`Periodicitat canviada a ${BILLING_PLANS[cycle].label.toLowerCase()}`, 'success');
            } else {
                await openCheckout(cycle);
                showAlert({ message: 'Completa el pagament a Stripe. Comprovarem la subscripció quan tornis.', tone: 'info' });
            }
            setShowBillingConfirm(false);
            setPendingBillingCycle(null);
        } catch (error) {
            console.info('[Dashboard] Cannot change subscription', error);
            showToast(getUserFriendlyError(error, "No s'ha pogut canviar la subscripció. Torna-ho a provar."), 'error');
        } finally {
            billingOperationRef.current = false;
            setIsChangingPlan(false);
        }
    };

    /* ── Càrrega inicial ──────────────────────────────────────────────────── */
    useEffect(() => {
        if (!user) return;
        (async () => {
            setLoading(true);
            try {
                const loadedBar = await getOwnedBar(user.id);
                const ownedBar = loadedBar ? ownerDemoCopy(loadedBar) : null;
                if (ownedBar) {
                    setBar(ownedBar);
                    setDescription(ownedBar.description || '');
                    setShowGoogleRating(ownedBar.showGoogleRating === true);
                    setPromotionalText(ownedBar.promotionalText || '');
                    setSocials({
                        ...ownedBar.socialMedia,
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
                    setReservationLink(ownedBar.reservationUrl || '');
                    setFullMatchIds(new Set(ownedBar.fullMatchIds || []));
                    savedProfile.current = JSON.stringify(barProfileDraft({
                        ...ownedBar, amenities: (ownedBar.amenities || []).filter(a => validKeys.has(a)),
                    }));

                    // Carregar placeDetails i ressenyes per a la previsualització
                    const cleanName = ownedBar.name.replace(/\s+\d+$/, '');
                    setLoadingPlaceDetails(true);
                    (ownedBar.isTestData ? Promise.resolve(null) : fetchBarPlaceDetails(cleanName, ownedBar.latitude, ownedBar.longitude, ownedBar.googlePlaceId))
                        .then(details => setPlaceDetails(details))
                        .catch(error => { console.info('[Dashboard] Place details unavailable', error); setPlaceDetails(null); })
                        .finally(() => setLoadingPlaceDetails(false));
                    getBarReviewStats(ownedBar.id)
                        .then(stats => setReviewStats(stats))
                        .catch(error => console.info('[Dashboard] Review statistics unavailable', error));

                    // Carregar preferències de notificacions
                    getUserPreferences(user.id)
                        .then(prefs => {
                            if (prefs.barOwnerNotifications) setNotifPrefs(prefs.barOwnerNotifications);
                        })
                        .catch(error => console.info('[Dashboard] Notification preferences unavailable', error));

                    // Carregar estat de la subscripció
                    if (ownedBar.isTestData) {
                        setSubscriptionActive(false);
                        setSubscriptionLoaded(true);
                    } else void refreshSubscription();
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
                console.info('Error loading bar dashboard:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [user?.id]);

    /* ── Notificacions push (registrar token + escoltar en primer pla) ───── */
    useEffect(() => {
        if (!user) return;
        let unsubscribe: (() => void) | null = null;
        let disposed = false;

        (async () => {
            const result = await registerPushNotifications(user.id, false);
            setNotifPermission(result === 'granted' ? 'granted' : result === 'blocked' ? 'denied' : getNotificationPermissionStatus());
            unsubscribe = await listenForegroundMessages((payload: { title: string; body: string }) => {
                showToast(`${payload.title}: ${payload.body}`, 'success');
                setNotifications(prev => [
                    { id: Date.now().toString(), title: payload.title, body: payload.body, time: new Date() },
                    ...prev,
                ].slice(0, 50));
            });
            if (disposed) unsubscribe?.();
        })().catch(() => setNotifPermission('unsupported'));

        return () => { disposed = true; unsubscribe?.(); };
    }, [user, showToast]);

    /* ── Helpers ───────────────────────────────────────────────────────────── */
    const handleSaveProfile = async (): Promise<boolean> => {
        if (!bar || savingRef.current) return false;
        const update = profileDraftRef.current;
        if (update.reservationUrl && !reservationUrl(update.reservationUrl)) {
            showToast('Introdueix un enllaç de reserves vàlid que comenci per https://.', 'error');
            return false;
        }
        const snapshot = JSON.stringify(update);
        if (snapshot === savedProfile.current) return true;
        savingRef.current = true;
        setSaving(true);
        try {
            await updateBarProfile(bar.id, update);
            savedProfile.current = snapshot;
            setBar(prev => prev ? { ...prev, ...update } : prev);
            showToast('Canvis desats', 'success');
            return JSON.stringify(profileDraftRef.current) === snapshot;
        } catch (e) {
            console.info('Error saving:', e);
            showToast('Error en desar els canvis', 'error');
            return false;
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigation.reset({ index: 0, routes: [{ name: 'Map' }] });
    };

    /* ── Definició seccions perfil ─────────────────────────────────────────── */
    const profileSections: { key: Section; title: string }[] = [
        { key: 'description', title: 'Descripció' },
        { key: 'promotions', title: 'Promoció' },
        { key: 'reservations', title: 'Reserves' },
        { key: 'amenities', title: 'Serveis' },
        { key: 'matches', title: 'Partits que emets' },
        { key: 'socials', title: 'Xarxes socials' },
        { key: 'googleRating', title: 'Puntuació de Google Maps' },
    ];

    /* ═══════════════════════════════════════════════════════════════════════
       LOADING / EMPTY
    ═══════════════════════════════════════════════════════════════════════ */
    // Splash global: mantenim grana mentre carreguem el perfil del bar.
    useScreenLoading('BarDashboard', loading);
    const { start: startTutorial } = useTutorial();
    const tutorialReady = isFocused && !loading && !!bar && !hasChanges && !saving && !showUnsavedChanges
        && !showBarProfile && !showDeleteModal && !showBillingConfirm && !showNotifications;
    const prepareOverview = (end = false) => {
        setActiveTab('profile');
        setProfileMode('overview');
        if (end) overviewScrollRef.current?.scrollToEnd({ animated: false });
        else overviewScrollRef.current?.scrollTo({ y: 0, animated: false });
    };
    const editTarget = useTutorialTarget('owner-edit', tutorialReady, () => prepareOverview());
    const ownerMatchesTarget = useTutorialTarget('owner-matches', tutorialReady, () => prepareOverview());
    const reservationsTarget = useTutorialTarget('owner-reservations', tutorialReady, () => prepareOverview(true));
    const ownerSettingsTarget = useTutorialTarget('owner-settings', tutorialReady);

    if (loading) {
        // No renderitzem res: el GlobalSplash cobreix la pantalla.
        return null;
    }

    if (!bar) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <View style={{ width: 44 }} />
                    <Text style={styles.headerTitle}>Panell del bar</Text>
                    <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
                        <AppIcon name="log-out" size={18} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                </View>
                <View style={styles.centered}>
                    <AppIcon name="alert-circle" size={48} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.emptyTitle}>No s'ha trobat cap bar assignat</Text>
                    <Text style={styles.emptySubtitle}>
                        Contacta amb nosaltres per vincular el teu bar.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    /* ═══════════════════════════════════════════════════════════════════════
       TAB 2: PERFIL (edició directa)
    ═══════════════════════════════════════════════════════════════════════ */
    const renderProfileTab = () => (
        <ScrollView ref={editorScrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} style={webScreenScroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
            <View style={styles.profileHero}>
                {bar.gallery?.[0] && <Image source={{ uri: bar.gallery[0] }} style={styles.profileCover} resizeMode="cover" />}
                <View style={styles.profileHeroBody}>
                    <Text style={styles.profileEyebrow}>{bar.tier === 'premium' ? 'EL TEU LOCAL · PREMIUM' : 'EL TEU LOCAL'}</Text>
                    <Text style={styles.profileHeadline}>{bar.name}</Text>
                    <Text style={styles.profileSummary}>Així et trobarà la gent quan busqui on veure el Barça.</Text>
                </View>
            </View>
            {profileSections.map(sec => (
                <View
                    key={sec.key}
                    testID={`bar-profile-section-${sec.key}`}
                    style={styles.profileSection}
                    onLayout={({ nativeEvent: { layout } }) => {
                        if (pendingEditorSection.current !== sec.key) return;
                        pendingEditorSection.current = null;
                        editorScrollRef.current?.scrollTo({ y: Math.max(0, layout.y - 12), animated: false });
                    }}
                >
                    <View style={styles.profileSectionHeader}>
                        <Text accessibilityRole="header" style={[styles.sectionCardTitle, { flex: 1 }]}>{sec.title}</Text>
                    </View>
                    {renderSectionContent(sec.key)}
                </View>
            ))}
            <TouchableOpacity
                testID="bar-profile-save" accessibilityRole="button" accessibilityLabel="Desar canvis"
                accessibilityState={{ disabled: saving || !hasChanges, busy: saving }}
                disabled={saving || !hasChanges}
                onPress={async () => { if (await handleSaveProfile()) setProfileMode('overview'); }}
                style={[styles.saveButton, { marginHorizontal: 0, opacity: saving || !hasChanges ? 0.6 : 1 }]}
            >
                {saving ? <ActivityIndicator color={EDITORIAL.onBackground} /> : <Text style={styles.saveButtonText}>Desar canvis</Text>}
            </TouchableOpacity>
        </ScrollView>
    );

    const nextOwnerMatch = upcomingMatches.find(match => broadcastingIds.has(match.id)) ?? upcomingMatches[0];
    const renderOverview = () => (
        <ScrollView ref={overviewScrollRef} testID="bar-management-overview" style={[styles.managerPage, webScreenScroll]} contentContainerStyle={styles.managerContent} showsVerticalScrollIndicator={false}>
            <View style={styles.managerIdentity}>
                {bar.gallery?.[0] && <Image source={{ uri: bar.gallery[0] }} style={styles.managerCover} resizeMode="cover" />}
                <View style={{ flex: 1, gap: 5 }}>
                    <Text style={styles.managerEyebrow}>{bar.tier === 'premium' ? 'EL TEU BAR · PREMIUM' : 'EL TEU BAR'}</Text>
                    <Text accessibilityRole="header" style={styles.managerTitle}>{bar.name}</Text>
                    <Text numberOfLines={2} style={styles.managerMuted}>{bar.address}</Text>
                </View>
            </View>
            {hasChanges && <TouchableOpacity accessibilityRole="button" onPress={() => openEditor()} style={styles.managerDraft}>
                <AppIcon name="edit-3" size={18} color="#A50044" /><Text style={styles.managerRowTitle}>Tens canvis sense desar</Text><AppIcon name="chevron-right" size={18} color="#A50044" />
            </TouchableOpacity>}
            <View style={styles.managerQuickActions}>
                <TouchableOpacity ref={editTarget} testID="bar-management-edit" accessibilityRole="button" onPress={() => openEditor()} style={styles.managerPrimary}>
                    <AppIcon name="edit-3" size={19} color="#FFFFFF" /><Text style={styles.managerPrimaryText}>Editar el perfil</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => setShowBarProfile(true)} style={styles.managerSecondary}>
                    <AppIcon name="eye" size={19} color="#A50044" /><Text style={styles.managerSecondaryText}>Veure com queda</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.managerSectionHeader}>
                <Text accessibilityRole="header" style={styles.managerSectionTitle}>La pròxima jornada</Text>
                <TouchableOpacity ref={ownerMatchesTarget} accessibilityRole="button" onPress={() => openEditor('matches')} style={styles.managerTextAction}><Text style={styles.managerSecondaryText}>Triar partits</Text><AppIcon name="chevron-right" size={17} color="#A50044" /></TouchableOpacity>
            </View>
            {nextOwnerMatch ? <View style={styles.managerMatch}>
                <Text style={styles.managerMatchStatus}>{broadcastingIds.has(nextOwnerMatch.id) ? 'HAS MARCAT QUE L’EMETS' : 'ENCARA NO HAS MARCAT SI L’EMETS'}</Text>
                <MatchCard match={nextOwnerMatch} grana onPress={() => openEditor('matches')} />
            </View> : <View style={styles.managerCard}><Text style={styles.managerRowTitle}>Encara no hi ha partits programats</Text><Text style={styles.managerMuted}>Quan hi hagi una nova jornada, podràs indicar quins partits emets.</Text></View>}
            <Text accessibilityRole="header" style={styles.managerSectionTitle}>Posa el local a punt</Text>
            <View style={styles.managerCard}>
                {([
                    { section: 'description', icon: 'file-text', title: 'La presentació del bar', detail: bar.description?.trim() ? 'La gent ja pot conèixer el teu local' : 'Explica què el fa especial' },
                    { section: 'amenities', icon: 'coffee', title: 'Serveis i ambient', detail: bar.amenities?.length ? `${bar.amenities.length} serveis al perfil` : 'Pantalles, menjar, terrassa…' },
                    { section: 'promotions', icon: 'tag', title: 'La teva promoció', detail: bar.promotionalText?.trim() || 'Tens alguna proposta per al dia de partit?' },
                    { section: 'reservations', icon: 'calendar', title: 'Reserves i aforament', detail: bar.reservationUrl ? 'Gestiona l’enllaç i els partits complets' : 'Afegeix l’enllaç de reserves del bar' },
                ] as const).map(item => <TouchableOpacity ref={item.section === 'reservations' ? reservationsTarget : undefined} key={item.section} accessibilityRole="button" onPress={() => openEditor(item.section)} style={styles.managerRow}>
                    <View style={styles.managerIcon}><AppIcon name={item.icon} size={21} color="#A50044" /></View>
                    <View style={{ flex: 1, gap: 4 }}><Text style={styles.managerRowTitle}>{item.title}</Text><Text numberOfLines={2} style={styles.managerMuted}>{item.detail}</Text></View>
                    <AppIcon name="chevron-right" size={18} color="#66707D" />
                </TouchableOpacity>)}
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Veure el meu bar al mapa" style={styles.managerMapAction}
                onPress={() => requestLeave(() => navigation.popTo('Map'))}>
                <View style={styles.managerIcon}><AppIcon name="map-pin" size={22} color="#A50044" /></View>
                <View style={{ flex: 1, gap: 4 }}><Text style={styles.managerRowTitle}>El teu lloc al mapa</Text><Text style={styles.managerMuted}>Mira com et troba la gent.</Text></View>
                <AppIcon name="arrow-up-right" size={20} color="#A50044" />
            </TouchableOpacity>
            <View style={styles.managerReviews}><AppIcon name="star" size={20} color="#A50044" /><Text style={styles.managerMuted}>{reviewStats.totalReviews ? `${reviewStats.averageRating.toFixed(1)} de 5 · ${reviewStats.totalReviews} ressenyes de troBar` : 'Encara no tens ressenyes de troBar.'}</Text></View>
        </ScrollView>
    );

    /* ═══════════════════════════════════════════════════════════════════════
       TAB 3: CONFIGURACIÓ
    ═══════════════════════════════════════════════════════════════════════ */
    const currentTier = bar.tier || 'free';

    const NOTIF_OPTIONS: { key: keyof BarOwnerNotificationPreferences; label: string; desc: string }[] = [
        { key: 'newReviews', label: 'Noves ressenyes', desc: 'Quan algú escriu una ressenya al teu bar' },
        { key: 'newRatings', label: 'Noves valoracions', desc: 'Quan algú puntua el teu bar' },
        { key: 'upcomingMatches', label: 'Partits propers', desc: 'Recordatori dels partits que emets' },
        { key: 'newFollowers', label: 'Nous seguidors', desc: 'Quan algú comença a seguir el teu bar' },
    ];

    const handleSaveNotifPrefs = async () => {
        if (!user) return;
        try {
            await updateUserPreferences(user.id, { barOwnerNotifications: notifPrefs } as any);
            showToast('Preferències desades', 'success');
            setShowNotifPrefs(false);
        } catch (e) {
            console.info('[Dashboard] Cannot save notification preferences', e);
            showToast('Error en desar les preferències', 'error');
        }
    };

    const renderSettingsTab = () => (
        <View style={[styles.managerPage, { flex: 1, justifyContent: 'space-between' }, Platform.OS === 'web' && ({ minHeight: 0 } as any)]}>
            <ScrollView contentContainerStyle={[styles.scrollContent, styles.settingsScrollContent]} showsVerticalScrollIndicator={false} style={webScreenScroll}>
                <TouchableOpacity accessibilityRole="button" style={styles.managerTextAction} onPress={() => {
                    if (hasChanges) { showToast('Desa els canvis del perfil abans d’obrir la guia.', 'error'); return; }
                    startTutorial('owner');
                }}><Text style={styles.managerSecondaryText}>Tornar a veure la guia del bar</Text></TouchableOpacity>
                {/* Pla actual */}
                <View style={styles.settingsIntro}>
                    <Text style={[styles.settingsHeadline, styles.managerTitle]}>El compte del local</Text>
                    <Text style={[styles.settingsDescription, styles.managerMuted]}>El pla i els avisos, al teu ritme.</Text>
                </View>
                <Text style={[styles.settingSectionTitle, styles.managerLabel]}>El teu pla</Text>
                <View style={styles.planCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AppIcon name="award" size={20} color="#FFFFFF" />
                            <Text style={styles.planName}>  {currentTier === 'premium' ? 'Premium' : 'Gratuït'}</Text>
                        </View>
                        <View style={{ backgroundColor: subscriptionActive ? 'rgba(255,215,0,0.2)' : 'rgba(165,0,68,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ color: subscriptionActive ? '#B6F1C3' : EDITORIAL.onBackground, fontSize: 12, fontWeight: '700' }}>
                                {bar?.isTestData ? 'PREMIUM' : !subscriptionLoaded ? 'PENDENT' : subscriptionDetails?.cancelAtPeriodEnd ? 'NO ES RENOVA' : subscriptionActive ? 'ACTIU' : 'INACTIU'}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.profileSectionHint}>
                        {bar.isTestData ? 'Dona protagonisme al teu local i prepara la pròxima jornada.'
                            : subscriptionLoaded && subscriptionActive ? BILLING_PLANS[billingCycle].totalLabel
                            : 'Premium · tria la periodicitat'}
                    </Text>
                    {subscriptionDetails?.cancelAtPeriodEnd && <Text style={styles.profileSectionHint}>
                        Renovació cancel·lada. Mantens l'accés fins al final del període actual.
                    </Text>}
                    {!bar.isTestData && <TouchableOpacity
                        testID="bar-subscription-manage"
                        accessibilityRole="button"
                        accessibilityLabel="Gestionar la subscripció a Stripe"
                        style={styles.subscriptionManageButton}
                        onPress={() => void handleManageSubscription()}
                        disabled={isOpeningPortal || isChangingPlan}
                        accessibilityState={{ disabled: isOpeningPortal || isChangingPlan, busy: isOpeningPortal }}
                    >
                        <Text style={styles.sectionSaveText}>{isOpeningPortal ? 'Obrint Stripe…' : 'Gestionar la subscripció'}</Text>
                        {isOpeningPortal ? <ActivityIndicator color={EDITORIAL.onBackground} /> : <AppIcon name="external-link" size={18} color={EDITORIAL.onBackground} />}
                    </TouchableOpacity>}
                    {!bar.isTestData && <Text style={styles.profileSectionHint}>
                        Factures, targeta i cancel·lació de la renovació a Stripe, la passarel·la segura de pagament.
                    </Text>}
                    <TouchableOpacity
                        testID="bar-subscription-plans"
                        accessibilityRole="button"
                        style={styles.subscriptionManageButton}
                        onPress={() => setShowBillingPlans(value => !value)}
                        disabled={isOpeningPortal || isChangingPlan}
                        accessibilityState={{ expanded: showBillingPlans, disabled: isOpeningPortal || isChangingPlan }}
                    >
                        <Text style={styles.sectionSaveText}>{showBillingPlans ? 'Tancar els plans' : subscriptionActive ? 'Canviar la periodicitat' : 'Veure els plans Premium'}</Text>
                        <AppIcon name={showBillingPlans ? 'chevron-up' : 'chevron-right'} size={18} color={EDITORIAL.onBackground} />
                    </TouchableOpacity>
                    {!bar.isTestData && !subscriptionLoaded && (
                        <TouchableOpacity accessibilityRole="button" style={styles.subscriptionManageButton} onPress={() => void refreshSubscription()}>
                            <Text style={styles.sectionSaveText}>Comprovar subscripció</Text>
                        </TouchableOpacity>
                    )}
                    {showBillingPlans && (
                        <View style={{ marginTop: 12 }}>
                            <View style={{ flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: EDITORIAL.hairline }}>
                                {(['monthly', 'quarterly', 'annual'] as const).map(key => (
                                    <TouchableOpacity
                                        key={key}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${BILLING_PLANS[key].label}: ${BILLING_PLANS[key].totalLabel}`}
                                        accessibilityState={{ selected: billingCycle === key, disabled: isOpeningPortal || isChangingPlan || (!bar.isTestData && !subscriptionLoaded) }}
                                        disabled={isOpeningPortal || isChangingPlan || (!bar.isTestData && !subscriptionLoaded)}
                                        style={{
                                            flex: 1, minHeight: 64, paddingVertical: 10, alignItems: 'center',
                                            backgroundColor: billingCycle === key ? EDITORIAL.granaSoft : EDITORIAL.card,
                                        }}
                                        onPress={() => {
                                            if (key === billingCycle && (bar.isTestData || subscriptionActive)) return;
                                            setPendingBillingCycle(key);
                                            setShowBillingConfirm(true);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: EDITORIAL.ink, fontWeight: '700', fontSize: 14 }}>{BILLING_PLANS[key].label}</Text>
                                        <Text style={{ color: EDITORIAL.inkMuted, fontSize: 12, marginTop: 2 }}>{BILLING_PLANS[key].priceLabel}</Text>
                                        {BILLING_PLANS[key].save && (
                                            <Text style={{ color: EDITORIAL.onBackground, fontSize: 12, fontWeight: '700', marginTop: 1 }}>{BILLING_PLANS[key].save}</Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={{ color: EDITORIAL.inkMuted, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                                {BILLING_PLANS[billingCycle].totalLabel}
                            </Text>
                            {!bar.isTestData && !subscriptionActive && <Text style={styles.profileSectionHint}>Selecciona una periodicitat per iniciar Premium. Stripe confirmarà les condicions i els 14 dies de prova.</Text>}
                        </View>
                    )}
                </View>

                <View style={styles.settingDivider} />

                {/* Notificacions */}
                <Text style={[styles.settingSectionTitle, styles.managerLabel]}>Preferències</Text>
                <View style={[styles.settingsGroup, styles.managerGroup]}>
                    <BarEmailTips demo={bar.isTestData === true} />
                </View>

                <View style={[styles.settingsGroup, styles.managerGroup]}>
                    {/* Botó de configurar preferències */}
                    <TouchableOpacity
                        style={styles.settingsAction}
                        accessibilityRole="button"
                        onPress={() => setShowNotifPrefs(true)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.settingsActionIcon, styles.managerIcon]}><AppIcon name="bell" size={22} color="#A50044" /></View>
                        <View style={{ flex: 1, gap: 4 }}>
                            <Text style={[styles.settingsActionTitle, styles.managerRowTitle]}>Els teus avisos</Text>
                            <Text style={[styles.settingsActionHint, styles.managerMuted]}>Ressenyes, seguidors i partits.</Text>
                        </View>
                        <AppIcon name="chevron-right" size={20} color="#66707D" />
                    </TouchableOpacity>
                </View>

                <View style={styles.settingDivider} />

                {/* Logout + eliminar + versió (dins del scroll) */}
                <View style={styles.settingsFooter}>
                    <TouchableOpacity style={styles.logoutButton} onPress={() => requestLeave(() => { void handleLogout(); })} activeOpacity={0.7}>
                        <AppIcon name="log-out" size={18} color={EDITORIAL.onBackground} />
                        <Text style={styles.logoutText}>Tancar sessió</Text>
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
                        <Text style={{ color: '#66707D', fontWeight: '600', fontSize: 12, textDecorationLine: 'underline' }}>
                            {isDeleting ? 'Eliminant...' : 'Eliminar el compte'}
                        </Text>
                    </TouchableOpacity>
                </View>
                <View style={profileFooterStyles.footer} testID="bar-settings-footer">
                    <View style={profileFooterStyles.footerLinks}>
                        <TouchableOpacity accessibilityRole="link" style={profileFooterStyles.footerLink} onPress={() => requestLeave(() => navigation.navigate('TermsOfService'))}><Text style={[profileFooterStyles.footerText, styles.managerMuted]}>Termes del servei</Text></TouchableOpacity>
                        <TouchableOpacity accessibilityRole="link" style={profileFooterStyles.footerLink} onPress={() => requestLeave(() => navigation.navigate('PrivacyPolicy'))}><Text style={[profileFooterStyles.footerText, styles.managerMuted]}>Privacitat</Text></TouchableOpacity>
                        <TouchableOpacity accessibilityRole="link" style={profileFooterStyles.footerLink} onPress={() => requestLeave(() => navigation.navigate('Contact'))}><Text style={[profileFooterStyles.footerText, styles.managerMuted]}>Contacte i suport</Text></TouchableOpacity>
                    </View>
                    <Text style={[profileFooterStyles.versionText, styles.managerMuted]}>troBar {Constants.expoConfig?.version}</Text>
                </View>
            </ScrollView>
        </View>
    );

    /* ═══════════════════════════════════════════════════════════════════════
       CONTINGUT DE LES SECCIONS
    ═══════════════════════════════════════════════════════════════════════ */
    const renderSectionContent = (section: Section) => {
        switch (section) {
            case 'reservations':
                return (
                    <View style={{ gap: 12 }}>
                        <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, lineHeight: 20 }}>
                            Les reserves es fan al web que indiquis. Pots marcar cada partit com a complet a «Partits que emets».
                        </Text>
                        <TextInput
                            accessibilityLabel="Enllaç de reserves"
                            style={styles.input}
                            editable={!saving && bar.tier === 'premium'}
                            value={reservationLink}
                            onChangeText={setReservationLink}
                            placeholder="https://"
                            placeholderTextColor={EDITORIAL.inkMuted}
                            autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2048}
                        />
                        {bar.tier !== 'premium' && <Text style={{ color: EDITORIAL.inkMuted }}>Disponible amb Premium.</Text>}
                    </View>
                );
            case 'googleRating':
                return (
                    <View style={{ gap: 16 }}>
                        <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, lineHeight: 20 }}>
                            Deixa que qui encara no et coneix vegi com et valoren a Google. Mostrarem les estrelles i quantes persones t’han puntuat, no els seus comentaris.
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <Text style={{ color: EDITORIAL.ink, flex: 1 }}>Vull mostrar la meva puntuació</Text>
                            <Switch disabled={saving} accessibilityLabel="Mostrar la puntuació de Google Maps" value={showGoogleRating} onValueChange={setShowGoogleRating} trackColor={{ true: EDITORIAL.grana }} />
                        </View>
                    </View>
                );
            case 'description':
                return (
                    <TextInput
                        accessibilityLabel="Descripció del bar"
                        style={[styles.input, styles.textArea]}
                        editable={!saving} multiline value={description} onChangeText={setDescription}
                        placeholder="Com és viure un partit al teu bar? Explica’ns què el fa especial."
                        placeholderTextColor={EDITORIAL.inkMuted}
                        textAlignVertical="top"
                    />
                );
            case 'promotions':
                return (
                    <View>
                        <TextInput
                            accessibilityLabel="Promoció del bar"
                            style={[styles.input, styles.textArea]}
                            editable={!saving} multiline value={promotionalText} onChangeText={setPromotionalText}
                            placeholder="P. ex.: els dies de partit, entrepà i beguda per 8,50 €"
                            placeholderTextColor={EDITORIAL.inkMuted}
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
                                    <AppIcon name={net.icon} size={16} color={
                                        socials[net.key]?.trim() ? 'white' : 'rgba(255,255,255,0.35)'
                                    } />
                                </View>
                                <View style={styles.socialInputWrap}>
                                    <Text style={styles.socialLabel}>{net.label}</Text>
                                    <TextInput
                                        accessibilityLabel={net.label}
                                        style={styles.socialInput}
                                        editable={!saving}
                                        value={socials[net.key] || ''}
                                        onChangeText={v => setSocials(prev => ({ ...prev, [net.key]: v }))}
                                        placeholder={net.placeholder}
                                        placeholderTextColor={EDITORIAL.inkMuted}
                                        autoCapitalize="none" autoCorrect={false}
                                        keyboardType={net.key === 'whatsapp' ? 'phone-pad' : 'url'}
                                    />
                                </View>
                                {socials[net.key]?.trim() ? (
                                    <TouchableOpacity style={styles.socialClear}
                                        onPress={() => setSocials(prev => ({ ...prev, [net.key]: '' }))}>
                                        <AppIcon name="x" size={14} color="rgba(255,255,255,0.5)" />
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
                            const IconComp = AppIcon;
                            return (
                                <TouchableOpacity
                                    key={opt.key}
                                    style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: isActive }}
                                    onPress={() => {
                                        setSelectedAmenities(prev => {
                                            const next = new Set(prev);
                                            next.has(opt.key) ? next.delete(opt.key) : next.add(opt.key);
                                            return next;
                                        });
                                    }}
                                >
                                    <IconComp name={opt.icon as any} size={14} color={isActive ? 'white' : 'rgba(255,255,255,0.4)'} />
                                    <Text style={[styles.chipText, { color: isActive ? EDITORIAL.onBackground : EDITORIAL.inkMuted }]}>{opt.label}</Text>
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
                    || /femen|women|uwcl|liga\s*f|reina|queen/i.test(m.competition?.name || '');

                const filteredMatches = !matchGenderFilter
                    ? upcomingMatches
                    : matchGenderFilter === 'femenino'
                        ? upcomingMatches.filter(m => isFemenino(m))
                        : upcomingMatches.filter(m => !isFemenino(m));

                const allFilteredSelected = filteredMatches.length > 0 && filteredMatches.every(m => broadcastingIds.has(m.id));

                const resolveCompLogo = (m: Match) => {
                    const name = (m.competition?.name || '').toLowerCase();
                    if (/supercopa|supercup|super cup/.test(name)) return null;
                    if (name.includes('women') && name.includes('champions')) return require('../../../../assets/app/img/competicions/champions-w.png');
                    if (name.includes('uwcl')) return require('../../../../assets/app/img/competicions/champions-w.png');
                    if (name.includes('champions')) return require('../../../../assets/app/img/competicions/champions.png');
                    if (name.includes('copa') && (name.includes('reina') || name.includes('queen'))) return require('../../../../assets/app/img/competicions/copa-reina.png');
                    if (name.includes('copa') || name.includes('king')) return require('../../../../assets/app/img/competicions/copa-del-rey.png');
                    if (name.includes('liga f') || name.includes('femen')) return require('../../../../assets/app/img/competicions/ligaf.png');
                    if (name.includes('primera') || name.includes('la liga') || name.includes('liga')) return require('../../../../assets/app/img/competicions/liga.png');
                    return null;
                };

                return (
                    <View>
                        {/* Filtre gènere */}
                        <View style={styles.genderFilterRow}>
                            {(['masculino', 'femenino'] as const).map(g => (
                                <TouchableOpacity
                                    key={g}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: matchGenderFilter === g }}
                                    style={[styles.genderFilterBtn, {
                                        backgroundColor: g === 'masculino' ? EDITORIAL.masculine : EDITORIAL.feminine,
                                        borderColor: matchGenderFilter === g ? EDITORIAL.onBackground : EDITORIAL.borderOnBackground,
                                    }]}
                                    onPress={() => setMatchGenderFilter(matchGenderFilter === g ? null : g)}
                                >
                                    <Text style={[styles.genderFilterText, matchGenderFilter === g && styles.genderFilterTextActive]}>
                                        {g === 'masculino' ? 'Masculí' : 'Femení'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Botó seleccionar / deseleccionar tots */}
                        {filteredMatches.length > 0 && (
                            <TouchableOpacity
                                style={styles.selectAllBtn}
                                onPress={() => {
                                    if (allFilteredSelected) {
                                        setFullMatchIds(current => new Set([...current].filter(id => !filteredMatches.some(match => match.id === id))));
                                    }
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
                                <AppIcon name={allFilteredSelected ? 'x-square' : 'check-square'} size={14} color="#FFFFFF" />
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
                                <View key={match.id} style={{ marginBottom: 8 }}>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel={`${home.name} vs ${away.name}, ${isFem ? 'femení' : 'masculí'}`}
                                    accessibilityState={{ selected: isSelected }}
                                    style={[styles.matchRow, {
                                        backgroundColor: isFem ? EDITORIAL.feminine : EDITORIAL.masculine,
                                        borderColor: isSelected ? EDITORIAL.onBackground : EDITORIAL.borderOnBackground,
                                        borderWidth: isSelected ? 2 : 1,
                                    }]}
                                    onPress={() => {
                                        if (isSelected) setFullMatchIds(current => new Set([...current].filter(id => id !== match.id)));
                                        setBroadcastingIds(prev => {
                                            const next = new Set(prev);
                                            if (next.has(match.id)) {
                                                next.delete(match.id);
                                            } else next.add(match.id);
                                            return next;
                                        });
                                    }}
                                >
                                    <View style={[styles.matchCheck, isSelected && styles.matchCheckActive]}>
                                        {isSelected && <AppIcon name="check" size={14} color="white" />}
                                    </View>
                                    {/* Escuts junts amb competició entremig */}
                                    <View style={styles.matchCrests}>
                                        {home.crest ? (
                                            <Image source={{ uri: home.crest }} style={styles.matchCrest} resizeMode="contain" />
                                        ) : (
                                            <AppIcon name="shield-outline" size={22} color="rgba(255,255,255,0.3)" />
                                        )}
                                        {compLogo ? (
                                            <Image source={compLogo} style={styles.matchCompLogo} resizeMode="contain" />
                                        ) : (
                                            <Text style={{ color: EDITORIAL.inkMuted, fontSize: 12, marginHorizontal: 2 }}>vs</Text>
                                        )}
                                        {away.crest ? (
                                            <Image source={{ uri: away.crest }} style={styles.matchCrest} resizeMode="contain" />
                                        ) : (
                                            <AppIcon name="shield-outline" size={22} color="rgba(255,255,255,0.3)" />
                                        )}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.matchTeams} numberOfLines={1}>
                                            {home.name} vs {away.name}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                            <Text style={styles.matchDate}>{dateStr}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                                {isSelected && bar.tier === 'premium' && (
                                    <View style={{
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                                        backgroundColor: fullMatchIds.has(match.id) ? EDITORIAL.matchdaySoft : EDITORIAL.granaSoft,
                                    }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: fullMatchIds.has(match.id) ? EDITORIAL.granaDeep : EDITORIAL.ink, fontFamily: EDITORIAL.fontBold, fontSize: 14 }}>Complet</Text>
                                            <Text style={{ color: fullMatchIds.has(match.id) ? EDITORIAL.granaDeep : EDITORIAL.inkMuted, fontSize: 12, lineHeight: 16 }}>
                                                {fullMatchIds.has(match.id) ? 'Reserves tancades per a aquest partit' : 'Marca’l quan no quedin places'}
                                            </Text>
                                        </View>
                                        <Switch
                                            accessibilityLabel={`Complet: ${home.name} vs ${away.name}, ${dateStr}`}
                                            disabled={saving}
                                            value={fullMatchIds.has(match.id)}
                                            onValueChange={value => setFullMatchIds(previous => {
                                                const next = new Set(previous);
                                                value ? next.add(match.id) : next.delete(match.id);
                                                return next;
                                            })}
                                            trackColor={{ true: EDITORIAL.grana }}
                                        />
                                    </View>
                                )}
                                </View>
                            );
                        })}
                        {filteredMatches.length === 0 && (
                            <Text style={styles.emptySubtitle}>
                                {!matchGenderFilter ? 'No hi ha partits programats.' : 'No hi ha partits d\'aquesta categoria.'}
                            </Text>
                        )}
                    </View>
                );
            }
            default: return null;
        }
    };

    /* ═══════════════════════════════════════════════════════════════════════
       RENDER PRINCIPAL
    ═══════════════════════════════════════════════════════════════════════ */
    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, webScreenContainer, { paddingBottom: 64 + Math.max(insets.bottom, 12) }]}>
            {/* ── Capçalera ── */}
                <View style={styles.header}>
                    {activeTab === 'profile' && profileMode === 'edit'
                        ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tornar al meu bar" style={styles.headerBtn} onPress={() => setProfileMode('overview')}><AppIcon name="chevron-left" size={23} color="#FFFFFF" /></TouchableOpacity>
                        : <View style={{ width: 44 }} />}
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {activeTab === 'settings' ? 'Configuració' : profileMode === 'edit' ? 'Editar el perfil' : 'El teu bar'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowNotifications(prev => !prev)}
                        style={styles.headerBtn}
                    >
                        <AppIcon name="bell" size={18} color="rgba(255,255,255,0.7)" />
                        {notifications.length > 0 && (
                            <View style={{
                                position: 'absolute', top: 2, right: 2,
                                minWidth: 16, height: 16, borderRadius: 8,
                                backgroundColor: '#a50044',
                                alignItems: 'center', justifyContent: 'center',
                                paddingHorizontal: 4,
                            }}>
                                <Text style={{ color: EDITORIAL.ink, fontSize: 12, fontWeight: '700' }}>
                                    {notifications.length > 99 ? '99+' : notifications.length}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

            {/* ── Contingut de la pestanya activa ─────────────────── */}
            <Animated.View style={[{ flex: 1, transform: [{ translateX: contentSlide }] }, Platform.OS === 'web' && ({ minHeight: 0 } as any)]}>
                {activeTab === 'profile' && (profileMode === 'edit' ? renderProfileTab() : renderOverview())}
                {activeTab === 'settings' && renderSettingsTab()}
            </Animated.View>

            {/* ── Barra de navegació inferior ─────────────────────── */}
            <OwnerBottomNav active={activeTab} onMap={() => requestLeave(() => { setShowNotifications(false); navigation.popTo('Map'); })}
                onProfile={() => setActiveTab('profile')} onSettings={() => setActiveTab('settings')} settingsTarget={ownerSettingsTarget} />
            {showUnsavedChanges && (
                <Modal transparent animationType="fade" onRequestClose={() => { if (!saving) { leaveAction.current = null; setShowUnsavedChanges(false); } }}>
                <View style={styles.unsavedBackdrop} accessibilityViewIsModal>
                    <View style={styles.unsavedCard}>
                        <TouchableOpacity testID="bar-leave-cancel" accessibilityRole="button" accessibilityLabel="Tancar i continuar editant" disabled={saving} style={styles.unsavedClose}
                            onPress={() => { leaveAction.current = null; setShowUnsavedChanges(false); }}>
                            <AppIcon name="x" size={22} color="#202631" />
                        </TouchableOpacity>
                        <View style={styles.unsavedIcon}><AppIcon name="edit-3" size={26} color="#A50044" /></View>
                        <Text accessibilityRole="header" style={styles.unsavedTitle}>Abans de marxar…</Text>
                        <Text style={styles.unsavedBody}>Has fet canvis al perfil. Els desem perquè tothom els pugui veure?</Text>
                        <TouchableOpacity testID="bar-leave-save" accessibilityRole="button" disabled={saving} style={styles.unsavedSave} onPress={async () => { if (await handleSaveProfile()) continueLeaving(); }}>
                            <Text style={styles.saveButtonText}>{saving ? 'Desant…' : 'Desar i sortir'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity testID="bar-leave-discard" accessibilityRole="button" disabled={saving} style={styles.unsavedDiscard} onPress={() => {
                            if (!bar) return;
                            const persisted: ReturnType<typeof barProfileDraft> = JSON.parse(savedProfile.current);
                            setDescription(persisted.description || '');
                            setPromotionalText(persisted.promotionalText || '');
                            setSocials({ ...persisted.socialMedia });
                            setSelectedAmenities(new Set(persisted.amenities));
                            setBroadcastingIds(new Set(persisted.broadcastingMatches));
                            setReservationLink(persisted.reservationUrl || '');
                            setFullMatchIds(new Set(persisted.fullMatchIds));
                            setShowGoogleRating(persisted.showGoogleRating === true);
                            continueLeaving();
                        }}>
                            <Text style={{ color: '#66707D', fontSize: 15 }}>Sortir sense desar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                </Modal>
            )}
            {/* ── Panell de notificacions (dropdown) ─────────────── */}
            {showNotifications && (
                <View style={{
                    position: 'absolute', top: 60, right: 12, width: 320,
                    maxHeight: 400, borderRadius: 8,
                    backgroundColor: EDITORIAL.card,
                    borderWidth: 1, borderColor: EDITORIAL.hairline,
                    zIndex: 200,
                }}>
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 16, paddingVertical: 12,
                        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: EDITORIAL.hairline,
                    }}>
                        <Text style={{ color: EDITORIAL.ink, fontSize: 16, fontWeight: '700' }}>Notificacions</Text>
                        {notifications.length > 0 && (
                            <TouchableOpacity onPress={() => setNotifications([])}>
                                <Text style={{ color: EDITORIAL.inkMuted, fontSize: 12 }}>Esborrar tot</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                        {notifications.length === 0 ? (
                            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                                <AppIcon name="bell-off" size={32} color="rgba(255,255,255,0.2)" />
                                <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, marginTop: 10 }}>
                                    Cap notificació encara
                                </Text>
                            </View>
                        ) : (
                            notifications.map(n => (
                                <View key={n.id} style={{
                                    paddingHorizontal: 16, paddingVertical: 12,
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                    borderBottomColor: EDITORIAL.hairline,
                                }}>
                                    <Text style={{ color: EDITORIAL.ink, fontSize: 14, fontWeight: '600' }}>{n.title}</Text>
                                    <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, marginTop: 2 }}>{n.body}</Text>
                                    <Text style={{ color: EDITORIAL.inkMuted, fontSize: 12, marginTop: 4 }}>
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
                        width: '90%', maxWidth: 400, borderRadius: 8,
                        backgroundColor: EDITORIAL.card,
                        borderWidth: 1, borderColor: EDITORIAL.hairline,
                    }}>
                        {/* Capçalera modal */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingHorizontal: 20, paddingVertical: 16,
                            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: EDITORIAL.hairline,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <AppIcon name="bell" size={20} color="#FFFFFF" />
                                <Text style={{ color: EDITORIAL.ink, fontSize: 18, fontWeight: '700' }}>Preferències</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowNotifPrefs(false)} style={styles.headerBtn}>
                                <AppIcon name="x" size={18} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>

                        {/* Opcions */}
                        <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
                            <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, marginBottom: 14 }}>
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
                                            borderBottomColor: EDITORIAL.hairline,
                                        }}
                                        onPress={() => setNotifPrefs(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: EDITORIAL.ink, fontSize: 16, fontWeight: '600' }}>{opt.label}</Text>
                                            <Text style={{ color: EDITORIAL.inkMuted, fontSize: 12, marginTop: 1 }}>{opt.desc}</Text>
                                        </View>
                                        {/* Toggle */}
                                        <View style={{
                                            width: 44, height: 26, borderRadius: 13,
                                            backgroundColor: isActive ? EDITORIAL.grana : EDITORIAL.hairlineStrong,
                                            justifyContent: 'center',
                                            paddingHorizontal: 2,
                                        }}>
                                            <View style={{
                                                width: 22, height: 22, borderRadius: 11,
                                                backgroundColor: 'white',
                                                alignSelf: isActive ? 'flex-end' : 'flex-start',
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
                            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
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
                        onPress={dismissBillingConfirmation}
                    />
                    <View style={{
                        width: '90%', maxWidth: 420, borderRadius: 8,
                        backgroundColor: EDITORIAL.card,
                        borderWidth: 1, borderColor: EDITORIAL.hairline,
                    }}>
                        {/* Capçalera */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingHorizontal: 20, paddingVertical: 16,
                            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: EDITORIAL.hairline,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <AppIcon name="credit-card" size={20} color="#FFFFFF" />
                                <Text style={{ color: EDITORIAL.ink, fontSize: 18, fontWeight: '700' }}>Canviar pla</Text>
                            </View>
                            <TouchableOpacity onPress={dismissBillingConfirmation} disabled={isChangingPlan} style={styles.headerBtn}>
                                <AppIcon name="x" size={18} color="rgba(255,255,255,0.7)" />
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
                                    flex: 1, padding: 12, borderRadius: 8,
                                    backgroundColor: EDITORIAL.card,
                                    borderWidth: 1, borderColor: EDITORIAL.hairline,
                                    alignItems: 'center',
                                }}>
                                    <Text style={{ color: EDITORIAL.inkMuted, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>PLA ACTUAL</Text>
                                    <Text style={{ color: EDITORIAL.ink, fontSize: 16, fontWeight: '700' }}>{BILLING_PLANS[billingCycle].label}</Text>
                                    <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, marginTop: 2 }}>{BILLING_PLANS[billingCycle].priceLabel}</Text>
                                </View>
                                <AppIcon name="arrow-right" size={20} color="#FFFFFF" />
                                <View style={{
                                    flex: 1, padding: 12, borderRadius: 8,
                                    backgroundColor: 'rgba(237,187,0,0.1)',
                                    borderWidth: 1, borderColor: 'rgba(237,187,0,0.3)',
                                    alignItems: 'center',
                                }}>
                                    <Text style={{ color: EDITORIAL.ink, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>NOU PLA</Text>
                                    <Text style={{ color: EDITORIAL.ink, fontSize: 16, fontWeight: '700' }}>{BILLING_PLANS[pendingBillingCycle].label}</Text>
                                    <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, marginTop: 2 }}>{BILLING_PLANS[pendingBillingCycle].priceLabel}</Text>
                                </View>
                            </View>

                            {/* Info de facturació */}
                            <View style={{
                                padding: 14, borderRadius: 8,
                                backgroundColor: EDITORIAL.card,
                                marginBottom: 16,
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <AppIcon name="info" size={14} color="rgba(255,255,255,0.5)" style={{ marginRight: 8 }} />
                                    <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, fontWeight: '600' }}>Detalls del canvi</Text>
                                </View>
                                <Text style={{ color: EDITORIAL.inkMuted, fontSize: 12, lineHeight: 18 }}>
                                    {`• Nou preu: ${BILLING_PLANS[pendingBillingCycle].totalLabel}\n`}
                                    {BILLING_PLANS[pendingBillingCycle].saveYear > 0
                                        ? `• Estalvies ${BILLING_PLANS[pendingBillingCycle].saveYear}€/any respecte al pla mensual\n`
                                        : ''}
                                    {bar.isTestData ? '• Guardarem la teva selecció en aquesta sessió\n• Aquest canvi no implica cap càrrec'
                                        : subscriptionActive ? '• El canvi s’aplicarà immediatament\n• Es prorratejarà el que ja has pagat del cicle actual'
                                        : '• Completa l’alta al formulari segur de Stripe\n• La subscripció no s’activa fins que Stripe la confirma'}
                                </Text>
                            </View>

                            {/* Icona de seguretat Stripe */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                                <AppIcon name="lock" size={12} color="rgba(255,255,255,0.35)" />
                                <Text style={{ color: EDITORIAL.inkMuted, fontSize: 12 }}>{bar.isTestData ? 'Sense cap càrrec' : 'Pagament segur via Stripe'}</Text>
                            </View>

                            {/* Botons */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    style={{
                                        flex: 1, paddingVertical: 14, borderRadius: 8,
                                        borderWidth: 1, borderColor: EDITORIAL.hairline,
                                        alignItems: 'center',
                                    }}
                                    onPress={dismissBillingConfirmation}
                                    disabled={isChangingPlan}
                                    activeOpacity={0.7}
                                >
                                    <Text style={{ color: EDITORIAL.inkMuted, fontWeight: '600', fontSize: 14 }}>Cancel·lar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{
                                        flex: 2, paddingVertical: 14, borderRadius: 8,
                                        backgroundColor: EDITORIAL.grana, alignItems: 'center',
                                        borderWidth: 1, borderColor: EDITORIAL.borderOnBackground,
                                        opacity: isChangingPlan ? 0.6 : 1,
                                    }}
                                    onPress={handleConfirmBillingChange}
                                    disabled={isChangingPlan}
                                    activeOpacity={0.7}
                                >
                                    {isChangingPlan ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <Text style={{ color: EDITORIAL.ink, fontWeight: '700', fontSize: 14 }}>{bar.isTestData || subscriptionActive ? 'Confirmar canvi' : 'Continuar a Stripe'}</Text>
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
                        width: '90%', maxWidth: 420, borderRadius: 8,
                        backgroundColor: EDITORIAL.card,
                        borderWidth: 1, borderColor: 'rgba(165,0,68,0.4)',
                    }}>
                        {/* Capçalera */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingHorizontal: 20, paddingVertical: 16,
                            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(165,0,68,0.3)',
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <AppIcon name="alert-triangle" size={20} color="#a50044" />
                                <Text style={{ color: '#a50044', fontSize: 18, fontWeight: '700' }}>
                                    {deleteStep === 1 ? 'Eliminar compte' : 'Confirmació final'}
                                </Text>
                            </View>
                            {!isDeleting && (
                                <TouchableOpacity onPress={() => { setShowDeleteModal(false); setDeleteStep(1); setDeleteConfirmText(''); }} style={styles.headerBtn}>
                                    <AppIcon name="x" size={18} color="rgba(255,255,255,0.7)" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Pas 1: Advertència */}
                        {deleteStep === 1 && (
                            <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
                                <View style={{
                                    padding: 16, borderRadius: 8,
                                    backgroundColor: 'rgba(165,0,68,0.1)',
                                    borderWidth: 1, borderColor: 'rgba(165,0,68,0.2)',
                                    marginBottom: 20,
                                }}>
                                    <Text style={{ color: EDITORIAL.ink, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                                        Estàs segur que vols eliminar el teu compte?
                                    </Text>
                                    <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, lineHeight: 20 }}>
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
                                                <AppIcon name={item.icon as any} size={14} color="#a50044" style={{ marginRight: 10 }} />
                                                <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, flex: 1 }}>{item.text}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        style={{
                                            flex: 1, paddingVertical: 14, borderRadius: 8,
                                            borderWidth: 1, borderColor: EDITORIAL.hairline,
                                            alignItems: 'center',
                                        }}
                                        onPress={() => { setShowDeleteModal(false); setDeleteStep(1); }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: EDITORIAL.inkMuted, fontWeight: '600', fontSize: 14 }}>No, mantenir</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{
                                            flex: 1, paddingVertical: 14, borderRadius: 8,
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
                                <Text style={{ color: EDITORIAL.inkMuted, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                                    Per confirmar l'eliminació, escriu <Text style={{ color: '#a50044', fontWeight: '700' }}>ELIMINAR</Text> al camp de sota:
                                </Text>
                                <TextInput
                                    style={{
                                        width: '100%', padding: 14, borderRadius: 8,
                                        backgroundColor: EDITORIAL.card,
                                        borderWidth: 1,
                                        borderColor: deleteConfirmText === 'ELIMINAR' ? 'rgba(165,0,68,0.5)' : 'rgba(255,255,255,0.1)',
                                        color: EDITORIAL.ink, fontSize: 16, fontWeight: '700',
                                        textAlign: 'center', letterSpacing: 0,
                                    }}
                                    value={deleteConfirmText}
                                    onChangeText={setDeleteConfirmText}
                                    placeholder="ELIMINAR"
                                    placeholderTextColor={EDITORIAL.inkMuted}
                                    autoCapitalize="characters"
                                    autoFocus
                                />

                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                                    <TouchableOpacity
                                        style={{
                                            flex: 1, paddingVertical: 14, borderRadius: 8,
                                            borderWidth: 1, borderColor: EDITORIAL.hairline,
                                            alignItems: 'center',
                                        }}
                                        onPress={() => { setDeleteStep(1); setDeleteConfirmText(''); }}
                                        disabled={isDeleting}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ color: EDITORIAL.inkMuted, fontWeight: '600', fontSize: 14 }}>← Enrere</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{
                                            flex: 2, paddingVertical: 14, borderRadius: 8,
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
                                                showToast(getUserFriendlyError(e, "No s'ha pogut eliminar el compte. Torna-ho a provar."), 'error');
                                                setIsDeleting(false);
                                            }
                                        }}
                                        disabled={deleteConfirmText !== 'ELIMINAR' || isDeleting}
                                        activeOpacity={0.7}
                                    >
                                        {isDeleting ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <ActivityIndicator color="white" size="small" />
                                                <Text style={{ color: EDITORIAL.ink, fontWeight: '600', fontSize: 14 }}>Eliminant...</Text>
                                            </View>
                                        ) : (
                                            <Text style={{ color: EDITORIAL.ink, fontWeight: '700', fontSize: 14 }}>
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
