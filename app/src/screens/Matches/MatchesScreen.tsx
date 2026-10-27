import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import Text from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { fetchAllMatches, fetchPastMatches, fetchCompetitionMatches, subscribeToMatchUpdates, Match } from '../../services/matchService';
import { showAlert } from '../../components/AlertBanner';
import { fetchBroadcastMatchIds } from '../../services/barService';
import AppIcon from '../../components/AppIcon';
import { EDITORIAL } from '../../theme/editorialTheme';
import { useAuth } from '../../context/AuthContext';
import { useScreenLoading } from '../../context/SplashContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getUserPreferences } from '../../services/userService';
import MatchCard from '../../components/MatchCard';
import { webScreenContainer, webScreenScroll } from '../../utils/webScreenStyles';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { nextBroadcastMatchId } from '../../utils/matchBroadcast';
import { previousMatchPage } from '../../utils/matchHistory';

const MATCHES_COLORS = {
    page: EDITORIAL.granaDeep,
    header: EDITORIAL.granaDeep,
    text: '#FFFFFF',
    muted: '#F0CDD9',
    line: 'rgba(255,255,255,0.24)',
};

// Temporada futbolística: agost any N → juliol any N+1
function getSeason(d: Date): string {
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    // Agost (7) en endavant → temporada y/(y+1), abans → temporada (y-1)/y
    return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

type SeasonHeader = { type: 'season'; season: string; id: string };
type MonthHeader = { type: 'month'; label: string; id: string };
type MatchItem = Match & { type?: 'match' };
type ListItem = SeasonHeader | MonthHeader | MatchItem;

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Matches'>;
};

type FilterType = 'ALL' | 'MASCULI' | 'FEMENI';

/** Nom de competició amigable per a la UI */
function displayCompName(name: string): string {
    const l = name.toLowerCase();
    if (l.includes('primera') && l.includes('divisi')) return 'La Liga';
    if (l === 'primera division') return 'La Liga';
    if (l.includes("women's champions") || l.includes('uwcl')) return 'UWCL';
    if (l.includes('copa de la reina')) return 'Copa de la Reina';
    return name;
}

