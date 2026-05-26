/**
 * Editorial theme tokens — Barça editorial premium.
 * Magazine feel: cream paper bg, ink typography, grana CTAs.
 * Use these tokens across all screens for visual consistency.
 */
import { StyleSheet, Platform, TextStyle, ViewStyle } from 'react-native';

export const EDITORIAL = {
    // Palette
    ink: '#0F1B2D',           // titulars, text principal
    inkMuted: '#5B6677',      // text secundari
    paper: '#FAF6EF',         // fons editorial crema
    paperAlt: '#F2EDE3',      // fons alternat (seccions)
    card: '#FFFFFF',          // targetes sobre paper
    hairline: 'rgba(15,27,45,0.12)',
    hairlineStrong: 'rgba(15,27,45,0.22)',
    grana: '#a50044',         // Barça grana — CTA primaris, accents, links
    granaSoft: 'rgba(165,0,68,0.08)',
    granaDeep: '#7a0033',     // grana fosc per hover/pressed
    danger: '#db0030',
    success: '#1f7a3a',

    // Typography family aliases (require @expo-google-fonts/lora loaded)
    fontRegular: 'Lora_400Regular',
    fontBold: 'Lora_700Bold',
    fontItalic: 'Lora_400Regular_Italic',

    // Spacing
    space: {
        xs: 6,
        sm: 10,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },

    // Radius — editorial = squared / minimal
    radius: {
        none: 0,
        sm: 4,
        md: 8,
        full: 999,
    },
};

/** Standard editorial typography styles */
export const ED_TYPE = StyleSheet.create({
    eyebrow: {
        fontFamily: EDITORIAL.fontBold,
        fontSize: 11,
        color: EDITORIAL.grana,
        letterSpacing: 2.4,
        textTransform: 'uppercase',
    } as TextStyle,
    display: {
        fontFamily: EDITORIAL.fontBold,
        fontSize: 40,
        lineHeight: 46,
        color: EDITORIAL.ink,
        letterSpacing: -0.5,
    } as TextStyle,
    h1: {
        fontFamily: EDITORIAL.fontBold,
        fontSize: 30,
        lineHeight: 36,
        color: EDITORIAL.ink,
        letterSpacing: -0.3,
    } as TextStyle,
    h2: {
        fontFamily: EDITORIAL.fontBold,
        fontSize: 22,
        lineHeight: 28,
        color: EDITORIAL.ink,
    } as TextStyle,
    h3: {
        fontFamily: EDITORIAL.fontBold,
        fontSize: 17,
        lineHeight: 22,
        color: EDITORIAL.ink,
    } as TextStyle,
    body: {
        fontFamily: EDITORIAL.fontRegular,
        fontSize: 16,
        lineHeight: 24,
        color: EDITORIAL.ink,
    } as TextStyle,
    bodyMuted: {
        fontFamily: EDITORIAL.fontRegular,
        fontSize: 16,
        lineHeight: 24,
        color: EDITORIAL.inkMuted,
    } as TextStyle,
    small: {
        fontFamily: EDITORIAL.fontRegular,
        fontSize: 14,
        lineHeight: 20,
        color: EDITORIAL.inkMuted,
    } as TextStyle,
    caption: {
        fontFamily: EDITORIAL.fontRegular,
        fontSize: 12,
        lineHeight: 18,
        color: EDITORIAL.inkMuted,
    } as TextStyle,
    italic: {
        fontFamily: EDITORIAL.fontItalic,
    } as TextStyle,
});

/** Common editorial layout primitives */
export const ED_LAYOUT = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: EDITORIAL.paper,
    } as ViewStyle,
    scroll: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: Platform.OS === 'ios' ? 56 : 36,
        paddingBottom: 56,
    } as ViewStyle,
    panel: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: 520,
    } as ViewStyle,
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 40,
    } as ViewStyle,
    hairline: {
        height: 1,
        backgroundColor: EDITORIAL.hairline,
        marginVertical: 24,
    } as ViewStyle,
    card: {
        backgroundColor: EDITORIAL.card,
        borderRadius: EDITORIAL.radius.sm,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
        padding: 20,
    } as ViewStyle,
});

/** Common button styles */
export const ED_BUTTON = StyleSheet.create({
    base: {
        flexDirection: 'row',
        width: '100%',
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: EDITORIAL.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
    } as ViewStyle,
    primary: {
        backgroundColor: EDITORIAL.grana,
        borderColor: EDITORIAL.grana,
    } as ViewStyle,
    secondary: {
        backgroundColor: EDITORIAL.card,
        borderColor: EDITORIAL.ink,
    } as ViewStyle,
    dark: {
        backgroundColor: EDITORIAL.ink,
        borderColor: EDITORIAL.ink,
    } as ViewStyle,
    primaryText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: EDITORIAL.fontBold,
        letterSpacing: 0.2,
    } as TextStyle,
    secondaryText: {
        color: EDITORIAL.ink,
        fontSize: 16,
        fontFamily: EDITORIAL.fontBold,
        letterSpacing: 0.2,
    } as TextStyle,
});
