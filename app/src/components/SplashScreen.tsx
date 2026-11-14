import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import { Image } from 'expo-image';
import { EDITORIAL } from '../theme/editorialTheme';

interface SplashScreenProps {
  visible: boolean;
  /** Si la font Oi ja s'ha carregat. Si false, no es renderitza el text per evitar
   *  un FOUC (flash de tipografia de sistema → reflow a Oi). */
  fontReady?: boolean;
}

const TITLE_COLOR = '#F4E6CC';
export const SPLASH_GIF = require('../../../assets/app/gif/trobar.gif');
const SPLASH_FALLBACK = require('../../../assets/app/img/logo/LOGO_blanc.png');
const CURVED_TITLE = [
  { letter: 't', left: 18, top: 0, rotate: '12deg' },
  { letter: 'r', left: 57, top: 12, rotate: '8deg' },
  { letter: 'o', left: 96, top: 21, rotate: '3deg' },
  { letter: 'B', left: 136, top: 21, rotate: '-3deg' },
  { letter: 'a', left: 177, top: 12, rotate: '-8deg' },
  { letter: 'r', left: 216, top: 0, rotate: '-12deg' },
] as const;

/**
 * Pantalla de càrrega: fons vermell grana + GIF del logo + text "troBar" en Oi.
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

      {/* Text "troBar" en Oi — només quan la font està llesta, per evitar FOUC */}
      {fontReady && logoReady ? (
        Platform.OS === 'web' ? (
          // SVG curvat a web
          React.createElement('div', {
            style: {
              marginBottom: 12,
              marginTop: -8,
            },
            dangerouslySetInnerHTML: {
              __html: `
                <svg width="280" height="100" viewBox="0 0 280 100" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <path id="curved-path-react" d="M 40 35 Q 140 80 240 35" fill="none"/>
                  </defs>
                  <text font-family="Oi_400Regular, Oi, sans-serif" font-size="36" font-weight="400" fill="${TITLE_COLOR}" letter-spacing="1">
                    <textPath href="#curved-path-react" startOffset="50%" text-anchor="middle">
                      troBar
                    </textPath>
                  </text>
                </svg>
              `,
            },
          })
        ) : (
          <View style={{ width: 252, height: 75, marginTop: -8, marginBottom: 12 }}>
            {CURVED_TITLE.map(({ letter, left, top, rotate }, index) => (
              <Text
                key={`${letter}-${index}`}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  fontFamily: 'Oi_400Regular',
                  fontSize: 36,
                  lineHeight: 44,
                  color: TITLE_COLOR,
                  transform: [{ rotate }],
                }}
              >
                {letter}
              </Text>
            ))}
          </View>
        )
      ) : (
        // Reservem el mateix espai vertical perquè el GIF no salti quan aparegui el text.
        <View style={{ width: 252, height: 75, marginTop: -8, marginBottom: 12 }} />
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
