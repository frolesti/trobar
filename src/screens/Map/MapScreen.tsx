import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, Image, Dimensions, Alert, Keyboard, ScrollView, Linking, useWindowDimensions, PanResponder, Animated, Easing, ActivityIndicator } from 'react-native';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { Feather, Ionicons } from '@expo/vector-icons'; // Import Vector Icons
import { fetchBars, fetchBarsForMatch } from '../../services/barService';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { Bar } from '../../data/dummyData';
import { RootStackParamList } from '../../navigation/AppNavigator';
import MapView, { Marker, PROVIDER_GOOGLE } from '../../utils/GoogleMaps';
import { ensureLoraOnWeb, sketchFontFamily, sketchShadow, SKETCH_THEME } from '../../theme/sketchTheme';
import { CUSTOM_MAP_STYLE } from '../../theme/mapStyle';
import { executeRequest } from '../../api/core';
import { fetchAllMatches, Match } from '../../services/matchService';
import { fetchBarsFromOSM, OSMBar } from '../../services/osmService';
import { Picker } from '@react-native-picker/picker';
import styles from './MapScreen.styles';
import { formatTeamNameForDisplay } from '../../utils/teamName';
import MatchCard from '../../components/MatchCard';
import BarDetailCard from '../../components/BarDetailCard';
import BarListItem from '../../components/BarListItem';
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

