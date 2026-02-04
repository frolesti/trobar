import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, Platform, 
    StatusBar, TextInput, Alert, Modal, FlatList, Animated, Easing, ScrollView, KeyboardAvoidingView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
// Removed: Picker import is no longer needed
import { updateUserProfile, uploadProfileImage } from '../../services/userService';
import { fetchAllMatches, getTeamsFromLeague } from '../../services/matchService';
import { ensureLoraOnWeb, SKETCH_THEME, sketchShadow } from '../../theme/sketchTheme';
import { getUserFriendlyError } from '../../utils/errorHandler';
import styles from './ProfileScreen.styles';
import { SPORTS_DATA } from '../../data/leagues';
import { formatTeamNameForDisplay } from '../../utils/teamName';

const SPORTS = SPORTS_DATA.map(s => s.sport);

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

  // Dynamic Selectors (Picker Modal State)
  const [selectedLeague, setSelectedLeague] = useState<string>(''); // Slug
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalOptions, setModalOptions] = useState<{label: string, value: string}[]>([]);
  const [onSelectOption, setOnSelectOption] = useState<(val: string) => void>(() => {});
  const [pickerAnim] = useState(new Animated.Value(0));

  // Initialize Modal Open
  const openPickerModal = (title: string, options: {label: string, value: string}[], onSelect: (val: string) => void) => {
      setModalTitle(title);
      setModalOptions(options);
      setOnSelectOption(() => onSelect); // Wrap to store function
      setModalVisible(true);
      Animated.timing(pickerAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true
      }).start();
  };

  const closePickerModal = () => {
      Animated.timing(pickerAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
      }).start(() => setModalVisible(false));
  };

  // Render Custom Picker Trigger
  const renderPickerTrigger = (label: string | undefined, placeholder: string, onPress: () => void, disabled = false) => {
      return (
        <TouchableOpacity
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 1, // Thinner border
                borderColor: SKETCH_THEME.colors.border, // Lighter border
                borderRadius: 8,
                backgroundColor: disabled ? 'rgba(0,0,0,0.03)' : SKETCH_THEME.colors.bg,
                height: 48,
                paddingHorizontal: 12,
                marginTop: 4,
                marginBottom: 12, // More breathing room
                opacity: disabled ? 0.6 : 1
            }}
            onPress={onPress}
            disabled={disabled}
        >
            <Text style={{
                color: label ? SKETCH_THEME.colors.text : SKETCH_THEME.colors.textMuted,
                fontFamily: Platform.OS === 'web' ? 'Lora, serif' : undefined,
                fontSize: 16
            }} numberOfLines={1}>
                {label || placeholder}
            </Text>
            <Feather name="chevron-down" size={20} color={SKETCH_THEME.colors.textMuted} />
        </TouchableOpacity>
      );
  };

  // Reset form when user changes or we toggle edit off (cancel)
  useEffect(() => {
    if (!isEditing && user) {
        setName(user.name);
        setTeam(user.favoriteTeam || '');
        setSport(user.favoriteSport || '');
        setAvatarUri(user.avatar || '');
        // We don't necessarily know the league of the saved team without a reverse lookup, 
        // so we leave selectedLeague empty until user picks one.
        setSelectedLeague('');
        setAvailableTeams([]); 
    }
  }, [user, isEditing]);

  useEffect(() => {
    ensureLoraOnWeb();
  }, []);

  // Effect to load teams when a League is selected
  useEffect(() => {
    if (!selectedLeague) return;

    let isMounted = true;
    const load = async () => {
        setIsLoadingTeams(true);
        try {
            const teams = await getTeamsFromLeague(selectedLeague);
            if (isMounted) setAvailableTeams(teams);
        } catch (e) {
            console.error("Error loading teams", e);
            if (isMounted) setAvailableTeams([]);
        } finally {
            if (isMounted) setIsLoadingTeams(false);
        }
    };
    load();
    return () => { isMounted = false; };
  }, [selectedLeague]);

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
              <LoadingIndicator size="small" /> : 
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

            <Text style={styles.sectionTitle}>Les teves preferències</Text>

            <Text style={styles.label}>Esport preferit</Text>
            {isEditing ? (
                renderPickerTrigger(
                    sport, 
                    "Selecciona un esport", 
                    () => openPickerModal('Esport', SPORTS.map(s => ({label: s, value: s})), setSport)
                )
            ) : (
                <Text style={styles.value}>{user?.favoriteSport || 'No especificat'}</Text>
            )}

            <Text style={styles.label}>Preferències d'Equip</Text>
            {isEditing ? (
                <View style={{ marginTop: 4 }}>
                    <Text style={{fontSize: 12, color: SKETCH_THEME.colors.textMuted, marginBottom: 4}}>1. Lliga (filtre opcional)</Text>
                    
                    {renderPickerTrigger(
                        (SPORTS_DATA.find(s => s.sport === sport)?.competitions || []).find(c => c.slug === selectedLeague)?.name || selectedLeague,
                        sport ? "-- Tria de quina Lliga --" : "-- Tria Esport primer --",
                        () => {
                            const comps = (SPORTS_DATA.find(s => s.sport === sport)?.competitions || []);
                            openPickerModal('Lliga', comps.map(c => ({label: c.name, value: c.slug})), setSelectedLeague);
                        },
                        !sport
                    )}

                    <Text style={{fontSize: 12, color: SKETCH_THEME.colors.textMuted, marginBottom: 4}}>2. El teu equip</Text>
                    {isLoadingTeams ? (
                        <ActivityIndicator style={{marginVertical: 10}} color={SKETCH_THEME.colors.primary} />
                    ) : (
                        renderPickerTrigger(
                            team ? formatTeamNameForDisplay(team) : undefined,
                            "Busca o selecciona equip...",
                            () => {
                                // Prepare options: if availableTeams, use them. Else empty.
                                const opts = availableTeams.map(t => ({label: formatTeamNameForDisplay(t), value: t}));
                                openPickerModal(
                                    availableTeams.length > 0 ? 'Equip' : 'Equip (Introdueix manualment si cal)', 
                                    opts, 
                                    setTeam
                                );
                            },
                             // Always enable to allow "Other" entry via modal search/input or if they just want to see list
                             false
                        )
                    )}
                    
                    {/* Fallback Input is integrated into modal if needed, or kept here only if truly custom */}
                     <TextInput
                        style={[styles.input, {marginTop: 4, fontSize: 14}]}
                        value={team}
                        onChangeText={setTeam}
                        placeholder="O escriu-lo manualment aquí..."
                    />
                </View>
            ) : (
                <View>
                    <Text style={styles.label}>Equip preferit</Text>
                    <Text style={styles.value}>{user?.favoriteTeam ? formatTeamNameForDisplay(user.favoriteTeam) : 'No especificat'}</Text>
                </View>
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
      </View>
      ) : (
      <KeyboardAvoidingView 
        style={{ flex: 1, width: '100%' }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
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

            <Text style={styles.sectionTitle}>Les teves preferències</Text>

            <Text style={styles.label}>Esport preferit</Text>
            {isEditing ? (
                renderPickerTrigger(
                    sport, 
                    "Selecciona un esport", 
                    () => openPickerModal('Esport', SPORTS.map(s => ({label: s, value: s})), setSport)
                )
            ) : (
                <Text style={styles.value}>{user?.favoriteSport || 'No especificat'}</Text>
            )}

            <Text style={styles.label}>Preferències d'Equip</Text>
            {isEditing ? (
                <View style={{ marginTop: 4 }}>
                    <Text style={{fontSize: 12, color: SKETCH_THEME.colors.textMuted, marginBottom: 4}}>1. Lliga (filtre opcional)</Text>
                    
                    {renderPickerTrigger(
                        (SPORTS_DATA.find(s => s.sport === sport)?.competitions || []).find(c => c.slug === selectedLeague)?.name || selectedLeague,
                        sport ? "-- Tria de quina Lliga --" : "-- Tria Esport primer --",
                        () => {
                            const comps = (SPORTS_DATA.find(s => s.sport === sport)?.competitions || []);
                            openPickerModal('Lliga', comps.map(c => ({label: c.name, value: c.slug})), setSelectedLeague);
                        },
                        !sport
                    )}
                    
                    <Text style={{fontSize: 12, color: SKETCH_THEME.colors.textMuted, marginBottom: 4, marginTop: 10}}>2. El teu equip</Text>
                    {isLoadingTeams ? (
                        <LoadingIndicator size="small" style={{marginVertical: 10}} />
                    ) : (
                        renderPickerTrigger(
                            team ? formatTeamNameForDisplay(team) : undefined,
                            "Busca o selecciona equip...",
                            () => {
                                // Prepare options: if availableTeams, use them. Else empty.
                                const opts = availableTeams.map(t => ({label: formatTeamNameForDisplay(t), value: t}));
                                openPickerModal(
                                    availableTeams.length > 0 ? 'Equip' : 'Equip (Introdueix manualment si cal)', 
                                    opts, 
                                    setTeam
                                );
                            },
                             // Always enable to allow "Other" entry via modal search/input or if they just want to see list
                             false
                        )
                    )}
                    
                    {/* Fallback Input is integrated into modal if needed, or kept here only if truly custom */}
                     <TextInput 
                        style={[styles.input, {marginTop: 10}]} 
                        value={team} 
                        onChangeText={setTeam}
                        placeholder="O escriu-lo manualment aquí..."
                    />
                </View>
            ) : (
                <View>
                    <Text style={styles.label}>Equip preferit</Text>
                    <Text style={styles.value}>{user?.favoriteTeam ? formatTeamNameForDisplay(user.favoriteTeam) : 'No especificat'}</Text>
                </View>
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
      </KeyboardAvoidingView>
      )}

      {/* CUSTOM PICKER MODAL */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closePickerModal}
      >
          <View style={{
                flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
                padding: 20
            }}>
                <Animated.View style={{
                    width: Platform.OS === 'web' ? 400 : '100%',
                    maxWidth: '100%',
                    maxHeight: '70%',
                    backgroundColor: SKETCH_THEME.colors.bg,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: SKETCH_THEME.colors.text,
                    ...sketchShadow, // Fixed usage directly
                    transform: [{ scale: pickerAnim }],
                    opacity: pickerAnim
                }}>
                    <View style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(62, 39, 35, 0.1)'
                    }}>
                        <Text style={{fontFamily: Platform.OS === 'web' ? 'Lora, serif' : undefined, fontSize: 18, fontWeight: 'bold', color: SKETCH_THEME.colors.text}}>
                            {modalTitle}
                        </Text>
                        <TouchableOpacity onPress={closePickerModal}>
                             <Feather name="x" size={24} color={SKETCH_THEME.colors.text} />
                        </TouchableOpacity>
                    </View>
                    
                    {/* List */}
                    <FlatList
                        data={modalOptions}
                        keyExtractor={(item) => item.value}
                        contentContainerStyle={{padding: 8}}
                        // Empty Component
                        ListEmptyComponent={
                            <View style={{padding: 20, alignItems: 'center'}}>
                                <Text style={{color: SKETCH_THEME.colors.textMuted}}>Cap opció disponible.</Text>
                            </View>
                        }
                        renderItem={({item}) => (
                            <TouchableOpacity 
                                style={{
                                    paddingVertical: 14, 
                                    paddingHorizontal: 16,
                                    borderRadius: 8,
                                    backgroundColor: (item.value === (modalTitle === 'Esport' ? sport : modalTitle === 'Lliga' ? selectedLeague : team)) 
                                        ? SKETCH_THEME.colors.primarySoft : 'transparent',
                                    marginBottom: 2
                                }}
                                onPress={() => {
                                    onSelectOption(item.value);
                                    closePickerModal();
                                }}
                            >
                                <Text style={{
                                    fontFamily: Platform.OS === 'web' ? 'Lora, serif' : undefined,
                                    fontSize: 16,
                                    color: SKETCH_THEME.colors.text
                                }}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </Animated.View>
          </View>
      </Modal>

    </SafeAreaView>
  );
}
