import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, ScrollView, useWindowDimensions, Linking } from 'react-native';
import Text from '../../components/AppText';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { RouteProp, useIsFocused } from '@react-navigation/native';
import { EDITORIAL } from '../../theme/editorialTheme';
import { useAuth } from '../../context/AuthContext';
import { addUserReportedBar } from '../../services/barService';
import { fetchBarPlaceDetails, PlaceDetails } from '../../services/placesService';
import BarCard from '../../components/BarCard';
import AlertBanner, { showAlert } from '../../components/AlertBanner';
import UserNotice from '../../components/UserNotice';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'ReportBar'>;
    route: RouteProp<RootStackParamList, 'ReportBar'>;
};

export const ReportBarContent = ({ osmBar, onClose, onRegistered, onBusyChange, attributionInMap = false, onGoogleDetailsChange, tutorialConfirmRef, readOnly = false }: {
    osmBar: RootStackParamList['ReportBar']['osmBar'];
    onClose: () => void;
    onRegistered: () => void;
    onBusyChange?: (busy: boolean) => void;
    attributionInMap?: boolean;
    onGoogleDetailsChange?: (loaded: boolean) => void;
    tutorialConfirmRef?: React.Ref<React.ComponentRef<typeof TouchableOpacity>>;
    readOnly?: boolean;
}) => {
    const { user } = useAuth();
    const { height } = useWindowDimensions();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const busy = useRef(false);
    const alive = useRef(true);
    const closing = useRef(false);
    const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let current = true;
        alive.current = true;
        setPlaceDetails(null);
        onGoogleDetailsChange?.(false);
        const fetchDetails = async () => {
            if (!osmBar.name || !Number.isFinite(osmBar.lat) || !Number.isFinite(osmBar.lon)) return;
            setLoadingDetails(true);
            try {
                const details = await fetchBarPlaceDetails(osmBar.name, osmBar.lat, osmBar.lon, osmBar.googlePlaceId);
                if (current) {
                    setPlaceDetails(details);
                    onGoogleDetailsChange?.(!!details);
                }
            } catch (error) {
                console.info('[ReportBar] Failed to fetch place details', error);
            } finally {
                if (current) setLoadingDetails(false);
            }
        };
        void fetchDetails();

        return () => {
            current = false;
            alive.current = false;
            if (returnTimer.current) clearTimeout(returnTimer.current);
            onBusyChange?.(false);
            onGoogleDetailsChange?.(false);
        };
    }, [osmBar.id, osmBar.googlePlaceId, osmBar.name, osmBar.lat, osmBar.lon]);

    const closeScreen = () => {
        if (closing.current || busy.current) return;
        closing.current = true;
        if (returnTimer.current) clearTimeout(returnTimer.current);
        onClose();
    };

    const getAddress = () => {
        if (placeDetails?.formattedAddress) return placeDetails.formattedAddress;
        if (osmBar.formattedAddress) return osmBar.formattedAddress;
        const t = osmBar.tags || {};
        const street = t['addr:street'] || '';
        const number = t['addr:housenumber'] || '';
        const city = t['addr:city'] || '';
        if (street || city) return [[street, number].filter(Boolean).join(' '), city].filter(Boolean).join(', ');
        return 'Adreça no disponible';
    };

    const handleConfirm = async () => {
        if (readOnly || busy.current || submitSuccess || closing.current) return;
        busy.current = true;
        onBusyChange?.(true);
        setIsSubmitting(true);
        try {
            await addUserReportedBar(osmBar, user?.id);
            if (!alive.current) return;
            setSubmitSuccess(true);
            returnTimer.current = setTimeout(() => {
                if (alive.current) onRegistered();
            }, 1800);
        } catch (error) {
            console.info('[ReportBar] No s’ha pogut registrar el bar:', error);
            if (alive.current) showAlert({ tone: 'error', message: "No s'ha pogut guardar. Torna-ho a provar." });
        } finally {
            busy.current = false;
            if (alive.current) {
                onBusyChange?.(false);
                setIsSubmitting(false);
            }
        }
    };

    return (
        <View>
                        {submitSuccess ? (
                            <UserNotice tone="success" message="Bar registrat. Gràcies per ajudar la comunitat!" />
                        ) : (
                        <BarCard
                            name={osmBar.name}
                            address={getAddress()}
                            latitude={osmBar.lat}
                            longitude={osmBar.lon}
                            placeDetails={placeDetails}
                            loadingPlaceDetails={loadingDetails}
                            verified={false}
                            dense={height < 700}
                            onClose={closeScreen}
                            onConfirm={handleConfirm}
                            onCancel={closeScreen}
                            isSubmitting={isSubmitting}
                            tutorialConfirmRef={tutorialConfirmRef}
                            confirmationDisabled={readOnly}
                        />
                        )}
                        {!attributionInMap && (osmBar.googlePlaceId || osmBar.source === 'google' || placeDetails) && <View style={{ marginTop: 6 }}>
                            <Text style={{ color: '#F4E6CC', fontSize: 12 }}>Google Maps</Text>
                            {osmBar.attributions?.map(item => <TouchableOpacity key={item.uri} accessibilityRole="link" onPress={() => {
                                if (item.uri.startsWith('https://')) void Linking.openURL(item.uri).catch(error => console.info('[ReportBar] Attribution link failed', error));
                            }} style={{ minHeight: 44, justifyContent: 'center' }}>
                                <Text style={{ color: '#F4E6CC', fontSize: 12 }}>{item.name}</Text>
                            </TouchableOpacity>)}
                        </View>}
        </View>
    );
};

const ReportBarScreen = ({ navigation, route }: Props) => {
    const focused = useIsFocused();
    const { height } = useWindowDimensions();
    const [busy, setBusy] = useState(false);
    const close = () => { if (!busy) navigation.goBack(); };
    return (
        <View style={{ flex: 1 }}>
            <TouchableOpacity accessibilityLabel="Tancar la fitxa del local" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} activeOpacity={1} onPress={close} />
            <View style={{ position: 'absolute', bottom: Math.round(height * 0.25) + 30, left: 14, right: 14, maxHeight: Math.round(height * 0.55), backgroundColor: EDITORIAL.granaDeep, borderRadius: 16, padding: 16 }}>
                <ScrollView nestedScrollEnabled>
                    <ReportBarContent osmBar={route.params.osmBar} onClose={close} onBusyChange={setBusy} onRegistered={() => navigation.navigate('Map', { refresh: Date.now() })} />
                </ScrollView>
            </View>
            <AlertBanner active={focused} priority={1} />
        </View>
    );
};

export default ReportBarScreen;
