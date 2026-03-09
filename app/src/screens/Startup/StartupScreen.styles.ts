import { StyleSheet, Dimensions, Platform } from 'react-native';
import { SKETCH_THEME } from '../../theme/sketchTheme';

const { width, height } = Dimensions.get('window');

export default StyleSheet.create({
  container: {
    ...SKETCH_THEME.layout.centerContent, 
    width: width,
    height: height,
    // Color de fons mantingut com a alternativa
    backgroundColor: SKETCH_THEME.colors.primary, 
  },
  logoContainer: {
    alignItems: 'center',
    // Empènyer contingut avall si cal, o mantenir centrat
    justifyContent: 'center',
    flex: 1, 
  },
  logoText: {
    ...SKETCH_THEME.typography.display,
    fontSize: 56, 
    letterSpacing: 2,
    // Posicionar text a baix o al centre? L'usuari volia el GIF sobre el text.
    // Si el GIF és de fons, el text se superposa. 
    // Afegim marge superior per separar del centre visual del GIF (assumint que el personatge és centrat)
    marginTop: 200, 
    color: '#FFFFFF',
    ...Platform.select({
      web: { textShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)' },
      default: { textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }
    }),
  },
  loader: {
    marginTop: SKETCH_THEME.spacing.lg,
  },
  copyright: {
    ...SKETCH_THEME.typography.caption,
    position: 'absolute',
    bottom: 30,
    color: 'rgba(255, 255, 255, 0.8)', 
  },
});
