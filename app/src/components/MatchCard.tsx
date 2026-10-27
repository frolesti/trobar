import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image, ImageSource } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import Text from './AppText';
import { Match } from '../models/Match';
import { EDITORIAL } from '../theme/editorialTheme';
import { formatTeamNameForDisplay } from '../utils/teamName';
import { getWomenTeamCrest } from '../data/womenTeamCrests';

type MatchCardProps = {
    match: Match;
    onPress?: () => void;
    compact?: boolean;
    grana?: boolean;
    hasBroadcast?: boolean;
    isFilter?: boolean;
    isNextMatch?: boolean;
    showDismiss?: boolean;
    onDismissFilter?: () => void;
    onToggleFilter?: () => void;
    onLongPress?: () => void;
};

const LOGOS = {
    liga: require('../../../assets/app/img/competicions/liga.png'),
    champions: require('../../../assets/app/img/competicions/champions.png'),
    championsWomen: require('../../../assets/app/img/competicions/champions-w.png'),
    copa: require('../../../assets/app/img/competicions/copa-del-rey.png'),
    copaWomen: require('../../../assets/app/img/competicions/copa-reina.png'),
    ligaWomen: require('../../../assets/app/img/competicions/ligaf.png'),
};

function competitionLogo(name: string): ImageSource | number | undefined {
    const normalized = name.toLowerCase();
    if (/uwcl|women.*champion/.test(normalized)) return LOGOS.championsWomen;
    if (normalized.includes('champion')) return LOGOS.champions;
    if (/copa.*reina|queen/.test(normalized)) return LOGOS.copaWomen;
    if (/copa|king/.test(normalized)) return LOGOS.copa;
    if (/liga f|femen/.test(normalized)) return LOGOS.ligaWomen;
    if (/primera|liga/.test(normalized)) return LOGOS.liga;
    return undefined;
}

function teamData(team: Match['homeTeam']) {
    return typeof team === 'string'
        ? { name: team, badge: undefined }
        : { name: team?.name || team?.shortName || 'Equip per confirmar', badge: team?.badge || team?.crest };
}

function phaseLabel(match: Match): string | undefined {
    const labels: Record<string, string> = {
        GROUP_STAGE: 'Fase de grups', LEAGUE_STAGE: 'Fase de lliga', LEAGUE_PHASE: 'Fase de lliga',
        LAST_32: 'Setzens de final', ROUND_OF_32: 'Setzens de final',
        LAST_16: 'Vuitens de final', ROUND_OF_16: 'Vuitens de final',
        QUARTER_FINALS: 'Quarts de final', SEMI_FINALS: 'Semifinals', FINAL: 'Final',
        PLAYOFFS: 'Play-off', PLAY_OFF_ROUND: 'Play-off', QUALIFICATION: 'Fase prèvia',
    };
    return labels[(match.stage || match.round || '').toUpperCase().replace(/[ -]/g, '_')];
}

function TeamCrest({ name, uri, localSource, size }: { name: string; uri?: string; localSource?: number; size: number }) {
    const sourceKey = localSource ?? uri;
    const [failedSource, setFailedSource] = useState<string | number | undefined>();
    const [loadedSource, setLoadedSource] = useState<string | number | undefined>();
    const hasImage = sourceKey !== undefined && failedSource !== sourceKey;
    const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('ca-ES') || '?';
    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {(!hasImage || loadedSource !== sourceKey) && (
                <View accessibilityLabel={`Equip: ${name}`} style={{ width: size, height: size, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)', backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text numberOfLines={1} style={{ color: '#FFFFFF', fontFamily: EDITORIAL.fontBold, fontSize: Math.round(size * 0.35) }}>{initials}</Text>
                </View>
            )}
            {hasImage && <Image source={localSource ?? { uri }} style={{ position: 'absolute', width: size, height: size, opacity: loadedSource === sourceKey ? 1 : 0 }} contentFit="contain" accessibilityLabel={`Escut de ${name}`} onLoad={() => setLoadedSource(sourceKey)} onError={() => setFailedSource(sourceKey)} />}
        </View>
    );
}

