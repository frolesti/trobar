import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ensureLoraOnWeb } from '../../theme/sketchTheme';
import { useAuth } from '../../context/AuthContext';
import styles from './StartupScreen.styles';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Startup'>;
};

const StartupScreen = ({ navigation }: Props) => {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    ensureLoraOnWeb();
  }, []);

  // Esperar que auth estigui llest i llavors redirigir
  useEffect(() => {
    if (isLoading) return; // Encara carregant auth
    const timer = setTimeout(() => {
      if (user?.role === 'bar_owner') {
        navigation.replace('BarDashboard');
      } else {
        navigation.replace('Map');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [isLoading, user, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        {/* Placeholder per a logo futur */}
        <Text style={styles.logoText}>troBar</Text>
        <ActivityIndicator size="small" color="#edbb00" style={{ marginTop: 24 }} />
      </View>
      <Text style={styles.copyright}>© frolesti</Text>
    </View>
  );
};

export default StartupScreen;
