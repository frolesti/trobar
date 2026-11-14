import type { Bar, BarAmenity, OpeningPeriod } from '../models/Bar';
import type { BarReviewStats, Review } from '../models/Review';
import type { Match } from '../models/Match';

export const PREMIUM_DEMO_NOTICE = 'Perfil de demostració: bar, adreça, ofertes, xarxes i ressenyes ficticis. Fotos il·lustratives. No admet reserves ni publicacions reals.';
export const ZURITO_PREVIEW_ID = '8lyFejxdbgvn58YIZIYF';
export const ZURITO_PREVIEW_NOTICE = 'Dades d’exemple: fotos il·lustratives, emissions, xarxes i ressenyes de prova. No són confirmacions del local.';

type DemoProfile = {
    name: string;
    address: string;
    description: string;
    promotionalText: string;
    amenities: BarAmenity[];
    gallery: string[];
    handle: string;
    openingPeriods: OpeningPeriod[];
    hours: string[];
    comments: string[];
    ratings: number[];
};

const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;
const week = (openHour: number, closeHour: number, closedDays: number[] = []): OpeningPeriod[] =>
    [0, 1, 2, 3, 4, 5, 6].filter(day => !closedDays.includes(day)).map(day => ({
        openDay: day, openHour, openMinute: 0,
        closeDay: closeHour < openHour ? (day + 1) % 7 : day, closeHour, closeMinute: 0,
    }));

const profiles: Record<string, DemoProfile> = {
    [ZURITO_PREVIEW_ID]: {
        name: 'Zurito Terrassa',
        address: 'Carrer de la Rasa 70',
        description: '',
        promotionalText: '',
        amenities: [],
        gallery: [photo('photo-1514933651103-005eec06c04b'), photo('photo-1517248135467-4c7edcad34c4'), photo('photo-1552566626-52f8b828add9')],
        handle: 'zurito-example',
        openingPeriods: [],
        hours: [],
        comments: [
            'Bona visió de la pantalla des de la nostra taula i ambient animat durant el partit.',
            'Vam arribar amb temps per fer la prèvia. Servei atent i bon ambient amb els amics.',
            'La pantalla es veia bé; a la mitja part hi havia una mica de cua a la barra.',
        ],
        ratings: [5, 4, 5],
    },
    'test-terrassa-pantalles': {
        name: 'La Grada del Vapor',
        address: 'Carrer del Gol, 12 · Terrassa',
        description: 'Un punt de trobada de barri per viure el futbol amb so de partit, un projector central i quatre pantalles. Cuina de tapes, entrepans calents i taules compartides; recomanem arribar mitja hora abans del xiulet inicial.',
        promotionalText: 'Dia de partit: entrepà de truita i beguda, 8,50 €. Vine amb gana!',
        amenities: ['projector', 'multiple_screens', 'wifi', 'reservations', 'food_served', 'sports_bar'],
        gallery: [photo('photo-1514933651103-005eec06c04b'), photo('photo-1515003197210-e0cd71810b5f')],
        handle: 'lagradadelvapor',
        openingPeriods: week(17, 1, [1]),
        hours: ['Dilluns: tancat', 'Dimarts–diumenge: 17:00–01:00'],
        comments: [
            'Des de la taula del fons també es veia bé la pantalla. Les braves van arribar abans de començar.',
            'Bon so durant el partit i servei atent. Val la pena arribar amb temps per triar taula.',
            'Entrepans generosos i ambient animat; a la mitja part hi havia una mica de cua.',
        ],
        ratings: [5, 5, 4],
    },
    'test-terrassa-terrassa': {
        name: 'El Pati de la Mitja Part',
        address: 'Passatge del Pati, 7 · Terrassa',
        description: 'Terrassa tranquil·la amb taules a l’ombra, cerveses artesanes i tapes per compartir. Els dies de futbol preparem la zona coberta per seguir el marcador. Hi són benvinguts els gossos lligats i els grups petits.',
        promotionalText: 'Una estona de pati abans del partit: hummus per compartir i dues llimonades, 11 €.',
        amenities: ['outdoor_seating', 'pet_friendly', 'wifi', 'craft_beer', 'food_served'],
        gallery: [photo('photo-1517248135467-4c7edcad34c4'), photo('photo-1414235077428-338989a2e8c0')],
        handle: 'patimitjapart',
        openingPeriods: week(12, 23, [2]),
        hours: ['Dimarts: tancat', 'Dilluns i dimecres–diumenge: 12:00–23:00'],
        comments: [
            'Vam compartir unes tapes al pati amb el gos. Un ambient més tranquil per seguir el futbol.',
            'Bona selecció de cerveses i taules amb ombra. El personal ens va explicar les opcions sense alcohol.',
            'El pati és agradable; per veure tots els detalls del partit prefereixo les taules de la zona coberta.',
        ],
        ratings: [4, 5, 4],
    },
    'test-terrassa-accessible': {
        name: 'Cafè Tercer Temps',
        address: 'Plaça del Tercer Temps, 3 · Terrassa',
        description: 'Un cafè de barri on hi cap tothom: entrada sense graons, taules còmodes i lavabo adaptat. Dues pantalles per no perdre’t res i cuina senzilla per quedar-te a comentar el partit.',
        promotionalText: 'La prèvia més dolça: cafè o infusió amb coca de la casa, 4,80 €.',
        amenities: ['accessible', 'air_conditioning', 'multiple_screens', 'parking', 'food_served', 'wifi'],
        gallery: [photo('photo-1554118811-1e0d58224f24'), photo('photo-1501339847302-ac426a4a7cbb')],
        handle: 'cafetercertemps',
        openingPeriods: week(9, 23),
        hours: ['Dilluns–diumenge: 09:00–23:00'],
        comments: [
            'Entrada còmoda i espai entre taules. Ens van ajudar a trobar un lloc amb bona visió de la pantalla.',
            'Bon cafè i volum del partit agradable per poder conversar. El lavabo adaptat era espaiós.',
            'Vam berenar abans del partit femení. Servei amable, tot i que la cuina va trigar una mica.',
        ],
        ratings: [5, 4, 4],
    },
};

