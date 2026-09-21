import React from 'react';
import SplashScreen from './SplashScreen';
import { useSplashState } from '../context/SplashContext';
import { useAuth } from '../context/AuthContext';

/**
 * Splash global de l'app.
 *
 * Es mostra mentre:
 *  - L'AuthContext encara està resolent la sessió (`isLoading`), o
 *  - Alguna pantalla ha registrat càrrega activa via `useScreenLoading()`.
 *
 * Així garantim que l'usuari NO veu mai una pantalla a mig carregar:
 * només la pantalla grana amb el GIF i "troBar" fins que tot està llest.
 */
const GlobalSplash: React.FC = () => {
  const { isAnyLoading, hasRegisteredScreen } = useSplashState();
  const { isLoading: authLoading } = useAuth();
  const visible = authLoading || isAnyLoading || !hasRegisteredScreen;
  console.log('[GlobalSplash] render - authLoading:', authLoading, 'isAnyLoading:', isAnyLoading, 'hasRegisteredScreen:', hasRegisteredScreen, 'visible:', visible);
  return <SplashScreen visible={visible} />;
};

export default GlobalSplash;
