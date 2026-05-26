import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { fetchAllMatches, fetchPastMatches, Match } from '../../services/matchService';
import { fetchBroadcastMatchIds } from '../../services/barService';
import { Ionicons } from '@expo/vector-icons';
import { SKETCH_THEME } from '../../theme/sketchTheme';
import { EDITORIAL } from '../../theme/editorialTheme';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getUserPreferences } from '../../services/userService';
import MatchCard from '../../components/MatchCard';
import { webScreenContainer, webScreenScroll } from '../../utils/webScreenStyles';

// Temporada futbolística: agost any N → juliol any N+1
function getSeason(d: Date): string {
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    // Agost (7) en endavant → temporada y/(y+1), abans → temporada (y-1)/y
    return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

type SeasonHeader = { type: 'season'; season: string; id: string };
type MatchItem = Match & { type?: 'match' };
type ListItem = SeasonHeader | MatchItem;

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
    const { user } = useAuth();

    // Bar owners no tenen accés a la pantalla de partits
    useEffect(() => {
        if (user?.role === 'bar_owner') {
            navigation.reset({ index: 0, routes: [{ name: 'BarDashboard' }] });
        }
    }, [user]);

    const [allMatches, setAllMatches] = useState<Match[]>([]);
    const [pastMatches, setPastMatches] = useState<Match[]>([]);
    const [visibleCount, setVisibleCount] = useState(20);
    const [filter, setFilter] = useState<FilterType>('ALL');
    const [selectedComp, setSelectedComp] = useState<string | null>(null);

    // Carregar categoria per defecte des de les preferències d'usuari
    useEffect(() => {
        if (user) {
            getUserPreferences(user.id).then(prefs => {
                if (prefs.display.defaultCategory === 'masculino') setFilter('MASCULI');
                else if (prefs.display.defaultCategory === 'femenino') setFilter('FEMENI');
                // 'all' ja és el default
            }).catch(console.error);
        }
    }, [user]);
    
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
    const isRefreshingRef = React.useRef(false);
    const [competitionMap, setCompetitionMap] = useState<Record<string, { logo: string, name: string }>>({});
    const [broadcastMatchIds, setBroadcastMatchIds] = useState<Set<string>>(new Set());
    const PAGE_SIZE = 20;

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
                    .map(m => ({ ...m, status: 'scheduled' as const }))
                    .sort((a, b) => {
                        const dA = a.date instanceof Date ? a.date : new Date(a.date);
                        const dB = b.date instanceof Date ? b.date : new Date(b.date);
                        return dA.getTime() - dB.getTime();
                    });

                setAllMatches(sortedFuture);

                // 4. Obtenir dades d'emissió — quins partits tenen almenys un bar?
                const allIds = sortedFuture.map(m => m.id);
                const bcastIds = await fetchBroadcastMatchIds(allIds);
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
        return allMatches.filter(m => {
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
    }, [allMatches, filter, isFemenino, selectedComp, competitionMap]);

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
    }, [pastMatches, filteredFutureMatches, visibleCount, filter, isFemenino, selectedComp]);

    // Llista amb separadors de temporada intercalats
    const listItems: ListItem[] = useMemo(() => {
        const items: ListItem[] = [];
        let currentSeason = '';
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
            items.push(m as MatchItem);
        }
        return items;
    }, [displayedMatches]);

    const handleRefresh = useCallback(async () => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;

        // Capturar posició de scroll ABANS de qualsevol canvi d'estat
        const savedOffset = previousScrollOffsetRef.current;
        const savedHeight = previousContentHeightRef.current;

        setIsRefreshing(true);

        try {
            // Determinar la categoria per a la consulta filtrada
            const categoryForQuery = filter === 'MASCULI' ? 'masculino' as const
                                    : filter === 'FEMENI' ? 'femenino' as const 
                                   : undefined;

            // Trobar la data més antiga dels partits carregats (de la categoria activa si hi ha filtre)
            let oldestDate = new Date();
            if (categoryForQuery) {
                const filteredPast = pastMatches.filter(m => m.category === categoryForQuery);
                if (filteredPast.length > 0) {
                    oldestDate = filteredPast[0].date;
                } else if (allMatches.length > 0) {
                    oldestDate = allMatches[0].date;
                }
            } else {
                if (pastMatches.length > 0) {
                    oldestDate = pastMatches[0].date;
                } else if (allMatches.length > 0) {
                    oldestDate = allMatches[0].date;
                }
            }
                
            const history = await fetchPastMatches(oldestDate, 5, categoryForQuery);
            const sortedHistory = history.sort((a, b) => a.date.getTime() - b.date.getTime());
            
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
                setTimeout(() => { scrollAdjustRef.current = null; }, 1500);
            }
        } finally {
            setIsRefreshing(false);
            isRefreshingRef.current = false;
        }
    }, [pastMatches, allMatches, filter]);

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
                backgroundColor: EDITORIAL.paper 
        }, webScreenContainer]}>
            {/* Capçalera */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: EDITORIAL.hairline,
                backgroundColor: EDITORIAL.paper,
            }}>
                <View style={{ width: 32 }} />

                <Text style={{
                    fontFamily: EDITORIAL.fontBold,
                    fontSize: 11,
                    letterSpacing: 2.4,
                    textTransform: 'uppercase',
                    color: EDITORIAL.grana,
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
                    <Ionicons name="arrow-forward" size={22} color={EDITORIAL.ink} />
                </TouchableOpacity>
            </View>
            <View style={{ height: 54, backgroundColor: EDITORIAL.paper, borderBottomWidth: 1, borderBottomColor: EDITORIAL.hairline }}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center', gap: 8 }}
                    style={{ flex: 1 }}
                >
                    {/* Pestanyes de categoria */}
                    {(['ALL', 'MASCULI', 'FEMENI'] as const).map((tab) => (
                         <TouchableOpacity 
                            key={tab}
                            onPress={() => {
                                setFilter(tab);
                                setSelectedComp(null);
                                setVisibleCount(PAGE_SIZE);
                                // Scroll al començament per mostrar "proper partit"
                                flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                            }} 
                            style={{
                                paddingVertical: 6,
                                paddingHorizontal: 14,
                                borderRadius: 4,
                                backgroundColor: filter === tab ? EDITORIAL.grana : '#FFFFFF',
                                borderWidth: 1,
                                borderColor: filter === tab ? EDITORIAL.grana : EDITORIAL.hairline,
                            }}
                        >
                            <Text style={{
                                color: filter === tab ? '#FFFFFF' : EDITORIAL.ink,
                                fontFamily: filter === tab ? EDITORIAL.fontBold : EDITORIAL.fontRegular,
                                fontSize: 12,
                                letterSpacing: 0.6,
                            }}>
                                {tab === 'ALL' ? 'Tots' : (tab === 'MASCULI' ? 'Masculí' : 'Femení')}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    {/* Divisor vertical */}
                    {uniqueCompetitions.length > 0 && (
                        <View style={{ width: 1, height: 22, backgroundColor: EDITORIAL.hairlineStrong }} />
                    )}

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
                                    borderRadius: 4,
                                    backgroundColor: selectedComp === c ? EDITORIAL.ink : '#FFFFFF',
                                    borderWidth: 1,
                                    borderColor: selectedComp === c ? EDITORIAL.ink : EDITORIAL.hairline,
                                }}
                            >
                                <Text style={{
                                    color: selectedComp === c ? '#FFFFFF' : EDITORIAL.ink,
                                    fontSize: 12, fontFamily: EDITORIAL.fontRegular,
                                }}>{compDisplayName}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <FlatList
                ref={flatListRef}
                data={loading ? [] : listItems}
                style={[{ flex: 1 }, webScreenScroll]}
                keyExtractor={(item) => (item as any).type === 'season' ? (item as SeasonHeader).id : (item as MatchItem).id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}
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
                        tintColor={SKETCH_THEME.colors.primary}
                        title="Carregant historial..."
                    />
                }
                onEndReached={loadMoreMatches}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={
                    loading ? (
                        <LoadingState />
                    ) : (
                        <EmptyState filter={filter} />
                    )
                }
                ListHeaderComponent={
                    !loading && displayedMatches.length > 0 ? (
                        <TouchableOpacity
                            onPress={handleRefresh}
                            disabled={isRefreshing}
                            accessibilityLabel="Carregar partits anteriors"
                            style={{
                                alignSelf: 'center',
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginTop: 4,
                                marginBottom: 10,
                                backgroundColor: '#FFFFFF',
                                borderWidth: 1,
                                borderColor: EDITORIAL.hairline,
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: isRefreshing ? 0.5 : 1,
                            }}
                        >
                            {isRefreshing ? (
                                <ActivityIndicator size="small" color={EDITORIAL.grana} />
                            ) : (
                                <Ionicons name="chevron-up" size={20} color={EDITORIAL.ink} />
                            )}
                        </TouchableOpacity>
                    ) : null
                }
                ListFooterComponent={
                    !loading && visibleCount < filteredFutureMatches.length ? (
                        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                            <ActivityIndicator size="small" color={EDITORIAL.grana} />
                            <Text style={{
                                color: EDITORIAL.inkMuted,
                                marginTop: 8,
                                fontSize: 12,
                                fontFamily: EDITORIAL.fontRegular
                            }}>
                                Carregant més partits...
                            </Text>
                        </View>
                    ) : !loading && displayedMatches.length > 0 ? (
                        <View style={{ alignItems: 'center', marginTop: 16, paddingBottom: 8 }}>
                            <Ionicons name="checkmark-circle-outline" size={22} color={EDITORIAL.inkMuted} />
                        </View>
                    ) : null
                }
                renderItem={({ item }) => {
                    if ((item as any).type === 'season') {
                        const sh = item as SeasonHeader;
                        return (
                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                marginVertical: 18, paddingHorizontal: 4,
                            }}>
                                <View style={{ flex: 1, height: 1, backgroundColor: EDITORIAL.hairline }} />
                                <View style={{
                                    paddingHorizontal: 14, paddingVertical: 4,
                                }}>
                                    <Text style={{
                                        fontSize: 10, fontFamily: EDITORIAL.fontBold,
                                        color: EDITORIAL.grana, letterSpacing: 2,
                                        textTransform: 'uppercase',
                                    }}>
                                        Temporada {sh.season}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, height: 1, backgroundColor: EDITORIAL.hairline }} />
                            </View>
                        );
                    }
                    const m = item as MatchItem;
                    return (
                        <MatchCard
                            match={m}
                            hasBroadcast={broadcastMatchIds.has(m.id)}
                            onPress={() => navigation.navigate('Map', { matchId: m.id })}
                        />
                    );
                }}
            />
        </SafeAreaView>    );
};
const LoadingState = () => (
    <View style={{ alignItems: 'center', marginTop: 60 }}>
        <LoadingIndicator size={100} />
        <Text style={{ 
            color: EDITORIAL.inkMuted, 
            marginTop: 16, 
            fontSize: 14,
            fontFamily: EDITORIAL.fontRegular
        }}>
            Carregant partits...
        </Text>
    </View>
);

const EmptyState = ({ filter }: { filter: FilterType }) => (
    <View style={{ alignItems: 'center', marginTop: 60 }}>
        <Ionicons name="calendar-outline" size={56} color={EDITORIAL.inkMuted} />
        <Text style={{ 
            color: EDITORIAL.ink, 
            marginTop: 18, 
            fontSize: 16,
            fontFamily: EDITORIAL.fontBold,
            textAlign: 'center',
        }}>
            Cap partit {filter === 'ALL' ? 'programat' : filter === 'MASCULI' ? 'masculí' : 'femení'}
        </Text>
    </View>
);


// MatchCard es va moure a components/MatchCard.tsx per a reutilització

export default MatchesScreen;
