import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, Image, Dimensions, ActivityIndicator, Alert, Keyboard, ScrollView, Linking, useWindowDimensions, PanResponder, Animated } from 'react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons'; // Import Vector Icons
import { fetchBars } from '../services/barService';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Bar } from '../data/dummyData';
import { seedDatabase } from '../utils/seedDatabase';
import MapView, { Marker, PROVIDER_GOOGLE } from '../utils/GoogleMaps';

// Declaració global per a TypeScript (Google Maps Web)
declare global {
  interface Window {
    google: any;
  }
}

// Funció utilitat per calcular distància en KM (Haversine Formula) - Compartida
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

// --- STYLES & ASSETS FOR SKETCHY UI ---
const SKETCHY_COLORS = {
    bg: '#FFFBF0', // Paper/Cream background
    primary: '#D32F2F', // Rust Red (Markers)
    text: '#3E2723', // Dark Brown/Black
    textMuted: '#8D6E63', // Muted Brown 
    accent: '#8D6E63', // Secondary brown
    uiBg: 'rgba(255, 251, 240, 0.95)', // Semi-transparent paper
};

// Custom "Paper" Map Style
const PAPER_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
];

// SVG Path for Hand-Drawn Pin (Approximate)
const SKETCHY_PIN_PATH = "M 12 2 C 7 2 3 7 3 12 C 3 17 12 24 12 24 C 12 24 21 17 21 12 C 21 7 17 2 12 2 Z";

// Base64 fallback if file asset fails for any reason
const DEFAULT_BAR_IMAGE = require('../../assets/img/bar-fallout.jpg');

// Helper Component for Sketchy Select
interface SketchySelectProps {
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SketchySelect = ({ value, options, onChange, placeholder = 'Selecciona...', disabled = false }: SketchySelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    }
    
    // Find label
    const currentLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <View style={{ zIndex: isOpen ? 1000 : 1 }}>
            <TouchableOpacity
                onPress={() => !disabled && setIsOpen(!isOpen)}
                style={[
                    styles.webSelectContainer, 
                    disabled && { opacity: 0.6, backgroundColor: '#f0f0f0' },
                    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
                ]}
                activeOpacity={0.8}
            >
                <Text style={{ fontFamily: 'Lora', fontWeight: 'bold', fontSize: 16, color: SKETCHY_COLORS.text }}>
                    {currentLabel}
                </Text>
                <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={SKETCHY_COLORS.text} />
            </TouchableOpacity>
            
