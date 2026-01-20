import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ensureLoraOnWeb, sketchFontFamily, sketchShadow, SKETCH_THEME } from '../theme/sketchTheme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClaimBusiness'>;
  route: RouteProp<RootStackParamList, 'ClaimBusiness'>;
};

const ClaimBusinessScreen = ({ navigation, route }: Props) => {
  const { barId, barName } = route.params;
  const [formData, setFormData] = useState({
      name: '',
      phone: '',
      email: '',
      cif: ''
  });

    useEffect(() => {
        ensureLoraOnWeb();
    }, []);

  const handleSubmit = () => {
    // Aquí aniria la lògica d'enviar al backend
    Alert.alert(
        "Sol·licitud Enviada",
        "Hem rebut la teva sol·licitud. Revisarem la documentació i et contactarem en 24-48h.",
        [
            { text: "Entesos", onPress: () => navigation.goBack() }
        ]
    );
  };

  return (
    <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
    >
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Gestiona el teu negoci</Text>
                <Text style={styles.headerSubtitle}>
                    Reclama la propietat de <Text style={{fontWeight: 'bold'}}>{barName}</Text> per gestionar horaris, publicar partits i atraure més clients.
                </Text>
            </View>

            <View style={styles.formCard}>
                <Text style={styles.sectionTitle}>Les teves dades</Text>
                
                <TextInput 
                    style={styles.input} 
                    placeholder="El teu Nom Complet" 
                    placeholderTextColor={SKETCH_THEME.colors.textMuted}
                    value={formData.name}
                    onChangeText={(t: string) => setFormData({...formData, name: t})}
                />
                
                <TextInput 
                    style={styles.input} 
                    placeholder="Telèfon de Contacte" 
                    keyboardType="phone-pad"
                    placeholderTextColor={SKETCH_THEME.colors.textMuted}
                    value={formData.phone}
                    onChangeText={(t: string) => setFormData({...formData, phone: t})}
                />
                
                <TextInput 
                    style={styles.input} 
                    placeholder="Email Corporatiu" 
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={SKETCH_THEME.colors.textMuted}
                    value={formData.email}
                    onChangeText={(t: string) => setFormData({...formData, email: t})}
                />

                <Text style={styles.sectionTitle}>Verificació</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="CIF / NIF del Negoci" 
                    placeholderTextColor={SKETCH_THEME.colors.textMuted}
                    value={formData.cif}
                    onChangeText={(t: string) => setFormData({...formData, cif: t})}
                />
                
                <TouchableOpacity style={styles.uploadButton}>
                    <View style={styles.uploadRow}>
                        <Feather name="paperclip" size={16} color={SKETCH_THEME.colors.primary} />
                        <Text style={styles.uploadButtonText}>Adjuntar Factura o Document (Opcional)</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                    <Text style={styles.submitButtonText}>Enviar Sol·licitud</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
                <Text style={styles.cancelButtonText}>Cancel·lar</Text>
            </TouchableOpacity>
        </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SKETCH_THEME.colors.bg,
  },
  scrollContent: {
      padding: 20,
      paddingBottom: 40,
  },
  header: {
      marginBottom: 24,
      marginTop: 20,
  },
  headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: SKETCH_THEME.colors.text,
      marginBottom: 8,
      fontFamily: sketchFontFamily(),
  },
  headerSubtitle: {
      fontSize: 16,
      color: SKETCH_THEME.colors.textMuted,
      lineHeight: 22,
      fontFamily: sketchFontFamily(),
  },
  formCard: {
      backgroundColor: SKETCH_THEME.colors.uiBg,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: SKETCH_THEME.colors.border,
      ...(sketchShadow() as object),
  },
  sectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: SKETCH_THEME.colors.accent,
      textTransform: 'uppercase',
      marginBottom: 12,
      marginTop: 8,
      fontFamily: sketchFontFamily(),
  },
  input: {
      backgroundColor: SKETCH_THEME.colors.card,
      borderWidth: 1,
      borderColor: SKETCH_THEME.colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      marginBottom: 16,
      color: SKETCH_THEME.colors.text,
      fontFamily: sketchFontFamily(),
  },
  uploadButton: {
      padding: 16,
      borderWidth: 1,
      borderColor: 'rgba(211, 47, 47, 0.45)',
      borderStyle: 'dashed',
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 24,
      backgroundColor: SKETCH_THEME.colors.primarySoft,
  },
  uploadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
  },
  uploadButtonText: {
      color: SKETCH_THEME.colors.primary,
      fontWeight: '700',
      fontFamily: sketchFontFamily(),
  },
  submitButton: {
      backgroundColor: SKETCH_THEME.colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(211, 47, 47, 0.35)',
      ...(sketchShadow() as object),
  },
  submitButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
      fontFamily: sketchFontFamily(),
  },
  cancelButton: {
      alignItems: 'center',
      padding: 16,
  },
  cancelButtonText: {
      color: SKETCH_THEME.colors.textMuted,
      fontWeight: '700',
      fontFamily: sketchFontFamily(),
  },
});

export default ClaimBusinessScreen;
