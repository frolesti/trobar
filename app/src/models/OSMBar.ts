import { BarAmenity } from './Bar';

export interface OSMBar {
    id: string;
    name: string;
    lat: number;
    lon: number;
    type: string;
    tags: Record<string, string>;
    /** Amenitats derivades dels tags d'OSM */
    amenities?: BarAmenity[];
}
