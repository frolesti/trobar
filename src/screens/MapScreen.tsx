import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, Image, Dimensions, ActivityIndicator, Alert, Keyboard, ScrollView, Linking, useWindowDimensions, PanResponder, Animated } from 'react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
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
    const [showFilters, setShowFilters] = useState(false); // Guest mode filters
    const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);

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
    const lastHeight = useRef(120);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 5;
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
                Animated.timing(bottomSheetHeight, {
                    toValue: 280, 
                    duration: 300,
                    useNativeDriver: false
                }).start();
                lastHeight.current = 280;
            } else {
                Animated.timing(bottomSheetHeight, {
                    toValue: 120, 
                    duration: 300,
                    useNativeDriver: false
                }).start();
                lastHeight.current = 120;
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
            zoom: 14, disableDefaultUI: true, clickableIcons: false,
        };
        const map = new window.google.maps.Map(mapDomNode, mapOptions);
        googleMapRef.current = map;

        // User Marker
        if (userLocation) {
            new window.google.maps.Marker({
                position: { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude },
                map: map,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "white",
                },
                title: "La teva ubicació real", zIndex: 999
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
        
        // Cercle
        if (circleRef.current) circleRef.current.setMap(null);
        circleRef.current = new window.google.maps.Circle({
            strokeColor: "#2196F3", strokeOpacity: 0.8, strokeWeight: 2,
            fillColor: "#2196F3", fillOpacity: 0.1,
            map: googleMapRef.current,
            center: { lat: centerLocation.latitude, lng: centerLocation.longitude },
            radius: radiusKm * 1000, clickable: false 
        });

        // Center Marker
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
                icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 0 },
                label: { text: "📍", fontSize: "40px" }, zIndex: 900
            });
        }

        // Bar Markers
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        barsToRender.forEach(bar => {
            const marker = new window.google.maps.Marker({
                position: { lat: bar.latitude, lng: bar.longitude },
                map: googleMapRef.current,
                title: bar.name,
                icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 0 },
                label: { text: "🍺", fontSize: "30px" } 
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
                    path: decodedPath, geodesic: true, strokeColor: "#4285F4",
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
        const url = `https://www.google.com/maps/dir/?api=1&destination=${bar.latitude},${bar.longitude}&travelmode=walking`;
        Linking.openURL(url);
    };

    // --- RENDERS ---

    const renderContentPanel = () => {
         if (selectedBar) {
            return (
                <View style={styles.detailContainer}>
                    <View style={[styles.detailHeader, {flexDirection: 'row'}]}>
                        <Image source={{ uri: selectedBar.image }} style={styles.barImage} />
                        <View style={styles.headerInfo}>
                            <Text style={styles.barName}>{selectedBar.name}</Text>
                            <View style={styles.ratingContainer}>
                                <Text style={styles.ratingText}>⭐ {selectedBar.rating}</Text>
                                <Text style={[styles.statusTag, selectedBar.isOpen ? styles.open : styles.closed]}>
                                    {selectedBar.isOpen ? 'Obert' : 'Tancat'}
                                </Text>
                            </View>
                            <Text style={{fontSize:12, color:'#666', marginTop:4}}>
                                {routeInfo 
                                    ? `⏱️ ${routeInfo.duration} caminant (${routeInfo.distance})`
                                    : `📍 A ${getDistanceFromLatLonInKm(centerLocation!.latitude, centerLocation!.longitude, selectedBar.latitude, selectedBar.longitude).toFixed(1)} km`
                                }
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedBar(null)} style={{padding: 5}}>
                            <Text style={{fontSize: 20, color:'#999'}}>✕</Text>
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
                        style={{backgroundColor:'#2196F3', borderRadius: 12, padding: 15, alignItems:'center', marginTop: 10}}
                        onPress={() => openExternalMaps(selectedBar)}
                    >
                        <Text style={{color:'white', fontWeight:'bold', fontSize: 16}}>🚶 Com arribar-hi</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={{flex: 1}}>
                <Text style={[styles.bottomSheetTitle, {marginBottom: 10}]}>
                    {filteredBars.length} bars a la zona
                </Text>
                <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 20}}>
                    {filteredBars.map((bar, index) => (
                        <TouchableOpacity 
                            key={index} 
                            style={{
                                flexDirection:'row', padding: 10, marginBottom: 8, 
                                backgroundColor:'#f9f9f9', borderRadius: 12, borderWidth: 1, borderColor:'#eee'
                            }}
                            onPress={() => setSelectedBar(bar)}
                        >
                             <Image source={{ uri: bar.image }} style={{width: 50, height: 50, borderRadius: 8, backgroundColor:'#eee'}} />
                             <View style={{marginLeft: 12, justifyContent:'center'}}>
                                 <Text style={{fontWeight:'bold', fontSize: 14}}>{bar.name}</Text>
                                 <Text style={{fontSize: 12, color:'#666'}}>
                                    A {getDistanceFromLatLonInKm(centerLocation!.latitude, centerLocation!.longitude, bar.latitude, bar.longitude).toFixed(1)} km
                                 </Text>
                                 <View style={{flexDirection:'row', marginTop: 2}}>
                                     <Text style={{fontSize: 10, color:'#888'}}>⭐ {bar.rating}</Text>
                                     {bar.nextMatch && <Text style={{fontSize: 10, color:'red', marginLeft: 8}}>⚽ Partit avui</Text>}
                                 </View>
                             </View>
                        </TouchableOpacity>
                    ))}
                    {filteredBars.length === 0 && (
                        <Text style={{textAlign:'center', color:'#999', marginTop: 20}}>Cap bar trobat. Prova d'augmentar el radi.</Text>
                    )}
                </ScrollView>
            </View>
        );
    };

    const renderSearchBarInput = () => {
        if (Platform.OS === 'web') {
             return (
                 <View style={[styles.searchBar, {flex: 1}]}>
                    <View style={styles.searchIconPlaceholder} />
                    {/* @ts-ignore */}
                    <input
                        ref={autocompleteInputRef}
                        type="text"
                        placeholder="Des d'on vols veure el Barça"
                        style={{
                            flex: 1, fontSize: '16px', border: 'none', outline: 'none', backgroundColor: 'transparent', height: '100%', color: '#333'
                        }}
                        defaultValue={searchQuery}
                    />
                     {searchQuery !== '' && (
                        <TouchableOpacity onPress={centerMapToGPS} style={{marginRight: 8}}>
                            <Text style={{fontSize: 12, color:'#666'}}>✕</Text>
                        </TouchableOpacity>
                    )}
                 </View>
             )
        }
        // Native Input (Simple Text Input for now, assuming no Autocomplete needed immediately or implemented via library)
        return (
             <View style={[styles.searchBar, {flex: 1}]}>
                <View style={styles.searchIconPlaceholder} />
                <TextInput 
                    placeholder="Des d'on vols veure el Barça" 
                    style={styles.searchInput}
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    // For native, you'd integrate Google Places API call here on onSubmitEditing
                />
            </View>
        );
    };
    
    // Web Filters rely on <select>, Native needs UI adaptation. 
    // Implementing Hybrid:
    const renderFilters = () => {
         if (Platform.OS === 'web') {
              // ... Reuse Web Select Implementation
             return (
                <View style={{marginTop: 10, marginBottom: 5}}>
                {user ? (
                        <TouchableOpacity 
                            onPress={() => navigation.navigate('Profile')}
                            style={styles.webProfileFilter}
                        >
                            <View style={{flexDirection:'row', alignItems:'center'}}>
                                <Text style={{fontSize: 18, marginRight: 10}}>⚙️</Text>
                                <View>
                                    <Text style={styles.webProfileFilterLabel}>Filtres de Perfil Actius</Text>
                                    <Text style={styles.webProfileFilterValue}>
                                        {selectedSport || "Cap esport"} {selectedTeam ? ` • ${selectedTeam}` : ""}
                                        {!selectedSport && !selectedTeam && "Sense filtres configurats"}
                                    </Text>
                                </View>
                            </View>
                            <Text style={{fontSize: 12, color: '#1976D2', fontWeight:'600'}}>EDITAR</Text>
                        </TouchableOpacity>
                    ) : ( 
                         // Guest 
                         <>
                            {!showFilters ? (
                                <TouchableOpacity 
                                    onPress={() => setShowFilters(true)}
                                    style={styles.webGuestFilterButton}
                                >
                                    <Text style={{marginRight: 6}}>⚙️</Text>
                                    <Text style={{fontWeight: '600', color: '#333', fontSize: 13}}>Configurar Filtres</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.webGuestFilterPanel}>
                                    <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 12, alignItems:'center'}}>
                                        <Text style={{fontWeight:'bold', color:'#333', fontSize: 13}}>FILTRAR PARTITS</Text>
                                        <TouchableOpacity onPress={() => setShowFilters(false)} style={{padding: 4}}>
                                            <Text style={{fontSize: 10, color: '#999', fontWeight:'bold'}}>TANCAR ✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{flexDirection: 'row', gap: 10}}>
                                        <View style={styles.webSelectContainer}>
                                            {/* @ts-ignore */}
                                            <select 
                                                value={selectedSport}
                                                onChange={(e: any) => { setSelectedSport(e.target.value); setSelectedTeam(''); }}
                                                style={styles.webSelect}
                                            >
                                                <option value="">Esport (Qualsevol)</option>
                                                <option value="Futbol">Futbol</option>
                                            </select>
                                        </View>
                                        <View style={[styles.webSelectContainer, selectedSport === '' && {backgroundColor: '#f0f0f0', opacity: 0.5}]}>
                                            {/* @ts-ignore */}
                                            <select 
                                                value={selectedTeam}
                                                onChange={(e: any) => setSelectedTeam(e.target.value)}
                                                disabled={selectedSport === ''}
                                                style={styles.webSelect}
                                            >
                                                <option value="">Equip (Qualsevol)</option>
                                                {selectedSport === 'Futbol' && <option value="FC Barcelona">FC Barcelona</option>}
                                                {selectedSport === 'Futbol' && <option value="Real Madrid">Real Madrid</option>}
                                                {selectedSport === 'Futbol' && <option value="RCD Espanyol">RCD Espanyol</option>}
                                            {selectedSport === 'Futbol' && <option value="Girona FC">Girona FC</option>}
                                            </select>
                                        </View>
                                    </View>
                                </View>
                            )}
                         </>
                    )
                }
                </View>
             )
         }

         // NATIVE FILTERS Implementation (Simplified for now)
         return null; // TODO: Implement Picker for Native
    };

    const renderRadiusSlider = () => {
        if (Platform.OS === 'web') {
            return (
                <View style={styles.radiusContainer}>
                        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems: 'center', marginBottom: 5}}>
                            <Text style={styles.radiusLabel}>Distància: {radiusKm < 1 ? `${Math.round(radiusKm*1000)}m` : `${radiusKm} km`}</Text>
                            <Text style={{fontSize:10, color:'#999'}}>(Max: 5km)</Text>
                        </View>
                        <View style={{ width: '100%', height: 30, justifyContent: 'center' }}>
                             {/* @ts-ignore */}
                             <input type="range" min="0.1" max="5" step="0.1" value={radiusKm} onChange={(e: any) => setRadiusKm(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#2196F3', cursor: 'pointer', height: 8 }} />
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
                    style={styles.avatarButton}
                    onPress={() => user ? navigation.navigate('Profile' as any) : navigation.navigate('Login' as any)}
                >
                    {user?.avatar 
                        ? <Image source={{uri: user.avatar}} style={{width: 44, height: 44, borderRadius: 22}} />
                        : <Text style={{fontSize: 24}}>👤</Text>
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
                <ActivityIndicator size="large" color="#2196F3" />
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
                                    title={bar.name}
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
                        <Text style={{ fontSize: 20 }}>📍</Text>
                    </TouchableOpacity>

                    <Animated.View style={[styles.bottomSheet, { height: bottomSheetHeight }]}>
                        <View {...panResponder.panHandlers} style={styles.bottomSheetHandle} />
                        <View style={{flex: 1, overflow: 'hidden'}}>
                            {renderContentPanel()}
                        </View>
                    </Animated.View>
                </>
            )}

             {/* DESKTOP GPS BUTTON */}
             {isDesktop && (
                <TouchableOpacity style={[styles.fabGps, { right: 20, bottom: 20 }]} onPress={centerMapToGPS}>
                    <Text style={{ fontSize: 20 }}>📍</Text>
                </TouchableOpacity>
             )}

            <StatusBar style="dark" />
        </View>
    );

};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    mapContainer: { flex: 1, width: '100%', height: '100%' },
    map: { width: '100%', height: '100%' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Top Bar & Header
    topBarContainer: {
        position: 'absolute', top: 20, left: 0, right: 0, 
        marginHorizontal: 'auto', paddingHorizontal: 16, zIndex: 10, maxWidth: 600, width: '100%'
    },
    desktopSidebar: {
        width: 400, backgroundColor: 'white', height: '100%', zIndex: 20,
        // @ts-ignore
        boxShadow: '4px 0px 10px rgba(0,0,0,0.1)', borderRightWidth: 1, borderRightColor: '#eee',
        display: 'flex', flexDirection: 'column'
    },
    desktopSidebarContent: { padding: 16, backgroundColor: 'white', zIndex: 2 },
    
    searchBar: {
        flexDirection: 'row', backgroundColor: 'white', borderRadius: 24, padding: 10, alignItems: 'center',
        ...Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }, android: { elevation: 4 }, ios: { shadowOpacity: 0.1 } })
    },
    searchIconPlaceholder: { width: 20, height: 20, backgroundColor: '#ddd', marginRight: 10, borderRadius: 10 },
    searchInput: { flex: 1, fontSize: 16, color: '#333' },
    avatarButton: {
        width: 48, height: 48, borderRadius: 24, marginLeft: 10, backgroundColor: 'white',
        justifyContent: 'center', alignItems: 'center', ...Platform.select({ web: { boxShadow: '0 2px 5px rgba(0,0,0,0.1)', cursor: 'pointer' }, default: { elevation: 4 } })
    },

    // Markers
    markerContainer: { alignItems: 'center', ...Platform.select({ web: { cursor: 'pointer' } }) },
    markerBubble: {
        backgroundColor: 'white', padding: 5, borderRadius: 20, borderWidth: 1, borderColor: '#ddd',
        ...Platform.select({ web: { boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }, default: { elevation: 3 } })
    },
    markerBubbleSelected: { backgroundColor: '#2196F3', borderColor: '#1976D2', transform: [{ scale: 1.2 }], zIndex: 999 },
    markerText: { fontSize: 16 },
    markerArrow: {
        width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid',
        borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
        borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'white', marginTop: -2
    },

    // Bottom Sheet
    bottomSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white',
        borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30,
        ...Platform.select({ web: { boxShadow: '0 -2px 4px rgba(0,0,0,0.1)' }, default: { elevation: 10 } }),
        zIndex: 20, minHeight: 120, maxWidth: 600, marginHorizontal: 'auto', alignSelf: 'center', width: '100%'
    },
    bottomSheetHandle: {
        width: 60, height: 6, backgroundColor: '#ddd', borderRadius: 3, marginBottom: 12, alignSelf: 'center',
        ...Platform.select({ web: { cursor: 'grab' } })
    },
    bottomSheetTitle: { fontSize: 16, fontWeight: '600', color: '#333' },

    // Fab
    fabGps: {
        position: 'absolute', right: 16, bottom: 220, width: 48, height: 48, borderRadius: 24, backgroundColor: 'white',
        justifyContent: 'center', alignItems: 'center', zIndex: 15,
        ...Platform.select({ web: { boxShadow: '0 2px 4px rgba(0,0,0,0.2)', cursor: 'pointer' }, default: { elevation: 5 } })
    },

    // Web Styles
    radiusContainer: { backgroundColor: 'white', padding: 10, marginTop: 10, borderRadius: 16, ...Platform.select({ web: { boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } }) },
    radiusLabel: { fontSize: 12, fontWeight: '600', color: '#333', marginBottom: 8 },
    webProfileFilter: {
        backgroundColor: '#E3F2FD', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 1, borderColor: '#BBDEFB', ...Platform.select({ web: { cursor: 'pointer' } })
    },
    webProfileFilterLabel: { fontSize: 10, color: '#1565C0', fontWeight: 'bold', textTransform:'uppercase' },
    webProfileFilterValue: { fontSize: 14, color: '#0D47A1', fontWeight:'500' },
    webGuestFilterButton: {
        backgroundColor: 'white', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
        borderWidth: 1, borderColor: '#eee', ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' } })
    },
    webGuestFilterPanel: {
        backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#eee',
        ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } })
    },
    webSelectContainer: { flex: 1, backgroundColor: '#f5f5f7', borderRadius: 8, height: 40, justifyContent: 'center', paddingHorizontal: 10 },
    webSelect: { width: '100%', border: 'none', background: 'transparent', outline: 'none', color: '#333', fontSize: 14 },

    // Detail
    detailContainer: { flex: 1 },
    detailHeader: { flexDirection: 'row', marginBottom: 16 },
    barImage: { width: 80, height: 80, borderRadius: 12, marginRight: 12, backgroundColor: '#eee' },
    headerInfo: { flex: 1, justifyContent: 'space-around' },
    barName: { fontSize: 18, fontWeight: 'bold', color: '#222' },
    ratingContainer: { flexDirection: 'row', alignItems: 'center' },
    ratingText: { fontWeight: 'bold', marginRight: 8 },
    statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 12, overflow: 'hidden' },
    open: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
    closed: { backgroundColor: '#FFEBEE', color: '#C62828' },
    matchCard: { backgroundColor: '#F5F5F7', padding: 12, borderRadius: 12, marginBottom: 16 },
    matchTitle: { fontSize: 12, color: '#666', marginBottom: 8, textTransform: 'uppercase' },
    matchTeams: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    teamText: { fontSize: 16, fontWeight: '600', width: '40%', textAlign: 'center' },
    vsText: { color: '#999', marginHorizontal: 10 },
});

export default MapScreen;
