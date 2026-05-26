import { StyleSheet, Dimensions } from 'react-native';
import { EDITORIAL, ED_TYPE } from '../../theme/editorialTheme';

const { width, height } = Dimensions.get('window');

export default StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EDITORIAL.grana,
    paddingHorizontal: 32,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  eyebrow: {
    ...ED_TYPE.eyebrow,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 14,
  },
  wordmark: {
    ...ED_TYPE.display,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  wordmarkItalic: {
    ...ED_TYPE.italic,
    color: '#FFFFFF',
  },
  copyright: {
    ...ED_TYPE.caption,
    color: 'rgba(255,255,255,0.55)',
    position: 'absolute',
    bottom: 32,
    letterSpacing: 1.2,
  },
});

