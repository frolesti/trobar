import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Switch, Modal,
    Animated, Dimensions, Platform, Alert,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SKETCH_THEME } from '../../theme/sketchTheme';
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
    onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const C = SKETCH_THEME.colors;

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
];

// ── Component ──────────────────────────────────────────

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const { user, deleteAccount } = useAuth();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

    const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
    const [loaded, setLoaded] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // ── Carregar preferències ──
    useEffect(() => {
        if (visible && user) {
            getUserPreferences(user.id).then(p => {
                setPrefs(p);
                setLoaded(true);
            });
        }
    }, [visible, user]);

    // ── Animació d'entrada/sortida ──
    useEffect(() => {
        if (visible) {
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

    // ── Helpers per actualitzar i desar ──

    const updateNotif = useCallback(<K extends keyof NotificationPreferences>(
        key: K, value: NotificationPreferences[K],
    ) => {
        setPrefs(prev => {
            const updated = { ...prev, notifications: { ...prev.notifications, [key]: value } };
            if (user) {
                updateUserPreferences(user.id, {
                    notifications: updated.notifications,
                }).then(() => {
                    console.log(`[PREFS] notif.${key} = ${value}`);
                }).catch(e => {
                    console.error('[PREFS] Error guardant notificació:', e);
                });
            }
            return updated;
        });
    }, [user]);

    const updateDisplay = useCallback(<K extends keyof DisplayPreferences>(
        key: K, value: DisplayPreferences[K],
    ) => {
        setPrefs(prev => {
            const updated = { ...prev, display: { ...prev.display, [key]: value } };
            if (user) {
                updateUserPreferences(user.id, {
                    display: updated.display,
                }).then(() => {
                    console.log(`[PREFS] display.${key} = ${value}`);
                }).catch(e => {
                    console.error('[PREFS] Error guardant display:', e);
                });
            }
            return updated;
        });
    }, [user]);

    // ── Navegació a pàgines legals ──
    const goTerms = () => { onClose(); setTimeout(() => navigation.navigate('TermsOfService'), 300); };
    const goPrivacy = () => { onClose(); setTimeout(() => navigation.navigate('PrivacyPolicy'), 300); };

    // ── Eliminar compte ──
    const handleDeleteAccount = () => {
        const confirmDelete = async () => {
            try {
                setIsDeleting(true);
                await deleteAccount();
            } catch (error) {
                console.error(error);
                Alert.alert('Error', "No s'ha pogut eliminar el compte. Torna-ho a provar.");
                setIsDeleting(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Estàs segur que vols eliminar el teu compte? Aquesta acció és irreversible.")) {
                confirmDelete();
            }
        } else {
            Alert.alert(
                "Eliminar Compte",
                "Estàs segur que vols eliminar el teu compte? Aquesta acció és irreversible.",
                [
                    { text: "Cancel·lar", style: "cancel" },
                    { text: "Eliminar", style: "destructive", onPress: confirmDelete }
                ]
            );
        }
    };

    if (!visible && !loaded) return null;

    // ── PillSelector ──
    const PillSelector = <T extends string | number>({ options, value, onChange }: {
        options: { label: string; value: T }[];
        value: T;
        onChange: (v: T) => void;
    }) => (
        <View style={styles.pillRow}>
            {options.map(opt => {
                const active = opt.value === value;
                return (
                    <TouchableOpacity
                        key={String(opt.value)}
                        style={[styles.pill, active && styles.pillActive]}
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

    const modalContent = (
        <View style={{ flex: 1 }}>
            {/* Fons semitransparent per tancar */}
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
            />

            {/* Panell lliscant */}
            <Animated.View
                style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: SCREEN_HEIGHT * 0.85,
                    backgroundColor: C.card,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    transform: [{ translateY }],
                    ...Platform.select({
                        web: { boxShadow: '0px -6px 40px rgba(0,0,0,0.25)' } as any,
                        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.25, shadowRadius: 20 },
                        android: { elevation: 24 },
                    }),
                }}
            >
                {/* Indicador d'arrossegament */}
                <View style={styles.dragIndicator} />

                {/* Capçalera */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Configuració</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Feather name="x" size={18} color={C.primary} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* ═══════════ NOTIFICACIONS ═══════════ */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Notificacions</Text>

                        {/* Recordatori de partit */}
                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <Ionicons name="alarm-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Recordatori de partit</Text>
                                    <Text style={styles.rowSubtitle}>Avisa abans d'un partit</Text>
                                </View>
                            </View>
                        </View>
                        <PillSelector
                            options={REMINDER_OPTIONS}
                            value={prefs.notifications.matchReminder}
                            onChange={v => updateNotif('matchReminder', v)}
                        />

                        {/* Resultats en directe */}
                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <Ionicons name="football-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Resultats en directe</Text>
                                    <Text style={styles.rowSubtitle}>Gols i resultat final</Text>
                                </View>
                            </View>
                            <Switch
                                value={prefs.notifications.liveResults}
                                onValueChange={v => updateNotif('liveResults', v)}
                                trackColor={{ false: C.border, true: C.primary }}
                                thumbColor="white"
                            />
                        </View>

                        {/* Nous bars a prop */}
                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <Ionicons name="location-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Nous bars a prop</Text>
                                    <Text style={styles.rowSubtitle}>Alertes de bars verificats nous</Text>
                                </View>
                            </View>
                            <Switch
                                value={prefs.notifications.newBarNearby}
                                onValueChange={v => updateNotif('newBarNearby', v)}
                                trackColor={{ false: C.border, true: C.primary }}
                                thumbColor="white"
                            />
                        </View>

                        {/* Promocions */}
                        <View style={[styles.row, styles.rowLast]}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <Ionicons name="pricetag-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Promocions de bars</Text>
                                    <Text style={styles.rowSubtitle}>Ofertes de bars premium</Text>
                                </View>
                            </View>
                            <Switch
                                value={prefs.notifications.barPromotions}
                                onValueChange={v => updateNotif('barPromotions', v)}
                                trackColor={{ false: C.border, true: C.primary }}
                                thumbColor="white"
                            />
                        </View>
                    </View>

                    <View style={styles.separator} />

                    {/* ═══════════ VISUALITZACIÓ ═══════════ */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Visualització</Text>

                        {/* Categoria per defecte */}
                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <Ionicons name="shirt-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Categoria per defecte</Text>
                                    <Text style={styles.rowSubtitle}>Filtre inicial al llistat de partits</Text>
                                </View>
                            </View>
                        </View>
                        <PillSelector
                            options={CATEGORY_OPTIONS}
                            value={prefs.display.defaultCategory}
                            onChange={v => updateDisplay('defaultCategory', v)}
                        />

                        {/* Radi de cerca */}
                        <View style={[styles.row, styles.rowLast]}>
                            <View style={styles.rowLeft}>
                                <View style={styles.rowIcon}>
                                    <Ionicons name="navigate-outline" size={18} color={C.primary} />
                                </View>
                                <View style={styles.rowTextGroup}>
                                    <Text style={styles.rowTitle}>Radi de cerca</Text>
                                    <Text style={styles.rowSubtitle}>Distància per buscar bars al mapa</Text>
                                </View>
                            </View>
                        </View>
                        <PillSelector
                            options={RADIUS_OPTIONS}
                            value={prefs.display.searchRadius}
                            onChange={v => updateDisplay('searchRadius', v)}
                        />
                    </View>

                    {/* ═══════════ LEGAL I SUPORT ═══════════ */}
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <View style={{ paddingTop: 16 }}>
                        <View style={{ paddingHorizontal: 20, paddingBottom: 0 }}>
                            <Text style={styles.sectionTitle}>Legal i suport</Text>
                        </View>

                        <TouchableOpacity style={styles.legalRow} onPress={goTerms} activeOpacity={0.6}>
                            <Text style={styles.legalText}>Termes del servei</Text>
                            <Feather name="chevron-right" size={20} color={C.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.legalRow} onPress={goPrivacy} activeOpacity={0.6}>
                            <Text style={styles.legalText}>Política de privacitat</Text>
                            <Feather name="chevron-right" size={20} color={C.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Eliminar compte */}
                    <TouchableOpacity
                        onPress={handleDeleteAccount}
                        disabled={isDeleting}
                        style={{ alignSelf: 'center', padding: 10, marginTop: 8, opacity: isDeleting ? 0.4 : 0.7 }}
                    >
                        <Text style={{
                            color: SKETCH_THEME.colors.accent,
                            fontWeight: '600',
                            fontSize: 12,
                            fontFamily: 'Lora',
                            textDecorationLine: 'underline',
                        }}>
                            Eliminar el compte
                        </Text>
                    </TouchableOpacity>

                    {/* Crèdits */}
                    <Text style={styles.versionText}>troBar v1.3.0 · @frolesti · 2026</Text>
                    </View>

                </ScrollView>
            </Animated.View>
        </View>
    );

    // ── Render diferent per web vs natiu ──
    if (Platform.OS === 'web') {
        if (!visible) return null;
        return (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
                {modalContent}
            </View>
        );
    }

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            {modalContent}
        </Modal>
    );
};

export default SettingsModal;
