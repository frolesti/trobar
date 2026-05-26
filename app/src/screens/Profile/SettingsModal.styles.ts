import { StyleSheet, Platform } from 'react-native';
import { EDITORIAL } from '../../theme/editorialTheme';

/**
 * Settings modal — paper editorial: paper bg, hairline borders, Lora typography,
 * grana eyebrow section titles, ink body, no blue.
 */
export default StyleSheet.create({
    /* ── Indicador d'arrossegament ── */
    dragIndicator: {
        width: 36,
        height: 3,
        borderRadius: 2,
        backgroundColor: EDITORIAL.hairlineStrong,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 6,
    },

    /* ── Capçalera ── */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 18,
        borderBottomWidth: 1,
        borderBottomColor: EDITORIAL.hairline,
    },
    headerTitle: {
        fontFamily: 'Lora_700Bold',
        fontSize: 22,
        color: EDITORIAL.ink,
        letterSpacing: -0.3,
    },
    closeButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ── Secció genèrica ── */
    section: {
        paddingHorizontal: 24,
        paddingTop: 22,
        paddingBottom: 8,
    },
    sectionTitle: {
        fontFamily: 'Lora_700Bold',
        color: EDITORIAL.grana,
        textTransform: 'uppercase',
        letterSpacing: 2.4,
        fontSize: 11,
        marginBottom: 14,
    },

    /* ── Fila de toggle / selector ── */
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    rowLast: {},
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    rowIcon: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    rowTextGroup: {
        flex: 1,
    },
    rowTitle: {
        fontFamily: 'Lora_700Bold',
        fontSize: 14,
        color: EDITORIAL.ink,
    },
    rowSubtitle: {
        fontFamily: 'Lora_400Regular',
        fontSize: 12,
        color: EDITORIAL.inkMuted,
        marginTop: 2,
    },

    /* ── Selector de pastilles (pill) ── */
    pillRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
        marginBottom: 4,
        flexWrap: 'wrap',
    },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
        backgroundColor: '#FFFFFF',
    },
    pillActive: {
        backgroundColor: EDITORIAL.grana,
        borderColor: EDITORIAL.grana,
    },
    pillText: {
        fontFamily: 'Lora_400Regular',
        fontSize: 12,
        color: EDITORIAL.ink,
        letterSpacing: 0.4,
    },
    pillTextActive: {
        color: '#FFFFFF',
        fontFamily: 'Lora_700Bold',
    },

    /* ── Separador ── */
    separator: {
        height: 1,
        backgroundColor: EDITORIAL.hairline,
        marginHorizontal: 24,
    },

    /* ── Enllaços legals ── */
    legalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    legalText: {
        fontFamily: 'Lora_400Regular',
        fontSize: 14,
        color: EDITORIAL.ink,
    },

    /* ── Versió ── */
    versionText: {
        fontFamily: 'Lora_400Regular',
        textAlign: 'center',
        fontSize: 11,
        color: EDITORIAL.inkMuted,
        letterSpacing: 0.5,
        marginTop: 20,
        marginBottom: 30,
    },
});
