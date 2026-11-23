import { Bar, BarAmenity, OpeningPeriod } from '../models/Bar';
import { isOpenNow } from '../services/placesService';
import { isBarFullForMatch, reservationUrl } from './barReservations';

export type BarFilterKey = BarAmenity | 'open_now' | 'online_reservations' | 'hide_full';

export function matchesBarFilters(
    bar: { amenities?: readonly BarAmenity[]; openingPeriods?: OpeningPeriod[] } & Pick<Bar, 'tier' | 'reservationUrl' | 'fullMatchIds'>,
    filters: ReadonlySet<BarFilterKey>,
    matchId?: string,
): boolean {
    const hasOnlineReservations = bar.tier === 'premium' && !!reservationUrl(bar.reservationUrl);
    for (const filter of filters) {
        if (filter === 'open_now') {
            if (isOpenNow(bar.openingPeriods) !== true) return false;
        } else if (filter === 'online_reservations') {
            if (!hasOnlineReservations) return false;
        } else if (filter === 'hide_full') {
            if (isBarFullForMatch(bar, matchId)) return false;
        } else if (filter === 'reservations') {
            if (!hasOnlineReservations && !bar.amenities?.includes('reservations')) return false;
        } else if (!bar.amenities?.includes(filter)) {
            return false;
        }
    }
    return true;
}
