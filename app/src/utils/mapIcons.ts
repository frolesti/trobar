import { Image, ImageRef } from 'expo-image';

const sources = {
    target: require('../../../assets/app/img/map-icons/target-3d.png'),
    search: require('../../../assets/app/img/map-icons/zoom-3d.png'),
    hide: require('../../../assets/app/img/map-icons/hide-search-3d.png'),
    registered: require('../../../assets/app/img/map-icons/map-pin-registered-3d.png'),
    discovered: require('../../../assets/app/img/map-icons/map-pin-unregistered-white-3d.png'),
    premium: require('../../../assets/app/img/map-icons/map-pin-premium-grana-3d.png'),
};

type MapIcon = keyof typeof sources;
const decoded = new Map<MapIcon, ImageRef>();
let loading: Promise<void> | null = null;

export function preloadMapIcons(): Promise<void> {
    if (!loading) {
        loading = Promise.all((Object.keys(sources) as MapIcon[]).map(async key => {
            if (!decoded.has(key)) decoded.set(key, await Image.loadAsync(sources[key]));
        })).then(() => {}).catch(error => {
            loading = null;
            throw error;
        });
    }
    return loading;
}

export function getMapIcon(key: MapIcon): ImageRef {
    const image = decoded.get(key);
    if (!image) throw new Error(`Map icon has not been preloaded: ${key}`);
    return image;
}
