import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Platform, Image, RefreshControl, PanResponder, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { fetchAllMatches, fetchPastMatches, Match } from '../../services/matchService';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ensureLoraOnWeb, SKETCH_THEME, sketchShadow } from '../../theme/sketchTheme';
import { formatTeamNameForDisplay } from '../../utils/teamName';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import MatchCard from '../../components/MatchCard';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Matches'>;
};

type FilterType = 'ALL' | 'MASCULI' | 'FEMENI';

const MatchesScreen = ({ navigation }: Props) => {
    const { user } = useAuth();
    const [allMatches, setAllMatches] = useState<Match[]>([]);
    const [pastMatches, setPastMatches] = useState<Match[]>([]);
    // const [matches, setMatches] = useState<Match[]>([]); // Deprecated in favor of derived state
    const [visibleCount, setVisibleCount] = useState(20);
    const [filter, setFilter] = useState<FilterType>('ALL');
    const [selectedComp, setSelectedComp] = useState<string | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const isRefreshingRef = React.useRef(false);
    const [competitionMap, setCompetitionMap] = useState<Record<string, { logo: string, name: string }>>({});
    const [teamsMap, setTeamsMap] = useState<Record<string, { name: string, badge: string }>>({});
    const PAGE_SIZE = 20;

    // --- SCROLL MAINTENANCE FOR LOADING PAST MATCHES ---
    const flatListRef = useRef<FlatList>(null);
    const previousContentHeightRef = useRef<number>(0);
    const previousScrollOffsetRef = useRef<number>(0);
    const isLoadingPastMatchesRef = useRef(false);

    // PanResponder for Swipe-to-Right -> Map navigation
    // DISABLED: Can conflict with FlatList vertical scroll on some devices/patterns.
    // Re-enable only if strictly tested or requested.
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
                // 1. Load Competitions Map
                const compsSnap = await getDocs(collection(db, 'competitions'));
                const cMap: Record<string, { logo: string, name: string }> = {};

                compsSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.id) cMap[data.id] = { logo: data.logo, name: data.name };
                    // fallback using doc.id if data.id differs or consistency needed
                    cMap[doc.id] = { logo: data.logo, name: data.name };
                });
                setCompetitionMap(cMap);

                // 2. Load Teams Map
                const teamsSnap = await getDocs(collection(db, 'teams'));
                const tMap: Record<string, { name: string, badge: string }> = {};
                teamsSnap.forEach(t => {
                    const tData = t.data();
                    tMap[t.id] = { name: tData.name, badge: tData.badge };
                });
                setTeamsMap(tMap);

                // 3. Fetch Future Matches
                const { matches: fetchedMatches } = await fetchAllMatches();
                
                // Sort by date ascending (Future)
                const sortedFuture = fetchedMatches
                    .slice()
                    .map(m => ({ ...m, status: 'scheduled' as const }))
                    .sort((a, b) => {
                        const dA = a.date instanceof Date ? a.date : new Date(a.date);
                        const dB = b.date instanceof Date ? b.date : new Date(b.date);
                        return dA.getTime() - dB.getTime();
                    });

                setAllMatches(sortedFuture);
                // setMatches(sortedFuture.slice(0, PAGE_SIZE)); // Removed

            } catch (e) {
                console.error('❌ Error loading data:', e);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [user, navigation]);

    /* REMOVED SEPARATE loadMatches/loadCompetitionLogos EFFECTS TO REDUCE NETWORK CALLS */

    // --- Helper Logic ---
    const isFemenino = useCallback((match: Match | any) => {
        // Safe access to team name 
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

    // --- Derived Data ---
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
                // pass or check comp
            } else {
                const isFem = isFemenino(m);
                const matchCat = isFem ? 'FEMENI' : 'MASCULI';
                if (matchCat !== filter) return false;
            }
            
            if (selectedComp) {
                const cName = m.competition?.name || (m.league && competitionMap[m.league]?.name) || m.league;
                // Flexible match
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

    const handleRefresh = useCallback(async () => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        setIsRefreshing(true);

        try {
            // Prefer oldest past match
            let oldestDate = new Date();
            if (pastMatches.length > 0) {
                oldestDate = pastMatches[0].date;
            } else if (allMatches.length > 0) {
                oldestDate = allMatches[0].date;
            }
                
            const history = await fetchPastMatches(oldestDate);
            const sortedHistory = history.sort((a, b) => a.date.getTime() - b.date.getTime());
            
            if (sortedHistory.length > 0) {
                // MARK LOADING AND CAPTURE OFFSET
                isLoadingPastMatchesRef.current = true;
                // Capture the current scroll offset explicitly before update
                // Note: We rely on onScroll to keep this updated, but if we are at top (0), it's 0.
                if (previousScrollOffsetRef.current < 0) previousScrollOffsetRef.current = 0;
                
                console.log('[SCROLL DEBUG] Loading past matches. Current height:', previousContentHeightRef.current);
                
                setPastMatches(prev => [...sortedHistory, ...prev]);
            }
        } finally {
            setIsRefreshing(false);
            isRefreshingRef.current = false;
        }
    }, [pastMatches, allMatches]);

    const loadMoreMatches = useCallback(() => {
        if (isLoadingMore || visibleCount >= filteredFutureMatches.length) return;
        setIsLoadingMore(true);
        // Just increase visible count
        setTimeout(() => { // Simulate small delay or just state update
            setVisibleCount(prev => prev + PAGE_SIZE);
            setIsLoadingMore(false);
        }, 100);
    }, [isLoadingMore, visibleCount, filteredFutureMatches.length, PAGE_SIZE]);

    // Format Helpers
    const getTabStyle = (tab: FilterType) => ({
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: filter === tab ? SKETCH_THEME.colors.primary : 'transparent',
        borderWidth: 1,
        borderColor: filter === tab ? SKETCH_THEME.colors.primary : SKETCH_THEME.colors.border,
        marginRight: 8,
    });
    
    const getTabText = (tab: FilterType) => ({
        color: filter === tab ? '#FFF' : SKETCH_THEME.colors.textMuted,
        fontWeight: filter === tab ? 'bold' as 'bold' : 'normal' as 'normal',
        fontSize: 13,
        fontFamily: 'Lora'
    });

    return (
        <View 
            style={{ 
                flex: 1, 
                backgroundColor: SKETCH_THEME.colors.bg,
                ...Platform.select({ web: { height: '100vh' as any, display: 'flex' as any, flexDirection: 'column' as any, overflow: 'hidden' as any }, default: {} })
            }}
            // {...panResponder.panHandlers}
        >
            {/* Header - Arrow on Right */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: SKETCH_THEME.colors.border,
                backgroundColor: SKETCH_THEME.colors.uiBg,
            }}>
                <Text style={{ 
                    fontSize: 20, 
                    fontWeight: 'bold', 
                    fontFamily: 'Lora', 
                    color: SKETCH_THEME.colors.text 
                }}>
                    Pròxims Partits
                </Text>
                
                <TouchableOpacity 
                    onPress={() => navigation.navigate('Map')} 
                    style={{ padding: 4 }}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                >
                    {/* Arrow Right because "we come from there" (User Request) */}
                    <Ionicons name="arrow-forward" size={24} color={SKETCH_THEME.colors.text} />
                </TouchableOpacity>
            </View>

            {/* Unified Filters */}
            <View style={{ height: 50, backgroundColor: SKETCH_THEME.colors.bg }}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center' }}
                >
                    {/* Category Tabs */}
                    {(['ALL', 'MASCULI', 'FEMENI'] as const).map((tab) => (
                         <TouchableOpacity 
                            key={tab}
                            onPress={() => { setFilter(tab); setSelectedComp(null); }} 
                            style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 18,
                                backgroundColor: filter === tab ? SKETCH_THEME.colors.primary : SKETCH_THEME.colors.bg,
                                borderWidth: 1,
                                borderColor: filter === tab ? SKETCH_THEME.colors.primary : SKETCH_THEME.colors.border,
                                marginRight: 8,
                            }}
                        >
                            <Text style={{
                                color: filter === tab ? '#FFF' : SKETCH_THEME.colors.textMuted,
                                fontWeight: filter === tab ? 'bold' : 'normal',
                                fontSize: 12,
                                fontFamily: 'Lora',
                                textTransform: 'capitalize'
                            }}>
                                {tab === 'ALL' ? 'Tots' : (tab === 'MASCULI' ? 'Masculí' : 'Femení')}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    {/* Vertical Divider */}
                    <View style={{ width: 1, height: 20, backgroundColor: SKETCH_THEME.colors.border, marginHorizontal: 8 }} />

                    {/* Competition Tabs */}
                    {uniqueCompetitions.map(c => (
                        <TouchableOpacity
                            key={c}
                            onPress={() => setSelectedComp(selectedComp === c ? null : c)}
                            style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 18,
                                backgroundColor: selectedComp === c ? SKETCH_THEME.colors.primary : 'transparent',
                                borderWidth: 1,
                                borderColor: selectedComp === c ? SKETCH_THEME.colors.primary : SKETCH_THEME.colors.border,
                                marginRight: 8
                            }}
                        >
                            <Text style={{
                                color: selectedComp === c ? '#FFF' : SKETCH_THEME.colors.textMuted,
                                fontSize: 12, fontFamily: 'Lora'
                            }}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                ref={flatListRef}
                data={loading ? [] : displayedMatches}
                style={Platform.select({ web: { flex: 1, minHeight: 0, overflowY: 'auto' } as any, default: { flex: 1 } })}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 }}
                showsVerticalScrollIndicator={true}
                // maintainVisibleContentPosition={{
                //     minIndexForVisible: 0,
                //     autoscrollToTopThreshold: 10,
                // }}
                bounces={true}
                alwaysBounceVertical={true}
                overScrollMode="always"
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
                        <View style={{ paddingVertical: 4, alignItems: 'center' }}>
                             <TouchableOpacity 
                                onPress={handleRefresh} 
                                disabled={isRefreshing}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                {isRefreshing ? (
                                    <ActivityIndicator size="small" color={SKETCH_THEME.colors.primary} />
                                ) : (
                                    <Ionicons name="chevron-up-circle-outline" size={24} color={SKETCH_THEME.colors.textMuted} />
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : null
                }
                ListFooterComponent={
                    !loading && visibleCount < filteredFutureMatches.length ? (
                        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                            <ActivityIndicator size="small" color={SKETCH_THEME.colors.primary} />
                            <Text style={{
                                color: SKETCH_THEME.colors.textMuted,
                                marginTop: 8,
                                fontSize: 12,
                                fontFamily: 'Lora'
                            }}>
                                Carregant més partits...
                            </Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => (
                    <MatchCard
                        match={item}
                        onPress={() => navigation.navigate('Map')}
                    />
                )}
            />
      </View>
    );
};

const LoadingState = () => (
    <View style={{ alignItems: 'center', marginTop: 60 }}>
        <ActivityIndicator size="large" color={SKETCH_THEME.colors.primary} />
        <Text style={{ 
            color: SKETCH_THEME.colors.textMuted, 
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
        <Ionicons name="calendar-outline" size={64} color={SKETCH_THEME.colors.textMuted} />
        <Text style={{ 
            color: SKETCH_THEME.colors.text, 
            marginTop: 20, 
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: 'Lora'
        }}>
            No hi ha partits {filter === 'ALL' ? '' : filter === 'MASCULI' ? 'masculins' : 'femenins'} pròximament
        </Text>
        <Text style={{ 
            color: SKETCH_THEME.colors.textMuted, 
            marginTop: 8, 
            fontSize: 14,
            textAlign: 'center',
            paddingHorizontal: 40
        }}>
            Tornarem a actualitzar els horaris aviat
        </Text>
    </View>
);


// MatchCard was moved to components/MatchCard.tsx for reuse

export default MatchesScreen;
