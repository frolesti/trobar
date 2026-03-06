import 'react-native-gesture-handler'; // MUST BE AT THE TOP
import React, { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import AppNavigator from './app/src/navigation/AppNavigator';
import { AuthProvider } from './app/src/context/AuthContext';
import ErrorBoundary from './app/src/components/ErrorBoundary';

LogBox.ignoreLogs(['props.pointerEvents is deprecated']);

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Set initial title
      document.title = 'troBar';

      // Create a MutationObserver to watch for changes to the <title> element
      // This prevents React Navigation or any other library from overwriting it
      const target = document.querySelector('title');
      if (target) {
        const observer = new MutationObserver(() => {
          if (document.title !== 'troBar') {
            document.title = 'troBar';
          }
        });
        observer.observe(target, { childList: true, characterData: true, subtree: true });
        
        return () => observer.disconnect();
      }
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}
