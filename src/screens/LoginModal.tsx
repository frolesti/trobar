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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { ensureLoraOnWeb, sketchFontFamily, sketchShadow, SKETCH_THEME } from '../theme/sketchTheme';

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
    const [name, setName] = useState('');

    useEffect(() => {
        ensureLoraOnWeb();
    }, []);

    const handleGoogleLogin = async () => {
        setLocalError(null);
        try {
            await loginGoogle();
            navigation.goBack();
        } catch (e: any) {
            setLocalError(e?.message || "No s'ha pogut iniciar sessió amb Google.");
        }
    };

    const handleAppleLogin = async () => {
        setLocalError(null);
        try {
            await loginApple();
            navigation.goBack();
        } catch (e: any) {
            if (e?.code === 'auth/operation-not-allowed') {
                setLocalError("L'inici de sessió amb Apple no està habilitat en aquest moment.");
            } else {
                setLocalError("No s'ha pogut iniciar sessió amb Apple.");
            }
        }
    };

    const handleEmailSubmit = async () => {
        setLocalError(null);

        if (!email || !password) {
            setLocalError('Si us plau, omple tots els camps.');
            return;
        }
        if (isRegistering && !name) {
            setLocalError('Necessitem el teu nom.');
            return;
        }

        try {
            if (isRegistering) {
                setVerificationSent(true);
            } else {
                await loginEmail(email, password);
                navigation.goBack();
            }
            navigation.goBack();
        } catch (e: any) {
            setLocalError(e?.message || 'Hi ha hagut un problema amb el correu.');
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
                <TextInput
                    style={styles.input}
                    placeholder="Nom complet"
                    placeholderTextColor={SKETCH_THEME.colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                />
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
                    <ActivityIndicator color="white" />
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
                            <Text style={styles.title}>Benvingut a TroBar</Text>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: SKETCH_THEME.colors.bg,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 18,
        justifyContent: 'center',
    },
    panel: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: 420,
        backgroundColor: SKETCH_THEME.colors.uiBg,
        borderRadius: 22,
        padding: 22,
        borderWidth: 1,
        borderColor: SKETCH_THEME.colors.border,
        ...(sketchShadow() as object),
    },
    closeButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 48 : 18,
        right: 18,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: SKETCH_THEME.colors.uiBg,
        borderWidth: 1,
        borderColor: SKETCH_THEME.colors.border,
        ...(sketchShadow() as object),
    },
    closeText: {
        fontSize: 18,
        fontWeight: '800',
        color: SKETCH_THEME.colors.text,
        fontFamily: sketchFontFamily(),
    },
    header: {
        alignItems: 'center',
        marginBottom: 18,
    },
    emoji: {
        fontSize: 56,
        marginBottom: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: SKETCH_THEME.colors.text,
        textAlign: 'center',
        fontFamily: sketchFontFamily(),
    },
    subtitle: {
        marginTop: 10,
        fontSize: 15,
        color: SKETCH_THEME.colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
        fontFamily: sketchFontFamily(),
    },
    actions: {
        marginTop: 16,
        width: '100%',
    },
    button: {
        width: '100%',
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: SKETCH_THEME.colors.border,
        ...(sketchShadow() as object),
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '800',
        fontFamily: sketchFontFamily(),
    },
    secondaryButton: {
        backgroundColor: SKETCH_THEME.colors.card,
    },
    darkButton: {
        backgroundColor: SKETCH_THEME.colors.text,
        borderColor: 'rgba(62, 39, 35, 0.55)',
    },
    primaryButton: {
        backgroundColor: SKETCH_THEME.colors.primary,
        borderColor: 'rgba(211, 47, 47, 0.35)',
    },
    primaryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
        fontFamily: sketchFontFamily(),
    },
    emailLink: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    emailText: {
        color: SKETCH_THEME.colors.primary,
        fontSize: 16,
        fontWeight: '700',
        fontFamily: sketchFontFamily(),
    },
    disclaimer: {
        marginTop: 18,
        fontSize: 12,
        color: SKETCH_THEME.colors.accent,
        textAlign: 'center',
        lineHeight: 18,
        fontFamily: sketchFontFamily(),
    },
    errorContainer: {
        width: '100%',
        padding: 12,
        marginBottom: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(198, 40, 40, 0.10)',
        borderWidth: 1,
        borderColor: 'rgba(198, 40, 40, 0.20)',
    },
    errorText: {
        color: SKETCH_THEME.colors.danger,
        fontSize: 14,
        lineHeight: 20,
        fontFamily: sketchFontFamily(),
    },
    formTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: SKETCH_THEME.colors.text,
        marginBottom: 14,
        textAlign: 'center',
        fontFamily: sketchFontFamily(),
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: SKETCH_THEME.colors.border,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: SKETCH_THEME.colors.card,
        color: SKETCH_THEME.colors.text,
        fontFamily: sketchFontFamily(),
    },
    inlineLink: {
        marginTop: 12,
        padding: 6,
    },
    inlineLinkText: {
        textAlign: 'center',
        color: SKETCH_THEME.colors.textMuted,
        fontFamily: sketchFontFamily(),
    },
});

export default LoginModal;
