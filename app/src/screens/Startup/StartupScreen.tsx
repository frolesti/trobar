import React, { useEffect } from 'react';
import { View, Text, ImageBackground } from 'react-native';
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
    
    // Funció asíncrona autoexecutable
    const initApp = async () => {
      // Nota: La sincronització de dades la gestiona el 'server' (scripts/updateMatches.js)
      // que s'executa automàticament a l'inici del desenvolupament o com a tasca programada.
      // L'app simplement consumeix les dades de Firestore.

      // Petit retard per mostrar la pantalla o navegació instantània
      setTimeout(() => {
          navigation.replace('Map');
      }, 2000); // Retard augmentat perquè l'usuari pugui gaudir de l'animació GIF
    };

    initApp();
  }, [navigation]);

  return (
    <ImageBackground 
        source={require('../../../assets/img/trobar-gif.gif')} 
        style={styles.container}
        resizeMode="cover" // Omple la pantalla, arreglant el problema de 'vores blanques'
    >
      <View style={styles.logoContainer}>
        {/* El GIF de fons cobreix la pantalla. El text segueix el posicionament demanat. */}
        <Text style={styles.logoText}>troBar</Text>
      </View>
      <Text style={styles.copyright}>© frolesti</Text>
    </ImageBackground>
  );
};

export default StartupScreen;
