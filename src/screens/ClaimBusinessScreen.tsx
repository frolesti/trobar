import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { RouteProp } from '@react-navigation/native';

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
                    value={formData.name}
                    onChangeText={(t: string) => setFormData({...formData, name: t})}
                />
                
                <TextInput 
                    style={styles.input} 
                    placeholder="Telèfon de Contacte" 
                    keyboardType="phone-pad"
                    value={formData.phone}
                    onChangeText={(t: string) => setFormData({...formData, phone: t})}
                />
                
                <TextInput 
                    style={styles.input} 
                    placeholder="Email Corporatiu" 
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(t: string) => setFormData({...formData, email: t})}
                />

                <Text style={styles.sectionTitle}>Verificació</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="CIF / NIF del Negoci" 
                    value={formData.cif}
                    onChangeText={(t: string) => setFormData({...formData, cif: t})}
                />
                
                <TouchableOpacity style={styles.uploadButton}>
                    <Text style={styles.uploadButtonText}>📎 Adjuntar Factura o Document (Opcional)</Text>
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
    backgroundColor: '#F5F5F7',
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
      color: '#333',
      marginBottom: 8,
  },
  headerSubtitle: {
      fontSize: 16,
      color: '#666',
      lineHeight: 22,
  },
  formCard: {
      backgroundColor: 'white',
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
  },
  sectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#999',
      textTransform: 'uppercase',
      marginBottom: 12,
      marginTop: 8,
  },
  input: {
      backgroundColor: '#FAFAFA',
      borderWidth: 1,
      borderColor: '#E0E0E0',
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      marginBottom: 16,
  },
  uploadButton: {
      padding: 16,
      borderWidth: 1,
      borderColor: '#2196F3',
      borderStyle: 'dashed',
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 24,
      backgroundColor: '#E3F2FD',
  },
  uploadButtonText: {
      color: '#2196F3',
      fontWeight: '500',
  },
  submitButton: {
      backgroundColor: '#2196F3',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#2196F3',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
  },
  submitButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
  },
  cancelButton: {
      alignItems: 'center',
      padding: 16,
  },
  cancelButtonText: {
      color: '#666',
      fontWeight: '600',
  },
});

export default ClaimBusinessScreen;
