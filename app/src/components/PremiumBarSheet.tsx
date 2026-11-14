import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PremiumProfileSlider from './PremiumProfileSlider';
import { EDITORIAL } from '../theme/editorialTheme';

type Props = {
    name: string;
    screenWidth: number;
    screenHeight: number;
    collapsedTop: number;
    collapsedLeft: number;
    collapsedWidth: number;
    collapsedHeight: number;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    onCollapsedHeightChange: (height: number) => void;
    compactContent: React.ReactNode;
    renderExpanded: () => React.ReactNode;
    expandable?: boolean;
    triangleLeft?: number;
    triangleTop?: number;
    triangleBelow?: boolean;
    layoutReady?: boolean;
};

export function sheetProgress(start: number, dy: number, travel: number) {
    return Math.max(0, Math.min(1, start - dy / Math.max(1, travel)));
}

export function sheetDestination(progress: number, vy: number) {
    if (vy < -0.5) return true;
    if (vy > 0.5) return false;
    return progress >= 0.5;
}

export default function PremiumBarSheet({
    name, screenWidth, screenHeight, collapsedTop, collapsedLeft, collapsedWidth, collapsedHeight,
    expanded, onExpandedChange, onCollapsedHeightChange, compactContent, renderExpanded,
    expandable = true, triangleLeft, triangleTop, triangleBelow = false,
    layoutReady = true,
}: Props) {
    const insets = useSafeAreaInsets();
    const progress = useRef(new Animated.Value(0)).current;
    const value = useRef(0);
    const start = useRef(0);
    const desired = useRef(false);
    const dragging = useRef(false);
    const [presenting, setPresenting] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);
    const expandedTop = Math.max(insets.top + 8, screenHeight * 0.06);
    const travel = Math.max(1, collapsedTop - expandedTop);
    const expandedWidth = Math.min(screenWidth, 700);
    const settle = (next: boolean, notify = true) => {
        dragging.current = false;
        desired.current = next;
        if (next) setPresenting(true);
        progress.stopAnimation();
        if (notify) onExpandedChange(next);
        const complete = ({ finished }: { finished: boolean }) => {
            if (finished && !next) setPresenting(false);
        };
        if (reduceMotion) {
            progress.setValue(next ? 1 : 0);
            complete({ finished: true });
        } else {
            Animated.spring(progress, {
                toValue: next ? 1 : 0, damping: 26, stiffness: 240, mass: 1,
                overshootClamping: true, useNativeDriver: false,
            }).start(complete);
        }
    };

    useEffect(() => {
        const listener = progress.addListener(({ value: current }) => { value.current = current; });
        return () => { progress.removeListener(listener); progress.stopAnimation(); };
    }, [progress]);
    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
            if (mounted) setReduceMotion(enabled);
        }).catch(error => console.info('[PremiumBarSheet] No es pot consultar el moviment reduït', error));
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        return () => { mounted = false; subscription.remove(); };
    }, []);
    useEffect(() => {
        if (expanded !== desired.current && !dragging.current) settle(expanded, false);
    }, [expanded]);
    useEffect(() => {
        if (!presenting) return;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => { settle(false); return true; });
        return () => subscription.remove();
    }, [presenting, reduceMotion]);

    return (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 1100, elevation: 1100 }]}>
            {layoutReady && !presenting && triangleLeft != null && triangleTop != null && (
                <View pointerEvents="none" style={{
                    position: 'absolute', left: triangleLeft, top: triangleTop, width: 0, height: 0,
                    borderLeftWidth: 9, borderRightWidth: 9,
                    borderTopWidth: triangleBelow ? 0 : 9, borderBottomWidth: triangleBelow ? 9 : 0,
                    borderLeftColor: 'transparent', borderRightColor: 'transparent',
                    borderTopColor: EDITORIAL.background, borderBottomColor: EDITORIAL.background,
                }} />
            )}
            {presenting && (
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress, backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Plegar el perfil del bar" onPress={() => settle(false)} style={StyleSheet.absoluteFill} />
                </Animated.View>
            )}
            <Animated.View
                testID="premium-bar-sheet"
                accessibilityViewIsModal={presenting}
                pointerEvents={layoutReady || presenting ? 'auto' : 'none'}
                onAccessibilityEscape={() => settle(false)}
                onLayout={event => {
                    if (!presenting) onCollapsedHeightChange(event.nativeEvent.layout.height);
                }}
                style={{
                    position: 'absolute',
                    opacity: layoutReady || presenting ? 1 : 0,
                    top: progress.interpolate({ inputRange: [0, 1], outputRange: [collapsedTop, expandedTop] }),
                    left: progress.interpolate({ inputRange: [0, 1], outputRange: [collapsedLeft, (screenWidth - expandedWidth) / 2] }),
                    width: progress.interpolate({ inputRange: [0, 1], outputRange: [collapsedWidth, expandedWidth] }),
                    height: presenting ? progress.interpolate({ inputRange: [0, 1], outputRange: [collapsedHeight, screenHeight - expandedTop] }) : undefined,
                    backgroundColor: EDITORIAL.background, borderWidth: 2, borderColor: expandable ? EDITORIAL.matchday : EDITORIAL.borderOnBackground,
                    borderRadius: 12, overflow: 'hidden',
                    ...Platform.select({
                        web: { boxShadow: '0 10px 36px rgba(35,0,15,0.3)' },
                        ios: { shadowColor: '#23000f', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
                        android: { elevation: 16 },
                    }),
                }}
            >
                {expandable ? <PremiumProfileSlider
                    name={name}
                    onOpen={() => settle(true)}
                    onCollapse={() => settle(false)}
                    onDragStart={() => {
                        dragging.current = true;
                        start.current = value.current;
                        progress.stopAnimation();
                        setPresenting(true);
                    }}
                    onDrag={dy => {
                        const next = sheetProgress(start.current, dy, travel);
                        value.current = next;
                        progress.setValue(next);
                    }}
                    onDragEnd={(dy, vy) => settle(Math.abs(dy) < 4 ? desired.current : sheetDestination(value.current, vy))}
                    onDragCancel={() => settle(desired.current)}
                /> : <View style={{ height: 12 }} />}
                <Animated.View
                    testID="static-premium-map-card"
                    pointerEvents={presenting ? 'none' : 'auto'}
                    accessibilityElementsHidden={presenting}
                    importantForAccessibility={presenting ? 'no-hide-descendants' : 'auto'}
                    style={{
                        position: presenting ? 'absolute' : 'relative', top: presenting ? 28 : undefined,
                        left: presenting ? 12 : undefined, right: presenting ? 12 : undefined,
                        marginHorizontal: presenting ? 0 : 12, paddingBottom: 12,
                        opacity: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }),
                    }}
                >
                    {compactContent}
                </Animated.View>
                {presenting && (
                    <Animated.View
                        testID="expanded-premium-content"
                        pointerEvents={expanded && !dragging.current ? 'auto' : 'none'}
                        style={{
                            position: 'absolute', top: 28, bottom: 0, left: 0, right: 0,
                            opacity: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0, 1] }),
                        }}
                    >
                        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={expandedTop + 28}>
                            {renderExpanded()}
                        </KeyboardAvoidingView>
                    </Animated.View>
                )}
            </Animated.View>
        </View>
    );
}
