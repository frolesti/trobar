import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

import { View, Text, TextInput, TouchableOpacity, Platform, Image, Keyboard, ScrollView, Linking, useWindowDimensions, PanResponder, Animated, Easing, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as Location from 'expo-location';

import { StatusBar } from 'expo-status-bar';

import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; // Icones vectorials

import { fetchBars, fetchBarsForMatch, fetchBarsInBounds, cacheBarPlaceData } from '../../services/barService';

import { useAuth } from '../../context/AuthContext';

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

    const [showBarProfile, setShowBarProfile] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');

    // Suggeriments de geocodificació (Nominatim)
    const [geoSuggestions, setGeoSuggestions] = useState<{display_name: string, lat: string, lon: string}[]>([]);
    const searchTimerRef = useRef<any>(null);

    // Filtratge per viewport (el radi ja no s'utilitza)

    const [visibleBounds, setVisibleBounds] = useState<{ minLat: number, maxLat: number, minLng: number, maxLng: number } | null>(null);

    const [currentZoom, setCurrentZoom] = useState(14);



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

    const [filteredBars, setFilteredBars] = useState<Bar[]>([]);

    

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

    // Animació d'instruccions

    const bubbleScale = useRef(new Animated.Value(0)).current;

    const bubbleOpacity = useRef(new Animated.Value(0)).current;

    const [bubbleReady, setBubbleReady] = useState(false);



    // Responsiu

    const { width, height } = useWindowDimensions();

    const isDesktop = width > 768; // Punt de ruptura per a escriptori web



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



    // 1. Localització GPS

    useEffect(() => {

        (async () => {

             let { status } = await Location.requestForegroundPermissionsAsync();

             if (status !== 'granted') {

                 console.warn('Permís de localització denegat');

                 const fallback = { latitude: 41.3874, longitude: 2.1686 };

                 setUserLocation({ coords: { ...fallback, altitude: 0, accuracy: 0, altitudeAccuracy: 0, heading: 0, speed: 0 }, timestamp: Date.now() });

                 setCenterLocation(fallback);

                 return;

             }

             let location = await Location.getCurrentPositionAsync({});

             setUserLocation(location);

             setCenterLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });

        })();

    }, []);



    // 2. Carregar bars (filtrats per matchId si venim de la pantalla de partits)

    // Recarregar cada cop que la pantalla rep focus (p.ex. després de reportar un bar)

    const loadBars = useCallback(async () => {

        const firestoreBars = await fetchBars();
        setBars(firestoreBars);

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
                eyebrow: 'Avis',
                message: "En gris trobar\u00e0s bars sense confirmar. Clica'ls per avisar si donen el partit!",
                duration: 5000,
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

             // Obtenir info de ruta (distància / temps caminant)
             fetchRoute(selectedBar);
         } else {
             setRouteInfo(null);
             setRouteCoords(null);
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

    const centerMapToGPS = () => {

         if (userLocation) {

             setCenterLocation({ latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude });

             setSearchQuery('');
             setGeoSuggestions([]);

             if (mapRefNative.current) {

                 mapRefNative.current.animateToRegion({

                    latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude,

                    latitudeDelta: 0.01, longitudeDelta: 0.01,

                 }, 500);

             }

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

            let u = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

            if (bar.googlePlaceId) u += `&destination_place_id=${bar.googlePlaceId}`;

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
        // Esborrar ruta del mapa
        // -- Aquí el timeout del renderSearchSettingsOverlay --
        setRouteInfo(null);
        setRouteCoords(null);
        // Tancar desplegables de cerca/filtres
        setShowFiltersPanel(false);
        setGeoSuggestions([]);

    };



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

                                onPress={() => setSelectedBar(bar)}

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
                        ios: { top: 110 },
                        android: { top: 70 },
                        web: { top: 60 },
                        default: { top: 70 },
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

        <View style={isDesktop ? styles.desktopSidebarContent : styles.topBarContainer}>

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

        <View style={[styles.container, isDesktop && { flexDirection: 'row' }]}>

            

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

                        provider={PROVIDER_GOOGLE}

                        style={styles.map}

                        customMapStyle={CUSTOM_MAP_STYLE}

                        initialRegion={{

                            latitude: centerLocation!.latitude,

                            longitude: centerLocation!.longitude,

                            latitudeDelta: radiusToLatDelta(searchRadiusKm),

                            longitudeDelta: radiusToLatDelta(searchRadiusKm),

                        }}

                        showsUserLocation={true}

                        showsMyLocationButton={false}

                        toolbarEnabled={false}

                        onPress={() => closeBarBubble()}

                        onRegionChangeComplete={(region: any) => {

                             setCenterLocation({ latitude: region.latitude, longitude: region.longitude });

                             setVisibleBounds({

                                 minLat: region.latitude - region.latitudeDelta / 2,

                                 maxLat: region.latitude + region.latitudeDelta / 2,

                                 minLng: region.longitude - region.longitudeDelta / 2,

                                 maxLng: region.longitude + region.longitudeDelta / 2

                             });

                             // Zoom aproximat a partir de latitudeDelta

                             const approxZoom = Math.log2(360 / region.latitudeDelta);

                             setCurrentZoom(approxZoom);

                        }}

                    >

                         {/* Marcador d'ubicació de l'usuari — personalitzat */}

                         {userLocation && (

                            <Marker

                                coordinate={{ 

                                    latitude: userLocation.coords.latitude, 

                                    longitude: userLocation.coords.longitude 

                                }}

                                title="La teva ubicació"

                                zIndex={999}

                            >

                                <View style={{

                                    width: 20,

                                    height: 20,

                                    borderRadius: 10,

                                    backgroundColor: '#2196F3',

                                    borderWidth: 3,

                                    borderColor: 'white',

                                    ...Platform.select({

                                        ios: { shadowColor: 'black', shadowOffset: {width:0, height:2}, shadowOpacity: 0.3, shadowRadius: 2 },

                                        android: { elevation: 4 }

                                    })

                                }} />

                            </Marker>

                         )}



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
                                 const clusterBg     = onlyScanned ? '#FFFFFF' : EDITORIAL.grana;
                                 const clusterText   = onlyScanned ? EDITORIAL.inkMuted : '#FFFFFF';
                                 const clusterBorder = onlyScanned ? EDITORIAL.hairlineStrong : '#FFFFFF';
                                 return (
                                     <Marker
                                         key={`cluster-${props.clusterKind}-${props.cluster_id}`}
                                         coordinate={{ latitude: lat, longitude: lng }}
                                         anchor={{ x: 0.5, y: 0.5 }}
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
                                     >
                                         <View style={{
                                             width: size, height: size, borderRadius: size / 2,
                                             backgroundColor: clusterBg,
                                             borderWidth: 2, borderColor: clusterBorder,
                                             alignItems: 'center', justifyContent: 'center',
                                             ...Platform.select({
                                                 web: { boxShadow: '0 4px 10px rgba(15,27,45,0.18)' } as any,
                                                 ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
                                                 android: { elevation: 8 },
                                             }),
                                         }}>
                                             <Text style={{
                                                 color: clusterText,
                                                 fontFamily: 'Lora_700Bold',
                                                 fontSize: count < 10 ? 13 : count < 100 ? 12 : 11,
                                             }}>
                                                 {count < 100 ? count : `${Math.floor(count / 10) * 10}+`}
                                             </Text>
                                         </View>
                                     </Marker>
                                 );
                             }

                             const data: ClusterBar = props.data;
                             if (data.kind === 'scanned') {
                                 const osmBar = data.bar;
                                 return (
                                     <Marker
                                         key={`scanned-${osmBar.id}`}
                                         coordinate={{ latitude: osmBar.lat, longitude: osmBar.lon }}
                                         onPress={() => navigateToReportBar(osmBar)}
                                         zIndex={1}
                                     >
                                         <View style={{
                                             width: 16, height: 16, borderRadius: 8,
                                             backgroundColor: '#777',
                                             borderWidth: 2, borderColor: 'white',
                                             ...Platform.select({
                                                 ios: { shadowColor: 'black', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2 },
                                                 android: { elevation: 4 },
                                             }),
                                         }} />
                                     </Marker>
                                 );
                             }

                             // confirmed
                             const bar = data.bar;
                             const isPremium = bar.tier === 'premium';
                             const isSelected = selectedBar?.id === bar.id;
                             return (
                                <Marker
                                    key={`bar-${bar.id}`}
                                    coordinate={{ latitude: bar.latitude, longitude: bar.longitude }}
                                    title={getCleanBarName(bar.name)}
                                    anchor={{ x: 0.5, y: 1.0 }}
                                    onPress={() => setSelectedBar(bar)}

                                    zIndex={isPremium ? 100 : 1}

                                >

                                     <View style={[styles.markerContainer]}>

                                        <View style={[styles.markerPin]}>

                                            <View style={{

                                                width: 34, height: 34, borderRadius: 17,

                                                borderBottomRightRadius: 2,

                                                transform: [{ rotate: '45deg' }],

                                                justifyContent: 'center', alignItems: 'center',

                                                backgroundColor: isSelected ? SKETCH_THEME.colors.text : SKETCH_THEME.colors.primary,

                                                ...Platform.select({

                                                    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 5 },

                                                    android: { elevation: 10 },

                                                })

                                            }}>

                                                <View style={{

                                                    width: 16, height: 16, borderRadius: 8,

                                                    backgroundColor: 'white',

                                                    transform: [{ rotate: '-45deg' }],

                                                }} />

                                            </View>

                                            {/* Insígnia d'estrella premium */}

                                            {isPremium && (

                                                <View style={{

                                                    position: 'absolute', top: -4, right: -6,

                                                    width: 20, height: 20, borderRadius: 10,

                                                    backgroundColor: '#edbb00', justifyContent: 'center', alignItems: 'center',

                                                    borderWidth: 2, borderColor: 'white',

                                                    ...Platform.select({

                                                        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2 },

                                                        android: { elevation: 4 },

                                                    }),

                                                }}>

                                                    <Feather name="star" size={10} color="white" />

                                                </View>

                                            )}

                                        </View>

                                    </View>

                                </Marker>

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

                        <SafeAreaView style={{backgroundColor: 'transparent'}} pointerEvents="box-none">

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
                            { bottom: user ? 100 : 20 },
                        ]}
                        onPress={centerMapToGPS}
                        accessibilityLabel="Centrar a la meva ubicaci\u00f3"
                    >
                        <Feather name="crosshair" size={22} color={EDITORIAL.grana} />
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
                                    { bottom: (user ? 100 : 20) + 44 },
                                ]}
                                onPress={handleScanToggle}
                                disabled={isScanning}
                                accessibilityLabel={scannedBars.length > 0 ? 'Amagar bars sense confirmar' : 'Cercar bars a la zona visible'}
                            >
                                {isScanning ? (
                                    <ActivityIndicator size="small" color={EDITORIAL.grana} />
                                ) : (
                                    <Feather
                                        name={scannedBars.length > 0 ? 'eye-off' : 'search'}
                                        size={22}
                                        color={EDITORIAL.grana}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })()}



                    {/* Targeta de detall del bar (mòbil) — bafarada flotant que apareix
                        quan s'ha seleccionat un bar. Reutilitza renderContentPanel(),
                        que ja sap dibuixar la BarCard si selectedBar != null. */}
                    {selectedBar && (
                        <Animated.View
                            style={{
                                position: 'absolute',
                                left: 12,
                                right: 12,
                                bottom: (user ? 90 : 20) + 12,
                                opacity: bubbleOpacity,
                                transform: [{ scale: bubbleScale }],
                                zIndex: 20,
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
                    )}



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
                        <Feather name="crosshair" size={22} color={EDITORIAL.grana} />
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
                                ) : (
                                    <Feather
                                        name={scannedBars.length > 0 ? 'eye-off' : 'search'}
                                        size={22}
                                        color={EDITORIAL.grana}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })()}
                </>
             )}



            <StatusBar style="dark" />



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