function MatchCard({ match, onPress, compact = false, grana = false, hasBroadcast = false, isFilter = false, showDismiss = false, onDismissFilter, onToggleFilter, onLongPress }: MatchCardProps) {
    const home = teamData(match.homeTeam);
    const away = teamData(match.awayTeam);
    const date = match.date instanceof Date ? match.date : new Date(match.date);
    const compName = match.competition?.name || String(match.league || 'Partit');
    const compLabel = /primera.*divisi/i.test(compName) ? 'La Liga' : /women.*champion/i.test(compName) ? 'UWCL' : compName;
    const compSource = competitionLogo(compName) || (match.competition?.logo ? { uri: match.competition.logo } : undefined);
    const women = match.category === 'femenino' || /women|femen|liga f|uwcl|reina/i.test(compName);
    const categoryColor = women ? EDITORIAL.feminine : EDITORIAL.masculine;
    const textColor = '#FFFFFF';
    const mutedColor = '#F3D8E3';
    const hasScore = Number.isInteger(match.homeScore) && Number.isInteger(match.awayScore);
    const pending = !hasScore && date.getTime() < Date.now() - 3 * 3600_000 && match.status !== 'postponed';
    const live = match.status === 'live';
    const timeUnknown = match.timeConfirmed === false || (match.timeConfirmed !== true && date.getUTCHours() === 0 && date.getUTCMinutes() === 0);
    const time = date.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
    const phase = phaseLabel(match);
    const status = match.status === 'postponed' ? 'Ajornat' : pending ? 'Resultat pendent' : live ? 'En directe' : match.status === 'finished' ? 'Final' : timeUnknown ? 'Horari per confirmar' : '';
    const canFind = hasBroadcast && match.status !== 'finished' && match.status !== 'postponed' && !pending && !!onPress;
    const teams = (
        <View style={[styles.teams, compact && styles.teamsCompact]}>
            <View style={styles.team}>
                <TeamCrest name={home.name} uri={home.badge} localSource={women ? getWomenTeamCrest(home.name) : undefined} size={compact ? 30 : 38} />
                <Text numberOfLines={2} style={[styles.teamName, compact && styles.teamNameCompact, { color: textColor }]}>{formatTeamNameForDisplay(home.name)}</Text>
            </View>
            <View style={styles.result}>
                <View style={styles.scoreRow}>
                    {hasScore && <Text style={[styles.score, compact && styles.scoreCompact, { color: textColor }]}>{match.homeScore}</Text>}
                    <View style={styles.logoBase}>
                        {compSource ? <Image source={compSource} style={styles.compLogo} tintColor="#FFFFFF" contentFit="contain" accessibilityLabel={compLabel} /> : <Feather name="award" size={22} color="#FFFFFF" />}
                    </View>
                    {hasScore && <Text style={[styles.score, compact && styles.scoreCompact, { color: textColor }]}>{match.awayScore}</Text>}
                </View>
                {!hasScore && !pending && !timeUnknown && match.status !== 'postponed' && <Text style={[styles.kickoff, { color: textColor }]}>{time}</Text>}
                {!!status && <Text numberOfLines={2} style={[styles.status, { color: mutedColor }, live && { color: grana ? '#A9F0C0' : EDITORIAL.success }]}>{status}</Text>}
            </View>
            <View style={styles.team}>
                <TeamCrest name={away.name} uri={away.badge} localSource={women ? getWomenTeamCrest(away.name) : undefined} size={compact ? 30 : 38} />
                <Text numberOfLines={2} style={[styles.teamName, compact && styles.teamNameCompact, { color: textColor }]}>{formatTeamNameForDisplay(away.name)}</Text>
            </View>
        </View>
    );
    const content = (
        <>
            <TouchableOpacity disabled={!compact || !onToggleFilter} onLongPress={onLongPress} delayLongPress={450} onPress={onToggleFilter} activeOpacity={0.8} accessibilityRole={compact ? 'button' : undefined} accessibilityState={compact ? { selected: isFilter } : undefined} aria-pressed={compact ? isFilter : undefined} accessibilityLabel={compact ? `${isFilter ? 'Treure' : 'Aplicar'} filtre: ${home.name} - ${away.name}` : women ? 'Barça femení' : 'Barça masculí'} style={[styles.dateBand, { backgroundColor: categoryColor }]}>
                <Text style={[styles.date, { color: '#FFFFFF' }]}>{date.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                {phase && <Text style={{ fontFamily: EDITORIAL.fontRegular, fontSize: 11, lineHeight: 15, color: mutedColor, textAlign: 'center' }}>{phase}</Text>}
            </TouchableOpacity>
            {compact && showDismiss && onDismissFilter && <View style={styles.meta}>
                <View style={styles.competition} />
                {compact && showDismiss && onDismissFilter && (
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Treure filtre de partit" style={styles.iconButton} onPress={event => { event.stopPropagation(); onDismissFilter(); }}>
                        <Feather name="x" size={18} color={textColor} />
                    </TouchableOpacity>
                )}
            </View>}
            {compact && onToggleFilter ? (
                <TouchableOpacity activeOpacity={0.8} onPress={onToggleFilter} onLongPress={onLongPress} delayLongPress={450} accessibilityRole="button" accessibilityState={{ selected: isFilter }} aria-pressed={isFilter} accessibilityLabel={`${isFilter ? 'Treure' : 'Aplicar'} filtre: ${home.name} - ${away.name}`}>
                    {teams}
                </TouchableOpacity>
            ) : teams}
            {!compact && canFind && (
                <TouchableOpacity onPress={onPress} accessibilityRole="button" style={styles.action} activeOpacity={0.75}>
                    <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Trobar bars</Text>
                </TouchableOpacity>
            )}
        </>
    );
    return compact ? (
        <View style={[styles.card, styles.compact, { backgroundColor: categoryColor, borderColor: 'rgba(255,255,255,0.24)' }, isFilter && styles.selected]}>
            {content}
        </View>
    ) : <View style={[styles.card, { backgroundColor: categoryColor, borderColor: 'rgba(255,255,255,0.24)' }]}>{content}</View>;
}

const styles = StyleSheet.create({
    card: { backgroundColor: EDITORIAL.card, borderRadius: 8, borderWidth: 1, borderColor: EDITORIAL.hairline, marginBottom: 12, overflow: 'hidden' },
    dateBand: { minHeight: 30, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: EDITORIAL.granaSoft, alignItems: 'center', justifyContent: 'center' },
    compact: { marginHorizontal: 4, marginTop: 8, marginBottom: 0 },
    selected: { borderColor: '#FFFFFF', borderWidth: 2 },
    meta: { minHeight: 32, paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
    compLogo: { width: 28, height: 32 },
    logoBase: { width: 36, height: 38, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    kickoff: { fontFamily: EDITORIAL.fontBold, fontSize: 16, lineHeight: 20, color: EDITORIAL.ink, fontVariant: ['tabular-nums'] },
    competition: { flex: 1, minWidth: 0 },
    category: { fontFamily: EDITORIAL.fontRegular, fontSize: 12, color: EDITORIAL.inkMuted, marginTop: 2 },
    date: { fontFamily: EDITORIAL.fontBold, fontSize: 12, lineHeight: 17, color: EDITORIAL.granaDeep, textAlign: 'center' },
    teams: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 2, paddingBottom: 10, gap: 6, minHeight: 96 },
    teamsCompact: { paddingTop: 0, paddingBottom: 8, minHeight: 84 },
    team: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
    teamName: { fontFamily: EDITORIAL.fontBold, fontSize: 16, lineHeight: 21, color: EDITORIAL.ink, textAlign: 'center', minHeight: 42 },
    teamNameCompact: { fontSize: 14, lineHeight: 18, minHeight: 36 },
    result: { width: 96, alignItems: 'center', justifyContent: 'center' },
    score: { fontFamily: EDITORIAL.fontBold, fontSize: 28, lineHeight: 36, color: EDITORIAL.ink, fontVariant: ['tabular-nums'] },
    scoreCompact: { fontSize: 26, lineHeight: 32 },
    status: { fontFamily: EDITORIAL.fontRegular, fontSize: 11, lineHeight: 14, color: EDITORIAL.inkMuted, textAlign: 'center', marginTop: 3 },
    action: { minHeight: 44, marginHorizontal: 12, marginBottom: 12, marginTop: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    actionText: { fontFamily: EDITORIAL.fontBold, fontSize: 14, color: EDITORIAL.grana },
    iconButton: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(MatchCard);
