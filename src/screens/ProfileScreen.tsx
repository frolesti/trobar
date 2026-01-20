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

const SPORTS = ['Futbol'];
const TEAMS = ['FC Barcelona', 'Real Madrid', 'RCD Espanyol', 'Girona FC'];

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

  // Reset form when user changes or we toggle edit off (cancel)
  useEffect(() => {
    if (!isEditing && user) {
        setName(user.name);
        setTeam(user.favoriteTeam || '');
        setSport(user.favoriteSport || '');
        setAvatarUri(user.avatar || '');
    }
  }, [user, isEditing]);

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
          let downloadUrl = user.avatar;

          // 1. Si hem canviat la imatge (és una URI local diferent de la remote)
          if (avatarUri && avatarUri !== user.avatar && !avatarUri.startsWith('http')) {
             downloadUrl = await uploadProfileImage(user.id, avatarUri);
          }

          // 2. Guardar dades a Firestore
          await updateUserProfile(user.id, {
              name: name,
              favoriteTeam: team,
              favoriteSport: sport,
              avatar: downloadUrl
          });

          // 3. Refrescar context
          await refreshProfile();
          
          setIsEditing(false);
          Alert.alert("Perfil actualitzat", "Les teves dades s'han guardat correctament.");
      } catch (error) {
          console.error(error);
          Alert.alert("Error", "No s'ha pogut guardar el perfil.");
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => isEditing ? handleSave() : setIsEditing(true)}
            disabled={isLoading}
        >
            {isLoading ? 
                <ActivityIndicator size="small" color="#007AFF" /> : 
                <Text style={styles.editButtonText}>{isEditing ? "Guardar" : "Editar"}</Text>
            }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Avatar Section */}
        <View style={styles.avatarContainer}>
            <Image 
                source={{ uri: avatarUri || 'https://via.placeholder.com/150' }} 
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
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={team}
                        onValueChange={(itemValue) => setTeam(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Selecciona un equip" value="" />
                        {TEAMS.map((t) => (
                            <Picker.Item key={t} label={t} value={t} />
                        ))}
                    </Picker>
                </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    ...Platform.select({
      web: { boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
      default: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2 }
    }),
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
      padding: 8,
  },
  editButtonText: {
      color: '#007AFF',
      fontWeight: '600',
      fontSize: 16
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  avatarContainer: {
      position: 'relative',
      marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E1E1E1',
    borderWidth: 3,
    borderColor: 'white',
  },
  changePhotoButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: '#007AFF',
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'white'
  },
  helperText: {
      fontSize: 12,
      color: '#666',
      marginBottom: 20,
  },
  formContainer: {
      width: '100%',
      backgroundColor: 'white',
      borderRadius: 16,
      padding: 24,
      ...Platform.select({
        web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
        default: { elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }
      }),
      marginBottom: 24
  },
  label: {
      fontSize: 12,
      color: '#888',
      textTransform: 'uppercase',
      marginBottom: 4,
      marginTop: 12,
      letterSpacing: 1
  },
  value: {
      fontSize: 16,
      color: '#333',
      paddingVertical: 4,
      fontWeight: '500'
  },
  input: {
      fontSize: 16,
      color: '#333',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#DDD',
      fontWeight: '500'
  },
  readOnly: {
      color: '#888'
  },
  divider: {
      height: 1,
      backgroundColor: '#EEEEEE',
      marginVertical: 20
  },
  sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
      color: '#333'
  },
  logoutButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
  },
  logoutText: {
    color: '#D32F2F',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
      marginTop: 10,
      padding: 12
  },
  cancelText: {
      color: '#666',
      fontSize: 14
  },
  pickerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
    // marginBottom: 8, 
  },
  picker: {
    width: '100%',
    ...Platform.select({
      android: {
         color: '#333',
      }
    })
  }
});
