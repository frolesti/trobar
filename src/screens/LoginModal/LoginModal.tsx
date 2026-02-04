import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { ensureLoraOnWeb, sketchFontFamily, sketchShadow, SKETCH_THEME } from '../../theme/sketchTheme';
import { getUserFriendlyError } from '../../utils/errorHandler';
import styles from './LoginModal.styles';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LoginModal = ({ navigation }: Props) => {
    const { loginGoogle, loginApple, loginEmail, registerEmail, isLoading } = useAuth();

    // UI State
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    useEffect(() => {
        ensureLoraOnWeb();
    }, []);

    const handleGoogleLogin = async () => {
        setLocalError(null);
        try {
            await loginGoogle();
            navigation.goBack();
        } catch (e: any) {
            setLocalError(getUserFriendlyError(e));
        }
    };

    const handleAppleLogin = async () => {
        setLocalError(null);
        try {
            await loginApple();
            navigation.goBack();
        } catch (e: any) {
            setLocalError(getUserFriendlyError(e));
        }
    };

    const handleEmailSubmit = async () => {
        setLocalError(null);
        
        const cleanEmail = email.trim();
        const cleanFirstName = firstName.trim();
        const cleanLastName = lastName.trim();
        const fullName = `${cleanFirstName} ${cleanLastName}`.trim();

        if (!cleanEmail || !password) {
            setLocalError('Si us plau, omple tots els camps obligatoris.');
            return;
        }

        // Validació bàsica de format d'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            setLocalError("El format del correu electrònic no sembla vàlid.");
            return;
        }

        if (password.length < 6) {
            setLocalError('La contrasenya ha de tenir almenys 6 caràcters.');
            return;
        }

        if (isRegistering) {
            if (!cleanFirstName) {
                setLocalError('Necessitem el teu nom.');
                return;
            }
            if (!cleanLastName) {
                setLocalError('Necessitem el teu cognom.');
                return;
            }

            if (cleanFirstName.length < 2 || cleanLastName.length < 2) {
                setLocalError('El nom o cognom són massa curts.');
                return;
            }
        }

        try {
            if (isRegistering) {
                await registerEmail(cleanEmail, password, fullName);
                setVerificationSent(true);
            } else {
                await loginEmail(cleanEmail, password);
                navigation.goBack();
            }
        } catch (e: any) {
            setLocalError(getUserFriendlyError(e));
        }
    };

    const renderVerificationMessage = () => (
        <View style={{ width: '100%', alignItems: 'center' }}>
            <Feather name="mail" size={64} color={SKETCH_THEME.colors.primary} style={{ marginBottom: 20 }} />
            <Text style={styles.title}>Revisa el teu correu</Text>
            <Text style={[styles.subtitle, { marginBottom: 30 }]}>
                T'hem enviat un missatge de confirmació a <Text style={{ fontWeight: 'bold' }}>{email}</Text>. Recorda mirar la carpeta de correu brossa si no el trobes!
            </Text>
            <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.primaryButtonText}>Entesos!</Text>
            </TouchableOpacity>
        </View>
    );

    const renderEmailForm = () => (
        <View style={{ width: '100%' }}>
            <Text style={styles.formTitle}>{isRegistering ? 'Crear Compte' : 'Iniciar Sessió'}</Text>

            {isRegistering && (
                <>
                    <TextInput
                        style={styles.input}
                        placeholder="Nom"
                        placeholderTextColor={SKETCH_THEME.colors.textMuted}
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                        autoComplete="name-given" // iOS/Android autocomplete hint
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Cognoms"
                        placeholderTextColor={SKETCH_THEME.colors.textMuted}
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                        autoComplete="name-family"
                    />
                </>
            )}

            <TextInput
                style={styles.input}
                placeholder="Correu electrònic"
                placeholderTextColor={SKETCH_THEME.colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />

            <TextInput
                style={styles.input}
                placeholder="Contrasenya"
                placeholderTextColor={SKETCH_THEME.colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleEmailSubmit}
                disabled={isLoading}
            >
                {isLoading ? (
                    <LoadingIndicator size="small" />
                ) : (
                    <Text style={styles.primaryButtonText}>{isRegistering ? 'Registrar-se' : 'Entrar'}</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={styles.inlineLink}>
                <Text style={styles.inlineLinkText}>
                    {isRegistering ? 'Ja tens compte? Inicia sessió' : "No tens compte? Registra't"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowEmailForm(false)} style={styles.inlineLink}>
                <Text style={[styles.inlineLinkText, { color: SKETCH_THEME.colors.primary }]}>Tornar enrere</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>

                <View style={styles.panel}>
                    {localError && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>⚠️ {localError}</Text>
                        </View>
                    )}

                    {!showEmailForm && (
                        <View style={styles.header}>
                            <Text style={styles.emoji}>👋</Text>
                            <Text style={styles.title}>Benvingut a troBar</Text>
                            <Text style={styles.subtitle}>
                                Inicia sessió per guardar els teus bars preferits, rebre alertes de partits i molt més.
                            </Text>
                        </View>
                    )}

                    <View style={styles.actions}>
                        {verificationSent ? (
                            renderVerificationMessage()
                        ) : showEmailForm ? (
                            renderEmailForm()
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.button, styles.secondaryButton]}
                                    onPress={handleGoogleLogin}
                                    disabled={isLoading}
                                >
                                    <Text style={[styles.buttonText, { color: SKETCH_THEME.colors.text }]}>
                                        {isLoading ? 'Carregant...' : 'Continuar amb Google'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.button, styles.darkButton]}
                                    onPress={handleAppleLogin}
                                    disabled={isLoading}
                                >
                                    <Text style={[styles.buttonText, { color: 'white' }]}>Continuar amb Apple</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.emailLink} onPress={() => setShowEmailForm(true)}>
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



export default LoginModal;
