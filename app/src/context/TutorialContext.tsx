import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Keyboard, Modal, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import Text from '../components/AppText';
import { showAlert } from '../components/AlertBanner';
import { EDITORIAL } from '../theme/editorialTheme';
import { useAuth } from './AuthContext';

type Kind = 'basic' | 'account' | 'owner';
type Anchor = Pick<React.ComponentRef<typeof View>, 'measureInWindow'>;
type Rect = { x: number; y: number; width: number; height: number };
type Step = { screen: 'Map' | 'Profile' | 'BarDashboard'; target: string; title: string; body: string; optional?: boolean; guestOnly?: boolean };
type Target = { node: () => Anchor | null; ready: boolean; prepare: () => void; available: boolean };
type TutorialActions = {
    register: (id: string, target: Target) => () => void;
    activeKind: Kind | null;
    targetId: string | null;
};
const Context = createContext<TutorialActions | null>(null);

const guides: Record<Kind, Step[]> = {
    basic: [
        { screen: 'Map', target: 'map-search', title: 'Troba bar, sense crear un compte', body: 'Cerca un bar pel nom o escriu una adreça per explorar una altra zona. Pots consultar locals, veure’n les fitxes i obrir les indicacions sense iniciar sessió.' },
        { screen: 'Map', target: 'map-filters', title: 'Tria l’ambient que busques', body: 'Combina serveis, ambient i reserves. Per a un partit concret, pots amagar els bars marcats com a complets. Que un bar no aparegui com a complet no garanteix que hi quedin places.' },
        { screen: 'Map', target: 'map-bar', optional: true, title: 'Un bar real a prop teu', body: 'Aquesta és la fitxa del local de troBar més proper a la teva ubicació; si no la comparteixes, fem servir el centre del mapa. Toca qualsevol pin de troBar per veure’n el nom, les fotos i l’adreça.' },
        { screen: 'Map', target: 'map-directions', optional: true, title: 'De la fitxa al bar', body: 'Com arribar-hi obre l’app de mapes amb l’adreça del local. A la fitxa també pots consultar els horaris disponibles i les valoracions de la comunitat.' },
        { screen: 'Map', target: 'map-premium', optional: true, title: 'Més informació del local', body: 'Obre el perfil Premium per veure els serveis, les fotos i els partits anunciats. Si el local ofereix reserves en línia, l’enllaç et porta al seu sistema de reserves.' },
        { screen: 'Map', target: 'map-matches', optional: true, title: 'On fan aquest partit?', body: 'Toca un partit de la capçalera per filtrar els locals que el tenen anunciat. Canvia de partit per consultar-ne les emissions; no tots els locals emeten tots els partits.' },
        { screen: 'Map', target: 'map-discovery', title: 'Falta el bar que coneixes?', body: 'La lupa busca altres locals a la zona visible. Aquests pins encara no estan confirmats a troBar: trobar un local no vol dir que hi emetin futbol.' },
        { screen: 'Map', target: 'map-report', title: 'Ajuda a completar el mapa', body: 'Toca un pin sense confirmar. Si saps que s’hi veuen partits, prem «Sí, avisa tothom!» per afegir-lo a troBar. Si no n’estàs segur, no el confirmis. Això no el converteix en un local verificat pel propietari ni li activa Premium.' },
        { screen: 'Map', target: 'map-account', guestOnly: true, title: 'Amb compte, hi guanyes més', body: 'El mapa i la cerca ja són teus sense registrar-te. Amb un compte gratuït pots consultar el calendari de Partits, escriure ressenyes als perfils que en tenen, seguir bars Premium i triar els avisos que vols rebre.' },
    ],
    account: [
        { screen: 'Profile', target: 'profile-details', title: 'El teu perfil', body: 'Canvia la foto, el nom i els cognoms. Els canvis es desen automàticament.' },
        { screen: 'Profile', target: 'profile-notifications', title: 'Tria els teus avisos', body: 'Decideix quins recordatoris i avisos vols rebre. Les notificacions del mòbil necessiten el teu permís.' },
        { screen: 'Profile', target: 'profile-display', title: 'Una cerca a mida', body: 'Ajusta el radi de cerca i la categoria de partits que prefereixes des de les preferències del perfil.' },
        { screen: 'Map', target: 'map-account', title: 'Fes més amb el teu compte', body: 'Des de Partits pots consultar el calendari i buscar on veure cada encontre. Als perfils Premium pots seguir el bar per rebre’n avisos i publicar una ressenya de la teva experiència. Tu decideixes les notificacions des del perfil.' },
    ],
    owner: [
        { screen: 'BarDashboard', target: 'owner-edit', title: 'Presenta el teu bar', body: 'Edita la descripció, els serveis i la informació del local. Revisa com queda el perfil abans de compartir-lo.' },
        { screen: 'BarDashboard', target: 'owner-matches', title: 'Anuncia els partits', body: 'Tria els partits que emets perquè els culers et trobin quan cerquin on veure’ls. Desa els canvis del perfil per publicar-los.' },
        { screen: 'BarDashboard', target: 'owner-reservations', title: 'Reserves i aforament', body: 'Amb Premium pots afegir l’enllaç de reserves. A Partits que emets, marca com a complet cada partit quan no quedin places.' },
        { screen: 'BarDashboard', target: 'owner-settings', title: 'Gestiona el teu compte', body: 'A Configuració trobaràs els avisos i la gestió del pla del teu local.' },
    ],
};

