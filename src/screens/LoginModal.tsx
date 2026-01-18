import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { StatusBar } from 'expo-status-bar';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LoginModal = ({ navigation }: Props) => {
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    await login();
    navigation.goBack(); // Tanca el modal un cop loguejat
  };

  return (
    <View style={styles.container}>
      {/* Botó de tancar */}
      <TouchableOpacity 
        style={styles.closeButton} 
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
            <Text style={styles.emoji}>👋</Text>
            <Text style={styles.title}>Benvingut a TroBar</Text>
            <Text style={styles.subtitle}>
            Inicia sessió per guardar els teus bars preferits, rebre alertes de partits i molt més.
            </Text>
        </View>

        <View style={styles.actions}>
            {/* Botó Google */}
            <TouchableOpacity 
                style={[styles.button, styles.googleButton]} 
                onPress={handleLogin}
                disabled={isLoading}
            >
                <Text style={[styles.buttonText, styles.googleText]}>
                    {isLoading ? 'Iniciant...' : 'Continuar amb Google'}
                </Text>
            </TouchableOpacity>

            {/* Botó Apple */}
            <TouchableOpacity style={[styles.button, styles.appleButton]} onPress={handleLogin}>
                <Text style={[styles.buttonText, styles.appleText]}>Continuar amb Apple</Text>
            </TouchableOpacity>

            {/* Link Email */}
            <TouchableOpacity style={styles.emailLink}>
                <Text style={styles.emailText}>Continuar amb Email</Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
            En continuar, acceptes els nostres Termes de Servei i Política de Privacitat.
        </Text>
      </View>
      <StatusBar style="light" />{/* Per si és modal full screen */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 24,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
      alignItems: 'center',
      marginBottom: 40,
  },
  emoji: {
      fontSize: 60,
      marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  actions: {
      width: '100%',
      gap: 16,
      marginBottom: 30,
  },
  button: {
      width: '100%',
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
  },
  googleButton: {
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#ddd',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
  },
  googleText: {
      color: '#333',
  },
  appleButton: {
      backgroundColor: 'black',
  },
  appleText: {
      color: 'white',
  },
  buttonText: {
      fontSize: 16,
      fontWeight: '600',
  },
  emailLink: {
      alignItems: 'center',
      padding: 10,
  },
  emailText: {
      color: '#2196F3',
      fontWeight: '600',
      fontSize: 16,
  },
  disclaimer: {
      fontSize: 12,
      color: '#999',
      textAlign: 'center',
      position: 'absolute',
      bottom: 20,
  }
});

export default LoginModal;
