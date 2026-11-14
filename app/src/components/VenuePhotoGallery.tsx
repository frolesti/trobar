import React, { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EDITORIAL } from '../theme/editorialTheme';

type Props = {
    name: string;
    photos: string[];
    height: number;
    photoWidth: number;
    loading?: boolean;
    testID?: string;
};

function Photo({ uri, label }: { uri: string; label: string }) {
    const [failed, setFailed] = useState(false);
    return failed ? (
        <View accessibilityLabel="Foto no disponible" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="image" size={22} color={EDITORIAL.onBackgroundMuted} />
        </View>
    ) : (
        <Image source={{ uri }} accessibilityLabel={label} resizeMode="cover" style={{ width: '100%', height: '100%' }} onError={event => {
            console.info('[VenuePhotoGallery] Photo could not be loaded', event.nativeEvent.error);
            setFailed(true);
        }} />
    );
}

export default function VenuePhotoGallery({ name, photos, height, photoWidth, loading = false, testID }: Props) {
    return (
        <View testID={testID ? `${testID}-frame` : undefined} style={{ height, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' }}>
            {photos.length ? (
                <ScrollView testID={testID} horizontal directionalLockEnabled scrollEnabled={photos.length > 1} showsHorizontalScrollIndicator={false} accessibilityLabel={`Fotos de ${name}`} contentContainerStyle={{ gap: 6, flexGrow: 1 }}>
                    {photos.map((uri, index) => (
                        <View key={uri} style={{ width: photos.length === 1 ? '100%' : photoWidth, height, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                            <Photo uri={uri} label={`Foto ${index + 1} de ${photos.length} de ${name}`} />
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <View accessibilityLabel={loading ? 'Carregant fotos' : 'Sense fotos disponibles'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Feather name="image" size={22} color={EDITORIAL.onBackgroundMuted} style={{ opacity: loading ? 0.4 : 1 }} />
                    {!loading && <Text style={{ color: EDITORIAL.onBackgroundMuted, fontFamily: EDITORIAL.fontRegular, fontSize: 12 }}>Sense fotos</Text>}
                </View>
            )}
            {photos.length > 1 && (
                <View pointerEvents="none" style={{ position: 'absolute', top: 6, right: 6, backgroundColor: EDITORIAL.background, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: 10 }}>{photos.length} fotos</Text>
                </View>
            )}
        </View>
    );
}
