import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, Image, Dimensions, ActivityIndicator, Alert, Keyboard } from 'react-native';
// ELIMINAT: import MapView, { Marker, Region } from 'react-native-maps'; 
// Substituït per implementació directa de Google Maps JS API per evitar errors de build a Web
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { dummyBars, Bar } from '../data/dummyData';

// Constants per a la navegació simulada en web
const mockUser = { name: 'Usuari', avatar: null };

// Declaració global per a TypeScript (Google Maps)
declare global {
  interface Window {
    google: any;
  }
}

// Funció utilitat per calcular distància en KM (Haversine Formula)
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

const MapScreenWeb = () => {
    // Location: Ubicació REAL del dispositiu (GPS)
    const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
    // CenterLocation: Punt central de la cerca (pot ser GPS o una adreça buscada)
    const [centerLocation, setCenterLocation] = useState<{latitude: number, longitude: number} | null>(null);
    
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [selectedBar, setSelectedBar] = useState<Bar | null>(null);
    
    // Filtres nous
    const [searchQuery, setSearchQuery] = useState('');
    const [radiusKm, setRadiusKm] = useState(1); // Radi de cerca per defecte: 1km
    const [filteredBars, setFilteredBars] = useState<Bar[]>([]);

    // Refs de Mapa i Autocomplete
    const mapDivRef = useRef<View>(null);
    const googleMapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const circleRef = useRef<any>(null);
    const centerMarkerRef = useRef<any>(null);
    const autocompleteInputRef = useRef<HTMLInputElement>(null);

    // 1. GPS + Init Autocomplete
    useEffect(() => {
        // Init GPS
        (async () => {
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

    // 2. Load Maps + Autocomplete Logic
    useEffect(() => {
        const loadMapAndAutocomplete = () => {
            // Init Mapa
            if (centerLocation && mapDivRef.current && !googleMapRef.current && window.google) {
                initMap();
            }

            // Init Autocomplete
            if (window.google && autocompleteInputRef.current) {
                initAutocomplete();
            }
        };

        if (!window.google) {
            const script = document.createElement('script');
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
            
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
    }, [centerLocation]); // Re-executa si canvia centerLocation però amb checks interns

    const initAutocomplete = () => {
        if (!autocompleteInputRef.current) return;
        
        // Evitar re-inicialitzar si ja té la classe pac-target-input
        if (autocompleteInputRef.current.classList.contains('pac-target-input')) return;

        const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
             types: ['geocode', 'establishment'],
             componentRestrictions: { country: 'es' }, // Restringir a Espanya per defecte
        });

        // Event Listener quan l'usuari selecciona un lloc
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            
            if (!place.geometry || !place.geometry.location) {
                // L'usuari ha premut enter sense seleccionar de la llista?
                // Podríem fer un fallback a Geocoder aquí, però normalment Autocomplete forces selection
                alert("No s'ha trobat informació per a: " + place.name);
                return;
            }

            const newLocation = {
                latitude: place.geometry.location.lat(),
                longitude: place.geometry.location.lng()
            };

            // 1. Actualitzar Centre
            setCenterLocation(newLocation);
            setSearchQuery(place.formatted_address || place.name);

            // 2. Moure Mapa
            if (googleMapRef.current) {
                googleMapRef.current.panTo(place.geometry.location);
                googleMapRef.current.setZoom(15);
            }
        });
    }

    // ... (Resta d'efectes iguals) ...

    // 3. Efecte per actualitzar marcadors i cercle quan canvia el centre o el radi
    useEffect(() => {
        if (!centerLocation || !googleMapRef.current || !window.google) return;

        // A. Actualitzar Cercle Visual
        updateRadiusCircle();
        
        // A.2 Actualitzar Marker de Centre de Cerca (si no és la ubicació de l'usuari)
        updateCenterMarker();

        // B. Filtrar bars per distància
        const nearbyBars = dummyBars.filter(bar => {
            const dist = getDistanceFromLatLonInKm(
                centerLocation.latitude, 
                centerLocation.longitude, 
                bar.latitude, 
                bar.longitude
            );
            return dist <= radiusKm;
        });
        setFilteredBars(nearbyBars);

        // C. Repintar marcadors
        renderMarkers(nearbyBars);

    }, [centerLocation, radiusKm]);

    const initMap = () => {
        if (!centerLocation) return;

        const mapDomNode = mapDivRef.current as unknown as HTMLElement;
        const mapOptions = {
            center: { lat: centerLocation.latitude, lng: centerLocation.longitude },
            zoom: 14, // Zoom inicial
            disableDefaultUI: true,
            clickableIcons: false,
        };

        const map = new window.google.maps.Map(mapDomNode, mapOptions);
        googleMapRef.current = map;

        // User Marker (Punt Blau) només si tenim GPS real
        if (userLocation) {
            new window.google.maps.Marker({
                position: { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude },
                map: map,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: "#4285F4",
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: "white",
                },
                title: "La teva ubicació real",
                zIndex: 999
            });
        }
        
        // Inicialitzem cercle i markers
        updateRadiusCircle();
        
        map.addListener("click", () => {
            setSelectedBar(null);
            Keyboard.dismiss();
        });
    };

    const updateRadiusCircle = () => {
        if (!googleMapRef.current || !centerLocation) return;
        
        // Esborrar cercle anterior
        if (circleRef.current) {
            circleRef.current.setMap(null);
        }

        // Dibuixar nou cercle
        circleRef.current = new window.google.maps.Circle({
            strokeColor: "#2196F3",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#2196F3",
            fillOpacity: 0.1,
            map: googleMapRef.current,
            center: { lat: centerLocation.latitude, lng: centerLocation.longitude },
            radius: radiusKm * 1000, 
            clickable: false 
        });
    };

    const updateCenterMarker = () => {
        if (!googleMapRef.current || !centerLocation) return;

        // Si el centre és molt a prop de la ubicació user, no posem un segon marker
        if (userLocation) {
             const dist = getDistanceFromLatLonInKm(
                centerLocation.latitude, centerLocation.longitude,
                userLocation.coords.latitude, userLocation.coords.longitude
             );
             if (dist < 0.05) { // menys de 50 metres
                 if (centerMarkerRef.current) centerMarkerRef.current.setMap(null);
                 return;
             }
        }

        if (centerMarkerRef.current) centerMarkerRef.current.setMap(null);
        
        // Marker VERMELL per indicar "Centre de la cerca"
        centerMarkerRef.current = new window.google.maps.Marker({
            position: { lat: centerLocation.latitude, lng: centerLocation.longitude },
            map: googleMapRef.current,
            label: { text: "📍", fontSize: "24px" },
            title: "Centre de la cerca",
            zIndex: 900
        });
    };

    const renderMarkers = (barsToRender: Bar[]) => {
        // Netejar markers antics
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        barsToRender.forEach(bar => {
            const marker = new window.google.maps.Marker({
                position: { lat: bar.latitude, lng: bar.longitude },
                map: googleMapRef.current,
                title: bar.name,
                label: { text: "🍺", fontSize: "20px" } 
            });

            marker.addListener("click", () => {
                handleMarkerPress(bar);
            });

            markersRef.current.push(marker);
        });
    };

    // Gestió de la Cerca (Geocoding)
    const handleSearchSubmit = () => {
        if (!searchQuery.trim() || !window.google) return;

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ 'address': searchQuery + ', Barcelona' }, (results: any, status: any) => {
            if (status === 'OK' && results[0]) {
                const newLocation = {
                    latitude: results[0].geometry.location.lat(),
                    longitude: results[0].geometry.location.lng()
                };
                
                // Actualitzar el CENTRE de la cerca i moure mapa
                setCenterLocation(newLocation);
                if (googleMapRef.current) {
                    googleMapRef.current.panTo(results[0].geometry.location);
                    googleMapRef.current.setZoom(14);
                }
                
                // Feedback visual (opcional: posar un pin "Search result" temporal?)
                
            } else {
                Alert.alert('Error', 'No s\'ha trobat la ubicació: ' + status);
            }
        });
    };
    
    // Tornar al GPS original
    const centerMapToGPS = () => {
        if (userLocation && googleMapRef.current) {
             const userCoords = { 
                 latitude: userLocation.coords.latitude, 
                 longitude: userLocation.coords.longitude 
             };
             setCenterLocation(userCoords);
             
             googleMapRef.current.panTo({ lat: userCoords.latitude, lng: userCoords.longitude });
             googleMapRef.current.setZoom(15);
             setSearchQuery(''); // Netejar cerca
             if (autocompleteInputRef.current) autocompleteInputRef.current.value = '';
        }
    };


    const handleMarkerPress = (bar: Bar) => {
        setSelectedBar(bar);
        if (googleMapRef.current) {
            googleMapRef.current.panTo({ lat: bar.latitude, lng: bar.longitude });
            googleMapRef.current.setZoom(16);
        }
    };

    if (!userLocation && !centerLocation) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={{marginTop:10}}>Obtenint la teva ubicació real...</Text>
            </View>
        );
    }
  
    if (!window.google || !window.google.maps) {
         return (
            <View style={[styles.loadingContainer, {padding: 20}]}>
                <Text style={{textAlign: 'center', fontSize: 16, marginBottom: 10}}>⚠️ Carregant Google Maps...</Text>
            </View>
        );
    }

  return (
    <View style={styles.container}>
      {/* MAPA REAL - DIV contenidor */}
      <View style={styles.mapContainer}>
         <View 
            ref={mapDivRef} 
            style={{ width: '100%', height: '100%' }} 
            // @ts-ignore
            dataSet={{ map: "true" }} 
         />
      </View>

      {/* SEARCH BAR & UI COMPONENTS */}
      <SafeAreaView style={styles.topBarContainer}>
        <View style={styles.searchBar}>
            <View style={styles.searchIconPlaceholder} />
            {/* INPUT UTILIZANT REF DE DOM DIRECTE PER A GOOGLE AUTOCOMPLETE */}
            {/* @ts-ignore */}
            <input
                ref={autocompleteInputRef}
                type="text"
                placeholder="Cerca 'Plaça Catalunya'..."
                style={{
                    flex: 1,
                    fontSize: '16px',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    height: '100%',
                    color: '#333'
                }}
                defaultValue={searchQuery}
            />
            {/* Si hem fet servir el cercador, mostrem botó 'X' per tornar al GPS */}
            {searchQuery !== '' && (
                <TouchableOpacity onPress={() => { autocompleteInputRef.current!.value = ''; centerMapToGPS(); }} style={{marginRight: 8}}>
                    <Text style={{fontSize: 12, color: '#666'}}>✕</Text>
                </TouchableOpacity>
            )}
        </View>

        {/* Filtres de Radi i Tags */}
        {!selectedBar && (
            <View>
                {/* Selector de RADI amb SLIDER */}
                <View style={styles.radiusContainer}>
                    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems: 'center', marginBottom: 5}}>
                        <Text style={styles.radiusLabel}>Distància: {radiusKm < 1 ? `${Math.round(radiusKm*1000)}m` : `${radiusKm} km`}</Text>
                        <Text style={{fontSize:10, color:'#999'}}>(Max: 5km)</Text>
                    </View>
                    
                    <View style={{ width: '100%', height: 30, justifyContent: 'center' }}>
                         {/* Native Input Range per WEB */}
                         {/* @ts-ignore */}
                         <input 
                            type="range" 
                            min="0.1" 
                            max="5" 
                            step="0.1" 
                            value={radiusKm}
                            onChange={(e: any) => setRadiusKm(parseFloat(e.target.value))}
                            style={{
                                width: '100%',
                                accentColor: '#2196F3',
                                cursor: 'pointer',
                                height: 8,
                            }}
                         />
                         <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 4}}>
                             <Text style={{fontSize:9, color:'#ccc'}}>100m</Text>
                             <Text style={{fontSize:9, color:'#ccc'}}>5km</Text>
                         </View>
                    </View>
                </View>

                {/* Filtres de tags existents */}
                <View style={styles.filtersContainer}>
                    <TouchableOpacity style={[styles.chip, styles.activeChip]}>
                        <Text style={styles.chipTextActive}>Obert ara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.chip}>
                        <Text style={styles.chipText}>Terrassa</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )}
      </SafeAreaView>

      {/* Botó de centrar GPS */}
      <TouchableOpacity 
        style={styles.gpsButton}
        onPress={centerMapToGPS}
      >
        <Text style={{ fontSize: 20 }}>📍</Text>
      </TouchableOpacity>

      {/* Bottom Sheet Resum */}
      <View style={[styles.bottomSheet, selectedBar && styles.bottomSheetExpanded]}>
        <View style={styles.bottomSheetHandle} />
        
        {selectedBar ? (
            <View style={styles.detailContainer}>
                  {/* Detall del bar (Idèntic a abans) */}
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
                            A {getDistanceFromLatLonInKm(centerLocation!.latitude, centerLocation!.longitude, selectedBar.latitude, selectedBar.longitude).toFixed(1)} km d'aquí
                        </Text>
                    </View>
                     <TouchableOpacity onPress={() => setSelectedBar(null)} style={{padding: 5}}>
                        <Text>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Etc (Match Info)... Mantenim codi sota... */}
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
            </View>
        ) : (
            <View style={styles.listPreview}>
                <Text style={styles.bottomSheetTitle}>
                    {filteredBars.length} bars trobats
                </Text>
                <Text style={styles.bottomSheetSubtitle}>
                    a menys de {radiusKm}km de {searchQuery ? `'${searchQuery}'` : 'la teva ubicació'}
                </Text>
            </View>
        )}
      </View>

      <StatusBar style="dark" />
    </View>
  );
};


