import React, { useState, useEffect } from 'react';
import { 
    View, Text, Image, TouchableOpacity, SafeAreaView, Platform, 
    TextInput, Alert, ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updateUserProfile, uploadProfileImage } from '../../services/userService';
import { ensureLoraOnWeb, SKETCH_THEME } from '../../theme/sketchTheme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import SettingsModal from './SettingsModal';
import styles from './ProfileScreen.styles';

export default function ProfileScreen() {
  const { user, logout, refreshProfile, isLoading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Profile'>>();

  const [isLoading, setIsLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Redirigir al login si no autenticat, PERÒ esperar que la comprovació d'auth acabi
  useEffect(() => {
    if (!authLoading && !user) {
      navigation.navigate('Login');
    }
  }, [user, authLoading, navigation]);

  // Estat del formulari
  const [name, setName] = useState(user?.name || '');
  const [surname, setSurname] = useState(user?.surname || '');
  const [avatarUri, setAvatarUri] = useState(user?.avatar || '');

  // Actualitzar formulari quan canviïn les dades d'usuari
  useEffect(() => {
    if (user) {
        // Només actualitzar si els valors són diferents per evitar sobreescriure edicions locals
        if (user.name !== name) setName(user.name);
        if ((user.surname || '') !== surname) setSurname(user.surname || '');
        if ((user.avatar || '') !== avatarUri) setAvatarUri(user.avatar || '');
    }
  }, [user]);

  useEffect(() => {
    ensureLoraOnWeb();
  }, []);

  const handleLogout = async () => {
    await logout();
    // Navegar a l'inici en lloc de 'enrere' per evitar errors de pila buida
    navigation.reset({
      index: 0,
      routes: [{ name: 'Map' }],
    });
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      const newUri = result.assets[0].uri;
      setAvatarUri(newUri);
      
      // Desar imatge automàticament
      if (user) {
          try {
             setIsLoading(true);
             const downloadUrl = await uploadProfileImage(user.id, newUri);
             await updateUserProfile(user.id, { avatar: downloadUrl });
             await refreshProfile();
          } catch (error) {
             console.error("Error uploading image:", error);
             Alert.alert("Error", "No s'ha pogut actualitzar la foto.");
          } finally {
             setIsLoading(false);
          }
      }
    }
  };

  const saveData = async () => {
      if (!user) return;
      
      // Comprovar si hi ha canvis reals abans de cridar l'API
      if (name === user.name && surname === (user.surname || '')) {
          return;
      }

      // console.log("Auto-saving profile data...");
      try {
          await updateUserProfile(user.id, {
              name: name,
              surname: surname,
              // Mantenir valors per defecte
              favoriteTeam: 'FC Barcelona', 
              favoriteSport: 'Football',
          });
          await refreshProfile();
          // No cal alerta per al desat automàtic
      } catch (error) {
          console.error("Auto-save error:", error);
      }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Map');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SKETCH_THEME.colors.textInverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.backButton}>
          <Ionicons name="settings-outline" size={24} color={SKETCH_THEME.colors.textInverse} />
        </TouchableOpacity> 
      </View>

      {/* Àrea de contingut principal — sense ScrollView per pantalla completa */}
      <View style={{ flex: 1, width: '100%', paddingHorizontal: SKETCH_THEME.spacing.md, paddingTop: SKETCH_THEME.spacing.md, justifyContent: 'space-between' }}>
        
        {/* Contingut superior: Avatar i formulari */}
        <View>
            {/* Secció d'avatar */}
            <View style={styles.avatarContainer}>
                <Image 
                    source={{ uri: avatarUri || 'https://placehold.co/150x150/png' }} 
                    style={styles.avatar} 
                />
                <TouchableOpacity style={styles.changePhotoButton} onPress={pickImage} disabled={isLoading}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Ionicons name="camera" size={20} color="white" />
                    )}
                </TouchableOpacity>
            </View>

            <Text style={[styles.helperText, { textAlign: 'center'}]}>Toca la càmera per canviar la foto</Text>

            {/* Secció d'informació / formulari */}
            <View style={styles.formContainer}>
                <Text style={styles.label}>Nom</Text>
                <TextInput 
                    style={styles.input} 
                    value={name} 
                    onChangeText={setName} 
                    onEndEditing={saveData} 
                    placeholder="El teu nom"
                />
                <Text style={styles.label}>Cognoms</Text>
                <TextInput 
                    style={styles.input} 
                    value={surname} 
                    onChangeText={setSurname} 
                    onEndEditing={saveData} 
                    placeholder="Els teus cognoms"
                />

                <Text style={styles.label}>Correu electrònic</Text>
                <Text style={[styles.value, styles.readOnly]}>{user?.email}</Text>
            </View>
        </View>

        {/* Accions inferiors: fixades a baix */}
        <View style={{ paddingBottom: 10 }}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Tancar Sessió</Text>
            </TouchableOpacity>
        </View>
      </View>

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

// Funció auxiliar de renderitzat eliminada en favor d'estructura directa

