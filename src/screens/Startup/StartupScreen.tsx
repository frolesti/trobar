import React, { useEffect } from 'react';
import { View, Text, ImageBackground } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ensureLoraOnWeb, SKETCH_THEME } from '../../theme/sketchTheme';
import styles from './StartupScreen.styles';
import { checkForUpdatesAndSync } from '../../services/syncService';

// Define the navigation types (we can move this to a types file later)
export type RootStackParamList = {
  Startup: undefined;
  Map: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Startup'>;
};

const StartupScreen = ({ navigation }: Props) => {
  // const [statusText, setStatusText] = useState('Carregant...'); // Removed user feedback

  useEffect(() => {
    ensureLoraOnWeb();
    
    // Self-executing async function
    const initApp = async () => {
      // 1. Check & Sync Data (Smart background check)
      // Only runs if data > 24h old.
      // setStatusText('Actualitzant dades...');
      
      try {
        await checkForUpdatesAndSync();
      } catch (e) {
        console.warn("Sync failed silently", e);
      }

      // setStatusText('Fet!');
      
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
