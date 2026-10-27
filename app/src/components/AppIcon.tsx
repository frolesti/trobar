import React from 'react';
import { Image, ImageProps, TextProps } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ICON_SOURCES } from '../theme/iconSources';
import { EDITORIAL } from '../theme/editorialTheme';

const aliases: Record<string, string> = {
    'location-outline': 'map-pin', 'map-outline': 'map', 'navigate-outline': 'navigation',
    'settings-outline': 'settings', 'calendar-outline': 'calendar', 'trophy-outline': 'award',
    'television': 'tv', 'checkmark-circle-outline': 'check-circle', 'shield-outline': 'shield',
    'arrow-forward': 'arrow-right', 'arrow-back': 'arrow-left', 'alarm-outline': 'clock',
    'pricetag-outline': 'tag', 'home-outline': 'home', 'parking': 'parking',
    'football-outline': 'soccer', 'shirt-outline': 'tshirt-crew-outline',
};
const imageIcons = new Set(['registered-pin', 'pending-pin', 'google', 'logo-apple', 'instagram', 'facebook', 'twitter', 'whatsapp']);

interface AppIconProps extends Omit<ImageProps, 'source' | keyof TextProps>, Omit<TextProps, 'style' | 'children'> {
    name: string;
    size?: number;
    color?: string;
    style?: ImageProps['style'];
}

export default function AppIcon({ name, size = 24, color = EDITORIAL.ink, style, ...props }: AppIconProps) {
    const iconName = aliases[name] || name;
    if (!imageIcons.has(name)) {
        const Icon = iconName in Feather.glyphMap ? Feather : MaterialCommunityIcons;
        const resolved = iconName in Icon.glyphMap ? iconName : 'help-circle';
        return <Icon {...props} name={resolved as never} size={size} color={color} style={style as any} />;
    }
    const source = ICON_SOURCES[name];

    return (
        <Image
            {...props}
            source={source}
            resizeMode="contain"
            style={[
                { width: size, height: size },
                style,
            ]}
        />
    );
}