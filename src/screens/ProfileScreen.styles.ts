import { StyleSheet, Platform } from 'react-native';
import { SKETCH_THEME, sketchShadow } from '../theme/sketchTheme';

export default StyleSheet.create({
  container: {
    ...SKETCH_THEME.layout.container,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SKETCH_THEME.spacing.lg,
    paddingVertical: SKETCH_THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SKETCH_THEME.colors.border,
    backgroundColor: SKETCH_THEME.colors.uiBg,
  },
  backButton: {
    padding: SKETCH_THEME.spacing.xs,
  },
  headerTitle: {
    ...SKETCH_THEME.typography.h3,
    fontSize: 20,
  },
  editButton: {
    padding: SKETCH_THEME.spacing.xs,
  },
  editButtonText: {
    ...SKETCH_THEME.typography.body,
    color: SKETCH_THEME.colors.primary,
    fontWeight: 'bold',
  },
  content: {
    padding: SKETCH_THEME.spacing.xl,
    alignItems: 'center',
  },
  avatarContainer: {
      position: 'relative',
      marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E1E1E1',
    borderWidth: 3,
    borderColor: SKETCH_THEME.colors.card,
  },
  changePhotoButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: SKETCH_THEME.colors.primary,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: SKETCH_THEME.colors.card,
  },
  helperText: {
      ...SKETCH_THEME.typography.caption,
      marginBottom: 20,
  },
  formContainer: {
      width: '100%',
      backgroundColor: SKETCH_THEME.colors.uiBg,
      borderRadius: SKETCH_THEME.radius.lg,
      padding: 24,
      borderWidth: 1,
      borderColor: SKETCH_THEME.colors.border,
      ...(sketchShadow() as object),
      marginBottom: 24
  },
  label: {
      ...SKETCH_THEME.typography.caption,
      color: SKETCH_THEME.colors.accent,
      textTransform: 'uppercase',
      marginBottom: 4,
      marginTop: 12,
      letterSpacing: 1,
  },
  value: {
      ...SKETCH_THEME.typography.body,
      paddingVertical: 4,
      fontWeight: '600',
  },
  input: {
      ...SKETCH_THEME.typography.body,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: SKETCH_THEME.colors.border,
      fontWeight: '600',
  },
  readOnly: {
      color: SKETCH_THEME.colors.textMuted,
  },
  divider: {
      height: 1,
      backgroundColor: SKETCH_THEME.colors.border,
      marginVertical: 20
  },
  sectionTitle: {
      ...SKETCH_THEME.typography.h3,
      marginBottom: 8,
  },
  logoutButton: {
    width: '100%',
    padding: 16,
    borderRadius: SKETCH_THEME.radius.md,
    backgroundColor: SKETCH_THEME.colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.25)',
    alignItems: 'center',
  },
  logoutText: {
    ...SKETCH_THEME.typography.body,
    color: SKETCH_THEME.colors.primary,
    fontWeight: '700',
  },
  cancelButton: {
      marginTop: 10,
      padding: 12,
      alignItems: 'center',
  },
  cancelText: {
      ...SKETCH_THEME.typography.bodySmall,
      color: SKETCH_THEME.colors.textMuted,
  },
  pickerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: SKETCH_THEME.colors.border,
  },
  picker: {
    width: '100%',
    ...Platform.select({
      android: {
         color: SKETCH_THEME.colors.text,
      }
    })
  }
});
