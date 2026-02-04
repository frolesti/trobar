import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { ensureLoraOnWeb, SKETCH_THEME } from '../../theme/sketchTheme';
import { submitBusinessClaim } from '../../services/businessService';
import { getUserFriendlyError } from '../../utils/errorHandler';
import styles from './ClaimBusinessScreen.styles';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClaimBusiness'>;
  route: RouteProp<RootStackParamList, 'ClaimBusiness'>;
};

const ClaimBusinessScreen = ({ navigation, route }: Props) => {
  const { barId, barName } = route.params;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
      name: '',
      phone: '',
      email: '',
      cif: ''
  });

    useEffect(() => {
        ensureLoraOnWeb();
    }, []);

  const handleSubmit = async () => {
    // Validació bàsica
    if (!formData.name || !formData.phone || !formData.email) {
        Alert.alert("Falten dades", "Si us plau, omple com a mínim el nom, telèfon i email.");
        return;
    }

    setIsSubmitting(true);
    
    // Fem servir el nou servei estandaritzat
    const result = await submitBusinessClaim(barId, barName, formData);
    
    setIsSubmitting(false);

    if (result.success) {
        Alert.alert(
            "Sol·licitud Enviada",
            "Hem rebut la teva sol·licitud correctament. Revisarem la documentació i et contactarem en 24-48h.",
            [{ text: "Entesos", onPress: () => navigation.goBack() }]
        );
    } else {
        // En cas d'error, el 'result.error' ja ve traduït per getUserFriendlyError des del servei
        Alert.alert("Error", result.error || "No s'ha pogut enviar la sol·licitud.");
    }
  };

  const Wrapper = Platform.OS === 'web' ? View : KeyboardAvoidingView;
  const wrapperProps = Platform.OS === 'web' ? { style: { flex: 1, height: '100vh', overflow: 'hidden' } } : { behavior: Platform.OS === "ios" ? "padding" : "height", style: styles.container };

  return (
    // @ts-ignore
    <Wrapper {...wrapperProps}>
        <ScrollView 
            contentContainerStyle={styles.scrollContent}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={true}
        >
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

                <TouchableOpacity 
                    style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]} 
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                >
                    <Text style={styles.submitButtonText}>
                        {isSubmitting ? 'Enviant...' : 'Enviar Sol·licitud'}
                    </Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
                <Text style={styles.cancelButtonText}>Cancel·lar</Text>
            </TouchableOpacity>
        </ScrollView>
    {/* @ts-ignore */}
    </Wrapper>
  );
};



export default ClaimBusinessScreen;
