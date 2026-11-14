import React from 'react';
import { View, StyleSheet } from 'react-native';
import Toast, { ToastConfigParams } from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserNotice, { NoticeAction } from './UserNotice';
import { sanitizeUserMessage } from '../utils/errorHandler';

export type AlertTone = 'info' | 'success' | 'error';

export interface AlertPayload {
    message: string;
    tone?: AlertTone;
    duration?: number;
    eyebrow?: string;
    position?: 'top' | 'bottom';
    offset?: number;
    action?: NoticeAction;
}

export function showAlert(payload: AlertPayload) {
    const duration = payload.duration ?? (payload.tone === 'error' ? 8000 : 5000);
    Toast.show({
        type: 'trobar',
        position: payload.position,
        autoHide: duration > 0,
        visibilityTime: Math.min(duration, 15000),
        ...(payload.offset === undefined ? {} : { topOffset: payload.offset, bottomOffset: payload.offset }),
        props: {
            ...payload,
            message: sanitizeUserMessage(payload.message),
            eyebrow: payload.eyebrow ? sanitizeUserMessage(payload.eyebrow, 'Avís') : undefined,
        },
    });
}

export function dismissAlert() {
    Toast.hide();
}

const createConfig = (horizontalInsets?: { left: number; right: number }) => ({
    trobar: ({ props, hide }: ToastConfigParams<AlertPayload>) => (
        <View style={[styles.content, horizontalInsets && { paddingLeft: horizontalInsets.left, paddingRight: horizontalInsets.right }]}>
            <UserNotice
                compact
                message={props.message}
                title={props.eyebrow}
                tone={props.tone}
                onDismiss={hide}
                action={props.action ? { ...props.action, onPress: () => { hide(); props.action?.onPress(); } } : undefined}
            />
        </View>
    ),
});

// The library targets the last mounted host, including one inside a native modal.
export const AlertBannerHost: React.FC<{
    active?: boolean;
    priority?: number;
    topOffset?: number;
    bottomOffset?: number;
    defaultPosition?: 'top' | 'bottom';
    horizontalInsets?: { left: number; right: number };
    onVisibilityChange?: (visible: boolean) => void;
}> = ({ active = true, topOffset = 16, bottomOffset = 90, defaultPosition = 'bottom', horizontalInsets, onVisibilityChange }) => {
    const insets = useSafeAreaInsets();
    React.useEffect(() => { if (!active) onVisibilityChange?.(false); }, [active, onVisibilityChange]);
    return active ? <View pointerEvents="box-none" style={styles.host}><Toast
        config={createConfig(horizontalInsets)}
        position={defaultPosition}
        topOffset={Math.max(topOffset, insets.top + 12)}
        bottomOffset={Math.max(bottomOffset, insets.bottom + 12)}
        animationConfig={{ type: 'timing', duration: 180 }}
        onShow={() => onVisibilityChange?.(true)}
        onHide={() => onVisibilityChange?.(false)}
    /></View> : null;
};

const styles = StyleSheet.create({
    host: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden', zIndex: 10000 },
    content: { maxWidth: 480, width: '100%', paddingHorizontal: 16, alignItems: 'center' },
});

export default AlertBannerHost;
