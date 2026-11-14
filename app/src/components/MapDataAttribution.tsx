import React from 'react';
import { Linking, StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import Text from './AppText';
import { OSMBar } from '../models/OSMBar';
import { EDITORIAL } from '../theme/editorialTheme';

type Props = {
    venues: OSMBar[];
    googleDetails?: boolean;
    osmGeocoding?: boolean;
    googleMapAttributed?: boolean;
    style?: StyleProp<ViewStyle>;
};

export default function MapDataAttribution({ venues, googleDetails = false, osmGeocoding = false, googleMapAttributed = false, style }: Props) {
    const sources = new Set(venues.flatMap(venue => venue.sources || [venue.source || (venue.googlePlaceId ? 'google' : 'openstreetmap')]));
    const credits = [
        ...(!googleMapAttributed && (googleDetails || sources.has('google')) ? [{ name: 'Google Maps', uri: 'https://maps.google.com/' }] : []),
        ...(osmGeocoding || sources.has('openstreetmap') ? [{ name: '© OpenStreetMap', uri: 'https://www.openstreetmap.org/copyright' }] : []),
        ...venues.flatMap(venue => venue.attributions || []),
    ];
    const unique = [...new Map(credits.map(credit => [`${credit.name}:${credit.uri}`, credit])).values()];
    if (!unique.length) return null;
    return (
        <View testID="map-data-attribution" style={[{
            flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignSelf: 'flex-start',
            backgroundColor: EDITORIAL.background, paddingHorizontal: 4, borderRadius: 4,
        }, style]}>
            {unique.map((credit, index) => (
                <React.Fragment key={`${credit.name}:${credit.uri}`}>
                    {index > 0 && <Text style={{ color: EDITORIAL.onBackgroundMuted, fontSize: 12 }}> · </Text>}
                    <TouchableOpacity
                        accessibilityRole="link"
                        accessibilityLabel={credit.name}
                        style={{ minHeight: 28, justifyContent: 'center' }}
                        onPress={() => {
                            if (credit.uri.startsWith('https://')) {
                                void Linking.openURL(credit.uri).catch(error => console.info('[MapDataAttribution] Attribution link failed', error));
                            } else {
                                console.info('[MapDataAttribution] Unsupported attribution link', credit.name);
                            }
                        }}
                    >
                        <Text style={{ color: EDITORIAL.onBackground, fontSize: 12 }}>{credit.name}</Text>
                    </TouchableOpacity>
                </React.Fragment>
            ))}
        </View>
    );
}
