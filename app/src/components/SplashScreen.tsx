import React, { useEffect, useRef } from 'react';
import { View, Image, Text, Platform, Animated, Easing } from 'react-native';
import { EDITORIAL } from '../theme/editorialTheme';

interface SplashScreenProps {
  visible: boolean;
  /** Si la font Oi ja s'ha carregat. Si false, no es renderitza el text per evitar
   *  un FOUC (flash de tipografia de sistema → reflow a Oi). */
  fontReady?: boolean;
}

const TITLE_COLOR = '#F4E6CC';
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
 * Quan aquest component es munta amb visible=true, elimina el splash estàtic perquè
 * React en prengui el control (sense que l'usuari noti cap canvi).
 */
const SplashScreen: React.FC<SplashScreenProps> = ({ visible, fontReady = true }) => {
  const logoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      logoAnim.stopAnimation();
      logoAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [visible, logoAnim]);

  const animatedLogoStyle = {
    transform: [
      {
        translateY: logoAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -16],
        }),
      },
      {
        scale: logoAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.06],
        }),
      },
    ],
    opacity: logoAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.92, 1],
    }),
  };

  // Elimina el splash estàtic del HTML quan aquest component es munta i està visible
  useEffect(() => {
    if (visible && Platform.OS === 'web' && typeof document !== 'undefined') {
      console.log('[SplashScreen] visible=true, hiding static splash');
      const splashStatic = document.getElementById('splash-static');
      if (splashStatic) {
        splashStatic.style.display = 'none';
      }
    }
  }, [visible]);

  console.log('[SplashScreen] render - visible:', visible, 'fontReady:', fontReady);

  if (!visible) return null;

  return (
    <View
      style={{
        ...Platform.select({
          web: {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 9999,
          },
          default: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
          },
        }),
        backgroundColor: EDITORIAL.background,
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
      }}
    >
      {/* GIF del logo (auto-playing) */}
      <Animated.View style={animatedLogoStyle}>
        <Image
          source={require('../../../assets/app/gif/trobar.gif')}
          style={{
            width: 200,
            height: 200,
            marginBottom: 2,
            borderRadius: 100,
          }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Text "troBar" en Oi — només quan la font està llesta, per evitar FOUC */}
      {fontReady ? (
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
                  <text font-family="Oi, sans-serif" font-size="36" font-weight="400" fill="${TITLE_COLOR}" letter-spacing="1">
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
};

export default SplashScreen;
