import { Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';

export const SKETCHY_COLORS = {
    bg: '#F0F7F4', // Light Mint Green
    uiBg: 'rgba(240, 247, 244, 0.96)',
    card: '#FFFFFF',
    text: '#1B4D3E', // Deep Forest Green
    textMuted: '#5C8D75', // Sage Green
    accent: '#4BB577', // Primary is now Accent too
    border: 'rgba(27, 77, 62, 0.15)', // Green wash
    primary: '#4BB577', // New Green Brand Color
    primarySoft: 'rgba(75, 181, 119, 0.15)',
    danger: '#D32F2F',
};

export const sketchFontFamily = () =>
  Platform.select({
    web: "'Lora', serif", // Ensure CSS syntax for web
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
  });

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
    if (Platform.OS === 'web') {
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        // Inject global styles for web
        const style = document.createElement('style');
        style.textContent = `
          html, body, #root, #root > div { height: 100%; }
          body { font-family: 'Lora', serif; background-color: ${SKETCHY_COLORS.bg}; overflow: auto; }
          #root { display: flex; flex: 1; }
          input, textarea, select, button { font-family: 'Lora', serif !important; }
        `;
        document.head.appendChild(style);
    }
};

export const sketchShadow = () =>
  Platform.select({
    web: { boxShadow: '0 10px 22px rgba(62, 39, 35, 0.10)' },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
  });