export function tutorialKey(kind: Kind, userId?: string): string {
    if (kind !== 'basic' && !userId) throw new Error('Account tutorial requires a user');
    return `@trobar:tutorial:${kind}:v1${kind === 'basic' ? '' : `:${userId}`}`;
}

export function tutorialCardTop(rect: Rect, height: number, top: number, bottom: number, cardHeight: number): number {
    const below = height - bottom - rect.y - rect.height - 24;
    const above = rect.y - top - 24;
    const proposed = below >= cardHeight || below >= above ? rect.y + rect.height + 12 : rect.y - cardHeight - 12;
    return Math.max(top + 12, Math.min(proposed, height - bottom - cardHeight - 12));
}

export function useTutorial() {
    const context = useContext(Context);
    if (!context) throw new Error('TutorialProvider is missing');
    return context;
}

export function useTutorialTarget(id: string, ready = true, prepare?: () => void, available = true) {
    const { register } = useTutorial();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const [transitioning, setTransitioning] = useState(false);
    const node = useRef<Anchor | null>(null);
    const prepareRef = useRef(prepare);
    prepareRef.current = prepare;
    useEffect(() => {
        const start = navigation.addListener('transitionStart', () => setTransitioning(true));
        const end = navigation.addListener('transitionEnd', () => setTransitioning(false));
        return () => { start(); end(); };
    }, [navigation]);
    useEffect(() => register(id, { node: () => node.current, ready: ready && !transitioning, prepare: () => prepareRef.current?.(), available }), [id, ready, transitioning, register, available]);
    return useCallback((value: Anchor | null) => { node.current = value; }, []);
}

