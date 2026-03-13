import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

import { View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, Image, Keyboard, ScrollView, Linking, useWindowDimensions, PanResponder, Animated, Easing, ActivityIndicator, Alert } from 'react-native';

import * as Location from 'expo-location';

import { StatusBar } from 'expo-status-bar';

import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; // Icones vectorials

import { fetchBars, fetchBarsForMatch, cacheBarPlaceData } from '../../services/barService';

import { useAuth } from '../../context/AuthContext';

import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';

import { Bar, BarAmenity } from '../../models/Bar';

import { RootStackParamList } from '../../navigation/AppNavigator';

// @ts-ignore - Ignorant l'error de tipatge

import MapboxMap, { Marker as MapboxMarker, Popup, MapRef, Source, Layer } from 'react-map-gl/maplibre';



import MapView, { Marker, PROVIDER_GOOGLE } from '../../utils/GoogleMaps';

import { sketchShadow, SKETCH_THEME } from '../../theme/sketchTheme';

import { CUSTOM_MAP_STYLE } from '../../theme/mapStyle';

import { executeRequest } from '../../api/core';

import { fetchAllMatches, Match } from '../../services/matchService';

import { fetchBarsFromOSM, fetchBarsFromOSMBounds, OSMBar } from '../../services/osmService';

import { getUserPreferences } from '../../services/userService';

import styles from './MapScreen.styles';

import MatchCard from '../../components/MatchCard';

import BarCard from '../../components/BarCard';

import BarListItem from '../../components/BarListItem';

import BarProfileModal from '../../components/BarProfileModal';

import { fetchBarPlaceDetails, PlaceDetails, isOpenNow } from '../../services/placesService';
import { getBarReviewStats } from '../../services/reviewService';
import { BarReviewStats } from '../../models/Review';
import { AMENITY_OPTIONS, AMENITY_CATEGORIES } from '../../data/amenities';



// Declaració global per a TypeScript (Google Maps Web)

declare global {

  interface Window {

    google: any;

  }

}



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

const CAMERA_LAT_OFFSET = 0.002;   // graus que el centre de la càmera es desplaça per sobre del bar

const MAP_REGION_DELTA   = 0.008;  // latitudeDelta de la regió animada