type DemoCandidate = Pick<Bar, 'id' | 'tier' | 'isTestData'> & Partial<Pick<Bar, 'ownerId'>>;

export const isZuritoDevelopmentPreview = (bar: DemoCandidate | null | undefined): boolean =>
    typeof process !== 'undefined' && process.env.EXPO_PUBLIC_TROBAR_ENV === 'development'
    && bar?.id === ZURITO_PREVIEW_ID && bar.tier === 'premium' && !!bar.ownerId;

export const getPremiumDemoBroadcastMatches = (bar: DemoCandidate | null | undefined, matches: Match[]): Match[] | null =>
    isZuritoDevelopmentPreview(bar) ? matches.filter(match => match.status !== 'finished').slice(0, 3) : null;

export function ownerDemoCopy(bar: Bar): Bar {
    if (isZuritoDevelopmentPreview(bar)) return bar;
    if (!isPremiumDemoBar(bar)) return bar;
    const profile = profiles[bar.id];
    return {
        ...bar, name: profile.name,
        description: bar.description === 'Bar fictici per provar el perfil premium, els serveis i les emissions. Fotos illustratives; no representa un establiment real.' ? profile.description : bar.description,
        promotionalText: bar.promotionalText === 'Perfil de proves - sense subscripcio ni cobraments reals' ? profile.promotionalText : bar.promotionalText,
        gallery: bar.gallery?.length ? bar.gallery : [...profile.gallery],
    };
}

/** Real venues are never previews outside the explicit development-only Zurito identity. */
export const isPremiumDemoBar = (bar: DemoCandidate | null | undefined): boolean =>
    !!bar && bar.tier === 'premium' && Object.prototype.hasOwnProperty.call(profiles, bar.id)
    && (bar.id === ZURITO_PREVIEW_ID ? isZuritoDevelopmentPreview(bar) : bar.isTestData === true);

/** Pure, local presentation only; identity, ownership and broadcast links are retained. */
export const enrichPremiumDemoBar = (bar: Bar): Bar => {
    if (!isPremiumDemoBar(bar)) return bar;
    const profile = profiles[bar.id];
    if (isZuritoDevelopmentPreview(bar)) return {
        ...bar,
        gallery: bar.gallery?.length ? [...bar.gallery] : [...profile.gallery],
        socialMedia: { instagram: profile.handle, facebook: profile.handle, website: 'https://zurito.example' },
    };
    return {
        ...bar,
        name: profile.name,
        address: profile.address,
        description: profile.description,
        promotionalText: profile.promotionalText,
        amenities: [...profile.amenities],
        tags: [...profile.amenities],
        image: profile.gallery[0],
        gallery: [...profile.gallery],
        socialMedia: { instagram: profile.handle, facebook: profile.handle, website: `https://${profile.handle.replace(/_/g, '-')}.example` },
        openingPeriods: profile.openingPeriods.map(period => ({ ...period })),
        rating: getPremiumDemoReviewStats(bar)!.averageRating,
    };
};

/** null means callers should retain their normal real-review loading path. */
export const getPremiumDemoReviews = (bar: DemoCandidate | null | undefined): Review[] | null => {
    if (!isPremiumDemoBar(bar)) return null;
    const profile = profiles[bar!.id];
    return profile.comments.map((comment, index) => ({
        id: `demo-review-${bar!.id}-${index}`,
        barId: bar!.id,
        userId: `fictional-demo-guest-${index}`,
        userName: ['Laia', 'Marc', 'Júlia'][index],
        rating: profile.ratings[index],
        comment,
        createdAt: new Date(`2026-10-${String(24 - index * 3).padStart(2, '0')}T12:00:00.000Z`),
    }));
};

export const getPremiumDemoReviewStats = (bar: DemoCandidate | null | undefined): BarReviewStats | null => {
    const reviews = getPremiumDemoReviews(bar);
    if (!reviews) return null;
    return {
        averageRating: reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length,
        totalReviews: reviews.length,
    };
};

export const getPremiumDemoHours = (bar: DemoCandidate | null | undefined): string[] | null =>
    isPremiumDemoBar(bar) ? [...profiles[bar!.id].hours] : null;
