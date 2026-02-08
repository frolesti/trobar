import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Platform, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { fetchAllMatches, Match } from '../../services/matchService';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ensureLoraOnWeb, SKETCH_THEME, sketchShadow } from '../../theme/sketchTheme';
import { formatTeamNameForDisplay } from '../../utils/teamName';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Matches'>;
};

const MatchesScreen = ({ navigation }: Props) => {
    const { user } = useAuth();
    const [allMatches, setAllMatches] = useState<Match[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [competitionLogos, setCompetitionLogos] = useState<Record<string, string>>({});
    const PAGE_SIZE = 20;

    useEffect(() => {
        ensureLoraOnWeb();
        
        // Redirect to login if not authenticated
        if (!user) {
            navigation.replace('Login');
        }
        
        // Load competition logos from Firebase
        const loadCompetitionLogos = async () => {
            try {
                const logosDoc = await getDoc(doc(db, 'config', 'competition-logos'));
                if (logosDoc.exists()) {
                    setCompetitionLogos(logosDoc.data() as Record<string, string>);
                }
            } catch (error) {
                console.error('❌ Error loading competition logos:', error);
            }
        };
        
        loadCompetitionLogos();
    }, [user, navigation]);

    useEffect(() => {
        const loadMatches = async () => {
            try {
                const { matches: allMatches } = await fetchAllMatches();
                console.log('📅 Loaded matches:', allMatches);
                console.log('📅 First match details:', allMatches[0]);

                // Sort all matches by date ascending
                const sorted = allMatches
                    .slice()
                    .sort((a, b) => {
                        const dA = a.date instanceof Date ? a.date : new Date(a.date);
                        const dB = b.date instanceof Date ? b.date : new Date(b.date);
                        return dA.getTime() - dB.getTime();
                    });

                console.log('📅 Total matches:', sorted.length);
                setAllMatches(sorted);
                setMatches(sorted.slice(0, PAGE_SIZE));
            } catch (e) {
                console.error('❌ Error loading matches:', e);
            } finally {
                setLoading(false);
            }
        };
        loadMatches();
    }, []);

    const loadMoreMatches = useCallback(() => {
        if (isLoadingMore || matches.length >= allMatches.length) return;
        setIsLoadingMore(true);
        const nextCount = Math.min(matches.length + PAGE_SIZE, allMatches.length);
        setMatches(allMatches.slice(0, nextCount));
        setIsLoadingMore(false);
    }, [isLoadingMore, matches.length, allMatches, PAGE_SIZE]);

    const formatDate = (match: Match) => {
        const d = match.date instanceof Date ? match.date : new Date(match.date);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        
        if (isToday) {
            return `Avui, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}h`;
        }
        
        return d.toLocaleDateString('ca-ES', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const isFemenino = (match: Match) => {
        return match.category === 'femenino' || 
               match.homeTeam?.toLowerCase().includes('women') || 
               match.awayTeam?.toLowerCase().includes('women');
    };

    const cleanTeamName = (name: string) => {
        return name.replace(/\s*Women\s*/gi, '').trim();
    };

    const getLeagueName = (match: Match) => {
        const isFem = isFemenino(match);
        const baseName = match.league || 'La Liga';
        
        // Liga F ja ve amb el nom correcte
        if (baseName.toLowerCase().includes('liga f')) {
            return 'Liga F';
        }
        
        // Champions, Copa, etc mantenen el nom
        if (baseName.toLowerCase().includes('champions')) {
            return 'Champions League';
        }
        if (baseName.toLowerCase().includes('copa')) {
            return isFem ? 'Copa de la Reina' : 'Copa del Rey';
        }
        
        // La Liga per defecte
        return isFem ? 'Liga F' : 'La Liga EA Sports';
    };

    const getLeagueLogo = (match: Match) => {
        const isFem = isFemenino(match);
        const leagueName = getLeagueName(match);
        
        if (leagueName === 'Liga F' && competitionLogos['ligaf']) {
            return competitionLogos['ligaf'];
        }
        if (leagueName === 'La Liga EA Sports' && competitionLogos['laliga-ea-sports']) {
            return competitionLogos['laliga-ea-sports'];
        }
        return null;
    };

    const getMatchColors = (match: Match) => {
        const isFem = isFemenino(match);
        return {
            badge: isFem ? '#9C27B0' : SKETCH_THEME.colors.primary,
            button: isFem ? '#9C27B0' : SKETCH_THEME.colors.primary,
            border: isFem ? '#9C27B0' : SKETCH_THEME.colors.primary
        };
    };

    return (
        <View style={{ 
            flex: 1, 
            backgroundColor: SKETCH_THEME.colors.bg,
            ...Platform.select({ web: { height: '100vh' as any }, default: {} })
        }}>
            {/* Header - Same style as Profile */}
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
                <TouchableOpacity onPress={() => navigation.navigate('Map')} style={{ padding: 4 }}>
                    <Ionicons name="arrow-back" size={24} color={SKETCH_THEME.colors.text} />
                </TouchableOpacity>
                <Text style={{ 
                    fontSize: 20, 
                    fontWeight: 'bold', 
                    fontFamily: 'Lora', 
                    color: SKETCH_THEME.colors.text 
                }}>
                    Pròxims Partits
                </Text>
                <View style={{ width: 32 }} />
            </View>

            <FlatList
                data={loading ? [] : matches}
                keyExtractor={(item, index) => (item.id ? String(item.id) : String(index))}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={true}
                onEndReached={loadMoreMatches}
                onEndReachedThreshold={0.6}
                ListEmptyComponent={
                    loading ? (
                        <LoadingState />
                    ) : (
                        <EmptyState />
                    )
                }
                ListFooterComponent={
                    !loading && matches.length < allMatches.length ? (
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
                        formatDate={formatDate}
                        getLeagueLogo={getLeagueLogo}
                        getLeagueName={getLeagueName}
                        getMatchColors={getMatchColors}
                        cleanTeamName={cleanTeamName}
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

const EmptyState = () => (
    <View style={{ alignItems: 'center', marginTop: 60 }}>
        <Ionicons name="calendar-outline" size={64} color={SKETCH_THEME.colors.textMuted} />
        <Text style={{ 
            color: SKETCH_THEME.colors.text, 
            marginTop: 20, 
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: 'Lora'
        }}>
            No hi ha partits pròximament
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

const MatchCard = ({
    match,
    onPress,
    formatDate,
    getLeagueLogo,
    getLeagueName,
    getMatchColors,
    cleanTeamName,
}: {
    match: Match;
    onPress: () => void;
    formatDate: (m: Match) => string;
    getLeagueLogo: (m: Match) => string | null;
    getLeagueName: (m: Match) => string;
    getMatchColors: (m: Match) => { badge: string; button: string; border: string };
    cleanTeamName: (n: string) => string;
}) => (
    <View
        style={{
            backgroundColor: SKETCH_THEME.colors.uiBg,
            borderRadius: 16,
            padding: 18,
            marginBottom: 14,
            borderWidth: 2,
            borderLeftWidth: 6,
            borderColor: getMatchColors(match).border,
            ...Platform.select({
                web: { boxShadow: '2px 2px 8px rgba(0,0,0,0.08)' },
                default: sketchShadow()
            })
        }}
    >
        {/* Competition Badge */}
        <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 14 
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {getLeagueLogo(match) ? (
                    <Image 
                        source={{ uri: getLeagueLogo(match) as string }} 
                        style={{ width: 32, height: 32 }}
                        resizeMode="contain"
                    />
                ) : (
                    <View style={{
                        backgroundColor: getMatchColors(match).badge,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8
                    }}>
                        <Text style={{ 
                            fontSize: 11, 
                            fontWeight: 'bold', 
                            color: 'white',
                            textTransform: 'uppercase',
                            fontFamily: 'Lora'
                        }}>
                            {getLeagueName(match)}
                        </Text>
                    </View>
                )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="clock" size={13} color={SKETCH_THEME.colors.textMuted} style={{ marginRight: 5 }} />
                <Text style={{ 
                    fontSize: 13, 
                    color: SKETCH_THEME.colors.textMuted,
                    fontFamily: 'Lora'
                }}>
                    {formatDate(match)}
                </Text>
            </View>
        </View>

        {/* Teams */}
        <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: 16
        }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
                {match.homeBadge && (
                    <Image 
                        source={{ uri: match.homeBadge }} 
                        style={{ width: 40, height: 40, marginBottom: 8 }}
                        resizeMode="contain"
                    />
                )}
                <Text style={{ 
                    fontSize: 17, 
                    fontWeight: 'bold', 
                    textAlign: 'center', 
                    fontFamily: 'Lora',
                    color: SKETCH_THEME.colors.text
                }}>
                    {formatTeamNameForDisplay(cleanTeamName(match.homeTeam))}
                </Text>
            </View>
            <View style={{ 
                paddingHorizontal: 14,
                paddingVertical: 6,
                backgroundColor: SKETCH_THEME.colors.bg,
                borderRadius: 8
            }}>
                <Text style={{ 
                    fontSize: 15, 
                    fontWeight: 'bold', 
                    color: SKETCH_THEME.colors.textMuted,
                    fontFamily: 'Lora'
                }}>
                    VS
                </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
                {match.awayBadge && (
                    <Image 
                        source={{ uri: match.awayBadge }} 
                        style={{ width: 40, height: 40, marginBottom: 8 }}
                        resizeMode="contain"
                    />
                )}
                <Text style={{ 
                    fontSize: 17, 
                    fontWeight: 'bold', 
                    textAlign: 'center', 
                    fontFamily: 'Lora',
                    color: SKETCH_THEME.colors.text
                }}>
                    {formatTeamNameForDisplay(cleanTeamName(match.awayTeam))}
                </Text>
            </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
            style={{
                backgroundColor: getMatchColors(match).button,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                ...sketchShadow()
            }}
            onPress={onPress}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="map-pin" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={{ 
                    color: 'white', 
                    fontWeight: 'bold', 
                    fontSize: 15,
                    fontFamily: 'Lora'
                }}>
                    Trobar bars
                </Text>
            </View>
        </TouchableOpacity>
    </View>
);

export default MatchesScreen;
