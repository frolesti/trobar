import React, { useState, useEffect, useRef } from 'react';
import { View, Image, TouchableOpacity, Platform, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, AppState } from 'react-native';
import Text from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useNavigation, useIsFocused, usePreventRemove, NavigationAction } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AppIcon from '../../components/AppIcon';
import * as ImagePicker from 'expo-image-picker';
import { updateUserProfile, uploadProfileImage } from '../../services/userService';
import { EDITORIAL } from '../../theme/editorialTheme';
import { StatusBar } from 'expo-status-bar';
import { showAlert } from '../../components/AlertBanner';
import { getUserFriendlyError } from '../../utils/errorHandler';
import { RootStackParamList } from '../../navigation/AppNavigator';
import ProfileSettings from './SettingsModal';
import styles from './ProfileScreen.styles';

export default function ProfileScreen() {
  const { user, logout, refreshProfile, isLoading: authLoading } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Profile'>>();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveError, setSaveError] = useState(false);
  const savePending = useRef<Promise<boolean> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const pendingNavigation = useRef<NavigationAction | null>(null);
  const isFocused = useIsFocused();

  // Redirigir al login si no autenticat, PERÒ esperar que la comprovació d'auth acabi
  // Si és bar_owner, redirigir al panell del bar
  useEffect(() => {
    if (!authLoading && !user) {
      navigation.navigate('Login');
    } else if (!authLoading && user?.role === 'bar_owner') {
      navigation.replace('BarDashboard');
    }
  }, [user, authLoading, navigation]);

  // Estat del formulari
  const [name, setName] = useState(user?.name || '');
  const [surname, setSurname] = useState(user?.surname || '');
  const [avatarUri, setAvatarUri] = useState(user?.avatar || '');
  const draft = useRef({ name: user?.name || '', surname: user?.surname || '' });
  const saved = useRef({ id: user?.id, name: user?.name || '', surname: user?.surname || '' });

  useEffect(() => {
    if (user) {
      const sameAccount = saved.current.id === user.id;
      const next = {
        name: sameAccount && draft.current.name.trim() !== saved.current.name ? draft.current.name : user.name || '',
        surname: sameAccount && draft.current.surname.trim() !== saved.current.surname ? draft.current.surname : user.surname || '',
      };
      saved.current = { id: user.id, name: user.name || '', surname: user.surname || '' };
      draft.current = next;
      setName(next.name);
      setSurname(next.surname);
    }
  }, [user?.id, user?.name, user?.surname]);

  useEffect(() => {
    setAvatarUri(user?.avatar || '');
  }, [user?.id, user?.avatar]);

  const hasChanges = name.trim() !== saved.current.name || surname.trim() !== saved.current.surname;
  usePreventRemove((hasChanges || isSaving) && !!user && !isLoggingOut, ({ data }) => {
    pendingNavigation.current = data.action;
    void saveData().then(success => { if (!success) pendingNavigation.current = null; });
  });
  useEffect(() => {
    if (!hasChanges && !isSaving && pendingNavigation.current) {
      const action = pendingNavigation.current;
      pendingNavigation.current = null;
      navigation.dispatch(action);
    }
  }, [hasChanges, isSaving, navigation]);

  const handleLogout = async () => {
    if (!await saveData()) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigation.reset({ index: 0, routes: [{ name: 'Map' }] });
    } catch (error) {
      showAlert({ tone: 'error', message: getUserFriendlyError(error, "No s'ha pogut tancar la sessió.") });
    } finally { if (mounted.current) setIsLoggingOut(false); }
  };

  const pickImage = async () => {
    if (!user || isLoading) return;
    const previousAvatar = user.avatar || '';
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setIsLoading(true);
      setAvatarUri(asset.uri);
      const downloadUrl = await uploadProfileImage(user.id, asset.uri, asset.mimeType);
      await updateUserProfile(user.id, { avatar: downloadUrl });
      setAvatarUri(downloadUrl);
      await refreshProfile();
    } catch (error) {
      setAvatarUri(previousAvatar);
      console.error('Error uploading image:', error);
      showAlert({ tone: 'error', message: getUserFriendlyError(error, "No s'ha pogut actualitzar la foto.") });
    } finally {
      setIsLoading(false);
    }
  };

  const saveData = (): Promise<boolean> => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (savePending.current) return savePending.current;
    if (!user) return Promise.resolve(false);
    if (!draft.current.name.trim()) {
      if (mounted.current) { setSaveError(true); setSaveStatus('El nom no pot quedar buit.'); }
      return Promise.resolve(false);
    }
    if (draft.current.name.trim() === saved.current.name && draft.current.surname.trim() === saved.current.surname) return Promise.resolve(true);
    const userId = user.id;
    if (mounted.current) { setIsSaving(true); setSaveError(false); setSaveStatus(''); }
    const task = (async () => {
      try {
        while (saved.current.id === userId) {
          const next = { name: draft.current.name.trim(), surname: draft.current.surname.trim() };
          if (!next.name) throw new Error('El nom no pot quedar buit.');
          if (next.name === saved.current.name && next.surname === saved.current.surname) break;
          await updateUserProfile(userId, next);
          if (saved.current.id !== userId) return false;
          saved.current = { id: userId, ...next };
          if (mounted.current) await refreshProfile();
        }
        if (saved.current.id !== userId) return false;
        if (mounted.current) setSaveStatus('Canvis desats');
        return true;
      } catch (error) {
        if (mounted.current) {
          setSaveError(true);
          setSaveStatus(!draft.current.name.trim() ? 'El nom no pot quedar buit.' : getUserFriendlyError(error, "No s'han pogut desar els canvis. Torna-ho a provar."));
        }
        return false;
      } finally {
        savePending.current = null;
        if (mounted.current) setIsSaving(false);
      }
    })();
    savePending.current = task;
    return task;
  };

  const persistLatest = useRef(saveData);
  persistLatest.current = saveData;
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') void persistLatest.current(); });
    return () => { mounted.current = false; if (saveTimer.current) clearTimeout(saveTimer.current); void persistLatest.current(); subscription.remove(); };
  }, []);

  const changeField = (field: 'name' | 'surname', value: string) => {
    draft.current = { ...draft.current, [field]: value };
    if (field === 'name') setName(value); else setSurname(value);
    setSaveStatus('');
    setSaveError(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persistLatest.current(); }, 600);
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
      {isFocused && <StatusBar style="light" />}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Tornar enrere" {...(Platform.OS === 'web' ? { title: 'Tornar enrere' } : {})}>
          <AppIcon name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.headerTitle}>Perfil</Text>
        <View style={styles.backButton} />
      </View>
      {authLoading || !user ? <ActivityIndicator color="#FFFFFF" style={{ marginTop: 32 }} /> : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
            <View style={styles.body}>
              <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} disabled={isLoading || isSaving} accessibilityRole="button" accessibilityLabel="Canviar la foto de perfil" accessibilityState={{ busy: isLoading, disabled: isLoading || isSaving }} {...(Platform.OS === 'web' ? { title: 'Canviar la foto de perfil' } : {})}>
                {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarPlaceholder]}><AppIcon name="user" size={40} color="#FFFFFF" /></View>}
                <View style={styles.changePhotoButton}>
                  {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <AppIcon name="camera" size={20} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
              <View style={styles.formContainer}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Dades personals</Text>
                <Text style={styles.label}>Nom</Text>
                <TextInput accessibilityLabel="Nom" style={styles.input} value={name} editable={!isLoggingOut} onChangeText={value => changeField('name', value)} onEndEditing={() => { void saveData(); }} placeholder="El teu nom" placeholderTextColor="rgba(255,255,255,0.6)" autoCapitalize="words" autoComplete="given-name" textContentType="givenName" selectionColor={EDITORIAL.matchday} />
                <Text style={styles.label}>Cognoms</Text>
                <TextInput accessibilityLabel="Cognoms" style={styles.input} value={surname} editable={!isLoggingOut} onChangeText={value => changeField('surname', value)} onEndEditing={() => { void saveData(); }} placeholder="Els teus cognoms" placeholderTextColor="rgba(255,255,255,0.6)" autoCapitalize="words" autoComplete="family-name" textContentType="familyName" selectionColor={EDITORIAL.matchday} />
                <Text style={styles.label}>Correu electrònic</Text>
                <Text selectable style={styles.value}>{user.email}</Text>
                <View style={styles.saveStatusRow}>
                  <Text accessibilityLiveRegion="polite" accessibilityRole={saveError && saveStatus ? 'alert' : undefined} style={styles.saveStatus}>{isSaving ? 'Desant...' : saveStatus}</Text>
                  {saveError && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reintentar desar el perfil" onPress={() => { void saveData(); }} style={styles.retryButton}><AppIcon name="refresh-cw" size={18} color="#FFFFFF" /></TouchableOpacity>}
                </View>
              </View>
              <ProfileSettings visible={isFocused} onLogout={() => { void handleLogout(); }} accountBusy={isLoading || isSaving || isLoggingOut} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
