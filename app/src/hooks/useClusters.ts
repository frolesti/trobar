/**
 * useClusters — cross-platform marker clustering helper using `supercluster`.
 *
 * Feed it your point dataset (with lat/lng) + the current visible bounds + zoom,
 * and it returns either individual point features or cluster features that you
 * render as a single grouped marker.
 *
 * Usage:
 *   const clusters = useClusters({ points, bounds, zoom });
 *   clusters.map((c) => c.properties.cluster
 *      ? <ClusterMarker count={c.properties.point_count} ... />
 *      : <BarMarker bar={c.properties.bar} ... />);
 */
import { useMemo, useRef } from 'react';
import Supercluster from 'supercluster';

export interface ClusterablePoint<T> {
    id: string;
    latitude: number;
    longitude: number;
    data: T;
}

export interface ClusterFeature<T> {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties:
        | ({ cluster: true; cluster_id: number; point_count: number; point_count_abbreviated: number | string } & Record<string, any>)
        | { cluster?: false; pointId: string; data: T };
}

export interface UseClustersArgs<T> {
    points: ClusterablePoint<T>[];
    /** [minLng, minLat, maxLng, maxLat] OR { minLat,maxLat,minLng,maxLng } */
    bounds: [number, number, number, number] | { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
    zoom: number;
    radius?: number;        // px clustering radius; default 60
    maxZoom?: number;       // above this no clustering; default 16
    minPoints?: number;     // min points to form a cluster; default 2
    /** Mapeja un punt a propietats agregables (per `reduce`). */
    map?: (props: { pointId: string; data: T }) => Record<string, any>;
    /** Combina propietats acumulades de fills al pare del clúster. */
    reduce?: (accumulated: Record<string, any>, props: Record<string, any>) => void;
}

export function useClusters<T>({
    points,
    bounds,
    zoom,
    radius = 60,
    maxZoom = 16,
    minPoints = 2,
    map,
    reduce,
}: UseClustersArgs<T>): ClusterFeature<T>[] {
    const indexRef = useRef<Supercluster | null>(null);

    // Rebuild index when point set changes
    useMemo(() => {
        const index = new Supercluster({
            radius, maxZoom, minPoints,
            ...(map ? { map: map as any } : {}),
            ...(reduce ? { reduce: reduce as any } : {}),
        });
        const features = points.map((p) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] as [number, number] },
            properties: { pointId: p.id, data: p.data },
        }));
        index.load(features as any);
        indexRef.current = index;
    }, [points, radius, maxZoom, minPoints, map, reduce]);

    return useMemo(() => {
        const index = indexRef.current;
        if (!index || !bounds) return [];
        const bbox: [number, number, number, number] = Array.isArray(bounds)
            ? bounds
            : [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat];
        const z = Math.max(0, Math.min(maxZoom + 4, Math.round(zoom)));
        return index.getClusters(bbox, z) as ClusterFeature<T>[];
    }, [bounds, zoom, maxZoom]);
}

export default useClusters;
