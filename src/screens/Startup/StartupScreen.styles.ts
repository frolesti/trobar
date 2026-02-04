import { StyleSheet, Dimensions } from 'react-native';
import { SKETCH_THEME } from '../../theme/sketchTheme';

const { width, height } = Dimensions.get('window');

export default StyleSheet.create({
  container: {
    ...SKETCH_THEME.layout.centerContent, 
    width: width,
    height: height,
    // Background color kept as fallback/underlay
    backgroundColor: SKETCH_THEME.colors.primary, 
  },
  logoContainer: {
    alignItems: 'center',
    // Push content slightly down if needed, or keeping centered
    justifyContent: 'center',
    flex: 1, 
  },
  logoText: {
    ...SKETCH_THEME.typography.display,
    fontSize: 56, 
    letterSpacing: 2,
    // Position text at the bottom or middle? User wanted GIF above text.
    // If GIF is background, text overlays it. 
    // We add margin top to separate from the visual center of the GIF (assuming character is centered)
    marginTop: 200, 
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
