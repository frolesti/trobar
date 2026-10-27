import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Switch, Alert, Platform, Linking, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import Constants from 'expo-constants';
import { registerPushNotifications, requestNotificationPermission, saveNotificationArea, clearNotificationArea } from '../../services/notificationService';
import Text from '../../components/AppText';
import AppIcon from '../../components/AppIcon';
import { SKETCH_THEME } from '../../theme/sketchTheme';
import { EDITORIAL } from '../../theme/editorialTheme';
import { showAlert } from '../../components/AlertBanner';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
    UserPreferences, NotificationPreferences, DisplayPreferences,
    DEFAULT_PREFERENCES,
} from '../../models/UserProfile';
import {
    getUserPreferences, updateUserPreferences,
} from '../../services/userService';
import styles from './SettingsModal.styles';

// ── Tipus ──────────────────────────────────────────────

interface SettingsModalProps {
    visible: boolean;
    onClose?: () => void;
    onLogout?: () => void;
    accountBusy?: boolean;
}

// Mapeig editorial: icones ink, switch tracks grana, borders hairline, textMuted inkMuted.
const C = {
    ...SKETCH_THEME.colors,
    primary: '#FFFFFF',
    primarySoft: '#FFFFFF',
    border: 'rgba(255,255,255,0.4)',
    textMuted: '#F0CDD9',
    accent: EDITORIAL.grana,
    card: EDITORIAL.paper,
};
// Switch track 'on' → grana (override puntual)
const SWITCH_ON = '#DE7EA4';

// ── Opcions UI ─────────────────────────────────────────

const REMINDER_OPTIONS: { label: string; value: NotificationPreferences['matchReminder'] }[] = [
    { label: 'Desactivat', value: 0 },
    { label: '30 min', value: 30 },
    { label: '1 hora', value: 60 },
    { label: '2 hores', value: 120 },
];

const CATEGORY_OPTIONS: { label: string; value: DisplayPreferences['defaultCategory'] }[] = [
    { label: 'Tots', value: 'all' },
    { label: 'Masculí', value: 'masculino' },
    { label: 'Femení', value: 'femenino' },
];

const RADIUS_OPTIONS: { label: string; value: DisplayPreferences['searchRadius'] }[] = [
    { label: '500 m', value: 500 },
    { label: '1 km', value: 1000 },
    { label: '2 km', value: 2000 },
    { label: '5 km', value: 5000 },
    { label: '10 km', value: 10000 },
];

// ── Component ──────────────────────────────────────────

