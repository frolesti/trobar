// Re-exportació nativa de react-native-maps
import MapView, { Marker as RNMarker, PROVIDER_GOOGLE as RNProvider } from 'react-native-maps';

export default MapView;
export const Marker = RNMarker;
export const PROVIDER_GOOGLE = RNProvider;
