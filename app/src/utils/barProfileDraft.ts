import type { Bar } from '../models/Bar';
import type { BarProfileUpdate } from '../services/barOwnerService';

export function barProfileDraft(bar: Pick<Bar, 'description' | 'promotionalText' | 'socialMedia' | 'amenities' | 'broadcastingMatches' | 'showGoogleRating' | 'reservationUrl' | 'fullMatchIds'>): BarProfileUpdate {
    const socialMedia = Object.fromEntries(
        Object.entries(bar.socialMedia || {}).map(([key, value]) => [key, value?.trim() || ''])
            .filter(([, value]) => value).sort(([first], [second]) => first.localeCompare(second)),
    );
    return {
        description: bar.description?.trim() || '',
        promotionalText: bar.promotionalText?.trim() || '',
        socialMedia,
        amenities: [...new Set(bar.amenities || [])].sort(),
        broadcastingMatches: [...new Set(bar.broadcastingMatches || [])].sort(),
        showGoogleRating: bar.showGoogleRating === true,
        reservationUrl: bar.reservationUrl?.trim() || '',
        fullMatchIds: [...new Set(bar.fullMatchIds || [])].filter(id => bar.broadcastingMatches?.includes(id)).sort(),
    };
}
