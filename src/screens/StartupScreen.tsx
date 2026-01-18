import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
        <ActivityIndicator size="small" color="#fff" style={styles.loader} />
      </View>
      <Text style={styles.version}>v1.0.0</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2196F3', // Color corporatiu (a definir)
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 2,
  },
  loader: {
    marginTop: 20,
  },
  version: {
    position: 'absolute',
    bottom: 30,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
});

export default StartupScreen;
