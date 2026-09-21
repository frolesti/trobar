import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

import { View, Text, TextInput, TouchableOpacity, Platform, Image, Keyboard, ScrollView, Linking, useWindowDimensions, PanResponder, Animated, Easing, ActivityIndicator, Alert, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Location from 'expo-location';

import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; // Icones vectorials

import { fetchBars, fetchBarsForMatch, fetchBarsInBounds, cacheBarPlaceData } from '../../services/barService';

import { useAuth } from '../../context/AuthContext';
import { useScreenLoading } from '../../context/SplashContext';

import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';

import { Bar, BarAmenity } from '../../models/Bar';

import { RootStackParamList } from '../../navigation/AppNavigator';

import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { sketchShadow, SKETCH_THEME } from '../../theme/sketchTheme';

import { CUSTOM_MAP_STYLE } from '../../theme/mapStyle';

import { executeRequest } from '../../api/core';

import { fetchAllMatches, Match } from '../../services/matchService';

import { fetchBarsFromOSM, fetchBarsFromOSMBounds, OSMBar } from '../../services/osmService';

import { getUserPreferences } from '../../services/userService';

import styles from './MapScreen.styles';

import MatchCard from '../../components/MatchCard';
import { showAlert } from '../../components/AlertBanner';
import { EDITORIAL } from '../../theme/editorialTheme';
import { useClusters, ClusterablePoint } from '../../hooks/useClusters';

import BarCard from '../../components/BarCard';

import BarListItem from '../../components/BarListItem';

import BarProfileModal from '../../components/BarProfileModal';


import { fetchBarPlaceDetails, PlaceDetails, isOpenNow } from '../../services/placesService';
import { getBarReviewStats } from '../../services/reviewService';
import { BarReviewStats } from '../../models/Review';
import { AMENITY_OPTIONS, AMENITY_CATEGORIES } from '../../data/amenities';



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
const MAP_PIN_3D = require('../../../../assets/app/img/map-icons/map-pin-3d.png');
const MAP_STAR_3D = require('../../../../assets/app/img/map-icons/star-3d.png');
// Pin diferent (xinxeta) per a bars trobats a Google Maps encara no confirmats
const MAP_PIN_SCANNED_3D = require('../../../../assets/app/img/map-icons/pin-scanned-3d.png');
// Icones 3D consistents per als controls flotants i el badge de clúster
const MAP_TARGET_3D = require('../../../../assets/app/img/map-icons/target-3d.png');
const MAP_ZOOM_3D = require('../../../../assets/app/img/map-icons/zoom-3d.png');
const MAP_SPHERE_3D = require('../../../../assets/app/img/map-icons/sphere-3d.png');

/**
 * Marcador d'un bar registrat/premium al mapa.
 *
 * `tracksViewChanges` es manté a `true` fins que la imatge ha carregat de
 * veritat (`onLoad`): si el desactivéssim d'entrada, react-native-maps podria
 * capturar la instantània ABANS que el PNG estigués decodificat i el pin
 * quedaria en blanc fins que l'usuari fes zoom (forçant un remount). Un cop
 * carregat, el desactivem per rendiment, excepte quan està seleccionat
 * (canvia de mida i cal tornar-lo a capturar).
 */
const ConfirmedBarMarker: React.FC<{
    bar: Bar;
    isPremium: boolean;
    isSelected: boolean;
    onPress: () => void;
}> = React.memo(({ bar, isPremium, isSelected, onPress }) => {
    const [loaded, setLoaded] = useState(false);
    return (
        <Marker
            coordinate={{ latitude: bar.latitude, longitude: bar.longitude }}
            title={getCleanBarName(bar.name)}
            anchor={{ x: 0.5, y: 1.0 }}
            tracksViewChanges={!loaded || isSelected}
            onPress={onPress}
            zIndex={isPremium ? 100 : 1}
        >
            <View style={styles.markerContainer}>
                <Image
                    source={MAP_PIN_3D}
                    style={isSelected ? styles.markerPinSelected3d : styles.markerPin3d}
                    resizeMode="contain"
                    onLoad={() => setLoaded(true)}
                />
                {isPremium && (
                    <Image
                        source={MAP_STAR_3D}
                        style={styles.markerPremiumStar3d}
                        resizeMode="contain"
                    />
                )}
            </View>
        </Marker>
    );
});

/** Marcador d'un bar trobat a Google Maps encara no confirmat. Mateix gate de càrrega que `ConfirmedBarMarker`. */
const ScannedBarMarker: React.FC<{
    osmBar: OSMBar;
    onPress: () => void;
}> = React.memo(({ osmBar, onPress }) => {
    const [loaded, setLoaded] = useState(false);
    return (
        <Marker
            coordinate={{ latitude: osmBar.lat, longitude: osmBar.lon }}
            anchor={{ x: 0.5, y: 1.0 }}
            tracksViewChanges={!loaded}
            onPress={onPress}
            zIndex={1}
        >
            <Image
                source={MAP_PIN_SCANNED_3D}
                style={styles.markerPinScanned}
                resizeMode="contain"
                onLoad={() => setLoaded(true)}
            />
        </Marker>
    );
});

/**
 * Marcador de clúster: badge 3D (esfera + número), consistent amb la resta
 * d'icones del mapa. `muted` s'aplica als clústers de bars escanejats/no
 * confirmats (opacitat reduïda + anell gris). Igual que els pins de bar,
 * `tracksViewChanges` espera que la imatge carregui de veritat abans de
 * desactivar-se, si no el badge pot quedar en blanc fins a fer zoom.
 */
const ClusterMarker: React.FC<{
    coordinate: { latitude: number; longitude: number };
    count: number;
    size: number;
    muted: boolean;
    zIndex: number;
    onPress: () => void;
}> = React.memo(({ coordinate, count, size, muted, zIndex, onPress }) => {
    const [loaded, setLoaded] = useState(false);
    const label = count < 100 ? String(count) : `${Math.floor(count / 10) * 10}+`;
    return (
        <Marker
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={zIndex}
            tracksViewChanges={!loaded}
            onPress={onPress}
        >
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <Image
                    source={MAP_SPHERE_3D}
                    style={{ position: 'absolute', width: size, height: size, opacity: muted ? 0.55 : 1 }}
                    resizeMode="contain"
                    onLoad={() => setLoaded(true)}
                />
                {muted && (
                    <View style={{
                        position: 'absolute', width: size, height: size, borderRadius: size / 2,
                        borderWidth: 2, borderColor: EDITORIAL.hairlineStrong,
                    }} />
                )}
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

// En seleccionar un bar, desplacem la càmera amunt perquè el pin quedi sota el centre.

// La bafarada es posiciona dinàmicament perquè el triangle apunti al pin.

// Petit offset positiu: el centre de la càmera puja una mica al nord del bar
// perquè el pin del bar quedi just per sobre de la bafarada inferior, no enrere.
const CAMERA_LAT_OFFSET = 0.0008;

const MAP_REGION_DELTA   = 0.008;  // latitudeDelta de la regió animada

/** Converteix el radi de cerca (km) a latitudeDelta per a MapView natiu */
function radiusToLatDelta(km: number): number {
    // ~0.009 graus ≈ 1 km a latituds d'Espanya
    return km * 0.012;
}







const MapScreen = () => {

    const { user } = useAuth();

    const navigation = useNavigation<any>();

    // Bar owners no tenen accés al mapa
    useEffect(() => {
        if (user?.role === 'bar_owner') {
            navigation.reset({ index: 0, routes: [{ name: 'BarDashboard' }] });
        }
    }, [user]);

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
    const lastMarkerPressRef = useRef(0);

    const [showBarProfile, setShowBarProfile] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');

    // Suggeriments de geocodificació (Nominatim)
    const [geoSuggestions, setGeoSuggestions] = useState<{display_name: string, lat: string, lon: string}[]>([]);
    const searchTimerRef = useRef<any>(null);

    // Filtratge per viewport (el radi ja no s'utilitza)

    const [visibleBounds, setVisibleBounds] = useState<{ minLat: number, maxLat: number, minLng: number, maxLng: number } | null>(null);

    const [currentZoom, setCurrentZoom] = useState(14);
    const lastRegionRef = useRef<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);



    // Dades del pròxim partit

    const [nextMatch, setNextMatch] = useState<Match | null>(null);

    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);

    // Partit seleccionat des de la pantalla de Partits (diferent de nextMatch)
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

    

    const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);
    const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[] | null>(null);

    const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);

    const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);

    const [selectedBarReviewStats, setSelectedBarReviewStats] = useState<BarReviewStats>({ averageRating: 0, totalReviews: 0 });



    // Placeholder local si una imatge remota falla

    const [failedImages, setFailedImages] = useState<Record<string, true>>({});

    // Radi de cerca configurable des de preferències d'usuari (km)
    const [searchRadiusKm, setSearchRadiusKm] = useState(2);
    // Categoria preferida: 'all' | 'masculino' | 'femenino'
    const [defaultCategory, setDefaultCategory] = useState<string>('all');

    // Filtres actius (multi-filtre)
    const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);

    // Dades

    const [bars, setBars] = useState<Bar[]>([]);
    // True un cop hem completat la PRIMERA càrrega de bars (per al splash global)
    const [initialBarsLoaded, setInitialBarsLoaded] = useState(false);

    // True quan el mapa s'ha renderitzat completament (onRegionChangeComplete cridat)
    const [mapReady, setMapReady] = useState(false);

    const [filteredBars, setFilteredBars] = useState<Bar[]>([]);

    // El mapa ha de romandre muntat per rebre els bounds i l'estat de renderitzat.
    // Per això aquesta càrrega es gestiona localment i no bloqueja l'splash global.
    const isLoading = !visibleBounds || !initialBarsLoaded || !mapReady;

    useScreenLoading('MapScreen', isLoading);

    useEffect(() => {
        console.log('[MapScreen] Loading state changed - visibleBounds:', !!visibleBounds, 'initialBarsLoaded:', initialBarsLoaded, 'isLoading:', isLoading);
    }, [isLoading, visibleBounds, initialBarsLoaded]);

    

    // OSM / Escaneig

    const [scannedBars, setScannedBars] = useState<OSMBar[]>([]);

    const [isScanning, setIsScanning] = useState(false);

    // Bars escanejats filtrats per amenitats actives (dinàmic)
    const filteredScannedBars = useMemo(() => {
        if (activeFilters.size === 0) return scannedBars;
        // Filtres que no apliquen a bars escanejats
        const skip = new Set(['open_now']);
        const amenityFilters = Array.from(activeFilters).filter(f => !skip.has(f));
        if (amenityFilters.length === 0) return scannedBars;
        return scannedBars.filter(b => {
            const barAmenities = b.amenities || [];
            return amenityFilters.every(f => {
                if (f === 'projector') return barAmenities.includes('projector') || barAmenities.includes('multiple_screens') || barAmenities.includes('sports_bar');
                return barAmenities.includes(f as any);
            });
        });
    }, [scannedBars, activeFilters]);



    // ---- Clustering -------------------------------------------------------
    // Mantenim dos datasets SEPARATS perquè supercluster NO barregi
    // bars registrats (grana) amb bars escanejats (gris). Si caiguessin al
    // mateix clúster perdríem la senyal visual important: "aquí hi ha
    // contingut Trobar contrastat" vs "aquí només hi ha possibles bars".
    type ClusterBar =
        | { kind: 'confirmed'; bar: Bar }
        | { kind: 'scanned'; bar: OSMBar };

    const clusterPointsConfirmed = useMemo<ClusterablePoint<ClusterBar>[]>(() => {
        return filteredBars.map((b) => ({
            id: `c-${b.id}`,
            latitude: b.latitude,
            longitude: b.longitude,
            data: { kind: 'confirmed' as const, bar: b },
        }));
    }, [filteredBars]);

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

    const mapRefNative = useRef<any>(null);

    

    // Posició del mapa abans d'obrir ReportBar (per restaurar al tancar)
    const preReportPositionRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
    const shouldRestoreAfterReportRef = useRef(false);

    // Animació d'instruccions

    const bubbleScale = useRef(new Animated.Value(0)).current;

    const bubbleOpacity = useRef(new Animated.Value(0)).current;

    const [bubbleReady, setBubbleReady] = useState(false);

    // Posició en píxels del pin seleccionat, per ancorar la targeta del bar
    // just a sobre seu en lloc de deixar-la fixa a baix de la pantalla.
    const [barCardAnchorY, setBarCardAnchorY] = useState<number | null>(null);
    const [barCardAnchorX, setBarCardAnchorX] = useState<number | null>(null);
    const [barCardHeight, setBarCardHeight] = useState(220);



    // Responsiu

    const { width, height } = useWindowDimensions();

    const isDesktop = width > 768; // Punt de ruptura per a escriptori web
    const insets = useSafeAreaInsets();
    const androidStatusInset = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 0;
    const safeTopInset = Math.max(insets.top, androidStatusInset);
    const safeBottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);
    const mobileHeaderTop = safeTopInset + 8;
    const mobileDropdownTop = mobileHeaderTop + 58;
    const mobileFabBottom = safeBottomInset + (user ? 88 : 16);



    // Lògica del panell inferior arrossegable (animació)

    const bottomSheetHeight = useRef(new Animated.Value(120)).current; 

    const bottomSheetTranslateY = useRef(new Animated.Value(500)).current; // Comença ocult

    const lastHeight = useRef(120);

    // Resposta a lliscament des de la vora per navegar al Login (vora esquerra -> dreta)

    const edgeSwipeResponder = useRef(

        PanResponder.create({

            onMoveShouldSetPanResponder: (evt, gestureState) => {

                // Ha de començar a la vora (x < 50) I ser un lliscament a la dreta (dx > 20)

                // No usem Capture perquè volem cedir a les vistes de scroll internes si cal,

                // però com que és absolut, no hauria de ser problema.

                // Usem pageX per a coordenades absolutes de pantalla.

                return evt.nativeEvent.pageX < 60 && gestureState.dx > 10 && Math.abs(gestureState.dy) < Math.abs(gestureState.dx);

            },

            onPanResponderMove: () => {

                // Podríem animar alguna cosa aquí per donar retroalimentació

            },

            onPanResponderRelease: (_, gestureState) => {

                if (gestureState.dx > 50) {

                    // Lliscament vàlid

                    navigation.navigate('Login');

                }

            }

        })

    ).current;



    // --- EFECTES ---

    // 0. Carregar radi de cerca i categoria des de preferències d'usuari
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const prefs = await getUserPreferences(user.id);
                // El model guarda en metres (500, 1000, 2000, 5000), OSM necessita km
                setSearchRadiusKm(prefs.display.searchRadius / 1000);
                if (prefs.display.defaultCategory) {
                    setDefaultCategory(prefs.display.defaultCategory);
                }
            } catch (e) {
                console.warn('No s\'han pogut carregar les preferències de radi:', e);
            }
        })();
    }, [user]);

    // 0b. Quan canvia el radi de cerca, ajustar el zoom del mapa
    useEffect(() => {
        if (!centerLocation) return;
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

        (async () => {
            const applyInitialRegion = (loc: { latitude: number; longitude: number }) => {
                console.log('[MapScreen GPS] applyInitialRegion called with:', loc);
                const delta = radiusToLatDelta(searchRadiusKm);
                setCenterLocation(loc);
                setVisibleBounds({
                    minLat: loc.latitude - delta / 2,
                    maxLat: loc.latitude + delta / 2,
                    minLng: loc.longitude - delta / 2,
                    maxLng: loc.longitude + delta / 2,
                });
                console.log('[MapScreen GPS] visibleBounds set, delta:', delta);
                setCurrentZoom(Math.log2(360 / delta));

                // A web, el ref del mapa pot no estar llest exactament en aquest tick.
                const region = {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    latitudeDelta: delta,
                    longitudeDelta: delta,
                };
                if (Platform.OS === 'web') {
                    [0, 220, 500].forEach((ms) => {
                        setTimeout(() => {
                            mapRefNative.current?.animateToRegion(region, 0);
                        }, ms);
                    });
                } else {
                    setTimeout(() => {
                        mapRefNative.current?.animateToRegion(region, 0);
                    }, 0);
                }
            };

            try {
                console.log('[MapScreen GPS] Requesting foreground permissions...');
                const { status } = await Location.requestForegroundPermissionsAsync();
                console.log('[MapScreen GPS] Permission status:', status);

                if (status !== 'granted') {
                    console.warn('[MapScreen GPS] Permís de localització denegat, usant fallback Camp Nou');
                    showAlert({
                        tone: 'info',
                        eyebrow: 'Ubicacio no disponible',
                        message: 'Sense permisos de localitzacio. Et situem al Camp Nou.',
                        duration: 4500,
                    });
                    const fallback = CAMP_NOU_FALLBACK;
                    setUserLocation({
                        coords: { ...fallback, altitude: 0, accuracy: 0, altitudeAccuracy: 0, heading: 0, speed: 0 },
                        timestamp: Date.now(),
                    });
                    applyInitialRegion(fallback);
                    return;
                }

                console.log('[MapScreen GPS] Getting current position...');
                const location = await Location.getCurrentPositionAsync({});
                console.log('[MapScreen GPS] Location obtained:', location.coords.latitude, location.coords.longitude);
                const rawLat = location.coords.latitude;
                const rawLng = location.coords.longitude;
                const useFallback = Platform.OS === 'android' && isLikelyEmulatorDefaultLocation(rawLat, rawLng);
                const resolved = useFallback ? CAMP_NOU_FALLBACK : { latitude: rawLat, longitude: rawLng };
                if (useFallback) {
                    console.warn('[MapScreen GPS] Coordenada per defecte de l\'emulador detectada. Usem Camp Nou.');
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
                console.warn('[MapScreen GPS] Error obtaining location. Using Camp Nou as fallback.', e);
                showAlert({
                    tone: 'warning',
                    eyebrow: 'GPS no disponible',
                    message: 'No hem pogut obtenir la ubicacio. Et situem al Camp Nou.',
                    duration: 5000,
                });
                applyInitialRegion(CAMP_NOU_FALLBACK);
            }

        })();

    }, []);



    // 2. Carregar bars (filtrats per matchId si venim de la pantalla de partits)

    // Recarregar cada cop que la pantalla rep focus (p.ex. després de reportar un bar)

    const loadBars = useCallback(async () => {

        try {
            console.log('[MapScreen] loadBars() started');
            const firestoreBars = await fetchBars();
            console.log('[MapScreen] fetchBars() completed, bars:', firestoreBars.length);
            setBars(firestoreBars);
        } catch (error) {
            console.warn('[MapScreen] Error carregant bars:', error);
            // Fins i tot si hi ha error, marquem com a carregat per desactivar el splash
            setBars([]);
        } finally {
            console.log('[MapScreen] Setting initialBarsLoaded = true');
            setInitialBarsLoaded(true);
        }

    }, []);

    // Recarregar bars quan tornem de ReportBar amb paràmetre refresh
    // (useFocusEffect no es dispara perquè ReportBar és un transparentModal)
    useEffect(() => {
        if (refreshParam) {
            shouldRestoreAfterReportRef.current = true;
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
            // Arrodonim a 2 decimals (~1.1 km) per agrupar bbox semblants a la cache
            const key = `${minLat.toFixed(2)},${maxLat.toFixed(2)},${minLng.toFixed(2)},${maxLng.toFixed(2)}`;
            const last = bboxCacheRef.current.get(key);
            if (last && Date.now() - last < BBOX_CACHE_TTL_MS) return; // ja és recent
            bboxCacheRef.current.set(key, Date.now());
            try {
                const extra = await fetchBarsInBounds(minLat, maxLat, minLng, maxLng, 300);
                if (extra.length === 0) return;
                setBars((prev) => {
                    const seen = new Set(prev.map((b) => b.id));
                    const merged = prev.slice();
                    extra.forEach((b) => { if (!seen.has(b.id)) merged.push(b); });
                    return merged;
                });
            } catch {
                /* ignore */
            }
        }, 400);
        return () => {
            if (bboxFetchTimerRef.current) clearTimeout(bboxFetchTimerRef.current);
        };
    }, [visibleBounds]);

    // Navegar a ReportBar centrant el mapa sobre el bar
    const navigateToReportBar = useCallback((osmBar: any) => {
        shouldRestoreAfterReportRef.current = false;
        // Guardar posici\u00f3 actual del mapa (per restaurar-la quan tornem)
        if (mapRefNative.current) {
            preReportPositionRef.current = {
                lat: centerLocation?.latitude || osmBar.lat,
                lng: centerLocation?.longitude || osmBar.lon,
                zoom: currentZoom,
            };
            // Sense zoom for\u00e7at: nom\u00e9s una recol\u00b7locaci\u00f3 suau si el bar
            // \u00e9s a prop, perqu\u00e8 ja \u00e9s visible. Evitem el "zoom massa b\u00e8stia".
        }
        navigation.navigate('ReportBar' as any, { osmBar });
    }, [centerLocation, currentZoom, navigation]);

    // Restaurar posició del mapa quan ReportBar es tanca (detectat via canvi d'estat de navegació)
    useEffect(() => {
        const unsubscribe = navigation.addListener('state', (e: any) => {
            const state = e.data?.state;
            if (!state) return;
            const routes = state.routes || [];
            const hasReportBar = routes.some((r: any) => r.name === 'ReportBar');
            if (!hasReportBar && preReportPositionRef.current) {
                const saved = preReportPositionRef.current;
                preReportPositionRef.current = null;
                if (!shouldRestoreAfterReportRef.current) {
                    return;
                }
                shouldRestoreAfterReportRef.current = false;
                // Restaurar posició amb un petit retard per permetre l'animació de tancament
                setTimeout(() => {
                    if (mapRefNative.current) {
                        const delta = 360 / (Math.pow(2, saved.zoom) * 256) * height;
                        mapRefNative.current.animateToRegion({
                            latitude: saved.lat,
                            longitude: saved.lng,
                            latitudeDelta: delta || MAP_REGION_DELTA,
                            longitudeDelta: delta || MAP_REGION_DELTA,
                        }, 500);
                    }
                }, 300);
            }
        });
        return unsubscribe;
    }, [navigation, height]);

    useFocusEffect(

        useCallback(() => {

            console.log('[MapScreen] Focus effect: calling loadBars()');
            loadBars();
            // Recarregar preferències (categoria pot haver canviat a SettingsModal)
            if (user) {
                getUserPreferences(user.id).then(prefs => {
                    setSearchRadiusKm(prefs.display.searchRadius / 1000);
                    if (prefs.display.defaultCategory) {
                        setDefaultCategory(prefs.display.defaultCategory);
                    }
                }).catch(() => {});
            }
            // Tancar desplegables en tornar a la pantalla
            setShowFiltersPanel(false);
            setGeoSuggestions([]);

        }, [loadBars])

    );



    // 4. Lògica de filtratge (només viewport)

     useEffect(() => {

        if (!centerLocation) return; // Esperant ubicació

        // Helper: aplicar filtres (open_now usa períodes cachejats, NO el camp estàtic isOpen)
        const applyFilters = (list: Bar[]) => {
            if (activeFilters.size === 0) return list;
            return list.filter(b => {
                // Filtre obert/tancat: usar períodes cachejats de Google Places
                if (activeFilters.has('open_now')) {
                    const openStatus = isOpenNow(b.openingPeriods);
                    if (openStatus === false) return false;
                }

                // Filtre projector: incloure multiple_screens
                if (activeFilters.has('projector') && !(b.amenities?.some(a => a === 'projector' || a === 'multiple_screens'))) return false;
                // Tots els altres filtres d'amenities: comprovació dinàmica
                const amenityKeys = AMENITY_OPTIONS.map(a => a.key).filter(k => k !== 'projector');
                for (const key of amenityKeys) {
                    if (activeFilters.has(key) && !(b.amenities?.includes(key))) return false;
                }
                return true;
            });
        };

        // Si hi ha un partit seleccionat (filtre overlay), pre-filtrar per bars que l'emeten
        const activeMatchId = selectedMatch?.id ?? null;
        const barsPool = activeMatchId
            ? bars.filter(b => b.broadcastingMatches?.includes(activeMatchId))
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



    }, [centerLocation, visibleBounds, bars, selectedMatch, currentZoom, activeFilters]);



    // 5. Netejar scannedBars quan es recarreguen els bars (eliminar els ja registrats)

    useEffect(() => {

        if (bars.length === 0 || scannedBars.length === 0) return;

        const cleaned = scannedBars.filter(osmItem => {

            return !bars.some(b => {

                if (b.id === osmItem.id) return true;

                const dist = getDistanceFromLatLonInKm(osmItem.lat, osmItem.lon, b.latitude, b.longitude);

                return dist < 0.05;

            });

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

        if (!centerLocation) return;

        setIsScanning(true);

        try {

            // Usar els bounds visibles del mapa si estan disponibles, sinó radi

            const osmData = visibleBounds
                ? await fetchBarsFromOSMBounds(visibleBounds.minLat, visibleBounds.minLng, visibleBounds.maxLat, visibleBounds.maxLng)
                : await fetchBarsFromOSM(centerLocation.latitude, centerLocation.longitude, searchRadiusKm);

            

            // Deduplicar contra els bars de FIRESTORE

            const newScanned = osmData.filter(osmItem => {

                const alreadyExists = bars.some(b => {

                     // Comprovar per ID o proximitat

                     if (b.id === osmItem.id) return true;

                     const dist = getDistanceFromLatLonInKm(osmItem.lat, osmItem.lon, b.latitude, b.longitude);

                     return dist < 0.05; 

                });

                return !alreadyExists;

            });

            

            // Deduplicar contra bars ja escanejats (acumulació)

            setScannedBars(prev => {

                const combined = [...prev, ...newScanned];

                // Únics per ID

                const unique = Array.from(new globalThis.Map(combined.map(item => [item.id, item])).values()) as OSMBar[];

                return unique;

            });



        } catch (e) {

            console.error(e);

            showAlert({
                tone: 'error',
                eyebrow: 'Servei no disponible',
                message: "No hem pogut connectar amb el servidor de mapes. Torna-ho a provar d'aquí uns segons.",
                duration: 6000,
            });

        } finally {

            setIsScanning(false);

        }

    };



    // Commutador: El botó crida aquesta funció

    const handleScanToggle = () => {

        if (scannedBars.length > 0) {

            setScannedBars([]); // Amagar/Netejar

        } else {

            // Avisar de la convenció de marcadors grisos abans/durant la cerca
            showAlert({
                tone: 'info',
                eyebrow: 'Avís',
                message: "En gris trobar\u00e0s bars sense confirmar. Clica'ls per avisar si donen el partit!",
                duration: 5000,
                position: 'top',
                offset: mobileDropdownTop + 12,
            });
            handleManualScan(); // Cercar

        }

    };

    // 3. Carregar partits per al bàner
    useEffect(() => {

        let isMounted = true;

        // Helper per detectar si un partit és femení
        const isFemenino = (match: Match | any): boolean => {
            const getTeamName = (t: any) => (typeof t === 'string' ? t : (t?.name || t?.shortName || ''));
            const homeName = getTeamName(match.homeTeam).toLowerCase();
            const awayName = getTeamName(match.awayTeam).toLowerCase();
            const leagueName = (match.league || '').toLowerCase();
            return match.category === 'femenino' ||
                   homeName.includes('women') || awayName.includes('women') ||
                   homeName.includes('femeni') || awayName.includes('femeni') ||
                   leagueName.includes('liga f') || leagueName.includes('femen');
        };

        const loadMatches = async () => {

            try {

                const { matches } = await fetchAllMatches();

                if (isMounted && matches && matches.length > 0) {

                    const now = new Date();

                    const upcoming = matches

                        .filter(m => {

                            // @ts-ignore

                            const d = m.date && m.date.toDate ? m.date.toDate() : new Date(m.date);

                            return d > now;

                        })

                        .sort((a, b) => {

                            // @ts-ignore

                            const dA = a.date && a.date.toDate ? a.date.toDate() : new Date(a.date);

                            // @ts-ignore

                            const dB = b.date && b.date.toDate ? b.date.toDate() : new Date(b.date);

                            return dA.getTime() - dB.getTime();

                        });

                    // Filtrar per categoria preferida
                    const catFiltered = upcoming.filter(m => {
                        if (defaultCategory === 'all') return true;
                        const isFem = isFemenino(m);
                        return defaultCategory === 'femenino' ? isFem : !isFem;
                    });

                    // nextMatch respecta la preferència de categoria
                    const preferredUpcoming = catFiltered.length > 0 ? catFiltered : upcoming;

                    if (preferredUpcoming.length > 0) {

                        setNextMatch(preferredUpcoming[0]);

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

                console.warn("Failed to load matches for map banner", e);

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
    const updateBarCardAnchor = useCallback(async () => {
        if (!selectedBar || !mapRefNative.current?.pointForCoordinate) {
            setBarCardAnchorY(null);
            setBarCardAnchorX(null);
            return;
        }
        try {
            const point = await mapRefNative.current.pointForCoordinate({
                latitude: selectedBar.latitude,
                longitude: selectedBar.longitude,
            });
            if (point && typeof point.y === 'number' && typeof point.x === 'number') {
                setBarCardAnchorY(point.y);
                setBarCardAnchorX(point.x);
            }
        } catch {
            setBarCardAnchorY(null);
            setBarCardAnchorX(null);
        }
    }, [selectedBar]);





    // 5. Lògica del bar seleccionat (sincronitzat)

    useEffect(() => {

         // Reiniciar estat de la bafarada

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


         // Natiu: Centrar exactament sobre el bar

         if (selectedBar && mapRefNative.current) {

             const newRegion = {

                // Desplacem el centre de la càmera "amunt" (valors de latitud positius)

                // perquè el pin en si quedi arrossegat cap a la part "més baixa" de la pantalla

                latitude: selectedBar.latitude + CAMERA_LAT_OFFSET,

                longitude: selectedBar.longitude,

                latitudeDelta: MAP_REGION_DELTA,

                longitudeDelta: MAP_REGION_DELTA,

             };

             mapRefNative.current.animateToRegion(newRegion, 500);

             // Un cop la càmera s'ha assentat, calculem on ha quedat el pin en
             // pantalla per ancorar la targeta just a sobre seu.
             setTimeout(() => { updateBarCardAnchor(); }, 520);

             // Obtenir info de ruta (distància / temps caminant)
             fetchRoute(selectedBar);
         } else {
             setBarCardAnchorY(null);
             setBarCardAnchorX(null);
         }



         // Google Places Details: obtenir, després marcar la bafarada com a preparada

         if (selectedBar) {

             setPlaceDetails(null);

             setLoadingPlaceDetails(true);

             setSelectedBarReviewStats({ averageRating: 0, totalReviews: 0 });

             // Carregar ressenyes internes en paral·lel amb placeDetails
             getBarReviewStats(selectedBar.id)
                 .then(stats => setSelectedBarReviewStats(stats))
                 .catch(() => {});

             const cleanName = getCleanBarName(selectedBar.name);

             // Si ja tenim googlePlaceId → 1 sola crida (getPlaceDetails)
             // Si no → 2 crides (searchText + getPlaceDetails), però guardem el placeId per la pròxima
             fetchBarPlaceDetails(cleanName, selectedBar.latitude, selectedBar.longitude, selectedBar.googlePlaceId)

                 .then((details) => {
                     setPlaceDetails(details);
                     // Cacheja placeId + períodes + amenitats a Firestore (0 crides API extra)
                     if (details) {
                         cacheBarPlaceData(selectedBar, details).catch(() => {});
                     }
                 })

                 .catch(() => setPlaceDetails(null))

                 .finally(() => {

                     setLoadingPlaceDetails(false);

                 });

         } else {

             setPlaceDetails(null);

         }



    }, [selectedBar, isDesktop]);



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

    // Cerca Nominatim (OpenStreetMap) — substitueix Google Places Autocomplete
    const searchNominatim = useCallback(async (query: string) => {
        if (query.length < 3) { setGeoSuggestions([]); return; }
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=es&accept-language=ca`,
                { headers: { 'User-Agent': 'troBar/1.3 (contact@trobar.app)' } }
            );
            const data = await res.json();
            setGeoSuggestions(data);
        } catch (e) {
            console.error('Error Nominatim:', e);
            setGeoSuggestions([]);
        }
    }, []);

    const handleSearchInput = useCallback((text: string) => {
        setSearchQuery(text);
        setShowFiltersPanel(false); // Tancar filtres quan es busca
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => searchNominatim(text), 350);
    }, [searchNominatim]);

    const selectGeoSuggestion = useCallback((s: {display_name: string, lat: string, lon: string}) => {
        const newLocation = { latitude: parseFloat(s.lat), longitude: parseFloat(s.lon) };
        setCenterLocation(newLocation);
        setSearchQuery(s.display_name.split(',').slice(0, 2).join(','));
        setGeoSuggestions([]);
        if (mapRefNative.current) {
            mapRefNative.current.animateToRegion({
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 500);
        }
    }, []);



    const fetchRoute = async (bar: Bar) => {

        if (!centerLocation) return;

        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

        if (!apiKey) return;



        await executeRequest(async () => {

            const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {

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

            });

            const result = await response.json();

            if (result.routes && result.routes.length > 0) {

                const route = result.routes[0];

                // Calcular informació de ruta

                const durationSeconds = parseInt(route.duration.replace('s', ''));

                const durationText = durationSeconds > 3600 

                    ? `${Math.floor(durationSeconds/3600)} h ${Math.floor((durationSeconds%3600)/60)} min`

                    : `${Math.floor(durationSeconds/60)} min`;

                const distanceKm = (route.distanceMeters / 1000).toFixed(1) + ' km';

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

         let target = userLocation ? {
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
         } : null;

         try {
            const fresh = await Location.getCurrentPositionAsync({});
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
         } catch {
            // Si falla la lectura en viu, fem servir l'última ubicació coneguda.
         }

         if (!target) return;

         setCenterLocation(target);
         setSearchQuery('');
         setGeoSuggestions([]);

         if (mapRefNative.current) {
             mapRefNative.current.animateToRegion({
                latitude: target.latitude, longitude: target.longitude,
                latitudeDelta: 0.01, longitudeDelta: 0.01,
             }, 500);
         }

    };



     const openExternalMaps = (bar: Bar) => {

        const lat = bar.latitude;

        const lng = bar.longitude;



        // Origen (si disponible)

        const originLat = userLocation?.coords.latitude ?? centerLocation?.latitude;

        const originLng = userLocation?.coords.longitude ?? centerLocation?.longitude;



        // URLs per a cada app

        const googleUrl = (() => {
            const destinationQuery = encodeURIComponent(
                `${getCleanBarName(bar.name)}, ${bar.address || ''}`
            );
            let u = `https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}&travelmode=walking`;

            if (bar.googlePlaceId) u += `&destination_place_id=${encodeURIComponent(bar.googlePlaceId)}`;

            if (originLat != null && originLng != null) u += `&origin=${originLat},${originLng}`;

            return u;

        })();



        const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;



        // Apple Maps (només iOS)

        const appleMapsUrl = originLat != null

            ? `http://maps.apple.com/?daddr=${lat},${lng}&saddr=${originLat},${originLng}&dirflg=w`

            : `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`;



        if (Platform.OS === 'web') {

            // Al web, Alert.alert amb m\u00faltiples bot\u00f3 no exposa callbacks; obrim

            // directament Google Maps en una pestanya nova.

            try {

                if (typeof window !== 'undefined' && window.open) {

                    window.open(googleUrl, '_blank', 'noopener,noreferrer');

                } else {

                    Linking.openURL(googleUrl);

                }

            } catch {

                Linking.openURL(googleUrl);

            }

            return;

        }



        if (Platform.OS === 'ios') {

            Alert.alert(

                'Obrir amb…',

                `Navegar a ${bar.name}`,

                [

                    { text: 'Google Maps', onPress: () => Linking.openURL(googleUrl) },

                    { text: 'Apple Maps', onPress: () => Linking.openURL(appleMapsUrl) },

                    { text: 'Waze', onPress: () => Linking.openURL(wazeUrl) },

                    { text: 'Cancel·la', style: 'cancel' },

                ],

            );

        } else {

            Alert.alert(

                'Obrir amb…',

                `Navegar a ${bar.name}`,

                [

                    { text: 'Google Maps', onPress: () => Linking.openURL(googleUrl) },

                    { text: 'Waze', onPress: () => Linking.openURL(wazeUrl) },

                    { text: 'Cancel·la', style: 'cancel' },

                ],

            );

        }

    };

    const handleSelectBar = useCallback((bar: Bar) => {
        lastMarkerPressRef.current = Date.now();
        console.log('[MapScreen] Marker selected:', bar.name);
        if (selectedBar?.id !== bar.id) {
            // Si canviem de bar, esborrem la ruta anterior immediatament.
            setRouteInfo(null);
            setRouteCoords(null);
        }
        setSelectedBar(bar);
    }, [selectedBar?.id]);



    const closeBarBubble = () => {

        Animated.parallel([

            Animated.timing(bubbleScale, {

                toValue: 0,

                duration: 200,

                easing: Easing.in(Easing.back(2)),

                useNativeDriver: true,

            }),

            Animated.timing(bubbleOpacity, {

                toValue: 0,

                duration: 150,

                useNativeDriver: true,

            }),

        ]).start(() => {

            setSelectedBar(null);

            setBubbleReady(false);

            setShowBarProfile(false);

        });
        // Tancar desplegables de cerca/filtres
        setShowFiltersPanel(false);
        setGeoSuggestions([]);

    };

    const handleMapPress = useCallback(() => {
        // react-native-maps iOS can bubble a marker tap to MapView.onPress.
        // Do not close the card that was just opened by that same tap.
        if (Date.now() - lastMarkerPressRef.current < 700) {
            console.log('[MapScreen] Ignoring bubbled map press after marker tap');
            return;
        }
        // Amb un toc explícit al mapa fora d'un bar: netegem selecció i ruta.
        closeBarBubble();
        setRouteInfo(null);
        setRouteCoords(null);
    }, [closeBarBubble]);



    // --- RENDERITZATS ---



    const renderContentPanel = () => {

         if (selectedBar) {

            const distanceText = routeInfo 

                ? `${routeInfo.duration} caminant (${routeInfo.distance})`

                : `A ${getDistanceFromLatLonInKm(centerLocation!.latitude, centerLocation!.longitude, selectedBar.latitude, selectedBar.longitude).toFixed(1)} km`;



            return (

                <BarCard

                    name={selectedBar.name}

                    address={selectedBar.address}

                    latitude={selectedBar.latitude}

                    longitude={selectedBar.longitude}

                    placeDetails={placeDetails}

                    loadingPlaceDetails={loadingPlaceDetails}

                    verified={true}

                    fallbackRating={selectedBar.rating}

                    fallbackIsOpen={isOpenNow(selectedBar.openingPeriods)}

                    distanceText={distanceText}

                    onClose={() => closeBarBubble()}

                    onNavigate={() => openExternalMaps(selectedBar)}

                    tier={selectedBar.tier || 'free'}

                    onProfileOpen={() => setShowBarProfile(true)}

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
        const opts: { key: string; label: string; icon: string; iconFamily?: 'feather' | 'mci'; category?: string }[] = [
            { key: 'open_now', label: 'Oberts ara', icon: 'clock', iconFamily: 'feather' },
        ];
        // Totes les amenities agrupades
        AMENITY_OPTIONS.forEach(a => {
            opts.push({ key: a.key, label: a.label, icon: a.icon, iconFamily: a.iconFamily, category: a.category });
        });
        return opts;
    }, []);

    const toggleFilter = useCallback((key: string) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const renderFiltersPanel = () => {
        // Separar filtres especials (sense categoria) dels d'amenities
        const specialFilters = FILTER_OPTIONS.filter(f => !f.category);
        const amenityFilters = FILTER_OPTIONS.filter(f => !!f.category);
        // Agrupar per categoria
        const grouped = AMENITY_CATEGORIES.map(cat => ({
            ...cat,
            items: amenityFilters.filter(f => f.category === cat.key),
        })).filter(g => g.items.length > 0);

        const renderFilterRow = (f: typeof FILTER_OPTIONS[0]) => {
            const isActive = activeFilters.has(f.key);
            const IconComp = f.iconFamily === 'mci' ? MaterialCommunityIcons : Feather;
            return (
                <TouchableOpacity
                    key={f.key}
                    style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingVertical: 10, paddingHorizontal: 14,
                        backgroundColor: isActive ? 'rgba(0,77,152,0.08)' : 'transparent',
                    }}
                    onPress={() => toggleFilter(f.key)}
                >
                    <View style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: isActive ? SKETCH_THEME.colors.primary : 'rgba(0,0,0,0.06)',
                        justifyContent: 'center', alignItems: 'center', marginRight: 10,
                    }}>
                        <IconComp name={f.icon as any} size={14} color={isActive ? 'white' : SKETCH_THEME.colors.textMuted} />
                    </View>
                    <Text style={{
                        flex: 1, fontSize: 14, fontFamily: 'Lora',
                        color: isActive ? SKETCH_THEME.colors.primary : SKETCH_THEME.colors.text,
                        fontWeight: isActive ? '600' : '400',
                    }}>{f.label}</Text>
                    {isActive && <Feather name="check" size={16} color={SKETCH_THEME.colors.primary} />}
                </TouchableOpacity>
            );
        };

        return (
            <View style={{
                backgroundColor: SKETCH_THEME.colors.card,
                borderRadius: 12,
                borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
                overflow: 'hidden',
                maxHeight: height * 0.55,
                ...Platform.select({
                    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10 },
                    android: { elevation: 10 },
                    default: {},
                }),
            }}>
                <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Lora', fontWeight: '700', color: SKETCH_THEME.colors.text }}>Filtres</Text>
                    {activeFilters.size > 0 && (
                        <TouchableOpacity onPress={() => setActiveFilters(new Set())}>
                            <Text style={{ fontSize: 12, fontFamily: 'Lora', color: SKETCH_THEME.colors.primary }}>Netejar tot</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView
                    style={{ maxHeight: height * 0.48 }}
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Filtres especials: obert ara, confirmat que emet */}
                    {specialFilters.map(renderFilterRow)}

                    {/* Separador */}
                    <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 4, marginHorizontal: 14 }} />

                    {/* Amenities agrupades per categoria */}
                    {grouped.map(cat => (
                        <View key={cat.key}>
                            <Text style={{
                                fontSize: 11, fontFamily: 'Lora', fontWeight: '700',
                                color: SKETCH_THEME.colors.textMuted,
                                textTransform: 'uppercase', letterSpacing: 0.8,
                                paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2,
                            }}>
                                {cat.label}
                            </Text>
                            {cat.items.map(renderFilterRow)}
                        </View>
                    ))}
                </ScrollView>
                <View style={{ height: 8 }} />
            </View>
        );
    };

    const renderSearchBarInput = () => {

        const placeholderText = "On vols veure el partit?";
        const hasActiveFilters = activeFilters.size > 0;

        const filterIconButton = (
            <TouchableOpacity
                onPress={() => {
                    setShowFiltersPanel(v => !v);
                    setGeoSuggestions([]); // Tancar suggeriments quan obrim filtres
                }}
                style={{
                    marginLeft: 6,
                    width: 32, height: 32, borderRadius: 8,
                    backgroundColor: hasActiveFilters ? SKETCH_THEME.colors.primary : 'transparent',
                    justifyContent: 'center', alignItems: 'center',
                }}
            >
                <Feather name="sliders" size={18} color={hasActiveFilters ? 'white' : SKETCH_THEME.colors.text} />
                {hasActiveFilters && (
                    <View style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 16, height: 16, borderRadius: 8,
                        backgroundColor: SKETCH_THEME.colors.gold,
                        justifyContent: 'center', alignItems: 'center',
                    }}>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: SKETCH_THEME.colors.text }}>{activeFilters.size}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );

        // Input natiu
        return (
             <View style={styles.searchBar}>
                <Feather name="search" size={18} color={SKETCH_THEME.colors.textMuted} style={{marginRight: 10}} />
                <TextInput 
                    placeholder={placeholderText} 
                    style={[styles.searchInput, { flex: 1 }]}
                    placeholderTextColor="rgba(15,27,45,0.4)"
                    value={searchQuery}
                    onChangeText={handleSearchInput}
                    onSubmitEditing={() => searchNominatim(searchQuery)}
                />
                {searchQuery !== '' && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); setGeoSuggestions([]); centerMapToGPS(); }} style={{marginRight: 4}}>
                        <Feather name="x" size={16} color={SKETCH_THEME.colors.textMuted} />
                    </TouchableOpacity>
                )}
                {filterIconButton}
            </View>
        );
    };

    /** Overlay flotant per suggeriments i filtres — renderitzat al nivell superior de la pantalla */
    const renderSearchDropdownOverlay = () => {
        const showSuggestions = geoSuggestions.length > 0 && !showFiltersPanel;
        if (!showSuggestions && !showFiltersPanel) return null;

        // Desktop: dins del sidebar, no necessita posicionament absolut
        if (isDesktop) {
            return (
                <View style={{ zIndex: 9999 }}>
                    {showSuggestions && (
                        <View style={{
                            backgroundColor: SKETCH_THEME.colors.card,
                            borderRadius: 12,
                            borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
                            overflow: 'hidden',
                            ...Platform.select({ default: {} }),
                        }}>
                            {geoSuggestions.map((s, i) => (
                                <TouchableOpacity
                                    key={`${s.lat}-${s.lon}-${i}`}
                                    style={{
                                        paddingVertical: 10, paddingHorizontal: 14,
                                        borderBottomWidth: i < geoSuggestions.length - 1 ? 1 : 0,
                                        borderBottomColor: 'rgba(0,0,0,0.06)',
                                    }}
                                    onPress={() => selectGeoSuggestion(s)}
                                >
                                    <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: 'Lora', color: SKETCH_THEME.colors.text }}>
                                        {s.display_name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    {showFiltersPanel && renderFiltersPanel()}
                </View>
            );
        }

        // Mòbil: posicionament absolut sobre el mapa
        return (
            <View
                style={{
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
                        backgroundColor: SKETCH_THEME.colors.card,
                        borderRadius: 12,
                        borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
                        overflow: 'hidden',
                        ...Platform.select({
                            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10 },
                            android: { elevation: 10 },
                            default: {},
                        }),
                    }}>
                        {geoSuggestions.map((s, i) => (
                            <TouchableOpacity
                                key={`${s.lat}-${s.lon}-${i}`}
                                style={{
                                    paddingVertical: 12, paddingHorizontal: 14,
                                    borderBottomWidth: i < geoSuggestions.length - 1 ? 1 : 0,
                                    borderBottomColor: 'rgba(0,0,0,0.06)',
                                }}
                                onPress={() => selectGeoSuggestion(s)}
                            >
                                <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: 'Lora', color: SKETCH_THEME.colors.text }}>
                                    {s.display_name}
                                </Text>
                            </TouchableOpacity>
                        ))}
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

        <View style={isDesktop ? styles.desktopSidebarContent : [styles.topBarContainer, { top: mobileHeaderTop }]}>

             <View style={{flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between'}}>

                 <View style={{flex: 1}}>

                     {renderSearchBarInput()}

                 </View>

                 {!user && (

                    <TouchableOpacity 

                        style={{ marginLeft: 10, padding: 8 }}

                        onPress={() => navigation.navigate('Login' as any)}

                    >

                        <Feather name="user" size={24} color={SKETCH_THEME.colors.text} />

                    </TouchableOpacity>

                 )}

             </View>

             

             {/* Bàner del partit — seleccionat o pròxim */}

             {(selectedMatch || nextMatch) && (

                <View style={{ marginTop: 8, marginHorizontal: 4 }}>

                    {selectedMatch ? (
                        <MatchCard
                            match={selectedMatch}
                            compact={true}
                            isFilter={true}
                            showDismiss={!!matchIdFromNav}
                            onToggleFilter={() => {
                                setSelectedMatch(null);
                                navigation.setParams({ matchId: undefined });
                            }}
                            onDismissFilter={() => {
                                setSelectedMatch(null);
                                navigation.setParams({ matchId: undefined });
                            }}
                        />
                    ) : nextMatch ? (
                        <MatchCard
                            match={nextMatch}
                            compact={true}
                            isNextMatch={true}
                            onToggleFilter={() => setSelectedMatch(nextMatch)}
                        />
                    ) : null}

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

                    <View style={{flex: 1, paddingHorizontal: 16}}>

                        {renderContentPanel()}

                    </View>

                </View>

            )}



             {/* ÀREA DEL MAPA */}

             <View style={styles.mapContainer}>

                    <MapView
                        ref={mapRefNative}
                        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                        style={styles.map}
                        customMapStyle={CUSTOM_MAP_STYLE}
                        initialRegion={{
                            latitude: centerLocation?.latitude ?? 41.3851,
                            longitude: centerLocation?.longitude ?? 2.1734,
                            latitudeDelta: radiusToLatDelta(searchRadiusKm),
                            longitudeDelta: radiusToLatDelta(searchRadiusKm),
                        }}
                        showsUserLocation={true}
                        showsMyLocationButton={false}
                        toolbarEnabled={false}
                        onLayout={() => {
                            if (!mapReady) {
                                setMapReady(true);
                                console.log('[MapScreen] Map layout ready - using layout fallback');
                            }
                        }}
                        onMapReady={() => {
                            setMapReady(true);
                            console.log('[MapScreen] Map ready - mapReady = true');
                        }}
                        onPress={handleMapPress}
                        onRegionChangeComplete={(region: any) => {
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
                            if (selectedBar) updateBarCardAnchor();
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
                                         key={`cluster-${props.clusterKind}-${props.cluster_id}`}
                                         coordinate={{ latitude: lat, longitude: lng }}
                                         count={count}
                                         size={size}
                                         muted={onlyScanned}
                                         zIndex={onlyScanned ? 30 : 50}
                                         onPress={() => {
                                             // En clicar el clúster, ampliem zoom cap al centre del clúster
                                             const next = Math.min(20, Math.max(currentZoom + 2, 14));
                                             const newDelta = 360 / Math.pow(2, next);
                                             const region = {
                                                 latitude: lat,
                                                 longitude: lng,
                                                 latitudeDelta: newDelta,
                                                 longitudeDelta: newDelta,
                                             };
                                             if (mapRefNative.current?.animateToRegion) {
                                                 mapRefNative.current.animateToRegion(region, 350);
                                             }
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
                                    key={`bar-${bar.id}`}
                                    bar={bar}
                                    isPremium={isPremium}
                                    isSelected={isSelected}
                                    onPress={() => handleSelectBar(bar)}
                                />
                             );
                         })}

                        {/* Ruta caminant fins al bar seleccionat */}
                        {routeCoords && routeCoords.length > 1 && (
                            <Polyline
                                coordinates={routeCoords}
                                strokeColor={EDITORIAL.grana}
                                strokeWidth={4}
                                zIndex={5}
                            />
                        )}

                    </MapView>

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
                            { bottom: mobileFabBottom },
                        ]}
                        onPress={centerMapToGPS}
                        accessibilityLabel="Centrar a la meva ubicaci\u00f3"
                    >
                        <Image source={MAP_TARGET_3D} style={{ width: 26, height: 26 }} resizeMode="contain" />
                    </TouchableOpacity>

                    {(() => {
                        if (matchIdFromNav) return null;
                        const visibleWidthKm = visibleBounds
                            ? getDistanceFromLatLonInKm(visibleBounds.minLat, visibleBounds.minLng, visibleBounds.minLat, visibleBounds.maxLng)
                            : 0;
                        if (visibleBounds && visibleWidthKm > 2) return null;
                        return (
                            <TouchableOpacity
                                style={[
                                    styles.fabGps,
                                    { bottom: mobileFabBottom + 52 },
                                ]}
                                onPress={handleScanToggle}
                                disabled={isScanning}
                                accessibilityLabel={scannedBars.length > 0 ? 'Amagar bars sense confirmar' : 'Cercar bars a la zona visible'}
                            >
                                {isScanning ? (
                                    <ActivityIndicator size="small" color={EDITORIAL.grana} />
                                ) : scannedBars.length > 0 ? (
                                    <Image source={MAP_PIN_SCANNED_3D} style={{ width: 26, height: 26, opacity: 0.55 }} resizeMode="contain" />
                                ) : (
                                    <Image source={MAP_ZOOM_3D} style={{ width: 26, height: 26 }} resizeMode="contain" />
                                )}
                            </TouchableOpacity>
                        );
                    })()}



                    {/* Targeta de detall del bar (mòbil) — bafarada flotant que apareix
                        quan s'ha seleccionat un bar. Reutilitza renderContentPanel(),
                        que ja sap dibuixar la BarCard si selectedBar != null.
                        S'ancora just a sobre del pin seleccionat (via barCardAnchorY);
                        si encara no sabem la posició en pantalla, cau a baix per defecte. */}
                    {selectedBar && (() => {
                        const GAP_ABOVE_PIN = 14;
                        const cardTop = barCardAnchorY != null
                            ? Math.max(
                                mobileHeaderTop + 66,
                                Math.min(barCardAnchorY - barCardHeight - GAP_ABOVE_PIN, height - barCardHeight - mobileFabBottom)
                              )
                            : null;
                        // Triangle de bafarada: centrat sobre el pin (barCardAnchorX),
                        // acotat perquè no surti fora dels marges de la targeta.
                        const TRIANGLE_HALF = 9;
                        const triangleX = barCardAnchorX != null
                            ? Math.min(Math.max(barCardAnchorX - TRIANGLE_HALF, 12 + 14), width - 12 - 14 - TRIANGLE_HALF * 2)
                            : null;
                        const showTriangle = cardTop != null && triangleX != null;
                        return (
                        <View
                            pointerEvents="box-none"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 1000,
                                elevation: 1000,
                            }}
                        >
                        <Animated.View
                            onLayout={(e) => setBarCardHeight(e.nativeEvent.layout.height)}
                            style={{
                                position: 'absolute',
                                left: 12,
                                right: 12,
                                bottom: mobileFabBottom + 10,
                                opacity: 1,
                                transform: [{ scale: 1 }],
                                zIndex: 100,
                                backgroundColor: EDITORIAL.paper,
                                borderRadius: 8,
                                padding: 16,
                                borderWidth: 1,
                                borderColor: EDITORIAL.hairlineStrong,
                                ...(selectedBar.tier === 'premium' && {
                                    borderLeftWidth: 4,
                                    borderLeftColor: EDITORIAL.grana,
                                }),
                                ...Platform.select({
                                    web: { boxShadow: '0 8px 24px rgba(15,27,45,0.18)' } as any,
                                    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12 },
                                    android: { elevation: 12 },
                                }),
                            }}
                        >
                            {/* Botó tancar */}
                            <TouchableOpacity
                                onPress={() => closeBarBubble()}
                                style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    backgroundColor: EDITORIAL.granaSoft,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    zIndex: 30,
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Feather name="x" size={16} color={EDITORIAL.grana} />
                            </TouchableOpacity>
                            {renderContentPanel()}
                        </Animated.View>
                        {showTriangle && (
                            <React.Fragment>
                                {/* Vora del triangle (mateix color que la vora de la targeta) */}
                                <View
                                    pointerEvents="none"
                                    style={{
                                        position: 'absolute',
                                        left: (triangleX as number) - 1,
                                        top: (cardTop as number) + barCardHeight - 1,
                                        width: 0, height: 0,
                                        borderLeftWidth: TRIANGLE_HALF + 1,
                                        borderRightWidth: TRIANGLE_HALF + 1,
                                        borderTopWidth: TRIANGLE_HALF + 1,
                                        borderLeftColor: 'transparent',
                                        borderRightColor: 'transparent',
                                        borderTopColor: EDITORIAL.hairlineStrong,
                                        zIndex: 19,
                                    }}
                                />
                                {/* Cos del triangle */}
                                <View
                                    pointerEvents="none"
                                    style={{
                                        position: 'absolute',
                                        left: triangleX as number,
                                        top: (cardTop as number) + barCardHeight - 2,
                                        width: 0, height: 0,
                                        borderLeftWidth: TRIANGLE_HALF,
                                        borderRightWidth: TRIANGLE_HALF,
                                        borderTopWidth: TRIANGLE_HALF,
                                        borderLeftColor: 'transparent',
                                        borderRightColor: 'transparent',
                                        borderTopColor: EDITORIAL.paper,
                                        zIndex: 20,
                                    }}
                                />
                            </React.Fragment>
                        )}
                        </View>
                        );
                    })()}




                    {/* Barra de navegació inferior — Editorial */}

                    {user && (

                        <View style={{

                            position: 'absolute',

                            bottom: 0,

                            left: 0,

                            right: 0,

                            backgroundColor: EDITORIAL.paper,

                            borderTopWidth: 1,

                            borderTopColor: EDITORIAL.hairline,

                            paddingBottom: 20,

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

                            <Ionicons name="calendar-outline" size={24} color={EDITORIAL.inkMuted} />

                            <Text style={{ fontSize: 10, color: EDITORIAL.inkMuted, marginTop: 4, fontFamily: 'Lora_700Bold', letterSpacing: 1.6, textTransform: 'uppercase' }}>

                                Partits

                            </Text>

                        </TouchableOpacity>



                        <TouchableOpacity

                            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}

                            onPress={() => {}}

                        >

                            <View style={{

                                backgroundColor: EDITORIAL.grana,

                                width: 56,

                                height: 56,

                                borderRadius: 28,

                                justifyContent: 'center',

                                alignItems: 'center',

                                marginTop: -28,

                                borderWidth: 4,

                                borderColor: EDITORIAL.paper,

                                ...Platform.select({
                                    web: { boxShadow: '0 4px 12px rgba(165,0,68,0.25)' } as any,
                                    ios: { shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8 },
                                    android: { elevation: 6 }
                                })

                            }}>

                                <Feather name="map-pin" size={26} color="#FFFFFF" />

                            </View>

                            <Text style={{ fontSize: 10, color: EDITORIAL.grana, marginTop: 8, fontFamily: 'Lora_700Bold', letterSpacing: 1.6, textTransform: 'uppercase' }}>

                                Mapa

                            </Text>

                        </TouchableOpacity>



                        <TouchableOpacity

                            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}

                            onPress={() => navigation.navigate('Profile')}

                        >

                            {user?.avatar ? (

                                <Image 

                                    source={{ uri: user.avatar }} 

                                    style={{ 

                                        width: 26, 

                                        height: 26, 

                                        borderRadius: 13,

                                        borderWidth: 1,

                                        borderColor: EDITORIAL.hairlineStrong

                                    }} 

                                />

                            ) : (

                                <Feather name="user" size={24} color={EDITORIAL.inkMuted} />

                            )}

                            <Text style={{ fontSize: 10, color: EDITORIAL.inkMuted, marginTop: 4, fontFamily: 'Lora_700Bold', letterSpacing: 1.6, textTransform: 'uppercase' }}>

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
                        style={[styles.fabGps, { right: 20, bottom: 20 }]}
                        onPress={centerMapToGPS}
                        accessibilityLabel="Centrar a la meva ubicaci\u00f3"
                    >
                        <Image source={MAP_TARGET_3D} style={{ width: 26, height: 26 }} resizeMode="contain" />
                    </TouchableOpacity>

                    {(() => {
                        if (matchIdFromNav) return null;
                        const visibleWidthKm = visibleBounds
                            ? getDistanceFromLatLonInKm(visibleBounds.minLat, visibleBounds.minLng, visibleBounds.minLat, visibleBounds.maxLng)
                            : 0;
                        if (visibleBounds && visibleWidthKm > 2) return null;
                        return (
                            <TouchableOpacity
                                style={[styles.fabGps, { right: 20, bottom: 64 }]}
                                onPress={handleScanToggle}
                                disabled={isScanning}
                                accessibilityLabel={scannedBars.length > 0 ? 'Amagar bars sense confirmar' : 'Cercar bars a la zona visible'}
                            >
                                {isScanning ? (
                                    <ActivityIndicator size="small" color={EDITORIAL.grana} />
                                ) : scannedBars.length > 0 ? (
                                    <Image source={MAP_PIN_SCANNED_3D} style={{ width: 26, height: 26, opacity: 0.55 }} resizeMode="contain" />
                                ) : (
                                    <Image source={MAP_ZOOM_3D} style={{ width: 26, height: 26 }} resizeMode="contain" />
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

                {...edgeSwipeResponder.panHandlers}

                style={{

                    position: 'absolute', top: 0, bottom: 0, left: 0, width: 20, zIndex: 9999, backgroundColor: 'transparent'

                }}

             />



            {/* Modal de perfil del bar premium */}

            <BarProfileModal

                visible={showBarProfile}

                allMatches={upcomingMatches}

                bar={selectedBar}

                placeDetails={placeDetails}

                onClose={() => setShowBarProfile(false)}

                onNavigate={() => selectedBar && openExternalMaps(selectedBar)}

            />

        </View>

    );



};







export default MapScreen;

