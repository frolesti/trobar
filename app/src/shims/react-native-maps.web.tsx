/**
 * Web implementation of `react-native-maps` based on `@react-google-maps/api`.
 *
 * Renders an interactive Google Map plus arbitrary React children inside
 * `<Marker>` via OverlayView, so the same custom marker views written for
 * iOS/Android (user-location dot, premium star, etc.) render unchanged on web.
 */
import React, {
    createContext,
    forwardRef,
    useCallback,
    useContext,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GoogleMap, OverlayView, useJsApiLoader } from '@react-google-maps/api';

const API_KEY = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined) || '';
const LIBRARIES: ('geometry' | 'places')[] = ['geometry'];
// Estil contenidor estable (mateixa refer\u00e8ncia entre renders) per evitar
// que `@react-google-maps/api` interpreti un canvi i provoqui un re-mount
// del mapa que el deixi en blanc al primer pintat.
const MAP_CONTAINER_STYLE: React.CSSProperties = { width: '100%', height: '100%' };

type RegionLike = {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
};

type LatLng = { latitude: number; longitude: number };

const MapContext = createContext<google.maps.Map | null>(null);

function regionToZoom(latitudeDelta: number): number {
    if (!latitudeDelta || latitudeDelta <= 0) return 14;
    return Math.max(2, Math.min(20, Math.round(Math.log2(360 / latitudeDelta))));
}

