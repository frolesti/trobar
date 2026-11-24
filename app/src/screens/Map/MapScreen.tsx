import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

import { View, Text, TextInput, TouchableOpacity, Platform, Image, Keyboard, ScrollView, Linking, useWindowDimensions, Animated, Easing, ActivityIndicator, Alert, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Location from 'expo-location';
import { Image as MapImage } from 'expo-image';

import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; // Icones vectorials

import { fetchBars, fetchBarsForMatch, fetchBarsInBounds, cacheBarPlaceData, subscribeToBarDetails, subscribeToBars } from '../../services/barService';

import { useAuth } from '../../context/AuthContext';
import { useScreenLoading } from '../../context/SplashContext';

import { useNavigation, useRoute, RouteProp, useFocusEffect, useIsFocused } from '@react-navigation/native';

import { Bar, BarAmenity } from '../../models/Bar';

import { RootStackParamList } from '../../navigation/AppNavigator';

import MapView, { Camera, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { sketchShadow, SKETCH_THEME } from '../../theme/sketchTheme';

import { CUSTOM_MAP_STYLE } from '../../theme/mapStyle';

import { executeRequest } from '../../api/core';
import { fetchWithTimeout } from '../../api/core';

import { fetchAllMatches, Match } from '../../services/matchService';
import { barShowsMatch, nextBroadcastMatchId } from '../../utils/matchBroadcast';

import { discoverUnregisteredBars, OSMBar, OSMSearchError } from '../../services/osmService';
import { openBarMaps } from '../../services/mapAppService';

import { getUserPreferences } from '../../services/userService';

import styles from './MapScreen.styles';

import MatchCardStack from '../../components/MatchCardStack';
import VerifiedBarBadge, { isVerifiedBar } from '../../components/VerifiedBarBadge';
import { showAlert, AlertBannerHost } from '../../components/AlertBanner';
import UserNotice from '../../components/UserNotice';
import MapDataAttribution from '../../components/MapDataAttribution';
import { EDITORIAL } from '../../theme/editorialTheme';
import { useClusters, ClusterablePoint } from '../../hooks/useClusters';

import BarCard from '../../components/BarCard';

import BarListItem from '../../components/BarListItem';

import BarProfileModal from '../../components/BarProfileModal';
import PremiumBarSheet from '../../components/PremiumBarSheet';


import { fetchBarPlaceDetails, PlaceDetails, isOpenNow } from '../../services/placesService';
import { discoverMapBars, searchMapLocations, MapSuggestion, isSameVenue, mergeDiscoveredBars } from '../../services/barDiscoveryService';
import { getBarReviewStats } from '../../services/reviewService';
import { getPremiumDemoReviewStats, enrichPremiumDemoBar, isPremiumDemoBar } from '../../data/premiumDemoProfiles';
import { BarReviewStats } from '../../models/Review';
import OwnerBottomNav from '../../components/OwnerBottomNav';
import { getOwnedBar } from '../../services/barOwnerService';
import { ownerDemoCopy } from '../../data/premiumDemoProfiles';
import { AMENITY_OPTIONS, AMENITY_CATEGORIES } from '../../data/amenities';
import { BarFilterKey, matchesBarFilters } from '../../utils/barFilters';
import { alternativeMapMatch, isWomenMatch, upcomingMapMatches } from '../../utils/mapMatches';
import { MapRegion, cameraForRegion, isValidMapRegion, mapBubbleLayout, mapMarkerSize } from '../../utils/mapSelection';
import { ReportBarContent } from '../ReportBar/ReportBarScreen';
import { useTutorial, useTutorialTarget } from '../../context/TutorialContext';
import { getMapIcon } from '../../utils/mapIcons';


// Funció utilitat per calcular distància en km (fórmula de Haversine)

const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {

  const R = 6371; // Radi de la Terra en km

  const dLat = deg2rad(lat2 - lat1);

  const dLon = deg2rad(lon2 - lon1);

  const a = 

    Math.sin(dLat/2) * Math.sin(dLat/2) +

    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 

    Math.sin(dLon/2) * Math.sin(dLon/2)

    ; 

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 

  const d = R * c; // Distància en km

  return d;

};

export function nearestTutorialBar(bars: Bar[], origin: { latitude: number; longitude: number }): Bar | null {
    let nearest: Bar | null = null;
    let distance = Infinity;
    for (const bar of bars) {
        if (bar.isTestData || !Number.isFinite(bar.latitude) || !Number.isFinite(bar.longitude)
            || Math.abs(bar.latitude) > 90 || Math.abs(bar.longitude) > 180) continue;
        const next = getDistanceFromLatLonInKm(origin.latitude, origin.longitude, bar.latitude, bar.longitude);
        if (next < distance) { nearest = bar; distance = next; }
    }
    return nearest;
}



const deg2rad = (deg: number) => {

  return deg * (Math.PI/180)

};



const decodePolyline = (encoded: string) => {

    let points = [];

    let index = 0, len = encoded.length;

    let lat = 0, lng = 0;

    while (index < len) {

        let b, shift = 0, result = 0;

        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);

        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1)); lat += dlat;

        shift = 0; result = 0;

        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);

        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1)); lng += dlng;

        points.push([lng / 1e5, lat / 1e5]);

    }

    return points;

};

const CAMP_NOU_FALLBACK = { latitude: 41.3809, longitude: 2.1228 };
const EMULATOR_DEFAULT_LOC = { latitude: 37.4219983, longitude: -122.084 };
const MAP_MAX_ZOOM = 18;

const ConfirmedBarMarker: React.FC<{
    bar: Bar;
    isPremium: boolean;
    isSelected: boolean;
    isOwned?: boolean;
    zoom: number;
    onPress: () => void;
}> = React.memo(({ bar, isPremium, isSelected, isOwned = false, zoom = 15, onPress }) => {
    const [tracking, setTracking] = useState(true);
    const [pinLoaded, setPinLoaded] = useState(false);
    const size = mapMarkerSize(zoom, isSelected);
    useEffect(() => {
        setTracking(true);
        const timer = setTimeout(() => setTracking(false), 350);
        return () => clearTimeout(timer);
    }, [size, isOwned, isSelected, pinLoaded]);
    return (
        <Marker
            coordinate={{ latitude: bar.latitude, longitude: bar.longitude }}
            anchor={{ x: 0.5, y: 1.0 }}
            centerOffset={Platform.OS === 'ios' ? { x: 0, y: -(size + (isOwned ? 26 : 0)) / 2 } : undefined}
            tracksViewChanges={tracking || !pinLoaded || isSelected}
            onPress={onPress}
            accessibilityLabel={isOwned ? `El teu bar: ${bar.name}` : bar.name}
            zIndex={isOwned ? 500 : isSelected ? 200 : isPremium ? 100 : 1}
        >
            <View style={[styles.markerContainer, { width: isOwned ? Math.max(90, size) : size, height: size + (isOwned ? 26 : 0) }]}>
                {isOwned && <View style={{ backgroundColor: EDITORIAL.grana, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 2, borderColor: EDITORIAL.matchday }}><Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: EDITORIAL.fontBold }}>El teu bar</Text></View>}
                <View collapsable={false} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                    {isVerifiedBar(bar)
                        ? <VerifiedBarBadge bar={bar} size={size} onLoad={() => setPinLoaded(true)} />
                        : <MapImage testID="confirmed-bar-pin" source={getMapIcon('registered')} contentFit="contain" transition={0} style={[styles.markerPin3d, { width: size, height: size }]} onDisplay={() => setPinLoaded(true)} />}
                </View>
            </View>
        </Marker>
    );
});

/** Marcador d'un bar trobat a Google Maps encara no confirmat. Mateix gate de càrrega que `ConfirmedBarMarker`. */
const ScannedBarMarker: React.FC<{
    osmBar: OSMBar;
    zoom?: number;
    isSelected?: boolean;
    onPress: () => void;
}> = React.memo(({ osmBar, zoom = 15, isSelected = false, onPress }) => {
    const [tracking, setTracking] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const size = mapMarkerSize(zoom, isSelected);
    useEffect(() => {
        setTracking(true);
        const timer = setTimeout(() => setTracking(false), 350);
        return () => clearTimeout(timer);
    }, [size, loaded]);
    return (
        <Marker
            coordinate={{ latitude: osmBar.lat, longitude: osmBar.lon }}
            anchor={{ x: 0.5, y: 1 }}
            centerOffset={Platform.OS === 'ios' ? { x: 0, y: -Math.max(44, size) / 2 } : undefined}
            tracksViewChanges={tracking || !loaded}
            stopPropagation
            onPress={event => { event.stopPropagation(); onPress(); }}
            zIndex={isSelected ? 200 : 1}
        >
            <View accessible accessibilityRole="button" accessibilityLabel={`Veure ${osmBar.name}`} style={{ width: Math.max(44, size), height: Math.max(44, size), alignItems: 'center', justifyContent: 'flex-end' }}>
                <MapImage testID="discovered-bar-pin" source={getMapIcon('discovered')} contentFit="contain" transition={0} style={{ width: size, height: size }} onDisplay={() => setLoaded(true)} />
            </View>
        </Marker>
    );
});

/**
 * Bombolla numèrica dels clústers. Els bars escanejats es mostren en gris;
 * els registats fan servir grana per diferenciar-los dels pins individuals.
 */
const ClusterMarker: React.FC<{
    coordinate: { latitude: number; longitude: number };
    count: number;
    size: number;
    muted: boolean;
    zIndex: number;
    onPress: () => void;
}> = React.memo(({ coordinate, count, size, muted, zIndex, onPress }) => {
    const label = count < 100 ? String(count) : `${Math.floor(count / 10) * 10}+`;
    return (
        <Marker
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={zIndex}
            tracksViewChanges={false}
            onPress={onPress}
        >
            <View style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: muted ? '#64748B' : EDITORIAL.grana,
                borderWidth: 2,
                borderColor: '#FFFFFF',
                opacity: muted ? 0.82 : 1,
                shadowColor: '#0F1B2D',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
                elevation: 5,
            }}>
                <Text style={{
                    color: '#FFFFFF',
                    fontFamily: 'Lora_700Bold',
                    fontSize: count < 10 ? 13 : count < 100 ? 12 : 11,
                    textShadowColor: 'rgba(0,0,0,0.45)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                }}>
                    {label}
                </Text>
            </View>
        </Marker>
    );
});

const isLikelyEmulatorDefaultLocation = (lat: number, lng: number) => {
    return Math.abs(lat - EMULATOR_DEFAULT_LOC.latitude) < 0.02 && Math.abs(lng - EMULATOR_DEFAULT_LOC.longitude) < 0.02;
};



// Auxiliar (compartida)

const getCleanBarName = (name: string) => {

    return name.replace(/\s\d+$/, '');

};



// -- Constants de posicionament de càmera i bafarada --

// En seleccionar un bar, desplacem la càmera perquè quedi espai per a la targeta sota el pin.

// La bafarada es posiciona dinàmicament perquè el triangle de dalt apunti al pin.

const MAP_REGION_DELTA   = 0.008;  // latitudeDelta de la regió animada

/** Converteix el radi de cerca (km) a latitudeDelta per a MapView natiu */
function radiusToLatDelta(km: number): number {
    // ~0.009 graus ≈ 1 km a latituds d'Espanya
    return km * 0.012;
}







