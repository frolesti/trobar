import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, Image, Dimensions, Alert, Keyboard, ScrollView, Linking, useWindowDimensions, PanResponder, Animated, Easing } from 'react-native';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { Feather, Ionicons } from '@expo/vector-icons'; // Import Vector Icons
import { fetchBars } from '../../services/barService';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Bar } from '../../data/dummyData';
import { seedDatabase } from '../../utils/seedDatabase';
import MapView, { Marker, PROVIDER_GOOGLE } from '../../utils/GoogleMaps';
import { ensureLoraOnWeb, sketchFontFamily, sketchShadow, SKETCH_THEME } from '../../theme/sketchTheme';
import { CUSTOM_MAP_STYLE } from '../../theme/mapStyle';
import { executeRequest } from '../../api/core';
import { fetchAllMatches, Match } from '../../services/matchService';
import { fetchBarsFromOSM, OSMBar } from '../../services/osmService';
import { Picker } from '@react-native-picker/picker';
import styles from './MapScreen.styles';
import { formatTeamNameForDisplay } from '../../utils/teamName';

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

    // Refs (Native)
    const mapRefNative = useRef<any>(null);
    
    // Instruction Animation
    const instructionOpacity = useRef(new Animated.Value(1)).current;

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

    // 2. Load Bars
    useEffect(() => {
        const loadInitialData = async () => {
            // Load Bars
            const firestoreBars = await fetchBars();
            setBars(firestoreBars);
        };
        loadInitialData();
    }, []);

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
            if (centerLocation && mapDivRef.current && !googleMapRef.current && window.google) {
                initWebMap();
            }
            if (window.google && autocompleteInputRef.current) {
                initWebAutocomplete();
            }
        };

        if (!window.google) {
            const script = document.createElement('script');
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
            
            if (apiKey) {
                // Afegim 'marker' per utilitzar AdvancedMarkerElement i evitar warnings
                script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,marker&loading=async`;
                script.async = true;
                script.defer = true;
                script.onload = loadMapAndAutocomplete;
                document.head.appendChild(script);
            }
        } else {
            loadMapAndAutocomplete();
        }
    }, [centerLocation]); 

    // 4. Filtering Logic (distance-only)
     useEffect(() => {
        if (!centerLocation) return; // Wait for location

        // Filter Logic
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
    }, [centerLocation, radiusKm, bars]);

    // 5. Automatic OSM Scanning (Debounced)
    useEffect(() => {
        if (!centerLocation) return;
        
        let isActive = true;
        const timer = setTimeout(async () => {
             if (isActive) {
                 setIsScanning(true);
                 // Scan slightly wider than the user's view radius to be safe? 
                 // Or stick to 1:1. Let's do 1:1 but capped at 1.5km inside the service.
                 const osmData = await fetchBarsFromOSM(centerLocation.latitude, centerLocation.longitude, radiusKm);
                 
                 // Deduplicate: Remove OSM nodes that are already in our 'bars' DB (approx match < 50m)
                 const newScanned = osmData.filter(osmItem => {
                      const alreadyExists = bars.some(b => {
                          const dist = getDistanceFromLatLonInKm(osmItem.lat, osmItem.lon, b.latitude, b.longitude);
                          return dist < 0.05; // 50 meters
                      });
                      return !alreadyExists;
                 });
                 
                 if (isActive) {
                     setScannedBars(newScanned);
                     setIsScanning(false);
                 }
             }
        }, 1200); // 1.2s Debounce to avoid spamming while sliding slider

        return () => {
            isActive = false;
            clearTimeout(timer);
        };
    }, [centerLocation, radiusKm, bars]);
        
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

    // RENDER HELPERS
    const renderNextMatchBanner = () => {
        if (!nextMatch) return null;
        
        // Safe check for dates
        let dateStr = "Avui";
        if (nextMatch.date) {
            // @ts-ignore
            const d = nextMatch.date.toDate ? nextMatch.date.toDate() : new Date(nextMatch.date);
            const isToday = new Date().toDateString() === d.toDateString();
            dateStr = isToday ? 
                `AVUI ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}h` : 
                `${d.toLocaleDateString('ca-ES', {weekday: 'short', day: 'numeric'})} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}h`;
        }

        return (
            <View style={styles.nextMatchContainer}>
                <View style={{flex: 1}}>
                    <Text style={styles.nextMatchTitle}>Propers Partits</Text>
                    <Text style={styles.nextMatchTeams}>
                        {formatTeamNameForDisplay(nextMatch.teamHome)} vs {formatTeamNameForDisplay(nextMatch.teamAway)}
                    </Text>
                    <Text style={styles.nextMatchInfo}>
                        {nextMatch.competition} • {dateStr}
                    </Text>
                </View>
                <View style={{ backgroundColor: SKETCH_THEME.colors.primary, borderRadius: 20, padding: 6 }}>
                     <Ionicons name="football" size={20} color="white" />
                </View>
            </View>
        );
    };

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


    // 5. Selected Bar Animation (Synced)
    useEffect(() => {
         // AnimaciÃ³ del BottomSheet
         if (Platform.OS !== 'web' || !isDesktop) {
            // MÃ²bil o Native
            if (selectedBar) {
                const target = Math.min(Math.max(380, height * 0.58), height * 0.78);
                Animated.timing(bottomSheetHeight, {
                    toValue: target,
                    duration: 300,
                    useNativeDriver: false
                }).start();
                lastHeight.current = target;
            } else {
                // If closing details but we have results, go to list view (25%) instead of minimizing
                const hasResults = filteredBars.length > 0;
                // Reduced from 45% -> 25% (and min 300 -> 160) to be less intrusive initially
                const target = hasResults ? Math.max(160, height * 0.25) : 120;
                
                Animated.timing(bottomSheetHeight, {
                    toValue: target, 
                    duration: 300,
                    useNativeDriver: false
                }).start();
                lastHeight.current = target;
            }
         }

         // Web Route
         if (Platform.OS === 'web') {
             if (selectedBar) fetchWebRoute(selectedBar);
             else {
                 setRouteInfo(null);
                 if (polylineRef.current) polylineRef.current.setMap(null);
             }
         }

         // Native Map Centering
         if (Platform.OS !== 'web' && selectedBar && mapRefNative.current) {
             const newRegion = {
                latitude: selectedBar.latitude - 0.002, 
                longitude: selectedBar.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
             };
             mapRefNative.current.animateToRegion(newRegion, 500);
         }

    }, [selectedBar, isDesktop]);

    // --- WEB HELPERS ---
    const initWebMap = () => {
        if (!centerLocation) return;
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
        const map = new window.google.maps.Map(mapDomNode, mapOptions);
        googleMapRef.current = map;

        // User Marker (Legacy Marker for JSON styles compatibility)
        if (userLocation) {
            new window.google.maps.Marker({
                position: { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude },
                map: map,
                title: "Tu", 
                zIndex: 999,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    fillColor: SKETCH_THEME.colors.text,
                    fillOpacity: 0.8,
                    strokeColor: 'white',
                    strokeWeight: 2,
                }
            });
        }
        
        map.addListener("click", () => { setSelectedBar(null); Keyboard.dismiss(); });
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
                    scale: 5,
                    fillColor: '#bbb',
                    fillOpacity: 0.8,
                    strokeColor: 'white',
                    strokeWeight: 1
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
        // Clean the name in case it has the legacy number suffix (e.g. "Bar Name 12")
        // We use the Name for destination because our database coordinates are approximate (randomized),
        // so searching by name gives users the actual real-world location of the venue.
        const cleanName = getCleanBarName(bar.name);
        const destinationQuery = encodeURIComponent(`${cleanName}, Barcelona, Spain`);
        
        let url = `https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}&travelmode=walking`;

        // Afegim l'origen explÃ­citament per assegurar que Google Maps fa servir la mateixa ubicaciÃ³ que l'app
        // AixÃ² soluciona possibles discrepÃ ncies si el GPS del navegador va amb retard
        if (userLocation) {
            url += `&origin=${userLocation.coords.latitude},${userLocation.coords.longitude}`;
        } else if (centerLocation) {
            url += `&origin=${centerLocation.latitude},${centerLocation.longitude}`;
        }

        Linking.openURL(url);
    };

    // --- RENDERS ---

    const renderContentPanel = () => {
         if (selectedBar) {
            return (
                <View style={styles.detailContainer}>
                    <View style={[styles.detailHeader, {flexDirection: 'row'}]}>
                        <Image
                            source={failedImages[selectedBar.id] ? DEFAULT_BAR_IMAGE : getBarImageSource(selectedBar.image)}
                            style={styles.barImage}
                            resizeMode="cover"
                            onError={() => setFailedImages((prev) => (prev[selectedBar.id] ? prev : { ...prev, [selectedBar.id]: true }))}
                        />
                        <View style={styles.headerInfo}>
                            <Text style={styles.barName}>{getCleanBarName(selectedBar.name)}</Text>
                            <View style={styles.ratingContainer}>
                                <Feather name="star" size={14} color={SKETCH_THEME.colors.text} style={{marginRight: 4}} />
                                <Text style={styles.ratingText}>{selectedBar.rating}</Text>
                                <Text style={[styles.statusTag, selectedBar.isOpen ? styles.open : styles.closed]}>
                                    {selectedBar.isOpen ? 'Obert' : 'Tancat'}
                                </Text>
                            </View>
                            <Text style={{fontSize:12, color:'#666', marginTop:4, fontFamily: 'Lora'}}>
                                {routeInfo 
                                    ? `⏱️ ${routeInfo.duration} caminant (${routeInfo.distance})`
                                    : `📍 A ${getDistanceFromLatLonInKm(centerLocation!.latitude, centerLocation!.longitude, selectedBar.latitude, selectedBar.longitude).toFixed(1)} km`
                                }
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedBar(null)} style={{padding: 5}}>
                            <Feather name="x" size={24} color="#999" />
                        </TouchableOpacity>
                    </View>

                    {/* ALWAYS SHOW GLOBAL NEXT MATCH FOR BARCA APP */}
                    {nextMatch && (
                        <View style={styles.matchCard}>
                            <Text style={styles.matchTitle}>
                                Pròxim Partit ({nextMatch.competition === 'Masculí' ? 'M' : 'F'})
                            </Text>
                            <View style={styles.matchTeams}>
                                <Text style={styles.teamText}>{nextMatch.teamHome}</Text>
                                <Text style={styles.vsText}>vs</Text>
                                <Text style={styles.teamText}>{nextMatch.teamAway}</Text>
                            </View>
                             <Text style={{color: SKETCH_THEME.colors.textMuted, fontSize: 11, textAlign:'center', marginTop: 4, fontStyle:'italic'}}>
                                {selectedBar.name} emetrà aquest partit.
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity 
                        style={{backgroundColor: SKETCH_THEME.colors.primary, borderRadius: 12, padding: 15, alignItems:'center', marginTop: 10}}
                        onPress={() => openExternalMaps(selectedBar)}
                    >
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Feather name="navigation" size={18} color="white" style={{marginRight: 8}} />
                            <Text style={{color:'white', fontWeight:'bold', fontSize: 16, fontFamily: 'Lora'}}>Com arribar-hi</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={{flex: 1}}>
                {renderNextMatchBanner()}
                <View style={{alignItems: 'center', marginBottom: 15, marginTop: 10}}>
                     <View style={{
                         backgroundColor: SKETCH_THEME.colors.text, 
                         paddingVertical: 6, paddingHorizontal: 16, 
                         borderRadius: 16, marginBottom: 8,
                         transform: [{ rotate: '-1deg' }] // Tocs sketchy
                     }}>
                        <Text style={{color: SKETCH_THEME.colors.bg, fontWeight: 'bold', fontSize: 13, fontFamily: 'Lora'}}>
                            Hem trobat {filteredBars.length} bars
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
                        filteredBars.map((bar, index) => (
                        <TouchableOpacity 
                            key={index} 
                            style={{
                                flexDirection:'row', padding: 10, marginBottom: 8, 
                                backgroundColor: SKETCH_THEME.colors.bg, borderRadius: 12, borderWidth: 1, borderColor: '#D7CCC8',
                                ...Platform.select({
                                    web: { boxShadow: '2px 2px 0px rgba(62,39,35,0.1)' },
                                    default: { shadowColor: '#3E2723', shadowOffset: {width: 1, height: 1}, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }
                                })
                            }}
                            onPress={() => setSelectedBar(bar)}
                        >
                             <Image
                                 source={failedImages[bar.id] ? DEFAULT_BAR_IMAGE : getBarImageSource(bar.image)}
                                 style={{width: 60, height: 60, borderRadius: 8, backgroundColor:'#eee', borderWidth: 1, borderColor: '#D7CCC8'}}
                                 resizeMode="cover"
                                 onError={() => setFailedImages((prev) => (prev[bar.id] ? prev : { ...prev, [bar.id]: true }))}
                             />
                             <View style={{marginLeft: 12, justifyContent:'center', flex: 1}}>
                                 <Text style={{fontWeight:'bold', fontSize: 16, fontFamily: 'Lora', color: SKETCH_THEME.colors.text, marginBottom: 2}}>{getCleanBarName(bar.name)}</Text>
                                 <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                                     <Feather name="map-pin" size={10} color={SKETCH_THEME.colors.textMuted} style={{marginRight: 4}} />
                                     <Text style={{fontSize: 12, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora'}}>
                                        {getDistanceFromLatLonInKm(centerLocation!.latitude, centerLocation!.longitude, bar.latitude, bar.longitude).toFixed(1)} km
                                     </Text>
                                 </View>
                                 <View style={{flexDirection:'row', alignItems: 'center'}}>
                                     <Feather name="star" size={12} color="#FFA000" style={{marginRight: 2}} />
                                     <Text style={{fontSize: 12, color: SKETCH_THEME.colors.text, fontFamily: 'Lora', fontWeight: 'bold'}}>{bar.rating}</Text>
                                     {bar.nextMatch && (
                                         <View style={{flexDirection: 'row', alignItems: 'center', marginLeft: 12, backgroundColor: SKETCH_THEME.colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>
                                             <Feather name="tv" size={10} color="white" style={{marginRight: 4}} />
                                             <Text style={{fontSize: 10, color:'white', fontFamily: 'Lora', fontWeight: 'bold'}}>PARTIT</Text>
                                         </View>
                                     )}
                                 </View>
                             </View>
                             <View style={{justifyContent: 'center'}}>
                                 <Feather name="chevron-right" size={20} color={SKETCH_THEME.colors.accent} />
                             </View>
                        </TouchableOpacity>
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
                 <View style={[styles.searchBar, {flex: 1}]}>
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
             <View style={[styles.searchBar, {flex: 1}]}>
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
             <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 {renderSearchBarInput()}
                 {user ? (
                    <TouchableOpacity 
                        style={styles.avatarButton}
                        onPress={() => navigation.navigate('Profile' as any)}
                    >
                        {user.avatar && !isAvatarError
                            ? <Image 
                                source={{uri: user.avatar}} 
                                style={{width: 44, height: 44, borderRadius: 22}} 
                                onError={() => setIsAvatarError(true)}
                            />
                            : <Feather name="user" size={24} color={SKETCH_THEME.colors.text} />
                        }
                    </TouchableOpacity>
                 ) : (
                    <TouchableOpacity 
                        style={{ marginLeft: 10, padding: 8 }}
                        onPress={() => navigation.navigate('Login' as any)}
                    >
                        <Feather name="log-in" size={24} color={SKETCH_THEME.colors.text} />
                    </TouchableOpacity>
                 )}
             </View>
             
             {/* Global Next Match Info Banner */}
             {nextMatch && (!selectedBar || isDesktop) && (
                <View style={{
                    marginTop: 12, 
                    backgroundColor: SKETCH_THEME.colors.primary, 
                    borderRadius: 8, 
                    padding: 10,
                    marginHorizontal: Platform.OS === 'web' ? 0 : 4
                }}>
                    <Text style={{color: 'white', fontSize: 13, fontWeight: 'bold', fontFamily: 'Lora', textAlign: 'center'}}>
                        Pròxim Partit ({nextMatch.competition === 'Masculí' ? 'M' : 'F'})
                    </Text>
                    <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4}}>
                         <Text style={{color: 'white', fontWeight: 'bold', fontSize: 15}}>{nextMatch.teamHome}</Text>
                         <Text style={{color: 'white', marginHorizontal: 6, fontSize: 12}}>vs</Text>
                         <Text style={{color: 'white', fontWeight: 'bold', fontSize: 15}}>{nextMatch.teamAway}</Text>
                    </View>
                    <Text style={{color: 'rgba(255,255,255,0.9)', fontSize: 12, textAlign: 'center', marginTop: 4}}>
                        {/* @ts-ignore */}
                        {(() => {
                            // @ts-ignore
                            const d = nextMatch.date.toDate ? nextMatch.date.toDate() : new Date(nextMatch.date);
                            return d.toLocaleString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'});
                        })()}
                    </Text>
                </View>
             )}

             { (!selectedBar || isDesktop) && renderRadiusSlider() }
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
                        onPress={() => setSelectedBar(null)}
                    >
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
                    <View 
                        style={{position: 'absolute', top: 0, left: 0, right: 0, height: '100%', zIndex: 10}} 
                        pointerEvents="box-none"
                    >
                         {/* Only show header if no bar selected OR if we want it persistent. In original Web it was persistent */}
                         <SafeAreaView style={{backgroundColor: 'transparent'}} pointerEvents="box-none">
                            {renderHeader()}
                         </SafeAreaView>
                    </View>

                    <TouchableOpacity 
                        style={styles.fabGps}
                        onPress={centerMapToGPS}
                    >
                        <Feather name="crosshair" size={24} color={SKETCH_THEME.colors.text} />
                    </TouchableOpacity>

                    <Animated.View style={[
                        styles.bottomSheet, 
                        { height: bottomSheetHeight, transform: [{ translateY: bottomSheetTranslateY }] }
                    ]}>
                        <View {...panResponder.panHandlers} style={styles.bottomSheetGrabArea}>
                            <View style={styles.bottomSheetHandle} />
                        </View>
                        <View style={{flex: 1, overflow: 'hidden'}}>
                            {renderContentPanel()}
                        </View>
                        {/* Curtain to cover bouncy animation gaps */}
                         <View style={{
                             position: 'absolute', top: '100%', left: 0, right: 0, 
                             height: 1000, backgroundColor: SKETCH_THEME.colors.bg, 
                             borderLeftWidth: 2, borderRightWidth: 2, borderColor: '#eee' 
                         }} />
                    </Animated.View>
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
        </View>
    );

};



export default MapScreen;
