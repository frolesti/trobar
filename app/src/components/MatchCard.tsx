import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Match } from '../services/matchService';
import { SKETCH_THEME, sketchShadow } from '../theme/sketchTheme';
import { Feather, Ionicons } from '@expo/vector-icons';
import { formatTeamNameForDisplay } from '../utils/teamName';

type MatchCardProps = {
    match: Match;
    onPress?: () => void;
    compact?: boolean; // For Map Banner usage
    /** Si true, almenys un bar emet aquest partit → mostra botó 'Trobar bars' */
    hasBroadcast?: boolean;
};

const getTeam = (key: any) => {
    if (typeof key === 'object' && key !== null) {
        return {
            name: key.name || key.shortName || 'Unknown Team',
            badge: key.crest || key.badge || null
        };
    }
    return { name: String(key), badge: null };
};

// Hardcoded logos for fail-safe
const LOGO_FALLBACKS: Record<string, string> = {
    'CL': 'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fchampions.png?alt=media&token=eafb909f-a41d-463a-81ee-c3fbbbb5a98d',
    'UWCL': 'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fchampions-w.png?alt=media&token=ff772840-f75e-4d8b-9c1e-3a42ac395237',
    'CDR': 'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fcopa-del-rey.png?alt=media&token=d66387f6-cb30-4e4f-bedd-1703d26d7171',
    'CDR_FEM': 'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fcopa-del-rey.png?alt=media&token=d66387f6-cb30-4e4f-bedd-1703d26d7171',
    'PD': 'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fliga.png?alt=media&token=d035d3f5-5ab1-405f-861b-d94009c858f0', // La Liga
    'LIGAF': 'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fligaf.png?alt=media&token=46bfc314-95d9-4a7d-862a-ef477389ebd6',
    'SCDR': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Supercopa_de_Espa%C3%B1a_logo_2020.svg/512px-Supercopa_de_Espa%C3%B1a_logo_2020.svg.png'
};

