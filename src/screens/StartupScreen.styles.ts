import { StyleSheet } from 'react-native';
import { SKETCH_THEME } from '../theme/sketchTheme';

export default StyleSheet.create({
  container: {
    ...SKETCH_THEME.layout.centerContent, // Layout comú
    backgroundColor: SKETCH_THEME.colors.bg,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    ...SKETCH_THEME.typography.display, // Tipografia estàndard
    // Override específic si cal
    fontSize: 56, 
    letterSpacing: 2,
    marginBottom: 20,
  },
  loader: {
    marginTop: SKETCH_THEME.spacing.lg,
  },
  copyright: {
    ...SKETCH_THEME.typography.caption,
    position: 'absolute',
    bottom: 30,
    color: SKETCH_THEME.colors.accent,
  },
});
