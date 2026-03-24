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
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontFamily: 'PermanentMarker',
        fontSize: 22,
        color: 'white',
        textAlign: 'center',
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ── Loading / empty ───────────────────────────────────────────────── */
    loadingText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 8 },
    emptyTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginTop: 16 },
    emptySubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginTop: 4, paddingHorizontal: 40 },

    /* ── Profile tab — section cards ───────────────────────────────────── */
    panelSubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        marginBottom: 16,
        marginTop: 8,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    sectionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 14,
        borderRadius: 14,
        marginBottom: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    sectionCardIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    sectionCardIconActive: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    sectionCardInfo: {
        flex: 1,
    },
    sectionCardTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    sectionCardSubtitle: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 13,
        marginTop: 2,
    },
    sectionCardSubtitleActive: {
        color: 'rgba(255,255,255,0.6)',
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
        borderRadius: 12,
        zIndex: 999,
        gap: 10,
        ...sketchShadow(),
    },
    toastSuccess: { backgroundColor: '#004d98' },
    toastError: {
        backgroundColor: '#3a0018',
        borderLeftWidth: 3,
        borderLeftColor: '#edbb00',
        ...Platform.select({
            web: {
                background: 'linear-gradient(135deg, #3a0018 0%, #1a000d 100%)' as unknown as string,
                boxShadow: '0px 6px 20px rgba(0,0,0,0.6), inset 0px 1px 0px rgba(237,187,0,0.1)' as unknown as string,
            },
        }),
    },
    toastText:    { color: 'white', fontSize: 14, flex: 1 },

    /* ── Bottom sheet (edició seccions) ─────────────────────────────────── */
    sheetOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
    },
    sheetBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    sheetContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '80%',
        backgroundColor: '#7a0033',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        ...sketchShadow(),
    },
    sheetDragBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
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
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    sheetTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    sheetCloseBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.08)',
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
        paddingBottom: Platform.OS === 'web' ? 20 : 30,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },

    /* ── Inputs ────────────────────────────────────────────────────────── */
    input: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: 'white',
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
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
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    socialInputWrap: {
        flex: 1,
    },
    socialLabel: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        marginBottom: 2,
    },
    socialInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: 'white',
        fontSize: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
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
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    chipInactive: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    chipText: {
        fontSize: 13,
        fontWeight: '500',
    },

    /* ── Match rows ────────────────────────────────────────────────────── */
    matchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        marginBottom: 6,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    matchRowActive: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderColor: 'rgba(255,255,255,0.2)',
    },
    matchCheck: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    matchCheckActive: {
        backgroundColor: '#edbb00',
        borderColor: '#edbb00',
    },
    matchTeams: {
        flex: 1,
        color: 'white',
        fontSize: 14,
    },
    matchDate: {
        color: 'rgba(255,255,255,0.45)',
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
        color: '#edbb00',
        fontSize: 13,
        fontWeight: '600',
    },
    matchGenderBadge: {
        backgroundColor: 'rgba(186,85,211,0.3)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(186,85,211,0.5)',
    },
    matchGenderBadgeText: {
        color: '#e0b0ff',
        fontSize: 10,
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
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    genderFilterBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderColor: 'rgba(255,255,255,0.3)',
    },
    genderFilterText: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 13,
        fontWeight: '500',
    },
    genderFilterTextActive: {
        color: 'white',
    },

    /* ── Save button ───────────────────────────────────────────────────── */
    saveButton: {
        backgroundColor: SKETCH_THEME.colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
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
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontStyle: 'italic',
    },
    mapFullContainer: {
        flex: 1,
        backgroundColor: '#1a1a2e',
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
        borderRadius: 18,
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
        backgroundColor: '#ffd700',
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
        borderTopColor: '#ffd700',
        marginTop: -1,
    },

    /* ── Settings tab ──────────────────────────────────────────────────── */
    settingSectionTitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 20,
        marginBottom: 12,
    },
    planCard: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.15)',
    },
    planName: {
        color: '#ffd700',
        fontSize: 18,
        fontWeight: '700',
    },
    planDetail: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        lineHeight: 18,
    },
    /* Plan option cards */
    planOptionCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
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
        color: '#ffd700',
        fontSize: 11,
        fontWeight: '600',
    },
    planUpgradeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: SKETCH_THEME.colors.primary,
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 14,
    },
    planUpgradeText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 15,
    },
    planCancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 14,
    },
    planCancelText: {
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
        fontSize: 14,
    },
    settingDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 8,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.06)',
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
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingRowText: {
        color: 'white',
        fontSize: 15,
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
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginBottom: 12,
    },
    logoutText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 15,
        fontWeight: '500',
    },
    versionText: {
        color: 'rgba(255,255,255,0.25)',
        fontSize: 11,
    },

    /* ── Bottom tab bar ────────────────────────────────────────────────── */
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: NAV_HEIGHT + BOTTOM_SAFE,
        paddingBottom: BOTTOM_SAFE,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: '#8a003a',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.1)',
        ...sketchShadow(),
        ...Platform.select({
            web: {
                position: 'fixed' as unknown as 'absolute',
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
        color: 'rgba(255,255,255,0.45)',
        fontSize: 10,
        marginTop: 2,
        fontWeight: '500',
    },
    navLabelActive: {
        color: 'white',
    },
});