const MatchCard = ({ match, onPress, compact = false, hasBroadcast = false }: MatchCardProps) => {

    const homeTeam = getTeam(match.homeTeam);
    const awayTeam = getTeam(match.awayTeam);
    
    // Determine Competition Display
    const compName = match.competition?.name || match.league || 'Partit';
    
    // Improved Logo Logic: Check object, check fallback map, check derived ID
    let compLogo = match.competition?.logo;
    
    if (!compLogo) {
        // Try to match by ID if logo missing
        const leagueId = match.competition?.id || match.league;
        if (leagueId && LOGO_FALLBACKS[leagueId]) {
            compLogo = LOGO_FALLBACKS[leagueId];
        }
    }
    
    // Last resort: Name matching
    if (!compLogo) {
        const lower = compName.toLowerCase();
        if (lower.includes('champions')) compLogo = LOGO_FALLBACKS['CL'];
        else if (lower.includes('uwcl')) compLogo = LOGO_FALLBACKS['UWCL'];
        else if (lower.includes('copa') || lower.includes('king')) compLogo = LOGO_FALLBACKS['CDR'];
        else if (lower.includes('liga f')) compLogo = LOGO_FALLBACKS['LIGAF'];
        else if (lower.includes('liga')) compLogo = LOGO_FALLBACKS['PD'];
    }

    const isFemenino = match.category === 'FEMENI' || (compName.toLowerCase().includes('feman') || compName.toLowerCase().includes('liga f') || compName.toLowerCase().includes('uwcl'));


    const formatDate = (match: Match) => {
        // @ts-ignore
        const d = match.date instanceof Date ? match.date : (match.date && match.date.toDate ? match.date.toDate() : new Date(match.date));
        
        const now = new Date();
        const isToday = now.toDateString() === d.toDateString();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = tomorrow.toDateString() === d.toDateString();
        
        const timeStr = `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;

        if (compact) {
            if (isToday) return `Avui, ${timeStr}`;
            if (isTomorrow) return `Demà, ${timeStr}`;
            return d.toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' }) + `, ${timeStr}`;
        }

        return d.toLocaleDateString('ca-ES', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const StatusBadge = () => {
        if (match.status === 'finished') {
             return (
                 <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', fontFamily: 'Lora', color: SKETCH_THEME.colors.text }}>
                        {match.homeScore ?? '-'} - {match.awayScore ?? '-'}
                    </Text>
                 </View>
             );
        }
        
        // Scheduled
        if (compLogo) {
             const logoSize = compact ? 18 : 28;
             return (
                 <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Image 
                        source={{ uri: compLogo }} 
                        style={{ width: logoSize, height: logoSize }} 
                        resizeMode="contain"
                    />
                 </View>
             )
        }
        
        return (
            <View style={{ 
                width: 30, height: 30, borderRadius: 15, 
                backgroundColor: SKETCH_THEME.colors.primarySoft,
                justifyContent: 'center', alignItems: 'center'
            }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: SKETCH_THEME.colors.primary }}>VS</Text>
            </View>
        );
    };

    const cardStyle = compact ? {
        backgroundColor: SKETCH_THEME.colors.card,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginHorizontal: Platform.OS === 'web' ? 0 : 4,
        marginTop: 8,
        borderWidth: 1,
        borderColor: SKETCH_THEME.colors.border,
        ...Platform.select({
            web: { boxShadow: '0 2px 6px rgba(0,0,0,0.04)' },
            default: sketchShadow()
        })
    } : {
        backgroundColor: SKETCH_THEME.colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: SKETCH_THEME.colors.border,
        ...Platform.select({
            web: { boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
            default: sketchShadow()
        })
    };

    const textColor = SKETCH_THEME.colors.text;
    const subTextColor = SKETCH_THEME.colors.textMuted;

    if (compact) {
        return (
            <View style={cardStyle}>
                {/* Header: "Proper partit · Avui, 21:00" */}
                <Text style={{ 
                    fontSize: 10, fontWeight: '600',
                    color: SKETCH_THEME.colors.primary, fontFamily: 'Lora', 
                    letterSpacing: 0.3, textAlign: 'center', marginBottom: 10
                }}>
                    Proper partit  ·  {formatDate(match)}
                </Text>

                {/* Teams Row — compact */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    {/* HOME */}
                    <View style={{ alignItems: 'center', width: 70 }}>
                        {homeTeam.badge ? (
                            <Image source={{ uri: homeTeam.badge }} style={{ width: 32, height: 32, marginBottom: 4 }} resizeMode="contain" />
                        ) : (
                            <Ionicons name="shield-outline" size={24} color={subTextColor} style={{ marginBottom: 4 }} />
                        )}
                        <Text numberOfLines={1} style={{ 
                            textAlign: 'center', fontWeight: 'bold', fontSize: 11, 
                            color: textColor, fontFamily: 'Lora'
                        }}>
                            {formatTeamNameForDisplay(homeTeam.name)}
                        </Text>
                    </View>

                    {/* VS / SCORE */}
                    <View style={{ marginHorizontal: 8, alignItems: 'center' }}>
                        <StatusBadge />
                    </View>

                    {/* AWAY */}
                    <View style={{ alignItems: 'center', width: 70 }}>
                        {awayTeam.badge ? (
                            <Image source={{ uri: awayTeam.badge }} style={{ width: 32, height: 32, marginBottom: 4 }} resizeMode="contain" />
                        ) : (
                            <Ionicons name="shield-outline" size={24} color={subTextColor} style={{ marginBottom: 4 }} />
                        )}
                        <Text numberOfLines={1} style={{ 
                            textAlign: 'center', fontWeight: 'bold', fontSize: 11, 
                            color: textColor, fontFamily: 'Lora'
                        }}>
                            {formatTeamNameForDisplay(awayTeam.name)}
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={cardStyle}>
            {/* Header: Comp + Date */}
            <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                marginBottom: 16,
                paddingBottom: 8,
                borderBottomWidth: 1,
                borderBottomColor: SKETCH_THEME.colors.bg
            }}>
                <Text style={{ 
                    fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', 
                    color: subTextColor, fontFamily: 'Lora', letterSpacing: 0.5 
                }}>
                    {compName}
                </Text>
                <Text style={{ fontSize: 11, color: subTextColor, fontFamily: 'Lora' }}>
                    {formatDate(match)}
                </Text>
            </View>

            {/* Teams Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                
                {/* HOME */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                     {homeTeam.badge ? (
                         <Image source={{ uri: homeTeam.badge }} style={{ width: 48, height: 48, marginBottom: 8 }} resizeMode="contain" />
                     ) : (
                         <Ionicons name="shield-outline" size={32} color={subTextColor} style={{ marginBottom: 8 }} />
                     )}
                     <Text numberOfLines={2} style={{ 
                         textAlign: 'center', fontWeight: 'bold', fontSize: 13, 
                         color: textColor, fontFamily: 'Lora', lineHeight: 16 
                     }}>
                         {formatTeamNameForDisplay(homeTeam.name)}
                     </Text>
                </View>

                {/* VS / SCORE */}
                <View style={{ marginHorizontal: 12, alignItems: 'center', minWidth: 40 }}>
                    <StatusBadge />
                </View>

                {/* AWAY */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                     {awayTeam.badge ? (
                         <Image source={{ uri: awayTeam.badge }} style={{ width: 48, height: 48, marginBottom: 8 }} resizeMode="contain" />
                     ) : (
                         <Ionicons name="shield-outline" size={32} color={subTextColor} style={{ marginBottom: 8 }} />
                     )}
                     <Text numberOfLines={2} style={{ 
                         textAlign: 'center', fontWeight: 'bold', fontSize: 13, 
                         color: textColor, fontFamily: 'Lora', lineHeight: 16 
                     }}>
                         {formatTeamNameForDisplay(awayTeam.name)}
                     </Text>
                </View>
            </View>

            {/* Action Button — only when at least one bar broadcasts this match */}
            {hasBroadcast && match.status !== 'finished' && onPress && (
                 <TouchableOpacity
                    style={{
                        backgroundColor: isFemenino ? '#9C27B0' : SKETCH_THEME.colors.primary,
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: 'center',
                        marginTop: 16
                    }}
                    onPress={onPress}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="map-pin" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14, fontFamily: 'Lora' }}>
                            Trobar bars
                        </Text>
                    </View>
                </TouchableOpacity>
            )}

        </View>
    );
};

export default MatchCard;
