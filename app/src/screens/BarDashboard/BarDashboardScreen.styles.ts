import { EDITORIAL } from '../../theme/editorialTheme';
import { StyleSheet, Platform } from 'react-native';
import { SKETCH_THEME, sketchShadow } from '../../theme/sketchTheme';

const GRANA = SKETCH_THEME.colors.bg;
const NAV_HEIGHT = 72;
const BOTTOM_SAFE = Platform.OS === 'web' ? 0 : 16;

export default StyleSheet.create({
    /* ── Layout ────────────────────────────────────────────────────────── */
    container: {
        flex: 1,
        backgroundColor: GRANA,
        paddingBottom: NAV_HEIGHT + BOTTOM_SAFE,
        ...Platform.select({
            web: {
                height: '100vh' as unknown as number,
                maxHeight: '100vh' as unknown as number,
                overflow: 'hidden' as const,
            },
        }),
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: GRANA,
        gap: 12,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 24,
    },

    /* ── Header ────────────────────────────────────────────────────────── */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: EDITORIAL.hairline,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontFamily: EDITORIAL.fontBold,
        fontSize: 22,
        color: EDITORIAL.ink,
        textAlign: 'center',
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: EDITORIAL.card,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ── Loading / empty ───────────────────────────────────────────────── */
    loadingText: { color: EDITORIAL.inkMuted, fontSize: 14, marginTop: 8 },
    emptyTitle: { color: EDITORIAL.ink, fontSize: 18, fontWeight: '700', marginTop: 16 },
    emptySubtitle: { color: EDITORIAL.inkMuted, fontSize: 14, textAlign: 'center', marginTop: 4, paddingHorizontal: 40 },

    /* ── Profile tab — section cards ───────────────────────────────────── */
    panelSubtitle: {
        color: EDITORIAL.inkMuted,
        fontSize: 14,
        marginBottom: 16,
        marginTop: 8,
        letterSpacing: 0,
        textTransform: 'uppercase',
    },
    sectionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 14,
        borderRadius: 8,
        marginBottom: 10,
        backgroundColor: EDITORIAL.card,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
    },
    sectionCardIcon: {
        width: 38,
        height: 38,
        borderRadius: 8,
        backgroundColor: EDITORIAL.card,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    sectionCardIconActive: {
        backgroundColor: EDITORIAL.granaSoft,
    },
    sectionCardInfo: {
        flex: 1,
    },
    sectionCardTitle: {
        color: EDITORIAL.ink,
        fontSize: 16,
        fontWeight: '600',
    },
    sectionCardSubtitle: {
        color: EDITORIAL.inkMuted,
        fontSize: 14,
        marginTop: 2,
    },
    sectionCardSubtitleActive: {
        color: EDITORIAL.inkMuted,
    },

    /* ── Toast ─────────────────────────────────────────────────────────── */
    toast: {
        position: 'absolute',
        top: 64,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        zIndex: 999,
        gap: 10,
        ...sketchShadow(),
    },
    toastSuccess: { backgroundColor: '#1f7a3a' },
    toastError: {
        backgroundColor: EDITORIAL.danger,
        ...Platform.select({
            web: {
                boxShadow: '0 4px 12px rgba(32,38,49,0.16)',
            } as any,
        }),
    },
    toastText:    { color: 'white', fontSize: 14, flex: 1 },

    /* ── Bottom sheet (edició seccions) ─────────────────────────────────── */
    sheetOverlay: {
        ...StyleSheet.absoluteFill,
        zIndex: 200,
    },
    sheetBackdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    sheetContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '80%',
        backgroundColor: EDITORIAL.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        ...sketchShadow(),
    },
    sheetDragBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: EDITORIAL.card,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 4,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: EDITORIAL.hairline,
    },
    sheetTitle: {
        color: EDITORIAL.ink,
        fontSize: 18,
        fontWeight: '700',
    },
    sheetCloseBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: EDITORIAL.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetBody: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    sheetFooter: {
        paddingHorizontal: 20,
        paddingBottom: 30,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: EDITORIAL.hairline,
    },

    /* ── Inputs ────────────────────────────────────────────────────────── */
    input: {
        backgroundColor: EDITORIAL.card,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: EDITORIAL.ink,
        fontSize: 16,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
    },
    textArea: {
        minHeight: 120,
        textAlignVertical: 'top',
    },

    /* ── Social rows ───────────────────────────────────────────────────── */
    socialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    socialIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: EDITORIAL.card,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    socialInputWrap: {
        flex: 1,
    },
    socialLabel: {
        color: EDITORIAL.inkMuted,
        fontSize: 12,
        marginBottom: 2,
    },
    socialInput: {
        backgroundColor: EDITORIAL.card,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: EDITORIAL.ink,
        fontSize: 14,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
    },
    socialClear: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
    },

    /* ── Chips (amenities) ─────────────────────────────────────────────── */
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        gap: 6,
    },
    chipActive: {
        backgroundColor: EDITORIAL.granaSoft,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
    },
    chipInactive: {
        backgroundColor: EDITORIAL.card,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '500',
    },

    /* ── Match rows ────────────────────────────────────────────────────── */
    matchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 8,
        marginBottom: 6,
        backgroundColor: EDITORIAL.card,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
    },
    matchRowActive: {
        backgroundColor: EDITORIAL.granaSoft,
        borderColor: EDITORIAL.hairline,
    },
    matchCheck: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: EDITORIAL.hairline,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    matchCheckActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    matchTeams: {
        flex: 1,
        color: EDITORIAL.ink,
        fontSize: 14,
    },
    matchDate: {
        color: EDITORIAL.inkMuted,
        fontSize: 12,
    },
    matchCrests: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    matchCrest: {
        width: 26,
        height: 26,
    },
    matchCompLogo: {
        width: 18,
        height: 18,
    },
    selectAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        alignSelf: 'flex-start',
        paddingVertical: 4,
    },
    selectAllText: {
        color: EDITORIAL.ink,
        fontSize: 14,
        fontWeight: '600',
    },
    matchGenderBadge: {
        backgroundColor: EDITORIAL.granaSoft,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
    },
    matchGenderBadgeText: {
        color: EDITORIAL.grana,
        fontSize: 12,
        fontWeight: '600',
    },
    genderFilterRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    genderFilterBtn: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: EDITORIAL.card,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
    },
    genderFilterBtnActive: {
        backgroundColor: EDITORIAL.granaSoft,
        borderColor: EDITORIAL.hairline,
    },
    genderFilterText: {
        color: EDITORIAL.inkMuted,
        fontSize: 14,
        fontWeight: '500',
    },
    genderFilterTextActive: {
        color: EDITORIAL.ink,
    },

    /* ── Save button ───────────────────────────────────────────────────── */
    saveButton: {
        backgroundColor: SKETCH_THEME.colors.primary,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
    },

    /* ── Map preview (mapa tab - full screen) ──────────────────────────── */
    mapPreviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(0,0,0,0.15)',
    },
    mapPreviewHeaderText: {
        color: EDITORIAL.inkMuted,
        fontSize: 14,
        fontStyle: 'italic',
    },
    mapFullContainer: {
        flex: 1,
        backgroundColor: '#202631',
        position: 'relative' as const,
        ...Platform.select({ web: { overflow: 'hidden' as const } }),
    },
    /* Overlay que cobreix tot el mapa */
    mapPinOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'flex-end',
        ...Platform.select({
            web: { pointerEvents: 'none' as unknown as undefined },
        }),
    },
    /* Columna: targeta + fletxa + pin. El pin queda al centre del viewport */
    mapPinColumn: {
        alignItems: 'center',
        marginBottom: '25%' as unknown as number,
        ...Platform.select({
            web: { pointerEvents: 'auto' as unknown as undefined },
        }),
    },
    /* Popup card */
    mapPopupCard: {
        width: 320,
        backgroundColor: SKETCH_THEME.colors.accent,
        borderRadius: 8,
        padding: 16,
        paddingTop: 18,
        paddingBottom: 14,
        ...sketchShadow(),
        ...Platform.select({
            web: {
                boxShadow: '0px 8px 24px rgba(0,0,0,0.35)' as unknown as undefined,
            },
        }),
    },
    mapPopupArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: SKETCH_THEME.colors.accent,
        marginBottom: 4,
    },
    mapPreviewOwnPin: { alignItems: 'center' },
    mapPreviewOwnPinHead: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    mapPreviewOwnPinTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#FFFFFF',
        marginTop: -1,
    },

    /* ── Settings tab ──────────────────────────────────────────────────── */
    settingSectionTitle: {
        color: EDITORIAL.inkMuted,
        fontSize: 12,
        letterSpacing: 0,
        textTransform: 'uppercase',
        marginTop: 20,
        marginBottom: 12,
    },
    planCard: {
        backgroundColor: EDITORIAL.card,
        borderRadius: 8,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.15)',
    },
    planName: {
        color: EDITORIAL.ink,
        fontSize: 18,
        fontWeight: '700',
    },
    planDetail: {
        color: EDITORIAL.inkMuted,
        fontSize: 14,
        lineHeight: 18,
    },
    /* Plan option cards */
    planOptionCard: {
        backgroundColor: EDITORIAL.card,
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: EDITORIAL.hairline,
    },
    planOptionCardActive: {
        borderColor: 'rgba(255,215,0,0.25)',
        backgroundColor: 'rgba(255,215,0,0.04)',
    },
    planCurrentBadge: {
        backgroundColor: 'rgba(255,215,0,0.15)',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    planCurrentBadgeText: {
        color: EDITORIAL.ink,
        fontSize: 12,
        fontWeight: '600',
    },
    planUpgradeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: SKETCH_THEME.colors.primary,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 14,
    },
    planUpgradeText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    planCancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: EDITORIAL.card,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 14,
    },
    planCancelText: {
        color: EDITORIAL.inkMuted,
        fontWeight: '500',
        fontSize: 14,
    },
    settingDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: EDITORIAL.card,
        marginVertical: 8,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: EDITORIAL.hairline,
    },
    settingRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingRowIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: EDITORIAL.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingRowText: {
        color: EDITORIAL.ink,
        fontSize: 16,
    },
    settingsFooter: {
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
        marginTop: 12,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 28,
        borderRadius: 8,
        backgroundColor: EDITORIAL.card,
        marginBottom: 12,
    },
    logoutText: {
        color: EDITORIAL.inkMuted,
        fontSize: 16,
        fontWeight: '500',
    },
    versionText: {
        color: EDITORIAL.inkMuted,
        fontSize: 12,
    },

    /* ── Bottom tab bar ────────────────────────────────────────────────── */
    bottomNav: {
        position: Platform.OS === 'web' ? 'fixed' as unknown as 'absolute' : 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: NAV_HEIGHT + BOTTOM_SAFE,
        paddingBottom: BOTTOM_SAFE,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: EDITORIAL.grana,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.2)',
        ...sketchShadow(),
        ...Platform.select({
            web: {
                zIndex: 100,
            },
        }),
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
    },
    navLabel: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 12,
        marginTop: 2,
        fontWeight: '500',
    },
    navLabelActive: {
        color: '#FFFFFF',
    },
});
