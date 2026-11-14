import { BarAmenity, OpeningPeriod } from '../models/Bar';
import { isOpenNow } from '../services/placesService';

export type BarFilterKey = BarAmenity | 'open_now';

export function matchesBarFilters(
    bar: { amenities?: readonly BarAmenity[]; openingPeriods?: OpeningPeriod[] },
    filters: ReadonlySet<BarFilterKey>,
): boolean {
    for (const filter of filters) {
        if (filter === 'open_now') {
            if (isOpenNow(bar.openingPeriods) !== true) return false;
        } else if (!bar.amenities?.includes(filter)) {
            return false;
        }
    }
    return true;
}