// ESTILS COPIATS DE MapScreen.tsx
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    height: '100%',
  },
  mapContainer: {
      flex: 1,
      width: '100%',
      height: '100%',
  },
  map: {
      width: '100%',
      height: '100%',
  },
  loadingContainer: {
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center'
  },
  
  // Custom Marker
  markerContainer: {
    alignItems: 'center',
    cursor: 'pointer',
  },
  markerBubble: {
    backgroundColor: 'white',
    padding: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  markerBubbleSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
    transform: [{ scale: 1.2 }],
    zIndex: 999,
  },
  markerText: {
    fontSize: 16,
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'white',
    marginTop: -2,
    shadowOpacity: 0,
  },
  markerSelected: {
      zIndex: 1000,
  },

  // Top Bar
  topBarContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIconPlaceholder: {
    width: 20,
    height: 20,
    backgroundColor: '#ddd',
    marginRight: 10,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    outlineStyle: 'none',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  avatarText: {
    fontWeight: 'bold',
    color: '#555',
  },

  // Filtres
  radiusContainer: {
    backgroundColor: 'white',
    padding: 10,
    marginTop: 10, 
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  radiusLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: '#333',
      marginBottom: 8,
  },
  radiusButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
  },
  radiusChip: {
      backgroundColor: '#f0f0f0',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 12,
  },
  activeRadiusChip: {
      backgroundColor: '#2196F3',
  },
  radiusText: {
      fontSize: 12, 
      color: '#666',
  },
  activeRadiusText: {
      color: 'white',
      fontWeight: '600',
  },
  filtersContainer: {
    flexDirection: 'row',
    marginTop: 12,
  },
  chip: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    cursor: 'pointer',
  },
  activeChip: {
    backgroundColor: '#2196F3',
  },
  chipText: {
    color: '#333',
    fontWeight: '500',
  },
  chipTextActive: {
    color: 'white',
    fontWeight: '600',
  },

  // GPS Button
  gpsButton: {
    position: 'absolute',
    right: 16,
    bottom: 220,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    cursor: 'pointer',
    zIndex: 5,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    minHeight: 120,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  bottomSheetExpanded: {
      height: 350,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    marginBottom: 12,
    alignSelf: 'center',
  },
  listPreview: {
      alignItems: 'center',
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  bottomSheetSubtitle: {
      fontSize: 14,
      color: '#666',
      marginTop: 4,
  },
  
  // Detail View Styles
  detailContainer: {
      flex: 1,
  },
  detailHeader: {
      flexDirection: 'row',
      marginBottom: 16,
  },
  barImage: {
      width: 80,
      height: 80,
      borderRadius: 12,
      marginRight: 12,
      backgroundColor: '#eee',
  },
  headerInfo: {
      flex: 1,
      justifyContent: 'space-around',
  },
  barName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#222',
  },
  ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  ratingText: {
      fontWeight: 'bold',
      marginRight: 8,
  },
  statusTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      fontSize: 12,
      overflow: 'hidden',
  },
  open: {
      backgroundColor: '#E8F5E9',
      color: '#2E7D32',
  },
  closed: {
      backgroundColor: '#FFEBEE',
      color: '#C62828',
  },
  
  // Match Card
  matchCard: {
      backgroundColor: '#F5F5F7',
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
  },
  matchTitle: {
      fontSize: 12,
      color: '#666',
      marginBottom: 8,
      textTransform: 'uppercase',
  },
  matchTeams: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
  },
  teamText: {
      fontSize: 16,
      fontWeight: '600',
      width: '40%',
      textAlign: 'center',
  },
  vsText: {
      color: '#999',
      marginHorizontal: 10,
  },
  matchTime: {
      textAlign: 'center',
      color: '#555',
      marginTop: 4,
      fontWeight: '500',
  },
});

export default MapScreenWeb;