const MapView = forwardRef<any, any>((props, ref) => {
    const {
        style,
        children,
        initialRegion,
        region,
        onRegionChangeComplete,
        onPress,
        customMapStyle,
    } = props;

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'trobar-google-maps',
        googleMapsApiKey: API_KEY,
        libraries: LIBRARIES as any,
    });

    const mapRef = useRef<google.maps.Map | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [mapReady, setMapReady] = useState(false);

    const initialCenter = useMemo(() => {
        const r: RegionLike =
            initialRegion || region || { latitude: 41.3851, longitude: 2.1734, latitudeDelta: 0.05 };
        return { lat: r.latitude, lng: r.longitude, delta: r.latitudeDelta || 0.05 };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        try { containerRef.current = map.getDiv() as HTMLDivElement; } catch {}
        setMapReady(true);
        // Some webview/layout combinations leave the GoogleMap with a stale
        // size on first paint (tiles look blank until the user interacts).
        // Force a sequence of resize+recenter calls to cover late-mount layouts.
        if (typeof window !== 'undefined' && window.google?.maps?.event) {
            const recenter = () => {
                window.google.maps.event.trigger(map, 'resize');
                map.setCenter({ lat: initialCenter.lat, lng: initialCenter.lng });
                // També disparem un esdeveniment global perquè qualsevol
                // ResizeObserver/listener pendents s'activin.
                try { window.dispatchEvent(new Event('resize')); } catch {}
            };
            // Multiple staggered triggers — covers slow webviews/embedded frames
            [0, 50, 150, 400, 900, 1800, 3000].forEach((t) =>
                t === 0 ? requestAnimationFrame(recenter) : setTimeout(recenter, t)
            );
        }
    }, [initialCenter]);

    // Observe container size; when it actually changes (e.g. layout settles
    // after fonts load or panels mount) re-trigger a Google Maps resize so
    // tiles paint without user interaction.
    useEffect(() => {
        if (typeof window === 'undefined' || !containerRef.current) return;
        const el = containerRef.current;
        const RO = (window as any).ResizeObserver;
        if (!RO) return;
        const observer = new RO(() => {
            const map = mapRef.current;
            if (!map || !window.google?.maps?.event) return;
            window.google.maps.event.trigger(map, 'resize');
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [mapReady]);

    const onUnmount = useCallback(() => {
        mapRef.current = null;
        setMapReady(false);
    }, []);

    const handleIdle = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;
        const c = map.getCenter();
        const b = map.getBounds();
        if (!c || !b) return;
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        onRegionChangeComplete?.({
            latitude: c.lat(),
            longitude: c.lng(),
            latitudeDelta: Math.abs(ne.lat() - sw.lat()),
            longitudeDelta: Math.abs(ne.lng() - sw.lng()),
        });
    }, [onRegionChangeComplete]);

    const handleClick = useCallback(() => {
        onPress?.({ nativeEvent: {} });
    }, [onPress]);

    useImperativeHandle(
        ref,
        () => ({
            animateToRegion: (r: RegionLike) => {
                const map = mapRef.current;
                if (!map) return;
                map.panTo({ lat: r.latitude, lng: r.longitude });
                if (r.latitudeDelta) map.setZoom(regionToZoom(r.latitudeDelta));
            },
            animateCamera: (cam: any) => {
                const map = mapRef.current;
                if (!map) return;
                if (cam?.center) map.panTo({ lat: cam.center.latitude, lng: cam.center.longitude });
                if (typeof cam?.zoom === 'number') map.setZoom(cam.zoom);
            },
            fitToCoordinates: (coords: LatLng[]) => {
                const map = mapRef.current;
                if (!map || !coords?.length || !window.google) return;
                const bounds = new window.google.maps.LatLngBounds();
                coords.forEach((c) => bounds.extend({ lat: c.latitude, lng: c.longitude }));
                map.fitBounds(bounds);
            },
            fitToElements: () => {},
            fitToSuppliedMarkers: () => {},
            getCamera: async () => {
                const c = mapRef.current?.getCenter();
                return {
                    center: { latitude: c?.lat() || 0, longitude: c?.lng() || 0 },
                    pitch: 0,
                    heading: 0,
                    zoom: mapRef.current?.getZoom() || 10,
                };
            },
            getMapBoundaries: async () => {
                const b = mapRef.current?.getBounds();
                if (!b) {
                    return {
                        northEast: { latitude: 0, longitude: 0 },
                        southWest: { latitude: 0, longitude: 0 },
                    };
                }
                const ne = b.getNorthEast();
                const sw = b.getSouthWest();
                return {
                    northEast: { latitude: ne.lat(), longitude: ne.lng() },
                    southWest: { latitude: sw.lat(), longitude: sw.lng() },
                };
            },
            setCamera: () => {},
            setMapBoundaries: () => {},
            takeSnapshot: async () => '',
            pointForCoordinate: async () => ({ x: 0, y: 0 }),
            coordinateForPoint: async () => ({ latitude: 0, longitude: 0 }),
        }),
        []
    );

    const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};

    // Quan el contenidor obt\u00e9 mida (fonts/layouts tard\u00e0ns), refor\u00e7em
    // un resize + recenter perqu\u00e8 les rajoles apareguin sense interacci\u00f3.
    const handleWrapperLayout = useCallback(() => {
        const map = mapRef.current;
        if (!map || !window.google?.maps?.event) return;
        window.google.maps.event.trigger(map, 'resize');
        map.setCenter({ lat: initialCenter.lat, lng: initialCenter.lng });
    }, [initialCenter]);

    if (loadError) {
        return (
            <View style={[styles.wrapper, flatStyle]}>
                <View style={styles.errorOverlay}>
                    <Text style={styles.errorText}>📍 Mapa no disponible</Text>
                    <Text style={styles.errorSub}>{String(loadError.message || loadError)}</Text>
                </View>
            </View>
        );
    }

    if (!isLoaded || !API_KEY) {
        return (
            <View style={[styles.wrapper, flatStyle]}>
                <View style={styles.errorOverlay}>
                    <Text style={styles.errorText}>Carregant mapa…</Text>
                    {!API_KEY && (
                        <Text style={styles.errorSub}>EXPO_PUBLIC_GOOGLE_MAPS_API_KEY no configurada</Text>
                    )}
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.wrapper, flatStyle]} onLayout={handleWrapperLayout}>
            <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                // IMPORTANT: use uncontrolled defaultCenter/defaultZoom. Passing
                // `center` as a controlled prop causes an infinite update loop
                // because the parent's onRegionChangeComplete handler updates
                // its own region state, which feeds back into a new center
                // object, which re-pans, which fires `idle` again. Imperative
                // panning (animateToRegion) still works through mapRef.
                // @ts-ignore – defaultCenter/defaultZoom exist on GoogleMap props
                defaultCenter={{ lat: initialCenter.lat, lng: initialCenter.lng }}
                // @ts-ignore
                defaultZoom={regionToZoom(initialCenter.delta)}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onIdle={handleIdle}
                onClick={handleClick}
                options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    // Els botons +/- de Google a baix-esquerra perqu\u00e8 els nostres
                    // FABs (GPS + cercar) viuen a baix-dreta.
                    zoomControlOptions: {
                        position: (window as any).google?.maps?.ControlPosition?.LEFT_BOTTOM,
                    },
                    gestureHandling: 'greedy',
                    clickableIcons: false,
                    // Amaga "Keyboard shortcuts" i les etiquetes del peu superflues.
                    keyboardShortcuts: false,
                    fullscreenControl: false,
                    mapTypeControl: false,
                    streetViewControl: false,
                    rotateControl: false,
                    scaleControl: false,
                    styles: Array.isArray(customMapStyle) ? customMapStyle : undefined,
                }}
            >
                <MapContext.Provider value={mapRef.current}>
                    {mapReady ? children : null}
                </MapContext.Provider>
            </GoogleMap>
        </View>
    );
});
MapView.displayName = 'MapView';