            {isOpen && (
                <View style={{
                    position: 'absolute', top: 52, left: 0, right: 0, 
                    backgroundColor: SKETCHY_COLORS.bg, 
                    borderWidth: 2, borderColor: SKETCHY_COLORS.text,
                    maxHeight: 200,
                    zIndex: 2000, 
                    ...Platform.select({ web: { boxShadow: '4px 4px 0px rgba(0,0,0,0.1)' } })
                }}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                        {options.map((opt) => (
                            <TouchableOpacity
                                key={opt.value}
                                onPress={() => handleSelect(opt.value)}
                                style={{
                                    paddingVertical: 12, paddingHorizontal: 16,
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#eee',
                                    backgroundColor: opt.value === value ? '#EFEBE9' : 'transparent'
                                }}
                            >
                                <Text style={{ fontFamily: 'Lora', fontSize: 16, color: SKETCHY_COLORS.text, fontWeight: opt.value === value ? 'bold' : 'normal' }}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

const getBarImageSource = (img: string | undefined | null) => {
    if (img && typeof img === 'string' && img.startsWith('http') && img !== 'null' && img !== 'undefined' && img.trim() !== '') {
        return { uri: img };
    }
    return DEFAULT_BAR_IMAGE;
};

const MapScreen = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const navigation = useNavigation<any>();

    // Location: Ubicació REAL del dispositiu (GPS)
    const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
    // CenterLocation: Punt central de la cerca (pot ser GPS o una adreça buscada)
    const [centerLocation, setCenterLocation] = useState<{latitude: number, longitude: number} | null>(null);
    
    // State comú
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [selectedBar, setSelectedBar] = useState<Bar | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [radiusKm, setRadiusKm] = useState(1); // Radi de cerca per defecte: 1km
    
    // State Web / Advanced Filters
    const [selectedSport, setSelectedSport] = useState('');
    const [selectedTeam, setSelectedTeam] = useState('');
    // Filters UI removed from the initial screen; sport/team filters still apply from profile state.
    const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);

    const [isSearchSettingsOpen, setIsSearchSettingsOpen] = useState(false);
    const [isAvatarError, setIsAvatarError] = useState(false);

    // Force local placeholder if a remote image fails to load
    const [failedImages, setFailedImages] = useState<Record<string, true>>({});

    // Dades
    const [bars, setBars] = useState<Bar[]>([]);
    const [filteredBars, setFilteredBars] = useState<Bar[]>([]);

    // Refs (Web)
    const mapDivRef = useRef<View>(null);
    const googleMapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const circleRef = useRef<any>(null);
    const centerMarkerRef = useRef<any>(null);
    const autocompleteInputRef = useRef<HTMLInputElement>(null);
    const polylineRef = useRef<any>(null);

    // Refs (Native)
    const mapRefNative = useRef<any>(null);

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

    // 2. Load Bars + Sync Profile (Common)
    useEffect(() => {
        const loadBars = async () => {
            const firestoreBars = await fetchBars();
            setBars(firestoreBars);
        };
        loadBars();
    }, []);

    // Sync Profile
     useEffect(() => {
        if (user) {
            setSelectedSport(user.favoriteSport || '');
            setSelectedTeam(user.favoriteTeam || '');
        }
    }, [user]);

    // 3. Web Specific Initialization (Google Maps JS)
    useEffect(() => {
        if (Platform.OS !== 'web') return; 

        // Inject Google Fonts (Lora - Clean Serif for better readability)
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

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
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
            
            if (apiKey) {
                script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`;
                script.async = true;
                script.defer = true;
                script.onload = loadMapAndAutocomplete;
                document.head.appendChild(script);
            }
        } else {
            loadMapAndAutocomplete();
        }
    }, [centerLocation]); 

    // 4. Filtering Logic (Centralized for both platforms logic state)
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

            // Filtre Equip (Opcional)
            if (selectedTeam && selectedTeam !== '') {
                const match = bar.nextMatch;
                if (!match) return false;

                const teamFilter = selectedTeam.toLowerCase();
                const home = (match.teamHome || '').toLowerCase();
                const away = (match.teamAway || '').toLowerCase();
                
                if (!home.includes(teamFilter) && !away.includes(teamFilter)) {
                    // Check aliases like Barça
                    const isBarca = teamFilter.includes('barcelona') || teamFilter.includes('barça');
                    if (isBarca) {
                        if (home.includes('barça') || away.includes('barça') || home.includes('barcelona') || away.includes('barcelona')) {
                            return true; 
                        }
                    }
                    return false;
                }
            }
            return true;
        });
        setFilteredBars(nearbyBars);

        // Animation: Hide bottom sheet if 0 bars, Slide up/bounce if > 0
        if (!isDesktop) {
            if (nearbyBars.length > 0) {
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
            updateWebMapVisuals(nearbyBars);
        } else {
             // Native Map automatically updates via 'filteredBars' prop to MapView
        }

    }, [centerLocation, radiusKm, bars, selectedSport, selectedTeam]);

    // 5. Selected Bar Animation (Synced)
    useEffect(() => {
         // Animació del BottomSheet
         if (Platform.OS !== 'web' || !isDesktop) {
            // Mòbil o Native
            if (selectedBar) {
                const target = Math.min(Math.max(380, height * 0.58), height * 0.78);
                Animated.timing(bottomSheetHeight, {
                    toValue: target,
                    duration: 300,
                    useNativeDriver: false
                }).start();
                lastHeight.current = target;
            } else {
                // If closing details but we have results, go to list view (45%) instead of minimizing
                const hasResults = filteredBars.length > 0;
                const target = hasResults ? Math.max(300, height * 0.45) : 120;
                
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

    const resetFiltersToProfile = () => {
        if (!user) {
            setSelectedSport('');
            setSelectedTeam('');
            return;
        }
        setSelectedSport(user.favoriteSport || '');
        setSelectedTeam(user.favoriteTeam || '');
    };

    // --- WEB HELPERS ---
    const initWebMap = () => {
        if (!centerLocation) return;
        const mapDomNode = mapDivRef.current as unknown as HTMLElement;
        const mapOptions = {
            center: { lat: centerLocation.latitude, lng: centerLocation.longitude },
            zoom: 14, 
            disableDefaultUI: true, 
            clickableIcons: false,
            styles: PAPER_MAP_STYLE, // Apply Sketchy Paper Style
            backgroundColor: SKETCHY_COLORS.bg,
        };
        const map = new window.google.maps.Map(mapDomNode, mapOptions);
        googleMapRef.current = map;

        // User Marker (Custom Dot)
        if (userLocation) {
            new window.google.maps.Marker({
                position: { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude },
                map: map,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 6, fillColor: SKETCHY_COLORS.text, fillOpacity: 0.8, strokeWeight: 0,
                },
                title: "Tu", zIndex: 999
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
                strokeColor: SKETCHY_COLORS.primary, strokeOpacity: 0.6, strokeWeight: 1, // Minimalist stroke
                fillColor: SKETCHY_COLORS.primary, fillOpacity: 0.05, // Very faint fill
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
                icon: { 
                    path: window.google.maps.SymbolPath.CIRCLE, 
                    scale: 5, strokeColor: SKETCHY_COLORS.text, strokeWeight: 2, 
                    fillColor: 'transparent', fillOpacity: 0
                },
                zIndex: 900
            });
        }

        // Bar Markers (Custom Sketchy Pins)
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        barsToRender.forEach(bar => {
            const marker = new window.google.maps.Marker({
                position: { lat: bar.latitude, lng: bar.longitude },
                map: googleMapRef.current,
                title: getCleanBarName(bar.name),
                icon: { 
                    path: SKETCHY_PIN_PATH, 
                    fillColor: SKETCHY_COLORS.primary, 
                    fillOpacity: 0.9, 
                    strokeWeight: 0, 
                    scale: 1.5, // Adjust size
                    anchor: new window.google.maps.Point(12, 24) 
                },
                label: { text: " ", fontSize: "0px" } 
            });
            marker.addListener("click", () => { setSelectedBar(bar); });
            markersRef.current.push(marker);
        });
    };

    const fetchWebRoute = async (bar: Bar) => {
        if (!centerLocation || !googleMapRef.current) return;
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return;

        try {
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
                    path: decodedPath, geodesic: true, strokeColor: SKETCHY_COLORS.primary,
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
        } catch (error) { console.error(error); }
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

        // Afegim l'origen explícitament per assegurar que Google Maps fa servir la mateixa ubicació que l'app
        // Això soluciona possibles discrepàncies si el GPS del navegador va amb retard
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
                                <Feather name="star" size={14} color={SKETCHY_COLORS.text} style={{marginRight: 4}} />
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

                    {selectedBar.nextMatch && (
                        <View style={styles.matchCard}>
                            <Text style={styles.matchTitle}>Pròxim Partit ({selectedBar.nextMatch.competition})</Text>
                            <View style={styles.matchTeams}>
                                <Text style={styles.teamText}>{selectedBar.nextMatch.teamHome}</Text>
                                <Text style={styles.vsText}>vs</Text>
                                <Text style={styles.teamText}>{selectedBar.nextMatch.teamAway}</Text>
                            </View>
                        </View>
                    )}

                    <TouchableOpacity 
                        style={{backgroundColor: SKETCHY_COLORS.primary, borderRadius: 12, padding: 15, alignItems:'center', marginTop: 10}}
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
                <View style={{alignItems: 'center', marginBottom: 15, marginTop: 10}}>
                     <View style={{
                         backgroundColor: SKETCHY_COLORS.text, 
                         paddingVertical: 6, paddingHorizontal: 16, 
                         borderRadius: 16, marginBottom: 8,
                         transform: [{ rotate: '-1deg' }] // Tocs sketchy
                     }}>
                        <Text style={{color: SKETCHY_COLORS.bg, fontWeight: 'bold', fontSize: 13, fontFamily: 'Lora'}}>
                            Hem trobat {filteredBars.length} bars
                        </Text>
                     </View>
                </View>
                
                <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 20}}>
                    {filteredBars.length === 0 ? (
                        <View style={{ alignItems: 'center', marginTop: 20 }}>
                            <Feather name="search" size={32} color={SKETCHY_COLORS.text} style={{ opacity: 0.5 }} />
                            <Text style={{textAlign:'center', color: SKETCHY_COLORS.textMuted, marginTop: 10, fontFamily: 'Lora'}}>
                                Cap bar trobat a la zona.
                            </Text>
                            <TouchableOpacity onPress={() => setIsSearchSettingsOpen(true)} style={{ marginTop: 15 }}>
                                <Text style={{ color: SKETCHY_COLORS.primary, fontWeight: 'bold', fontFamily: 'Lora', textDecorationLine: 'underline' }}>
                                    Ajustar filtres
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        filteredBars.map((bar, index) => (
                        <TouchableOpacity 
                            key={index} 
                            style={{
                                flexDirection:'row', padding: 10, marginBottom: 8, 
                                backgroundColor: SKETCHY_COLORS.bg, borderRadius: 12, borderWidth: 1, borderColor: '#D7CCC8',
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
                                 <Text style={{fontWeight:'bold', fontSize: 16, fontFamily: 'Lora', color: SKETCHY_COLORS.text, marginBottom: 2}}>{getCleanBarName(bar.name)}</Text>
                                 <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                                     <Feather name="map-pin" size={10} color={SKETCHY_COLORS.textMuted} style={{marginRight: 4}} />
                                     <Text style={{fontSize: 12, color: SKETCHY_COLORS.textMuted, fontFamily: 'Lora'}}>
                                        {getDistanceFromLatLonInKm(centerLocation!.latitude, centerLocation!.longitude, bar.latitude, bar.longitude).toFixed(1)} km
                                     </Text>
                                 </View>
                                 <View style={{flexDirection:'row', alignItems: 'center'}}>
                                     <Feather name="star" size={12} color="#FFA000" style={{marginRight: 2}} />
                                     <Text style={{fontSize: 12, color: SKETCHY_COLORS.text, fontFamily: 'Lora', fontWeight: 'bold'}}>{bar.rating}</Text>
                                     {bar.nextMatch && (
                                         <View style={{flexDirection: 'row', alignItems: 'center', marginLeft: 12, backgroundColor: SKETCHY_COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>
                                             <Feather name="tv" size={10} color="white" style={{marginRight: 4}} />
                                             <Text style={{fontSize: 10, color:'white', fontFamily: 'Lora', fontWeight: 'bold'}}>PARTIT</Text>
                                         </View>
                                     )}
                                 </View>
                             </View>
                             <View style={{justifyContent: 'center'}}>
                                 <Feather name="chevron-right" size={20} color={SKETCHY_COLORS.accent} />
                             </View>
                        </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </View>
        );
    };

    const renderSearchBarInput = () => {
        if (Platform.OS === 'web') {
             return (
                 <View style={[styles.searchBar, {flex: 1}]}>
                    <Feather name="search" size={20} color={SKETCHY_COLORS.text} style={{marginRight: 10}} />
                    {/* @ts-ignore */}
                    <input
                        ref={autocompleteInputRef}
                        type="text"
                        placeholder="Des d'on vols veure el Barça?"
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
                <Feather name="search" size={20} color={SKETCHY_COLORS.text} style={{marginRight: 10}} />
                <TextInput 
                    placeholder="Des d'on vols veure el Barça?" 
                    style={styles.searchInput}
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    // For native, you'd integrate Google Places API call here on onSubmitEditing
                />
            </View>
        );
    };
    
    // Filters UI removed from the initial screen.
    const renderFilters = () => null;

    const renderSearchSettingsOverlay = () => {
        if (!isSearchSettingsOpen) return null;

        return (
            <View style={styles.settingsOverlay}>
                <View style={styles.settingsCard}>
                    <View style={styles.settingsHeader}>
                        <Text style={styles.settingsTitle}>Cerca de partits</Text>
                        <TouchableOpacity onPress={() => setIsSearchSettingsOpen(false)} style={{ padding: 6 }}>
                            <Feather name="x" size={18} color={SKETCHY_COLORS.text} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.settingsHint}>
                        Configura els filtres de cerca per aquesta sessió.
                    </Text>

                    {Platform.OS === 'web' ? (
                        <View style={{zIndex: 50}}>
                            <Text style={styles.settingsLabel}>Esport</Text>
                            <View style={{zIndex: 20}}>
                                <SketchySelect
                                    value={selectedSport}
                                    onChange={(val) => { setSelectedSport(val); setSelectedTeam(''); }}
                                    options={[
                                        { label: 'Qualsevol', value: '' },
                                        { label: 'Futbol', value: 'Futbol' }
                                    ]}
                                />
                            </View>

                            <Text style={styles.settingsLabel}>Equip</Text>
                            <View style={{zIndex: 10}}>
                                <SketchySelect
                                    value={selectedTeam}
                                    onChange={(val) => setSelectedTeam(val)}
                                    disabled={selectedSport === ''}
                                    options={[
                                        { label: 'Qualsevol', value: '' },
                                        { label: 'FC Barcelona', value: 'FC Barcelona' },
                                        { label: 'Real Madrid', value: 'Real Madrid' },
                                        { label: 'RCD Espanyol', value: 'RCD Espanyol' },
                                        { label: 'Girona FC', value: 'Girona FC' }
                                    ].filter(o => o.value === '' || selectedSport === 'Futbol')}
                                />
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.settingsHint}>Filtres avançats: pendent d’implementar a mòbil natiu.</Text>
                    )}

                    <View style={styles.settingsActions}>
                        <TouchableOpacity onPress={() => setIsSearchSettingsOpen(false)} style={styles.settingsActionPrimary}>
                            <Text style={styles.settingsActionPrimaryText}>Fet</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    const renderRadiusSlider = () => {
        if (Platform.OS === 'web') {
            return (
                <View style={styles.radiusContainer}>
                        <View style={{ width: '100%', height: 30, justifyContent: 'center' }}>
                             {/* @ts-ignore */}
                             <input type="range" min="0.1" max="5" step="0.1" value={radiusKm} onChange={(e: any) => setRadiusKm(parseFloat(e.target.value))} style={{ width: '100%', accentColor: SKETCHY_COLORS.primary, cursor: 'pointer', height: 8 }} />
                        </View>
                        <View style={{alignItems: 'center', marginTop: 6}}>
                            <Text style={styles.radiusLabel}>{radiusKm < 1 ? `${Math.round(radiusKm*1000)} m` : `${radiusKm} km`}</Text>
                        </View>
                </View>
            )
        }
        // Native Slider not implemented
        return null;
    }

    const renderHeader = () => (
        <View style={isDesktop ? styles.desktopSidebarContent : styles.topBarContainer}>
             <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 {renderSearchBarInput()}
                 <TouchableOpacity 
                    style={styles.headerIconButton}
                    onPress={() => setIsSearchSettingsOpen(true)}
                 >
                    <Feather name="sliders" size={22} color={SKETCHY_COLORS.text} />
                 </TouchableOpacity>
                 <TouchableOpacity 
                    style={styles.avatarButton}
                    onPress={() => user ? navigation.navigate('Profile' as any) : navigation.navigate('Login' as any)}
                >
                    {user?.avatar && !isAvatarError
                        ? <Image 
                            source={{uri: user.avatar}} 
                            style={{width: 44, height: 44, borderRadius: 22}} 
                            onError={() => setIsAvatarError(true)}
                          />
                        : <Feather name="user" size={24} color={SKETCHY_COLORS.text} />
                    }
                </TouchableOpacity>
             </View>
             { (!selectedBar || isDesktop) && renderFilters() }
             { (!selectedBar || isDesktop) && renderRadiusSlider() }
        </View>
    );

    // Initial Loading State
    if (!userLocation && !centerLocation) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={SKETCHY_COLORS.primary} />
                <Text style={{marginTop:10}}>Obtenint la teva ubicació real...</Text>
            </View>
        );
    }

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
                    <SafeAreaView pointerEvents="box-none" style={{position: 'absolute', top: 0, left: 0, right: 0, height: '100%', zIndex: 10}}>
                         {/* Only show header if no bar selected OR if we want it persistent. In original Web it was persistent */}
                         {renderHeader()}
                    </SafeAreaView>

                    <TouchableOpacity 
                        style={styles.fabGps}
                        onPress={centerMapToGPS}
                    >
                        <Feather name="crosshair" size={24} color={SKETCHY_COLORS.text} />
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
                             height: 1000, backgroundColor: SKETCHY_COLORS.bg, 
                             borderLeftWidth: 2, borderRightWidth: 2, borderColor: '#eee' 
                         }} />
                    </Animated.View>
                </>
            )}

             {/* DESKTOP GPS BUTTON */}
             {isDesktop && (
                <>
                    <TouchableOpacity style={[styles.fabGps, { right: 20, bottom: 20 }]} onPress={centerMapToGPS}>
                        <Feather name="crosshair" size={24} color={SKETCHY_COLORS.text} />
                    </TouchableOpacity>
                </>
             )}

            <StatusBar style="dark" />

            {renderSearchSettingsOverlay()}
        </View>
    );

};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: SKETCHY_COLORS.bg },
    mapContainer: { flex: 1, width: '100%', height: '100%' },
    map: { width: '100%', height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: SKETCHY_COLORS.bg },
    
    // Top Bar & Header
    topBarContainer: {
        position: 'absolute', top: 12, left: 0, right: 0,
        marginHorizontal: 'auto', paddingHorizontal: 12, zIndex: 10, maxWidth: 600, width: '100%'
    },
    desktopSidebar: {
        width: 400, backgroundColor: SKETCHY_COLORS.bg, height: '100%', zIndex: 20,
        // @ts-ignore
        boxShadow: '4px 0px 0px rgba(0,0,0,0.05)', borderRightWidth: 2, borderRightColor: '#eee',
        display: 'flex', flexDirection: 'column'
    },
    desktopSidebarContent: { padding: 16, backgroundColor: SKETCHY_COLORS.bg, zIndex: 2 },
    
    searchBar: {
        flexDirection: 'row', backgroundColor: SKETCHY_COLORS.bg, borderRadius: 10, padding: 10, alignItems: 'center',
        borderWidth: 2, borderColor: SKETCHY_COLORS.text,
        ...Platform.select({ web: { boxShadow: '4px 4px 0px rgba(0,0,0,0.1)' } }) // Hard shadow
    },
    searchIconPlaceholder: { width: 12, height: 12, backgroundColor: SKETCHY_COLORS.text, marginRight: 10, borderRadius: 6 },
    searchInput: { flex: 1, fontSize: 16, color: SKETCHY_COLORS.text, fontFamily: 'Lora' },
    avatarButton: {
        width: 44, height: 44, borderRadius: 22, marginLeft: 10, backgroundColor: SKETCHY_COLORS.bg,
        justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: SKETCHY_COLORS.text,
        ...Platform.select({ web: { boxShadow: '2px 2px 0px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },
    headerIconButton: {
        width: 44, height: 44, borderRadius: 22, marginLeft: 10, backgroundColor: SKETCHY_COLORS.bg,
        justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: SKETCHY_COLORS.text,
        ...Platform.select({ web: { boxShadow: '2px 2px 0px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },

    // Markers (Native)
    markerContainer: { alignItems: 'center', ...Platform.select({ web: { cursor: 'pointer' } }) },
    markerBubble: {
        backgroundColor: SKETCHY_COLORS.bg, padding: 5, borderRadius: 8, borderWidth: 2, borderColor: SKETCHY_COLORS.primary,
        ...Platform.select({ web: { boxShadow: '2px 2px 0px rgba(0,0,0,0.2)' } })
    },
    markerBubbleSelected: { backgroundColor: SKETCHY_COLORS.primary, borderColor: SKETCHY_COLORS.text, transform: [{ scale: 1.1 }], zIndex: 999 },
    markerText: { fontSize: 16, color: SKETCHY_COLORS.text, fontFamily: 'Lora' },
    markerArrow: {
        width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid',
        borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
        borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: SKETCHY_COLORS.primary, marginTop: -2
    },

    // Bottom Sheet
    bottomSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: SKETCHY_COLORS.bg,
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
    bottomSheetTitle: { fontSize: 18, fontWeight: '600', color: SKETCHY_COLORS.text, fontFamily: 'Lora' },

    // Fab
    fabGps: {
        position: 'absolute', right: 16, bottom: 135, width: 44, height: 44, borderRadius: 22, 
        backgroundColor: SKETCHY_COLORS.bg, borderWidth: 2, borderColor: SKETCHY_COLORS.text,
        justifyContent: 'center', alignItems: 'center', zIndex: 15,
        ...Platform.select({ web: { boxShadow: '3px 3px 0px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },
    fabSettings: {
        position: 'absolute', right: 16, bottom: 190, width: 44, height: 44, borderRadius: 22, 
        backgroundColor: SKETCHY_COLORS.bg, borderWidth: 2, borderColor: SKETCHY_COLORS.text,
        justifyContent: 'center', alignItems: 'center', zIndex: 15,
        ...Platform.select({ web: { boxShadow: '3px 3px 0px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },

    // Web Styles
    radiusContainer: {
        backgroundColor: 'transparent', padding: 0, marginTop: 4
    },
    radiusLabel: { fontSize: 14, fontWeight: 'bold', color: SKETCHY_COLORS.text, marginBottom: 0, fontFamily: 'Lora' },
    
    webProfileFilter: {
        backgroundColor: 'transparent', padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 2, borderColor: SKETCHY_COLORS.text, borderStyle: 'dashed', marginTop: 8,
        ...Platform.select({ web: { cursor: 'pointer' } })
    },
    webProfileFilterLabel: { fontSize: 12, color: SKETCHY_COLORS.text, fontWeight: 'bold', fontFamily: 'Lora' },
    webProfileFilterValue: { fontSize: 14, color: SKETCHY_COLORS.primary, fontWeight:'bold', fontFamily: 'Lora' },
    webGuestFilterButton: {
        backgroundColor: SKETCHY_COLORS.bg, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
        borderWidth: 2, borderColor: SKETCHY_COLORS.text, 
        ...Platform.select({ web: { boxShadow: '2px 2px 0px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },
    webGuestFilterPanel: {
        backgroundColor: SKETCHY_COLORS.bg, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: SKETCHY_COLORS.text,
        ...Platform.select({ web: { boxShadow: '4px 4px 0px rgba(0,0,0,0.05)' } })
    },
    webSelectContainer: { 
        backgroundColor: SKETCHY_COLORS.bg, 
        borderRadius: 10, 
        borderWidth: 2, 
        borderColor: SKETCHY_COLORS.text, 
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
        backgroundColor: SKETCHY_COLORS.bg,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: SKETCHY_COLORS.text,
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
        color: SKETCHY_COLORS.text,
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
        color: SKETCHY_COLORS.text,
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
        borderColor: SKETCHY_COLORS.text,
        backgroundColor: 'transparent',
        ...Platform.select({ web: { cursor: 'pointer' } })
    },
    settingsActionSecondaryText: {
        fontFamily: 'Lora',
        fontWeight: 'bold',
        color: SKETCHY_COLORS.text,
    },
    settingsActionPrimary: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: SKETCHY_COLORS.text,
        backgroundColor: SKETCHY_COLORS.primary,
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
    barImage: { width: 80, height: 80, borderRadius: 8, marginRight: 12, backgroundColor: '#eee', borderWidth: 2, borderColor: SKETCHY_COLORS.text },
    headerInfo: { flex: 1, justifyContent: 'space-around' },
    barName: { fontSize: 20, fontWeight: 'bold', color: SKETCHY_COLORS.text, fontFamily: 'Lora' },
    ratingContainer: { flexDirection: 'row', alignItems: 'center' },
    ratingText: { fontWeight: 'bold', marginRight: 8, color: SKETCHY_COLORS.text, fontFamily: 'Lora' },
    statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 12, overflow: 'hidden', fontFamily: 'Lora', borderWidth: 1, borderColor: '#ccc' },
    open: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
    closed: { backgroundColor: '#FFEBEE', color: '#C62828' },
    matchCard: { 
        backgroundColor: SKETCHY_COLORS.uiBg, 
        padding: 16, 
        borderRadius: 12, 
        marginBottom: 16, 
        marginTop: 5,
        borderWidth: 2, 
        borderColor: SKETCHY_COLORS.text,
        ...Platform.select({
            web: { boxShadow: '3px 3px 0px rgba(0,0,0,0.1)' },
            default: { shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }
        })
    },
    matchTitle: { fontSize: 14, color: SKETCHY_COLORS.text, marginBottom: 8, fontFamily: 'Lora', fontWeight: 'bold' },
    matchTeams: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    teamText: { fontSize: 18, fontWeight: 'bold', width: '40%', textAlign: 'center', fontFamily: 'Lora', color: SKETCHY_COLORS.text },
    vsText: { color: SKETCHY_COLORS.primary, marginHorizontal: 10, fontFamily: 'Lora', fontWeight: 'bold' },
});

export default MapScreen;
