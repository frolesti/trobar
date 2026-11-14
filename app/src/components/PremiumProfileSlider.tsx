import React, { useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { EDITORIAL } from '../theme/editorialTheme';

type Props = {
    name: string;
    onOpen: () => void;
    onCollapse?: () => void;
    onDragStart?: () => void;
    onDrag?: (dy: number) => void;
    onDragEnd?: (dy: number, vy: number) => void;
    onDragCancel?: () => void;
};
const OPEN_DISTANCE = 32;
const HANDLE_TRAVEL = 12;

export default function PremiumProfileSlider({ name, onOpen, ...gestures }: Props) {
    const offset = useRef(new Animated.Value(0)).current;
    const opening = useRef(false);
    const latestOpen = useRef(onOpen);
    latestOpen.current = onOpen;
    const latestGestures = useRef(gestures);
    latestGestures.current = gestures;
    const reset = () => {
        opening.current = false;
        offset.setValue(0);
    };
    const open = () => {
        if (opening.current) return;
        opening.current = true;
        latestOpen.current();
        offset.setValue(0);
        opening.current = false;
    };
    const responder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy < 0 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
            offset.stopAnimation();
            latestGestures.current.onDragStart?.();
        },
        onPanResponderMove: (_, gesture) => {
            if (latestGestures.current.onDrag) {
                if (Math.abs(gesture.dy) >= Math.abs(gesture.dx)) latestGestures.current.onDrag(gesture.dy);
            }
            else offset.setValue(Math.max(-HANDLE_TRAVEL, Math.min(0, gesture.dy)));
        },
        onPanResponderRelease: (_, gesture) => {
            if (latestGestures.current.onDragEnd) {
                if (Math.abs(gesture.dx) > Math.abs(gesture.dy)) latestGestures.current.onDragCancel?.();
                else latestGestures.current.onDragEnd(gesture.dy, gesture.vy);
                return;
            }
            if (-gesture.dy >= OPEN_DISTANCE && Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
                Animated.timing(offset, {
                    toValue: -HANDLE_TRAVEL, duration: 120, useNativeDriver: Platform.OS !== 'web',
                }).start(({ finished }) => { if (finished) open(); else reset(); });
            } else {
                Animated.spring(offset, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
            }
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
            latestGestures.current.onDragCancel?.();
            reset();
        },
    }), [offset]);

    return (
        <Animated.View
            {...responder.panHandlers}
            testID="premium-profile-slider"
            style={[styles.touchArea, { transform: [{ translateY: offset }] }]}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Obrir el perfil premium de ${name}`}
            accessibilityHint="Arrossega cap amunt per desplegar la fitxa o cap avall per plegar-la"
            accessibilityActions={[{ name: 'increment', label: 'Obrir el perfil complet' }, ...(gestures.onCollapse ? [{ name: 'decrement', label: 'Plegar el perfil' }] : [])]}
            onAccessibilityAction={event => {
                if (event.nativeEvent.actionName === 'increment') open();
                if (event.nativeEvent.actionName === 'decrement') latestGestures.current.onCollapse?.();
            }}
            onAccessibilityTap={open}
        >
            <View style={styles.line} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    touchArea: {
        height: 28, minWidth: 88, alignSelf: 'center', alignItems: 'center', justifyContent: 'center',
        ...Platform.select({ web: { userSelect: 'none' as const, touchAction: 'none' as const } }),
    },
    line: { width: 40, height: 4, borderRadius: 2, backgroundColor: EDITORIAL.borderOnBackground },
});
