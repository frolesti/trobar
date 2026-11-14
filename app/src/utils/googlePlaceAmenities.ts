import type { BarAmenity } from '../models/Bar';
import type { PlaceDetails } from '../services/placesService';

export const mapGooglePlaceTypesToAmenities = (
    types: string[],
    placeDetails?: Partial<PlaceDetails>,
): BarAmenity[] => {
    const amenities: BarAmenity[] = [];
    const typeSet = new Set(types);
    if (['restaurant', 'food', 'meal_delivery', 'meal_takeaway', 'bakery', 'dine_in'].some(type => typeSet.has(type))) amenities.push('food_served');
    if (typeSet.has('sports_bar') || typeSet.has('sports_club')) amenities.push('sports_bar');
    if (typeSet.has('brewery')) amenities.push('craft_beer');
    if (typeSet.has('live_music_venue') || typeSet.has('night_club')) amenities.push('live_music');
    if (typeSet.has('night_club') || typeSet.has('bar')) amenities.push('late_night');
    if (typeSet.has('wheelchair_accessible_entrance')) amenities.push('accessible');
    if (typeSet.has('parking')) amenities.push('parking');
    return amenities;
};