const MatchesScreen = ({ navigation }: Props) => {
    const isFocused = useIsFocused();
    const { user } = useAuth();

    // Bar owners no tenen accés a la pantalla de partits
    useEffect(() => {
        if (user?.role === 'bar_owner') {
            navigation.reset({ index: 0, routes: [{ name: 'BarDashboard' }] });
        }
    }, [user]);

    const [allMatches, setAllMatches] = useState<Match[]>([]);
    const [pastMatches, setPastMatches] = useState<Match[]>([]);
    const subscribedMatchIds = [...allMatches, ...pastMatches].map(match => match.id).sort().join(',');

    useEffect(() => subscribeToMatchUpdates(subscribedMatchIds ? subscribedMatchIds.split(',') : [], updates => {
        const byId = new Map(updates.map(match => [match.id, match]));
        setAllMatches(previous => previous.map(match => byId.get(match.id) || match));
        setPastMatches(previous => previous.map(match => byId.get(match.id) || match));
    }), [subscribedMatchIds]);
    const [visibleCount, setVisibleCount] = useState(20);
    const [filter, setFilter] = useState<FilterType>('ALL');
    const [selectedComp, setSelectedComp] = useState<string | null>(null);
    const categorySelection = useRef(0);

    // Carregar categoria per defecte des de les preferències d'usuari
    useEffect(() => {
        if (!isFocused) return;
        let active = true;
        const selection = categorySelection.current;
        if (!user) {
            setFilter('ALL');
            setSelectedComp(null);
            return;
        }
        getUserPreferences(user.id).then(prefs => {
            if (!active || selection !== categorySelection.current) return;
            setFilter(prefs.display.defaultCategory === 'masculino' ? 'MASCULI' : prefs.display.defaultCategory === 'femenino' ? 'FEMENI' : 'ALL');
            setSelectedComp(null);
        }).catch(console.error);
        return () => { active = false; };
    }, [user?.id, isFocused]);
    
    // Animació personalitzada: Quan naveguem al Mapa, estàndard. Quan apareix... per defecte llisca des de la dreta.
    // Si volem 'Lliscar des de l'esquerra', hauríem d'ajustar opcions de navegació o assumir que aquesta pantalla és a l'esquerra.
    // React Navigation Stack tracta les pantalles linealment. Per aconseguir 'lliscar esquerra', normalment fem pop().
    // Però aquesta és la pantalla inicial.
    // El problema de l'usuari: "Quan accedim al component de scroll, llisquem a l'esquerra PERÒ l'animació ve de la dreta".
    // Sembla que naveguen *cap a* MatchesScreen i la veuen entrar des de la dreta.
    // Volen que entri des de l'esquerra?
    // Configurar gestureDirection: 'horizontal-inverted' a les opcions de pantalla podria ajudar.
    
    const [loading, setLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Splash global: mantenim grana mentre carreguem la llista inicial de partits.
    useScreenLoading('MatchesScreen', loading);
    const isRefreshingRef = React.useRef(false);
    const [competitionMap, setCompetitionMap] = useState<Record<string, { logo: string, name: string }>>({});
    const [broadcastMatchIds, setBroadcastMatchIds] = useState<Set<string>>(new Set());
    const PAGE_SIZE = 20;
    const [competitionLoading, setCompetitionLoading] = useState(false);
    const [competitionMatches, setCompetitionMatches] = useState<Match[]>([]);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const scopeKey = `${filter}|${selectedComp || ''}`;
    const scopeRef = useRef(scopeKey);
    scopeRef.current = scopeKey;

    useEffect(() => {
        setPastMatches([]);
        setVisibleCount(PAGE_SIZE);
        setHasMoreHistory(true);
        setIsRefreshing(false);
        isRefreshingRef.current = false;
        scrollAdjustRef.current = null;
        previousScrollOffsetRef.current = 0;
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [scopeKey]);

    useEffect(() => {
        if (!selectedComp) {
            setCompetitionLoading(false);
            return;
        }
        let active = true;
        setCompetitionMatches([]);
        setCompetitionLoading(true);
        const ids = Object.entries(competitionMap).filter(([, competition]) => competition.name === selectedComp).map(([id]) => id);
        fetchCompetitionMatches(ids).then(matches => {
            if (!active) return;
            setCompetitionMatches(matches);
            setVisibleCount(PAGE_SIZE);
        }).catch(() => {
            if (active) showAlert({ tone: 'error', message: 'No hem pogut carregar els partits de la competició. Torna-ho a provar.' });
        }).finally(() => { if (active) setCompetitionLoading(false); });
        return () => { active = false; };
    }, [selectedComp, competitionMap]);

    // --- MANTENIMENT DE SCROLL PER A CÀRREGA DE PARTITS PASSATS ---
    const flatListRef = useRef<FlatList>(null);
    const previousContentHeightRef = useRef<number>(0);
    const previousScrollOffsetRef = useRef<number>(0);
    const scrollAdjustRef = useRef<{ offset: number; height: number } | null>(null);
    const pendingPastMatchesRef = useRef<Match[]>([]);
    const [insertReady, setInsertReady] = useState(false);

    // PanResponder per a lliscar a la dreta -> navegació al Mapa
    // DESACTIVAT: Pot generar conflictes amb el scroll vertical de FlatList en alguns dispositius.
    // Reactivar només si s'ha provat estrictament o es demana.
    /*
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dx > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 3;
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx > 60) navigation.navigate('Map');
            }
        })
    ).current;
    */

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // 1. Carregar mapa de competicions
                const compsSnap = await getDocs(collection(db, 'competitions'));
                const cMap: Record<string, { logo: string, name: string }> = {};

                compsSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.id) cMap[data.id] = { logo: data.logo, name: data.name };
                    // alternativa usant doc.id si data.id difereix o per consistència
                    cMap[doc.id] = { logo: data.logo, name: data.name };
                });
                setCompetitionMap(cMap);

                // 2. Obtenir partits futurs
                const { matches: fetchedMatches } = await fetchAllMatches();
                
                // Ordenar per data ascendent (futurs)
                const sortedFuture = fetchedMatches
                    .slice()
                    .sort((a, b) => {
                        const dA = a.date instanceof Date ? a.date : new Date(a.date);
                        const dB = b.date instanceof Date ? b.date : new Date(b.date);
                        return dA.getTime() - dB.getTime();
                    });

                setAllMatches(sortedFuture);

                // 4. Obtenir dades d'emissió — quins partits tenen almenys un bar?
                const allIds = sortedFuture.map(m => m.id);
                const bcastIds = await fetchBroadcastMatchIds(allIds, nextBroadcastMatchId(sortedFuture));
                setBroadcastMatchIds(bcastIds);

            } catch (e) {
                console.error('❌ Error loading data:', e);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [user, navigation]);

    /* ELIMINATS loadMatches/loadCompetitionLogos SEPARATS PER REDUIR CRIDES DE XARXA */

    // --- Lògica auxiliar ---
    const isFemenino = useCallback((match: Match | any) => {
        // Accés segur al nom de l'equip 
        const getTeamName = (t: any) => (typeof t === 'string' ? t : (t?.name || t?.shortName || ''));
        const homeName = getTeamName(match.homeTeam).toLowerCase();
        const awayName = getTeamName(match.awayTeam).toLowerCase();
        const leagueName = (match.league || '').toLowerCase();

        return match.category === 'femenino' || 
               homeName.includes('women') || 
               awayName.includes('women') ||
               homeName.includes('femeni') || 
               awayName.includes('femeni') ||
               leagueName.includes('liga f') ||
               leagueName.includes('femen');
    }, []);

    // --- Dades derivades ---
    const uniqueCompetitions = useMemo(() => {
         const comps = new Set<string>();
         Object.values(competitionMap).forEach(competition => {
             const women = /women|femen|liga f|reina|uwcl/i.test(competition.name);
             if (filter === 'ALL' || (filter === 'FEMENI') === women) comps.add(competition.name);
         });
         const matches = [...pastMatches, ...allMatches];
         matches.forEach(m => {
             const isFem = isFemenino(m);
             const matchCat = isFem ? 'FEMENI' : 'MASCULI';
             
             if (filter !== 'ALL' && matchCat !== filter) return;

             if (m.competition && m.competition.name) comps.add(m.competition.name);
             else if (m.league && competitionMap[m.league]) comps.add(competitionMap[m.league].name);
             else if (m.league) comps.add(m.league);
         });
         return Array.from(comps).sort();
    }, [pastMatches, allMatches, filter, isFemenino, competitionMap]);

    const filteredFutureMatches = useMemo(() => {
        return (selectedComp ? competitionMatches : allMatches).filter(m => {
            if (m.date.getTime() < Date.now() - 2 * 3600_000) return false;
            if (filter === 'ALL') {
                // passar o comprovar competició
            } else {
                const isFem = isFemenino(m);
                const matchCat = isFem ? 'FEMENI' : 'MASCULI';
                if (matchCat !== filter) return false;
            }
            
            if (selectedComp) {
                const cName = m.competition?.name || (m.league && competitionMap[m.league]?.name) || m.league;
                // Coincidència flexible
                if (cName !== selectedComp && m.competition?.id !== selectedComp && m.league !== selectedComp) return false;
            }
            return true;
        });
    }, [allMatches, competitionMatches, filter, isFemenino, selectedComp, competitionMap]);

    const displayedMatches = useMemo(() => {
        const filteredPast = pastMatches.filter(m => {
            if (filter !== 'ALL') {
                const isFem = isFemenino(m);
                const matchCat = isFem ? 'FEMENI' : 'MASCULI';
                if (matchCat !== filter) return false;
            }

            if (selectedComp) {
                const cName = m.competition?.name || (m.league && competitionMap[m.league]?.name) || m.league;
                if (cName !== selectedComp && m.competition?.id !== selectedComp && m.league !== selectedComp) return false;
            }
            return true;
        });

        const futureSlice = filteredFutureMatches.slice(0, visibleCount);

        return [...filteredPast, ...futureSlice];
    }, [pastMatches, filteredFutureMatches, visibleCount, filter, isFemenino, selectedComp, competitionMap]);

    // Llista amb separadors de temporada intercalats
    const listItems: ListItem[] = useMemo(() => {
        const items: ListItem[] = [];
        let currentSeason = '';
        let currentMonth = '';
        for (const m of displayedMatches) {
            const d = m.date instanceof Date ? m.date : new Date(m.date);
            const s = getSeason(d);
            if (s !== currentSeason) {
                // Inserir capçalera de temporada només si ja hi havia una temporada anterior
                if (currentSeason !== '') {
                    items.push({ type: 'season', season: s, id: `season-${s}` });
                }
                currentSeason = s;
            }
            const month = `${d.getFullYear()}-${d.getMonth() + 1}`;
            if (month !== currentMonth) {
                items.push({ type: 'month', label: d.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' }), id: `month-${month}` });
                currentMonth = month;
            }
            items.push(m as MatchItem);
        }
        return items;
    }, [displayedMatches]);

    const handleRefresh = useCallback(async () => {
        if (isRefreshingRef.current || competitionLoading || !hasMoreHistory) return;
        isRefreshingRef.current = true;
        const requestedScope = scopeKey;

        // Capturar posició de scroll ABANS de qualsevol canvi d'estat
        const savedOffset = previousScrollOffsetRef.current;
        const savedHeight = previousContentHeightRef.current;

        setIsRefreshing(true);

        try {
            // Determinar la categoria per a la consulta filtrada
            const categoryForQuery = filter === 'MASCULI' ? 'masculino' as const
                                    : filter === 'FEMENI' ? 'femenino' as const 
                                   : undefined;

            const oldestDate = pastMatches.length > 0 ? pastMatches[0].date : new Date(Date.now() - 2 * 3600_000);
            const history = selectedComp
                ? previousMatchPage(competitionMatches.filter(match => !categoryForQuery || isFemenino(match) === (categoryForQuery === 'femenino')), oldestDate, 10)
                : await fetchPastMatches(oldestDate, 10, categoryForQuery);
            if (scopeRef.current !== requestedScope) return;
            const sortedHistory = history.sort((a, b) => a.date.getTime() - b.date.getTime());
            setHasMoreHistory(history.length === 10);
            
            if (sortedHistory.length > 0) {
                // Guardar referència per ajust de scroll sense parpelleig
                scrollAdjustRef.current = { offset: savedOffset, height: savedHeight };
                setPastMatches(prev => {
                    // Deduplicar per id
                    const existingIds = new Set(prev.map(m => m.id));
                    const newMatches = sortedHistory.filter(m => !existingIds.has(m.id));
                    return [...newMatches, ...prev];
                });
                // Cancel·lar ajust després d'1.5s (vàlvula de seguretat)
                setTimeout(() => { if (scopeRef.current === requestedScope) scrollAdjustRef.current = null; }, 1500);
            }
        } catch {
            if (scopeRef.current === requestedScope) showAlert({ tone: 'error', message: "No hem pogut carregar els partits anteriors. Torna-ho a provar." });
        } finally {
            if (scopeRef.current === requestedScope) {
                setIsRefreshing(false);
                isRefreshingRef.current = false;
            }
        }
    }, [pastMatches, filter, selectedComp, competitionMatches, competitionLoading, hasMoreHistory, scopeKey, isFemenino]);

    const loadMoreMatches = useCallback(() => {
        if (isLoadingMore || visibleCount >= filteredFutureMatches.length) return;
        setIsLoadingMore(true);
        // Mostrar spinner breument, després revelar nous partits sense salt
        setTimeout(() => {
            setVisibleCount(prev => prev + PAGE_SIZE);
            // Petit retard addicional per evitar flash del spinner
            requestAnimationFrame(() => setIsLoadingMore(false));
        }, 300);
    }, [isLoadingMore, visibleCount, filteredFutureMatches.length, PAGE_SIZE]);

    // Funcions auxiliars de format

    return (
        <SafeAreaView style={[{ 
                flex: 1, 
                backgroundColor: MATCHES_COLORS.page
        }, webScreenContainer]}>
            {isFocused && <StatusBar style="light" />}
            {/* Capçalera */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 24,
                paddingVertical: 16,
                backgroundColor: MATCHES_COLORS.header,
            }}>
                <View style={{ width: 32 }} />

                <Text style={{
                    fontFamily: EDITORIAL.fontBold,
                    fontSize: 18,
                    letterSpacing: 0,
                    color: MATCHES_COLORS.text,
                }}>
                    Partits
                </Text>

                <TouchableOpacity
                    onPress={() => {
                        if (navigation.canGoBack()) navigation.goBack();
                        else navigation.navigate('Map');
                    }}
                    style={{ padding: 6 }}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                >
                    <AppIcon name="arrow-forward" size={22} color={MATCHES_COLORS.text} />
                </TouchableOpacity>
            </View>
            <View style={{ height: 54, backgroundColor: MATCHES_COLORS.header }}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', gap: 8 }}
                    style={{ flex: 1 }}
                >
                    {/* Pestanyes de categoria */}
                    {(['MASCULI', 'FEMENI'] as const).map((tab) => (
                         <TouchableOpacity 
                            key={tab}
                            accessibilityRole="button"
                            accessibilityState={{ selected: filter === tab }}
                            aria-pressed={filter === tab}
                            onPress={() => {
                                categorySelection.current += 1;
                                setFilter(current => current === tab ? 'ALL' : tab);
                                setSelectedComp(null);
                                setVisibleCount(PAGE_SIZE);
                                // Scroll al començament per mostrar "proper partit"
                                flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                            }} 
                            style={{
                                paddingVertical: 6,
                                paddingHorizontal: 14,
                                borderRadius: 8,
                                backgroundColor: tab === 'MASCULI' ? EDITORIAL.masculine : EDITORIAL.feminine,
                                borderWidth: 1,
                                borderColor: filter === tab ? MATCHES_COLORS.text : MATCHES_COLORS.line,
                                flexDirection: 'row', alignItems: 'center', gap: 6,
                            }}
                        >
                            <Text style={{
                                color: MATCHES_COLORS.text,
                                fontFamily: filter === tab ? EDITORIAL.fontBold : EDITORIAL.fontRegular,
                                fontSize: 12,
                                letterSpacing: 0,
                            }}>
                                {tab === 'MASCULI' ? 'Masculí' : 'Femení'}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    {/* Pestanyes de competició */}
                    {uniqueCompetitions.map(c => {
                        const compDisplayName = displayCompName(c);
                        return (
                            <TouchableOpacity
                                key={c}
                                onPress={() => setSelectedComp(selectedComp === c ? null : c)}
                                style={{
                                    paddingVertical: 6,
                                    paddingHorizontal: 14,
                                    borderRadius: 8,
                                    backgroundColor: selectedComp === c ? MATCHES_COLORS.text : 'transparent',
                                    borderWidth: 1,
                                    borderColor: selectedComp === c ? MATCHES_COLORS.text : MATCHES_COLORS.line,
                                }}
                            >
                                <Text style={{
                                    color: selectedComp === c ? EDITORIAL.granaDeep : MATCHES_COLORS.text,
                                    fontSize: 12, fontFamily: EDITORIAL.fontRegular,
                                }}>{compDisplayName}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <FlatList
                key={scopeKey}
                ref={flatListRef}
                data={loading ? [] : listItems}
                style={[{ flex: 1 }, webScreenScroll]}
                keyExtractor={(item) => (item as any).type === 'season' ? (item as SeasonHeader).id : (item as MatchItem).id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                bounces={true}
                alwaysBounceVertical={true}
                overScrollMode="always"
                onScroll={(e) => {
                    previousScrollOffsetRef.current = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                onContentSizeChange={(_w, h) => {
                    if (scrollAdjustRef.current) {
                        const { offset, height } = scrollAdjustRef.current;
                        const delta = h - height;
                        if (delta > 0) {
                            const newOffset = offset + delta;
                            // Ajust immediat i sincronitzat per evitar salt visual
                            flatListRef.current?.scrollToOffset({ offset: newOffset, animated: false });
                            previousScrollOffsetRef.current = newOffset;
                            scrollAdjustRef.current = null; // Aplicat — no repetir
                        }
                    }
                    previousContentHeightRef.current = h;
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={MATCHES_COLORS.text}
                        titleColor={MATCHES_COLORS.muted}
                        title="Carregant historial..."
                    />
                }
                onEndReached={loadMoreMatches}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={
                    loading ? undefined : competitionLoading ? <ActivityIndicator color={MATCHES_COLORS.text} style={{ marginTop: 32 }} /> : <EmptyState />
                }
                ListHeaderComponentStyle={{ minHeight: 54, flexShrink: 0 }}
                ListHeaderComponent={
                    !loading && hasMoreHistory ? (
                        <TouchableOpacity
                            onPress={handleRefresh}
                            disabled={isRefreshing || competitionLoading}
                            accessibilityLabel="Carregar 10 partits anteriors"
                            style={{
                                alignSelf: 'center',
                                width: 44,
                                height: 44,
                                flexShrink: 0,
                                marginTop: 4,
                                marginBottom: 10,
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: isRefreshing ? 0.5 : 1,
                            }}
                        >
                            {isRefreshing ? (
                                <ActivityIndicator size="small" color={MATCHES_COLORS.text} />
                            ) : (
                                <AppIcon name="chevron-up" size={24} color={MATCHES_COLORS.text} />
                            )}
                        </TouchableOpacity>
                    ) : undefined
                }
                ListFooterComponent={
                    !loading && visibleCount < filteredFutureMatches.length ? (
                        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                            <ActivityIndicator size="small" color={MATCHES_COLORS.text} />
                            <Text style={{
                                color: MATCHES_COLORS.muted,
                                marginTop: 8,
                                fontSize: 12,
                                fontFamily: EDITORIAL.fontRegular
                            }}>
                                Carregant més partits...
                            </Text>
                        </View>
                    ) : !loading && displayedMatches.length > 0 ? (
                        <View style={{ alignItems: 'center', marginTop: 16, paddingBottom: 8 }}>
                            <AppIcon name="checkmark-circle-outline" size={22} color={EDITORIAL.inkMuted} />
                        </View>
                    ) : undefined
                }
                renderItem={({ item }) => {
                    if (item.type === 'month') {
                        return (
                            <View style={{ paddingTop: 12, paddingBottom: 12 }}>
                                <Text accessibilityRole="header" style={{ fontSize: 15, fontFamily: EDITORIAL.fontBold, color: MATCHES_COLORS.text }}>{item.label.charAt(0).toLocaleUpperCase('ca-ES') + item.label.slice(1)}</Text>
                            </View>
                        );
                    }
                    if ((item as any).type === 'season') {
                        const sh = item as SeasonHeader;
                        return (
                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                marginVertical: 18, paddingHorizontal: 4,
                            }}>
                                <View style={{
                                    paddingVertical: 4,
                                }}>
                                    <Text style={{
                                        fontSize: 12, fontFamily: EDITORIAL.fontBold,
                                        color: MATCHES_COLORS.text, letterSpacing: 0,
                                    }}>
                                        Temporada {sh.season}
                                    </Text>
                                </View>
                            </View>
                        );
                    }
                    const m = item as MatchItem;
                    return (
                        <MatchCard
                            match={m}
                            grana
                            hasBroadcast={broadcastMatchIds.has(m.id)}
                            onPress={() => navigation.navigate('Map', { matchId: m.id })}
                        />
                    );
                }}
            />
        </SafeAreaView>    );
};


const EmptyState = () => (
    <View style={{ alignItems: 'center', paddingTop: 32, paddingHorizontal: 16 }}>
        <Text style={{ 
            color: MATCHES_COLORS.text,
            fontSize: 16,
            fontFamily: EDITORIAL.fontBold,
            textAlign: 'center',
        }}>
            Encara no hi ha partits programats
        </Text>
    </View>
);


// MatchCard es va moure a components/MatchCard.tsx per a reutilització

export default MatchesScreen;
