import { StyleSheet } from 'react-native';
import { SKETCH_THEME } from '../../theme/sketchTheme';

export default StyleSheet.create({
  container: {
    ...SKETCH_THEME.layout.container,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SKETCH_THEME.spacing.xl,
  },
  card: {
     backgroundColor: SKETCH_THEME.colors.card, // White card
     padding: SKETCH_THEME.spacing.xl,
     borderRadius: 12,
     width: '100%',
     maxWidth: 400,
     alignItems: 'center',
     // Sketchy border
     borderWidth: 2,
     borderColor: SKETCH_THEME.colors.text, 
  },
  title: {
      ...SKETCH_THEME.typography.h2,
      textAlign: 'center',
      marginBottom: SKETCH_THEME.spacing.md,
  },
  subtitle: {
      ...SKETCH_THEME.typography.body,
      textAlign: 'center',
      color: SKETCH_THEME.colors.textMuted,
      marginBottom: SKETCH_THEME.spacing.xl,
  },
  barName: {
      fontWeight: 'bold',
      color: SKETCH_THEME.colors.primary,
      fontSize: 20,
      marginVertical: 10,
      fontFamily: 'Lora'
  },
  confirmButton: {
      backgroundColor: SKETCH_THEME.colors.primary,
      paddingVertical: 15,
      paddingHorizontal: 30,
      borderRadius: 8,
      width: '100%',
      alignItems: 'center',
      marginBottom: 10,
      // Sketchy shadow
      borderWidth: 2,
      borderColor: SKETCH_THEME.colors.text,
  },
  confirmButtonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 16,
      fontFamily: 'Lora',
  },
  cancelButton: {
      padding: 15,
  },
  cancelButtonText: {
      color: SKETCH_THEME.colors.textMuted,
      textDecorationLine: 'underline',
      fontFamily: 'Lora',
  }
});
