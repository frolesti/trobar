import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { EDITORIAL } from '../theme/editorialTheme';

/**
 * Component de text per defecte de l'app.
 * Resol les variants Barlow i preserva les fonts de marca i esport.
 *
 * Ús:
 *   <AppText style={{ fontSize: 16, color: 'red' }}>Hola</AppText>
 *
 * Per sobreescriure la font puntualment, simplement passa
 * `fontFamily` dins de `style` (té prioritat sobre el default).
 */
const AppText: React.FC<TextProps> = ({ style, ...rest }) => {
    const flattened = StyleSheet.flatten(style);
    const bold = flattened?.fontFamily === EDITORIAL.fontBold || flattened?.fontWeight === 'bold' || Number(flattened?.fontWeight) >= 600;
    const italic = flattened?.fontFamily === EDITORIAL.fontItalic || flattened?.fontStyle === 'italic';
    return <Text {...rest} style={[styles.base, style, {
        fontFamily: flattened?.fontFamily === EDITORIAL.fontDisplay ? EDITORIAL.fontDisplay : flattened?.fontFamily === EDITORIAL.fontSport ? EDITORIAL.fontSport : italic ? EDITORIAL.fontItalic : bold ? EDITORIAL.fontBold : EDITORIAL.fontRegular,
        fontWeight: 'normal',
        letterSpacing: 0,
    }]} />;
};

const styles = StyleSheet.create({
    base: {
        fontFamily: EDITORIAL.fontRegular,
        fontSize: 14,
        color: EDITORIAL.ink,
    },
});

export default AppText;
