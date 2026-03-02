import React, { useEffect } from 'react';
import { View, Text, ImageBackground } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ensureLoraOnWeb, SKETCH_THEME } from '../../theme/sketchTheme';
import styles from './StartupScreen.styles';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Startup'>;
};

const StartupScreen = ({ navigation }: Props) => {
  useEffect(() => {
    ensureLoraOnWeb();
    
    // Self-executing async function
    const initApp = async () => {
      // Note: Data sync is now handled by the 'server' (scripts/updateMatches.js)
      // which runs automatically during development start or scheduled jobs.
      // The app simply consumes the Firestore data.

      // Short delay to show completion if needed, or instant navigation
      setTimeout(() => {
          navigation.replace('Map');
      }, 2000); // Increased delay so the user can enjoy the GIF animation
    };

    initApp();
  }, [navigation]);

  return (
    <ImageBackground 
        source={require('../../../assets/img/trobar-gif.gif')} 
        style={styles.container}
        resizeMode="cover" // Fills the screen, fixing the 'white details/borders' issue
    >
      <View style={styles.logoContainer}>
        {/* GIF Background covers screen. Text matches positioning request. */}
        <Text style={styles.logoText}>troBar</Text>
      </View>
      <Text style={styles.copyright}>© frolesti</Text>
    </ImageBackground>
  );
};

export default StartupScreen;