export function TutorialProvider({ children, navigation, route }: {
    children: React.ReactNode;
    navigation: NavigationContainerRefWithCurrent<RootStackParamList>;
    route: string | undefined;
}) {
    const { user, isLoading, requiresRegistrationConsent } = useAuth();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const targets = useRef(new Map<string, Target>());
    const [revision, setRevision] = useState(0);
    const [seen, setSeen] = useState<Set<string> | null>(null);
    const progressScope = useRef<string | undefined | null>(null);
    const dismissed = useRef(new Set<string>());
    const [active, setActive] = useState<{ kind: Kind; index: number; key: string; steps: Step[] } | null>(null);
    const preparedStep = useRef<Step | null>(null);
    const [rect, setRect] = useState<Rect | null>(null);
    const [cardHeight, setCardHeight] = useState(280);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const scope = user?.id;
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const enabled = !isLoading && !requiresRegistrationConsent;

    useEffect(() => {
        let current = true;
        progressScope.current = null;
        setActive(null);
        setSeen(null);
        const keys = [tutorialKey('basic'), ...(scope ? [tutorialKey('account', scope), tutorialKey('owner', scope)] : [])];
        void AsyncStorage.multiGet(keys).then(values => {
            if (current) {
                progressScope.current = scope;
                setSeen(new Set(values.filter(([, value]) => value === 'done' || value === 'started').map(([key]) => key)));
            }
        }).catch(error => {
            console.info('[Tutorial] Could not load tutorial progress', error);
            if (current) showAlert({ tone: 'error', message: 'No hem pogut carregar la guia inicial. Pots continuar utilitzant l’app.' });
        });
        return () => { current = false; };
    }, [scope]);

    const register = useCallback((id: string, target: Target) => {
        targets.current.set(id, target);
        setRevision(value => value + 1);
        return () => {
            if (targets.current.get(id) === target) {
                targets.current.delete(id);
                setRevision(value => value + 1);
            }
        };
    }, []);

    const start = useCallback((kind: Kind) => {
        if (kind !== 'basic' && !scope) {
            showAlert({ tone: 'info', message: 'Inicia sessió per veure la guia del teu compte.' });
            return;
        }
        Keyboard.dismiss();
        const key = tutorialKey(kind, scope);
        dismissed.current.add(key);
        void AsyncStorage.setItem(key, 'started').catch(error => {
            console.info('[Tutorial] Could not record tutorial start', error);
            showAlert({ tone: 'error', message: 'No hem pogut desar l’inici de la guia. Pot tornar a aparèixer quan obris l’app.' });
        });
        setRect(null);
        setActive({ kind, index: 0, key, steps: guides[kind].filter(step =>
            (!step.optional || targets.current.get(step.target)?.available) && (!step.guestOnly || !scope)) });
    }, [scope]);

    useEffect(() => {
        if (!enabled || !seen || active || progressScope.current !== scope) return;
        const kind = route === 'BarDashboard' && user?.role === 'bar_owner' ? 'owner'
            : route === 'Map' && !seen.has(tutorialKey('basic')) && !dismissed.current.has(tutorialKey('basic')) ? 'basic'
                : user && user.role !== 'bar_owner' && (route === 'Map' || route === 'Profile') ? 'account' : null;
        if (!kind) return;
        const key = tutorialKey(kind, scope);
        const readyTarget = kind === 'account' && route === 'Map' ? 'map-search' : guides[kind][0].target;
        if (seen.has(key) || dismissed.current.has(key) || !targets.current.get(readyTarget)?.ready) return;
        start(kind);
    }, [enabled, seen, active, route, user?.role, scope, revision, start]);

    const activeForScope = active && (active.kind === 'basic' || (!!scope && active.key === tutorialKey(active.kind, scope)));
    const step = active && activeForScope ? active.steps[active.index] : null;
    useEffect(() => {
        setRect(null);
        if (!enabled || !step || !navigation.isReady()) return;
        if (route !== step.screen) {
            if (step.screen === 'Map') navigation.navigate('Map');
            else if (step.screen === 'Profile') navigation.navigate('Profile');
            else navigation.navigate('BarDashboard', { tab: 'profile' });
            return;
        }
        const target = targets.current.get(step.target);
        if (!target) return;
        if (preparedStep.current !== step) {
            preparedStep.current = step;
            target.prepare();
        }
        if (!target.ready) return;
        let cancelled = false;
        let frame = 0;
        let attempts = 0;
        let previousRect: Rect | null = null;
        let stableFrames = 0;
        const measure = () => {
            if (cancelled) return;
            const node = target.node();
            const retry = () => {
                if (cancelled) return;
                if (++attempts < 30) frame = requestAnimationFrame(measure);
                else {
                    console.info('[Tutorial] Target is not visible', step.target);
                    if (active) dismissed.current.add(active.key);
                    setActive(null);
                    showAlert({ tone: 'info', message: 'No hem pogut situar aquest pas de la guia. Pots continuar utilitzant l’app.' });
                }
            };
            if (!node) { retry(); return; }
            node.measureInWindow((x, y, w, h) => {
                if (cancelled) return;
                if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || x + w <= 0 || x >= width || y < 0 || y >= height - insets.bottom) { retry(); return; }
                const nextRect = { x, y, width: w, height: h };
                const moving = !previousRect || Math.abs(previousRect.x - x) > 0.5 || Math.abs(previousRect.y - y) > 0.5
                    || Math.abs(previousRect.width - w) > 0.5 || Math.abs(previousRect.height - h) > 0.5;
                previousRect = nextRect;
                stableFrames = moving ? 0 : stableFrames + 1;
                if (stableFrames < 2) { retry(); return; }
                setRect({ x: Math.max(4, x - 6), y: Math.max(4, y - 6), width: Math.min(w + 12, width - Math.max(4, x - 6) - 4), height: Math.min(h + 12, height - Math.max(4, y - 6) - 4) });
                AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.body}`);
            });
        };
        frame = requestAnimationFrame(measure);
        return () => { cancelled = true; cancelAnimationFrame(frame); };
    }, [step, enabled, route, navigation, revision, width, height, insets.bottom]);

    const finish = async (createAccount = false) => {
        if (!active || !activeForScope || busyRef.current) return;
        const current = active;
        const currentScope = scope;
        busyRef.current = true;
        setBusy(true);
        try {
            await AsyncStorage.setItem(current.key, 'done');
            if (scopeRef.current === currentScope) setSeen(previous => previous ? new Set([...previous, current.key]) : null);
        } catch (error) {
            console.info('[Tutorial] Could not save tutorial progress', error);
            dismissed.current.add(current.key);
            showAlert({ tone: 'error', message: 'No hem pogut desar el progrés de la guia. Pot tornar a aparèixer quan obris l’app.' });
        } finally {
            if (scopeRef.current === currentScope) setActive(null);
            busyRef.current = false;
            setBusy(false);
        }
        if (createAccount && scopeRef.current === currentScope && !currentScope) navigation.navigate('Login');
    };
    const actions = useMemo(() => ({ register, activeKind: activeForScope && active ? active.kind : null, targetId: step?.target ?? null }), [register, activeForScope, active?.kind, step?.target]);
    const cardWidth = Math.min(360, width - 32);
    return <Context.Provider value={actions}>
        {children}
        <Modal visible={enabled && !!activeForScope} transparent animationType="none" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={() => { void finish(); }}>
            {active && step && !rect && <View style={[StyleSheet.absoluteFill, styles.loading]} accessibilityViewIsModal>
                <ActivityIndicator accessibilityLabel="Preparant el pas de la guia" color={EDITORIAL.matchday} />
                <Text accessibilityLiveRegion="polite" style={styles.body}>Preparant el pas…</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Saltar la guia" disabled={busy} style={styles.button} onPress={() => { void finish(); }}><Text style={styles.skipText}>Omet</Text></TouchableOpacity>
            </View>}
            {active && step && rect && <View style={StyleSheet.absoluteFill} accessibilityViewIsModal onAccessibilityEscape={() => { void finish(); }}>
                {[
                    { top: 0, left: 0, width, height: rect.y },
                    { top: rect.y, left: 0, width: rect.x, height: rect.height },
                    { top: rect.y, left: rect.x + rect.width, right: 0, height: rect.height },
                    { top: rect.y + rect.height, left: 0, right: 0, bottom: 0 },
                ].map((area, index) => <View key={index} pointerEvents="none" style={[styles.shade, area]} />)}
                <View pointerEvents="none" style={[styles.spotlight, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]} />
                <View style={[styles.card, {
                    width: cardWidth, left: Math.max(16, Math.min(width - cardWidth - 16, rect.x + rect.width / 2 - cardWidth / 2)),
                    top: tutorialCardTop(rect, height, insets.top, insets.bottom, cardHeight),
                    maxHeight: height - insets.top - insets.bottom - 24,
                }]} onLayout={event => setCardHeight(event.nativeEvent.layout.height)}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        <View style={styles.topRow}>
                            <Text style={styles.counter}>{active.index + 1} de {active.steps.length}</Text>
                            {active.index < active.steps.length - 1 && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Saltar la guia" disabled={busy} style={styles.skipButton} onPress={() => { void finish(); }}><Text style={styles.skipText}>Omet</Text></TouchableOpacity>}
                        </View>
                        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{step.title}</Text>
                        <Text style={styles.body}>{step.body}</Text>
                        {step.guestOnly && <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => { void finish(true); }}><Text style={styles.link}>Crear un compte gratuït</Text></TouchableOpacity>}
                        <View style={styles.actions}>
                            {active.index > 0 && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pas anterior" disabled={busy} style={styles.button} onPress={() => { setRect(null); setActive({ ...active, index: active.index - 1 }); }}><Text style={styles.link}>Enrere</Text></TouchableOpacity>}
                            <TouchableOpacity accessibilityRole="button" disabled={busy} accessibilityState={{ busy }} style={[styles.button, styles.primary]} onPress={() => {
                                if (active.index === active.steps.length - 1) void finish();
                                else { setRect(null); setActive({ ...active, index: active.index + 1 }); }
                            }}><Text style={styles.primaryText}>{busy ? 'Desant…' : active.index === active.steps.length - 1 ? active.kind === 'basic' ? 'Explorar el mapa' : 'Començar' : 'Següent'}</Text></TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>}
        </Modal>
    </Context.Provider>;
}

const styles = StyleSheet.create({
    shade: { position: 'absolute', backgroundColor: 'rgba(25,0,12,0.78)' },
    loading: { backgroundColor: 'rgba(25,0,12,0.78)', alignItems: 'center', justifyContent: 'center', gap: 16 },
    spotlight: { position: 'absolute', borderWidth: 2, borderColor: EDITORIAL.matchday, borderRadius: 12 },
    card: { position: 'absolute', backgroundColor: EDITORIAL.granaDeep, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: EDITORIAL.borderOnBackground },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, minHeight: 44 },
    counter: { color: EDITORIAL.matchday, fontFamily: EDITORIAL.fontBold, fontSize: 13 },
    skipButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
    skipText: { color: EDITORIAL.onBackgroundMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 13 },
    title: { color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: 22, lineHeight: 28, marginBottom: 10 },
    body: { color: EDITORIAL.onBackgroundMuted, fontSize: 16, lineHeight: 23, marginBottom: 16 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    button: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
    primary: { flex: 1, minHeight: 48, backgroundColor: EDITORIAL.matchday, borderRadius: 8 },
    secondary: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: EDITORIAL.borderOnBackground, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    primaryText: { color: EDITORIAL.granaDeep, fontFamily: EDITORIAL.fontBold, fontSize: 16 },
    link: { color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: 14 },
});