const ProfileSettings: React.FC<SettingsModalProps> = ({ visible, onClose, onLogout, accountBusy = false }) => {
    const { user, deleteAccount } = useAuth();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

    const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const [radiusIndex, setRadiusIndex] = useState(2);

    // ── Carregar preferències ──
    useEffect(() => {
        if (!visible || !user) return;
        let active = true;
        setLoaded(false);
        setLoadError(false);
        getUserPreferences(user.id).then(p => {
            if (active) {
                setPrefs(p);
                setRadiusIndex(Math.max(0, RADIUS_OPTIONS.findIndex(option => option.value === p.display.searchRadius)));
                setLoaded(true);
            }
        }).catch(() => { if (active) setLoadError(true); });
        return () => { active = false; };
    }, [visible, user?.id, loadAttempt]);

    // ── Helpers per actualitzar i desar ──

    const updateNotif = async <K extends keyof NotificationPreferences>(
        key: K, value: NotificationPreferences[K],
    ) => {
        if (!user || pending.current) return;
        pending.current = true;
        setBusy(true);
        try {
            if (value) {
                const permission = await requestNotificationPermission();
                if (permission !== 'granted') {
                    Alert.alert('Notificacions desactivades', Platform.OS === 'web' ? 'Les notificacions estan disponibles a l’app mòbil.' : 'Activa el permís de notificacions a la configuració del dispositiu.', Platform.OS === 'web' ? undefined : [{ text: 'Cancel·la', style: 'cancel' }, { text: 'Obrir configuració', onPress: () => { void Linking.openSettings(); } }]);
                    return;
                }
                if ((key === 'newBarNearby' || key === 'barPromotions') && !await saveNotificationArea(user.id)) {
                    Alert.alert('Ubicació no disponible', 'Cal autoritzar la ubicació per rebre alertes dels bars de la teva zona.');
                    return;
                }
            }
            const notifications = { ...prefs.notifications, [key]: value };
            await updateUserPreferences(user.id, { notifications });
            setPrefs(prev => ({ ...prev, notifications }));
            if (!notifications.newBarNearby && !notifications.barPromotions) await clearNotificationArea(user.id);
            if (value) {
                const registration = await registerPushNotifications(user.id, false);
                if (registration === 'error') Alert.alert('Registre pendent', 'La preferència s’ha desat, però no s’ha pogut registrar el dispositiu. Torna-ho a provar.');
            }
        } catch {
            Alert.alert('No s’ha pogut desar', 'Torna-ho a provar.');
        } finally { pending.current = false; setBusy(false); }
    };

    const updateDisplay = async <K extends keyof DisplayPreferences>(
        key: K, value: DisplayPreferences[K],
    ) => {
        if (!user || !loaded || pending.current) return;
        if (prefs.display[key] === value) return;
        pending.current = true;
        setBusy(true);
        try {
            const display = { ...prefs.display, [key]: value };
            await updateUserPreferences(user.id, { display });
            setPrefs(prev => ({ ...prev, display }));
        } catch {
            if (key === 'searchRadius') setRadiusIndex(Math.max(0, RADIUS_OPTIONS.findIndex(option => option.value === prefs.display.searchRadius)));
            showAlert({ tone: 'error', message: "No s'ha pogut desar la preferència. Torna-ho a provar." });
        } finally { pending.current = false; setBusy(false); }
    };

    // ── Navegació a pàgines legals ──
    const commitRadius = (value: number) => {
        const index = Math.round(value);
        setRadiusIndex(index);
        void updateDisplay('searchRadius', RADIUS_OPTIONS[index].value);
    };

    const goTerms = () => { onClose?.(); navigation.navigate('TermsOfService'); };
    const goPrivacy = () => { onClose?.(); navigation.navigate('PrivacyPolicy'); };
    const contactSupport = () => { void Linking.openURL('mailto:suport@trobar-app.cat').catch(() => showAlert({ tone: 'error', message: "No s'ha pogut obrir el correu de suport." })); };

    // ── Eliminar compte ──
    const handleDeleteAccount = () => {
        const confirmDelete = async () => {
            try {
                setIsDeleting(true);
                await deleteAccount();
            } catch (error) {
                console.error(error);
                showAlert({ tone: 'error', message: "No s'ha pogut eliminar el compte. Torna-ho a provar." });
                setIsDeleting(false);
            }
        };

        Alert.alert(
            "Eliminar Compte",
            "Estàs segur que vols eliminar el teu compte? Aquesta acció és irreversible.",
            [
                { text: "Cancel·lar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: confirmDelete }
            ]
        );
    };

    if (!visible && !loaded) return null;

    // ── PillSelector ──
    const PillSelector = <T extends string | number>({ label, options, value, onChange }: {
        label: string;
        options: { label: string; value: T }[];
        value: T;
        onChange: (v: T) => void;
    }) => (
        <View style={styles.pillRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
            {options.map(opt => {
                const active = opt.value === value;
                return (
                    <TouchableOpacity
                        key={String(opt.value)}
                        style={[styles.pill, { minWidth: options.length === 4 ? 96 : 72, flexBasis: options.length === 4 ? '46%' : '28%' }, active && styles.pillActive]}
                        disabled={!loaded || busy}
                        accessibilityRole="radio"
                        aria-checked={active}
                        accessibilityState={{ checked: active, disabled: !loaded || busy }}
                        onPress={() => onChange(opt.value)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    // ── Render ──

    return (
        <View>
                    {!loaded && <View style={styles.section}>
                        {loadError ? <TouchableOpacity accessibilityRole="button" style={styles.legalRow} onPress={() => setLoadAttempt(value => value + 1)}><Text style={styles.legalText}>Tornar a carregar les preferències</Text><AppIcon name="refresh-cw" size={20} color="#FFFFFF" /></TouchableOpacity> : <ActivityIndicator accessibilityLabel="Carregant preferències" color="#FFFFFF" />}
                    </View>}
                    {/* ═══════════ NOTIFICACIONS ═══════════ */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Notificacions</Text>

                        {/* Recordatori de partit */}
                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <AppIcon name="alarm-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Recordatori de partit</Text>
                                    <Text style={styles.rowSubtitle}>Avisa abans d'un partit</Text>
                                </View>
                            </View>
                        </View>
                        <PillSelector
                            label="Recordatori de partit"
                            options={REMINDER_OPTIONS}
                            value={prefs.notifications.matchReminder}
                            onChange={v => updateNotif('matchReminder', v)}
                        />

                        {/* Resultats en directe */}
                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <AppIcon name="football-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Resultats en directe</Text>
                                    <Text style={styles.rowSubtitle}>Gols i resultat final</Text>
                                </View>
                            </View>
                            <Switch
                                accessibilityLabel="Resultats en directe"
                                disabled={!loaded || busy}
                                value={prefs.notifications.liveResults}
                                onValueChange={v => updateNotif('liveResults', v)}
                                trackColor={{ false: C.border, true: SWITCH_ON }}
                                thumbColor="white"
                                ios_backgroundColor={C.border}
                            />
                        </View>

                        {/* Nous bars a prop */}
                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <AppIcon name="location-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Nous bars a prop</Text>
                                    <Text style={styles.rowSubtitle}>Alertes de bars verificats nous</Text>
                                </View>
                            </View>
                            <Switch
                                accessibilityLabel="Nous bars a prop"
                                disabled={!loaded || busy}
                                value={prefs.notifications.newBarNearby}
                                onValueChange={v => updateNotif('newBarNearby', v)}
                                trackColor={{ false: C.border, true: SWITCH_ON }}
                                thumbColor="white"
                                ios_backgroundColor={C.border}
                            />
                        </View>

                        {/* Promocions */}
                        <View style={[styles.row, styles.rowLast]}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <AppIcon name="pricetag-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Promocions de bars</Text>
                                    <Text style={styles.rowSubtitle}>Ofertes de bars premium</Text>
                                </View>
                            </View>
                            <Switch
                                accessibilityLabel="Promocions de bars"
                                disabled={!loaded || busy}
                                value={prefs.notifications.barPromotions}
                                onValueChange={v => updateNotif('barPromotions', v)}
                                trackColor={{ false: C.border, true: SWITCH_ON }}
                                thumbColor="white"
                                ios_backgroundColor={C.border}
                            />
                        </View>
                    </View>

                    {/* ═══════════ VISUALITZACIÓ ═══════════ */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Visualització</Text>

                        {/* Categoria per defecte */}
                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <AppIcon name="shirt-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Categoria per defecte</Text>
                                    <Text style={styles.rowSubtitle}>Categoria inicial al mapa i als partits</Text>
                                </View>
                            </View>
                        </View>
                        <PillSelector
                            label="Categoria per defecte"
                            options={CATEGORY_OPTIONS}
                            value={prefs.display.defaultCategory}
                            onChange={v => updateDisplay('defaultCategory', v)}
                        />

                        {/* Radi de cerca */}
                        <View style={[styles.row, styles.rowLast]}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <AppIcon name="navigate-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Radi de cerca</Text>
                                    <Text style={styles.rowSubtitle}>Distància per buscar bars al mapa</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.radiusControl}>
                            <Text style={styles.radiusValue} accessibilityLiveRegion="polite">{RADIUS_OPTIONS[radiusIndex].label}</Text>
                            {Platform.OS === 'web' ? React.createElement('input', {
                                type: 'range',
                                'aria-label': 'Radi de cerca',
                                'aria-valuetext': RADIUS_OPTIONS[radiusIndex].label,
                                min: 0,
                                max: RADIUS_OPTIONS.length - 1,
                                step: 1,
                                value: radiusIndex,
                                disabled: !loaded || busy,
                                onChange: (event: React.ChangeEvent<HTMLInputElement>) => setRadiusIndex(Number(event.currentTarget.value)),
                                onPointerUp: (event: React.PointerEvent<HTMLInputElement>) => commitRadius(Number(event.currentTarget.value)),
                                onKeyUp: (event: React.KeyboardEvent<HTMLInputElement>) => commitRadius(Number(event.currentTarget.value)),
                                onBlur: (event: React.FocusEvent<HTMLInputElement>) => commitRadius(Number(event.currentTarget.value)),
                                style: { width: '100%', height: 48, margin: 0, accentColor: '#DE7EA4', cursor: 'pointer' },
                            }) : <Slider
                                accessibilityLabel="Radi de cerca"
                                accessibilityValue={{ min: 0, max: RADIUS_OPTIONS.length - 1, now: radiusIndex, text: RADIUS_OPTIONS[radiusIndex].label }}
                                minimumValue={0}
                                maximumValue={RADIUS_OPTIONS.length - 1}
                                step={1}
                                value={radiusIndex}
                                disabled={!loaded || busy}
                                onValueChange={value => setRadiusIndex(Math.round(value))}
                                onSlidingComplete={commitRadius}
                                minimumTrackTintColor="#DE7EA4"
                                maximumTrackTintColor="rgba(255,255,255,0.3)"
                                thumbTintColor="#FFFFFF"
                                style={styles.radiusSlider}
                            />}
                            <View style={styles.radiusLimits}><Text style={styles.rowSubtitle}>500 m</Text><Text style={styles.rowSubtitle}>10 km</Text></View>
                        </View>
                    </View>

                    <View style={[styles.section, styles.accountSection]}>
                        <Text accessibilityRole="header" style={styles.sectionTitle}>Compte</Text>
                        {onLogout && <TouchableOpacity accessibilityRole="button" disabled={accountBusy || isDeleting} onPress={onLogout} style={styles.logoutButton}>
                            <AppIcon name="log-out" size={20} color="#FFFFFF" />
                            <Text style={styles.logoutText}>Tancar sessió</Text>
                        </TouchableOpacity>}
                        <TouchableOpacity accessibilityRole="button" onPress={handleDeleteAccount} disabled={isDeleting || accountBusy} style={styles.deleteButton}>
                            <Text style={styles.deleteText}>{isDeleting ? 'Eliminant el compte...' : 'Eliminar el compte'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer} testID="profile-footer">
                        <View style={styles.footerLinks}>
                            <TouchableOpacity accessibilityRole="link" style={styles.footerLink} onPress={goTerms}><Text style={styles.footerText}>Termes del servei</Text></TouchableOpacity>
                            <TouchableOpacity accessibilityRole="link" style={styles.footerLink} onPress={goPrivacy}><Text style={styles.footerText}>Privacitat</Text></TouchableOpacity>
                            <TouchableOpacity accessibilityRole="link" style={styles.footerLink} onPress={contactSupport}><Text style={styles.footerText}>Contacte i suport</Text></TouchableOpacity>
                        </View>
                        <Text style={styles.versionText}>troBar {Constants.expoConfig?.version}</Text>
                    </View>
        </View>
    );
};

export default ProfileSettings;
