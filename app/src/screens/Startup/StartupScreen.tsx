import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ensureLoraOnWeb } from '../../theme/sketchTheme';
import styles from './StartupScreen.styles';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Startup'>;
};

const StartupScreen = ({ navigation }: Props) => {
  useEffect(() => {
    ensureLoraOnWeb();
    
    const initApp = async () => {
      setTimeout(() => {
          navigation.replace('Map');
      }, 1500);
    };

    initApp();
  }, [navigation]);

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
