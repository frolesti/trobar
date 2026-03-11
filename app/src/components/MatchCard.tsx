import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform, ImageSourcePropType } from 'react-native';
import { Match } from '../services/matchService';
import { SKETCH_THEME, sketchShadow } from '../theme/sketchTheme';
import { Feather, Ionicons } from '@expo/vector-icons';
import { formatTeamNameForDisplay } from '../utils/teamName';

type MatchCardProps = {
    match: Match;
    onPress?: () => void;
    compact?: boolean; // Per a ús al bàner del mapa
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

// Logos locals empaquetats des de assets/img/competicions/
const LOCAL_LOGOS: Record<string, ImageSourcePropType> = {
    'liga':         require('../../assets/img/competicions/liga.png'),
    'champions':    require('../../assets/img/competicions/champions.png'),
    'champions-w':  require('../../assets/img/competicions/champions-w.png'),
    'copa-del-rey': require('../../assets/img/competicions/copa-del-rey.png'),
    'copa-reina':   require('../../assets/img/competicions/copa-reina.png'),
    'ligaf':        require('../../assets/img/competicions/ligaf.png'),
};

/** Retorna el source local (require) pel nom de la competició */
function resolveCompLogo(match: Match): ImageSourcePropType | null {
    const name = (match.competition?.name || match.league || '').toLowerCase();

    if (name.includes('women') && name.includes('champions')) return LOCAL_LOGOS['champions-w'];
    if (name.includes('uwcl')) return LOCAL_LOGOS['champions-w'];
    if (name.includes('champions')) return LOCAL_LOGOS['champions'];
    if (name.includes('copa') && (name.includes('reina') || name.includes('queen'))) return LOCAL_LOGOS['copa-reina'];
    if (name.includes('copa') || name.includes('king')) return LOCAL_LOGOS['copa-del-rey'];
    if (name.includes('liga f') || name.includes('femen')) return LOCAL_LOGOS['ligaf'];
    if (name.includes('primera') || name.includes('la liga') || name.includes('liga')) return LOCAL_LOGOS['liga'];
    if (name.includes('supercopa')) return LOCAL_LOGOS['copa-del-rey']; // reutilitzar copa
    return null;
}

const MatchCard = ({ match, onPress, compact = false, hasBroadcast = false }: MatchCardProps) => {

    const homeTeam = getTeam(match.homeTeam);
    const awayTeam = getTeam(match.awayTeam);
    
    // Determinar la visualització de la competició
    const compName = match.competition?.name || match.league || 'Partit';
    const compLogoSource = resolveCompLogo(match);

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
                    <Text style={{ fontSize: 22, fontWeight: 'bold', fontFamily: 'Lora', color: SKETCH_THEME.colors.text }}>
                        {match.homeScore ?? '-'} - {match.awayScore ?? '-'}
                    </Text>
                 </View>
             );
        }
        
        // Programat — logo de competició entre escuts
        const logoSize = compact ? 28 : 30;
        if (compLogoSource) {
             return (
                 <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Image 
                        source={compLogoSource} 
                        style={{ width: logoSize, height: logoSize }} 
                        resizeMode="contain"
                    />
                 </View>
             )
        }
        
        return <View style={{ width: logoSize }} />;
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
        borderRadius: 14,
        padding: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: SKETCH_THEME.colors.border,
        ...Platform.select({
            web: { boxShadow: '0 3px 8px rgba(0,0,0,0.05)' },
            default: sketchShadow()
        })
    };

    const textColor = SKETCH_THEME.colors.text;
    const subTextColor = SKETCH_THEME.colors.textMuted;

    if (compact) {
        return (
            <View style={cardStyle}>
                {/* Capçalera: "Pròxim partit · Avui, 21:00" */}
                <Text style={{ 
                    fontSize: 10, fontWeight: '600',
                    color: SKETCH_THEME.colors.primary, fontFamily: 'Lora', 
                    letterSpacing: 0.3, textAlign: 'center', marginBottom: 10
                }}>
                    Proper partit  ·  {formatDate(match)}
                </Text>

                {/* Fila d'equips — compacta */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    {/* LOCAL */}
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

                    {/* VS / RESULTAT */}
                    <View style={{ marginHorizontal: 8, alignItems: 'center' }}>
                        <StatusBadge />
                    </View>

                    {/* VISITANT */}
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
            {/* Capçalera: Logo/Competició + Data */}
            <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center',
                justifyContent: 'space-between', 
                marginBottom: 10,
                paddingBottom: 6,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(0,0,0,0.05)'
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {compLogoSource && (
                        <Image source={compLogoSource} style={{ width: 16, height: 16, marginRight: 6 }} resizeMode="contain" />
                    )}
                    {match.status !== 'finished' && (
                        <Text style={{ 
                            fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', 
                            color: subTextColor, fontFamily: 'Lora', letterSpacing: 0.5 
                        }}>
                            {compName}
                        </Text>
                    )}
                </View>
                <Text style={{ fontSize: 11, color: subTextColor, fontFamily: 'Lora' }}>
                    {formatDate(match)}
                </Text>
            </View>

            {/* Fila d'equips */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                
                {/* LOCAL */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                     {homeTeam.badge ? (
                         <Image source={{ uri: homeTeam.badge }} style={{ width: 44, height: 44, marginBottom: 6 }} resizeMode="contain" />
                     ) : (
                         <Ionicons name="shield-outline" size={30} color={subTextColor} style={{ marginBottom: 6 }} />
                     )}
                     <Text numberOfLines={2} style={{ 
                         textAlign: 'center', fontWeight: 'bold', fontSize: 12, 
                         color: textColor, fontFamily: 'Lora', lineHeight: 15 
                     }}>
                         {formatTeamNameForDisplay(homeTeam.name)}
                     </Text>
                </View>

                {/* VS / RESULTAT */}
                <View style={{ marginHorizontal: 10, alignItems: 'center', minWidth: 36 }}>
                    <StatusBadge />
                </View>

                {/* VISITANT */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                     {awayTeam.badge ? (
                         <Image source={{ uri: awayTeam.badge }} style={{ width: 44, height: 44, marginBottom: 6 }} resizeMode="contain" />
                     ) : (
                         <Ionicons name="shield-outline" size={30} color={subTextColor} style={{ marginBottom: 6 }} />
                     )}
                     <Text numberOfLines={2} style={{ 
                         textAlign: 'center', fontWeight: 'bold', fontSize: 12, 
                         color: textColor, fontFamily: 'Lora', lineHeight: 15 
                     }}>
                         {formatTeamNameForDisplay(awayTeam.name)}
                     </Text>
                </View>
            </View>

            {/* Botó d'acció — només quan almenys un bar emet aquest partit */}
            {hasBroadcast && match.status !== 'finished' && onPress && (
                 <TouchableOpacity
                    style={{
                        backgroundColor: isFemenino ? '#a50044' : SKETCH_THEME.colors.primary,
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: 'center',
                        marginTop: 10
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

export default React.memo(MatchCard);
