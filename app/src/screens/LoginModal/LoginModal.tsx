import React, { useEffect, useState, useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    PanResponder,
    Image,
} from 'react-native';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Feather, AntDesign, Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { ensureLoraOnWeb, SKETCH_THEME } from '../../theme/sketchTheme';
import { getUserFriendlyError } from '../../utils/errorHandler';
import { auth as fbAuth } from '../../config/firebase';
import { fetchSignInMethodsForEmail, sendPasswordResetEmail } from 'firebase/auth';
import { showAlert } from '../../components/AlertBanner';
import styles from './LoginModal.styles';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LoginModal = ({ navigation }: Props) => {
    const { loginGoogle, loginApple, loginEmail, registerEmail, isLoading } = useAuth();

    // Gest de lliscar a la dreta per tornar enrere
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Retornar true si és un lliscament horitzontal a la dreta (Enrere)
                return gestureState.dx > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderRelease: (_, gestureState) => {
                 if (gestureState.dx > 60) {
                     if (navigation.canGoBack()) navigation.goBack();
                     else navigation.replace('Map');
                 }
            }
        })
    ).current;

    // Estat de la UI
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [authInProgress, setAuthInProgress] = useState(false);

    // Estat del formulari
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    useEffect(() => {
        ensureLoraOnWeb();
    }, []);

    /** Redirecció post-login: bar_owner → BarDashboard, resta → goBack */
    const postLoginRedirect = async () => {
        const { getUserProfile } = require('../../services/userService');
        const { auth: fbAuth } = require('../../config/firebase');
        const currentUser = fbAuth.currentUser;
        if (currentUser) {
            const profile = await getUserProfile(currentUser.uid);
            if (profile?.role === 'bar_owner') {
                navigation.reset({ index: 0, routes: [{ name: 'BarDashboard' }] });
                return;
            }
        }
        navigation.goBack();
    };

    const handleGoogleLogin = async () => {
        setLocalError(null);
        setAuthInProgress(true);
        try {
            await loginGoogle();
            await postLoginRedirect();
        } catch (e: any) {
            setLocalError(getUserFriendlyError(e));
        } finally {
            setAuthInProgress(false);
        }
    };

    const handleAppleLogin = async () => {
        setLocalError(null);
        setAuthInProgress(true);
        try {
            await loginApple();
            await postLoginRedirect();
        } catch (e: any) {
            setLocalError(getUserFriendlyError(e));
        } finally {
            setAuthInProgress(false);
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
                // Comprovem si l'email ja existeix amb un altre proveïdor abans de registrar
                try {
                    const methods = await fetchSignInMethodsForEmail(fbAuth, cleanEmail);
                    if (methods.includes('google.com')) {
                        setLocalError("Aquest correu ja està registrat amb Google. Torna enrere i clica 'Continuar amb Google'.");
                        return;
                    }
                    if (methods.includes('apple.com')) {
                        setLocalError("Aquest correu ja està registrat amb Apple. Torna enrere i clica 'Continuar amb Apple'.");
                        return;
                    }
                    if (methods.includes('password')) {
                        setLocalError("Aquest correu ja té compte. Torna a 'Inicia sessió' i posa la contrasenya.");
                        setIsRegistering(false);
                        return;
                    }
                } catch {}
                await registerEmail(cleanEmail, password, fullName);
                setVerificationSent(true);
            } else {
                await loginEmail(cleanEmail, password);
                // Després del login, comprovar si és bar_owner via Firestore
                // El onAuthStateChanged actualitzarà user, però necessitem esperar-lo
                // Per tant, fem servir un listener temporal
                const { getUserProfile } = require('../../services/userService');
                const currentUser = fbAuth.currentUser;
                if (currentUser) {
                    const profile = await getUserProfile(currentUser.uid);
                    if (profile?.role === 'bar_owner') {
                        navigation.reset({ index: 0, routes: [{ name: 'BarDashboard' }] });
                        return;
                    }
                }
                navigation.goBack();
            }
        } catch (e: any) {
            // Si el login per email falla, comprovem si l'usuari ja existeix amb un altre proveïdor
            if (!isRegistering && (e?.code === 'auth/wrong-password' || e?.code === 'auth/user-not-found' || e?.code === 'auth/invalid-credential')) {
                try {
                    const methods = await fetchSignInMethodsForEmail(fbAuth, cleanEmail);
                    if (methods.includes('google.com')) {
                        setLocalError("Aquest correu està registrat amb Google. Torna enrere i clica 'Continuar amb Google'.");
                        return;
                    }
                    if (methods.includes('apple.com')) {
                        setLocalError("Aquest correu està registrat amb Apple. Torna enrere i clica 'Continuar amb Apple'.");
                        return;
                    }
                    if (methods.length === 0) {
                        setLocalError("Aquest correu no té compte. Clica 'No tens compte? Registra't' per crear-lo.");
                        return;
                    }
                } catch {}
            }
            setLocalError(getUserFriendlyError(e));
        }
    };

    const handlePasswordReset = async () => {
        setLocalError(null);
        const cleanEmail = email.trim();
        if (!cleanEmail) {
            setLocalError("Escriu el teu correu electrònic primer i tornem-ho a provar.");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            setLocalError("El format del correu electrònic no sembla vàlid.");
            return;
        }
        try {
            await sendPasswordResetEmail(fbAuth, cleanEmail);
            showAlert({ tone: 'success', message: `T'hem enviat un correu per restablir la contrasenya a ${cleanEmail}.` });
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
            <Text style={styles.formTitle}>{isRegistering ? 'Crea un compte' : 'Inicia sessió'}</Text>

            {isRegistering && (
                <>
                    <TextInput
                        style={styles.input}
                        placeholder="Nom"
                        placeholderTextColor={SKETCH_THEME.colors.textMuted}
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                        autoComplete="name-given" // Suggeriment d'autocompletar per a iOS/Android
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

            {!isRegistering && (
                <TouchableOpacity onPress={handlePasswordReset} style={[styles.inlineLink, { marginTop: 4 }]}>
                    <Text style={[styles.inlineLinkText, { fontSize: 13 }]}>
                        Has oblidat la contrasenya?
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.container}
            {...panResponder.panHandlers}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.panel}>
                    <View style={styles.topBar}>
                        <Image
                            source={require('../../../assets/img/logo-nav.jpg')}
                            style={styles.logoImg}
                            resizeMode="cover"
                        />
                        <TouchableOpacity 
                            style={styles.closeButton} 
                            onPress={() => {
                                if (showEmailForm && isRegistering) {
                                    // Des de registre → tornem al formulari de login per mail
                                    setIsRegistering(false);
                                    setLocalError(null);
                                    return;
                                }
                                if (showEmailForm) {
                                    // Des del login per mail → tornem al selector de proveïdor
                                    setShowEmailForm(false);
                                    setLocalError(null);
                                    return;
                                }
                                if (navigation.canGoBack()) {
                                    navigation.goBack();
                                } else {
                                    navigation.replace('Map');
                                }
                            }}
                        >
                            <Feather name="arrow-left" size={16} color={SKETCH_THEME.colors.textMuted} />
                            <Text style={styles.closeText}>Tornar</Text>
                        </TouchableOpacity>
                    </View>

                    {localError && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{localError}</Text>
                        </View>
                    )}

                    {!showEmailForm && (
                        <View style={styles.header}>
                            <Text style={styles.eyebrow}>Inicia sessió</Text>
                            <Text style={styles.title}>
                                Entra a <Text style={styles.titleItalic}>troBar</Text>
                            </Text>
                            <Text style={styles.subtitle}>
                                Guarda els teus bars preferits, rep alertes de partits del Barça i descobreix on viure el proper clàssic. Si encara no tens compte, el crearem automàticament la primera vegada.
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
                                    style={[styles.button, styles.googleButton]}
                                    onPress={handleGoogleLogin}
                                    disabled={isLoading}
                                    activeOpacity={0.85}
                                >
                                    <AntDesign name="google" size={20} color="#EA4335" style={styles.buttonIcon} />
                                    <Text style={[styles.buttonText, { color: SKETCH_THEME.colors.text }]}>
                                        {isLoading ? 'Carregant…' : 'Continuar amb Google'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.button, styles.appleButton]}
                                    onPress={handleAppleLogin}
                                    disabled={isLoading}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                                    <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Continuar amb Apple</Text>
                                </TouchableOpacity>

                                <View style={styles.dividerRow}>
                                    <View style={styles.dividerLine} />
                                    <Text style={styles.dividerText}>o</Text>
                                    <View style={styles.dividerLine} />
                                </View>

                                <TouchableOpacity
                                    style={styles.emailLinkRow}
                                    onPress={() => setShowEmailForm(true)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.emailLinkText}>
                                        Inicia sessió amb el teu mail
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </ScrollView>

            {!showEmailForm && !verificationSent && (
                <View style={styles.disclaimerFixed} pointerEvents="box-none">
                    <View style={styles.disclaimerContainer}>
                        <Text style={styles.disclaimer}>En continuar, acceptes els nostres </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('TermsOfService' as any)}>
                            <Text style={styles.linkText}>Termes de Servei</Text>
                        </TouchableOpacity>
                        <Text style={styles.disclaimer}> i </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy' as any)}>
                            <Text style={styles.linkText}>Política de Privacitat</Text>
                        </TouchableOpacity>
                        <Text style={styles.disclaimer}>.</Text>
                    </View>
                </View>
            )}
            <StatusBar style="dark" />

            {/* Overlay de bloqueig durant autenticació externa */}
            {authInProgress && (
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(255,255,255,0.85)',
                    justifyContent: 'center', alignItems: 'center', zIndex: 100,
                }}>
                    <LoadingIndicator size={100} />
                    <Text style={{
                        marginTop: 16, fontSize: 16, fontFamily: 'Lora',
                        color: SKETCH_THEME.colors.text, textAlign: 'center',
                    }}>Iniciant sessió...</Text>
                </View>
            )}
        </KeyboardAvoidingView>
    );
};



export default LoginModal;
