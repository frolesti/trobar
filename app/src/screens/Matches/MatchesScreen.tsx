import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Platform, RefreshControl, ScrollView, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { fetchAllMatches, fetchPastMatches, Match } from '../../services/matchService';
import { fetchBroadcastMatchIds } from '../../services/barService';
import { Ionicons } from '@expo/vector-icons';
import { SKETCH_THEME } from '../../theme/sketchTheme';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getUserPreferences } from '../../services/userService';
import MatchCard from '../../components/MatchCard';

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

const MatchesScreen = ({ navigation }: Props) => {
    const { user } = useAuth();
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
            // Preferir el partit passat més antic
            let oldestDate = new Date();
            if (pastMatches.length > 0) {
                oldestDate = pastMatches[0].date;
            } else if (allMatches.length > 0) {
                oldestDate = allMatches[0].date;
            }
                
            const history = await fetchPastMatches(oldestDate);
            const sortedHistory = history.sort((a, b) => a.date.getTime() - b.date.getTime());
            
            if (sortedHistory.length > 0) {
                scrollAdjustRef.current = { offset: savedOffset, height: savedHeight };
                setPastMatches(prev => [...sortedHistory, ...prev]);
                // Cancel·lar ajust després d'1s (vàlvula de seguretat)
                setTimeout(() => { scrollAdjustRef.current = null; }, 1000);
            }
        } finally {
            setIsRefreshing(false);
            isRefreshingRef.current = false;
        }
    }, [pastMatches, allMatches]);

    const loadMoreMatches = useCallback(() => {
        if (isLoadingMore || visibleCount >= filteredFutureMatches.length) return;
        setIsLoadingMore(true);
        // Simplement incrementar el comptador visible
        setTimeout(() => { // Simular petit retard o simplement actualitzar l'estat
            setVisibleCount(prev => prev + PAGE_SIZE);
            setIsLoadingMore(false);
        }, 100);
    }, [isLoadingMore, visibleCount, filteredFutureMatches.length, PAGE_SIZE]);

    // Funcions auxiliars de format

    return (
        <SafeAreaView style={Platform.select({
            web: { 
                height: '100vh', 
                overflow: 'hidden', 
                display: 'flex', 
                flexDirection: 'column', 
                backgroundColor: SKETCH_THEME.colors.bg 
            } as any,
            default: { 
                flex: 1, 
                backgroundColor: SKETCH_THEME.colors.bg 
            }
        })}>
            {/* Capçalera */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: SKETCH_THEME.spacing.lg,
                paddingVertical: SKETCH_THEME.spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: SKETCH_THEME.colors.border,
                backgroundColor: SKETCH_THEME.colors.bg,
            }}>
                <View style={{ width: 32 }} />

                <Text style={{
                    ...SKETCH_THEME.typography.h3,
                    fontSize: 20,
                    color: SKETCH_THEME.colors.textInverse,
                }}>
                    Partits
                </Text>

                <TouchableOpacity
                    onPress={() => {
                        if (navigation.canGoBack()) navigation.goBack();
                        else navigation.navigate('Map');
                    }}
                    style={{ padding: SKETCH_THEME.spacing.xs }}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                >
                    <Ionicons name="arrow-forward" size={24} color={SKETCH_THEME.colors.textInverse} />
                </TouchableOpacity>
            </View>
            <View style={{ height: 50, backgroundColor: SKETCH_THEME.colors.bg }}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center' }}
                >
                    {/* Pestanyes de categoria */}
                    {(['ALL', 'MASCULI', 'FEMENI'] as const).map((tab) => (
                         <TouchableOpacity 
                            key={tab}
                            onPress={() => { setFilter(tab); setSelectedComp(null); }} 
                            style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 18,
                                backgroundColor: filter === tab ? SKETCH_THEME.colors.primary : 'rgba(255,255,255,0.12)',
                                borderWidth: 1,
                                borderColor: filter === tab ? SKETCH_THEME.colors.primary : 'rgba(255,255,255,0.2)',
                                marginRight: 8,
                            }}
                        >
                            <Text style={{
                                color: filter === tab ? '#FFF' : SKETCH_THEME.colors.mutedInverse,
                                fontWeight: filter === tab ? 'bold' : 'normal',
                                fontSize: 12,
                                fontFamily: 'Lora',
                                textTransform: 'capitalize'
                            }}>
                                {tab === 'ALL' ? 'Tots' : (tab === 'MASCULI' ? 'Masculí' : 'Femení')}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    {/* Divisor vertical */}
                    <View style={{ width: 1, height: 20, backgroundColor: SKETCH_THEME.colors.border, marginHorizontal: 8 }} />

                    {/* Pestanyes de competició */}
                    {uniqueCompetitions.map(c => (
                        <TouchableOpacity
                            key={c}
                            onPress={() => setSelectedComp(selectedComp === c ? null : c)}
                            style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 18,
                                backgroundColor: selectedComp === c ? SKETCH_THEME.colors.primary : 'rgba(255,255,255,0.12)',
                                borderWidth: 1,
                                borderColor: selectedComp === c ? SKETCH_THEME.colors.primary : 'rgba(255,255,255,0.2)',
                                marginRight: 8
                            }}
                        >
                            <Text style={{
                                color: selectedComp === c ? '#FFF' : SKETCH_THEME.colors.mutedInverse,
                                fontSize: 12, fontFamily: 'Lora'
                            }}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                ref={flatListRef}
                data={loading ? [] : listItems}
                style={Platform.select({ web: { flex: 1, minHeight: 0 } as any, default: { flex: 1 } })}
                keyExtractor={(item) => (item as any).type === 'season' ? (item as SeasonHeader).id : (item as MatchItem).id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 }}
                showsVerticalScrollIndicator={true}
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
                            if (Platform.OS === 'web') {
                                requestAnimationFrame(() => {
                                    flatListRef.current?.scrollToOffset({ offset: newOffset, animated: false });
                                });
                            } else {
                                flatListRef.current?.scrollToOffset({ offset: newOffset, animated: false });
                            }
                            previousScrollOffsetRef.current = newOffset;
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
                onEndReachedThreshold={0.6}
                ListEmptyComponent={
                    loading ? (
                        <LoadingState />
                    ) : (
                        <EmptyState filter={filter} />
                    )
                }
                ListHeaderComponent={
                    Platform.OS === 'web' ? (
                        <TouchableOpacity 
                            onPress={handleRefresh} 
                            disabled={isRefreshing}
                            activeOpacity={0.7}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingVertical: 10,
                                marginBottom: 6,
                                borderRadius: 12,
                                backgroundColor: 'transparent',
                                opacity: isRefreshing ? 0.5 : 1,
                            }}
                        >
                            {isRefreshing ? (
                                <ActivityIndicator size="small" color={SKETCH_THEME.colors.primary} />
                            ) : (
                                <>
                                    <Ionicons name="chevron-up-circle-outline" size={16} color={SKETCH_THEME.colors.mutedInverse} />
                                    <Text style={{ 
                                        marginLeft: 6, fontSize: 12, color: SKETCH_THEME.colors.mutedInverse, fontFamily: 'Lora', fontWeight: '600'
                                    }}>
                                        Carregar partits anteriors
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : null
                }
                ListFooterComponent={
                    !loading && visibleCount < filteredFutureMatches.length ? (
                        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                            <ActivityIndicator size="small" color={SKETCH_THEME.colors.gold} />
                            <Text style={{
                                color: SKETCH_THEME.colors.mutedInverse,
                                marginTop: 8,
                                fontSize: 12,
                                fontFamily: 'Lora'
                            }}>
                                Carregant més partits...
                            </Text>
                        </View>
                    ) : !loading && displayedMatches.length > 0 ? (
                        <View style={{ alignItems: 'center', marginTop: 12, paddingBottom: 8 }}>
                            <Ionicons name="checkmark-circle-outline" size={26} color={SKETCH_THEME.colors.mutedInverse} />
                            <Text style={{
                                color: SKETCH_THEME.colors.mutedInverse,
                                marginTop: 6,
                                fontSize: 12,
                                fontFamily: 'Lora',
                                fontWeight: '600',
                            }}>
                                Ja estàs al dia!
                            </Text>
                            <Text style={{
                                color: SKETCH_THEME.colors.mutedInverse,
                                marginTop: 2,
                                fontSize: 11,
                                fontFamily: 'Lora',
                                textAlign: 'center',
                                paddingHorizontal: 40,
                                opacity: 0.6,
                            }}>
                                No hi ha més partits programats
                            </Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => {
                    if ((item as any).type === 'season') {
                        const sh = item as SeasonHeader;
                        return (
                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                marginVertical: 12, paddingHorizontal: 4,
                            }}>
                                <View style={{ flex: 1, height: 1, backgroundColor: SKETCH_THEME.colors.border }} />
                                <View style={{
                                    paddingHorizontal: 14, paddingVertical: 5,
                                    backgroundColor: SKETCH_THEME.colors.uiBg,
                                    borderRadius: 12,
                                    borderWidth: 1, borderColor: SKETCH_THEME.colors.border,
                                }}>
                                    <Text style={{
                                        fontSize: 11, fontWeight: 'bold', fontFamily: 'Lora',
                                        color: SKETCH_THEME.colors.mutedInverse, letterSpacing: 0.5,
                                    }}>
                                        Temporada {sh.season}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, height: 1, backgroundColor: SKETCH_THEME.colors.border }} />
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
        <ActivityIndicator size="large" color={SKETCH_THEME.colors.gold} />
        <Text style={{ 
            color: SKETCH_THEME.colors.mutedInverse, 
            marginTop: 16, 
            fontSize: 14,
            fontFamily: 'Lora'
        }}>
            Carregant partits...
        </Text>
    </View>
);

const EmptyState = ({ filter }: { filter: FilterType }) => (
    <View style={{ alignItems: 'center', marginTop: 60 }}>
        <Ionicons name="calendar-outline" size={64} color={SKETCH_THEME.colors.mutedInverse} />
        <Text style={{ 
            color: SKETCH_THEME.colors.textInverse, 
            marginTop: 20, 
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: 'Lora'
        }}>
            No hi ha partits {filter === 'ALL' ? '' : filter === 'MASCULI' ? 'masculins' : 'femenins'} properament
        </Text>
        <Text style={{ 
            color: SKETCH_THEME.colors.mutedInverse, 
            marginTop: 8, 
            fontSize: 14,
            textAlign: 'center',
            paddingHorizontal: 40
        }}>
            Tornarem a actualitzar els horaris aviat
        </Text>
    </View>
);


// MatchCard es va moure a components/MatchCard.tsx per a reutilització

export default MatchesScreen;
