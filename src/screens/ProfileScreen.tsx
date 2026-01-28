import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, Platform, 
    StatusBar, TextInput, ScrollView, ActivityIndicator, Alert 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { updateUserProfile, uploadProfileImage } from '../services/userService';
import { fetchAllMatches } from '../services/matchService';
import { ensureLoraOnWeb, SKETCH_THEME } from '../theme/sketchTheme';
import { getUserFriendlyError } from '../utils/errorHandler';
import styles from './ProfileScreen.styles';

const SPORTS = ['Futbol'];

export default function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const navigation = useNavigation();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [name, setName] = useState(user?.name || '');
  const [team, setTeam] = useState(user?.favoriteTeam || '');
  const [sport, setSport] = useState(user?.favoriteSport || '');
  const [avatarUri, setAvatarUri] = useState(user?.avatar || '');

    const [availableTeams, setAvailableTeams] = useState<string[]>([]);

  // Reset form when user changes or we toggle edit off (cancel)
  useEffect(() => {
    if (!isEditing && user) {
        setName(user.name);
        setTeam(user.favoriteTeam || '');
        setSport(user.favoriteSport || '');
        setAvatarUri(user.avatar || '');
    }
  }, [user, isEditing]);

  useEffect(() => {
    ensureLoraOnWeb();
  }, []);

    useEffect(() => {
        let isMounted = true;

        const loadTeams = async () => {
            try {
                const { teams } = await fetchAllMatches();
                const merged = new Set<string>([...(teams || []), team].filter(Boolean) as string[]);
                if (isMounted) setAvailableTeams(Array.from(merged).sort());
            } catch {
                // If offline/proxy not running, keep empty and fall back to free-text input.
            }
        };

        loadTeams();
        return () => {
            isMounted = false;
        };
    }, [team]);

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
          await updateUserProfile(user.id, {
              name: name,
              favoriteTeam: team,
              favoriteSport: sport,
              avatar: downloadUrl as string | undefined // Cast to match interface if needed, but value is clean
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

      <ScrollView contentContainerStyle={styles.content}>
        
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
            <Text style={styles.label}>Nom i cognoms</Text>
            {isEditing ? (
                <TextInput 
                    style={styles.input} 
                    value={name} 
                    onChangeText={setName} 
                    placeholder="El teu nom"
                />
            ) : (
                <Text style={styles.value}>{user?.name || '-'}</Text>
            )}

            <Text style={styles.label}>Correu electrònic</Text>
            <Text style={[styles.value, styles.readOnly]}>{user?.email}</Text>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Els teus gustos</Text>

            <Text style={styles.label}>Esport preferit</Text>
            {isEditing ? (
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={sport}
                        onValueChange={(itemValue) => setSport(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Selecciona un esport" value="" />
                        {SPORTS.map((s) => (
                            <Picker.Item key={s} label={s} value={s} />
                        ))}
                    </Picker>
                </View>
            ) : (
                <Text style={styles.value}>{user?.favoriteSport || 'No especificat'}</Text>
            )}

            <Text style={styles.label}>Equip preferit</Text>
            {isEditing ? (
                availableTeams.length > 0 ? (
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={team}
                            onValueChange={(itemValue) => setTeam(itemValue)}
                            style={styles.picker}
                        >
                            <Picker.Item label="Selecciona un equip" value="" />
                            {availableTeams.map((t) => (
                                <Picker.Item key={t} label={t} value={t} />
                            ))}
                        </Picker>
                    </View>
                ) : (
                    <TextInput
                        style={styles.input}
                        value={team}
                        onChangeText={setTeam}
                        placeholder="Escriu el teu equip"
                    />
                )
            ) : (
                <Text style={styles.value}>{user?.favoriteTeam || 'No especificat'}</Text>
            )}

        </View>

        {isEditing && (
            <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setIsEditing(false)}
                disabled={isLoading}
            >
                <Text style={styles.cancelText}>Cancel·lar canvis</Text>
            </TouchableOpacity>
        )}

        {!isEditing && (
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Tancar Sessió</Text>
            </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}


