import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ensureLoraOnWeb, SKETCH_THEME } from '../../theme/sketchTheme';
import { useAuth } from '../../context/AuthContext';
import { addUserReportedBar } from '../../services/barService';
import { OSMBar } from '../../services/osmService';
import styles from './ReportBarScreen.styles';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ReportBar'>;
  route: RouteProp<RootStackParamList, 'ReportBar'>;
};

const ReportBarScreen = ({ navigation, route }: Props) => {
  const { osmBar } = route.params;
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
      ensureLoraOnWeb();
  }, []);

  const handleConfirm = async () => {
      // Opcional: Require login?
      if (!user) {
          Alert.alert("Inicia sessió", "Has d'iniciar sessió per confirmar nous llocs.", [
              { text: "Cancel·lar", style: 'cancel' },
              { text: "Iniciar Sessió", onPress: () => navigation.navigate('Login') }
          ]);
          return;
      }

      setIsSubmitting(true);
      try {
          await addUserReportedBar(osmBar, user.id);
          
          Alert.alert(
              "Gràcies! 🍺", 
              "Aquest bar s'ha afegit al mapa per a la comunitat.",
              [{ text: "Tornar al Mapa", onPress: () => navigation.navigate('Map') }]
          );
      } catch (error) {
          console.error(error);
          Alert.alert("Error", "No s'ha pogut guardar. Torna-ho a provar.");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <View style={styles.container}>
        <View style={styles.card}>
            <Feather name="tv" size={48} color={SKETCH_THEME.colors.primary} style={{ marginBottom: 20 }} />
            
            <Text style={styles.title}>Nou lloc per veure el Barça?</Text>
            
            <Text style={styles.subtitle}>
                Confirmes que a <Text style={styles.barName}>{osmBar.name}</Text> solen posar els partits?
            </Text>

            <View style={{ height: 20 }} />

            <TouchableOpacity 
                style={[styles.confirmButton, isSubmitting && { opacity: 0.7 }]} 
                onPress={handleConfirm}
                disabled={isSubmitting}
            >
                {isSubmitting ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text style={styles.confirmButtonText}>Sí, aquí fan futbol</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>No n'estic segur</Text>
            </TouchableOpacity>
        </View>
    </View>
  );
};

export default ReportBarScreen;
