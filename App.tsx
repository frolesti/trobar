import 'react-native-gesture-handler'; // MUST BE AT THE TOP
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';
import { LogBox, Platform, Text, Image as NativeImage, View, TouchableOpacity } from 'react-native';
import { Image as CachedImage } from 'expo-image';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Oi_400Regular } from '@expo-google-fonts/oi';
import { Barlow_400Regular, Barlow_600SemiBold, Barlow_400Regular_Italic } from '@expo-google-fonts/barlow';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import AppNavigator from './app/src/navigation/AppNavigator';
import { AuthProvider } from './app/src/context/AuthContext';
import { SplashProvider } from './app/src/context/SplashContext';
import ErrorBoundary from './app/src/components/ErrorBoundary';
import { AlertBannerHost } from './app/src/components/AlertBanner';
import { SPLASH_GIF } from './app/src/components/SplashScreen';
import GlobalSplash from './app/src/components/GlobalSplash';
import { EDITORIAL } from './app/src/theme/editorialTheme';
import LegalConsentGate from './app/src/components/LegalConsentGate';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { preloadMapIcons } from './app/src/utils/mapIcons';

LogBox.ignoreLogs([
  'props.pointerEvents is deprecated',
  'InteractionManager has been deprecated',
]);

// Web-only: estils globals + favicon
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // CSS global mínim. Deixem que react-native-web gestioni els seus propis
  // ScrollViews. NO toquem `*` ni fem MutationObservers — això trencava el
  // contenidor de Google Maps (divs interns amb overflow rebien flex:1 i
  // colapsaven la mida del mapa).
  const STYLE_ID = 'trobar-web-global';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; background-color: ${EDITORIAL.background}; }
      body { overflow: hidden; }
      #root { display: flex; flex-direction: column; }
    `;
    document.head.appendChild(style);
  }

  // Favicon rodó: dibuixem logo-nav.jpg retallat en cercle dins un canvas
  //    i el posem com a data URL. Així la icona del navegador es veu rodona
  //    encara que la imatge font sigui un JPG quadrat sense transparència.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const faviconAsset = require('./assets/app/img/logo/logo-nav.jpg');
    const faviconUri = typeof faviconAsset === 'string'
      ? faviconAsset
      : (faviconAsset?.uri || faviconAsset?.default?.uri || faviconAsset?.default || '');
    if (faviconUri) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const SIZE = 128;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Cercle de retall
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        // Dibuixar la imatge centrada cobrint tot el canvas (object-fit: cover)
        const ratio = Math.max(SIZE / img.width, SIZE / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
        const dataUrl = canvas.toDataURL('image/png');
        document.querySelectorAll("link[rel~='icon']").forEach((el) => el.parentNode?.removeChild(el));
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/png';
        link.href = dataUrl;
        document.head.appendChild(link);
      };
      img.onerror = () => {
        // Fallback: posar la imatge directament encara que sigui quadrada
        document.querySelectorAll("link[rel~='icon']").forEach((el) => el.parentNode?.removeChild(el));
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = faviconUri;
        document.head.appendChild(link);
      };
      img.src = faviconUri;
    }
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [iconsReady, setIconsReady] = React.useState(false);
  const [iconError, setIconError] = React.useState(false);
  const [iconAttempt, setIconAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setIconError(false);
    void preloadMapIcons().then(() => {
      if (active) setIconsReady(true);
    }).catch(error => {
      console.error('[App] Critical map icons could not be decoded', error);
      if (active) setIconError(true);
    });
    return () => { active = false; };
  }, [iconAttempt]);
  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    const uri = NativeImage.resolveAssetSource(SPLASH_GIF).uri;
    CachedImage.prefetch(uri, { cachePolicy: 'memory-disk' }).then(loaded => {
      if (!loaded) console.warn('[SplashScreen] Animated logo prefetch failed');
    }).catch(error => console.warn('[SplashScreen] Animated logo prefetch failed', error));
  }, []);
  const [fontsLoaded] = useFonts({
    ...Feather.font,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    // Keep legacy family names on the same sans-serif family.
    Lora_400Regular: Barlow_400Regular,
    Lora_700Bold: Barlow_600SemiBold,
    Lora_400Regular_Italic: Barlow_400Regular_Italic,
    Lora: Barlow_400Regular,
    Oi_400Regular,
    Barlow_400Regular,
    Barlow_600SemiBold,
    Barlow_400Regular_Italic,
    BarlowCondensed_700Bold,
  });
  const appReady = fontsLoaded && iconsReady;

  // Aplicar Barlow com a font per defecte a TOTS els <Text> de l'app
  // (alternativa a haver d'usar <AppText> sempre).
  React.useEffect(() => {
    if (!fontsLoaded) return;
    const TextAny = Text as any;
    TextAny.defaultProps = TextAny.defaultProps || {};
    TextAny.defaultProps.style = [
      { fontFamily: 'Barlow_400Regular' },
      ...(Array.isArray(TextAny.defaultProps.style)
          ? TextAny.defaultProps.style
          : TextAny.defaultProps.style ? [TextAny.defaultProps.style] : []),
    ];
  }, [fontsLoaded]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: EDITORIAL.background }}>
      <SafeAreaProvider>
        <AuthProvider>
          <SplashProvider>
            {appReady && <AppNavigator />}
            <AlertBannerHost defaultPosition="bottom" bottomOffset={88} />
            {appReady && <LegalConsentGate />}
            {/* Splash global: cobreix l'app mentre l'auth o qualsevol pantalla carreguen */}
            <GlobalSplash fontReady={fontsLoaded} assetsReady={iconsReady} />
            {iconError && (
              <View testID="map-icons-error" accessibilityRole="alert" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10000, backgroundColor: EDITORIAL.background, justifyContent: 'center', padding: 28, gap: 20 }}>
                <Text style={{ color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: 20, textAlign: 'center' }}>No hem pogut carregar les icones.</Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => setIconAttempt(attempt => attempt + 1)} style={{ minHeight: 48, borderRadius: 8, backgroundColor: EDITORIAL.matchday, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: EDITORIAL.background, fontFamily: EDITORIAL.fontBold, fontSize: 16 }}>Torna-ho a provar</Text>
                </TouchableOpacity>
              </View>
            )}
          </SplashProvider>
        </AuthProvider>
      </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
