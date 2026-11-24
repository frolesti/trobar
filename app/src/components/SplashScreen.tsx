import React, { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { Image } from 'expo-image';
import { EDITORIAL } from '../theme/editorialTheme';

interface SplashScreenProps {
  visible: boolean;
  fontReady?: boolean;
}

export const SPLASH_GIF = require('../../../assets/app/gif/trobar.gif');
const SPLASH_FALLBACK = require('../../../assets/app/img/logo/LOGO_blanc.png');
const SPLASH_WORDMARK = require('../../../assets/web/logos/wordmark-cream.png');

/**
 * Pantalla de càrrega: GIF del cambrer i Monofett corbat convertit a traçats.
 * Es mostra fins que tota la pantalla destí està completament carregada.
 *
 * Nota: L'HTML estàtic (public/index.html) renderitza el MATEIX visual en paral·lel.
 * React pren el control de l'HTML quan la seva imatge i les fonts estan preparades.
 */
const SplashScreen: React.FC<SplashScreenProps> = ({ visible, fontReady = true }) => {
  const [logoReady, setLogoReady] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const imageRevisionRef = useRef(0);
  const imageRevision = imageRevisionRef.current;
  useEffect(() => {
    if (!visible) { imageRevisionRef.current++; setLogoReady(false); setLogoFailed(false); }
  }, [visible]);

  // No retirem l'HTML abans que React pugui mostrar la mateixa identitat.
  useEffect(() => {
    if ((!visible || (logoReady && fontReady)) && Platform.OS === 'web' && typeof document !== 'undefined') {
      const splashStatic = document.getElementById('splash-static');
      if (splashStatic) {
        splashStatic.style.display = 'none';
      }
    }
  }, [visible, logoReady, fontReady]);

  if (!visible) return null;

  const content = (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: EDITORIAL.background,
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
      }}
    >
      {/* GIF del logo (auto-playing) */}
      <View>
        <Image
          key={logoFailed ? 'fallback' : 'animation'}
          source={logoFailed ? SPLASH_FALLBACK : SPLASH_GIF}
          accessibilityLabel="Logo de troBar"
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="high"
          autoplay
          transition={0}
          onDisplay={() => {
            if (imageRevision === imageRevisionRef.current) setLogoReady(true);
          }}
          onError={event => {
            if (imageRevision !== imageRevisionRef.current) return;
            console.error('[SplashScreen] Logo could not be displayed', { fallback: logoFailed, error: event.error });
            imageRevisionRef.current++;
            setLogoReady(false);
            setLogoFailed(true);
          }}
          style={{
            width: 200,
            height: 200,
            marginBottom: 2,
            borderRadius: 100,
          }}
        />
      </View>

      {fontReady && logoReady ? (
        <Image
          source={SPLASH_WORDMARK}
          accessible={false}
          contentFit="contain"
          transition={0}
          style={{ width: 252, height: 90, marginTop: -8, marginBottom: 12 }}
        />
      ) : (
        // Reservem el mateix espai vertical perquè el GIF no salti quan aparegui el text.
        <View style={{ width: 252, height: 90, marginTop: -8, marginBottom: 12 }} />
      )}
    </View>
  );

  return Platform.OS === 'web'
    ? React.createElement('div', {
        style: { position: 'fixed', inset: 0, zIndex: 9999 },
      }, content)
    : content;
};

export default SplashScreen;
