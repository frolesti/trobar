import { StyleSheet, Platform } from 'react-native';
import { SKETCH_THEME } from '../../theme/sketchTheme';

const INK = '#0F1B2D';
const INK_MUTED = '#5B6677';
const PAPER = '#FAF6EF';
const HAIRLINE = 'rgba(15,27,45,0.12)';
const GRANA = SKETCH_THEME.colors.bg; // #a50044

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
        fontFamily: 'Lora_400Regular',
        letterSpacing: 0.3,
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
        fontSize: 11,
        color: GRANA,
        fontFamily: 'Lora_700Bold',
        letterSpacing: 2.4,
        textTransform: 'uppercase',
        marginBottom: 14,
    },
    title: {
        fontSize: 32,
        lineHeight: 38,
        color: INK,
        fontFamily: 'Lora_700Bold',
        letterSpacing: -0.4,
    },
    titleItalic: {
        fontFamily: 'Lora_400Regular_Italic',
        fontWeight: '400',
        color: GRANA,
    },
    subtitle: {
        marginTop: 16,
        fontSize: 16,
        lineHeight: 24,
        color: INK_MUTED,
        fontFamily: 'Lora_400Regular',
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
        borderRadius: 4,
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
        fontFamily: 'Lora_700Bold',
        letterSpacing: 0.2,
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
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Lora_700Bold',
        letterSpacing: 0.2,
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
        fontSize: 11,
        color: INK_MUTED,
        fontFamily: 'Lora_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    emailLink: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    emailText: {
        color: GRANA,
        fontSize: 16,
        fontFamily: 'Lora_700Bold',
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
        fontFamily: 'Lora_700Bold',
        letterSpacing: 0.4,
        textAlign: 'center',
        textDecorationLine: 'underline',
    },
    errorContainer: {
        width: '100%',
        marginBottom: 14,
        paddingHorizontal: 2,
    },
    errorText: {
        color: SKETCH_THEME.colors.danger,
        fontSize: 13,
        lineHeight: 18,
        fontFamily: 'Lora_400Regular',
        textAlign: 'left',
    },
    formTitle: {
        fontSize: 28,
        color: INK,
        marginBottom: 20,
        fontFamily: 'Lora_700Bold',
        letterSpacing: -0.3,
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: HAIRLINE,
        borderRadius: 4,
        paddingVertical: 14,
        paddingHorizontal: 14,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        color: INK,
        fontFamily: 'Lora_400Regular',
    },
    inlineLink: {
        marginTop: 14,
        padding: 6,
    },
    inlineLinkText: {
        textAlign: 'center',
        color: INK_MUTED,
        fontFamily: 'Lora_400Regular',
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
        fontFamily: 'Lora_400Regular',
    },
    linkText: {
        fontSize: 12,
        color: GRANA,
        fontFamily: 'Lora_700Bold',
        textDecorationLine: 'underline',
    },
});
