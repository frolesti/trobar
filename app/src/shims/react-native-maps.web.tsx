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
import { View, StyleSheet } from 'react-native';
import Text from '../components/AppText';
import UserNotice from '../components/UserNotice';
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
        onMapReady,
        maxZoomLevel,
        minZoomLevel,
        onPanDrag,
        onTouchStart,
    } = props;

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'trobar-google-maps',
        googleMapsApiKey: API_KEY,
        libraries: LIBRARIES as any,
    });
    useEffect(() => { if (loadError) console.info('[Map] Cannot load map', loadError); }, [loadError]);

    const mapRef = useRef<google.maps.Map | null>(null);
    const containerRef = useRef<HTMLElement | null>(null);
    const manualInteraction = useRef(false);
    const [mapReady, setMapReady] = useState(false);

    const initialCenter = useMemo(() => {
        const r: RegionLike =
            initialRegion || region || { latitude: 41.3851, longitude: 2.1734, latitudeDelta: 0.05 };
        return { lat: r.latitude, lng: r.longitude, delta: r.latitudeDelta || 0.05 };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const mapOptions = useMemo<google.maps.MapOptions>(() => ({
        center: { lat: initialCenter.lat, lng: initialCenter.lng },
        zoom: regionToZoom(initialCenter.delta),
        disableDefaultUI: true,
        zoomControl: true,
        maxZoom: maxZoomLevel,
        minZoom: minZoomLevel,
        zoomControlOptions: {
            position: typeof window !== 'undefined' ? window.google?.maps?.ControlPosition?.LEFT_BOTTOM : undefined,
        },
        gestureHandling: 'greedy',
        clickableIcons: false,
        keyboardShortcuts: false,
        fullscreenControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        rotateControl: false,
        scaleControl: false,
        styles: Array.isArray(customMapStyle) ? customMapStyle : undefined,
    }), [isLoaded, initialCenter, maxZoomLevel, minZoomLevel, customMapStyle]);

    const onLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        containerRef.current = map.getDiv();
        setMapReady(true);
        onMapReady?.();
    }, [onMapReady]);

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

    useEffect(() => {
        const element = containerRef.current;
        if (!mapReady || !element) return;
        const pointerDown = () => { manualInteraction.current = true; onTouchStart?.(); };
        const wheel = () => { manualInteraction.current = true; onPanDrag?.(); };
        const keyDown = (event: KeyboardEvent) => {
            if (['Enter', ' ', '+', '-', '='].includes(event.key)) pointerDown();
        };
        element.addEventListener('pointerdown', pointerDown, true);
        element.addEventListener('wheel', wheel, { capture: true, passive: true });
        element.addEventListener('keydown', keyDown, true);
        return () => {
            element.removeEventListener('pointerdown', pointerDown, true);
            element.removeEventListener('wheel', wheel, true);
            element.removeEventListener('keydown', keyDown, true);
        };
    }, [mapReady, onTouchStart, onPanDrag]);

    const handleZoomChanged = useCallback(() => {
        if (manualInteraction.current) onPanDrag?.();
    }, [onPanDrag]);

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
                manualInteraction.current = false;
                map.panTo({ lat: r.latitude, lng: r.longitude });
                const width = map.getDiv().clientWidth;
                const zoom = r.longitudeDelta && width
                    ? Math.log2(360 * width / (256 * r.longitudeDelta))
                    : r.latitudeDelta ? regionToZoom(r.latitudeDelta) : undefined;
                if (zoom !== undefined && Math.abs(zoom - (map.getZoom() ?? 0)) > 0.000001) map.setZoom(zoom);
            },
            animateCamera: (cam: any) => {
                const map = mapRef.current;
                if (!map) return;
                manualInteraction.current = false;
                if (cam?.center) map.panTo({ lat: cam.center.latitude, lng: cam.center.longitude });
                if (typeof cam?.zoom === 'number') map.setZoom(cam.zoom);
                if (typeof cam?.heading === 'number') map.setHeading(cam.heading);
                if (typeof cam?.pitch === 'number') map.setTilt(cam.pitch);
            },
            fitToCoordinates: (coords: LatLng[]) => {
                const map = mapRef.current;
                if (!map || !coords?.length || !window.google) return;
                manualInteraction.current = false;
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
                    pitch: mapRef.current?.getTilt() ?? 0,
                    heading: mapRef.current?.getHeading() ?? 0,
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
            pointForCoordinate: async (coordinate: LatLng) => {
                const map = mapRef.current;
                const projection = map?.getProjection();
                const center = map?.getCenter();
                const zoom = map?.getZoom();
                if (!map || !projection || !center || zoom === undefined) throw new Error('Map projection is not ready');
                const origin = projection.fromLatLngToPoint(center);
                const point = projection.fromLatLngToPoint(new window.google.maps.LatLng(coordinate.latitude, coordinate.longitude));
                if (!origin || !point) throw new Error('Map coordinate cannot be projected');
                const scale = 2 ** zoom;
                const worldOffsetX = ((point.x - origin.x + 128) % 256 + 256) % 256 - 128;
                return {
                    x: map.getDiv().clientWidth / 2 + worldOffsetX * scale,
                    y: map.getDiv().clientHeight / 2 + (point.y - origin.y) * scale,
                };
            },
            coordinateForPoint: async (point: { x: number; y: number }) => {
                const map = mapRef.current;
                const projection = map?.getProjection();
                const center = map?.getCenter();
                const zoom = map?.getZoom();
                if (!map || !projection || !center || zoom === undefined) throw new Error('Map projection is not ready');
                const origin = projection.fromLatLngToPoint(center);
                if (!origin) throw new Error('Map center cannot be projected');
                const scale = 2 ** zoom;
                const coordinate = projection.fromPointToLatLng(new window.google.maps.Point(
                    origin.x + (point.x - map.getDiv().clientWidth / 2) / scale,
                    origin.y + (point.y - map.getDiv().clientHeight / 2) / scale,
                ));
                if (!coordinate) throw new Error('Map point cannot be unprojected');
                return { latitude: coordinate.lat(), longitude: coordinate.lng() };
            },
        }),
        []
    );

    const flatStyle = StyleSheet.flatten(style) || {};

    const handleWrapperLayout = useCallback(() => {
        const map = mapRef.current;
        if (!map || !window.google?.maps?.event) return;
        window.google.maps.event.trigger(map, 'resize');
    }, []);

    if (loadError) {
        return (
            <View style={[styles.wrapper, flatStyle]}>
                <View style={styles.errorOverlay}>
                    <UserNotice tone="error" message="No hem pogut carregar el mapa. Comprova la connexió i torna-ho a provar." />
                </View>
            </View>
        );
    }

    if (!isLoaded || !API_KEY) {
        return (
            <View style={[styles.wrapper, flatStyle]}>
                {/* El SplashScreen de MapScreen cobreix el loading del mapa */}
                <View style={styles.errorOverlay}>
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
                onLoad={onLoad}
                onUnmount={onUnmount}
                onIdle={handleIdle}
                onClick={handleClick}
                onDragStart={onPanDrag}
                onZoomChanged={handleZoomChanged}
                options={mapOptions}
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
            onPress({ nativeEvent: {}, stopPropagation: () => e.stopPropagation() });
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
        >
            <div
                ref={divRef}
                role={onPress ? 'button' : undefined}
                tabIndex={onPress ? 0 : undefined}
                aria-label={onPress ? 'Seleccionar local al mapa' : undefined}
                onKeyDown={event => {
                    if (onPress && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        event.stopPropagation();
                        onPress({ nativeEvent: {}, stopPropagation: () => event.stopPropagation() });
                    }
                }}
                style={{
                    cursor: onPress ? 'pointer' : 'default',
                    zIndex: typeof zIndex === 'number' ? zIndex : undefined,
                    display: 'inline-block',
                    transform: `translate(${-ax * 100}%, ${-ay * 100}%)`,
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
        fontSize: 14,
    },
});
