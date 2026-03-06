import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, Image, Alert, Keyboard, ScrollView, Linking, useWindowDimensions, PanResponder, Animated, Easing, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { Feather, Ionicons } from '@expo/vector-icons'; // Import Vector Icons
import { fetchBars, fetchBarsForMatch } from '../../services/barService';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Bar } from '../../models/Bar';
import { RootStackParamList } from '../../navigation/AppNavigator';
// @ts-ignore - Ignorant l'error de tipatge
import MapboxMap, { Marker as MapboxMarker, Popup, MapRef, Source, Layer } from 'react-map-gl/maplibre';

import MapView, { Marker, PROVIDER_GOOGLE } from '../../utils/GoogleMaps';
import { sketchShadow, SKETCH_THEME } from '../../theme/sketchTheme';
import { CUSTOM_MAP_STYLE } from '../../theme/mapStyle';
import { executeRequest } from '../../api/core';
import { fetchAllMatches, Match } from '../../services/matchService';
import { fetchBarsFromOSM, OSMBar } from '../../services/osmService';
import styles from './MapScreen.styles';
import MatchCard from '../../components/MatchCard';
import BarCard from '../../components/BarCard';
import BarListItem from '../../components/BarListItem';
import BarProfileModal from '../../components/BarProfileModal';
import { fetchBarPlaceDetails, PlaceDetails } from '../../services/placesService';

// DeclaraciÃ³ global per a TypeScript (Google Maps Web)
declare global {
  interface Window {
    google: any;
  }
}

// FunciÃ³ utilitat per calcular distÃ ncia en KM (Haversine Formula) - Compartida
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
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

// Helper (Shared)
const getCleanBarName = (name: string) => {
    return name.replace(/\s\d+$/, '');
};

// -- Camera & Bubble positioning constants --
// When selecting a bar, we shift the camera UP so the pin sits below center.
// The bubble is then positioned dynamically so its triangle points at the pin.
const CAMERA_LAT_OFFSET = 0.002;   // degrees the camera center shifts above the bar
const MAP_REGION_DELTA   = 0.008;  // latitudeDelta of the animated region
// After camera animation, pin ends up at this fraction from the bottom of the screen:
// 0.5 - offset/delta. With 0.002/0.008 ? 0.25 (25% from bottom).
const PIN_FRACTION_FROM_BOTTOM = 0.5 - CAMERA_LAT_OFFSET / MAP_REGION_DELTA;

// SVG Path for Hand-Drawn Pin (Approximate)
const SKETCHY_PIN_PATH = "M 12 2 C 7 2 3 7 3 12 C 3 17 12 24 12 24 C 12 24 21 17 21 12 C 21 7 17 2 12 2 Z";

// Base64 fallback if file asset fails for any reason
const DEFAULT_BAR_IMAGE = require('../../../assets/img/bar-fallout.jpg');

// Match/league search UI removed

const getBarImageSource = (img: string | undefined | null) => {
    if (img && typeof img === 'string' && img.startsWith('http') && img !== 'null' && img !== 'undefined' && img.trim() !== '') {
        return { uri: img };
    }
    return DEFAULT_BAR_IMAGE;
};

// Suppress Google Maps Deprecation Warnings
const originalWarn = console.warn;
const originalError = console.error;

if (Platform.OS === 'web') {
    console.warn = (...args) => {
        if (args[0] && typeof args[0] === 'string' && (args[0].includes('google.maps.places.Autocomplete') || args[0].includes('As of March 1st, 2025'))) return;
        originalWarn(...args);
    };
    console.error = (...args) => {
        if (args[0] && typeof args[0] === 'string' && (args[0].includes('google.maps.places.Autocomplete') || args[0].includes('As of March 1st, 2025'))) return;
        originalError(...args);
    }
}

