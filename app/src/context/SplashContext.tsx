import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';

/**
 * Context global per controlar la pantalla de splash (fons grana + GIF + "troBar").
 *
 * Qualsevol pantalla pot registrar que està carregant amb `useScreenLoading(key, isLoading)`.
 * Mentre alguna pantalla estigui carregant, el splash global cobreix tota l'app.
 *
 * Així NO veiem mai spinners ni missatges "Carregant…" enmig de la UI:
 * només la pantalla grana fins que tot està llest.
 */
interface SplashContextValue {
  /** Conjunt de claus actualment carregant. Si > 0, splash visible. */
  registerLoading: (key: string) => void;
  unregisterLoading: (key: string) => void;
  /** True si hi ha alguna càrrega activa registrada. */
  isAnyLoading: boolean;
  /** True quan la primera pantalla ha registrat el seu estat de càrrega. */
  hasRegisteredScreen: boolean;
}

const SplashContext = createContext<SplashContextValue | null>(null);

export const SplashProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(() => new Set());
  const [hasRegisteredScreen, setHasRegisteredScreen] = useState(false);

  const registerLoading = useCallback((key: string) => {
    setHasRegisteredScreen(true);
    console.log('[SplashContext] registerLoading:', key);
    setLoadingKeys(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      console.log('[SplashContext] Loading keys after register:', Array.from(next));
      return next;
    });
  }, []);

  const unregisterLoading = useCallback((key: string) => {
    setHasRegisteredScreen(true);
    console.log('[SplashContext] unregisterLoading:', key);
    setLoadingKeys(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      console.log('[SplashContext] Loading keys after unregister:', Array.from(next));
      return next;
    });
  }, []);

  const value = useMemo<SplashContextValue>(() => ({
    registerLoading,
    unregisterLoading,
    isAnyLoading: loadingKeys.size > 0,
    hasRegisteredScreen,
  }), [registerLoading, unregisterLoading, loadingKeys, hasRegisteredScreen]);

  return <SplashContext.Provider value={value}>{children}</SplashContext.Provider>;
};

/**
 * Hook per pantalles: registra el seu estat de càrrega al splash global.
 *
 * @param key Identificador únic de la pantalla (ex: 'MapScreen', 'BarDashboard')
 * @param isLoading Quan true, el splash es manté visible
 */
export function useScreenLoading(key: string, isLoading: boolean): void {
  const ctx = useContext(SplashContext);
  const keyRef = useRef(key);
  const registerLoading = ctx?.registerLoading;
  const unregisterLoading = ctx?.unregisterLoading;

  useEffect(() => {
    if (isLoading) {
      registerLoading?.(keyRef.current);
    } else {
      unregisterLoading?.(keyRef.current);
    }
  }, [isLoading, registerLoading, unregisterLoading]);

  // Neteja al desmuntar
  useEffect(() => {
    const k = keyRef.current;
    return () => {
      unregisterLoading?.(k);
    };
  }, [unregisterLoading]);
}

/** Hook intern per llegir l'estat global del splash. */
export function useSplashState(): { isAnyLoading: boolean; hasRegisteredScreen: boolean } {
  const ctx = useContext(SplashContext);
  return {
    isAnyLoading: ctx?.isAnyLoading ?? false,
    hasRegisteredScreen: ctx?.hasRegisteredScreen ?? false,
  };
}
