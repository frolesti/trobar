import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import styles from './StartupScreen.styles';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Startup'>;
};

const StartupScreen = ({ navigation }: Props) => {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
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
        <Image
          source={require('../../../assets/img/logo-nav.jpg')}
          style={styles.logo}
          resizeMode="cover"
        />
        <Text style={styles.eyebrow}>Benvingut</Text>
        <Text style={styles.wordmark}>
          tro<Text style={styles.wordmarkItalic}>Bar</Text>
        </Text>
      </View>
      <Text style={styles.copyright}>© FROLESTI</Text>
    </View>
  );
};

export default StartupScreen;

