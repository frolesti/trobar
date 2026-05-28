/**
 * AlertBanner — editorial transient notice/toast component.
 *
 * Use as a single global host:
 *   <AlertBannerHost />  (mount once near the root, after Map / Modal layers)
 * And anywhere in the tree:
 *   import { showAlert } from './AlertBanner';
 *   showAlert({ message: 'Hola', tone: 'info' });
 *
 * Tones: info (paper + ink), success (grana eyebrow), error (danger text).
 * Auto-dismiss after `duration` ms (default 5000). Manually closable via X.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EDITORIAL } from '../theme/editorialTheme';

export type AlertTone = 'info' | 'success' | 'error';

export interface AlertPayload {
    message: string;
    tone?: AlertTone;
    /** ms; 0 = sticky until manual close. Default 5000. */
    duration?: number;
    /** Optional short eyebrow above the message (e.g. "Avís", "Error"). */
    eyebrow?: string;
    /** Visual position of the banner. Defaults to host defaultPosition. */
    position?: 'top' | 'bottom';
}

type Listener = (a: AlertPayload | null) => void;
const listeners = new Set<Listener>();

export function showAlert(payload: AlertPayload) {
    listeners.forEach((l) => l(payload));
}

export function dismissAlert() {
    listeners.forEach((l) => l(null));
}

const TONE_EYEBROW: Record<AlertTone, string> = {
    info: EDITORIAL.grana,
    success: EDITORIAL.grana,
    error: '#B00020',
};

export const AlertBannerHost: React.FC<{ topOffset?: number; bottomOffset?: number; defaultPosition?: 'top' | 'bottom' }> = ({
    topOffset = 16,
    bottomOffset = 90,
    defaultPosition = 'top',
}) => {
    const [alert, setAlert] = useState<AlertPayload | null>(null);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-12)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const close = useCallback(() => {
        const isBottom = (alert?.position ?? defaultPosition) === 'bottom';
        Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: isBottom ? 12 : -12, duration: 200, useNativeDriver: true }),
        ]).start(() => setAlert(null));
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    }, [alert?.position, defaultPosition, opacity, translateY]);

    useEffect(() => {
        const listener: Listener = (payload) => {
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
            if (!payload) { close(); return; }
            setAlert(payload);
            const isBottom = (payload.position ?? defaultPosition) === 'bottom';
            opacity.setValue(0);
            translateY.setValue(isBottom ? 12 : -12);
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver: true }),
            ]).start();
            const dur = payload.duration ?? 5000;
            if (dur > 0) {
                timerRef.current = setTimeout(close, dur);
            }
        };
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [close, opacity, translateY]);

    if (!alert) return null;

    const eyebrowColor = TONE_EYEBROW[alert.tone ?? 'info'];
    const isBottom = (alert.position ?? defaultPosition) === 'bottom';

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[
                styles.host,
                isBottom ? { bottom: bottomOffset, opacity, transform: [{ translateY }] } : { top: topOffset, opacity, transform: [{ translateY }] },
            ]}
        >
            <View style={styles.card}>
                {(alert.eyebrow || alert.tone === 'error') && (
                    <Text style={[styles.eyebrow, { color: eyebrowColor }]}>
                        {alert.eyebrow || (alert.tone === 'error' ? 'Error' : 'Avís')}
                    </Text>
                )}
                <Text style={styles.message}>{alert.message}</Text>
                <TouchableOpacity
                    onPress={close}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Tancar avís"
                >
                    <Feather name="x" size={14} color={EDITORIAL.ink} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 99999,
    },
    card: {
        maxWidth: 480,
        minWidth: 240,
        marginHorizontal: 16,
        backgroundColor: EDITORIAL.paper,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: EDITORIAL.hairlineStrong,
        paddingVertical: 12,
        paddingHorizontal: 16,
        paddingRight: 36,
        ...Platform.select({
            web: { boxShadow: '0 6px 20px rgba(15,27,45,0.12)' } as any,
            default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
        }),
    },
    eyebrow: {
        fontFamily: 'Lora_700Bold',
        fontSize: 10,
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    message: {
        fontFamily: 'Lora_400Regular',
        fontSize: 13,
        lineHeight: 18,
        color: EDITORIAL.ink,
    },
    closeBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 11,
    },
});

export default AlertBannerHost;
