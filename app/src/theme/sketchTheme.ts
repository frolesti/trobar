import { StyleSheet, TextStyle, ViewStyle, Platform } from 'react-native';

export const SKETCHY_COLORS = {
    bg: '#a50044',           // GRANA PUR — fons principal
    bgLight: '#8a003a',      // Grana fosc — seccions alternes
    uiBg: 'rgba(165, 0, 68, 0.96)',
    card: '#FFFFFF',
    text: '#1A1A2E',         // Blau molt fosc (gairebé negre, llegible dins targetes)
    textInverse: '#FFFFFF',  // Text sobre fons grana
    textMuted: '#6B7280',    // Gris neutre (dins targetes)
    mutedInverse: 'rgba(255,255,255,0.70)', // Text secundari sobre fons grana
    accent: '#a50044',       // Granate Barça — botons secundaris, accents
    accentSoft: 'rgba(255, 255, 255, 0.10)',
    border: 'rgba(255, 255, 255, 0.12)', // Vora subtil sobre fons fosc
    primary: '#a50044',      // Granate Barça — color principal (sense blau)
    primarySoft: 'rgba(165, 0, 68, 0.10)',
    gold: '#FFFFFF',         // (abans groc) — etiquetes premium / accents sobre fons grana
    danger: '#db0030',       // Vermell Barça
};

export const sketchFontFamily = () => Platform.select({
    web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
}) as string;

// --- TIPOGRAFIA ESTÀNDARD ---
// Defineix els estils de text base per reutilitzar-los i evitar repetir fontFamily
const fontBase = { fontFamily: sketchFontFamily() };

export const SKETCH_TYPOGRAPHY = StyleSheet.create({
    display: {
        ...fontBase,
        fontSize: 48,
        fontWeight: 'bold',
        color: SKETCHY_COLORS.text,
        letterSpacing: 1,
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
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
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



