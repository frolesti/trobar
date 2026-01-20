import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Platform, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { StatusBar } from 'expo-status-bar';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LoginModal = ({ navigation }: Props) => {
  const { loginGoogle, loginApple, loginEmail, registerEmail, isLoading } = useAuth();
  
  // UI State
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleGoogleLogin = async () => {
    setLocalError(null);
    try {
        await loginGoogle();
        navigation.goBack();
    } catch (e: any) {
        setLocalError(e.message || "No s'ha pogut iniciar sessió amb Google.");
    }
  };

  const handleAppleLogin = async () => {
      setLocalError(null);
      try {
          await loginApple();
          navigation.goBack();
      } catch (e: any) {
          console.error(e);
          // check for specific firebase error codes if needed
          if (e.code === 'auth/operation-not-allowed') {
             setLocalError("L'inici de sessió amb Apple no està habilitat en aquest moment.");
          } else {
             setLocalError("No s'ha pogut iniciar sessió amb Apple.");
          }
      }
  };

  const handleEmailSubmit = async () => {
      setLocalError(null);
      if (!email || !password) {
          setLocalError("Si us plau, omple tots els camps.");
          return;
      }
      if (isRegistering && !name) {
          setLocalError("Necessitem el teu nom.");
          return;
      }

      try {
          if (isRegistering) {
              await registerEmail(email, password, name);
          } else {
              await loginEmail(email, password);
          }
          navigation.goBack();
      } catch (error: any) {
          setLocalError(error.message || "Hi ha hagut un problema amb el correu.");
      }
  };

  // Sub-component: Formulari Email
  const renderEmailForm = () => (
      <View style={{width: '100%'}}>
          <Text style={styles.formTitle}>{isRegistering ? 'Crear Compte' : 'Iniciar Sessió'}</Text>
          
          {isRegistering && (
              <TextInput 
                style={styles.input}
                placeholder="Nom complet"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
          )}

          <TextInput 
            style={styles.input}
            placeholder="Correu electrònic"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput 
            style={styles.input}
            placeholder="Contrasenya"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity 
            style={[styles.button, styles.emailSubmitButton]} 
            onPress={handleEmailSubmit}
            disabled={isLoading}
          >
              {isLoading ? (
                  <ActivityIndicator color="white" />
              ) : (
                  <Text style={styles.emailSubmitText}>
                      {isRegistering ? 'Registrar-se' : 'Entrar'}
                  </Text>
              )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={{marginTop: 15, padding: 5}}>
              <Text style={{textAlign:'center', color:'#666'}}>
                  {isRegistering ? 'Ja tens compte? Inicia sessió' : 'No tens compte? Registra\'t'}
              </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowEmailForm(false)} style={{marginTop: 15, padding: 5}}>
              <Text style={{textAlign:'center', color:'#2196F3', fontSize: 14}}>Tornar enrere</Text>
          </TouchableOpacity>
      </View>
  );

  return (
    <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
    >
      <ScrollView contentContainerStyle={{flexGrow: 1}}>
        {/* Botó de tancar */}
        <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => navigation.goBack()}
        >
            <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.content}>
            
            {localError && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>⚠️ {localError}</Text>
                </View>
            )}

            {!showEmailForm && (
                <View style={styles.header}>
                    <Text style={styles.emoji}>👋</Text>
                    <Text style={styles.title}>Benvingut a TroBar</Text>
                    <Text style={styles.subtitle}>
                        Inicia sessió per guardar els teus bars preferits, rebre alertes de partits i molt més.
                    </Text>
                </View>
            )}

            <View style={styles.actions}>
                {showEmailForm ? renderEmailForm() : (
                    <>
                        {/* Botó Google */}
                        <TouchableOpacity 
                            style={[styles.button, styles.googleButton]} 
                            onPress={handleGoogleLogin}
                            disabled={isLoading}
                        >
                            <Text style={[styles.buttonText, styles.googleText]}>
                                {isLoading ? 'Carregant...' : 'Continuar amb Google'}
                            </Text>
                        </TouchableOpacity>

                        {/* Botó Apple */}
                        <TouchableOpacity 
                            style={[styles.button, styles.appleButton]} 
                            onPress={handleAppleLogin}
                            disabled={isLoading}
                        >
                            <Text style={[styles.buttonText, styles.appleText]}>Continuar amb Apple</Text>
                        </TouchableOpacity>

                        {/* Link Email */}
                        <TouchableOpacity 
                            style={styles.emailLink}
                            onPress={() => setShowEmailForm(true)}
                        >
                            <Text style={styles.emailText}>Continuar amb Email</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {!showEmailForm && (
                <Text style={styles.disclaimer}>
                    En continuar, acceptes els nostres Termes de Servei i Política de Privacitat.
                </Text>
            )}
        </View>
      </ScrollView>
      <StatusBar style="dark" />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
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
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 500,
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
      alignItems: 'center',
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
      marginTop: 10,
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
      marginTop: 'auto',
      marginBottom: 20,
  },
  
  // Form Styles
  formTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
      color: '#333'
  },
  input: {
      width: '100%',
      backgroundColor: '#f5f5f5',
      padding: 15,
      borderRadius: 12,
      marginBottom: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: '#eee'
  },
  emailSubmitButton: {
      backgroundColor: '#2196F3',
      marginTop: 10,
  },
  emailSubmitText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
  },
  errorContainer: {
    width: '100%',
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorText: {
      color: '#D32F2F',
      fontSize: 14,
      fontWeight: '500',
      textAlign: 'center'
  }
});

export default LoginModal;
