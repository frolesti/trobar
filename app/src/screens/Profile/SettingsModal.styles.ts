import { StyleSheet } from 'react-native';
import { EDITORIAL } from '../../theme/editorialTheme';

export default StyleSheet.create({
    /* ── Secció genèrica ── */
    section: {
        paddingTop: 32,
        paddingBottom: 16,
    },
    sectionTitle: {
        fontFamily: EDITORIAL.fontBold,
        color: '#FFFFFF',
        letterSpacing: 0,
        fontSize: 18,
        marginBottom: 14,
    },

    /* ── Fila de toggle / selector ── */
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    rowLast: {},
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    rowTextGroup: {
        flex: 1,
    },
    rowTitle: {
        fontFamily: EDITORIAL.fontBold,
        fontSize: 16,
        lineHeight: 22,
        color: '#FFFFFF',
    },
    rowSubtitle: {
        fontFamily: EDITORIAL.fontRegular,
        fontSize: 14,
        lineHeight: 20,
        color: '#F0CDD9',
        marginTop: 2,
    },

    /* ── Selector de pastilles (pill) ── */
    pillRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    pill: {
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 7,
        minHeight: 44,
        justifyContent: 'center',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        backgroundColor: 'transparent',
    },
    pillActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    pillText: {
        fontFamily: EDITORIAL.fontRegular,
        fontSize: 14,
        color: '#FFFFFF',
        letterSpacing: 0,
    },
    pillTextActive: {
        color: EDITORIAL.granaDeep,
        fontFamily: EDITORIAL.fontBold,
    },

    /* ── Enllaços legals ── */
    legalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        gap: 12,
    },
    legalText: {
        flexShrink: 1,
        fontFamily: EDITORIAL.fontRegular,
        fontSize: 16,
        color: '#FFFFFF',
    },

    accountSection: { paddingTop: 24, paddingBottom: 8 },
    logoutButton: { minHeight: 44, alignSelf: 'center', paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    logoutText: { color: '#FFFFFF', fontFamily: EDITORIAL.fontBold, fontSize: 16 },
    deleteButton: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 4 },
    deleteText: { color: '#FFD2D9', fontFamily: EDITORIAL.fontRegular, fontSize: 14, textDecorationLine: 'underline' },
    radiusControl: { paddingTop: 4, paddingBottom: 8 },
    radiusValue: { color: '#FFFFFF', fontFamily: EDITORIAL.fontBold, fontSize: 18, textAlign: 'right' },
    radiusSlider: { width: '100%', height: 48 },
    radiusLimits: { flexDirection: 'row', justifyContent: 'space-between' },
    footer: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)' },
    footerLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, rowGap: 0 },
    footerLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    footerText: { color: '#F0CDD9', fontFamily: EDITORIAL.fontRegular, fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' },
    versionText: {
        fontFamily: EDITORIAL.fontRegular,
        textAlign: 'center',
        fontSize: 12,
        color: '#F0CDD9',
        letterSpacing: 0,
        marginTop: 0,
        marginBottom: 0,
    },
});
