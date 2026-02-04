import React, { useState, useEffect } from 'react';
import { 
    View, Text, Image, TouchableOpacity, SafeAreaView, Platform, 
    TextInput, Alert, ScrollView, ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updateUserProfile, uploadProfileImage } from '../../services/userService';
import { ensureLoraOnWeb, SKETCH_THEME } from '../../theme/sketchTheme';
import { getUserFriendlyError } from '../../utils/errorHandler';
import styles from './ProfileScreen.styles';

export default function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const navigation = useNavigation();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [name, setName] = useState(user?.name || '');
  const [surname, setSurname] = useState(user?.surname || '');
  const [avatarUri, setAvatarUri] = useState(user?.avatar || '');

  // Reset form when user changes or we toggle edit off (cancel)
  useEffect(() => {
    if (!isEditing && user) {
        setName(user.name);
        setSurname(user.surname || '');
        setAvatarUri(user.avatar || '');
    }
  }, [user, isEditing]);

  useEffect(() => {
    ensureLoraOnWeb();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigation.goBack();
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
          // Important: Si user.avatar és undefined, posem null per evitar error de Firestore
          let downloadUrl: string | null = user.avatar || null;

          // 1. Si hem canviat la imatge (és una URI local diferent de la remote)
          if (avatarUri && avatarUri !== user.avatar && !avatarUri.startsWith('http')) {
             downloadUrl = await uploadProfileImage(user.id, avatarUri);
          }

          // 2. Guardar dades a Firestore
          // We force 'favoriteTeam' to 'FC Barcelona' and 'favoriteSport' to 'Football' for consistency
          await updateUserProfile(user.id, {
              name: name,
              surname: surname,
              favoriteTeam: 'FC Barcelona',
              favoriteSport: 'Football',
              avatar: downloadUrl as string | undefined
          });

          // 3. Refrescar context
          await refreshProfile();
          
          setIsEditing(false);
          Alert.alert("Perfil actualitzat", "Les teves dades s'han guardat correctament.");
      } catch (error) {
          console.error(error);
          Alert.alert("Error", getUserFriendlyError(error, "No s'ha pogut guardar el perfil."));
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SKETCH_THEME.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => isEditing ? handleSave() : setIsEditing(true)}
            disabled={isLoading}
        >
            {isLoading ? 
              <ActivityIndicator size="small" color={SKETCH_THEME.colors.primary} /> : 
                <Text style={styles.editButtonText}>{isEditing ? "Guardar" : "Editar"}</Text>
            }
        </TouchableOpacity>
      </View>

      {Platform.OS === 'web' ? (
      <View style={{ flex: 1, width: '100%', height: Platform.select({ web: '100vh' as any, default: '100%' }), overflow: 'hidden' }}>
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        {renderContent(isEditing, avatarUri, pickImage, name, setName, surname, setSurname, user)}
      </ScrollView>
      </View>
      ) : (
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled" 
        showsVerticalScrollIndicator={false}
      >
        {renderContent(isEditing, avatarUri, pickImage, name, setName, surname, setSurname, user)}
      </ScrollView>
      )}

      {!isEditing && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Tancar Sessió</Text>
            </TouchableOpacity>
          </View>
      )}
    </SafeAreaView>
  );
}

// Helper to avoid duplicating scrollview content
function renderContent(
    isEditing: boolean, 
    avatarUri: string, 
    pickImage: () => void, 
    name: string, 
    setName: (val: string) => void, 
    surname: string, 
    setSurname: (val: string) => void,
    user: any
) {
    return (
        <>
        {/* Avatar Section */}
        <View style={styles.avatarContainer}>
            <Image 
                source={{ uri: avatarUri || 'https://placehold.co/150x150/png' }} 
                style={styles.avatar} 
            />
            {isEditing && (
                <TouchableOpacity style={styles.changePhotoButton} onPress={pickImage}>
                    <Ionicons name="camera" size={20} color="white" />
                </TouchableOpacity>
            )}
        </View>

        {isEditing && (
             <Text style={styles.helperText}>Toca la càmera per canviar la foto</Text>
        )}

        {/* Info / Form Section */}
        <View style={styles.formContainer}>
            {isEditing ? (
                <>
                    <Text style={styles.label}>Nom</Text>
                    <TextInput 
                        style={styles.input} 
                        value={name} 
                        onChangeText={setName} 
                        placeholder="El teu nom"
                    />
                    <Text style={styles.label}>Cognoms</Text>
                    <TextInput 
                        style={styles.input} 
                        value={surname} 
                        onChangeText={setSurname} 
                        placeholder="Els teus cognoms"
                    />
                </>
            ) : (
                <>
                    <Text style={styles.label}>Nom i Cognoms</Text>
                    <Text style={styles.value}>{`${user?.name || ''} ${user?.surname || ''}`.trim() || '-'}</Text>
                </>
            )}

            <Text style={styles.label}>Correu electrònic</Text>
            <Text style={[styles.value, styles.readOnly]}>{user?.email}</Text>
        </View>
        </>
    );
}
