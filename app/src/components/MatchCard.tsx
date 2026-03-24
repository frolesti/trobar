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
    /** Si true, es mostra com a filtre actiu (només canvia el border) */
    isFilter?: boolean;
    /** Si true, és el pròxim partit real → mostra "Proper partit" */
    isNextMatch?: boolean;
    /** Si true, mostra la X per tancar (ve de la pestanya Partits) */
    showDismiss?: boolean;
    /** Callback per tancar el filtre (X) */
    onDismissFilter?: () => void;
    /** Callback per activar/toggle filtre de bars (toc sobre targeta compacta) */
    onToggleFilter?: () => void;
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

/** Nom de competició amigable per a la UI */
function displayCompName(name: string): string {
    const l = name.toLowerCase();
    if (l.includes('primera') && l.includes('divisi')) return 'La Liga';
    if (l === 'primera division') return 'La Liga';
    if (l.includes("women's champions") || l.includes('uwcl')) return 'UWCL';
    if (l.includes('copa de la reina')) return 'Copa de la Reina';
    return name;
}

// Paleta Barça per a les targetes de partits
const BARCA = {
    blau: '#004D98',
    grana: '#A50044',
    gold: '#EDBB00',
    granaLight: 'rgba(165, 0, 68, 0.08)',
    blauLight: 'rgba(0, 77, 152, 0.06)',
    granaGradientStart: '#A50044',
    granaGradientEnd: '#7A0033',
};

const MatchCard = ({ match, onPress, compact = false, hasBroadcast = false, isFilter = false, isNextMatch = false, showDismiss = false, onDismissFilter, onToggleFilter }: MatchCardProps) => {

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
        
        // Detectar hora no confirmada (midnight UTC = 00:00:00Z)
        const isMidnightUTC = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
        const isUnconfirmedTime = isMidnightUTC && match.status !== 'finished';
        const timeStr = isUnconfirmedTime
            ? 'Hora per confirmar'
            : `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;

        if (compact) {
            if (isToday) return `Avui, ${timeStr}`;
            if (isTomorrow) return `Demà, ${timeStr}`;
            return d.toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' }) + `, ${timeStr}`;
        }

        if (isUnconfirmedTime) {
            return d.toLocaleDateString('ca-ES', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short',
            }) + ' · Hora per confirmar';
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
            const hasScore = match.homeScore !== null && match.homeScore !== undefined 
                          && match.awayScore !== null && match.awayScore !== undefined;
            if (hasScore) {
                return (
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 22, fontWeight: 'bold', fontFamily: 'Lora', color: BARCA.gold }}>
                            {match.homeScore} - {match.awayScore}
                        </Text>
                    </View>
                );
            }
            // Finalitzat sense resultat disponible — mostrar logo + badge
            const logoSize = compact ? 28 : 30;
            return (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    {compLogoSource && (
                        <Image 
                            source={compLogoSource} 
                            style={{ width: logoSize, height: logoSize, marginBottom: 4 }} 
                            resizeMode="contain"
                        />
                    )}
                    <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.3, fontFamily: 'Lora' }}>
                        FINAL
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
        backgroundColor: BARCA.grana,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginHorizontal: Platform.OS === 'web' ? 0 : 4,
        marginTop: 8,
        borderWidth: isFilter ? 2 : 1.5,
        borderColor: isFilter ? BARCA.gold : 'rgba(255,255,255,0.15)',
        ...Platform.select({
            web: { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
            default: sketchShadow()
        })
    } : {
        backgroundColor: BARCA.grana,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.15)',
        ...Platform.select({
            web: { boxShadow: '0 3px 10px rgba(0,0,0,0.18)' },
            default: sketchShadow()
        })
    };

    // Paleta Barça: text blanc sobre fons grana, or per accents
    const textColor = '#FFFFFF';
    const subTextColor = 'rgba(255,255,255,0.75)';

    if (compact) {
        return (
            <TouchableOpacity
                activeOpacity={0.75}
                onPress={onToggleFilter}
                disabled={!onToggleFilter}
                style={cardStyle}
            >
                {/* X tancar — només quan venim de la pestanya Partits */}
                {showDismiss && onDismissFilter && (
                    <TouchableOpacity
                        onPress={(e) => { e.stopPropagation?.(); onDismissFilter(); }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{
                            position: 'absolute', top: 6, right: 6, zIndex: 10,
                            width: 22, height: 22, borderRadius: 11,
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <Feather name="x" size={13} color="white" />
                    </TouchableOpacity>
                )}
                {/* Capçalera */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <Text style={{ 
                        fontSize: 10, fontWeight: '600',
                        color: BARCA.gold,
                        fontFamily: 'Lora', 
                        letterSpacing: 0.3, textAlign: 'center',
                    }}>
                        {isNextMatch && !isFilter ? `Proper partit  ·  ${formatDate(match)}` : formatDate(match)}
                    </Text>
                </View>

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
            </TouchableOpacity>
        );
    }

    return (
        <View style={cardStyle}>
            {/* Capçalera: Logo/Competició + Data */}
            <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center',
                justifyContent: 'space-between', 
                marginBottom: 14,
                paddingBottom: 8,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.15)'
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {compLogoSource && (
                        <Image source={compLogoSource} style={{ width: 16, height: 16, marginRight: 6 }} resizeMode="contain" />
                    )}
                    <Text style={{ 
                        fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', 
                        color: BARCA.gold, fontFamily: 'Lora', letterSpacing: 0.5 
                    }}>
                        {displayCompName(compName)}
                    </Text>
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
                        backgroundColor: BARCA.blau,
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: 'center',
                        marginTop: 14,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.2)',
                    }}
                    onPress={onPress}
                    activeOpacity={0.75}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="map-pin" size={16} color={BARCA.gold} style={{ marginRight: 8 }} />
                        <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14, fontFamily: 'Lora' }}>
                            Trobar bars
                        </Text>
                    </View>
                </TouchableOpacity>
            )}

        </View>
    );
};

export default React.memo(MatchCard);
