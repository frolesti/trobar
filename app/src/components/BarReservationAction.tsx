import React from 'react';
import { Linking, TouchableOpacity, View } from 'react-native';
import Text from './AppText';
import { EDITORIAL } from '../theme/editorialTheme';
import type { Bar } from '../models/Bar';
import { isBarFullForMatch, reservationUrl } from '../utils/barReservations';
import { showAlert } from './AlertBanner';

type Props = {
    bar: Pick<Bar, 'tier' | 'reservationUrl' | 'fullMatchIds'>;
    matchId?: string;
    demo?: boolean;
};

export default function BarReservationAction({ bar, matchId, demo = false }: Props) {
    if (bar.tier !== 'premium') return null;
    const url = reservationUrl(bar.reservationUrl);
    const full = isBarFullForMatch(bar, matchId);
    if (!url && !full) return null;
    const openReservation = () => {
        if (full || !url) return;
        if (demo) {
            showAlert({ tone: 'info', message: 'Aquesta opció encara no està disponible en aquest perfil.' });
            return;
        }
        void Linking.openURL(url).catch(error => {
            console.info('[Reservations] Cannot open reservation link', error);
            showAlert({ tone: 'error', message: 'No hem pogut obrir les reserves. Torna-ho a provar.' });
        });
    };
    return (
        <View testID="bar-reservation" style={{ gap: 8 }}>
            {full && <Text accessibilityRole="text" style={{
                color: EDITORIAL.matchday, fontFamily: EDITORIAL.fontBold, fontSize: 14, lineHeight: 20,
            }}>Complet per a aquest partit</Text>}
            {!!url && <TouchableOpacity
                testID="bar-reservation-button"
                accessibilityRole="link"
                accessibilityLabel={full ? 'Reserves tancades per a aquest partit' : 'Reservar al web del bar'}
                accessibilityState={{ disabled: full }}
                disabled={full}
                onPress={openReservation}
                style={{
                    minHeight: 48, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: full ? 'rgba(255,255,255,0.08)' : EDITORIAL.matchday,
                    borderWidth: 1, borderColor: full ? EDITORIAL.borderOnBackground : EDITORIAL.matchday,
                }}
            >
                <Text style={{ color: full ? EDITORIAL.onBackgroundMuted : EDITORIAL.background, fontFamily: EDITORIAL.fontBold, fontSize: 15 }}>
                    {full ? 'Reserves tancades' : 'Reservar'}
                </Text>
            </TouchableOpacity>}
        </View>
    );
}
