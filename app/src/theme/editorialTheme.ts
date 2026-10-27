/**
 * Shared matchday theme: light map surfaces, grana brand and yellow accents.
 * Use these tokens across all screens for visual consistency.
 */
import { StyleSheet, Platform, TextStyle, ViewStyle } from 'react-native';
import brandColors from './brandColors.json';

export const EDITORIAL = {
    // Palette
    ink: '#202631',
    inkMuted: '#66707D',
    paper: '#F5F7FA',
    paperAlt: '#EAF0F5',
    card: '#FFFFFF',          // targetes sobre paper
    hairline: 'rgba(15,27,45,0.12)',
    hairlineStrong: 'rgba(15,27,45,0.22)',
    grana: brandColors.primary,         // Barça grana — CTA primaris, accents, links
    granaSoft: 'rgba(165,0,68,0.08)',
    granaDeep: brandColors.background,
    background: brandColors.background,
    onBackground: '#FFFFFF',
    onBackgroundMuted: '#F0CDD9',
    borderOnBackground: 'rgba(255,255,255,0.3)',
    matchCard: '#96003E',
    matchDate: '#850037',
    masculine: '#8C003B',
    feminine: '#AD2857',
    danger: '#db0030',
    success: '#1f7a3a',
    blue: '#328BC7',
    blueSoft: '#E5F3FB',
    greenSoft: '#E7F3ED',
    warning: '#B96A16',
    matchday: '#F4D35E',
    matchdaySoft: '#FFF5CC',

    // Typography family aliases loaded by App.tsx
    fontRegular: 'Barlow_400Regular',
    fontBold: 'Barlow_600SemiBold',
    fontItalic: 'Barlow_400Regular_Italic',
    fontSport: 'BarlowCondensed_700Bold',
    fontDisplay: 'Oi_400Regular',

    // Spacing
    space: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },

    // Radius — editorial = squared / minimal
    radius: {
        none: 0,
        sm: 8,
        md: 8,
        full: 999,
    },
};

/** Standard editorial typography styles */
export const ED_TYPE = StyleSheet.create({
    eyebrow: {
        fontFamily: EDITORIAL.fontBold,
        fontSize: 12,
        color: EDITORIAL.grana,
        letterSpacing: 0,
        textTransform: 'uppercase',
    } as TextStyle,
    display: {
        fontFamily: EDITORIAL.fontDisplay,
        fontSize: 40,
        lineHeight: 46,
        color: EDITORIAL.ink,
        letterSpacing: 0,
    } as TextStyle,
    h1: {
        fontFamily: EDITORIAL.fontSport,
        fontSize: 28,
        lineHeight: 36,
        color: EDITORIAL.ink,
        letterSpacing: 0,
    } as TextStyle,
    h2: {
        fontFamily: EDITORIAL.fontSport,
        fontSize: 22,
        lineHeight: 28,
        color: EDITORIAL.ink,
        letterSpacing: 0,
    } as TextStyle,
    h3: {
        fontFamily: EDITORIAL.fontBold,
        fontSize: 18,
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
        letterSpacing: 0,
    } as TextStyle,
    secondaryText: {
        color: EDITORIAL.ink,
        fontSize: 16,
        fontFamily: EDITORIAL.fontBold,
        letterSpacing: 0,
    } as TextStyle,
});
