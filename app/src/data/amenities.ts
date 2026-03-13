/**
 * Configuració central d'amenitats.
 * UNA SOLA FONT DE VERITAT per a:
 *   - Filtres del mapa (MapScreen)
 *   - Secció d'amenitats del perfil del bar (BarProfileModal)
 *   - Editor d'amenitats (propietari del bar)
 *
 * Cada amenitat té:
 *   key: coincideix amb BarAmenity del model
 *   label: text visible en català
 *   icon: nom d'icona Feather / MaterialCommunityIcons
 *   iconFamily: 'feather' | 'mci'
 *   category: agrupació lògica per al panel de filtres
 */

import { BarAmenity } from '../models/Bar';

export interface AmenityOption {
    key: BarAmenity;
    label: string;
    icon: string;
    iconFamily: 'feather' | 'mci';
    /** Categoria per agrupar visualment al panel de filtres */
    category: 'esports' | 'serveis' | 'ambient' | 'accessibilitat';
}

export const AMENITY_OPTIONS: AmenityOption[] = [
    // ── Esports ──
    { key: 'projector',        label: 'Pantalla gran / Projector', icon: 'monitor',          iconFamily: 'feather',  category: 'esports' },
    { key: 'multiple_screens', label: 'Múltiples pantalles',       icon: 'television',       iconFamily: 'mci',      category: 'esports' },
    { key: 'sports_bar',       label: 'Bar esportiu',              icon: 'trophy-outline',   iconFamily: 'mci',      category: 'esports' },

    // ── Serveis ──
    { key: 'food_served',      label: 'Serveixen menjar',          icon: 'coffee',           iconFamily: 'feather',  category: 'serveis' },
    { key: 'craft_beer',       label: 'Cervesa artesana',          icon: 'glass-mug-variant',iconFamily: 'mci',      category: 'serveis' },
    { key: 'reservations',     label: 'Reservable',                icon: 'calendar',         iconFamily: 'feather',  category: 'serveis' },
    { key: 'wifi',             label: 'WiFi',                      icon: 'wifi',             iconFamily: 'feather',  category: 'serveis' },
    { key: 'parking',          label: 'Aparcament',                icon: 'parking',          iconFamily: 'mci',      category: 'serveis' },

    // ── Ambient ──
    { key: 'outdoor_seating',  label: 'Terrassa',                  icon: 'sun',              iconFamily: 'feather',  category: 'ambient' },
    { key: 'air_conditioning', label: 'Aire condicionat',          icon: 'snowflake-variant',iconFamily: 'mci',      category: 'ambient' },
    { key: 'live_music',       label: 'Música en viu',             icon: 'music',            iconFamily: 'feather',  category: 'ambient' },
    { key: 'darts',            label: 'Dards',                     icon: 'target',           iconFamily: 'feather',  category: 'ambient' },
    { key: 'pool_table',       label: 'Billar',                    icon: 'billiards-rack',   iconFamily: 'mci',      category: 'ambient' },
    { key: 'late_night',       label: 'Nocturn',                   icon: 'moon',             iconFamily: 'feather',  category: 'ambient' },
    { key: 'pet_friendly',     label: 'Admeten mascotes',          icon: 'paw',              iconFamily: 'mci',      category: 'ambient' },

    // ── Accessibilitat ──
    { key: 'accessible',       label: 'Accessible',                icon: 'wheelchair',       iconFamily: 'mci',      category: 'accessibilitat' },
];

/** Mapa ràpid key → AmenityOption per lookup O(1) */
export const AMENITY_MAP = new Map(AMENITY_OPTIONS.map(a => [a.key, a]));

/** Categories amb labels per l'UI */
export const AMENITY_CATEGORIES: { key: string; label: string }[] = [
    { key: 'esports',         label: 'Esports' },
    { key: 'serveis',         label: 'Serveis' },
    { key: 'ambient',         label: 'Ambient' },
    { key: 'accessibilitat',  label: 'Accessibilitat' },
];
