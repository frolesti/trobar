import React, { useState, useEffect } from 'react';
import { 
    View, Text, Image, TouchableOpacity, SafeAreaView, Platform, 
    TextInput, Alert, ScrollView, ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updateUserProfile, uploadProfileImage } from '../../services/userService';
import { ensureLoraOnWeb, SKETCH_THEME } from '../../theme/sketchTheme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import styles from './ProfileScreen.styles';

export default function ProfileScreen() {
  const { user, logout, refreshProfile, isLoading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Profile'>>();

  const [isLoading, setIsLoading] = useState(false);

  // Redirect to login if not authenticated, BUT wait for auth check to complete
  useEffect(() => {
    if (!authLoading && !user) {
      navigation.navigate('Login');
    }
  }, [user, authLoading, navigation]);

  // Form State
  const [name, setName] = useState(user?.name || '');
  const [surname, setSurname] = useState(user?.surname || '');
  const [avatarUri, setAvatarUri] = useState(user?.avatar || '');

  // Update form when user data changes
  useEffect(() => {
    if (user) {
        // Only update if the values are different to avoid overwriting local edits if sync happens
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
    // Navigate home instead of just "back" to avoid empty stack errors
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
      
      // Auto-save image immediately
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
      
      // Check if there are actual changes before calling API
      if (name === user.name && surname === (user.surname || '')) {
          return;
      }

      console.log("Auto-saving profile data...");
      try {
          await updateUserProfile(user.id, {
              name: name,
              surname: surname,
              // Keep defaults
              favoriteTeam: 'FC Barcelona', 
              favoriteSport: 'Football',
          });
          await refreshProfile();
          // No alert needed for auto-save
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
          <Ionicons name="arrow-back" size={24} color={SKETCH_THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={{ width: 44, height: 44 }} /> 
      </View>

      {/* Unified ScrollView for Web and Mobile with flex: 1 handling instead of fixed 100vh */}
      <View style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
        <ScrollView 
          style={styles.scrollContainer} 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={Platform.OS === 'web'}
        >
          {renderContent(avatarUri, pickImage, name, setName, surname, setSurname, user, saveData, isLoading)}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Tancar Sessió</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Helper to avoid duplicating scrollview content
function renderContent(
    avatarUri: string, 
    pickImage: () => void, 
    name: string, 
    setName: (val: string) => void, 
    surname: string, 
    setSurname: (val: string) => void,
    user: any,
    saveData: () => void,
    isLoading: boolean
) {
    return (
        <>
        {/* Avatar Section */}
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

        <Text style={styles.helperText}>Toca la càmera per canviar la foto</Text>

        {/* Info / Form Section */}
        <View style={styles.formContainer}>
            <Text style={styles.label}>Nom</Text>
            <TextInput 
                style={styles.input} 
                value={name} 
                onChangeText={setName} 
                onEndEditing={saveData} // Trigger save when leaving field or pressing done
                placeholder="El teu nom"
            />
            <Text style={styles.label}>Cognoms</Text>
            <TextInput 
                style={styles.input} 
                value={surname} 
                onChangeText={setSurname} 
                onEndEditing={saveData} // Trigger save when leaving field
                placeholder="Els teus cognoms"
            />

            <Text style={styles.label}>Correu electrònic</Text>
            <Text style={[styles.value, styles.readOnly]}>{user?.email}</Text>
        </View>
        </>
    );
}
