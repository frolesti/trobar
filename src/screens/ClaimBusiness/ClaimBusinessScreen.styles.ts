import { StyleSheet, Platform } from 'react-native';
import { SKETCH_THEME, sketchShadow } from '../../theme/sketchTheme';

export default StyleSheet.create({
  container: {
    ...SKETCH_THEME.layout.container,
  },
  scrollContent: {
      padding: SKETCH_THEME.spacing.xl,
      paddingBottom: 40,
      alignItems: 'center', // Center content on web
  },
  header: {
      marginBottom: SKETCH_THEME.spacing.xl,
      marginTop: SKETCH_THEME.spacing.xl,
      width: '100%',
      maxWidth: 600,
  },
  headerTitle: {
      ...SKETCH_THEME.typography.h1,
      marginBottom: SKETCH_THEME.spacing.sm,
  },
  headerSubtitle: {
      ...SKETCH_THEME.typography.body,
      color: SKETCH_THEME.colors.textMuted,
  },
  formCard: {
      width: '100%',
      maxWidth: 600,
      backgroundColor: SKETCH_THEME.colors.uiBg,
      borderRadius: SKETCH_THEME.radius.lg,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: SKETCH_THEME.colors.border,
      ...(sketchShadow() as object),
  },
  sectionTitle: {
      ...SKETCH_THEME.typography.caption,
      fontWeight: 'bold',
      color: SKETCH_THEME.colors.accent,
      textTransform: 'uppercase',
      marginBottom: 12,
      marginTop: 8,
  },
  input: {
      ...SKETCH_THEME.typography.body,
      backgroundColor: SKETCH_THEME.colors.card,
      borderWidth: 1,
      borderColor: SKETCH_THEME.colors.border,
      borderRadius: SKETCH_THEME.radius.md,
      padding: 14,
      marginBottom: 16,
  },
  uploadButton: {
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(211, 47, 47, 0.45)',
      borderStyle: 'dashed',
      borderRadius: SKETCH_THEME.radius.md,
      alignItems: 'center',
      marginBottom: 24,
      backgroundColor: SKETCH_THEME.colors.primarySoft,
  },
  uploadRow: {
      ...SKETCH_THEME.layout.row,
      gap: 10,
  },
  uploadButtonText: {
      ...SKETCH_THEME.typography.body,
      color: SKETCH_THEME.colors.primary,
      fontWeight: '700',
  },
  submitButton: {
      backgroundColor: SKETCH_THEME.colors.primary,
      padding: 16,
      borderRadius: SKETCH_THEME.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      ...(sketchShadow() as object),
  },
  submitButtonText: {
      ...SKETCH_THEME.typography.body,
      fontWeight: '800',
      color: 'white',
  },
  cancelButton: {
      width: '100%',
      maxWidth: 600,
      padding: 16,
      alignItems: 'center',
      marginBottom: 20,
  },
  cancelButtonText: {
      ...SKETCH_THEME.typography.body,
      color: SKETCH_THEME.colors.textMuted,
  },
});
