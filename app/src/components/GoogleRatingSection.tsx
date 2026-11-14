import React from 'react';
import { View, TouchableOpacity, Linking } from 'react-native';
import Text from './AppText';
import { EDITORIAL } from '../theme/editorialTheme';
import { PlaceDetails } from '../services/placesService';
import { showAlert } from './AlertBanner';

type Props = { enabled: boolean; placeDetails: PlaceDetails | null; isDemo: boolean };

export default function GoogleRatingSection({ enabled, placeDetails, isDemo }: Props) {
    if (!enabled || isDemo) return null;
    const rating = placeDetails?.rating;
    const total = placeDetails?.userRatingCount ?? 0;
    const available = typeof rating === 'number' && rating > 0 && total > 0;
    const mapsUri = placeDetails?.googleMapsUri;
    const openMaps = async () => {
        if (!mapsUri) return;
        try { await Linking.openURL(mapsUri); }
        catch (error) {
            console.info('[GoogleRating] Error obrint Google Maps', error);
            showAlert({ tone: 'error', message: "No s'ha pogut obrir Google Maps." });
        }
    };
    return (
        <View testID="google-rating" style={{ marginTop: 24, borderWidth: 1, borderColor: EDITORIAL.borderOnBackground, borderRadius: 8, padding: 16, gap: 10 }}>
            <Text style={{ color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: 20 }}>Puntuació de Google Maps</Text>
            <Text testID="google-maps-attribution" style={{ color: '#FFFFFF', fontFamily: EDITORIAL.fontRegular, fontSize: 14 }}>Google Maps</Text>
            <Text style={{ color: EDITORIAL.onBackgroundMuted, lineHeight: 20 }}>Font externa · Aquesta puntuació no es barreja amb les valoracions de troBar.</Text>
            <Text style={{ color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: 18 }}>
                {available ? `${rating.toFixed(1)} / 5 · ${total} ${total === 1 ? 'valoració' : 'valoracions'}` : 'Puntuació de Google Maps no disponible.'}
            </Text>
            {mapsUri && (
                <TouchableOpacity onPress={openMaps} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <Text style={{ color: EDITORIAL.onBackground, textDecorationLine: 'underline' }}>Veure el local a Google Maps</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
