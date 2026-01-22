import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ensureLoraOnWeb, SKETCH_THEME } from '../theme/sketchTheme';
import styles from './StartupScreen.styles';

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
        <Text style={styles.logoText}>troBar</Text>
        <ActivityIndicator size="small" color={SKETCH_THEME.colors.primary} style={styles.loader} />
      </View>
      <Text style={styles.copyright}>© frolesti</Text>
    </View>
  );
};

export default StartupScreen;
