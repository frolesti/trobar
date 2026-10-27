import React from 'react';
import { Linking, StyleProp, TextStyle } from 'react-native';
import Text from './AppText';
import { EDITORIAL } from '../theme/editorialTheme';

interface IconCreditsProps {
    style?: StyleProp<TextStyle>;
}

export default function IconCredits({ style }: IconCreditsProps) {
    return (
        <Text
            accessibilityRole="link"
            accessibilityLabel="Icones d'Icons8"
            onPress={() => Linking.openURL('https://icons8.com/')}
            style={[
                { fontFamily: EDITORIAL.fontRegular, fontSize: 12, color: EDITORIAL.inkMuted, textAlign: 'center' },
                style,
            ]}
        >
            Icones: Icons8
        </Text>
    );
}