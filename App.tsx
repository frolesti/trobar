import 'react-native-gesture-handler'; // MUST BE AT THE TOP
import React from 'react';
import { LogBox, Platform, View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Lora_400Regular, Lora_700Bold, Lora_400Regular_Italic } from '@expo-google-fonts/lora';
import AppNavigator from './app/src/navigation/AppNavigator';
import { AuthProvider } from './app/src/context/AuthContext';
import ErrorBoundary from './app/src/components/ErrorBoundary';
import { AlertBannerHost } from './app/src/components/AlertBanner';
import { SKETCH_THEME } from './app/src/theme/sketchTheme';

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
      html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; background-color: #a50044; }
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
    const faviconAsset = require('./app/assets/img/logo-nav.jpg');
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
  const [fontsLoaded] = useFonts({
    Lora_400Regular,
    Lora_700Bold,
    Lora_400Regular_Italic,
    // Alias perquè el codi llegat que fa servir `fontFamily: 'Lora'`
    // continuï funcionant sense haver de tocar 170+ ocurrències.
    Lora: Lora_400Regular,
  });

  // Aplicar Lora com a font per defecte a TOTS els <Text> de l'app
  // (alternativa a haver d'usar <AppText> sempre).
  React.useEffect(() => {
    if (!fontsLoaded) return;
    const TextAny = Text as any;
    TextAny.defaultProps = TextAny.defaultProps || {};
    TextAny.defaultProps.style = [
      { fontFamily: 'Lora_400Regular' },
      ...(Array.isArray(TextAny.defaultProps.style)
          ? TextAny.defaultProps.style
          : TextAny.defaultProps.style ? [TextAny.defaultProps.style] : []),
    ];
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: SKETCH_THEME.colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator />
          <AlertBannerHost topOffset={24} />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
