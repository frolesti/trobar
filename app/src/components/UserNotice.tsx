import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './AppText';
import { EDITORIAL } from '../theme/editorialTheme';
import { sanitizeUserMessage } from '../utils/errorHandler';

export type NoticeTone = 'info' | 'success' | 'error';
export type NoticeAction = { label: string; onPress: () => void };
type Props = {
    message: string;
    tone?: NoticeTone;
    title?: string;
    onDismiss?: () => void;
    action?: NoticeAction;
    compact?: boolean;
};

export default function UserNotice({ message, tone = 'info', title, onDismiss, action, compact = false }: Props) {
    return (
        <View
            testID="user-notice"
            accessibilityRole={tone === 'error' ? 'alert' : undefined}
            accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
            style={[styles.card, compact && styles.compactCard, compact && onDismiss && styles.compactDismissible]}
        >
            <View style={[styles.content, compact && styles.compactContent]}>
                {(title || tone === 'error') && <Text style={[styles.title, compact && styles.centered]}>{sanitizeUserMessage(title || 'No ho hem pogut completar')}</Text>}
                <Text style={[styles.message, compact && styles.centered]}>{sanitizeUserMessage(message)}</Text>
                {action && <TouchableOpacity onPress={action.onPress} accessibilityRole="button" style={[styles.action, compact && styles.fullAction]}>
                    <Text style={[styles.actionText, styles.centered]}>{sanitizeUserMessage(action.label, 'Continuar')}</Text>
                </TouchableOpacity>}
            </View>
            {onDismiss && (
                <TouchableOpacity onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Tancar avís" style={[styles.close, compact && styles.compactClose]}>
                    <Feather name="x" size={18} color="#F4E6CC" />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: EDITORIAL.granaDeep, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(244,230,204,0.28)', paddingVertical: 6, paddingLeft: 16, paddingRight: 6, gap: 8, shadowColor: '#260010', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 8 },
    content: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    compactCard: { width: 'auto', maxWidth: '100%', alignSelf: 'center', paddingLeft: 14, paddingRight: 14 },
    compactContent: { flexGrow: 0, flexBasis: 'auto' },
    compactDismissible: { paddingLeft: 44, paddingRight: 44, minHeight: 56 },
    compactClose: { position: 'absolute', top: 0, right: 0 },
    centered: { textAlign: 'center' },
    fullAction: { alignSelf: 'stretch' },
    title: { color: '#F4E6CC', fontFamily: EDITORIAL.fontBold, fontSize: 14, lineHeight: 20, marginTop: 6 },
    message: { color: '#F4E6CC', fontFamily: EDITORIAL.fontRegular, fontSize: 14, lineHeight: 20, paddingVertical: 6 },
    close: { width: 44, height: 44, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' },
    action: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 14, marginVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(244,230,204,0.5)' },
    actionText: { color: '#F4E6CC', fontFamily: EDITORIAL.fontBold, fontSize: 14 },
});
