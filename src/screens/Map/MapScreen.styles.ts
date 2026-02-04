import { StyleSheet, Platform } from 'react-native';
import { SKETCH_THEME } from '../../theme/sketchTheme';

// Note: MapScreen was using a local definition of SKETCHY_COLORS which matches SKETCH_THEME.colors
// We are switching to the standard SKETCH_THEME.colors

export default StyleSheet.create({
    container: { flex: 1, backgroundColor: SKETCH_THEME.colors.bg },
    mapContainer: { flex: 1, width: '100%', height: '100%' },
    map: { width: '100%', height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: SKETCH_THEME.colors.primary },
    
    // Top Bar & Header
    topBarContainer: {
        position: 'absolute', top: 12, left: 0, right: 0,
        marginHorizontal: 'auto', paddingHorizontal: 12, zIndex: 10, maxWidth: 600, width: '100%'
    },
    desktopSidebar: {
        width: 400, backgroundColor: SKETCH_THEME.colors.bg, height: '100%', zIndex: 20,
        // @ts-ignore
        boxShadow: '4px 0px 0px rgba(0,0,0,0.05)', borderRightWidth: 2, borderRightColor: '#eee',
        display: 'flex', flexDirection: 'column'
    },
    desktopSidebarContent: { padding: 16, backgroundColor: SKETCH_THEME.colors.bg, zIndex: 2 },
    
    searchBar: {
        flexDirection: 'row', backgroundColor: SKETCH_THEME.colors.bg, borderRadius: 10, padding: 10, alignItems: 'center',
        borderWidth: 2, borderColor: SKETCH_THEME.colors.text,
        ...Platform.select({ web: { boxShadow: '4px 4px 0px rgba(0,0,0,0.1)' } }) // Hard shadow
    },
    searchIconPlaceholder: { width: 12, height: 12, backgroundColor: SKETCH_THEME.colors.text, marginRight: 10, borderRadius: 6 },
    searchInput: { flex: 1, fontSize: 16, color: SKETCH_THEME.colors.text, fontFamily: 'Lora' },
    avatarButton: {
        width: 44, height: 44, borderRadius: 22, marginLeft: 10, backgroundColor: SKETCH_THEME.colors.bg,
        justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: SKETCH_THEME.colors.text,
        ...Platform.select({ web: { boxShadow: '2px 2px 0px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },
    headerIconButton: {
        width: 44, height: 44, borderRadius: 22, marginLeft: 10, backgroundColor: SKETCH_THEME.colors.bg,
        justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: SKETCH_THEME.colors.text,
        ...Platform.select({ web: { boxShadow: '2px 2px 0px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },

    // Markers (Native)
    markerContainer: { alignItems: 'center', ...Platform.select({ web: { cursor: 'pointer' } }) },
    markerBubble: {
        backgroundColor: SKETCH_THEME.colors.bg, padding: 5, borderRadius: 8, borderWidth: 2, borderColor: SKETCH_THEME.colors.primary,
        ...Platform.select({ web: { boxShadow: '2px 2px 0px rgba(0,0,0,0.2)' } })
    },
    markerBubbleSelected: { backgroundColor: SKETCH_THEME.colors.primary, borderColor: SKETCH_THEME.colors.text, transform: [{ scale: 1.1 }], zIndex: 999 },
    markerText: { fontSize: 16, color: SKETCH_THEME.colors.text, fontFamily: 'Lora' },
    markerArrow: {
        width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid',
        borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
        borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: SKETCH_THEME.colors.primary, marginTop: -2
    },

    // Bottom Sheet
    bottomSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: SKETCH_THEME.colors.bg,
        borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30,
        borderWidth: 2, borderColor: '#eee', borderBottomWidth: 0,
        ...Platform.select({ web: { boxShadow: '0 -4px 10px rgba(0,0,0,0.05)' } }),
        zIndex: 20, minHeight: 120, maxWidth: 600, marginHorizontal: 'auto', alignSelf: 'center', width: '100%'
    },
    bottomSheetGrabArea: {
        width: '100%',
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -8,
        ...Platform.select({ web: { cursor: 'grab' } })
    },
    bottomSheetHandle: {
        width: 54, height: 6, backgroundColor: '#ccc', borderRadius: 3, alignSelf: 'center',
    },
    bottomSheetTitle: { fontSize: 18, fontWeight: '600', color: SKETCH_THEME.colors.text, fontFamily: 'Lora' },

    // Fab
    fabGps: {
        position: 'absolute', right: 16, bottom: 135, width: 44, height: 44, borderRadius: 22, 
        backgroundColor: SKETCH_THEME.colors.bg, borderWidth: 2, borderColor: SKETCH_THEME.colors.text,
        justifyContent: 'center', alignItems: 'center', zIndex: 15,
        ...Platform.select({ web: { boxShadow: '3px 3px 0px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },
    fabSettings: {
        position: 'absolute', right: 16, bottom: 190, width: 44, height: 44, borderRadius: 22, 
        backgroundColor: SKETCH_THEME.colors.bg, borderWidth: 2, borderColor: SKETCH_THEME.colors.text,
        justifyContent: 'center', alignItems: 'center', zIndex: 15,
        ...Platform.select({ web: { boxShadow: '3px 3px 0px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },

    // Web Styles
    radiusContainer: {
        backgroundColor: 'transparent', padding: 0, marginTop: 4
    },
    radiusLabel: { fontSize: 14, fontWeight: 'bold', color: SKETCH_THEME.colors.text, marginBottom: 0, fontFamily: 'Lora' },
    
    webProfileFilter: {
        backgroundColor: 'transparent', padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 2, borderColor: SKETCH_THEME.colors.text, borderStyle: 'dashed', marginTop: 8,
        ...Platform.select({ web: { cursor: 'pointer' } })
    },
    webProfileFilterLabel: { fontSize: 12, color: SKETCH_THEME.colors.text, fontWeight: 'bold', fontFamily: 'Lora' },
    webProfileFilterValue: { fontSize: 14, color: SKETCH_THEME.colors.primary, fontWeight:'bold', fontFamily: 'Lora' },
    webGuestFilterButton: {
        backgroundColor: SKETCH_THEME.colors.bg, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
        borderWidth: 2, borderColor: SKETCH_THEME.colors.text, 
        ...Platform.select({ web: { boxShadow: '2px 2px 0px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },
    webGuestFilterPanel: {
        backgroundColor: SKETCH_THEME.colors.bg, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: SKETCH_THEME.colors.text,
        ...Platform.select({ web: { boxShadow: '4px 4px 0px rgba(0,0,0,0.05)' } })
    },
    webSelectContainer: { 
        backgroundColor: SKETCH_THEME.colors.bg, 
        borderRadius: 10, 
        borderWidth: 2, 
        borderColor: SKETCH_THEME.colors.text, 
        height: 48, 
        justifyContent: 'center', 
        paddingHorizontal: 12, 
        marginBottom: 8,
        ...Platform.select({ web: { boxShadow: '3px 3px 0px rgba(0,0,0,0.1)' } })
    },

    // Search settings overlay
    settingsOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        zIndex: 999,
    },
    settingsCard: {
        width: '100%',
        maxWidth: 520,
        backgroundColor: SKETCH_THEME.colors.bg,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: SKETCH_THEME.colors.text,
        padding: 16,
        ...Platform.select({ web: { boxShadow: '6px 6px 0px rgba(0,0,0,0.08)' } }),
    },
    settingsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    settingsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: SKETCH_THEME.colors.text,
        fontFamily: 'Lora',
    },
    settingsHint: {
        fontSize: 12,
        color: '#666',
        marginBottom: 12,
        fontFamily: 'Lora',
    },
    settingsLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: SKETCH_THEME.colors.text,
        marginTop: 12,
        marginBottom: 8,
        fontFamily: 'Lora',
    },
    settingsActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 20,
        gap: 10,
        flexWrap: 'wrap',
    },
    settingsActionSecondary: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: SKETCH_THEME.colors.text,
        backgroundColor: 'transparent',
        ...Platform.select({ web: { cursor: 'pointer' } })
    },
    settingsActionSecondaryText: {
        fontFamily: 'Lora',
        fontWeight: 'bold',
        color: SKETCH_THEME.colors.text,
    },
    settingsActionPrimary: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: SKETCH_THEME.colors.text,
        backgroundColor: SKETCH_THEME.colors.primary,
        ...Platform.select({ web: { cursor: 'pointer' } })
    },
    settingsActionPrimaryText: {
        fontFamily: 'Lora',
        fontWeight: 'bold',
        color: 'white',
    },

    // Detail
    detailContainer: { flex: 1 },
    detailHeader: { flexDirection: 'row', marginBottom: 16 },
    barImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12, backgroundColor: '#eee', borderWidth: 2, borderColor: SKETCH_THEME.colors.text },
    headerInfo: { flex: 1, justifyContent: 'space-around' },
    barName: { fontSize: 20, fontWeight: 'bold', color: SKETCH_THEME.colors.text, fontFamily: 'Lora' },
    ratingContainer: { flexDirection: 'row', alignItems: 'center' },
    ratingText: { fontWeight: 'bold', marginRight: 8, color: SKETCH_THEME.colors.text, fontFamily: 'Lora' },
    statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 12, overflow: 'hidden', fontFamily: 'Lora', borderWidth: 1, borderColor: '#ccc' },
    open: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
    closed: { backgroundColor: '#FFEBEE', color: '#C62828' },
    matchCard: { 
        backgroundColor: SKETCH_THEME.colors.uiBg, 
        padding: 16, 
        borderRadius: 12, 
        marginBottom: 16, 
        marginTop: 5,
        borderWidth: 2, 
        borderColor: SKETCH_THEME.colors.text,
        ...Platform.select({
            web: { boxShadow: '3px 3px 0px rgba(0,0,0,0.1)' },
            default: { shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }
        })
    },
    matchTitle: { fontSize: 14, color: SKETCH_THEME.colors.text, marginBottom: 8, fontFamily: 'Lora', fontWeight: 'bold' },
    matchTeams: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    teamText: { fontSize: 18, fontWeight: 'bold', width: '40%', textAlign: 'center', fontFamily: 'Lora', color: SKETCH_THEME.colors.text },
    vsText: { color: SKETCH_THEME.colors.primary, marginHorizontal: 10, fontFamily: 'Lora', fontWeight: 'bold' },
});
