import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Alert, ScrollView, Platform, useWindowDimensions, Animated, Easing } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { RouteProp } from '@react-navigation/native';
import { ensureLoraOnWeb } from '../../theme/sketchTheme';
import { useAuth } from '../../context/AuthContext';
import { addUserReportedBar } from '../../services/barService';
import { fetchBarPlaceDetails, PlaceDetails } from '../../services/placesService';
import BarCard from '../../components/BarCard';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'ReportBar'>;
    route: RouteProp<RootStackParamList, 'ReportBar'>;
};

const ReportBarScreen = ({ navigation, route }: Props) => {
    const { osmBar } = route.params;
    const { user } = useAuth();
    const { height } = useWindowDimensions();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Animacions coincidents amb MapScreen
    const bubbleScale = useRef(new Animated.Value(0)).current;
    const bubbleOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        ensureLoraOnWeb();
        fetchDetails();

        // Disparar animació al muntar
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
    }, []);

    const closeScreen = () => {
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
            navigation.goBack();
        });
    };

    const fetchDetails = async () => {
        if (!osmBar.name || !osmBar.lat || !osmBar.lon) return;
        setLoadingDetails(true);
        try {
            const details = await fetchBarPlaceDetails(osmBar.name, osmBar.lat, osmBar.lon);
            if (details) setPlaceDetails(details);
        } catch (err) {
            console.error('[ReportBar] Failed to fetch place details', err);
        } finally {
            setLoadingDetails(false);
        }
    };

    const getAddress = () => {
        if (placeDetails?.formattedAddress) return placeDetails.formattedAddress;
        const t = osmBar.tags || {};
        const street = t['addr:street'] || '';
        const number = t['addr:housenumber'] || '';
        const city = t['addr:city'] || 'Barcelona';
        if (street) return `${street}, ${number}, ${city}`;
        return 'Adreça no disponible';
    };

    const handleConfirm = async () => {
        if (!user) {
            Alert.alert("Inicia sessió", "Has d'iniciar sessió per confirmar nous llocs.", [
                { text: "Cancel·lar", style: 'cancel' },
                { text: "Iniciar Sessió", onPress: () => navigation.navigate('Login') }
            ]);
            return;
        }

        setIsSubmitting(true);
        try {
            await addUserReportedBar(osmBar, user.id);
            if (Platform.OS === 'web') {
                navigation.navigate('Map');
            } else {
                Alert.alert(
                    "Gràcies! 🍺",
                    "Aquest bar s'ha afegit al mapa per a la comunitat.",
                    [{ text: "Tornar al Mapa", onPress: () => navigation.navigate('Map') }]
                );
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No s'ha pogut guardar. Torna-ho a provar.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Fons per tancar amb un toc */}
            <TouchableOpacity
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
                activeOpacity={1}
                onPress={closeScreen}
            />

            {/* Bafarada flotant — posicionada perquè el triangle apunti al pin del bar */}
            {/* El pin acaba al 25% des de baix després del desplaçament de càmera de MapScreen (0.002/0.008) */}
            <Animated.View style={{
                position: 'absolute',
                bottom: Math.round(height * 0.25) + 30,
                left: 14,
                right: 14,
                maxHeight: Math.round(height * 0.55),
                opacity: bubbleOpacity,
                transform: [{ scale: bubbleScale }]
            }}>
                {/* Cos de la targeta blanca */}
                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 16,
                    padding: 14,
                    ...Platform.select({
                        web: { boxShadow: '0px 4px 20px rgba(0,0,0,0.15)' },
                        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
                        android: { elevation: 12 }
                    })
                }}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={{ maxHeight: Math.round(height * 0.50) }}
                        nestedScrollEnabled
                    >
                        <BarCard
                            name={osmBar.name}
                            address={getAddress()}
                            latitude={osmBar.lat}
                            longitude={osmBar.lon}
                            placeDetails={placeDetails}
                            loadingPlaceDetails={loadingDetails}
                            verified={false}
                            onConfirm={handleConfirm}
                            onCancel={closeScreen}
                            isSubmitting={isSubmitting}
                        />
                    </ScrollView>
                </View>

                {/* Indicador triangular — idèntic a MapScreen */}
                <View style={{
                    alignSelf: 'center',
                    marginTop: -1,
                    width: 0, height: 0,
                    borderLeftWidth: 14,
                    borderRightWidth: 14,
                    borderTopWidth: 16,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderTopColor: 'white',
                }} />
                <View style={{ height: 10 }} />
            </Animated.View>
        </View>
    );
};

export default ReportBarScreen;

