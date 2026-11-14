import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, StyleSheet, View } from 'react-native';
import MatchCard from './MatchCard';
import { Match } from '../models/Match';

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
    const [cardHeight, setCardHeight] = useState(180);
    const transitioning = useRef(false);
    const animationVersion = useRef(0);
    const suppressTap = useRef(false);
    const pressStartedAt = useRef(0);
    const [reduceMotion, setReduceMotion] = useState(true);
    const latest = useRef({ alternativeMatch, onSwitchMatch, reduceMotion, cardHeight });
    latest.current = { alternativeMatch, onSwitchMatch, reduceMotion, cardHeight };

    useEffect(() => {
        let active = true;
        AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
            if (active) setReduceMotion(enabled);
        }).catch(error => console.info('[MatchCardStack] No es pot consultar el moviment reduït', error));
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => { active = false; subscription.remove(); };
    }, []);

    useLayoutEffect(() => {
        animationVersion.current += 1;
        offset.stopAnimation();
        offset.setValue(0);
        transitioning.current = false;
        suppressTap.current = false;
        return () => {
            animationVersion.current += 1;
            offset.stopAnimation();
        };
    }, [match.id, alternativeMatch?.id, reduceMotion, offset]);

    const switchMatch = useRef((towards: number) => {
        if (!latest.current.alternativeMatch || transitioning.current) return;
        if (latest.current.reduceMotion) { offset.setValue(0); latest.current.onSwitchMatch(); return; }
        transitioning.current = true;
        const version = ++animationVersion.current;
        Animated.timing(offset, { toValue: towards * (latest.current.cardHeight + 64), duration: 200, useNativeDriver: false }).start(({ finished }) => {
            if (version !== animationVersion.current) return;
            offset.setValue(0);
            transitioning.current = false;
            if (finished) latest.current.onSwitchMatch();
        });
    }).current;
    const swipe = useMemo(() => {
        const reset = () => Animated.timing(offset, {
            toValue: 0,
            duration: latest.current.reduceMotion ? 0 : 160,
            useNativeDriver: false,
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
                    Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
            },
            onPanResponderGrant: () => {
                suppressTap.current = true;
                offset.stopAnimation();
            },
            onPanResponderMove: (_, gesture) => {
                offset.setValue(Math.max(-latest.current.cardHeight, Math.min(latest.current.cardHeight, gesture.dy)));
            },
            onPanResponderRelease: (_, gesture) => {
                if (Math.abs(gesture.dy) > 48 || (Math.abs(gesture.dy) > 12 && Math.abs(gesture.vy) > 0.5)) {
                    switchMatch(gesture.dy < 0 ? -1 : 1);
                } else reset();
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderTerminate: reset,
        });
    }, [offset, switchMatch]);

    return (
        <View testID="match-card-deck" collapsable={false} {...swipe.panHandlers} style={styles.deck}>
            {alternativeMatch && (
                <Animated.View testID="match-card-back" collapsable={false} style={[styles.backCard, {
                    transform: [{ scale: offset.interpolate({
                        inputRange: [-cardHeight, 0, cardHeight],
                        outputRange: [1, 0.94, 1], extrapolate: 'clamp',
                    }) }],
                }]} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <MatchCard match={alternativeMatch} compact isFilter={false} />
                </Animated.View>
            )}
            <View collapsable={false} style={[styles.frontFrame, { paddingTop: alternativeMatch ? 48 : 0 }]}>
            <Animated.View
                testID="match-card-front"
                collapsable={false}
                onLayout={event => { const measured = Math.round(event.nativeEvent.layout.height); if (measured > 0) setCardHeight(measured); }}
                style={{ transform: [{ translateY: offset }, { rotate: reduceMotion ? '0deg' : offset.interpolate({
                    inputRange: [-cardHeight, 0, cardHeight],
                    outputRange: ['-3deg', '0deg', '3deg'], extrapolate: 'clamp',
                }) }] }}
                accessibilityHint={alternativeMatch ? 'Mantén premut i arrossega amunt o avall per passar la targeta al darrere' : undefined}
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
        </View>
    );
}

const styles = StyleSheet.create({
    deck: { overflow: 'hidden', flexShrink: 0, position: 'relative', isolation: 'isolate' },
    frontFrame: { position: 'relative', zIndex: 2 },
    backCard: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
});