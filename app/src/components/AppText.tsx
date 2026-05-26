import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

/**
 * Component de text per defecte de l'app.
 * Aplica la font Lora globalment perquè no calgui repetir
 * `fontFamily: 'Lora'` a tots els <Text> del codi.
 *
 * Ús:
 *   <AppText style={{ fontSize: 16, color: 'red' }}>Hola</AppText>
 *
 * Per sobreescriure la font puntualment, simplement passa
 * `fontFamily` dins de `style` (té prioritat sobre el default).
 */
const AppText: React.FC<TextProps> = ({ style, ...rest }) => {
    return <Text {...rest} style={[styles.base, style]} />;
};

const styles = StyleSheet.create({
    base: {
        fontFamily: 'Lora_400Regular',
    },
});

export default AppText;
