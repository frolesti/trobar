import { Platform } from 'react-native';

export const SKETCH_THEME = {
  colors: {
    bg: '#FFFBF0',
    uiBg: 'rgba(255, 251, 240, 0.96)',
    card: '#FFFFFF',
    text: '#3E2723',
    textMuted: '#6D4C41',
    accent: '#8D6E63',
    border: 'rgba(62, 39, 35, 0.18)',
    primary: '#D32F2F',
    primarySoft: 'rgba(211, 47, 47, 0.12)',
    danger: '#C62828',
  },
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

export const sketchFontFamily = () =>
  Platform.select({
    web: 'Lora',
    ios: 'Georgia',
    android: 'serif',
    default: undefined,
  });

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

export const ensureLoraOnWeb = () => {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;

  const id = 'trobar-font-lora';
  if (document.getElementById(id)) return;

  const fontLink = document.createElement('link');
  fontLink.id = id;
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);
};
