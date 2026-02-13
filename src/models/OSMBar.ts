export interface OSMBar {
    id: string;
    name: string;
    lat: number;
    lon: number;
    type: string;
    tags: Record<string, string>;
}