/** Converteix el radi de cerca (km) a un zoom level de Mapbox/MapLibre */
function radiusToZoom(km: number): number {
    if (km <= 0.5) return 16;
    if (km <= 1)   return 15;
    if (km <= 2)   return 14;
    if (km <= 5)   return 12.5;
    return 12;
}

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

    

    const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);

    const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);

    const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);

    const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);

    const [selectedBarReviewStats, setSelectedBarReviewStats] = useState<BarReviewStats>({ averageRating: 0, totalReviews: 0 });



    // Placeholder local si una imatge remota falla

    const [failedImages, setFailedImages] = useState<Record<string, true>>({});

    // Radi de cerca configurable des de preferències d'usuari (km)
    const [searchRadiusKm, setSearchRadiusKm] = useState(2);

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
        const skip = new Set(['open_now', 'broadcasting']);
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



    // Refs (Web)

    const mapRef = useRef<MapRef>(null);

    const googleMapRef = useRef<any>(null);

    const autocompleteInputRef = useRef<any>(null);

    const polylineRef = useRef<any>(null);

    const userMarkerRef = useRef<any>(null);



    // Refs (Natiu)

    const mapRefNative = useRef<any>(null);

    

    // Estat de càrrega de Mapbox web

    const [mapboxLoaded, setMapboxLoaded] = useState(false);

    

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

    // 0. Carregar radi de cerca des de preferències d'usuari
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const prefs = await getUserPreferences(user.id);
                // El model guarda en metres (500, 1000, 2000, 5000), OSM necessita km
                setSearchRadiusKm(prefs.display.searchRadius / 1000);
            } catch (e) {
                console.warn('No s\'han pogut carregar les preferències de radi:', e);
            }
        })();
    }, [user]);

    // 0b. Quan canvia el radi de cerca, ajustar el zoom del mapa
    useEffect(() => {
        if (!centerLocation) return;
        if (Platform.OS === 'web') {
            if (mapboxLoaded && mapRef.current) {
                mapRef.current.flyTo({
                    center: [centerLocation.longitude, centerLocation.latitude],
                    zoom: radiusToZoom(searchRadiusKm),
                    speed: 1.2,
                });
            } else if (googleMapRef.current) {
                googleMapRef.current.setZoom(radiusToZoom(searchRadiusKm));
            }
        } else if (mapRefNative.current) {
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

        if (matchIdFromNav) {

            const matchBars = await fetchBarsForMatch(matchIdFromNav);

            setBars(matchBars);

        } else {

            const firestoreBars = await fetchBars();

            setBars(firestoreBars);

        }

    }, [matchIdFromNav]);



    useFocusEffect(

        useCallback(() => {

            loadBars();
            // Tancar desplegables en tornar a la pantalla
            setShowFiltersPanel(false);
            setGeoSuggestions([]);

        }, [loadBars])

    );



    // 3. Inicialització específica per a web

    useEffect(() => {

        if (Platform.OS !== 'web') return; 



        // Injectar Google Fonts (Lora — serif net per a millor llegibilitat)

        const fontLink = document.createElement('link');

        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&display=swap';

        fontLink.rel = 'stylesheet';

        document.head.appendChild(fontLink);



        // Injectar estils personalitzats de scrollbar (estil esbossat)

        const style = document.createElement('style');

        style.innerHTML = `

            ::-webkit-scrollbar {

                width: 10px;

                height: 10px;

            }

            ::-webkit-scrollbar-track {

                background: ${SKETCH_THEME.colors.bg}; 

            }

            ::-webkit-scrollbar-thumb {

                background-color: ${SKETCH_THEME.colors.textMuted};

                border-radius: 5px;

                border: 2px solid ${SKETCH_THEME.colors.bg};

            }

            ::-webkit-scrollbar-thumb:hover {

                background-color: ${SKETCH_THEME.colors.text};

            }

            input::placeholder {

                color: rgba(255,255,255) !important;

            }

            .maplibregl-popup-content {

                padding: 0 !important;

                background: transparent !important;

                box-shadow: none !important;

            }

            .maplibregl-popup-tip {

                display: none !important;

            }

        `;

        document.head.appendChild(style);



        const mapboxLink = document.createElement('link'); mapboxLink.href='https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'; mapboxLink.rel='stylesheet'; document.head.appendChild(mapboxLink); 

        

        const mapboxScript = document.createElement('script');

        mapboxScript.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';

        mapboxScript.onload = () => setMapboxLoaded(true);

        mapboxScript.onerror = () => { console.error('MapLibre failed to load'); };

        document.head.appendChild(mapboxScript);

        

        // Ja no carreguem el Google Maps JS API — usem Nominatim per a geocodificació

    }, [centerLocation]); 



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
                // Filtre confirmat que emet (només quan venim d'un partit)
                if (activeFilters.has('broadcasting') && matchIdFromNav) {
                    if (!b.broadcastingMatches?.includes(matchIdFromNav)) return false;
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

        if (matchIdFromNav) {

            // Si venim d'un partit, mostrem TOTS els bars emissors sense importar la distància

            setFilteredBars(applyFilters(bars));



            // Selecció automàtica del bar més proper

            if (bars.length > 0) {

                let nearest = bars[0];

                let nearestDist = Infinity;

                bars.forEach(bar => {

                    const dist = getDistanceFromLatLonInKm(

                        centerLocation.latitude, centerLocation.longitude,

                        bar.latitude, bar.longitude

                    );

                    if (dist < nearestDist) {

                        nearestDist = dist;

                        nearest = bar;

                    }

                });

                setSelectedBar(nearest);

            }

            return;

        }



        // Filtrar per bounds visibles si disponibles, si no, mostrar tots dins un rang raonable

        if (visibleBounds) {

             const inView = bars.filter(bar => 

                bar.latitude >= visibleBounds.minLat && bar.latitude <= visibleBounds.maxLat &&

                bar.longitude >= visibleBounds.minLng && bar.longitude <= visibleBounds.maxLng

             );

             // A poc zoom: amagar bars gratuïts per reduir soroll, EXCEPTE si hi ha filtres actius
             const FREE_HIDE_ZOOM = 11;

             if (currentZoom < FREE_HIDE_ZOOM && activeFilters.size === 0) {

                 setFilteredBars(applyFilters(inView.filter(bar => bar.tier === 'premium')));

             } else {

                 setFilteredBars(applyFilters(inView));

             }

        } else {

             // Alternativa: 20 km al voltant del centre si no hi ha bounds

             const nearbyBars = bars.filter(bar => 

                getDistanceFromLatLonInKm(centerLocation.latitude, centerLocation.longitude, bar.latitude, bar.longitude) <= 20

             );

             setFilteredBars(applyFilters(nearbyBars));

        }



    }, [centerLocation, visibleBounds, bars, matchIdFromNav, currentZoom, activeFilters]);



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

            Alert.alert(
                'Servei temporalment no disponible',
                'No hem pogut connectar amb el servidor de mapes. Torna-ho a provar d\'aquí uns segons.',
                [{ text: 'Entesos' }]
            );

        } finally {

            setIsScanning(false);

        }

    };



    // Commutador: El botó crida aquesta funció

    const handleScanToggle = () => {

        if (scannedBars.length > 0) {

            setScannedBars([]); // Amagar/Netejar

        } else {

            handleManualScan(); // Cercar

        }

    };

    // 3. Carregar partits per al bàner

    useEffect(() => {

        let isMounted = true;

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



                    if (upcoming.length > 0) {

                        setNextMatch(upcoming[0]);

                        setUpcomingMatches(upcoming);

                    } else {

                        setNextMatch(null);

                        setUpcomingMatches([]);

                    }

                }

            } catch (e) {

                console.warn("Failed to load matches for map banner", e);

            }

        };

        loadMatches();

        return () => { isMounted = false; };

    }, []);



    // 4. Actualitzar visuals del mapa i animació

    useEffect(() => {

        // Animació: Amagar panell inferior si 0 bars, lliscar amunt/rebot si > 0

        if (!isDesktop) {

            if (filteredBars.length > 0) {

                Animated.spring(bottomSheetTranslateY, {

                    toValue: 0,

                    useNativeDriver: Platform.OS !== 'web',

                    friction: 5,

                    tension: 20

                }).start();

            } else {

                Animated.timing(bottomSheetTranslateY, {

                    toValue: 500, // Amagar cap avall

                    duration: 300,

                    useNativeDriver: Platform.OS !== 'web',

                }).start();

            }

        }



        // Actualitzar específics de plataforma

        if (Platform.OS === 'web') {

            // La lògica visual de MapBox és reactiva a l'estat (filteredBars), no cal actualitzar el DOM imperativament.

        } else {

            // El mapa natiu s'actualitza automàticament via la prop filteredBars de MapView

        }

    }, [filteredBars, isDesktop, bottomSheetTranslateY]); // Dependències afegides correctament





    // 5. Lògica del bar seleccionat (sincronitzat)

    useEffect(() => {

         // Reiniciar estat de la bafarada

         setBubbleReady(false);

         bubbleScale.setValue(0);

         bubbleOpacity.setValue(0);



         // Animació del BottomSheet

         if (Platform.OS !== 'web' || !isDesktop) {

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

         }



         // Web: Centrar bar al mapa + obtenir ruta

         if (Platform.OS === 'web') {

             if (selectedBar) {

                 if (googleMapRef.current) {

                     const map = googleMapRef.current;

                     const targetZoom = Math.max(map.getZoom() || 15, 16);

                     map.setZoom(targetZoom);

                     // Desplazar cap amunt perquè el marcador quedi a la part inferior de la pantalla (compensant la bafarada superposada)

                     // En zoom 16, 0.003 graus aprox compensen molt visualment

                     map.panTo({ lat: selectedBar.latitude + CAMERA_LAT_OFFSET, lng: selectedBar.longitude });

                 }

                 fetchWebRoute(selectedBar);

             } else {

                 setRouteInfo(null);

                 // Mantenir la ruta dibuixada al mapa fins que l'usuari cliqui un altre bar

                 if (polylineRef.current) polylineRef.current.setMap(null);

             }

         }



         // Natiu: Centrar exactament sobre el bar

         if (Platform.OS !== 'web' && selectedBar && mapRefNative.current) {

             const newRegion = {

                // Desplacem el centre de la càmera "amunt" (valors de latitud positius)

                // perquè el pin en si quedi arrossegat cap a la part "més baixa" de la pantalla

                latitude: selectedBar.latitude + CAMERA_LAT_OFFSET,

                longitude: selectedBar.longitude,

                latitudeDelta: MAP_REGION_DELTA,

                longitudeDelta: MAP_REGION_DELTA,

             };

             mapRefNative.current.animateToRegion(newRegion, 500);

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

                     // Esperar una mica perquè el mapa es calmi, després mostrar la bafarada

                     setTimeout(() => setBubbleReady(true), 350);

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



    // 6. Actualitzar marcador d'usuari al web quan la ubicació estigui disponible

    useEffect(() => {

        if (Platform.OS !== 'web' || !userLocation) return;



        // Lògica de Mapbox / MapLibre

        if (mapboxLoaded && mapRef.current) {

            if (!selectedBar) {

                mapRef.current.flyTo({

                    center: [userLocation.coords.longitude, userLocation.coords.latitude],

                    zoom: radiusToZoom(searchRadiusKm),

                    speed: 1.2

                });

            }

            return;

        }

        

        if (!googleMapRef.current) return;

        

        // Centrar mapa a la posició real de l'usuari (pot haver-se inicialitzat amb Barcelona per defecte)

        if (!selectedBar) {

            googleMapRef.current.panTo({ lat: userLocation.coords.latitude, lng: userLocation.coords.longitude });

        }

        

        if (userMarkerRef.current) userMarkerRef.current.setMap(null);

        userMarkerRef.current = new window.google.maps.Marker({

            position: { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude },

            map: googleMapRef.current,

            title: "La teva ubicació",

            zIndex: 999,

            icon: {

                path: window.google.maps.SymbolPath.CIRCLE,

                scale: 10,

                fillColor: '#2196F3',

                fillOpacity: 1,

                strokeColor: 'white',

                strokeWeight: 3,

            }

        });

    }, [userLocation, mapboxLoaded, selectedBar]);



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
        if (mapRef.current) {
            mapRef.current.flyTo({ center: [newLocation.longitude, newLocation.latitude], zoom: 15 });
        }
    }, []);



    const fetchWebRoute = async (bar: Bar) => {

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

                if (polylineRef.current) polylineRef.current.setMap(null);

                

                // Configuració de línia de ruta MapLibre

                if (route.polyline && route.polyline.encodedPolyline) {

                    try {

                        const coords = decodePolyline(route.polyline.encodedPolyline);

                        setRouteGeoJSON({

                            type: 'Feature',

                            properties: {},

                            geometry: {

                                type: 'LineString',

                                // @ts-ignore

                                coordinates: coords

                            }

                        });

                    } catch (e) {

                        console.error('Error decoding polyline', e);

                    }

                }



                // Alternativa per Google Maps si encara s'utilitza

                if (window.google && window.google.maps && window.google.maps.geometry && googleMapRef.current) {

                    const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);

                    polylineRef.current = new window.google.maps.Polyline({

                        path: decodedPath, geodesic: true, strokeColor: SKETCH_THEME.colors.primary,

                        strokeOpacity: 1.0, strokeWeight: 5, map: googleMapRef.current

                    });

                }



                // Calcular informació

                const durationSeconds = parseInt(route.duration.replace('s', ''));

                const durationText = durationSeconds > 3600 

                    ? `${Math.floor(durationSeconds/3600)} h ${Math.floor((durationSeconds%3600)/60)} min`

                    : `${Math.floor(durationSeconds/60)} min`;

                const distanceKm = (route.distanceMeters / 1000).toFixed(1) + ' km';

                setRouteInfo({ distance: distanceKm, duration: durationText });



                // Fer zoom per encabir els límits de la ruta

                // Al mòbil, mantenim el bar centrat i deixem que l'usuari vegi la ruta des d'allà

                if (isDesktop && mapRef.current && route.polyline && route.polyline.encodedPolyline) {

                    try {

                        const coords = decodePolyline(route.polyline.encodedPolyline);

                        const lats = coords.map((c: any) => c[1]);

                        const lngs = coords.map((c: any) => c[0]);

                        const minLat = Math.min(...lats);

                        const maxLat = Math.max(...lats);

                        const minLng = Math.min(...lngs);

                        const maxLng = Math.max(...lngs);

                        mapRef.current.fitBounds(

                            [Number(minLng), Number(minLat), Number(maxLng), Number(maxLat)],

                            { padding: { top: 60, bottom: 80, left: 420, right: 30 } }

                        );

                    } catch (e) {}

                }

            }

        }, 'fetchWebRoute');

    };



    // --- ACCIONS COMPARTIDES ---

    const centerMapToGPS = () => {

         if (userLocation) {

             setCenterLocation({ latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude });

             setSearchQuery('');

             // Reinici d'interfície específic per a web

             if (Platform.OS === 'web') {

                 if (mapRef.current) {

                     mapRef.current.flyTo({

                         center: [userLocation.coords.longitude, userLocation.coords.latitude],

                         zoom: 15

                     });

                 } else if (googleMapRef.current) {

                     // Alternativa per Google Maps si encara s'usa (ara usem Mapbox/MapLibre)

                     googleMapRef.current.panTo({ lat: userLocation.coords.latitude, lng: userLocation.coords.longitude });

                     googleMapRef.current.setZoom(15);

                 }

                 

                 if (autocompleteInputRef.current) autocompleteInputRef.current.value = '';
                 setSearchQuery(''); setGeoSuggestions([]);

             }

             // Reinici d'interfície específic per a natiu

             if (Platform.OS !== 'web' && mapRefNative.current) {

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

                    fallbackIsOpen={isOpenNow(selectedBar.openingPeriods) ?? selectedBar.isOpen}

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
        // Afegir filtre "confirmat que emet" quan venim d'un partit
        if (matchIdFromNav) {
            opts.push({ key: 'broadcasting', label: 'Confirmat que emet', icon: 'television', iconFamily: 'mci' });
        }
        // Totes les amenities agrupades
        AMENITY_OPTIONS.forEach(a => {
            opts.push({ key: a.key, label: a.label, icon: a.icon, iconFamily: a.iconFamily, category: a.category });
        });
        return opts;
    }, [matchIdFromNav]);

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
                    web: { boxShadow: '0 4px 16px rgba(0,0,0,0.14)' } as any,
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
                <ScrollView style={{ maxHeight: height * 0.48 }} bounces={false}>
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
                <Feather name="sliders" size={18} color={hasActiveFilters ? 'white' : SKETCH_THEME.colors.textInverse} />
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

        if (Platform.OS === 'web') {
             return (
                 <View style={styles.searchBar}>
                    <Feather name="search" size={20} color={SKETCH_THEME.colors.textInverse} style={{marginRight: 10}} />
                    {/* @ts-ignore */}
                    <input
                        ref={autocompleteInputRef}
                        type="text"
                        placeholder={placeholderText}
                        style={{
                            flex: 1, fontSize: '16px', border: 'none', outline: 'none', backgroundColor: 'transparent', height: '100%', color: SKETCH_THEME.colors.textInverse, fontFamily: 'Lora'
                        }}
                        value={searchQuery}
                        onChange={(e: any) => handleSearchInput(e.target.value)}
                    />
                     {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => { setSearchQuery(''); setGeoSuggestions([]); centerMapToGPS(); }} style={{marginRight: 4}}>
                            <Feather name="x" size={16} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                    )}
                    {filterIconButton}
                 </View>
             )
        }
        // Input natiu
        return (
             <View style={styles.searchBar}>
                <Feather name="search" size={20} color={SKETCH_THEME.colors.textInverse} style={{marginRight: 10}} />
                <TextInput 
                    placeholder={placeholderText} 
                    style={[styles.searchInput, { flex: 1 }]}
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={searchQuery}
                    onChangeText={handleSearchInput}
                    onSubmitEditing={() => searchNominatim(searchQuery)}
                />
                {searchQuery !== '' && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); setGeoSuggestions([]); centerMapToGPS(); }} style={{marginRight: 4}}>
                        <Feather name="x" size={16} color="rgba(255,255,255,0.6)" />
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
                            ...Platform.select({ web: { boxShadow: '0 4px 16px rgba(0,0,0,0.14)' } as any, default: {} }),
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
                            web: { boxShadow: '0 4px 16px rgba(0,0,0,0.14)' } as any,
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

             

             {/* Bàner del pròxim partit — usa MatchCard per coherència visual */}

             {nextMatch && (!selectedBar || isDesktop) && (

                <View style={{ marginTop: 8, marginHorizontal: Platform.OS === 'web' ? 0 : 4 }}>

                    <MatchCard match={nextMatch} compact={true} onPress={() => {}} />

                </View>

             )}



             { (!selectedBar || isDesktop) && (

                 <>

                    {renderRadiusSlider()}

                        {/* Amagar botó de cerca si l'àrea visible > 5 km */}

                        {(() => {
                            const visibleWidthKm = visibleBounds
                                ? getDistanceFromLatLonInKm(visibleBounds.minLat, visibleBounds.minLng, visibleBounds.minLat, visibleBounds.maxLng)
                                : 0;
                            if (visibleBounds && visibleWidthKm > 5) return null;
                            return (
                                <>

                        {/* Cerca OSM */}

                        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10}}>

                            {/* Acció de bars escanejats/trobats */}

                            <TouchableOpacity 

                                onPress={handleScanToggle}

                                disabled={isScanning}

                                style={{

                                    backgroundColor: SKETCH_THEME.colors.card,

                                    borderWidth: 2, 

                                    borderColor: SKETCH_THEME.colors.primary,

                                    borderRadius: 20,

                                    paddingVertical: 8,

                                    paddingHorizontal: 16,

                                    flexDirection: 'row',

                                    alignItems: 'center',

                                    ...Platform.select({

                                        web: { boxShadow: '2px 2px 8px rgba(0,0,0,0.1)' },

                                        ios: { shadowColor: 'black', shadowOffset: {width: 2, height: 2}, shadowOpacity: 0.1, shadowRadius: 4 },

                                        android: { elevation: 4 }

                                    })

                                }}

                            >

                                {isScanning ? (

                                    <ActivityIndicator size="small" color={SKETCH_THEME.colors.primary} style={{marginRight: 8}} />

                                ) : (

                                    scannedBars.length > 0 ? (

                                        <Feather name="eye-off" size={16} color={SKETCH_THEME.colors.primary} style={{marginRight: 8}} />

                                    ) : (

                                        <Feather name="search" size={16} color={SKETCH_THEME.colors.primary} style={{marginRight: 8}} />

                                    )

                                )}

                                <Text style={{

                                    color: SKETCH_THEME.colors.primary, 

                                    fontWeight: 'bold', 

                                    fontFamily: 'Lora',

                                    fontSize: 12

                                }}>

                                    {isScanning ? 'Cercant bars...' : (

                                        scannedBars.length > 0 ? 'Amaga bars' : 'Cerca bars en aquesta zona'

                                    )}

                                </Text>

                            </TouchableOpacity>



                            {/* Mostra "Afegir més" només si ja en tenim però ens hem mogut?
                                En realitat l'usuari volia un commutador: si hi ha bars, el botó els amaga.
                                I si volem buscar de nou? L'slider de radi gestiona el cas "ampliar cerca".
                            */}

                        </View>

                    { (showScanTip) && (

                        <View style={{ marginTop: 8, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8, paddingVertical: 4 }}>

                            <Text style={{ fontSize: 11, color: SKETCH_THEME.colors.textMuted, textAlign: 'center', fontFamily: 'Lora' }}>

                                En gris trobareu bars sense confirmar. Clica'ls per avisar si donen partits!

                            </Text>

                        </View>

                    )}

                                </>
                            );
                        })()}

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

                {Platform.OS === 'web' ? (

                    mapboxLoaded ? (

                    <MapboxMap

                        ref={mapRef}

                        mapLib={(window as any).maplibregl}

                        initialViewState={{ longitude: centerLocation?.longitude || 2.1734, latitude: centerLocation?.latitude || 41.3851, zoom: radiusToZoom(searchRadiusKm) }}

                        onMoveEnd={(evt: any) => {

                             setCenterLocation({ latitude: evt.viewState.latitude, longitude: evt.viewState.longitude });

                             const bounds = evt.target.getBounds();

                             if (bounds) {

                                 setVisibleBounds({ minLat: bounds.getSouth(), maxLat: bounds.getNorth(), minLng: bounds.getWest(), maxLng: bounds.getEast() });

                             }

                             const z = evt.target.getZoom();

                             if (z != null) setCurrentZoom(z);

                        }}

                        onLoad={(evt: any) => {

                             const bounds = evt.target.getBounds();

                             if (bounds) {

                                 setVisibleBounds({ minLat: bounds.getSouth(), maxLat: bounds.getNorth(), minLng: bounds.getWest(), maxLng: bounds.getEast() });

                             }

                             const z = evt.target.getZoom();

                             if (z != null) setCurrentZoom(z);

                        }}

                        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"

                        style={{width: '100%', height: '100%'}}

                        onClick={() => { closeBarBubble(); Keyboard.dismiss(); }}

                    >

                        {routeGeoJSON && (

                            <Source id="route-source" type="geojson" data={routeGeoJSON}>

                                <Layer

                                    id="route-layer"

                                    type="line"

                                    layout={{

                                        'line-join': 'round',

                                        'line-cap': 'round'

                                    }}

                                    paint={{

                                        'line-color': SKETCH_THEME.colors.primary,

                                        'line-width': 5,

                                        'line-opacity': 0.8

                                    }}

                                />

                            </Source>

                        )}

                        {userLocation && (

                             <MapboxMarker longitude={userLocation.coords.longitude} latitude={userLocation.coords.latitude} anchor="center">

                                 <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#2196F3', borderWidth: 3, borderColor: 'white', ...Platform.select({ web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.3)' } }) }} />

                             </MapboxMarker>

                        )}

                        {filteredScannedBars.map(osmBar => (

                             <MapboxMarker key={osmBar.id} longitude={osmBar.lon} latitude={osmBar.lat} anchor="center" onClick={(e: any) => { e.originalEvent.stopPropagation(); navigation.navigate('ReportBar' as any, { osmBar }); }}>

                                 <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#777', borderWidth: 2, borderColor: 'white', ...Platform.select({ web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.3)' } }) }} />

                             </MapboxMarker>

                        ))}

                        {filteredBars

                        .slice() // còpia perquè l'ordenació no muti l'original

                        .sort((a, b) => {

                            // Renderitzar bars premium AL FINAL perquè apareguin a sobre (z-index més alt al mapa)

                            const aTier = a.tier === 'premium' ? 1 : 0;

                            const bTier = b.tier === 'premium' ? 1 : 0;

                            return aTier - bTier;

                        })

                        .map(bar => {

                             const isPremium = bar.tier === 'premium';

                             const isSelected = selectedBar?.id === bar.id;

                             return (

                             <MapboxMarker 

                                key={bar.id} 

                                longitude={bar.longitude} 

                                latitude={bar.latitude} 

                                anchor="bottom" 

                                onClick={(e: any) => { 

                                    e.originalEvent.stopPropagation(); 

                                    setSelectedBar(bar);

                                    if(mapRef.current) {

                                       mapRef.current.flyTo({

                                           center: [bar.longitude, bar.latitude],

                                           offset: [0, height * 0.25], 

                                           zoom: 16,

                                           speed: 1.2

                                       });

                                    }

                                }}

                            >

                                 <View style={[styles.markerContainer, isPremium && { zIndex: 100 }]}>

                                    <View style={[styles.markerPin]}>

                                        {/* Cap del pin 3D — igual per a tots els bars */}

                                        <View style={{

                                            width: 34, height: 34, borderRadius: 17,

                                            borderBottomRightRadius: 2,

                                            transform: [{ rotate: '45deg' }],

                                            justifyContent: 'center', alignItems: 'center',

                                            ...Platform.select({

                                                web: {

                                                    background: isSelected

                                                        ? 'linear-gradient(135deg, #555 0%, #222 100%)'

                                                        : `linear-gradient(135deg, ${SKETCH_THEME.colors.primary} 0%, #003270 100%)`,

                                                    boxShadow: '0px 4px 10px rgba(0,0,0,0.35), inset 0px 1px 2px rgba(255,255,255,0.3)',

                                                },

                                            }),

                                            backgroundColor: isSelected ? SKETCH_THEME.colors.text : SKETCH_THEME.colors.primary,

                                        }}>

                                            <View style={{

                                                width: 16, height: 16, borderRadius: 8,

                                                backgroundColor: 'white',

                                                transform: [{ rotate: '-45deg' }],

                                                ...Platform.select({

                                                    web: { boxShadow: 'inset 0px 1px 3px rgba(0,0,0,0.15), 0px 1px 1px rgba(255,255,255,0.4)' },

                                                })

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

                                                    web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.3)' },

                                                }),

                                            }}>

                                                <Feather name="star" size={10} color="white" />

                                            </View>

                                        )}

                                    </View>

                                 </View>

                             </MapboxMarker>

                             );

                        })}



                        {selectedBar && (

                            <Popup 

                                longitude={selectedBar.longitude} 

                                latitude={selectedBar.latitude} 

                                anchor="bottom" 

                                offset={[0, -47]} // Flotar per sobre del marcador 3D del pin

                                onClose={() => closeBarBubble()} 

                                closeOnClick={false} 

                                closeButton={false}

                                maxWidth="none"

                                style={{ padding: 0 }}

                            >

                                <View style={{

                                    width: Math.min(340, width * 0.88),

                                    backgroundColor: selectedBar?.tier === 'premium' ? SKETCH_THEME.colors.accent : 'white',

                                    borderRadius: 14,

                                    overflow: 'hidden',

                                    ...Platform.select({

                                        web: { boxShadow: '0px 8px 30px rgba(0,0,0,0.18)' },

                                        ios: { shadowColor: '#000', shadowOffset: {width: 0, height: 6}, shadowOpacity: 0.2, shadowRadius: 14 },

                                        android: { elevation: 12 }

                                    })

                                }}>

                                    <ScrollView 

                                        style={{ maxHeight: Math.min(420, height * 0.55) }}

                                        showsVerticalScrollIndicator={false}

                                        bounces={false}

                                    >

                                        <View style={{ padding: 14, paddingTop: 12, paddingBottom: 10 }}>

                                            <BarCard 

                                                name={selectedBar.name} 

                                                address={selectedBar.address} 

                                                latitude={selectedBar.latitude} 

                                                longitude={selectedBar.longitude} 

                                                placeDetails={placeDetails} 

                                                loadingPlaceDetails={loadingPlaceDetails} 

                                                verified={true} 

                                                fallbackRating={selectedBar.rating} 

                                                fallbackIsOpen={isOpenNow(selectedBar.openingPeriods) ?? selectedBar.isOpen} 

                                                distanceText={routeInfo ? `${routeInfo.duration} caminant (${routeInfo.distance})` : undefined} 

                                                onClose={() => closeBarBubble()} 

                                                onNavigate={() => openExternalMaps(selectedBar)} 

                                                tier={selectedBar.tier || 'free'}

                                                onProfileOpen={() => setShowBarProfile(true)}

                                            />

                                        </View>

                                    </ScrollView>

                                </View>

                            </Popup>

                        )}

                    </MapboxMap>) : (<View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><ActivityIndicator size="large" color={SKETCH_THEME.colors.primary} /></View>)) : (<MapView

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



                         {/* Bars escanejats d'OSM */}

                         {filteredScannedBars.map(osmBar => (

                            <Marker

                                key={osmBar.id}

                                coordinate={{ latitude: osmBar.lat, longitude: osmBar.lon }}

                                onPress={() => {

                                    if (mapRefNative.current) {

                                        mapRefNative.current.animateToRegion({

                                            latitude: osmBar.lat + CAMERA_LAT_OFFSET,

                                            longitude: osmBar.lon,

                                            latitudeDelta: MAP_REGION_DELTA,

                                            longitudeDelta: MAP_REGION_DELTA,

                                        }, 500);

                                    }

                                    navigation.navigate('ReportBar' as any, { osmBar });

                                }}

                                zIndex={1}

                            >

                                <View style={{ 

                                    width: 16, height: 16, borderRadius: 8, 

                                    backgroundColor: '#777', 

                                    borderWidth: 2, borderColor: 'white',

                                    ...Platform.select({

                                        ios: { shadowColor: 'black', shadowOffset: {width:0, height:2}, shadowOpacity: 0.3, shadowRadius: 2 },

                                        android: { elevation: 4 }

                                    })

                                }} />

                            </Marker>

                         ))}



                         {filteredBars

                         .slice()

                         .sort((a, b) => {

                             const aTier = a.tier === 'premium' ? 1 : 0;

                             const bTier = b.tier === 'premium' ? 1 : 0;

                             return aTier - bTier;

                         })

                         .map((bar) => {

                             const isPremium = bar.tier === 'premium';

                             const isSelected = selectedBar?.id === bar.id;

                             return (

                                <Marker

                                    key={bar.id}

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

                             )

                         })}

                    </MapView>

                )}

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

                    <TouchableOpacity 

                        style={[

                            styles.fabGps,

                            { 

                                // Moure el botó GPS amunt si hi ha bar seleccionat per no solapar la bafarada inferior? 

                                // O mantenir-lo a baix. La imatge el mostra a baix a la dreta.

                                bottom: user ? 100 : 20 

                            } 

                        ]}

                        onPress={centerMapToGPS}

                    >

                        <Feather name="crosshair" size={24} color={SKETCH_THEME.colors.primary} />

                    </TouchableOpacity>



                    {/* Targeta de detall del bar — ELIMINADA */}



                    {/* Barra de navegació inferior — Només mostrar si autenticat */}

                    {user && (

                        <View style={{

                            position: 'absolute',

                            bottom: 0,

                            left: 0,

                            right: 0,

                            backgroundColor: SKETCH_THEME.colors.bg,

                            borderTopWidth: 1,

                            borderTopColor: 'rgba(255,255,255,0.15)',

                            paddingBottom: 20,

                            paddingTop: 8,

                            flexDirection: 'row',

                            justifyContent: 'space-around',

                            alignItems: 'center',

                            ...Platform.select({

                                web: { boxShadow: '0px -2px 10px rgba(0,0,0,0.1)' },

                                ios: { shadowColor: 'black', shadowOffset: {width: 0, height: -2}, shadowOpacity: 0.1, shadowRadius: 4 },

                                android: { elevation: 8 }

                            })

                        }}>

                        <TouchableOpacity

                            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}

                            onPress={() => navigation.navigate('Matches')}

                        >

                            <Ionicons name="calendar-outline" size={26} color={SKETCH_THEME.colors.mutedInverse} />

                            <Text style={{ fontSize: 11, color: SKETCH_THEME.colors.mutedInverse, marginTop: 4, fontFamily: 'Lora' }}>

                                Partits

                            </Text>

                        </TouchableOpacity>



                        <TouchableOpacity

                            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}

                            onPress={() => {}}

                        >

                            <View style={{

                                backgroundColor: SKETCH_THEME.colors.accent,

                                width: 56,

                                height: 56,

                                borderRadius: 28,

                                justifyContent: 'center',

                                alignItems: 'center',

                                marginTop: -28,

                                borderWidth: 4,

                                borderColor: SKETCH_THEME.colors.bg,

                                ...sketchShadow()

                            }}>

                                <Feather name="map-pin" size={28} color="white" />

                            </View>

                            <Text style={{ fontSize: 11, color: SKETCH_THEME.colors.textInverse, marginTop: 8, fontWeight: 'bold', fontFamily: 'Lora' }}>

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

                                        borderWidth: 1.5,

                                        borderColor: SKETCH_THEME.colors.mutedInverse

                                    }} 

                                />

                            ) : (

                                <Feather name="user" size={26} color={SKETCH_THEME.colors.mutedInverse} />

                            )}

                            <Text style={{ fontSize: 11, color: SKETCH_THEME.colors.mutedInverse, marginTop: 4, fontFamily: 'Lora' }}>

                                Perfil

                            </Text>

                        </TouchableOpacity>

                    </View>

                    )}

                </>

            )}



             {/* BOTÓ GPS D'ESCRIPTORI */}

             {isDesktop && (

                <>

                    <TouchableOpacity style={[styles.fabGps, { right: 20, bottom: 20 }]} onPress={centerMapToGPS}>

                        <Feather name="crosshair" size={24} color={SKETCH_THEME.colors.primary} />

                    </TouchableOpacity>



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

