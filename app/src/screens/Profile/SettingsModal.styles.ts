import { StyleSheet, Platform } from 'react-native';
import { SKETCH_THEME, sketchShadow } from '../../theme/sketchTheme';

const S = SKETCH_THEME;

export default StyleSheet.create({
    /* ── Indicador d'arrossegament ── */
    dragIndicator: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: S.colors.border,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 6,
    },

    /* ── Capçalera ── */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: S.colors.border,
    },
    headerTitle: {
        ...S.typography.h3,
        fontSize: 20,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: S.colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ── Secció genèrica ── */
    section: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 8,
    },
    sectionTitle: {
        ...S.typography.caption,
        color: S.colors.accent,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 12,
    },

    /* ── Fila de toggle / selector ── */
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    rowLast: {
        // Reservat per si es necessita diferenciar la última fila
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    rowIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: S.colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    rowTextGroup: {
        flex: 1,
    },
    rowTitle: {
        ...S.typography.bodySmall,
        fontWeight: '600',
    },
    rowSubtitle: {
        ...S.typography.caption,
        marginTop: 1,
    },

    /* ── Selector de pastilles (pill) ── */
    pillRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 6,
        marginBottom: 4,
        flexWrap: 'wrap',
    },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: S.radius.pill,
        borderWidth: 1,
        borderColor: S.colors.border,
        backgroundColor: S.colors.card,
    },
    pillActive: {
        backgroundColor: S.colors.primary,
        borderColor: S.colors.primary,
    },
    pillText: {
        ...S.typography.caption,
        fontWeight: '600',
        color: S.colors.text,
    },
    pillTextActive: {
        color: 'white',
    },

    /* ── Separador ── */
    separator: {
        height: 1,
        backgroundColor: S.colors.border,
        marginHorizontal: 20,
    },

    /* ── Enllaços legals ── */
    legalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    legalText: {
        ...S.typography.body,
        fontWeight: '500',
    },

    /* ── Versió ── */
    versionText: {
        ...S.typography.caption,
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 30,
        opacity: 0.5,
    },
});