const MapScreen = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<RootStackParamList, 'Map'>>();
    const matchIdFromNav = route.params?.matchId ?? null;
    
    // Animations for Popup Effects
    const settingsAnim = useRef(new Animated.Value(0)).current;
    const pickerAnim = useRef(new Animated.Value(0)).current;
    
    // Visibility state for animations (keeps component mounted during exit animation)
    const [showSettings, setShowSettings] = useState(false);
    const [showPicker, setShowPicker] = useState(false);

    // Location: Ubicaciï¿½ REAL del dispositiu (GPS)
    const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
    // CenterLocation: Punt central de la cerca (pot ser GPS o una adreï¿½a buscada)
    // Inicialitzar amb Barcelona per defecte per evitar pantalla de cï¿½rrega bloquejant
    const [centerLocation, setCenterLocation] = useState<{latitude: number, longitude: number} | null>({
        latitude: 41.3851, 
        longitude: 2.1734
    });
    
    // State comï¿½
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [selectedBar, setSelectedBar] = useState<Bar | null>(null);
    const [showBarProfile, setShowBarProfile] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    // Radius removed - Filtering by Viewport now
    const [visibleBounds, setVisibleBounds] = useState<{ minLat: number, maxLat: number, minLng: number, maxLng: number } | null>(null);
    const [currentZoom, setCurrentZoom] = useState(14);

    // Data for Next Match Display
    const [allMatches, setAllMatches] = useState<Match[]>([]);
    const [nextMatch, setNextMatch] = useState<Match | null>(null);
    
    const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);
    const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
    const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
    const [loadingPlaceDetails, setLoadingPlaceDetails] = useState(false);
    const [isAvatarError, setIsAvatarError] = useState(false);

    // Force local placeholder if a remote image fails to load
    const [failedImages, setFailedImages] = useState<Record<string, true>>({});

    // Dades
    const [bars, setBars] = useState<Bar[]>([]);
    const [filteredBars, setFilteredBars] = useState<Bar[]>([]);
    
    // OSM / Scanning Logic
    const [scannedBars, setScannedBars] = useState<OSMBar[]>([]);
    const [isScanning, setIsScanning] = useState(false);

    // Refs (Web)
    const mapRef = useRef<MapRef>(null);
    const mapDivRef = useRef<View>(null);
    const googleMapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const osmMarkersRef = useRef<any[]>([]);
    const circleRef = useRef<any>(null);
    const centerMarkerRef = useRef<any>(null);
    const autocompleteInputRef = useRef<any>(null);
    const polylineRef = useRef<any>(null);
    const userMarkerRef = useRef<any>(null);

    // Refs (Native)
    const mapRefNative = useRef<any>(null);
    
    // Web Mapbox Loaded state
    const [mapboxLoaded, setMapboxLoaded] = useState(false);
    
    // Instruction Animation
    const instructionOpacity = useRef(new Animated.Value(1)).current;
    const bubbleScale = useRef(new Animated.Value(0)).current;
    const bubbleOpacity = useRef(new Animated.Value(0)).current;
    const [bubbleReady, setBubbleReady] = useState(false);

    // Responsive
    const { width, height } = useWindowDimensions();
    const isDesktop = width > 768; // Web Desktop Breakpoint

    // Draggable Bottom Sheet Logic (Animation)
    const bottomSheetHeight = useRef(new Animated.Value(120)).current; 
    const bottomSheetTranslateY = useRef(new Animated.Value(500)).current; // Start hidden
    const lastHeight = useRef(120);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            // ... (Bottom Sheet logic remains the same for simple touches)
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 2;
            },
            onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 2;
            },
            onPanResponderMove: (_, gestureState) => {
                if (isDesktop) return; // No drag on desktop
                
                let newHeight = lastHeight.current - gestureState.dy;
                // Limits
                if (newHeight < 120) newHeight = 120;
                if (newHeight > height * 0.8) newHeight = height * 0.8;

                bottomSheetHeight.setValue(newHeight);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (isDesktop) return;

                let targetHeight = 120;
                const currentHeight = lastHeight.current - gestureState.dy;

                // Snap logic
                if (currentHeight > 250 || (gestureState.vy < -0.5)) {
                    targetHeight = height * 0.6; // Obre al 60%
                } else {
                    targetHeight = 120; // Tanca
                }

                if (selectedBar && targetHeight < 200) targetHeight = 220;
                if (!selectedBar && targetHeight < 120) targetHeight = 120;

                Animated.spring(bottomSheetHeight, {
                    toValue: targetHeight,
                    useNativeDriver: false,
                    damping: 15
                }).start();
                
                lastHeight.current = targetHeight;
            }
        })
    ).current;

    // Edge Swipe Responder for Login Navigation (Edge from Left -> Right)
    const edgeSwipeResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Must start at the very edge (x < 50) AND be a right swipe (dx > 20)
                // We DON'T use Capture because we want to lose to internal scroll views if necessary,
                // but since it's absolute, it should be fine.
                // Using 'pageX' for absolute screen coordinates.
                return evt.nativeEvent.pageX < 60 && gestureState.dx > 10 && Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
            },
            onPanResponderMove: (_, gestureState) => {
                // We can animate something here if we want feedback
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx > 50) {
                    // Valid swipe
                    navigation.navigate('Login');
                }
            }
        })
    ).current;

    // --- EFFECTS ---

    // 1. GPS Localization (Common)
    useEffect(() => {
        (async () => {
             // Basic permission check
             let { status } = await Location.requestForegroundPermissionsAsync();
             if (status !== 'granted') {
                 setErrorMsg('Permï¿½s de localitzaciï¿½ denegat');
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

    // 2. Load Bars (filtered by matchId if navigated from Matches page)
    // Reload every time the screen gains focus (e.g. after reporting a bar)
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
        }, [loadBars])
    );

    // 3. Web Specific Initialization
    useEffect(() => {
        if (Platform.OS !== 'web') return; 

        // Inject Google Fonts (Lora - Clean Serif for better readability)
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        // Inject Custom Scrollbar Styles (Sketch/Hand-drawn Style)
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
        
        const loadMapAndAutocomplete = () => {
            if (window.google && window.google.maps) {
                if (autocompleteInputRef.current) {
                    try {
                        initWebAutocomplete();
                    } catch (e) {
                        console.error("Error initializing autocomplete: ", e);
                    }
                }
            }
        };

        if (!window.google) {
            const script = document.createElement('script');
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
            
            if (apiKey) {
                script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
                script.async = true;
                script.defer = true;
                script.onload = loadMapAndAutocomplete;
                document.head.appendChild(script);
            }
        } else {
            loadMapAndAutocomplete();
        }
    }, [centerLocation]); 

    // 4. Filtering Logic (viewport-only)
     useEffect(() => {
        if (!centerLocation) return; // Wait for location

        if (matchIdFromNav) {
            // When navigated from a match, show ALL broadcasting bars regardless of distance
            setFilteredBars(bars);

            // Auto-select the nearest bar
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

        // Filter based on visibleBounds if available, else show all within a reasonable range
        if (visibleBounds) {
             const inView = bars.filter(bar => 
                bar.latitude >= visibleBounds.minLat && bar.latitude <= visibleBounds.maxLat &&
                bar.longitude >= visibleBounds.minLng && bar.longitude <= visibleBounds.maxLng
             );
             // At low zoom: hide free-tier bars to reduce clutter, but always keep premium
             const FREE_HIDE_ZOOM = 13;
             if (currentZoom < FREE_HIDE_ZOOM) {
                 setFilteredBars(inView.filter(bar => bar.tier === 'premium'));
             } else {
                 setFilteredBars(inView);
             }
        } else {
             // Fallback: 20km around center if no bounds yet
             const nearbyBars = bars.filter(bar => 
                getDistanceFromLatLonInKm(centerLocation.latitude, centerLocation.longitude, bar.latitude, bar.longitude) <= 20
             );
             setFilteredBars(nearbyBars);
        }

    }, [centerLocation, visibleBounds, bars, matchIdFromNav, currentZoom]);

    // 5. Clean up scannedBars when bars reload (remove already-registered ones)
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

    // Notification Logic for Scanned Bars
    const [showScanTip, setShowScanTip] = useState(false);
    useEffect(() => {
        if (isScanning) {
            setShowScanTip(true);
        } else if (scannedBars.length > 0) {
            // Keep showing for 4 seconds after scan finishes
            const timer = setTimeout(() => setShowScanTip(false), 4000);
            return () => clearTimeout(timer);
        } else {
            setShowScanTip(false);
        }
    }, [isScanning, scannedBars.length]);


    // Radius Change Listener for Scanned Bars
    // If the user has scanned bars, and increases OR DECREASES the radius, automagically fetch/filter?
    // User requested: "si hem clicat a buscar bars, i ampliem el radi de cerca, tambï¿½ han d'aparï¿½ixer els bars amb aquesta ampliaciï¿½"
    // AND "hi ha algun problemet quan el fem mï¿½s petit" (make it smaller -> should probably filter strict to views?)
    
    useEffect(() => {
        /*
        if (scannedBars.length === 0 || !centerLocation) return;
        
        const timer = setTimeout(() => {
            // console.log('[Map] Radius changed with active scan. Fetching more...');
            
            // If shrinking radius significantly, maybe we should filter out the FAR away ones 
            // from the CURRENT view to avoid confusion?
            // "si fem el radi mï¿½s gran o mï¿½s petit, tambï¿½ ha de retornar els bars que toqui, ja sigui mï¿½s o menys."
            // IMPLIES: If smaller, show LESS.
            
            // Step 1: Filter existing scanned bars by new radius (visually clean up)
            // But allow some margin (e.g. 1.2x radius) so slight pans don't hide everything? 
            // Or stick to strict radius? Strict radius matches user intent best.
            
            setScannedBars(prev => prev.filter(b => {
                const dist = getDistanceFromLatLonInKm(centerLocation.latitude, centerLocation.longitude, b.lat, b.lon);
                return dist <= radiusKm;
            }));

            // Step 2: Fetch new ones (in case cache has *closer* ones we missed? Unlikely but good for consistency)
            handleManualScan(); 
        }, 800); // 800ms debounce
        */
        return () => {};
    }, []); // Removed radiusKm dependency



    // 6. Automatic OSM Scanning REMOVED - Now Manual
    /* 
    useEffect(() => { ... } 
    */

    async function handleManualScan() {
        if (!centerLocation) return;
        setIsScanning(true);
        try {
            // Default radius for manual scan instead of radiusKm state
            const osmData = await fetchBarsFromOSM(centerLocation.latitude, centerLocation.longitude, 1.5);
            
            // Deduplicate against FIRESTORE bars
            const newScanned = osmData.filter(osmItem => {
                const alreadyExists = bars.some(b => {
                     // Check by ID or proximity
                     if (b.id === osmItem.id) return true;
                     const dist = getDistanceFromLatLonInKm(osmItem.lat, osmItem.lon, b.latitude, b.longitude);
                     return dist < 0.05; 
                });
                return !alreadyExists;
            });
            
            // Deduplicate against already scanned bars (accumulation)
            setScannedBars(prev => {
                const combined = [...prev, ...newScanned];
                // Unique by ID
                const unique = Array.from(new globalThis.Map(combined.map(item => [item.id, item])).values()) as OSMBar[];
                return unique;
            });

        } catch (e) {
            console.error(e);
        } finally {
            setIsScanning(false);
        }
    };

    // Toggle: Button calls this
    const handleScanToggle = () => {
        if (scannedBars.length > 0) {
            setScannedBars([]); // Hide/Clear
        } else {
            handleManualScan(); // Search
        }
    };
            
    const clearScannedBars = () => setScannedBars([]);
        
    // 3. Load Matches for Banner
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
                    } else {
                        setNextMatch(null);
                    }
                }
            } catch (e) {
                console.warn("Failed to load matches for map banner", e);
            }
        };
        loadMatches();
        return () => { isMounted = false; };
    }, []);

    // 4. Update Map Visuals & Animation
    useEffect(() => {
        // Animation: Hide bottom sheet if 0 bars, Slide up/bounce if > 0
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
                    toValue: 500, // Hide downwards
                    duration: 300,
                    useNativeDriver: Platform.OS !== 'web',
                }).start();
            }
        }

        // Update Platform Specifics
        if (Platform.OS === 'web') {
            // MapBox visual logic is reactive to state (filteredBars), so no imperative DOM updates needed.
        } else {
            // Native Map automatically updates via 'filteredBars' prop to MapView
        }
    }, [filteredBars, isDesktop, bottomSheetTranslateY]); // Added dependencies properly


    // 5. Selected Bar Logic (Synced)
    useEffect(() => {
         // Reset bubble state
         setBubbleReady(false);
         bubbleScale.setValue(0);
         bubbleOpacity.setValue(0);

         // Animaciï¿½ del BottomSheet
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

         // Web: Center bar on map + fetch route
         if (Platform.OS === 'web') {
             if (selectedBar) {
                 if (googleMapRef.current) {
                     const map = googleMapRef.current;
                     const targetZoom = Math.max(map.getZoom() || 15, 16);
                     map.setZoom(targetZoom);
                     // Desplazar cap amunt perquï¿½ el marcador quedi a la part inferior de la pantalla (compensant la bafarada superposada)
                     // En zoom 16, 0.003 graus aprox compensen molt visualment
                     map.panTo({ lat: selectedBar.latitude + CAMERA_LAT_OFFSET, lng: selectedBar.longitude });
                 }
                 fetchWebRoute(selectedBar);
             } else {
                 setRouteInfo(null);
                 // Keep route drawn on the map until user clicks another bar
                 if (polylineRef.current) polylineRef.current.setMap(null);
             }
         }

         // Native: Center exactly on the bar
         if (Platform.OS !== 'web' && selectedBar && mapRefNative.current) {
             const newRegion = {
                // Desplacem el centre de la cï¿½mera "amunt" (valors de latitud positius)
                // perquï¿½ el pin en si quedi arrossegat cap a la part "mï¿½s baixa" de la pantalla
                latitude: selectedBar.latitude + CAMERA_LAT_OFFSET,
                longitude: selectedBar.longitude,
                latitudeDelta: MAP_REGION_DELTA,
                longitudeDelta: MAP_REGION_DELTA,
             };
             mapRefNative.current.animateToRegion(newRegion, 500);
         }

         // Google Places Details ï¿½ fetch, then mark bubble ready
         if (selectedBar) {
             setPlaceDetails(null);
             setLoadingPlaceDetails(true);
             const cleanName = getCleanBarName(selectedBar.name);
             fetchBarPlaceDetails(cleanName, selectedBar.latitude, selectedBar.longitude)
                 .then((details) => setPlaceDetails(details))
                 .catch(() => setPlaceDetails(null))
                 .finally(() => {
                     setLoadingPlaceDetails(false);
                     // Wait a bit for the map pan to settle, then show bubble
                     setTimeout(() => setBubbleReady(true), 350);
                 });
         } else {
             setPlaceDetails(null);
         }

    }, [selectedBar, isDesktop]);

    // 5b. Animate bubble in when content is ready
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

    // 6. Update user marker on web when userLocation becomes available after map init
    useEffect(() => {
        if (Platform.OS !== 'web' || !userLocation) return;

        // Mapbox / MapLibre Logic
        if (mapboxLoaded && mapRef.current) {
            if (!selectedBar) {
                mapRef.current.flyTo({
                    center: [userLocation.coords.longitude, userLocation.coords.latitude],
                    zoom: 14,
                    speed: 1.2
                });
            }
            return;
        }
        
        if (!googleMapRef.current) return;
        
        // Center map on user's actual position (map may have initialized with default Barcelona center)
        if (!selectedBar) {
            googleMapRef.current.panTo({ lat: userLocation.coords.latitude, lng: userLocation.coords.longitude });
        }
        
        if (userMarkerRef.current) userMarkerRef.current.setMap(null);
        userMarkerRef.current = new window.google.maps.Marker({
            position: { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude },
            map: googleMapRef.current,
            title: "La teva ubicaciï¿½",
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

    // --- WEB HELPERS ---
    function initWebAutocomplete() {
        if (!autocompleteInputRef.current) return;
        if (autocompleteInputRef.current.classList.contains('pac-target-input')) return;

        const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
             types: ['geocode', 'establishment'], componentRestrictions: { country: 'es' },
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) {
                alert("No s'ha trobat: " + place.name); return;
            }
            const newLocation = {
                latitude: place.geometry.location.lat(),
                longitude: place.geometry.location.lng()
            };
            setCenterLocation(newLocation);
            setSearchQuery(place.formatted_address || place.name);
            if (googleMapRef.current) {
                googleMapRef.current.panTo(place.geometry.location);
                googleMapRef.current.setZoom(15);
            }
        });
    }

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
                
                // MapLibre Route Line setup
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

                // Fallback for Google Maps if still used
                if (window.google && window.google.maps && window.google.maps.geometry && googleMapRef.current) {
                    const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
                    polylineRef.current = new window.google.maps.Polyline({
                        path: decodedPath, geodesic: true, strokeColor: SKETCH_THEME.colors.primary,
                        strokeOpacity: 1.0, strokeWeight: 5, map: googleMapRef.current
                    });
                }

                // Calculate info
                const durationSeconds = parseInt(route.duration.replace('s', ''));
                const durationText = durationSeconds > 3600 
                    ? `${Math.floor(durationSeconds/3600)} h ${Math.floor((durationSeconds%3600)/60)} min`
                    : `${Math.floor(durationSeconds/60)} min`;
                const distanceKm = (route.distanceMeters / 1000).toFixed(1) + ' km';
                setRouteInfo({ distance: distanceKm, duration: durationText });

                // Zoom to fit route bounds
                // On mobile, we keep the bar centered and let the user see the route from there
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

    // --- SHARED ACTIONS ---
    const centerMapToGPS = () => {
         if (userLocation) {
             setCenterLocation({ latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude });
             setSearchQuery('');
             // Web Specific UI Reset
             if (Platform.OS === 'web') {
                 if (mapRef.current) {
                     mapRef.current.flyTo({
                         center: [userLocation.coords.longitude, userLocation.coords.latitude],
                         zoom: 15
                     });
                 } else if (googleMapRef.current) {
                     // Fallback for Google Maps if somehow still used (but we are on Mapbox/MapLibre now)
                     googleMapRef.current.panTo({ lat: userLocation.coords.latitude, lng: userLocation.coords.longitude });
                     googleMapRef.current.setZoom(15);
                 }
                 
                 if (autocompleteInputRef.current) autocompleteInputRef.current.value = '';
             }
             // Native Specific UI Reset
             if (Platform.OS !== 'web' && mapRefNative.current) {
                 mapRefNative.current.animateToRegion({
                    latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude,
                    latitudeDelta: 0.01, longitudeDelta: 0.01,
                 }, 500);
             }
         }
    };

     const openExternalMaps = (bar: Bar) => {
        // Use place name + coordinates for accurate Google Maps navigation
        const barName = encodeURIComponent(bar.name);
        let url = `https://www.google.com/maps/dir/?api=1&destination=${barName}&destination_place_id=${bar.googlePlaceId || ''}&travelmode=walking`;
        
        // If no googlePlaceId, fall back to lat,lng
        if (!bar.googlePlaceId) {
            url = `https://www.google.com/maps/dir/?api=1&destination=${bar.latitude},${bar.longitude}&travelmode=walking`;
        }

        if (userLocation) {
            url += `&origin=${userLocation.coords.latitude},${userLocation.coords.longitude}`;
        } else if (centerLocation) {
            url += `&origin=${centerLocation.latitude},${centerLocation.longitude}`;
        }

        Linking.openURL(url);
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
    };

    // --- RENDERS ---

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
                    fallbackIsOpen={selectedBar.isOpen}
                    distanceText={distanceText}
                    onClose={() => closeBarBubble()}
                    onNavigate={() => openExternalMaps(selectedBar)}
                    tier={selectedBar.tier || 'free'}
                    onProfileOpen={() => setShowBarProfile(true)}
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
                            {filteredBars.length} bars confirmats {scannedBars.length > 0 ? `(+${scannedBars.length} possibles)` : ''}
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

    const renderSearchBarInput = () => {
        const placeholderText = "On vols veure el partit?";

        if (Platform.OS === 'web') {
             return (
                 <View style={styles.searchBar}>
                    <Feather name="search" size={20} color={SKETCH_THEME.colors.text} style={{marginRight: 10}} />
                    {/* @ts-ignore */}
                    <input
                        ref={autocompleteInputRef}
                        type="text"
                        placeholder={placeholderText}
                        style={{
                            flex: 1, fontSize: '16px', border: 'none', outline: 'none', backgroundColor: 'transparent', height: '100%', color: '#333', fontFamily: 'Lora'
                        }}
                        defaultValue={searchQuery}
                    />
                     {searchQuery !== '' && (
                        <TouchableOpacity onPress={centerMapToGPS} style={{marginRight: 8}}>
                            <Feather name="x" size={16} color="#666" />
                        </TouchableOpacity>
                    )}
                 </View>
             )
        }
        // Native Input (Simple Text Input for now, assuming no Autocomplete needed immediately or implemented via library)
        return (
             <View style={styles.searchBar}>
                <Feather name="search" size={20} color={SKETCH_THEME.colors.text} style={{marginRight: 10}} />
                <TextInput 
                    placeholder={placeholderText} 
                    style={styles.searchInput}
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    // For native, you'd integrate Google Places API call here on onSubmitEditing
                />
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
             
             {/* Global Next Match Info Banner ï¿½ uses MatchCard for visual consistency */}
             {nextMatch && (!selectedBar || isDesktop) && (
                <View style={{ marginTop: 8, marginHorizontal: Platform.OS === 'web' ? 0 : 4 }}>
                    <MatchCard match={nextMatch} compact={true} onPress={() => {}} />
                </View>
             )}

             { (!selectedBar || isDesktop) && (
                 <>
                    {renderRadiusSlider()}
                        {/* Scanned/Found Bars Action */}
                        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10}}>
                            <TouchableOpacity 
                                onPress={handleScanToggle}
                                disabled={isScanning}
                                style={{
                                    backgroundColor: SKETCH_THEME.colors.bg,
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

                            {/* Only show "Add more" if we already have some but maybe moved? 
                                Actually user wanted a toggle. So if we have bars, the button hides them. 
                                But what if we want to search anew? 
                                The radius slider update handles the "expand search" case.
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
             )}
        </View>
    );


    // Initial Loading State REMOVED
    // if (!userLocation && !centerLocation) { ... }

    return (
        <View style={[styles.container, isDesktop && { flexDirection: 'row' }]}>
            
            {/* DESKTOP SIDEBAR */}
            {isDesktop && (
                <View style={styles.desktopSidebar}>
                    {renderHeader()}
                    <View style={{flex: 1, paddingHorizontal: 16}}>
                        {renderContentPanel()}
                    </View>
                </View>
            )}

             {/* MAP AREA */}
             <View style={styles.mapContainer}>
                {Platform.OS === 'web' ? (
                    mapboxLoaded ? (
                    <MapboxMap
                        ref={mapRef}
                        mapLib={(window as any).maplibregl}
                        initialViewState={{ longitude: centerLocation?.longitude || 2.1734, latitude: centerLocation?.latitude || 41.3851, zoom: 14 }}
                        onMove={(evt: any) => setCenterLocation({ latitude: evt.viewState.latitude, longitude: evt.viewState.longitude })}
                        onMoveEnd={(evt: any) => {
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
                        {scannedBars.map(osmBar => (
                             <MapboxMarker key={osmBar.id} longitude={osmBar.lon} latitude={osmBar.lat} anchor="center" onClick={(e: any) => { e.originalEvent.stopPropagation(); navigation.navigate('ReportBar' as any, { osmBar }); }}>
                                 <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#777', borderWidth: 2, borderColor: 'white', ...Platform.select({ web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.3)' } }) }} />
                             </MapboxMarker>
                        ))}
                        {filteredBars
                        .slice() // copy so sort doesn't mutate
                        .sort((a, b) => {
                            // Render premium bars LAST so they appear on top (higher z-index in map)
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
                                        {/* 3D Pin Head — same for all bars */}
                                        <View style={{
                                            width: 34, height: 34, borderRadius: 17,
                                            borderBottomRightRadius: 2,
                                            transform: [{ rotate: '45deg' }],
                                            justifyContent: 'center', alignItems: 'center',
                                            ...Platform.select({
                                                web: {
                                                    background: isSelected
                                                        ? 'linear-gradient(135deg, #555 0%, #222 100%)'
                                                        : `linear-gradient(135deg, ${SKETCH_THEME.colors.primary} 0%, #2d8a56 100%)`,
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
                                        {/* Premium star badge */}
                                        {isPremium && (
                                            <View style={{
                                                position: 'absolute', top: -4, right: -6,
                                                width: 20, height: 20, borderRadius: 10,
                                                backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center',
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
                                offset={[0, -55]} // Float above the 3D pin marker
                                onClose={() => closeBarBubble()} 
                                closeOnClick={false} 
                                closeButton={false}
                                maxWidth="none"
                                style={{ padding: 0 }}
                            >
                                <View style={{
                                    width: Math.min(340, width * 0.88),
                                    backgroundColor: selectedBar?.tier === 'premium' ? SKETCH_THEME.colors.primary : 'white',
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
                                                fallbackIsOpen={selectedBar.isOpen} 
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
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
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
                             // Approximate zoom from latitudeDelta
                             const approxZoom = Math.log2(360 / region.latitudeDelta);
                             setCurrentZoom(approxZoom);
                        }}
                    >
                         {/* User Location Marker - Custom */}
                         {userLocation && (
                            <Marker
                                coordinate={{ 
                                    latitude: userLocation.coords.latitude, 
                                    longitude: userLocation.coords.longitude 
                                }}
                                title="La teva ubicaciï¿½"
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

                         {/* OSM Scanned Bars */}
                         {scannedBars.map(osmBar => (
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
                                            {/* Premium star badge */}
                                            {isPremium && (
                                                <View style={{
                                                    position: 'absolute', top: -4, right: -6,
                                                    width: 20, height: 20, borderRadius: 10,
                                                    backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center',
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
            
            {/* MOBILE OVERLAYS */}
            {!isDesktop && (
                <>
                    {/* Header ï¿½ ALWAYS show even when bar is selected, but maybe with reduced opacity or different z-index if needed? 
                        User complained "Abans ho tenï¿½em bï¿½" and showed an image with the search bar VISIBLE. 
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

                    <TouchableOpacity 
                        style={[
                            styles.fabGps,
                            { 
                                // Move GPS button up if bar is selected to not overlap with lower bubble? 
                                // Or keep it at bottom. User image shows it at bottom right.
                                bottom: user ? 100 : 20 
                            } 
                        ]}
                        onPress={centerMapToGPS}
                    >
                        <Feather name="crosshair" size={24} color={SKETCH_THEME.colors.text} />
                    </TouchableOpacity>

                    {/* Bar Detail Card - REMOVED */}

                    {/* Bottom Navigation Bar - Only show when authenticated */}
                    {user && (
                        <View style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: SKETCH_THEME.colors.bg,
                            borderTopWidth: 1,
                            borderTopColor: '#ddd',
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
                            <Ionicons name="calendar-outline" size={26} color={SKETCH_THEME.colors.textMuted} />
                            <Text style={{ fontSize: 11, color: SKETCH_THEME.colors.textMuted, marginTop: 4, fontFamily: 'Lora' }}>
                                Partits
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}
                            onPress={() => {}}
                        >
                            <View style={{
                                backgroundColor: SKETCH_THEME.colors.primary,
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
                            <Text style={{ fontSize: 11, color: SKETCH_THEME.colors.primary, marginTop: 8, fontWeight: 'bold', fontFamily: 'Lora' }}>
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
                                        borderColor: SKETCH_THEME.colors.textMuted
                                    }} 
                                />
                            ) : (
                                <Feather name="user" size={26} color={SKETCH_THEME.colors.textMuted} />
                            )}
                            <Text style={{ fontSize: 11, color: SKETCH_THEME.colors.textMuted, marginTop: 4, fontFamily: 'Lora' }}>
                                Perfil
                            </Text>
                        </TouchableOpacity>
                    </View>
                    )}
                </>
            )}

             {/* DESKTOP GPS BUTTON */}
             {isDesktop && (
                <>
                    <TouchableOpacity style={[styles.fabGps, { right: 20, bottom: 20 }]} onPress={centerMapToGPS}>
                        <Feather name="crosshair" size={24} color={SKETCH_THEME.colors.text} />
                    </TouchableOpacity>
                </>
             )}

            <StatusBar style="dark" />

            {renderSearchSettingsOverlay()}

             {/* EDGE SWIPE AREA - Invisible Left Area */}
             <View 
                {...edgeSwipeResponder.panHandlers}
                style={{
                    position: 'absolute', top: 0, bottom: 0, left: 0, width: 20, zIndex: 9999, backgroundColor: 'transparent'
                }}
             />

            {/* Premium Bar Profile Modal */}
            <BarProfileModal
                visible={showBarProfile}
                bar={selectedBar}
                placeDetails={placeDetails}
                onClose={() => setShowBarProfile(false)}
                onNavigate={() => selectedBar && openExternalMaps(selectedBar)}
            />
        </View>
    );

};



export default MapScreen;