const MapScreen = () => {

    const { user } = useAuth();

    const navigation = useNavigation<any>();

    const route = useRoute<RouteProp<RootStackParamList, 'Map'>>();

    const matchIdFromNav = route.params?.matchId ?? null;
    const refreshParam = route.params?.refresh;

    

    // Animacions per a efectes de popup



    // Ubicació REAL del dispositiu (GPS)

    const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

    // Punt central de la cerca (pot ser GPS o una adreça buscada)

    // Inicialitzar amb Barcelona per defecte per evitar pantalla de càrrega bloquejant

    const [centerLocation, setCenterLocation] = useState<{latitude: number, longitude: number} | null>({

        latitude: 41.3851, 

        longitude: 2.1734

    });



    const [selectedBar, setSelectedBar] = useState<Bar | null>(null);
    const [selectedDiscoveredBar, setSelectedDiscoveredBar] = useState<OSMBar | null>(null);
    const [isReporting, setIsReporting] = useState(false);
    const [ownerBar, setOwnerBar] = useState<Bar | null>(null);
    const ownerEntryHandledRef = useRef(false);
    const lastMarkerPressRef = useRef(0);

    const [showBarProfile, setShowBarProfile] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const searchInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

    // Suggeriments de geocodificació (Nominatim)
    const [geoSuggestions, setGeoSuggestions] = useState<MapSuggestion[]>([]);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchRequestRef = useRef(0);

    // Filtratge per viewport (el radi ja no s'utilitza)

    const [visibleBounds, setVisibleBounds] = useState<{ minLat: number, maxLat: number, minLng: number, maxLng: number } | null>(null);

    const [currentZoom, setCurrentZoom] = useState(14);
    const [scanMessage, setScanMessage] = useState<string | null>(null);
    useEffect(() => {
        if (!scanMessage) return;
        const timer = setTimeout(() => setScanMessage(null), 3500);
        return () => clearTimeout(timer);
    }, [scanMessage]);
    const lastRegionRef = useRef<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);



    // Dades del pròxim partit

    const [nextMatch, setNextMatch] = useState<Match | null>(null);

    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);

    // Partit seleccionat des de la pantalla de Partits (diferent de nextMatch)
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

    const [matchNotice, setMatchNotice] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedMatch?.id) {
            setMatchNotice(null);
            return;
        }
        setMatchNotice('Mostrant els locals que han confirmat aquest partit.');
        const timer = setTimeout(() => setMatchNotice(null), 2400);
        return () => clearTimeout(timer);
    }, [selectedMatch?.id]);

    const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);
    const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[] | null>(null);
    const routeRequestId = useRef(0);

    useEffect(() => {
        routeRequestId.current += 1;
        setRouteInfo(null);
        setRouteCoords(null);
        setSelectedBar(null);
        setSelectedDiscoveredBar(null);
        restoreMapViewport();
        setShowBarProfile(false);
    }, [selectedMatch?.id]);

    const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);

    const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);

    const [selectedBarReviewStats, setSelectedBarReviewStats] = useState<BarReviewStats>({ averageRating: 0, totalReviews: 0 });
    const selectedBarReviewRequestId = useRef(0);



    // Placeholder local si una imatge remota falla

    const [failedImages, setFailedImages] = useState<Record<string, true>>({});

    // Radi de cerca configurable des de preferències d'usuari (km)
    const [searchRadiusKm, setSearchRadiusKm] = useState(2);
    // Categoria preferida: 'all' | 'masculino' | 'femenino'
    const [defaultCategory, setDefaultCategory] = useState<string>('all');

    // Filtres actius (multi-filtre)
    const [activeFilters, setActiveFilters] = useState<Set<BarFilterKey>>(new Set());
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);

    // Dades

    const [bars, setBars] = useState<Bar[]>([]);
    // True un cop hem completat la PRIMERA càrrega de bars (per al splash global)
    const [initialBarsLoaded, setInitialBarsLoaded] = useState(false);

    const [mapReady, setMapReady] = useState(false);
    const [nativeMapRevision, setNativeMapRevision] = useState(0);
    const nativeMapRevisionRef = useRef(nativeMapRevision);
    nativeMapRevisionRef.current = nativeMapRevision;
    const [mapLoadFailed, setMapLoadFailed] = useState(false);
    useEffect(() => {
        if (mapReady) return;
        const timeout = setTimeout(() => {
            console.info('[MapScreen] Map did not report readiness', { platform: Platform.OS, nativeMapRevision });
            setMapLoadFailed(true);
        }, 8000);
        return () => clearTimeout(timeout);
    }, [mapReady, nativeMapRevision]);

    const [filteredBars, setFilteredBars] = useState<Bar[]>([]);

    // El mapa ha de romandre muntat per rebre els bounds i l'estat de renderitzat.
    // Per això aquesta càrrega es gestiona localment i no bloqueja l'splash global.
    useScreenLoading('MapScreen', false);

    

    // OSM / Escaneig

    const [scannedBars, setScannedBars] = useState<OSMBar[]>([]);
    const [discoveredGoogleDetails, setDiscoveredGoogleDetails] = useState(false);

    const [isScanning, setIsScanning] = useState(false);

    // Bars escanejats filtrats per amenitats actives (dinàmic)
    const filteredScannedBars = useMemo(() => {
        return scannedBars.filter(bar => matchesBarFilters(bar, activeFilters, (selectedMatch || nextMatch)?.id));
    }, [scannedBars, activeFilters, selectedMatch, nextMatch]);



    // ---- Clustering -------------------------------------------------------
    // Mantenim dos datasets SEPARATS perquè supercluster NO barregi
    // bars registrats (grana) amb bars escanejats (gris). Si caiguessin al
    // mateix clúster perdríem la senyal visual important: "aquí hi ha
    // contingut Trobar contrastat" vs "aquí només hi ha possibles bars".
    type ClusterBar =
        | { kind: 'confirmed'; bar: Bar }
        | { kind: 'scanned'; bar: OSMBar };

    const clusterPointsConfirmed = useMemo<ClusterablePoint<ClusterBar>[]>(() => {
        return filteredBars.filter(bar => bar.id !== ownerBar?.id).map((b) => ({
            id: `c-${b.id}`,
            latitude: b.latitude,
            longitude: b.longitude,
            data: { kind: 'confirmed' as const, bar: b },
        }));
    }, [filteredBars, ownerBar?.id]);

    const clusterPointsScanned = useMemo<ClusterablePoint<ClusterBar>[]>(() => {
        return filteredScannedBars.map((b) => ({
            id: `s-${b.id}`,
            latitude: b.lat,
            longitude: b.lon,
            data: { kind: 'scanned' as const, bar: b },
        }));
    }, [filteredScannedBars]);

    const clustersConfirmed = useClusters<ClusterBar>({
        points: clusterPointsConfirmed,
        bounds: visibleBounds,
        zoom: currentZoom,
        radius: 60,
        maxZoom: 16,
        minPoints: 3,
    });

    const clustersScanned = useClusters<ClusterBar>({
        points: clusterPointsScanned,
        bounds: visibleBounds,
        zoom: currentZoom,
        radius: 60,
        maxZoom: 16,
        minPoints: 3,
    });

    // Anotem cada feature amb el seu "kind" perquè el render pugui pintar
    // els clústers en color diferent (grana vs gris) sense ambigüitat.
    const clusters = useMemo(() => {
        const tagged: any[] = [];
        clustersConfirmed.forEach((f) => {
            tagged.push({ ...f, properties: { ...f.properties, clusterKind: 'confirmed' } });
        });
        clustersScanned.forEach((f) => {
            tagged.push({ ...f, properties: { ...f.properties, clusterKind: 'scanned' } });
        });
        return tagged;
    }, [clustersConfirmed, clustersScanned]);



    // Refs (Natiu)

    const mapRefNative = useRef<MapView | null>(null);
    const mapInteractedRef = useRef(false);
    const pendingInitialRegionRef = useRef<MapRegion | null>(null);
    const initialLocationAppliedRef = useRef(false);
    const [locationResolved, setLocationResolved] = useState(false);
    const searchRadiusRef = useRef(searchRadiusKm);
    searchRadiusRef.current = searchRadiusKm;

    

    const preSelectionRegionRef = useRef<MapRegion | null>(null);
    const preSelectionCameraRef = useRef<Camera | null>(null);
    const selectionCameraRequestRef = useRef(0);
    const anchorRequestRef = useRef(0);
    const positionedVenueRef = useRef<string | null>(null);
    const mapReadyRef = useRef(mapReady);
    mapReadyRef.current = mapReady;

    const handleMapGesture = useCallback(() => {
        mapInteractedRef.current = true;
        pendingInitialRegionRef.current = null;
        selectionCameraRequestRef.current++;
        preSelectionRegionRef.current = null;
        preSelectionCameraRef.current = null;
    }, []);

    const moveMapToRegion = useCallback(async (region: MapRegion, duration = 350) => {
        const request = ++selectionCameraRequestRef.current;
        const map = mapRefNative.current;
        if (!map) return;
        try {
            const camera = await map.getCamera();
            if (request !== selectionCameraRequestRef.current) return;
            map.animateCamera(cameraForRegion(camera, lastRegionRef.current ?? region, region), { duration });
        } catch (error) {
            if (request !== selectionCameraRequestRef.current) return;
            console.info('[MapScreen] Camera movement failed', error);
            showAlert({ tone: 'error', message: 'No hem pogut moure el mapa. Torna-ho a provar.' });
        }
    }, []);

    // Animació d'instruccions

    const bubbleScale = useRef(new Animated.Value(0)).current;

    const bubbleOpacity = useRef(new Animated.Value(0)).current;

    const [bubbleReady, setBubbleReady] = useState(false);

    // Posició en píxels del pin seleccionat, per ancorar la targeta del bar
    // just a sobre seu en lloc de deixar-la fixa a baix de la pantalla.
    const [barCardAnchorY, setBarCardAnchorY] = useState<number | null>(null);
    const [barCardAnchorX, setBarCardAnchorX] = useState<number | null>(null);
    const selectedVenueId = selectedBar ? `registered:${selectedBar.id}` : selectedDiscoveredBar ? `discovered:${selectedDiscoveredBar.id}` : null;
    const [venueMeasurement, setVenueMeasurement] = useState<{ id: string; height: number } | null>(null);
    const venueCardHeight = venueMeasurement?.id === selectedVenueId ? venueMeasurement?.height ?? 280 : 280;
    const [mobileHeaderHeight, setMobileHeaderHeight] = useState(0);
    const [searchBarHeight, setSearchBarHeight] = useState(54);
    const [desktopCardTop, setDesktopCardTop] = useState(280);



    // Responsiu

    const { width, height } = useWindowDimensions();

    const isDesktop = width > 768; // Punt de ruptura per a escriptori web
    const insets = useSafeAreaInsets();
    const androidStatusInset = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0;
    const safeTopInset = Math.max(insets.top, androidStatusInset);
    const safeBottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);
    const mobileHeaderTop = safeTopInset + 8;
    const mobileDropdownTop = mobileHeaderTop + searchBarHeight + 4;
    const mobileFabBottom = safeBottomInset + (user ? 88 : 16);
    const mapAttributionBottom = user ? 88 : 36;
    const selectedPinY = Math.min(
        height - safeBottomInset - (user ? 72 : 8) - 8,
        height - mapAttributionBottom - 48,
    );
    const mapControlsBottom = isDesktop ? 20 : mobileFabBottom;
    const mapControlsInline = !isDesktop && !!(selectedBar || selectedDiscoveredBar);
    const mapSearchBottom = mapControlsBottom + (mapControlsInline ? 0 : 56);
    const mapSearchRight = mapControlsInline ? 76 : 20;
    const mapNoticeBottom = mapControlsBottom;
    // Reserve the entire control column, including when notice text wraps.
    const mapNoticeRight = 20 + 48 + 12;
    const mapNoticeLeft = mapNoticeRight;
    const [transientAlertVisible, setTransientAlertVisible] = useState(false);
    const isFocused = useIsFocused();
    const { activeKind: tutorialKind } = useTutorial();
    type TutorialSnapshot = {
        region: MapRegion | null; camera: Camera | null; center: typeof centerLocation;
        filters: typeof activeFilters; match: typeof selectedMatch; scanned: OSMBar[]; query: string;
    };
    const tutorialSnapshot = useRef<TutorialSnapshot | null>(null);
    const tutorialBarRef = useRef<Bar | null>(null);
    const tutorialDiscoveryRequest = useRef(0);
    const [tutorialDiscovery, setTutorialDiscovery] = useState<'idle' | 'loading' | 'ready'>('idle');
    const [tutorialDiscoveredBar, setTutorialDiscoveredBar] = useState<OSMBar | null>(null);
    useEffect(() => {
        if (isFocused) return;
        setSearchFocused(false);
        searchInputRef.current?.blur();
    }, [isFocused]);
    const needsLiveReservations = activeFilters.has('hide_full') || activeFilters.has('online_reservations') || activeFilters.has('reservations');
    useEffect(() => {
        if (!isFocused || !needsLiveReservations) return;
        return subscribeToBars(setBars, error => {
            console.info('[MapScreen] Reservation filters subscription failed', error);
            setActiveFilters(previous => {
                const next = new Set(previous);
                next.delete('hide_full');
                next.delete('online_reservations');
                next.delete('reservations');
                return next;
            });
            showAlert({ tone: 'error', message: 'No hem pogut actualitzar les reserves. Hem desactivat aquests filtres; torna-ho a provar.' });
        });
    }, [isFocused, needsLiveReservations]);
    useEffect(() => {
        if (!selectedBar || !isFocused) return;
        return subscribeToBarDetails(selectedBar.id, updated => {
            setSelectedBar(updated);
            setBars(previous => updated
                ? previous.map(bar => bar.id === updated.id ? updated : bar)
                : previous.filter(bar => bar.id !== selectedBar.id));
        }, error => {
            console.info('[MapScreen] Bar details subscription failed', error);
            setSelectedBar(null);
            showAlert({ tone: 'error', message: 'No hem pogut actualitzar la fitxa del bar. Torna-la a obrir.' });
        });
    }, [selectedBar?.id, isFocused]);



    // Lògica del panell inferior arrossegable (animació)

    const bottomSheetHeight = useRef(new Animated.Value(120)).current; 

    const bottomSheetTranslateY = useRef(new Animated.Value(500)).current; // Comença ocult

    const lastHeight = useRef(120);

    // --- EFECTES ---

    // 0. Carregar radi de cerca i categoria des de preferències d'usuari
    useEffect(() => {
        if (!user) return;
        let active = true;
        (async () => {
            try {
                const prefs = await getUserPreferences(user.id);
                if (!active) return;
                // El model guarda en metres (500, 1000, 2000, 5000), OSM necessita km
                setSearchRadiusKm(prefs.display.searchRadius / 1000);
                if (prefs.display.defaultCategory) {
                    setDefaultCategory(prefs.display.defaultCategory);
                }
            } catch (e) {
                console.info('No s\'han pogut carregar les preferències de radi:', e);
            }
        })();
        return () => { active = false; };
    }, [user?.id]);

    // 0b. Quan canvia el radi de cerca, ajustar el zoom del mapa
    useEffect(() => {
        if (!centerLocation || mapInteractedRef.current) return;
        if (mapRefNative.current) {
            const delta = radiusToLatDelta(searchRadiusKm);
            mapRefNative.current.animateToRegion({
                latitude: centerLocation.latitude,
                longitude: centerLocation.longitude,
                latitudeDelta: delta,
                longitudeDelta: delta,
            }, 500);
        }
    }, [searchRadiusKm]);

    useEffect(() => {
        if (!mapReady || mapInteractedRef.current || !pendingInitialRegionRef.current) return;
        const region = pendingInitialRegionRef.current;
        pendingInitialRegionRef.current = null;
        mapRefNative.current?.animateToRegion(region, 0);
    }, [mapReady, locationResolved]);

    // 0c. Sembrar `visibleBounds` i `currentZoom` tan bon punt tinguem
    // ubicació + radi. Sense això, el primer render no té bounds, el hook
    // de clústers retorna [] i el mapa apareix BUIT fins que l'usuari hi
    // interactua i es dispara `onRegionChangeComplete`.
    useEffect(() => {
        if (!centerLocation || visibleBounds) return;
        console.log('[MapScreen] Setting visibleBounds from centerLocation');
        const delta = radiusToLatDelta(searchRadiusKm);
        setVisibleBounds({
            minLat: centerLocation.latitude - delta / 2,
            maxLat: centerLocation.latitude + delta / 2,
            minLng: centerLocation.longitude - delta / 2,
            maxLng: centerLocation.longitude + delta / 2,
        });
        setCurrentZoom(Math.log2(360 / delta));
    }, [centerLocation, searchRadiusKm, visibleBounds]);



    // 1. Localització GPS

    useEffect(() => {
        if (user?.role === 'bar_owner') { setLocationResolved(true); return; }
        let active = true;

        (async () => {
            const applyInitialRegion = (loc: { latitude: number; longitude: number }) => {
                if (!active || mapInteractedRef.current || initialLocationAppliedRef.current) return;
                initialLocationAppliedRef.current = true;
                console.log('[MapScreen GPS] applyInitialRegion called with:', loc);
                const delta = radiusToLatDelta(searchRadiusRef.current);
                setCenterLocation(loc);
                setVisibleBounds({
                    minLat: loc.latitude - delta / 2,
                    maxLat: loc.latitude + delta / 2,
                    minLng: loc.longitude - delta / 2,
                    maxLng: loc.longitude + delta / 2,
                });
                console.log('[MapScreen GPS] visibleBounds set, delta:', delta);
                setCurrentZoom(Math.log2(360 / delta));

                const region = {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    latitudeDelta: delta,
                    longitudeDelta: delta,
                };
                if (mapReadyRef.current && mapRefNative.current) mapRefNative.current.animateToRegion(region, 0);
                else pendingInitialRegionRef.current = region;
            };

            try {
                console.log('[MapScreen GPS] Requesting foreground permissions...');
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (!active) return;
                console.log('[MapScreen GPS] Permission status:', status);

                if (status !== 'granted') {
                    console.info('[MapScreen GPS] Permís de localització denegat, usant fallback Camp Nou');
                    showAlert({
                        tone: 'info',
                        eyebrow: 'Ubicacio no disponible',
                        message: 'Sense permisos de localització. Pots cercar locals al mapa.',
                        duration: 4500,
                    });
                    const fallback = CAMP_NOU_FALLBACK;
                    applyInitialRegion(fallback);
                    return;
                }

                console.log('[MapScreen GPS] Getting current position...');
                const location = await Location.getCurrentPositionAsync({});
                if (!active) return;
                console.log('[MapScreen GPS] Location obtained:', location.coords.latitude, location.coords.longitude);
                const rawLat = location.coords.latitude;
                const rawLng = location.coords.longitude;
                const useFallback = Platform.OS === 'android' && isLikelyEmulatorDefaultLocation(rawLat, rawLng);
                const resolved = useFallback ? CAMP_NOU_FALLBACK : { latitude: rawLat, longitude: rawLng };
                if (useFallback) {
                    console.info('[MapScreen GPS] Coordenada per defecte de l\'emulador detectada. Usem Camp Nou.');
                    showAlert({
                        tone: 'info',
                        eyebrow: 'GPS de simulador',
                        message: 'El simulador no te ubicacio real. Et situem al Camp Nou.',
                        duration: 4500,
                    });
                }
                setUserLocation({
                    ...location,
                    coords: {
                        ...location.coords,
                        latitude: resolved.latitude,
                        longitude: resolved.longitude,
                    },
                });
                applyInitialRegion(resolved);
            } catch (e) {
                if (!active) return;
                console.info('[MapScreen GPS] Error obtaining location. Using Camp Nou as fallback.', e);
                showAlert({
                    tone: 'info',
                    eyebrow: 'GPS no disponible',
                    message: 'No hem pogut obtenir la ubicació. Pots continuar cercant al mapa.',
                    duration: 5000,
                });
                applyInitialRegion(CAMP_NOU_FALLBACK);
            } finally {
                if (active) setLocationResolved(true);
            }

        })();

        return () => { active = false; };
    }, [user?.id, user?.role]);



    // 2. Carregar bars (filtrats per matchId si venim de la pantalla de partits)

    // Recarregar cada cop que la pantalla rep focus (p.ex. després de reportar un bar)

    const loadBars = useCallback(async () => {

        try {
            const firestoreBars = await fetchBars();
            setBars(previous => Array.from(new Map([...previous, ...firestoreBars].map(bar => [bar.id, bar])).values()));
        } catch (error) {
            console.info('[MapScreen] Error carregant bars:', error);
            showAlert({ tone: 'error', message: 'No hem pogut actualitzar els bars. Conservem els locals carregats.' });
        } finally {
            setInitialBarsLoaded(true);
        }

    }, []);

    // Recarregar bars quan tornem de ReportBar amb paràmetre refresh
    // (useFocusEffect no es dispara perquè ReportBar és un transparentModal)
    useEffect(() => {
        if (refreshParam) {
            loadBars();
        }
    }, [refreshParam]);

    // ---- Refresc per bbox amb debounce + cache ----------------------------
    // Quan canvia la zona visible, demanem només els bars dins d'aquest bbox
    // (limit 300) i els fusionem al pool. Així evitem que, en un dataset
    // gran, haguem de descarregar tota la col·lecció `bars`.
    // Cache simple per evitar refetches dins una zona ja consultada.
    const bboxCacheRef = useRef<Map<string, number>>(new Map()); // key → timestamp
    const bboxFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const BBOX_CACHE_TTL_MS = 60_000;

    useEffect(() => {
        if (!visibleBounds) return;
        // Debounce 400ms — esperem que l'usuari acabi de moure el mapa
        if (bboxFetchTimerRef.current) clearTimeout(bboxFetchTimerRef.current);
        bboxFetchTimerRef.current = setTimeout(async () => {
            const { minLat, maxLat, minLng, maxLng } = visibleBounds;
            const key = `${minLat.toFixed(5)},${maxLat.toFixed(5)},${minLng.toFixed(5)},${maxLng.toFixed(5)}`;
            const last = bboxCacheRef.current.get(key);
            if (last && Date.now() - last < BBOX_CACHE_TTL_MS) return; // ja és recent
            try {
                const extra = await fetchBarsInBounds(minLat, maxLat, minLng, maxLng, 300);
                if (bboxCacheRef.current.size >= 100) bboxCacheRef.current.clear();
                bboxCacheRef.current.set(key, Date.now());
                if (extra.length === 0) return;
                setBars((prev) => {
                    return Array.from(new Map([...prev, ...extra].map(bar => [bar.id, bar])).values());
                });
            } catch (error) {
                console.info('[MapScreen] Bounds refresh failed', error);
                showAlert({ tone: 'error', message: 'No hem pogut actualitzar aquesta zona. Torna-ho a provar.' });
            }
        }, 400);
        return () => {
            if (bboxFetchTimerRef.current) clearTimeout(bboxFetchTimerRef.current);
        };
    }, [visibleBounds]);

    function restoreMapViewport() {
        anchorRequestRef.current++;
        selectionCameraRequestRef.current++;
        const saved = preSelectionRegionRef.current;
        const camera = preSelectionCameraRef.current;
        preSelectionRegionRef.current = null;
        preSelectionCameraRef.current = null;
        if (saved) {
            lastRegionRef.current = saved;
            if (camera) mapRefNative.current?.animateCamera(camera, { duration: 350 });
            else mapRefNative.current?.animateToRegion(saved, 350);
        }
    }

    const beginBarSelection = useCallback(() => {
        mapInteractedRef.current = true;
        pendingInitialRegionRef.current = null;
        selectionCameraRequestRef.current++;
        if (!preSelectionRegionRef.current) {
            preSelectionRegionRef.current = { ...(lastRegionRef.current ?? {
                ...(centerLocation ?? CAMP_NOU_FALLBACK),
                latitudeDelta: radiusToLatDelta(searchRadiusKm),
                longitudeDelta: radiusToLatDelta(searchRadiusKm),
            }) };
        }
        anchorRequestRef.current++;
        setBarCardAnchorX(null);
        setBarCardAnchorY(null);
        lastMarkerPressRef.current = Date.now();
        searchRequestRef.current++;
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        setGeoSuggestions([]);
        routeRequestId.current++;
        setRouteInfo(null);
        setRouteCoords(null);
        setShowBarProfile(false);
    }, [centerLocation, searchRadiusKm]);

    const handleSelectBar = useCallback((bar: Bar) => {
        if (isReporting || selectedBar?.id === bar.id) return;
        beginBarSelection();
        setSelectedDiscoveredBar(null);
        setSelectedBar(bar);
    }, [isReporting, selectedBar?.id, beginBarSelection]);

    const focusOwnedBar = useCallback((bar: Bar) => {
        const region = { latitude: bar.latitude, longitude: bar.longitude, latitudeDelta: MAP_REGION_DELTA, longitudeDelta: MAP_REGION_DELTA };
        lastRegionRef.current = region;
        setCenterLocation({ latitude: bar.latitude, longitude: bar.longitude });
        setVisibleBounds({
            minLat: bar.latitude - MAP_REGION_DELTA / 2, maxLat: bar.latitude + MAP_REGION_DELTA / 2,
            minLng: bar.longitude - MAP_REGION_DELTA / 2, maxLng: bar.longitude + MAP_REGION_DELTA / 2,
        });
        setCurrentZoom(Math.log2(360 / MAP_REGION_DELTA));
        setSearchQuery('');
        setShowBarProfile(false);
        handleSelectBar(bar);
        mapRefNative.current?.animateToRegion(region, 450);
    }, [handleSelectBar]);

    useFocusEffect(useCallback(() => {
        ownerEntryHandledRef.current = false;
        if (user?.role !== 'bar_owner') { setOwnerBar(null); return; }
        let active = true;
        setOwnerBar(null);
        getOwnedBar(user.id).then(bar => {
            if (!active) return;
            if (!bar || !Number.isFinite(bar.latitude) || !Number.isFinite(bar.longitude) || Math.abs(bar.latitude) > 90 || Math.abs(bar.longitude) > 180) {
                showAlert({ tone: 'error', message: 'No hem pogut situar el teu bar. Pots cercar-lo o fer servir la teva ubicació.' });
                return;
            }
            setOwnerBar(ownerDemoCopy(bar));
        }).catch(error => {
            if (!active) return;
            console.info('[MapScreen] Owned bar unavailable', error);
            showAlert({ tone: 'error', message: 'No hem pogut carregar el teu bar. Torna a entrar al mapa per reintentar-ho.' });
        });
        return () => { active = false; ownerEntryHandledRef.current = true; };
    }, [user?.id, user?.role]));

    useEffect(() => {
        if (!ownerBar || !mapReady || ownerEntryHandledRef.current) return;
        ownerEntryHandledRef.current = true;
        focusOwnedBar(ownerBar);
    }, [ownerBar, mapReady, focusOwnedBar]);

    const navigateToReportBar = useCallback((osmBar: OSMBar) => {
        if (isReporting || selectedDiscoveredBar?.id === osmBar.id) return;
        beginBarSelection();
        setSelectedBar(null);
        setSelectedDiscoveredBar(osmBar);
    }, [isReporting, beginBarSelection, selectedDiscoveredBar?.id]);

    useFocusEffect(

        useCallback(() => {

            loadBars();
            // Recarregar preferències (categoria pot haver canviat a SettingsModal)
            if (user) {
                getUserPreferences(user.id).then(prefs => {
                    setSearchRadiusKm(prefs.display.searchRadius / 1000);
                    if (prefs.display.defaultCategory) {
                        setDefaultCategory(prefs.display.defaultCategory);
                    }
                }).catch(error => console.info('[MapScreen] Preferences refresh failed', error));
            }
            // Tancar desplegables en tornar a la pantalla
            setShowFiltersPanel(false);
            setGeoSuggestions([]);

        }, [loadBars, user?.id])

    );



    // 4. Lògica de filtratge (només viewport)

     useEffect(() => {

        if (!centerLocation) return; // Esperant ubicació

        const applyFilters = (list: Bar[]) => list.filter(bar => matchesBarFilters(bar, activeFilters, (selectedMatch || nextMatch)?.id));

        // Si hi ha un partit seleccionat (filtre overlay), pre-filtrar per bars que l'emeten
        const activeMatchId = selectedMatch?.id ?? null;
        const barsPool = activeMatchId
            ? bars.filter(bar => barShowsMatch(bar, activeMatchId, nextBroadcastMatchId(upcomingMatches)))
            : bars;



        // Filtrar per bounds visibles si disponibles, si no, mostrar tots dins un rang raonable

        if (visibleBounds) {

             const inView = barsPool.filter(bar => 

                bar.latitude >= visibleBounds.minLat && bar.latitude <= visibleBounds.maxLat &&

                bar.longitude >= visibleBounds.minLng && bar.longitude <= visibleBounds.maxLng

             );

             // Tots els bars al cluster — el clustering ja agrupa visualment
             // i el comptador del clúster es manté consistent entre zooms.
             setFilteredBars(applyFilters(inView));

        } else {

             // Alternativa: 20 km al voltant del centre si no hi ha bounds

             const nearbyBars = barsPool.filter(bar => 

                getDistanceFromLatLonInKm(centerLocation.latitude, centerLocation.longitude, bar.latitude, bar.longitude) <= 20

             );

             setFilteredBars(applyFilters(nearbyBars));

        }



    }, [centerLocation, visibleBounds, bars, selectedMatch, nextMatch, upcomingMatches, currentZoom, activeFilters]);



    // 5. Netejar scannedBars quan es recarreguen els bars (eliminar els ja registrats)

    useEffect(() => {

        if (bars.length === 0 || scannedBars.length === 0) return;

        const cleaned = scannedBars.filter(osmItem => {

            return !bars.some(bar => isSameVenue(osmItem, bar));

        });

        if (cleaned.length !== scannedBars.length) {

            setScannedBars(cleaned);

        }

    }, [bars]);



    // Lògica de notificació per a bars escanejats

    const [showScanTip, setShowScanTip] = useState(false);

    useEffect(() => {

        if (isScanning) {

            setShowScanTip(true);

        } else if (scannedBars.length > 0) {

            // Continuar mostrant 4 segons després de finalitzar l'escaneig

            const timer = setTimeout(() => setShowScanTip(false), 4000);

            return () => clearTimeout(timer);

        } else {

            setShowScanTip(false);

        }

    }, [isScanning, scannedBars.length]);





    // Listener de canvi de radi per a bars escanejats

    // Si l'usuari ha escanejat bars i augmenta O REDUEIX el radi, buscar/filtrar automàticament?

    // User requested: "si hem clicat a buscar bars, i ampliem el radi de cerca, també han d'aparèixer els bars amb aquesta ampliació"

    // AND "hi ha algun problemet quan el fem més petit" (fer-lo més petit -> probablement hauria de filtrar estrictament per la vista?)

    

    useEffect(() => {

        /*

        if (scannedBars.length === 0 || !centerLocation) return;

        

        const timer = setTimeout(() => {

            // console.log('[Map] Radius changed with active scan. Fetching more...');

            

            // Si reduïm el radi significativament, potser hauríem de filtrar els que són LLUNY 

            // de la vista ACTUAL per evitar confusió?

            // "si fem el radi més gran o més petit, també ha de retornar els bars que toqui, ja sigui més o menys."

            // IMPLICA: Si més petit, mostrar MENYS.

            

            // Pas 1: Filtrar bars escanejats existents pel nou radi (netejar visualment)

            // Permetre cert marge (p.ex. 1.2x radi) perquè petits desplaçaments no ho amaguin tot? 

            // O mantenir un radi estricte? S'ajusta millor a la intenció de l'usuari.

            

            setScannedBars(prev => prev.filter(b => {

                const dist = getDistanceFromLatLonInKm(centerLocation.latitude, centerLocation.longitude, b.lat, b.lon);

                return dist <= radiusKm;

            }));



            // Pas 2: Buscar-ne de nous (per si la cache en té de *més propers*? Improbable però bé per consistència)

            handleManualScan(); 

        }, 800); // 800 ms de debounce

        */

        return () => {};

    }, []); // Eliminada la dependència de radiusKm







    // 6. Escaneig automàtic d'OSM ELIMINAT — Ara manual

    /* 

    useEffect(() => { ... } 

    */



    async function handleManualScan() {

        if (!centerLocation || isScanning) return;

        setIsScanning(true);
        setScanMessage('Buscant bars sense registrar…');

        try {

            // Usar els bounds visibles del mapa si estan disponibles, sinó radi

            const discovery = await discoverMapBars(
                centerLocation.latitude, centerLocation.longitude, searchRadiusKm,
                visibleBounds ? { south: visibleBounds.minLat, west: visibleBounds.minLng, north: visibleBounds.maxLat, east: visibleBounds.maxLng } : undefined,
            );
            const newScanned = discovery.bars.filter(item => !bars.some(bar => isSameVenue(item, bar)));
            setScanMessage(newScanned.length
                ? `${newScanned.length} ${newScanned.length === 1 ? 'local sense registrar' : 'locals sense registrar'}. Toca un pin per veure el local.`
                : 'No hem trobat locals nous en aquesta zona. Prova de moure el mapa.');
            setScannedBars(prev => mergeDiscoveredBars(prev, newScanned));



        } catch (e) {
            console.info('[MapScreen] Discovery failed', e);
            setScanMessage(e instanceof OSMSearchError && e.code === 'OSM_AREA_TOO_LARGE'
                    ? 'Apropa el mapa per cercar bars en una zona de menys de 10 km.'
                    : 'Cerca no disponible. Conservem els locals carregats. Torna-ho a provar.');

        } finally {

            setIsScanning(false);

        }

    };



    // Commutador: El botó crida aquesta funció

    const handleScanToggle = () => {

        if (scannedBars.length > 0) {

            setScannedBars([]); // Amagar/Netejar
            setScanMessage(null);

        } else {

            handleManualScan(); // Cercar

        }

    };

    const getAlternativeMatch = (current: Match | null) => {
        return alternativeMapMatch(upcomingMatches, current);
    };

    const toggleMatchCategory = () => {
        const alternative = getAlternativeMatch(selectedMatch || nextMatch);
        if (!alternative) {
            showAlert({ tone: 'info', message: 'Encara no hi ha partits programats de l’altra categoria.' });
            return;
        }
        setNextMatch(alternative);
        if (selectedMatch) setSelectedMatch(alternative);
    };

    // 3. Carregar partits per al bàner
    useEffect(() => {

        let isMounted = true;

        const loadMatches = async () => {

            try {

                const { matches } = await fetchAllMatches();

                if (isMounted) {
                    const upcoming = upcomingMapMatches(matches);

                    // Filtrar per categoria preferida
                    const catFiltered = upcoming.filter(m => {
                        if (defaultCategory === 'all') return true;
                        const isFem = isWomenMatch(m);
                        return defaultCategory === 'femenino' ? isFem : !isFem;
                    });

                    // nextMatch respecta la preferència de categoria
                    const preferredUpcoming = catFiltered.length > 0 ? catFiltered : upcoming;

                    if (preferredUpcoming.length > 0) {

                        setNextMatch(previous => preferredUpcoming.find(match => match.id === previous?.id) || preferredUpcoming[0]);

                        setUpcomingMatches(upcoming);

                    } else {

                        setNextMatch(null);

                        setUpcomingMatches([]);

                    }

                    // Si venim d'un partit específic, activar el filtre sempre
                    if (matchIdFromNav) {
                        const found = matches.find(m => m.id === matchIdFromNav);
                        if (found) {
                            setSelectedMatch(found);
                        }
                    }

                }

            } catch (e) {

                console.info("Failed to load matches for map banner", e);

            }

        };

        loadMatches();

        return () => { isMounted = false; };

    }, [matchIdFromNav, defaultCategory]);



    // 4. Actualitzar visuals del mapa i animació

    useEffect(() => {

        // Animació: Amagar panell inferior si 0 bars, lliscar amunt/rebot si > 0

        if (!isDesktop) {

            if (filteredBars.length > 0) {

                Animated.spring(bottomSheetTranslateY, {

                    toValue: 0,

                    useNativeDriver: true,

                    friction: 5,

                    tension: 20

                }).start();

            } else {

                Animated.timing(bottomSheetTranslateY, {

                    toValue: 500, // Amagar cap avall

                    duration: 300,

                    useNativeDriver: true,

                }).start();

            }

        }

    }, [filteredBars, isDesktop, bottomSheetTranslateY]); // Dependències afegides correctament

    // Calcula la posició en píxels del pin seleccionat (via l'API nativa del
    // mapa) perquè la targeta del bar pugui ancorar-se just a sobre seu.
    const selectedLocation = useMemo(() => selectedBar
        ? { latitude: selectedBar.latitude, longitude: selectedBar.longitude }
        : selectedDiscoveredBar ? { latitude: selectedDiscoveredBar.lat, longitude: selectedDiscoveredBar.lon } : null,
    [selectedBar?.id, selectedBar?.latitude, selectedBar?.longitude,
        selectedDiscoveredBar?.id, selectedDiscoveredBar?.lat, selectedDiscoveredBar?.lon]);
    const updateBarCardAnchor = useCallback(async () => {
        const request = ++anchorRequestRef.current;
        if (!selectedLocation || !mapRefNative.current?.pointForCoordinate) {
            setBarCardAnchorY(null);
            setBarCardAnchorX(null);
            return;
        }
        try {
            const point = await mapRefNative.current.pointForCoordinate(selectedLocation);
            if (request !== anchorRequestRef.current) return;
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('Invalid map projection');
            setBarCardAnchorY(point.y);
            setBarCardAnchorX(point.x);
        } catch (error) {
            if (request !== anchorRequestRef.current) return;
            console.info('[MapScreen] No es pot ancorar la fitxa al pin', error);
            setBarCardAnchorY(null);
            setBarCardAnchorX(null);
            setSelectedBar(null);
            setSelectedDiscoveredBar(null);
            restoreMapViewport();
            showAlert({ tone: 'error', message: 'No hem pogut situar la fitxa del local. Torna a tocar el pin.' });
        }
    }, [selectedLocation]);

    useEffect(() => {
        if (!selectedLocation) {
            positionedVenueRef.current = null;
            anchorRequestRef.current++;
            setBarCardAnchorX(null);
            setBarCardAnchorY(null);
            return;
        }
        if (positionedVenueRef.current === selectedVenueId) {
            void updateBarCardAnchor();
            return;
        }
        const request = ++selectionCameraRequestRef.current;
        const positionVenue = async () => {
            try {
                const map = mapRefNative.current;
                if (!map) throw new Error('Map is not ready');
                if (!isDesktop) {
                    const camera: Camera = await map.getCamera();
                    if (request !== selectionCameraRequestRef.current) return;
                    if (!preSelectionCameraRef.current) preSelectionCameraRef.current = camera;
                    const point = await map.pointForCoordinate(selectedLocation);
                    const center = await map.coordinateForPoint({ x: point.x, y: point.y + height / 2 - selectedPinY });
                    if (request !== selectionCameraRequestRef.current) return;
                    if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) throw new Error('Invalid map center');
                    // Copy heading, pitch and zoom/altitude; region animations can reset MapKit's orientation.
                    map.animateCamera({ ...camera, center }, { duration: 350 });
                }
                positionedVenueRef.current = selectedVenueId;
                timer = setTimeout(() => { void updateBarCardAnchor(); }, 380);
            } catch (error) {
                if (request !== selectionCameraRequestRef.current) return;
                console.info('[MapScreen] No es pot posicionar el local', error);
                setSelectedBar(null);
                setSelectedDiscoveredBar(null);
                restoreMapViewport();
                showAlert({ tone: 'error', message: 'No hem pogut situar la fitxa del local. Torna a tocar el pin.' });
            }
        };
        let timer: ReturnType<typeof setTimeout> | undefined;
        void positionVenue();
        return () => { clearTimeout(timer); selectionCameraRequestRef.current++; anchorRequestRef.current++; };
    }, [selectedLocation, selectedVenueId, isDesktop, height, selectedPinY, updateBarCardAnchor]);





    // 5. Lògica del bar seleccionat (sincronitzat)

    useEffect(() => {

         // Reiniciar estat de la bafarada
         const reviewRequestId = ++selectedBarReviewRequestId.current;

         setBubbleReady(false);

         bubbleScale.setValue(0);

         bubbleOpacity.setValue(0);

         // La bafarada NO ha d'esperar el placeDetails per aparèixer:
         // l'usuari ha clicat un bar registrat i espera resposta immediata.
         // El contingut detallat (fotos, horaris) s'omple a posteriori.
         if (selectedBar) {
             // Petit delay per deixar començar l'animació de càmera abans de pintar.
             setTimeout(() => setBubbleReady(true), 50);
         }


         // Animació del BottomSheet
         if (selectedBar) {

                const target = Math.min(Math.max(380, height * 0.58), height * 0.78);

                Animated.timing(bottomSheetHeight, {

                    toValue: target,

                    duration: 300,

                    useNativeDriver: false

                }).start();

                lastHeight.current = target;
         } else {
                const hasResults = filteredBars.length > 0;

                const target = hasResults ? Math.max(160, height * 0.25) : 120;

                

                Animated.timing(bottomSheetHeight, {

                    toValue: target, 

                    duration: 300,

                    useNativeDriver: false

                }).start();

                lastHeight.current = target;
            }


         if (selectedBar) void fetchRoute(selectedBar);



         // Google Places Details: obtenir, després marcar la bafarada com a preparada

         if (selectedBar) {

             setPlaceDetails(null);

             setLoadingPlaceDetails(true);

             setSelectedBarReviewStats({ averageRating: 0, totalReviews: 0 });

             const demoStats = getPremiumDemoReviewStats(selectedBar);
             if (demoStats) {
                 setSelectedBarReviewStats(demoStats);
             } else {
                 getBarReviewStats(selectedBar.id)
                     .then(stats => {
                         if (reviewRequestId === selectedBarReviewRequestId.current) setSelectedBarReviewStats(stats);
                     })
                     .catch(error => console.info('[MapScreen] No es poden carregar les valoracions del bar', error));
             }

             if (selectedBar.isTestData || demoStats) {
                 setLoadingPlaceDetails(false);
                 return;
             }

             const cleanName = getCleanBarName(selectedBar.name);

             // Si ja tenim googlePlaceId → 1 sola crida (getPlaceDetails)
             // Si no → 2 crides (searchText + getPlaceDetails), però guardem el placeId per la pròxima
             fetchBarPlaceDetails(cleanName, selectedBar.latitude, selectedBar.longitude, selectedBar.googlePlaceId)

                 .then((details) => {
                     if (reviewRequestId !== selectedBarReviewRequestId.current) return;
                     setPlaceDetails(details);
                     // Cacheja placeId + períodes + amenitats a Firestore (0 crides API extra)
                     if (details && !tutorialKind && user?.id && (user.id === selectedBar.ownerId || user.role === 'admin')) {
                         void cacheBarPlaceData(selectedBar, details);
                     }
                 })

                 .catch(error => {
                     console.info('[MapScreen] No es poden carregar les dades de Google Maps', error);
                     if (reviewRequestId === selectedBarReviewRequestId.current) setPlaceDetails(null);
                 })

                 .finally(() => {

                     if (reviewRequestId === selectedBarReviewRequestId.current) setLoadingPlaceDetails(false);

                 });

         } else {

             setPlaceDetails(null);

         }



    }, [selectedBar, isDesktop, user?.id, user?.role, tutorialKind]);



    // 5b. Animar l'entrada de la bafarada quan el contingut estigui preparat

    useEffect(() => {

        if (!bubbleReady || !selectedBar) return;

        Animated.parallel([

            Animated.spring(bubbleScale, {

                toValue: 1,

                friction: 9,

                tension: 50,

                useNativeDriver: true,

            }),

            Animated.timing(bubbleOpacity, {

                toValue: 1,

                duration: 120,

                useNativeDriver: true,

            }),

        ]).start();

    }, [bubbleReady]);



    // 6. L'ubicació de l'usuari es mostra natiu via showsUserLocation={true} a MapView



    // --- AJUDANTS WEB ---

    const searchNominatim = useCallback(async (query: string) => {
        const request = ++searchRequestRef.current;
        if (query.length < 3) { setGeoSuggestions([]); return; }
        try {
            const result = await searchMapLocations(query, centerLocation?.latitude ?? 41.3851, centerLocation?.longitude ?? 2.1734);
            if (request !== searchRequestRef.current) return;
            setGeoSuggestions(result.suggestions);
            if (!result.suggestions.length) showAlert({ tone: 'info', message: 'No hem trobat coincidències. Prova el nom del local i el municipi.' });
        } catch (e) {
            console.info('[MapScreen] Search failed', e);
            if (request !== searchRequestRef.current) return;
            setGeoSuggestions([]);
            showAlert({ tone: 'error', message: 'Ara no podem cercar locals. Torna-ho a provar.' });
        }
    }, [centerLocation?.latitude, centerLocation?.longitude]);

    useEffect(() => () => {
        searchRequestRef.current++;
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    }, []);

    const handleSearchInput = useCallback((text: string) => {
        setSearchQuery(text);
        searchRequestRef.current++;
        setGeoSuggestions([]);
        setShowFiltersPanel(false); // Tancar filtres quan es busca
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => searchNominatim(text), 1000);
    }, [searchNominatim]);

    const selectGeoSuggestion = useCallback((s: MapSuggestion) => {
        handleMapGesture();
        setSearchFocused(false);
        searchInputRef.current?.blur();
        Keyboard.dismiss();
        searchRequestRef.current++;
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        const newLocation = { latitude: Number(s.lat), longitude: Number(s.lon) };
        setCenterLocation(newLocation);
        setSearchQuery(s.display_name.split(',').slice(0, 2).join(','));
        setGeoSuggestions([]);
        if (s.venue) {
            const registered = bars.find(bar => isSameVenue(s.venue!, bar));
            if (registered) {
                handleSelectBar(registered);
                return;
            } else {
                setScannedBars(previous => mergeDiscoveredBars(previous, [s.venue!]));
                navigateToReportBar(s.venue);
                return;
            }
        }
        if (mapRefNative.current) {
            void moveMapToRegion({
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 500);
        }
    }, [bars, navigateToReportBar, handleSelectBar, handleMapGesture, moveMapToRegion]);



    const fetchRoute = async (bar: Bar) => {

        const requestId = ++routeRequestId.current;
        if (!centerLocation || (bar.id === ownerBar?.id && !userLocation)) return;

        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

        if (!apiKey) return;



        await executeRequest(async () => {

            const response = await fetchWithTimeout('https://routes.googleapis.com/directions/v2:computeRoutes', {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json',

                    'X-Goog-Api-Key': apiKey,

                    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'

                },

                body: JSON.stringify({

                    origin: { location: { latLng: {

                        latitude: userLocation ? userLocation.coords.latitude : centerLocation.latitude,

                        longitude: userLocation ? userLocation.coords.longitude : centerLocation.longitude

                    } } },

                    destination: { location: { latLng: { latitude: bar.latitude, longitude: bar.longitude } } },

                    travelMode: 'WALK', units: 'METRIC',

                })

            }, 'routes.compute', 15000);

            const result = await response.json();
            if (requestId !== routeRequestId.current) return;

            if (result.routes && result.routes.length > 0) {

                const route = result.routes[0];

                // Calcular informació de ruta

                const durationSeconds = parseInt(route.duration.replace('s', ''));

                const durationText = durationSeconds > 3600 

                    ? `${Math.floor(durationSeconds/3600)} h ${Math.floor((durationSeconds%3600)/60)} min`

                    : `${Math.floor(durationSeconds/60)} min`;

                const distanceKm = ((route.distanceMeters ?? 0) / 1000).toFixed(1) + ' km';

                setRouteInfo({ distance: distanceKm, duration: durationText });

                // Descodificar la polil\u00ednia per dibuixar la ruta sobre el mapa
                try {
                    const encoded = route.polyline?.encodedPolyline;
                    if (encoded) {
                        const pts = decodePolyline(encoded);
                        setRouteCoords(pts.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
                    } else {
                        setRouteCoords(null);
                    }
                } catch {
                    setRouteCoords(null);
                }

            }

        }, 'fetchRoute');

    };



    // --- ACCIONS COMPARTIDES ---

    const centerMapToGPS = async () => {
         ownerEntryHandledRef.current = true;
         handleMapGesture();
         const request = selectionCameraRequestRef.current;
         searchRequestRef.current++;
         if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
         setSearchFocused(false);
         searchInputRef.current?.blur();
         Keyboard.dismiss();

         let target = userLocation ? {
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
         } : null;

         try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (request !== selectionCameraRequestRef.current) return;
            if (permission.status !== 'granted') {
                showAlert({ tone: 'info', message: 'Activa el permís d’ubicació per situar-te al mapa. El teu bar continua disponible.' });
                return;
            }
            const fresh = await Location.getCurrentPositionAsync({});
            if (request !== selectionCameraRequestRef.current) return;
            const freshLat = fresh.coords.latitude;
            const freshLng = fresh.coords.longitude;
            const useFallback = Platform.OS === 'android' && isLikelyEmulatorDefaultLocation(freshLat, freshLng);
            target = useFallback ? CAMP_NOU_FALLBACK : { latitude: freshLat, longitude: freshLng };
            setUserLocation({
                ...fresh,
                coords: {
                    ...fresh.coords,
                    latitude: target.latitude,
                    longitude: target.longitude,
                },
            });
         } catch (error) {
            if (request !== selectionCameraRequestRef.current) return;
            console.info('[MapScreen] Current location unavailable', error);
            showAlert({ tone: 'error', message: target ? 'No hem pogut actualitzar la ubicació. Mostrem l’última posició coneguda.' : 'No hem pogut obtenir la ubicació. Torna-ho a provar.' });
         }

         if (!target) return;
         if (request !== selectionCameraRequestRef.current) return;

         setCenterLocation(target);
         setSelectedBar(null);
         setSelectedDiscoveredBar(null);
         preSelectionRegionRef.current = null;
         anchorRequestRef.current++;
         setShowBarProfile(false);
         setSearchQuery('');
         setGeoSuggestions([]);

         mapRefNative.current?.animateCamera({ center: target, heading: 0, pitch: 0 }, { duration: 500 });

    };



     const openExternalMaps = (bar: Bar) => {
        void openBarMaps(bar).catch(() => showAlert({ tone: 'error', message: 'No s’ha pogut obrir l’aplicació de mapes. Torna-ho a provar.' }));
    };

    const closeBarBubble = () => {
        if (isReporting) return;
        searchRequestRef.current++;
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        routeRequestId.current += 1;
        setRouteInfo(null);
        setRouteCoords(null);

        setSelectedBar(null);
        setSelectedDiscoveredBar(null);
        setBarCardAnchorX(null);
        setBarCardAnchorY(null);
        setBubbleReady(false);
        setShowBarProfile(false);
        restoreMapViewport();
        // Tancar desplegables de cerca/filtres
        setShowFiltersPanel(false);
        setGeoSuggestions([]);
        setSearchFocused(false);
        searchInputRef.current?.blur();
        Keyboard.dismiss();

    };

    const handleMapPress = useCallback(() => {
        // react-native-maps iOS can bubble a marker tap to MapView.onPress.
        // Do not close the card that was just opened by that same tap.
        if (Date.now() - lastMarkerPressRef.current < 700) {
            return;
        }
        // Amb un toc explícit al mapa fora d'un bar: netegem selecció i ruta.
        closeBarBubble();
        setRouteInfo(null);
        setRouteCoords(null);
    }, [closeBarBubble]);

    const prepareMapTutorial = (target: string) => {
        if (!tutorialSnapshot.current) {
            const snapshot: TutorialSnapshot = {
                region: lastRegionRef.current, camera: null, center: centerLocation,
                filters: activeFilters, match: selectedMatch, scanned: scannedBars, query: searchQuery,
            };
            tutorialSnapshot.current = snapshot;
            const origin = userLocation?.coords ?? centerLocation ?? CAMP_NOU_FALLBACK;
            tutorialBarRef.current = nearestTutorialBar(bars, origin);
            void mapRefNative.current?.getCamera().then(camera => {
                if (tutorialSnapshot.current === snapshot) snapshot.camera = camera;
            }).catch(error => console.info('[Tutorial] Could not snapshot map camera', error));
        }
        handleMapGesture();
        searchRequestRef.current++;
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        Keyboard.dismiss();
        searchInputRef.current?.blur();
        setSearchFocused(false);
        setShowFiltersPanel(target === 'map-filters');
        setActiveFilters(new Set());
        setSelectedMatch(null);
        setSearchQuery('');
        setShowBarProfile(false);
        setSelectedDiscoveredBar(null);
        setSelectedBar(null);
        routeRequestId.current++;
        setRouteInfo(null);
        setRouteCoords(null);
        if (['map-bar', 'map-directions', 'map-premium'].includes(target)) {
            const bar = tutorialBarRef.current;
            if (bar) {
                if (selectedBar?.id !== bar.id) {
                    positionedVenueRef.current = null;
                    setBarCardAnchorX(null);
                    setBarCardAnchorY(null);
                    const region = { latitude: bar.latitude, longitude: bar.longitude, latitudeDelta: MAP_REGION_DELTA, longitudeDelta: MAP_REGION_DELTA };
                    lastRegionRef.current = region;
                    setCenterLocation({ latitude: bar.latitude, longitude: bar.longitude });
                    mapRefNative.current?.animateToRegion(region, 0);
                }
                setSelectedBar(bar);
            }
        }
        if (target === 'map-discovery') {
            const origin = tutorialBarRef.current ?? tutorialSnapshot.current.center ?? CAMP_NOU_FALLBACK;
            const region = { latitude: origin.latitude, longitude: origin.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 };
            lastRegionRef.current = region;
            setCenterLocation({ latitude: origin.latitude, longitude: origin.longitude });
            mapRefNative.current?.animateToRegion(region, 0);
            setVisibleBounds({ minLat: origin.latitude - 0.004, maxLat: origin.latitude + 0.004, minLng: origin.longitude - 0.004, maxLng: origin.longitude + 0.004 });
            if (tutorialDiscovery === 'idle') {
                const request = ++tutorialDiscoveryRequest.current;
                setTutorialDiscovery('loading');
                void discoverMapBars(origin.latitude, origin.longitude, 0.5, {
                    south: origin.latitude - 0.004, north: origin.latitude + 0.004,
                    west: origin.longitude - 0.004, east: origin.longitude + 0.004,
                }).then(result => {
                    if (request !== tutorialDiscoveryRequest.current) return;
                    const venues = result.bars.filter(item => !bars.some(bar => isSameVenue(item, bar)));
                    setScannedBars(previous => mergeDiscoveredBars(previous, venues));
                    setTutorialDiscoveredBar(venues[0] ?? null);
                }).catch(error => {
                    if (request !== tutorialDiscoveryRequest.current) return;
                    console.info('[Tutorial] Discovery unavailable', error);
                    showAlert({ tone: 'info', message: 'No hem pogut carregar locals sense confirmar. Pots tornar a cercar-los amb la lupa.' });
                }).finally(() => {
                    if (request === tutorialDiscoveryRequest.current) setTutorialDiscovery('ready');
                });
            }
        }
        if (target === 'map-report' && tutorialDiscoveredBar) {
            positionedVenueRef.current = null;
            setBarCardAnchorX(null);
            setBarCardAnchorY(null);
            setSelectedDiscoveredBar(tutorialDiscoveredBar);
        }
    };
    const mapTutorialReady = isFocused && mapReady && locationResolved && initialBarsLoaded && !isReporting;
    const canStartMapTutorial = mapTutorialReady && (tutorialKind !== null || (!searchFocused && !showFiltersPanel && !showBarProfile && !selectedBar && !selectedDiscoveredBar));
    const nearestBar = nearestTutorialBar(bars, userLocation?.coords ?? centerLocation ?? CAMP_NOU_FALLBACK);
    const searchTarget = useTutorialTarget('map-search', canStartMapTutorial, () => prepareMapTutorial('map-search'));
    const tutorialBarReady = mapTutorialReady && selectedBar?.id === tutorialBarRef.current?.id
        && !!selectedBar && venueMeasurement?.id === selectedVenueId && (isDesktop || barCardAnchorY != null);
    const filtersTarget = useTutorialTarget('map-filters', mapTutorialReady && showFiltersPanel, () => prepareMapTutorial('map-filters'));
    const barTarget = useTutorialTarget('map-bar', tutorialBarReady, () => prepareMapTutorial('map-bar'), !!nearestBar);
    const directionsTarget = useTutorialTarget('map-directions', tutorialBarReady, () => prepareMapTutorial('map-directions'), !!nearestBar);
    const premiumTarget = useTutorialTarget('map-premium', tutorialBarReady, () => prepareMapTutorial('map-premium'), nearestBar?.tier === 'premium');
    const matchesTarget = useTutorialTarget('map-matches', mapTutorialReady && !selectedBar && !selectedDiscoveredBar && !showFiltersPanel,
        () => prepareMapTutorial('map-matches'), !!(nextMatch || selectedMatch));
    const discoveryTarget = useTutorialTarget('map-discovery', mapTutorialReady && tutorialDiscovery === 'ready', () => prepareMapTutorial('map-discovery'));
    const reportTarget = useTutorialTarget('map-report', mapTutorialReady && tutorialDiscovery === 'ready'
        && (!tutorialDiscoveredBar || (selectedDiscoveredBar?.id === tutorialDiscoveredBar.id && venueMeasurement?.id === selectedVenueId && (isDesktop || barCardAnchorY != null))), () => prepareMapTutorial('map-report'));
    const accountTarget = useTutorialTarget('map-account', mapTutorialReady, () => prepareMapTutorial('map-account'));
    const mapTarget = useTutorialTarget('map-area', mapTutorialReady);

    useEffect(() => {
        if (tutorialKind) return;
        tutorialDiscoveryRequest.current++;
        const snapshot = tutorialSnapshot.current;
        if (!snapshot) return;
        tutorialSnapshot.current = null;
        tutorialBarRef.current = null;
        handleMapGesture();
        setSelectedBar(null);
        setSelectedDiscoveredBar(null);
        setShowBarProfile(false);
        setShowFiltersPanel(false);
        setActiveFilters(snapshot.filters);
        setSelectedMatch(snapshot.match);
        setScannedBars(snapshot.scanned);
        setSearchQuery(snapshot.query);
        setCenterLocation(snapshot.center);
        setTutorialDiscoveredBar(null);
        setTutorialDiscovery('idle');
        if (snapshot.region) {
            lastRegionRef.current = snapshot.region;
            if (snapshot.camera) mapRefNative.current?.animateCamera(snapshot.camera, { duration: 0 });
            else mapRefNative.current?.animateToRegion(snapshot.region, 0);
        }
    }, [tutorialKind, handleMapGesture]);
    useEffect(() => () => { tutorialDiscoveryRequest.current++; }, []);



    // --- RENDERITZATS ---



    const renderContentPanel = (insidePremiumSheet = false) => {
        if (selectedDiscoveredBar) {
            return <ReportBarContent key={selectedDiscoveredBar.id} osmBar={selectedDiscoveredBar} onClose={closeBarBubble} onBusyChange={setIsReporting}
                tutorialConfirmRef={reportTarget} readOnly={!!tutorialKind}
                attributionInMap onGoogleDetailsChange={setDiscoveredGoogleDetails} onRegistered={() => {
                closeBarBubble();
                void loadBars();
            }} />;
        }

         if (selectedBar) {
            const profileBar = enrichPremiumDemoBar(selectedBar);

            const distanceText = routeInfo 

                ? `${routeInfo.duration} caminant (${routeInfo.distance})`

                : `A ${getDistanceFromLatLonInKm(centerLocation!.latitude, centerLocation!.longitude, selectedBar.latitude, selectedBar.longitude).toFixed(1)} km`;



            return (

                <BarCard
                    tutorialNameRef={barTarget}
                    tutorialDirectionsRef={directionsTarget}

                    name={selectedBar.name}

                    address={selectedBar.address}

                    latitude={selectedBar.latitude}

                    longitude={selectedBar.longitude}

                    placeDetails={placeDetails}

                    gallery={profileBar.gallery}
                    demo={isPremiumDemoBar(selectedBar)}

                    loadingPlaceDetails={loadingPlaceDetails}

                    verified={true}

                    fallbackRating={selectedBar.rating}

                    fallbackIsOpen={isOpenNow(selectedBar.openingPeriods)}

                    distanceText={distanceText}

                    onClose={() => closeBarBubble()}

                    onNavigate={() => openExternalMaps(selectedBar)}

                    tier={selectedBar.tier || 'free'}
                    promotionalText={selectedBar.promotionalText}
                    reservationUrl={selectedBar.reservationUrl}
                    fullMatchIds={selectedBar.fullMatchIds}
                    matchId={(selectedMatch || nextMatch)?.id}

                    onProfileOpen={() => setShowBarProfile(true)}
                    profileHandleHidden={insidePremiumSheet}
                    dense={height < 700}

                    reviewAvgRating={selectedBarReviewStats.averageRating}

                    reviewCount={selectedBarReviewStats.totalReviews}

                />

            );

        }



        return (

            <View style={{flex: 1}}>

                <View style={{alignItems: 'center', marginBottom: 15, marginTop: 10}}>

                     <View style={{

                         backgroundColor: SKETCH_THEME.colors.text, 

                         paddingVertical: 6, paddingHorizontal: 16, 

                         borderRadius: 16, marginBottom: 8,

                         transform: [{ rotate: '-1deg' }] // Tocs sketchy

                     }}>

                        <Text style={{color: SKETCH_THEME.colors.bg, fontWeight: 'bold', fontSize: 13, fontFamily: 'Lora'}}>

                            {filteredBars.length} bars{activeFilters.size > 0 ? ' filtrats' : ' confirmats'} {scannedBars.length > 0 ? `(+${activeFilters.size > 0 ? filteredScannedBars.length : scannedBars.length} possibles)` : ''}

                        </Text>

                     </View>

                </View>

                

                <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 20}}>

                    {filteredBars.length === 0 ? (

                        <View style={{ alignItems: 'center', marginTop: 20 }}>

                            <Feather name="search" size={32} color={SKETCH_THEME.colors.text} style={{ opacity: 0.5 }} />

                            <Text style={{textAlign:'center', color: SKETCH_THEME.colors.textMuted, marginTop: 10, fontFamily: 'Lora'}}>

                                Cap bar trobat a la zona.

                            </Text>

                        </View>

                    ) : (

                        filteredBars.map((bar) => (

                            <BarListItem

                                key={bar.id}

                                bar={bar}

                                distanceKm={getDistanceFromLatLonInKm(centerLocation!.latitude, centerLocation!.longitude, bar.latitude, bar.longitude)}

                                onPress={() => handleSelectBar(bar)}

                                imageError={!!failedImages[bar.id]}

                                onImageError={() => setFailedImages((prev) => (prev[bar.id] ? prev : { ...prev, [bar.id]: true }))}

                            />

                        ))

                    )}

                </ScrollView>

            </View>

        );

    };

    // -- Funció per tancar tots els desplegables --
    const dismissDropdowns = useCallback(() => {
        setShowFiltersPanel(false);
        setGeoSuggestions([]);
    }, []);

    // -- Configuració de filtres (dinàmica des de amenities.ts) --
    const FILTER_OPTIONS = useMemo(() => {
        const opts: { key: BarFilterKey; label: string; icon: string; iconFamily?: 'feather' | 'mci'; category?: string }[] = [
            { key: 'open_now', label: 'Oberts ara', icon: 'clock', iconFamily: 'feather', category: 'availability' },
            { key: 'online_reservations', label: 'Amb reserva en línia', icon: 'calendar', iconFamily: 'feather', category: 'booking' },
            { key: 'hide_full', label: 'Amagar complets', icon: 'users', iconFamily: 'feather', category: 'availability' },
        ];
        // Totes les amenities agrupades
        AMENITY_OPTIONS.forEach(a => {
            opts.push({ key: a.key, label: a.label, icon: a.icon, iconFamily: a.iconFamily, category: a.key === 'reservations' ? 'booking' : a.category });
        });
        return opts;
    }, []);

    const toggleFilter = useCallback((key: BarFilterKey) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const renderFiltersPanel = () => {
        const grouped = [
            { key: 'availability', label: 'Disponibilitat' },
            { key: 'booking', label: 'Reserves' },
            ...AMENITY_CATEGORIES,
        ].map(cat => ({
            ...cat,
            items: FILTER_OPTIONS.filter(f => f.category === cat.key),
        })).filter(g => g.items.length > 0);

        const renderFilterRow = (f: typeof FILTER_OPTIONS[0]) => {
            const isActive = activeFilters.has(f.key);
            const isDisabled = f.key === 'hide_full' && !(selectedMatch || nextMatch);
            const IconComp = f.iconFamily === 'mci' ? MaterialCommunityIcons : Feather;
            return (
                <TouchableOpacity
                    key={f.key}
                    accessibilityRole="checkbox"
                    accessibilityLabel={f.label}
                    accessibilityState={{ checked: isActive, disabled: isDisabled }}
                    aria-checked={isActive}
                    disabled={isDisabled}
                    testID={`map-filter-${f.key}`}
                    style={[styles.filterChip, isActive && styles.filterChipActive, isDisabled && { opacity: 0.5 }]}
                    onPress={() => toggleFilter(f.key)}
                >
                    <View style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: isActive ? EDITORIAL.granaDeep : 'rgba(255,255,255,0.08)',
                        justifyContent: 'center', alignItems: 'center', marginRight: 10,
                    }}>
                        <IconComp name={f.icon as any} size={16} color={isActive ? EDITORIAL.matchday : EDITORIAL.onBackgroundMuted} />
                    </View>
                    <Text style={{
                        flex: 1, fontSize: 14, fontFamily: isActive ? EDITORIAL.fontBold : EDITORIAL.fontRegular,
                        color: isActive ? EDITORIAL.granaDeep : EDITORIAL.onBackground,
                    }}>{f.label}</Text>
                    <Feather name={isActive ? 'minus' : 'plus'} size={16} color={isActive ? EDITORIAL.granaDeep : EDITORIAL.onBackgroundMuted} />
                </TouchableOpacity>
            );
        };

        return (
            <View testID="map-filters-panel" style={{
                backgroundColor: EDITORIAL.granaDeep,
                borderRadius: 20,
                borderWidth: 1, borderColor: EDITORIAL.borderOnBackground,
                overflow: 'hidden',
                maxHeight: Math.min(height * 0.65, height - mobileDropdownTop - safeBottomInset - 16),
                ...Platform.select({
                    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10 },
                    android: { elevation: 10 },
                    default: {},
                }),
            }}>
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={{ fontSize: 20, fontFamily: EDITORIAL.fontBold, color: EDITORIAL.onBackground }}>Troba el teu bar</Text>
                        <Text style={{ fontSize: 12, fontFamily: EDITORIAL.fontRegular, color: EDITORIAL.onBackgroundMuted }}>Combina els filtres al teu gust</Text>
                    </View>
                    {activeFilters.size > 0 && (
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Netejar tots els filtres" onPress={() => setActiveFilters(new Set())} style={{ minHeight: 44, justifyContent: 'center' }}>
                            <Text style={{ fontSize: 13, fontFamily: EDITORIAL.fontBold, color: EDITORIAL.matchday }}>Netejar tot</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView
                    style={{ flexShrink: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 14 }}
                    bounces={false}
                    showsVerticalScrollIndicator={true}
                >
                    {grouped.map(cat => (
                        <View key={cat.key} ref={cat.key === 'availability' ? filtersTarget : undefined} collapsable={false}>
                            <Text style={{
                                fontSize: 12, fontFamily: EDITORIAL.fontBold,
                                color: EDITORIAL.onBackgroundMuted,
                                letterSpacing: 1.2, textTransform: 'uppercase',
                                paddingTop: 16, paddingBottom: 8,
                            }}>
                                {cat.label}
                            </Text>
                            <View style={styles.filterChipGrid}>{cat.items.map(renderFilterRow)}</View>
                            {cat.key === 'availability' && <>
                                {activeFilters.has('open_now') && <Text style={styles.filterHint}>Només locals amb horari conegut i oberts ara.</Text>}
                                {(selectedMatch || nextMatch)
                                    ? activeFilters.has('hide_full') && <Text style={styles.filterHint}>S'amaguen els locals marcats com a complets per al partit que veus al mapa. La resta no garanteix places.</Text>
                                    : <Text style={styles.filterHint}>Cal un partit per filtrar els locals complets.</Text>}
                            </>}
                            {cat.key === 'booking' && activeFilters.has('online_reservations') && <Text style={styles.filterHint}>Locals amb un enllaç de reserva al perfil.</Text>}
                        </View>
                    ))}
                </ScrollView>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Veure resultats dels filtres" onPress={() => setShowFiltersPanel(false)} style={styles.filterResults}>
                    <Text style={{ color: EDITORIAL.granaDeep, fontFamily: EDITORIAL.fontBold, fontSize: 14 }}>
                        Veure resultats{activeFilters.size > 0 ? ` · ${activeFilters.size} ${activeFilters.size === 1 ? 'filtre' : 'filtres'}` : ''}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderSearchBarInput = () => {

        const placeholderText = "On vols veure el partit?";
        const hasActiveFilters = activeFilters.size > 0;

        const filterIconButton = (
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Filtres dels bars"
                accessibilityState={{ expanded: showFiltersPanel }}
                aria-expanded={showFiltersPanel}
                onPress={() => {
                    searchRequestRef.current++;
                    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                    setSearchFocused(false);
                    searchInputRef.current?.blur();
                    Keyboard.dismiss();
                    setShowFiltersPanel(v => !v);
                    setGeoSuggestions([]); // Tancar suggeriments quan obrim filtres
                }}
                style={{
                    marginLeft: 6,
                    width: 44, height: 44, borderRadius: 6,
                    backgroundColor: hasActiveFilters || showFiltersPanel ? EDITORIAL.matchday : 'rgba(255,255,255,0.08)',
                    justifyContent: 'center', alignItems: 'center',
                }}
            >
                <Feather name="sliders" size={18} color={hasActiveFilters || showFiltersPanel ? EDITORIAL.granaDeep : EDITORIAL.onBackground} />
                {hasActiveFilters && (
                    <View style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 16, height: 16, borderRadius: 8,
                        backgroundColor: EDITORIAL.onBackground,
                        justifyContent: 'center', alignItems: 'center',
                    }}>
                        <Text style={{ fontSize: 10, fontFamily: EDITORIAL.fontBold, color: EDITORIAL.granaDeep }}>{activeFilters.size}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );

        // Input natiu
        return (
             <View ref={node => { searchTarget(node); if (user) accountTarget(node); }} testID="map-search-bar" style={[styles.searchBar, { flexDirection: 'column' }]}
                onLayout={event => setSearchBarHeight(event.nativeEvent.layout.height)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <Feather name="search" size={18} color={EDITORIAL.onBackgroundMuted} style={{marginRight: 10}} />
                <TextInput 
                    ref={searchInputRef}
                    accessibilityLabel="Cercar una ubicació"
                    placeholder={placeholderText} 
                    style={[styles.searchInput, { flex: 1 }]}
                    placeholderTextColor={EDITORIAL.onBackgroundMuted}
                    selectionColor={EDITORIAL.matchday}
                    value={searchQuery}
                    onFocus={() => {
                        handleMapGesture();
                        routeRequestId.current++;
                        setRouteInfo(null);
                        setRouteCoords(null);
                        setSelectedBar(null);
                        setSelectedDiscoveredBar(null);
                        setShowBarProfile(false);
                        setSearchFocused(true);
                        setShowFiltersPanel(false);
                    }}
                    onChangeText={handleSearchInput}
                    onKeyPress={event => { if (event.nativeEvent.key === 'Escape') closeBarBubble(); }}
                    onSubmitEditing={() => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); void searchNominatim(searchQuery); }}
                />
                {searchQuery !== '' && (
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Esborrar la cerca" onPress={() => { searchRequestRef.current++; if (searchTimerRef.current) clearTimeout(searchTimerRef.current); setSearchQuery(''); setGeoSuggestions([]); searchInputRef.current?.focus(); }} style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="x" size={16} color={EDITORIAL.onBackground} />
                    </TouchableOpacity>
                )}
                {filterIconButton}
                </View>
            </View>
        );
    };

    /** Overlay flotant per suggeriments i filtres — renderitzat al nivell superior de la pantalla */
    const renderSearchDropdownOverlay = () => {
        const showSuggestions = searchFocused && !showFiltersPanel;
        if (!showSuggestions && !showFiltersPanel) return null;
        return (
            <View
                testID="map-search-dropdown"
                style={isDesktop ? { zIndex: 9999 } : {
                    position: 'absolute',
                    left: 12, right: 12,
                    zIndex: 9999,
                    ...Platform.select({
                        ios: { top: mobileDropdownTop },
                        android: { top: mobileDropdownTop },
                        web: { top: 60 },
                        default: { top: mobileDropdownTop },
                    }),
                }}
            >
                {showSuggestions && (
                    <View style={{
                        backgroundColor: EDITORIAL.granaDeep,
                        borderRadius: 8,
                        borderWidth: 1, borderColor: EDITORIAL.borderOnBackground,
                        overflow: 'hidden',
                        ...Platform.select({
                            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10 },
                            android: { elevation: 10 },
                            default: {},
                        }),
                    }}>
                        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: Math.max(100, height * 0.3) }}>
                        {geoSuggestions.length === 0 && <Text style={{ color: EDITORIAL.onBackgroundMuted, padding: 14 }}>Cerca un local o una adreça.</Text>}
                        {geoSuggestions.map((s, i) => (
                            <TouchableOpacity
                                key={`${s.lat}-${s.lon}-${i}`}
                                accessibilityRole="button"
                                style={{
                                    minHeight: 44, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 14,
                                    borderBottomWidth: i < geoSuggestions.length - 1 ? 1 : 0,
                                    borderBottomColor: EDITORIAL.borderOnBackground,
                                }}
                                onPress={() => selectGeoSuggestion(s)}
                            >
                                <Text numberOfLines={2} style={{ fontSize: 14, fontFamily: EDITORIAL.fontRegular, color: EDITORIAL.onBackground }}>
                                    {s.display_name}
                                </Text>
                                <Text style={{ fontSize: 11, color: EDITORIAL.onBackgroundMuted }}>{s.venue ? 'Google Maps' : 'OpenStreetMap'}</Text>
                            </TouchableOpacity>
                        ))}
                        </ScrollView>
                        <MapDataAttribution
                            venues={[...scannedBars, ...geoSuggestions.flatMap(suggestion => suggestion.venue ? [suggestion.venue] : [])]}
                            googleDetails={!!placeDetails || discoveredGoogleDetails}
                            osmGeocoding={geoSuggestions.some(suggestion => !suggestion.venue)}
                            googleMapAttributed={Platform.OS === 'android' || Platform.OS === 'web'}
                            style={{ paddingHorizontal: 14, paddingVertical: 8 }}
                        />
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tancar la cerca"
                            onPress={() => {
                                searchRequestRef.current++;
                                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                                setSearchFocused(false);
                                searchInputRef.current?.blur();
                                Keyboard.dismiss();
                            }} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold }}>Tancar</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {showFiltersPanel && renderFiltersPanel()}
            </View>
        );
    };



    const renderRadiusSlider = () => {

        return null;

    }

    const renderSearchSettingsOverlay = () => {

        return null;

    };



    const renderHeader = () => (

        <View
            style={isDesktop ? styles.desktopSidebarContent : [styles.topBarContainer, { top: mobileHeaderTop }]}
            onLayout={event => {
                if (!isDesktop) setMobileHeaderHeight(mobileHeaderTop + event.nativeEvent.layout.height);
            }}
        >

             <View style={{flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between'}}>

                 <View style={{flex: 1}}>

                     {renderSearchBarInput()}

                 </View>

                 {!user && (

                    <TouchableOpacity ref={accountTarget}
                        accessibilityRole="button"
                        accessibilityLabel="Crear un compte o iniciar sessió"

                        style={{ marginLeft: 10, padding: 8 }}

                        onPress={() => navigation.navigate('Login')}

                    >

                        <Feather name="user" size={24} color={SKETCH_THEME.colors.text} />

                    </TouchableOpacity>

                 )}

             </View>

             

             {/* Bàner del partit — seleccionat o pròxim */}

             {(selectedMatch || nextMatch) && (isDesktop || (!selectedBar && !selectedDiscoveredBar)) && (

                <View ref={matchesTarget} collapsable={false} style={{ marginTop: 8, marginHorizontal: 4 }}>

                    {(selectedMatch || nextMatch) && (
                        <MatchCardStack
                            match={(selectedMatch || nextMatch)!}
                            alternativeMatch={getAlternativeMatch(selectedMatch || nextMatch)}
                            onSwitchMatch={toggleMatchCategory}
                            isFilter={!!selectedMatch}
                            showDismiss={!!matchIdFromNav}
                            onToggleFilter={() => {
                                if (selectedMatch) {
                                    setSelectedMatch(null);
                                    navigation.setParams({ matchId: undefined });
                                } else {
                                    setSelectedMatch(nextMatch);
                                }
                            }}
                            onDismissFilter={() => {
                                setSelectedMatch(null);
                                navigation.setParams({ matchId: undefined });
                            }}
                        />
                    )}

                </View>

             )}



             { (!selectedBar || isDesktop) && (

                 <>

                    {renderRadiusSlider()}

                        {/* El bot\u00f3 de cerca de bars ara \u00e9s un FAB stackejat sobre el GPS.
                            Mantenim aquest fragment buit per no trencar el layout del header. */}

                 </>

             )}

        </View>

    );





    // Estat de càrrega inicial ELIMINAT

    // if (!userLocation && !centerLocation) { ... }



    const availableBottom = height - mobileFabBottom - 12;
    const minimumCardTop = Math.min(Math.max(mobileHeaderTop + 56, mobileHeaderHeight + 8), availableBottom - 100);
    const selectedMarkerHeight = selectedDiscoveredBar ? Math.max(44, mapMarkerSize(currentZoom, true))
        : mapMarkerSize(currentZoom, true) + (selectedBar?.id === ownerBar?.id && ownerBar ? 26 : 0);
    const bubbleLayout = mapBubbleLayout({ x: barCardAnchorX ?? width / 2, y: barCardAnchorY ?? availableBottom - 12 }, height, width, minimumCardTop, height - availableBottom,
        venueCardHeight, selectedMarkerHeight);
    const cardTop = bubbleLayout.top;

    return (

        <View style={[styles.container, { position: 'relative' }, isDesktop && { flexDirection: 'row' }]}>
            {/* BARRA LATERAL D'ESCRIPTORI */}

            {isDesktop && (

                <View style={[styles.desktopSidebar, { position: 'relative' }]}>

                    {renderHeader()}
                    {/* Overlay flotant de suggeriments/filtres — desktop */}
                    <View style={{ position: 'relative', zIndex: 9999, paddingHorizontal: 16 }}>
                        {renderSearchDropdownOverlay()}
                    </View>

                    {selectedBar || selectedDiscoveredBar ? (
                        <View onLayout={event => setDesktopCardTop(event.nativeEvent.layout.y + 16)} style={{ height: venueCardHeight + 32 }} />
                    ) : (
                        <View style={{ flex: 1, paddingHorizontal: 16 }}>
                            {renderContentPanel()}
                        </View>
                    )}

                </View>

            )}



             {/* ÀREA DEL MAPA */}

             <View ref={mapTarget} style={styles.mapContainer} collapsable={false}>
                    {!mapReady && !mapLoadFailed && (
                        <ActivityIndicator accessibilityLabel="Carregant el mapa" color={EDITORIAL.grana} style={{ position: 'absolute', top: mobileHeaderHeight + 20, alignSelf: 'center', zIndex: 2 }} />
                    )}
                    {mapLoadFailed && !transientAlertVisible && (
                        <View style={{ position: 'absolute', bottom: mapNoticeBottom, left: mapNoticeLeft, right: mapNoticeRight, alignItems: 'center', zIndex: 51 }}>
                            <View style={{ width: '100%', maxWidth: 480 }}>
                            <UserNotice
                                compact
                                message="No s'ha pogut carregar el mapa. Torna-ho a provar."
                                tone="error"
                                action={{ label: 'Tornar-ho a provar', onPress: () => {
                                    setMapReady(false);
                                    setMapLoadFailed(false);
                                    setNativeMapRevision(previous => previous + 1);
                                } }}
                            />
                            </View>
                        </View>
                    )}
                    {!mapLoadFailed && !transientAlertVisible && !selectedLocation && (scanMessage || matchNotice) && (
                        <View pointerEvents="box-none" style={{ position: 'absolute', bottom: mapNoticeBottom, left: mapNoticeLeft, right: mapNoticeRight, zIndex: 50, alignItems: 'center' }}>
                            <View style={{ width: '100%', maxWidth: 480 }}>
                                <UserNotice
                                    compact
                                    message={scanMessage || matchNotice!}
                                />
                            </View>
                        </View>
                    )}

                    <MapView
                        key={nativeMapRevision}
                        ref={mapRefNative}
                        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                        style={styles.map}
                        customMapStyle={Platform.OS === 'ios' ? undefined : CUSTOM_MAP_STYLE}
                        initialRegion={lastRegionRef.current ?? {
                            latitude: centerLocation?.latitude ?? 41.3851,
                            longitude: centerLocation?.longitude ?? 2.1734,
                            latitudeDelta: radiusToLatDelta(searchRadiusKm),
                            longitudeDelta: radiusToLatDelta(searchRadiusKm),
                        }}
                        showsUserLocation={true}
                        showsMyLocationButton={false}
                        showsCompass={false}
                        rotateEnabled
                        pitchEnabled
                        maxZoomLevel={MAP_MAX_ZOOM}
                        toolbarEnabled={false}
                        onMapReady={() => {
                            if (nativeMapRevision !== nativeMapRevisionRef.current) return;
                            setMapReady(true);
                            setMapLoadFailed(false);
                        }}
                        onPress={handleMapPress}
                        onTouchStart={() => {
                            mapInteractedRef.current = true;
                            pendingInitialRegionRef.current = null;
                            selectionCameraRequestRef.current++;
                        }}
                        onTouchMove={handleMapGesture}
                        onPanDrag={handleMapGesture}
                        onRegionChangeComplete={(region, details) => {
                            if (!isValidMapRegion(region)) {
                                console.info('[MapScreen] Ignoring invalid map region', region);
                                return;
                            }
                            if (details?.isGesture) handleMapGesture();
                            const previous = lastRegionRef.current;
                            const changeThreshold = 0.000001;
                            if (
                                previous &&
                                Math.abs(previous.latitude - region.latitude) < changeThreshold &&
                                Math.abs(previous.longitude - region.longitude) < changeThreshold &&
                                Math.abs(previous.latitudeDelta - region.latitudeDelta) < changeThreshold &&
                                Math.abs(previous.longitudeDelta - region.longitudeDelta) < changeThreshold
                            ) {
                                return;
                            }
                            lastRegionRef.current = region;
                            setCenterLocation({ latitude: region.latitude, longitude: region.longitude });
                            setVisibleBounds({
                                minLat: region.latitude - region.latitudeDelta / 2,
                                maxLat: region.latitude + region.latitudeDelta / 2,
                                minLng: region.longitude - region.longitudeDelta / 2,
                                maxLng: region.longitude + region.longitudeDelta / 2,
                            });
                            // Zoom aproximat a partir de latitudeDelta
                            const approxZoom = Math.log2(360 / region.latitudeDelta);
                            setCurrentZoom(approxZoom);
                            // Si hi ha un bar seleccionat, el pin pot haver canviat de
                            // posició a la pantalla (pan/zoom): recalculem l'ancoratge.
                            if (selectedLocation) void updateBarCardAnchor();
                        }}
                    >

                        {/* La ubicació es mostra via showsUserLocation del MapView per evitar duplicats visuals. */}



                         {/* Marcadors agrupats per supercluster.
                             Si un clúster té múltiples punts → bombolla grana amb el comptador.
                             Si és un sol punt → marcador habitual segons tipus (confirmat/escanejat). */}
                         {clusters.map((feature) => {
                             const [lng, lat] = feature.geometry.coordinates;
                             const props: any = feature.properties;

                             if (props.cluster) {
                                 const count: number = props.point_count;
                                 const size = count < 10 ? 32 : count < 50 ? 40 : 50;
                                 // El `clusterKind` ens diu si aquest clúster prové del
                                 // dataset de bars registrats o del d'escanejats — mai
                                 // contenen una barreja perquè usem índexs independents.
                                 const onlyScanned = props.clusterKind === 'scanned';
                                 return (
                                     <ClusterMarker
                                         key={`cluster-${props.clusterKind}-${props.cluster_id}-${count}`}
                                         coordinate={{ latitude: lat, longitude: lng }}
                                         count={count}
                                         size={size}
                                         muted={onlyScanned}
                                         zIndex={onlyScanned ? 30 : 50}
                                         onPress={() => {
                                             // En clicar el clúster, ampliem zoom cap al centre del clúster
                                             const next = Math.min(MAP_MAX_ZOOM, Math.max(currentZoom + 2, 14));
                                             const newDelta = 360 / Math.pow(2, next);
                                             const region = {
                                                 latitude: lat,
                                                 longitude: lng,
                                                 latitudeDelta: newDelta,
                                                 longitudeDelta: newDelta,
                                             };
                                             lastMarkerPressRef.current = Date.now();
                                             handleMapGesture();
                                             void moveMapToRegion(region);
                                         }}
                                     />
                                 );
                             }

                             const data: ClusterBar = props.data;
                             if (data.kind === 'scanned') {
                                 const osmBar = data.bar;
                                 return (
                                     <ScannedBarMarker
                                         key={`scanned-${osmBar.id}`}
                                         osmBar={osmBar}
                                         zoom={currentZoom}
                                         isSelected={selectedDiscoveredBar?.id === osmBar.id}
                                         onPress={() => navigateToReportBar(osmBar)}
                                     />
                                 );
                             }

                             // confirmed
                             const bar = data.bar;
                             const isPremium = bar.tier === 'premium';
                             const isSelected = selectedBar?.id === bar.id;
                             return (
                                <ConfirmedBarMarker
                                    key={`bar-${bar.id}-${Math.round(currentZoom * 2)}`}
                                    bar={bar}
                                    zoom={currentZoom}
                                    isPremium={isPremium}
                                    isSelected={isSelected}
                                    onPress={() => handleSelectBar(bar)}
                                />
                             );
                         })}

                        {ownerBar && <ConfirmedBarMarker key={`owner-${ownerBar.id}`} bar={ownerBar} zoom={currentZoom} isPremium={ownerBar.tier === 'premium'} isSelected={selectedBar?.id === ownerBar.id} isOwned onPress={() => handleSelectBar(ownerBar)} />}

                        {/* Ruta caminant fins al bar seleccionat */}
                        {selectedBar && routeCoords && routeCoords.length > 1 && (
                            <Polyline
                                coordinates={routeCoords}
                                strokeColor={EDITORIAL.grana}
                                strokeWidth={4}
                                zIndex={5}
                            />
                        )}

                    </MapView>
                    <AlertBannerHost
                       active={isFocused}
                       bottomOffset={mapNoticeBottom}
                       horizontalInsets={{ left: mapNoticeLeft, right: mapNoticeRight }}
                       onVisibilityChange={setTransientAlertVisible}
                    />

             </View>

            

            {/* SUPERPOSICIONS MÒBILS */}

            {!isDesktop && (

                <>

                    {/* Capçalera — SEMPRE visible encara que hi hagi bar seleccionat, potser amb opacitat reduïda o z-index diferent si cal? 

                        L'usuari va dir "Abans ho teníem bé" i va mostrar una imatge amb la barra de cerca VISIBLE. 

                        Currently it is wrapped in {!selectedBar && ( ... )}

                    */}

                    <View 

                        style={{position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10}} 

                        pointerEvents="box-none"

                    >

                        <SafeAreaView edges={['left', 'right']} style={{backgroundColor: 'transparent'}} pointerEvents="box-none">

                            {renderHeader()}

                        </SafeAreaView>

                    </View>

                    {/* Overlay flotant de suggeriments/filtres — fora del header per evitar clipping */}
                    {renderSearchDropdownOverlay()}

                    {/* Controls flotants de l'app — apilats a baix-dreta.
                        Els controls natius de Google (+/-) viuen a l'esquerra. */}
                    <TouchableOpacity
                        style={[
                            styles.fabGps,
                            { bottom: mapControlsBottom },
                        ]}
                        onPress={centerMapToGPS}
                        accessibilityLabel="Centrar a la meva ubicaci\u00f3"
                    >
                        <MapImage source={getMapIcon('target')} style={{ width: 26, height: 26 }} contentFit="contain" transition={0} />
                    </TouchableOpacity>

                    {(() => {
                        if (matchIdFromNav && !tutorialKind) return null;
                        const visibleWidthKm = visibleBounds
                            ? getDistanceFromLatLonInKm(visibleBounds.minLat, visibleBounds.minLng, visibleBounds.minLat, visibleBounds.maxLng)
                            : 0;
                        if (visibleBounds && visibleWidthKm > 2) return null;
                        return (
                            <TouchableOpacity
                                ref={node => { discoveryTarget(node); if (!tutorialDiscoveredBar) reportTarget(node); }}
                                style={[
                                    styles.fabGps,
                                    { bottom: mapSearchBottom, right: mapSearchRight },
                                ]}
                                onPress={handleScanToggle}
                                disabled={isScanning}
                                accessibilityLabel={scannedBars.length > 0 ? 'Amagar bars sense confirmar' : 'Cercar bars a la zona visible'}
                            >
                                {isScanning ? (
                                    <ActivityIndicator size="small" color={EDITORIAL.grana} />
                                ) : scannedBars.length > 0 ? (
                                    <MapImage source={getMapIcon('hide')} style={{ width: 30, height: 30 }} contentFit="contain" transition={0} />
                                ) : (
                                    <MapImage source={getMapIcon('search')} style={{ width: 26, height: 26 }} contentFit="contain" transition={0} />
                                )}
                            </TouchableOpacity>
                        );
                    })()}



                    {/* Barra de navegació inferior — Editorial */}

                    {user?.role === 'bar_owner' && (
                        <OwnerBottomNav active="map" onMap={() => { if (ownerBar) { ownerEntryHandledRef.current = true; focusOwnedBar(ownerBar); } }}
                            onProfile={() => navigation.navigate('BarDashboard', { tab: 'profile' })}
                            onSettings={() => navigation.navigate('BarDashboard', { tab: 'settings' })} />
                    )}
                    {user && user.role !== 'bar_owner' && (

                        <View style={{

                            position: 'absolute',

                            bottom: 0,

                            left: 0,

                            right: 0,

                            backgroundColor: EDITORIAL.granaDeep,

                            borderTopWidth: 1,

                            borderTopColor: 'rgba(255,255,255,0.2)',

                            paddingBottom: safeBottomInset,

                            paddingTop: 8,

                            flexDirection: 'row',

                            justifyContent: 'space-around',

                            alignItems: 'center',

                            ...Platform.select({
                                web: { boxShadow: '0 -2px 8px rgba(15,27,45,0.06)' } as any,
                                ios: { shadowColor: '#000', shadowOffset: {width: 0, height: -2}, shadowOpacity: 0.06, shadowRadius: 6 },
                                android: { elevation: 8 }
                            })

                        }}>

                        <TouchableOpacity

                            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}

                            onPress={() => navigation.navigate('Matches')}

                        >

                            <Ionicons name="calendar-outline" size={26} color="#FFFFFF" />

                            <Text style={{ fontSize: 12, color: '#FFFFFF', marginTop: 4, fontFamily: EDITORIAL.fontBold, letterSpacing: 0 }}>

                                Partits

                            </Text>

                        </TouchableOpacity>



                        <TouchableOpacity

                            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}

                            onPress={centerMapToGPS}
                            accessibilityRole="button"
                            accessibilityLabel="Centrar el mapa a la meva ubicació"

                        >

                            <Feather name="map-pin" size={26} color="#FFFFFF" />

                            <Text style={{ fontSize: 12, color: '#FFFFFF', marginTop: 4, fontFamily: EDITORIAL.fontBold, letterSpacing: 0 }}>

                                Mapa

                            </Text>

                        </TouchableOpacity>



                        <TouchableOpacity

                            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}

                            onPress={() => navigation.navigate(user?.role === 'bar_owner' ? 'BarDashboard' : 'Profile')}
                            accessibilityRole="button"
                            accessibilityLabel="Obrir el perfil"

                        >

                            {user?.avatar ? (

                                <Image 

                                    source={{ uri: user.avatar }} 

                                    style={{ 

                                        width: 26, 

                                        height: 26, 

                                        borderRadius: 13,

                                        borderWidth: 1,

                                        borderColor: 'rgba(255,255,255,0.6)'

                                    }} 

                                />

                            ) : (

                                <Feather name="user" size={26} color="#FFFFFF" />

                            )}

                            <Text style={{ fontSize: 12, color: '#FFFFFF', marginTop: 4, fontFamily: EDITORIAL.fontBold, letterSpacing: 0 }}>

                                Perfil

                            </Text>

                        </TouchableOpacity>

                    </View>

                    )}

                </>

            )}



             {/* CONTROLS DE L'APP — ESCRIPTORI: apilats a baix-dreta */}
             {isDesktop && (
                <>
                    <TouchableOpacity
                        style={[styles.fabGps, { right: 20, bottom: mapControlsBottom }]}
                        onPress={centerMapToGPS}
                        accessibilityLabel="Centrar a la meva ubicaci\u00f3"
                    >
                        <MapImage source={getMapIcon('target')} style={{ width: 26, height: 26 }} contentFit="contain" transition={0} />
                    </TouchableOpacity>

                    {(() => {
                        if (matchIdFromNav && !tutorialKind) return null;
                        const visibleWidthKm = visibleBounds
                            ? getDistanceFromLatLonInKm(visibleBounds.minLat, visibleBounds.minLng, visibleBounds.minLat, visibleBounds.maxLng)
                            : 0;
                        if (visibleBounds && visibleWidthKm > 2) return null;
                        return (
                            <TouchableOpacity
                                ref={node => { discoveryTarget(node); if (!tutorialDiscoveredBar) reportTarget(node); }}
                                style={[styles.fabGps, { right: mapSearchRight, bottom: mapSearchBottom }]}
                                onPress={handleScanToggle}
                                disabled={isScanning}
                                accessibilityLabel={scannedBars.length > 0 ? 'Amagar bars sense confirmar' : 'Cercar bars a la zona visible'}
                            >
                                {isScanning ? (
                                    <ActivityIndicator size="small" color={EDITORIAL.grana} />
                                ) : scannedBars.length > 0 ? (
                                    <MapImage source={getMapIcon('hide')} style={{ width: 30, height: 30 }} contentFit="contain" transition={0} />
                                ) : (
                                    <MapImage source={getMapIcon('search')} style={{ width: 26, height: 26 }} contentFit="contain" transition={0} />
                                )}
                            </TouchableOpacity>
                        );
                    })()}
                </>
             )}



            <ExpoStatusBar style="dark" />



            {renderSearchSettingsOverlay()}



             {/* ÀREA DE LLISCAMENT LATERAL — Zona invisible esquerra */}

             <View 


                style={{

                    position: 'absolute', top: 0, bottom: 0, left: 0, width: 20, zIndex: 9999, backgroundColor: 'transparent'

                }}

             />



            {selectedLocation && (isDesktop || barCardAnchorY != null) && (
                <PremiumBarSheet
                    tutorialProfileRef={premiumTarget}
                    key={selectedVenueId}
                    layoutReady={venueMeasurement?.id === selectedVenueId}
                    name={selectedBar?.name ?? selectedDiscoveredBar!.name}
                    expandable={selectedBar?.tier === 'premium'}
                    screenWidth={width}
                    screenHeight={height}
                    collapsedTop={isDesktop ? Math.max(8, Math.min(desktopCardTop, height - venueCardHeight - 12)) : cardTop}
                    collapsedLeft={isDesktop ? 16 : 12}
                    collapsedWidth={isDesktop ? 368 : width - 24}
                    collapsedHeight={venueCardHeight}
                    expanded={showBarProfile}
                    onExpandedChange={setShowBarProfile}
                    onCollapsedHeightChange={measuredHeight => {
                        if (selectedVenueId) setVenueMeasurement({ id: selectedVenueId, height: measuredHeight });
                    }}
                    triangleLeft={isDesktop ? undefined : bubbleLayout.triangleLeft}
                    triangleTop={isDesktop ? undefined : bubbleLayout.triangleTop}
                    triangleBelow={bubbleLayout.placement === 'below'}
                    compactContent={renderContentPanel(true)}
                    renderExpanded={() => selectedBar?.tier === 'premium' ? (
                        <BarProfileModal
                            embedded
                            visible
                            bar={selectedBar}
                            placeDetails={placeDetails}
                            allMatches={upcomingMatches}
                            matchId={(selectedMatch || nextMatch)?.id}
                            onClose={() => setShowBarProfile(false)}
                            onNavigate={() => openExternalMaps(selectedBar)}
                            onReviewStatsChange={setSelectedBarReviewStats}
                            onRequestLogin={() => {
                                setShowBarProfile(false);
                                navigation.navigate('Login');
                            }}
                        />
                    ) : null}
                />
            )}

        </View>

    );



};







export default MapScreen;
