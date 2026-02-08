import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Image, ScrollView, Linking, Platform, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ensureLoraOnWeb, SKETCH_THEME, sketchShadow } from '../../theme/sketchTheme';
import { useAuth } from '../../context/AuthContext';
import { addUserReportedBar } from '../../services/barService';
import { OSMBar } from '../../services/osmService';
// We don't use styles file anymore to keep it self contained and faster to iterate UI
// import styles from './ReportBarScreen.styles'; 

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ReportBar'>;
  route: RouteProp<RootStackParamList, 'ReportBar'>;
};

// Placeholder images for carousel
const PLACEHOLDERS = [
    require('../../../assets/img/bar-fallout.jpg'),
    // Reuse same image or others if available to simulate carousel
];

const ReportBarScreen = ({ navigation, route }: Props) => {
  const { osmBar } = route.params;
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
      ensureLoraOnWeb();
  }, []);

  // Construct Address from Tags
  const getAddress = () => {
    const t = osmBar.tags || {};
    const street = t['addr:street'] || '';
    const number = t['addr:housenumber'] || '';
    const city = t['addr:city'] || 'Barcelona';
    
    if (street) return `${street}, ${number}, ${city}`;
    return 'Adreça no disponible';
  };

  const openGoogleMaps = () => {
      const query = encodeURIComponent(`${osmBar.name}, ${getAddress()}`);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
           
           <TouchableOpacity 
                style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}} 
                activeOpacity={1} 
                onPress={() => navigation.goBack()}
           />

           <View style={{
               width: '100%', maxWidth: 400,
               backgroundColor: SKETCH_THEME.colors.bg,
               borderRadius: 20,
               borderWidth: 1, borderColor: '#eee',
               overflow: 'hidden',
               ...(Platform.OS === 'web' ? { boxShadow: '0px 10px 40px rgba(0,0,0,0.2)' } : { elevation: 10 }),
           }}>
               {/* 1. Header / Icon */}
               <View style={{ flexDirection: 'row', padding: 20, paddingBottom: 15 }}>
                    <View style={{
                        width: 60, height: 60, borderRadius: 30, backgroundColor: 'black',
                        justifyContent: 'center', alignItems: 'center', marginRight: 15
                    }}>
                        <Feather name="coffee" size={28} color="white" />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={{ fontSize: 22, fontWeight: 'bold', fontFamily: 'Lora', color: SKETCH_THEME.colors.text }}>
                            {osmBar.name}
                        </Text>
                        <Text style={{ fontSize: 13, color: SKETCH_THEME.colors.textMuted, fontFamily: 'Lora', marginTop: 4 }}>
                            {getAddress()}
                        </Text>
                        <TouchableOpacity style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}} onPress={openGoogleMaps}>
                            <Feather name="map" size={12} color="#E53935" />
                            <Text style={{ fontSize: 12, color: '#E53935', marginLeft: 4, textDecorationLine: 'underline' }}>
                                Veure a Google Maps
                            </Text>
                        </TouchableOpacity>
                    </View>
               </View>

               {/* 2. Carousel Simulation */}
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 20, marginBottom: 20 }}>
                   {[1, 2, 3].map((i) => (
                       <Image 
                            key={i}
                            source={require('../../../assets/img/bar-fallout.jpg')} 
                            style={{ width: 140, height: 100, borderRadius: 12, marginRight: 10, backgroundColor: '#eee' }}
                            resizeMode="cover"
                       />
                   ))}
               </ScrollView>

               {/* 3. Action Area */}
               <View style={{ padding: 20, paddingTop: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', fontFamily: 'Lora', marginBottom: 15, textAlign: 'center' }}>
                        Es poden veure partits aquí?
                    </Text>

                    <TouchableOpacity 
                        style={{
                            backgroundColor: SKETCH_THEME.colors.primary,
                            paddingVertical: 14, borderRadius: 12,
                            alignItems: 'center', marginBottom: 12,
                            ...sketchShadow()
                        }}
                        onPress={handleConfirm}
                        disabled={isSubmitting}
                    >
                         {isSubmitting ? (
                             <ActivityIndicator color="white" />
                         ) : (
                             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent:'center' }}>
                                 <Feather name="check-circle" size={18} color="white" style={{ marginRight: 8 }} />
                                 <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Sí, avisa tothom!</Text>
                             </View>
                         )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => navigation.goBack()}
                        style={{ alignItems: 'center', padding: 10 }}
                    >
                        <Text style={{ color: SKETCH_THEME.colors.textMuted, textDecorationLine: 'underline' }}>No n'estic segur</Text>
                    </TouchableOpacity>
               </View>
           </View>
      </View>
  );
};

export default ReportBarScreen;
