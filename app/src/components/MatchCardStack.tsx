import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, StyleSheet, View } from 'react-native';
import Text from './AppText';
import MatchCard from './MatchCard';
import { Match } from '../models/Match';
import { EDITORIAL } from '../theme/editorialTheme';
import { formatTeamNameForDisplay } from '../utils/teamName';

type Props = {
    match: Match;
    alternativeMatch: Match | null;
    isFilter: boolean;
    showDismiss: boolean;
    onSwitchMatch: () => void;
    onToggleFilter: () => void;
    onDismissFilter: () => void;
};

export default function MatchCardStack({ match, alternativeMatch, onSwitchMatch, ...props }: Props) {
    const offset = useRef(new Animated.Value(0)).current;
    const width = useRef(320);
    const transitioning = useRef(false);
    const suppressTap = useRef(false);
    const pressStartedAt = useRef(0);
    const [reduceMotion, setReduceMotion] = useState(true);
    const latest = useRef({ alternativeMatch, onSwitchMatch, reduceMotion });
    latest.current = { alternativeMatch, onSwitchMatch, reduceMotion };

    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
            if (active) setReduceMotion(enabled);
        }).catch(error => console.warn('[MatchCardStack] No es pot consultar el moviment reduït', error));
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => { active = false; subscription.remove(); };
    }, []);

    useEffect(() => {
        offset.stopAnimation();
        offset.setValue(0);
        transitioning.current = false;
        suppressTap.current = false;
    }, [match.id, reduceMotion, offset]);

    const switchMatch = useRef((towards: number) => {
        if (!latest.current.alternativeMatch || transitioning.current) return;
        if (latest.current.reduceMotion) { offset.setValue(0); latest.current.onSwitchMatch(); return; }
        transitioning.current = true;
        Animated.timing(offset, { toValue: towards * width.current, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
            if (finished) latest.current.onSwitchMatch();
            else transitioning.current = false;
        });
    }).current;
    const swipe = useMemo(() => {
        const reset = () => Animated.timing(offset, {
            toValue: 0,
            duration: latest.current.reduceMotion ? 0 : 160,
            useNativeDriver: Platform.OS !== 'web',
        }).start();
        return PanResponder.create({
            onStartShouldSetPanResponderCapture: () => {
                pressStartedAt.current = Date.now();
                suppressTap.current = false;
                return false;
            },
            onMoveShouldSetPanResponderCapture: (_, gesture) => {
                if (Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8) suppressTap.current = true;
                return !!latest.current.alternativeMatch && !transitioning.current &&
                    gesture.numberActiveTouches === 1 && Date.now() - pressStartedAt.current >= 250 &&
                    Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy);
            },
            onPanResponderGrant: () => {
                suppressTap.current = true;
                offset.stopAnimation();
            },
            onPanResponderMove: (_, gesture) => {
                offset.setValue(Math.max(-width.current, Math.min(width.current, gesture.dx)));
            },
            onPanResponderRelease: (_, gesture) => {
                if (Math.abs(gesture.dx) > 48 || (Math.abs(gesture.dx) > 12 && Math.abs(gesture.vx) > 0.5)) {
                    switchMatch(gesture.dx < 0 ? -1 : 1);
                } else reset();
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderTerminate: reset,
        });
    }, [offset, switchMatch]);

    const teamName = (team: Match['homeTeam']) => formatTeamNameForDisplay(typeof team === 'string' ? team : team.name || team.shortName || 'Equip per confirmar');
    const alternativeWomen = alternativeMatch?.category === 'femenino' || /women|femen|liga f|uwcl|reina/i.test(alternativeMatch?.competition?.name || '');

    return (
        <View {...swipe.panHandlers} style={styles.deck} onLayout={event => { width.current = event.nativeEvent.layout.width; }}>
            {alternativeMatch && (
                <View
                    accessibilityLabel={`Al darrere: ${teamName(alternativeMatch.homeTeam)} - ${teamName(alternativeMatch.awayTeam)}, ${alternativeWomen ? 'femení' : 'masculí'}`}
                    style={[styles.preview, { backgroundColor: alternativeWomen ? EDITORIAL.feminine : EDITORIAL.masculine }]}
                >
                    <View style={styles.previewText}>
                        <Text numberOfLines={1} style={styles.teams}>{teamName(alternativeMatch.homeTeam)} - {teamName(alternativeMatch.awayTeam)}</Text>
                        <Text numberOfLines={1} style={styles.date}>{new Date(alternativeMatch.date).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long' })}</Text>
                    </View>
                </View>
            )}
            {alternativeMatch && (
                <View style={styles.backCard} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <MatchCard match={alternativeMatch} compact isFilter={props.isFilter} />
                </View>
            )}
            <Animated.View
                style={{ transform: [{ translateX: offset }, { rotate: reduceMotion ? '0deg' : offset.interpolate({ inputRange: [-width.current, 0, width.current], outputRange: ['-5deg', '0deg', '5deg'] }) }] }}
                accessibilityActions={alternativeMatch ? [{ name: 'increment', label: 'Partit següent' }, { name: 'decrement', label: 'Partit anterior' }] : undefined}
                onAccessibilityAction={event => {
                    if (event.nativeEvent.actionName === 'increment') switchMatch(-1);
                    if (event.nativeEvent.actionName === 'decrement') switchMatch(1);
                }}
            >
                <MatchCard
                    {...props}
                    onLongPress={() => { suppressTap.current = true; }}
                    onToggleFilter={() => { if (!suppressTap.current && !transitioning.current) props.onToggleFilter(); }}
                    match={match}
                    compact
                />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    deck: { overflow: 'hidden' },
    backCard: { position: 'absolute', top: 48, left: 0, right: 0 },
    preview: { marginHorizontal: 14, marginBottom: -16, minHeight: 64, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)', flexDirection: 'row', alignItems: 'center', gap: 12 },
    previewText: { flex: 1, minWidth: 0 },
    teams: { color: '#FFFFFF', fontFamily: EDITORIAL.fontBold, fontSize: 12, lineHeight: 17 },
    date: { color: '#F3D8E3', fontFamily: EDITORIAL.fontRegular, fontSize: 11, lineHeight: 15 },
});