/**
 * Marker — renders its children as the marker icon via OverlayView so any
 * custom React Native View tree (badges, premium star, user-location dot…)
 * shows up as-is on web. Anchor defaults to centre to match the
 * react-native-maps default.
 */
const Marker: React.FC<any> = ({ coordinate, anchor, onPress, zIndex, children }) => {
    const map = useContext(MapContext);
    const divRef = useRef<HTMLDivElement | null>(null);

    const ax = typeof anchor?.x === 'number' ? anchor.x : 0.5;
    const ay = typeof anchor?.y === 'number' ? anchor.y : 0.5;

    // CRITICAL: use native DOM listener with stopPropagation, otherwise the
    // click bubbles up to the Google Maps map div and triggers MapView.onPress
    // (which closes the bubble we just opened). React's synthetic stopPropagation
    // does NOT stop Google Maps' native click listener.
    useEffect(() => {
        const node = divRef.current;
        if (!node || !onPress) return;
        const stop = (e: Event) => e.stopPropagation();
        const handler = (e: Event) => {
            e.stopPropagation();
            onPress({ nativeEvent: {} });
        };
        node.addEventListener('click', handler);
        node.addEventListener('mousedown', stop);
        node.addEventListener('touchstart', stop, { passive: true });
        return () => {
            node.removeEventListener('click', handler);
            node.removeEventListener('mousedown', stop);
            node.removeEventListener('touchstart', stop);
        };
    }, [onPress]);

    if (!map || !coordinate) return null;

    return (
        <OverlayView
            position={{ lat: coordinate.latitude, lng: coordinate.longitude }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={(width, height) => ({
                x: -(width * ax),
                y: -(height * ay),
            })}
        >
            <div
                ref={divRef}
                style={{
                    cursor: onPress ? 'pointer' : 'default',
                    zIndex: typeof zIndex === 'number' ? zIndex : undefined,
                    display: 'inline-block',
                }}
            >
                {children}
            </div>
        </OverlayView>
    );
};

const PROVIDER_GOOGLE = 'google';
const PROVIDER_DEFAULT = null;

/**
 * Polyline — line overlay (used to draw walking routes from the user
 * location to the selected bar). Imperatively creates / destroys a
 * `google.maps.Polyline` bound to the parent map.
 */
const Polyline: React.FC<any> = ({ coordinates, strokeColor, strokeWidth, zIndex }) => {
    const map = useContext(MapContext);
    const lineRef = useRef<google.maps.Polyline | null>(null);

    useEffect(() => {
        if (!map || !coordinates || coordinates.length < 2) return;
        const path = coordinates.map((c: LatLng) => ({ lat: c.latitude, lng: c.longitude }));
        const line = new window.google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: strokeColor || '#0F1B2D',
            strokeOpacity: 0.9,
            strokeWeight: typeof strokeWidth === 'number' ? strokeWidth : 4,
            zIndex: typeof zIndex === 'number' ? zIndex : 5,
        });
        line.setMap(map);
        lineRef.current = line;
        return () => {
            line.setMap(null);
            lineRef.current = null;
        };
    }, [map, coordinates, strokeColor, strokeWidth, zIndex]);

    return null;
};

export { Marker, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT };
export default MapView;

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: '#e6e6e6',
        overflow: 'hidden',
        position: 'relative',
    },
    errorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8a003a',
    },
    errorText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 6,
    },
    errorSub: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
    },
});
