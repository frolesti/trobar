import { EDITORIAL } from '../../theme/editorialTheme';
import { StyleSheet, Platform } from 'react-native';

const INK = EDITORIAL.ink;
const INK_MUTED = EDITORIAL.onBackgroundMuted;
const PAPER = EDITORIAL.background;
const HAIRLINE = EDITORIAL.borderOnBackground;
const GRANA = EDITORIAL.onBackground;

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PAPER,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 36,
        paddingTop: Platform.OS === 'ios' ? 48 : 28,
        paddingBottom: 120,
    },
    panel: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: 440,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
    },
    closeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    closeText: {
        fontSize: 14,
        color: INK_MUTED,
        marginLeft: 6,
        fontFamily: EDITORIAL.fontRegular,
        letterSpacing: 0,
    },
    header: {
        alignItems: 'flex-start',
        marginBottom: 28,
    },
    logoImg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: HAIRLINE,
    },
    eyebrow: {
        fontSize: 12,
        color: GRANA,
        fontFamily: EDITORIAL.fontBold,
        letterSpacing: 0,
        textTransform: 'uppercase',
        marginBottom: 14,
    },
    title: {
        fontSize: 32,
        lineHeight: 38,
        color: EDITORIAL.onBackground,
        fontFamily: EDITORIAL.fontBold,
        letterSpacing: 0,
    },
    titleItalic: {
        fontFamily: EDITORIAL.fontItalic,
        fontWeight: '400',
        color: GRANA,
    },
    subtitle: {
        marginTop: 16,
        fontSize: 16,
        lineHeight: 24,
        color: INK_MUTED,
        fontFamily: EDITORIAL.fontRegular,
        maxWidth: 380,
    },
    hairline: {
        height: 1,
        backgroundColor: HAIRLINE,
        marginVertical: 24,
    },
    actions: {
        width: '100%',
    },
    button: {
        flexDirection: 'row',
        width: '100%',
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
    },
    buttonIcon: {
        marginRight: 12,
    },
    buttonText: {
        fontSize: 16,
        fontFamily: EDITORIAL.fontBold,
        letterSpacing: 0,
    },
    googleButton: {
        backgroundColor: '#FFFFFF',
        borderColor: INK,
    },
    appleButton: {
        backgroundColor: INK,
        borderColor: INK,
    },
    emailButton: {
        backgroundColor: GRANA,
        borderColor: GRANA,
    },
    secondaryButton: { backgroundColor: '#FFFFFF', borderColor: INK },
    darkButton: { backgroundColor: INK, borderColor: INK },
    primaryButton: { backgroundColor: GRANA, borderColor: GRANA },
    primaryButtonText: {
        color: EDITORIAL.background,
        fontSize: 16,
        fontFamily: EDITORIAL.fontBold,
        letterSpacing: 0,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 14,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: HAIRLINE,
    },
    dividerText: {
        marginHorizontal: 14,
        fontSize: 12,
        color: INK_MUTED,
        fontFamily: EDITORIAL.fontBold,
        textTransform: 'uppercase',
        letterSpacing: 0,
    },
    emailLink: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    emailText: {
        color: GRANA,
        fontSize: 16,
        fontFamily: EDITORIAL.fontBold,
    },
    emailLinkRow: {
        alignSelf: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        marginTop: 2,
    },
    emailLinkText: {
        fontSize: 14,
        color: GRANA,
        fontFamily: EDITORIAL.fontBold,
        letterSpacing: 0,
        textAlign: 'center',
        textDecorationLine: 'underline',
    },
    errorContainer: {
        width: '100%',
        marginBottom: 14,
        paddingHorizontal: 2,
    },
    errorText: {
        color: '#FFD2D9',
        fontSize: 14,
        lineHeight: 18,
        fontFamily: EDITORIAL.fontRegular,
        textAlign: 'left',
    },
    formTitle: {
        fontSize: 28,
        color: EDITORIAL.onBackground,
        marginBottom: 20,
        fontFamily: EDITORIAL.fontBold,
        letterSpacing: 0,
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: HAIRLINE,
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 14,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        color: INK,
        fontFamily: EDITORIAL.fontRegular,
    },
    inlineLink: {
        marginTop: 14,
        padding: 6,
    },
    inlineLinkText: {
        textAlign: 'center',
        color: INK_MUTED,
        fontFamily: EDITORIAL.fontRegular,
        fontSize: 14,
    },
    disclaimerFixed: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 36,
        paddingTop: 16,
        paddingBottom: 18,
        backgroundColor: PAPER,
        borderTopWidth: 1,
        borderTopColor: HAIRLINE,
    },
    disclaimerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignSelf: 'center',
        width: '100%',
        maxWidth: 440,
    },
    disclaimer: {
        fontSize: 12,
        color: INK_MUTED,
        textAlign: 'center',
        lineHeight: 18,
        fontFamily: EDITORIAL.fontRegular,
    },
    linkText: {
        fontSize: 12,
        color: GRANA,
        fontFamily: EDITORIAL.fontBold,
        textDecorationLine: 'underline',
    },
});
