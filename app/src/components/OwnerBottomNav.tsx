import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './AppText';
import AppIcon from './AppIcon';
import { EDITORIAL } from '../theme/editorialTheme';

type Tab = 'map' | 'profile' | 'settings';
export default function OwnerBottomNav({ active, onMap, onProfile, onSettings, settingsTarget }: {
    active: Tab; onMap: () => void; onProfile: () => void; onSettings: () => void;
    settingsTarget?: React.Ref<React.ComponentRef<typeof TouchableOpacity>>;
}) {
    const insets = useSafeAreaInsets();
    return (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]} testID="owner-bottom-nav">
            {([
                { key: 'map', label: 'Mapa', icon: 'map', action: onMap },
                { key: 'profile', label: 'Perfil', icon: 'home', action: onProfile },
                { key: 'settings', label: 'Configuració', icon: 'settings', action: onSettings },
            ] as const).map(tab => (
                <TouchableOpacity ref={tab.key === 'settings' ? settingsTarget : undefined} key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.label}
                    accessibilityState={{ selected: active === tab.key }} onPress={tab.action} style={styles.item}>
                    <View style={[styles.icon, active === tab.key && styles.selected]}>
                        <AppIcon name={tab.icon} size={23} color={EDITORIAL.onBackground} />
                    </View>
                    <Text style={[styles.label, active === tab.key && styles.active]}>{tab.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}
const styles = StyleSheet.create({
    bar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingTop: 6, backgroundColor: EDITORIAL.granaDeep, borderTopWidth: 1, borderTopColor: EDITORIAL.borderOnBackground },
    item: { flex: 1, alignItems: 'center', minHeight: 58, justifyContent: 'center' },
    icon: { width: 52, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
    selected: { backgroundColor: 'rgba(255,255,255,0.16)' },
    label: { color: EDITORIAL.onBackgroundMuted, fontSize: 12, marginTop: 3 },
    active: { color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold },
});
