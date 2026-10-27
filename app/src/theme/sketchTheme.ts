import { StyleSheet, TextStyle, ViewStyle, Platform } from 'react-native';
import { EDITORIAL } from './editorialTheme';

export const SKETCHY_COLORS = {
    bg: EDITORIAL.paper,
    bgLight: EDITORIAL.paperAlt,
    uiBg: EDITORIAL.card,
    card: '#FFFFFF',
    text: EDITORIAL.ink,
    textInverse: '#FFFFFF',  // Text sobre fons grana
    textMuted: EDITORIAL.inkMuted,
    mutedInverse: 'rgba(255,255,255,0.70)', // Text secundari sobre fons grana
    accent: '#a50044',       // Granate Barça — botons secundaris, accents
    accentSoft: EDITORIAL.granaSoft,
    border: EDITORIAL.hairline,
    primary: '#a50044',      // Granate Barça — color principal (sense blau)
    primarySoft: 'rgba(165, 0, 68, 0.10)',
    gold: '#FFFFFF',         // (abans groc) — etiquetes premium / accents sobre fons grana
    danger: '#db0030',       // Vermell Barça
};

export const sketchFontFamily = () => EDITORIAL.fontRegular;

// --- TIPOGRAFIA ESTÀNDARD ---
// Defineix els estils de text base per reutilitzar-los i evitar repetir fontFamily
const fontBase = { fontFamily: sketchFontFamily() };

export const SKETCH_TYPOGRAPHY = StyleSheet.create({
    display: {
        ...fontBase,
        fontSize: 48,
        fontWeight: 'bold',
        color: SKETCHY_COLORS.text,
        letterSpacing: 0,
    } as TextStyle,
    h1: {
        ...fontBase,
        fontSize: 28,
        fontWeight: '800',
        color: SKETCHY_COLORS.text,
    } as TextStyle,
    h2: {
        ...fontBase,
        fontSize: 22,
        fontWeight: '800',
        color: SKETCHY_COLORS.text,
        marginBottom: 10,
    } as TextStyle,
    h3: {
        ...fontBase,
        fontSize: 18,
        fontWeight: '800',
        color: SKETCHY_COLORS.text,
    } as TextStyle,
    body: {
        ...fontBase,
        fontSize: 16,
        color: SKETCHY_COLORS.text,
        lineHeight: 24,
    } as TextStyle,
    bodySmall: {
        ...fontBase,
        fontSize: 14,
        color: SKETCHY_COLORS.text,
        lineHeight: 20,
    } as TextStyle,
    caption: {
        ...fontBase,
        fontSize: 12,
        color: SKETCHY_COLORS.textMuted,
    } as TextStyle,
});

// --- LAYOUTS COMUNS ---
export const SKETCH_LAYOUT = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: SKETCHY_COLORS.bg,
    } as ViewStyle,
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    } as ViewStyle,
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    } as ViewStyle,
});

export const SKETCH_THEME = {
  colors: SKETCHY_COLORS,
  typography: SKETCH_TYPOGRAPHY,
  layout: SKETCH_LAYOUT,
  radius: {
        sm: 8,
        md: 8,
        lg: 8,
        xl: 8,
    pill: 999,
  },
  spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
  },
};

export const ensureLoraOnWeb = () => {
    // No-op: web not supported
};

export const sketchShadow = () => Platform.select({
  web: {
    boxShadow: '0 3px 12px rgba(0,0,0,0.12)',
  } as any,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
});



