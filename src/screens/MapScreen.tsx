import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TextInput, TouchableOpacity, SafeAreaView, Platform, Dimensions, Image, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { dummyBars, Bar } from '../data/dummyData';

const { width } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Map'>;
};

const MapScreen = ({ navigation }: Props) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedBar, setSelectedBar] = useState<Bar | null>(null);
  
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permís de localització denegat');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  const handleMarkerPress = (bar: Bar) => {
    setSelectedBar(bar);
    
    // Animate camera to center the pin but slightly offset to leave space for bottom sheet
    const newRegion: Region = {
      latitude: bar.latitude - 0.002, // Offset latitude to show pin above bottom sheet
      longitude: bar.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };
    
    mapRef.current?.animateToRegion(newRegion, 500);
  };

  const handleMapPress = () => {
    if (selectedBar) {
      setSelectedBar(null); // Deselect when clicking map
    }
  };

  const centerMap = () => {
    if (location && mapRef.current) {
        mapRef.current.animateToRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        }, 500);
    }
  };

  const handleAvatarPress = () => {
    if (isAuthenticated) {
      Alert.alert(
        "Sessió Iniciada",
        `Hola ${user?.name}! Vols tancar la sessió?`,
        [
          { text: "Cancel·lar", style: "cancel" },
          { text: "Tancar Sessió", style: 'destructive', onPress: logout }
        ]
      );
    } else {
      navigation.navigate('Login');
    }
  };

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{ marginTop: 10 }}>Carregant mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onPress={handleMapPress}
      >
        {/* Render Bars */}
        {dummyBars.map((bar) => {
            const isSelected = selectedBar?.id === bar.id;
            return (
                <Marker
                    key={bar.id}
                    coordinate={{
                        latitude: bar.latitude,
                        longitude: bar.longitude,
                    }}
                    title={bar.name}
                    onPress={() => handleMarkerPress(bar)}
                >
                    {/* Custom Marker View */}
                    <View style={[styles.markerContainer, isSelected && styles.markerSelected]}>
                        <View style={[styles.markerBubble, isSelected && styles.markerBubbleSelected]}>
                            <Text style={styles.markerText}>🍺</Text>
                        </View>
                        <View style={styles.markerArrow} />
                    </View>
                </Marker>
            );
        })}
      </MapView>

      {/* Capa 2: Top Bar Flotant */}
      <SafeAreaView style={styles.topBarContainer}>
        <View style={styles.searchBar}>
            <View style={styles.searchIconPlaceholder} />
            <TextInput 
                placeholder="Cerca equips, bars..." 
                style={styles.searchInput}
                placeholderTextColor="#999"
            />
            {/* Avatar a la dreta */}
            <TouchableOpacity style={styles.avatar} onPress={handleAvatarPress}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                ) : (
                  <Text style={styles.avatarText}>{isAuthenticated ? user?.name?.charAt(0) : 'U'}</Text>
                )}
            </TouchableOpacity>
        </View>

        {/* Capa 3: Filtres (Chips) */}
        {!selectedBar && (
            <View style={styles.filtersContainer}>
                <TouchableOpacity style={[styles.chip, styles.activeChip]}>
                    <Text style={styles.chipTextActive}>Obert ara</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip}>
                    <Text style={styles.chipText}>Terrassa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip}>
                    <Text style={styles.chipText}>Projector</Text>
                </TouchableOpacity>
            </View>
        )}
      </SafeAreaView>

      {/* Capa 5: Botó de centrar GPS */}
      <TouchableOpacity style={styles.gpsButton} onPress={centerMap}>
        <Text style={{ fontSize: 20 }}>📍</Text>
      </TouchableOpacity>

      {/* Capa 4: Bottom Sheet - Expandit o Col·lapsat */}
      <View style={[styles.bottomSheet, selectedBar && styles.bottomSheetExpanded]}>
        <View style={styles.bottomSheetHandle} />
        
        {selectedBar ? (
            // Layout Detall Bar
            <View style={styles.detailContainer}>
                <View style={styles.detailHeader}>
                    <Image source={{ uri: selectedBar.image }} style={styles.barImage} />
                    <View style={styles.headerInfo}>
                        <Text style={styles.barName}>{selectedBar.name}</Text>
                        <View style={styles.ratingContainer}>
                            <Text style={styles.ratingText}>⭐ {selectedBar.rating}</Text>
                            <Text style={[styles.statusTag, selectedBar.isOpen ? styles.open : styles.closed]}>
                                {selectedBar.isOpen ? 'Obert' : 'Tancat'}
                            </Text>
                        </View>
                    </View>
                </View>

                {selectedBar.nextMatch && (
                     <View style={styles.matchCard}>
                        <Text style={styles.matchTitle}>Pròxim Partit ({selectedBar.nextMatch.competition})</Text>
                        <View style={styles.matchTeams}>
                            <Text style={styles.teamText}>{selectedBar.nextMatch.teamHome}</Text>
                            <Text style={styles.vsText}>vs</Text>
                            <Text style={styles.teamText}>{selectedBar.nextMatch.teamAway}</Text>
                        </View>
                        <Text style={styles.matchTime}>⏰ {selectedBar.nextMatch.time}</Text>
                     </View>
                )}

                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.actionBtnPrimary}>
                        <Text style={styles.actionBtnText}>Com arribar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnSecondary}>
                        <Text style={styles.actionBtnTextSec}>Trucar</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={{ marginTop: 16, alignItems: 'center' }}
                  onPress={() => navigation.navigate('ClaimBusiness', { barId: selectedBar.id, barName: selectedBar.name })}
                >
                    <Text style={{ fontSize: 12, color: '#999', textDecorationLine: 'underline' }}>
                        Sóc el propietari d'aquest negoci
                    </Text>
                </TouchableOpacity>
            </View>
        ) : (
             // Layout Llista Resum
            <View style={styles.listPreview}>
                <Text style={styles.bottomSheetTitle}>Explora {dummyBars.length} bars a prop</Text>
                <Text style={styles.bottomSheetSubtitle}>Mou el mapa per veure'n més</Text>
            </View>
        )}
      </View>

      <StatusBar style="dark" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Custom Marker
  markerContainer: {
    alignItems: 'center',
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
    top: Platform.OS === 'android' ? 40 : 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 24, // Rounded corners
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
  },
  activeChip: {
    backgroundColor: '#2196F3', // Brand color
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
    bottom: 220, // Adjusted for bottom sheet
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
    minHeight: 120, // Min height when collapsed
  },
  bottomSheetExpanded: {
      height: 350, // Fixed height for detail view for now
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
  
  // Actions
  actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 'auto',
  },
  actionBtnPrimary: {
      flex: 1,
      backgroundColor: '#2196F3',
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
  },
  actionBtnSecondary: {
      flex: 1,
      backgroundColor: '#E3F2FD',
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
  },
  actionBtnText: {
      color: 'white',
      fontWeight: '600',
  },
  actionBtnTextSec: {
      color: '#2196F3',
      fontWeight: '600',
  },
});

export default MapScreen;
