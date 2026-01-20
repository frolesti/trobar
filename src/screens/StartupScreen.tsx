import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ensureLoraOnWeb, sketchFontFamily, SKETCH_THEME } from '../theme/sketchTheme';

// Define the navigation types (we can move this to a types file later)
export type RootStackParamList = {
  Startup: undefined;
  Map: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Startup'>;
};

const StartupScreen = ({ navigation }: Props) => {
  useEffect(() => {
    ensureLoraOnWeb();

    // Simulació de càrrega de recursos i verificació de sessió
    const timer = setTimeout(() => {
      // Navegar a la pantalla principal (Map) i reemplaçar la història per evitar tornar enrere
      navigation.replace('Map');
    }, 2500); // 2.5 segons

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        {/* Aquí aniria el logo (Image) */}
        <Text style={styles.logoText}>TroBar</Text>
        <ActivityIndicator size="small" color="#D32F2F" style={styles.loader} />
      </View>
      <Text style={styles.copyright}>© frolesti</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SKETCH_THEME.colors.bg, // Paper/Cream background
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: SKETCH_THEME.colors.text, // Dark Brown
    fontFamily: sketchFontFamily(),
    letterSpacing: 2,
  },
  loader: {
    marginTop: 20,
  },
  copyright: {
    position: 'absolute',
    bottom: 30,
    color: SKETCH_THEME.colors.accent,
    fontSize: 12,
    fontFamily: sketchFontFamily(),
  },
});

export default StartupScreen;