// Helper (Shared)
const getCleanBarName = (name: string) => {
    return name.replace(/\s\d+$/, '');
};

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

    // Location: Ubicació REAL del dispositiu (GPS)
    const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
    // CenterLocation: Punt central de la cerca (pot ser GPS o una adreça buscada)
    // Inicialitzar amb Barcelona per defecte per evitar pantalla de càrrega bloquejant
    const [centerLocation, setCenterLocation] = useState<{latitude: number, longitude: number} | null>({
        latitude: 41.3851, 
        longitude: 2.1734
    });
    
    // State comú
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [selectedBar, setSelectedBar] = useState<Bar | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [radiusKm, setRadiusKm] = useState(1); // Radi de cerca per defecte: 1km

    // Data for Next Match Display
    const [allMatches, setAllMatches] = useState<Match[]>([]);
    const [nextMatch, setNextMatch] = useState<Match | null>(null);
    
    const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);
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
                 setErrorMsg('Permís de localització denegat');
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

    // 3. Web Specific Initialization (Google Maps JS)
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
        `;
        document.head.appendChild(style);

        const loadMapAndAutocomplete = () => {
            if (window.google && window.google.maps) {
                if (centerLocation && mapDivRef.current && !googleMapRef.current) {
                    try {
                        initWebMap();
                    } catch (e) {
                         console.error("Error initializing map: ", e);
                    }
                }
                if (autocompleteInputRef.current) {
                    try {
                        initWebAutocomplete();
                    } catch (e) {
                        console.error("Error initializing autocomplete: ", e);
                    }
                }
            } else {
                 console.warn("Google Maps SDK failed to load or is incomplete.");
            }
        };

        if (!window.google) {
            const script = document.createElement('script');
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
            
            if (apiKey) {
                // Afegim 'marker' per utilitzar AdvancedMarkerElement i evitar warnings
                script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,marker`;
                script.async = true;
                script.defer = true;
                script.onload = loadMapAndAutocomplete;
                document.head.appendChild(script);
            }
        } else {
            loadMapAndAutocomplete();
        }
    }, [centerLocation]); 

    // 4. Filtering Logic (distance-only, but bypass distance when navigated with matchId)
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

        // Normal mode: filter by distance
        const nearbyBars = bars.filter(bar => {
            const dist = getDistanceFromLatLonInKm(
                centerLocation.latitude, 
                centerLocation.longitude, 
                bar.latitude, 
                bar.longitude
            );
            
            if (dist > radiusKm) return false;
            return true;
        });
        setFilteredBars(nearbyBars);
    }, [centerLocation, radiusKm, bars, matchIdFromNav]);

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

    // 6. Automatic OSM Scanning REMOVED - Now Manual
    /* 
    useEffect(() => { ... } 
    */

    const handleManualScan = async () => {
        if (!centerLocation) return;
        setIsScanning(true);
        try {
            const osmData = await fetchBarsFromOSM(centerLocation.latitude, centerLocation.longitude, radiusKm);
            
            // Deduplicate: filter out OSM bars that already exist in Firestore
            const newScanned = osmData.filter(osmItem => {
                const alreadyExists = bars.some(b => {
                    // Match by ID (OSM ID used as doc ID) or by proximity
                    if (b.id === osmItem.id) return true;
                    const dist = getDistanceFromLatLonInKm(osmItem.lat, osmItem.lon, b.latitude, b.longitude);
                    return dist < 0.05; // 50 meters
                });
                return !alreadyExists;
            });

            setScannedBars(newScanned);
        } catch (e) {
            console.error(e);
        } finally {
            setIsScanning(false);
        }
    };
        
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
            updateWebMapVisuals(filteredBars);
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

         // Web: Center bar on map + fetch route
         if (Platform.OS === 'web') {
             if (selectedBar) {
                 if (googleMapRef.current) {
                     const map = googleMapRef.current;
                     const targetZoom = Math.max(map.getZoom() || 15, 16);
                     map.setZoom(targetZoom);
                     // Center exactly on the bar
                     map.panTo({ lat: selectedBar.latitude, lng: selectedBar.longitude });
                 }
                 fetchWebRoute(selectedBar);
             } else {
                 setRouteInfo(null);
                 if (polylineRef.current) polylineRef.current.setMap(null);
             }
         }

         // Native: Center exactly on the bar
         if (Platform.OS !== 'web' && selectedBar && mapRefNative.current) {
             const newRegion = {
                latitude: selectedBar.latitude,
                longitude: selectedBar.longitude,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
             };
             mapRefNative.current.animateToRegion(newRegion, 500);
         }

         // Google Places Details — fetch, then mark bubble ready
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
        if (Platform.OS !== 'web' || !googleMapRef.current || !userLocation) return;
        
        // Center map on user's actual position (map may have initialized with default Barcelona center)
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
    }, [userLocation]);

    // --- WEB HELPERS ---
    const initWebMap = () => {
        if (!centerLocation) return;
        if (!window.google || !window.google.maps) {
            console.error("Cannot init map: SDK not loaded");
            return;
        }

        const mapDomNode = mapDivRef.current as unknown as HTMLElement;
        const mapOptions = {
            center: { lat: centerLocation.latitude, lng: centerLocation.longitude },
            zoom: 14, 
            disableDefaultUI: true, 
            clickableIcons: false,
            gestureHandling: 'greedy', // Forces one-finger pan (fixes "Use two fingers to move map")
            styles: CUSTOM_MAP_STYLE,
            backgroundColor: SKETCH_THEME.colors.bg,
            // mapId removed to allow 'styles' (JSON) to work. AdvancedMarkerElement disabled.
        };
        let map: any;
        try {
            map = new window.google.maps.Map(mapDomNode, mapOptions);
            googleMapRef.current = map;
        } catch (error) {
            console.error("FAIL: new google.maps.Map threw error. Likely invalid API Key or project config.", error);
            setErrorMsg("No s'ha pogut carregar el mapa. Revisa la clau API.");
            return;
        }

        // User Marker (Legacy Marker for JSON styles compatibility)
        if (userLocation) {
            if (userMarkerRef.current) userMarkerRef.current.setMap(null);
            userMarkerRef.current = new window.google.maps.Marker({
                position: { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude },
                map: map,
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
        }
        
        map.addListener("click", () => { closeBarBubble(); Keyboard.dismiss(); });
        updateWebMapVisuals(filteredBars); // Initial render
    };

    const initWebAutocomplete = () => {
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

    const updateWebMapVisuals = (barsToRender: Bar[]) => {
        if (!googleMapRef.current || !centerLocation) return;
        
        // Cercle: Reuse or Create
        if (!circleRef.current) {
            circleRef.current = new window.google.maps.Circle({
                strokeColor: SKETCH_THEME.colors.primary, strokeOpacity: 0.6, strokeWeight: 1, // Minimalist stroke
                fillColor: SKETCH_THEME.colors.primary, fillOpacity: 0.05, // Very faint fill
                map: googleMapRef.current,
                clickable: false,
                center: { lat: centerLocation.latitude, lng: centerLocation.longitude },
                radius: radiusKm * 1000
            });
        } else {
            // Smooth update without flickering
            circleRef.current.setCenter({ lat: centerLocation.latitude, lng: centerLocation.longitude });
            
            // Optional: Simple interpolation could go here, but frequent updates from slider are usually enough.
            circleRef.current.setRadius(radiusKm * 1000);
            
            // Ensure map is set (in case it was nulled)
            if (circleRef.current.getMap() !== googleMapRef.current) {
                circleRef.current.setMap(googleMapRef.current);
            }
        }

        // Center Marker ("Pin" style)
        if (centerMarkerRef.current) centerMarkerRef.current.setMap(null);
        // Only if not near user location
        let showCenter = true;
        if (userLocation) {
             const dist = getDistanceFromLatLonInKm(centerLocation.latitude, centerLocation.longitude, userLocation.coords.latitude, userLocation.coords.longitude);
             if (dist < 0.05) showCenter = false;
        }
        if (showCenter) {
            centerMarkerRef.current = new window.google.maps.Marker({
                position: { lat: centerLocation.latitude, lng: centerLocation.longitude },
                map: googleMapRef.current,
                zIndex: 900,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 5,
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    strokeColor: SKETCH_THEME.colors.text,
                    strokeWeight: 2
                }
            });
        }

        // Bar Markers (Custom Sketchy Pins)
        if (markersRef.current) {
            markersRef.current.forEach(m => m.setMap(null));
        }
        markersRef.current = [];
        
        barsToRender.forEach(bar => {
            // Legacy Marker with SVG Icon
            const svgString = `
                <svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="${SKETCHY_PIN_PATH}" fill="${SKETCH_THEME.colors.primary}" fill-opacity="0.9" />
                </svg>
            `;
            const svgIcon = {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString),
                scaledSize: new window.google.maps.Size(36, 36),
                anchor: new window.google.maps.Point(18, 36) 
            };

            const marker = new window.google.maps.Marker({
                position: { lat: bar.latitude, lng: bar.longitude },
                map: googleMapRef.current,
                title: getCleanBarName(bar.name),
                icon: svgIcon,
            });
            marker.addListener("click", () => { setSelectedBar(bar); });
            markersRef.current.push(marker);
        });
    };

    // Helper to render OSM markers on Web
    const updateWebOSMMarkers = (osmData: OSMBar[]) => {
        if (!googleMapRef.current) return;

        // Clear old
        if (osmMarkersRef.current) {
            osmMarkersRef.current.forEach(m => m.setMap(null));
        }
        osmMarkersRef.current = [];

        osmData.forEach(osmItem => {
             const marker = new window.google.maps.Marker({
                position: { lat: osmItem.lat, lng: osmItem.lon },
                map: googleMapRef.current,
                title: osmItem.name,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 6, // Slightly larger
                    fillColor: '#E0E0E0', // Lighter gray
                    fillOpacity: 1,
                    strokeColor: '#757575', // Darker border for visibility
                    strokeWeight: 2
                },
                zIndex: 50 // Behind real bars
            });

            marker.addListener("click", () => {
                navigation.navigate('ReportBar' as any, { osmBar: osmItem });
            });
            osmMarkersRef.current.push(marker);
        });
    };

    useEffect(() => {
        if (Platform.OS === 'web') updateWebOSMMarkers(scannedBars);
    }, [scannedBars]);

    const fetchWebRoute = async (bar: Bar) => {
        if (!centerLocation || !googleMapRef.current) return;
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
                    origin: { location: { latLng: { latitude: centerLocation.latitude, longitude: centerLocation.longitude } } },
                    destination: { location: { latLng: { latitude: bar.latitude, longitude: bar.longitude } } },
                    travelMode: 'WALK', units: 'METRIC',
                })
            });
            const result = await response.json();
            if (result.routes && result.routes.length > 0) {
                const route = result.routes[0];
                if (polylineRef.current) polylineRef.current.setMap(null);
                const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
                polylineRef.current = new window.google.maps.Polyline({
                    path: decodedPath, geodesic: true, strokeColor: SKETCH_THEME.colors.primary,
                    strokeOpacity: 1.0, strokeWeight: 5, map: googleMapRef.current
                });
                // Calculate info
                const durationSeconds = parseInt(route.duration.replace('s', ''));
                const durationText = durationSeconds > 3600 
                    ? `${Math.floor(durationSeconds/3600)} h ${Math.floor((durationSeconds%3600)/60)} min`
                    : `${Math.floor(durationSeconds/60)} min`;
                const distanceKm = (route.distanceMeters / 1000).toFixed(1) + ' km';
                setRouteInfo({ distance: distanceKm, duration: durationText });

                // Zoom to fit route bounds — only on desktop
                // On mobile, we keep the bar centered and let the user see the route from there
                if (isDesktop && googleMapRef.current && decodedPath.length > 0) {
                    const bounds = new window.google.maps.LatLngBounds();
                    decodedPath.forEach((point: any) => bounds.extend(point));
                    googleMapRef.current.fitBounds(bounds, {
                        top: 60,
                        bottom: 80,
                        left: 420,
                        right: 30,
                    });
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
             if (Platform.OS === 'web' && googleMapRef.current) {
                 googleMapRef.current.panTo({ lat: userLocation.coords.latitude, lng: userLocation.coords.longitude });
                 googleMapRef.current.setZoom(15);
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
        // Use coordinates as destination to match the in-app route exactly
        const destination = `${bar.latitude},${bar.longitude}`;
        
        let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;

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
        });
    };

    // --- RENDERS ---

    const renderContentPanel = () => {
         if (selectedBar) {
            const distanceText = routeInfo 
                ? `${routeInfo.duration} caminant (${routeInfo.distance})`
                : `A ${getDistanceFromLatLonInKm(centerLocation!.latitude, centerLocation!.longitude, selectedBar.latitude, selectedBar.longitude).toFixed(1)} km`;

            return (
                <BarDetailCard
                    bar={selectedBar}
                    placeDetails={placeDetails}
                    loadingPlaceDetails={loadingPlaceDetails}
                    distanceText={distanceText}
                    onClose={() => closeBarBubble()}
                    onNavigate={() => openExternalMaps(selectedBar)}
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

        if (Platform.OS === 'web') {
            return (
                <View style={[styles.radiusContainer, { width: '100%', paddingHorizontal: 4, marginTop: 12 }]}>
                        <View style={{ width: '100%', height: 20, justifyContent: 'center' }}>
                             {/* @ts-ignore */}
                             <input type="range" min="0.1" max="5" step="0.1" value={radiusKm} onChange={(e: any) => setRadiusKm(parseFloat(e.target.value))} 
                                style={{ width: '100%', accentColor: SKETCH_THEME.colors.primary, cursor: 'pointer', height: 6 }} 
                             />
                        </View>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: -4}}>
                             <Text style={{fontSize: 10, color: '#999', fontFamily: 'Lora'}}>0.1 km</Text>
                             <Text style={styles.radiusLabel}>{radiusKm < 1 ? `${Math.round(radiusKm*1000)} m` : `${radiusKm} km`}</Text>
                             <Text style={{fontSize: 10, color: '#999', fontFamily: 'Lora'}}>5 km</Text>
                        </View>
                </View>
            )
        }
        return null; // Native fallback
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
             
             {/* Global Next Match Info Banner — uses MatchCard for visual consistency */}
             {nextMatch && (!selectedBar || isDesktop) && (
                <View style={{ marginTop: 8, marginHorizontal: Platform.OS === 'web' ? 0 : 4 }}>
                    <MatchCard match={nextMatch} compact={true} onPress={() => {}} />
                </View>
             )}

             { (!selectedBar || isDesktop) && (
                 <>
                    {renderRadiusSlider()}
                    <TouchableOpacity 
                        onPress={handleManualScan}
                        disabled={isScanning}
                        style={{
                            marginTop: 10,
                            backgroundColor: SKETCH_THEME.colors.bg,
                            borderWidth: 2, 
                            borderColor: SKETCH_THEME.colors.primary,
                            borderRadius: 20,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            alignSelf: 'center',
                            flexDirection: 'row',
                            alignItems: 'center',
                            ...sketchShadow()
                        }}
                    >
                         {isScanning ? (
                             <ActivityIndicator size="small" color={SKETCH_THEME.colors.primary} style={{marginRight: 8}} />
                         ) : (
                             <Feather name="search" size={16} color={SKETCH_THEME.colors.primary} style={{marginRight: 8}} />
                         )}
                         <Text style={{
                             color: SKETCH_THEME.colors.primary, 
                             fontWeight: 'bold', 
                             fontFamily: 'Lora',
                             fontSize: 12
                         }}>
                             {isScanning ? 'Cercant bars...' : 'Cercar bars en aquesta zona'}
                         </Text>
                    </TouchableOpacity>
                    { scannedBars.length > 0 && (
                        <View style={{ marginTop: 8, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8, paddingVertical: 4 }}>
                            <Text style={{ fontSize: 11, color: SKETCH_THEME.colors.textMuted, textAlign: 'center', fontFamily: 'Lora' }}>
                                <Text style={{fontWeight: 'bold'}}>Gris</Text> = Bars sense confirmar. Clica'ls per avisar si donen partits!
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
                     <View 
                        ref={mapDivRef} 
                        style={{ width: '100%', height: '100%' }} 
                        // @ts-ignore
                        dataSet={{ map: "true" }} 
                     />
                ) : (
                    <MapView
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
                    >
                         {/* User Location Marker - Custom */}
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

                         {/* OSM Scanned Bars */}
                         {scannedBars.map(osmBar => (
                            <Marker
                                key={osmBar.id}
                                coordinate={{ latitude: osmBar.lat, longitude: osmBar.lon }}
                                onPress={() => navigation.navigate('ReportBar' as any, { osmBar })}
                                zIndex={1}
                            >
                                <View style={{ 
                                    width: 12, height: 12, borderRadius: 6, 
                                    backgroundColor: '#bbb', 
                                    borderWidth: 1, borderColor: 'white',
                                    ...Platform.select({
                                        ios: { shadowColor: 'black', shadowOffset: {width:0, height:1}, shadowOpacity: 0.2, shadowRadius: 1 },
                                        android: { elevation: 2 }
                                    })
                                }} />
                            </Marker>
                         ))}

                         {filteredBars.map((bar) => {
                             // Basic Native Marker
                             return (
                                <Marker
                                    key={bar.id}
                                    coordinate={{ latitude: bar.latitude, longitude: bar.longitude }}
                                    title={getCleanBarName(bar.name)}
                                    onPress={() => setSelectedBar(bar)}
                                >
                                     <View style={[styles.markerContainer]}>
                                        <View style={[styles.markerBubble, selectedBar?.id === bar.id && styles.markerBubbleSelected]}>
                                            <Text style={styles.markerText}>🍺</Text>
                                        </View>
                                        <View style={styles.markerArrow} />
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
                    {/* Header — ALWAYS show even when bar is selected, but maybe with reduced opacity or different z-index if needed? 
                        User complained "Abans ho teníem bé" and showed an image with the search bar VISIBLE. 
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

                    {/* Bar Detail Card — bubble just above the bar marker at screen center */}
                    {selectedBar && bubbleReady && (
                        <>
                            {/* Transparent backdrop to close on outside tap */}
                            <TouchableOpacity
                                activeOpacity={1}
                                onPress={closeBarBubble}
                                style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    zIndex: 99,
                                }}
                            />
                            <Animated.View 
                                style={{
                                    position: 'absolute',
                                    // User says "No veus que no està ben adaptat això?". 
                                    // Image 1 shows the bubble CENTERED vertically or almost so.
                                    // Recent change was `bottom: height/2 + 16`. 
                                    // If user wants "Abans ho teníem bé", maybe they meant the `+30` or even higher?
                                    // BUT, the complaints were about "poc marge superior".
                                    // Let's bring it slightly lower to accommodate the HEADER which is now visible again.
                                    // If header is visible (approx 150px?), we need the bubble to not overlap it.
                                    // `maxHeight: height/2 - 80` is roughly 40-50% of screen.
                                    // If `bottom` is center + 16, the bubble extends UP from the center.
                                    // So top of bubble = Center - HeightOfBubble.
                                    // If HeightOfBubble is large, it hits the header.
                                    
                                    // Let's try to be safer and push it slightly lower, or reduce max height further if header is present.
                                    bottom: Math.round(height / 2) + 24, 
                                    left: 14,
                                    right: 14,
                                    maxHeight: Math.round(height * 0.45), // Limit height to 45% of screen to avoid header collision
                                    zIndex: 100,
                                    opacity: bubbleOpacity,
                                    transform: [{ scale: bubbleScale }],
                                }}
                            >
                                {/* Bubble body */}
                                <View style={{
                                    backgroundColor: 'white',
                                    borderRadius: 16,
                                    // Removed black border as requested
                                    padding: 14,
                                    ...Platform.select({
                                        web: { boxShadow: '0px 4px 20px rgba(0,0,0,0.15)' },
                                        default: { shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.15, shadowRadius: 10, elevation: 12 }
                                    })
                                }}>
                                    {/* Fixed Close Button — outside ScrollView */}
                                    {/* <TouchableOpacity
                                        onPress={closeBarBubble}
                                        style={{ 
                                            position: 'absolute', 
                                            top: 8, 
                                            right: 8, 
                                            zIndex: 20,
                                            padding: 8,
                                            backgroundColor: 'rgba(255,255,255,0.8)',
                                            borderRadius: 20
                                        }}
                                    >
                                        <Feather name="x" size={22} color="#999" />
                                    </TouchableOpacity> */}

                                    <ScrollView 
                                        showsVerticalScrollIndicator={false}
                                        style={{ maxHeight: Math.round(height / 2) - 90 }}
                                        nestedScrollEnabled
                                        contentContainerStyle={{ paddingTop: 10 }}
                                    >
                                        {renderContentPanel()}
                                    </ScrollView>
                                </View>
                                {/* Triangle pointer — points down towards the bar marker */}
                                <View style={{
                                    alignSelf: 'center',
                                    marginTop: -1, // Sligth overlap to merge with bubble
                                    width: 0, height: 0,
                                    borderLeftWidth: 14,
                                    borderRightWidth: 14,
                                    borderTopWidth: 16,
                                    borderLeftColor: 'transparent',
                                    borderRightColor: 'transparent',
                                    borderTopColor: 'white', // Color match bubble background
                                    // Add subtle shadow only to triangle? Hard with CSS borders. 
                                    // Usually easier to just leave it seamless or use SVG. 
                                    // For now, let's keep it simple as requested: white triangle, no black border.
                                }} />
                                {/* Bottom spacer to ensure it clears the marker */}
                                <View style={{height: 10}} /> 
                            </Animated.View>
                        </>
                    )}

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
                                default: { shadowColor: 'black', shadowOffset: {width: 0, height: -2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 8 }
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
        </View>
    );

};



export default MapScreen;
