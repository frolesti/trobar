import { EDITORIAL } from '../../theme/editorialTheme';
import React, { useEffect, useState, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, TouchableOpacity, View, PanResponder, Image } from 'react-native';
import Text from '../../components/AppText';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import AppIcon from '../../components/AppIcon';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../context/AuthContext';
import { ensureLoraOnWeb, SKETCH_THEME } from '../../theme/sketchTheme';
import { getUserFriendlyError, STANDARD_MESSAGES } from '../../utils/errorHandler';
import { auth as fbAuth } from '../../config/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { showAlert } from '../../components/AlertBanner';
import UserNotice from '../../components/UserNotice';
import styles from './LoginModal.styles';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScreenLoading } from '../../context/SplashContext';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LoginModal = ({ navigation }: Props) => {
    useScreenLoading('Login', false);
    const { user, loginGoogle, loginApple, loginEmail, registerEmail, isLoading } = useAuth();
    const isFocused = useIsFocused();

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
    const [resetBusy, setResetBusy] = useState(false);
    const operationPending = useRef(false);

    useEffect(() => {
        if (isFocused && user && !isLoading && !authInProgress) {
            navigation.replace(user.role === 'bar_owner' ? 'BarDashboard' : 'Map');
        }
    }, [isFocused, user?.id, user?.role, isLoading, authInProgress, navigation]);

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
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.replace('Map');
    };

    const handleGoogleLogin = async () => {
        if (operationPending.current) return;
        operationPending.current = true;
        setLocalError(null);
        setAuthInProgress(true);
        try {
            const signedIn = await loginGoogle();
            if (signedIn) await postLoginRedirect();
        } catch (e) {
            setLocalError(getUserFriendlyError(e));
        } finally {
            operationPending.current = false;
            setAuthInProgress(false);
        }
    };

    const handleAppleLogin = async () => {
        if (operationPending.current) return;
        operationPending.current = true;
        setLocalError(null);
        setAuthInProgress(true);
        try {
            await loginApple();
            await postLoginRedirect();
        } catch (e) {
            setLocalError(getUserFriendlyError(e));
        } finally {
            operationPending.current = false;
            setAuthInProgress(false);
        }
    };

    const handleEmailSubmit = async () => {
        if (operationPending.current) return;
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

        operationPending.current = true;
        setAuthInProgress(true);
        try {
            if (isRegistering) {
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
        } catch (e) {
            setLocalError(getUserFriendlyError(e));
        } finally { operationPending.current = false; setAuthInProgress(false); }
    };

    const handlePasswordReset = async () => {
        if (operationPending.current) return;
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
        operationPending.current = true;
        setResetBusy(true);
        try {
            fbAuth.languageCode = 'ca';
            await sendPasswordResetEmail(fbAuth, cleanEmail);
            showAlert({ tone: 'success', message: STANDARD_MESSAGES.resetSent });
        } catch (e) {
            console.info('[Auth] Password recovery unavailable', e);
            if (e && typeof e === 'object' && 'code' in e && e.code === 'auth/user-not-found') showAlert({ tone: 'success', message: STANDARD_MESSAGES.resetSent });
            else setLocalError(getUserFriendlyError(e));
        } finally { operationPending.current = false; setResetBusy(false); }
    };

    const renderVerificationMessage = () => (
        <View style={{ width: '100%', alignItems: 'center' }}>
            <AppIcon name="mail" size={64} color={SKETCH_THEME.colors.primary} style={{ marginBottom: 20 }} />
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
                disabled={isLoading || authInProgress || resetBusy}
            >
                {isLoading || authInProgress ? (
                    <LoadingIndicator size="small" />
                ) : (
                    <Text style={styles.primaryButtonText}>{isRegistering ? 'Registrar-se' : 'Entrar'}</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity disabled={isLoading || authInProgress || resetBusy} onPress={() => setIsRegistering(!isRegistering)} style={styles.inlineLink}>
                <Text style={styles.inlineLinkText}>
                    {isRegistering ? 'Ja tens compte? Inicia sessió' : "No tens compte? Registra't"}
                </Text>
            </TouchableOpacity>

            {!isRegistering && (
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: resetBusy, disabled: resetBusy || isLoading || authInProgress }} disabled={resetBusy || isLoading || authInProgress} onPress={handlePasswordReset} style={[styles.inlineLink, { marginTop: 4, opacity: resetBusy ? 0.6 : 1 }]}>
                    <Text style={[styles.inlineLinkText, { fontSize: 14 }]}>
                        {resetBusy ? 'Enviant les instruccions…' : 'Has oblidat la contrasenya?'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.container}
            {...panResponder.panHandlers}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.panel}>
                    <View style={styles.topBar}>
                        <Image
                            source={require('../../../../assets/app/img/logo/mascot-open-cloche.png')}
                            style={styles.logoImg}
                            resizeMode="contain"
                        />
                        <TouchableOpacity 
                            style={[styles.closeButton, styles.topCloseButton]}
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
                            <Text style={styles.closeText}>Tornar</Text>
                        </TouchableOpacity>
                    </View>

                    {localError && (
                        <View style={{ width: '100%', marginBottom: 16 }}><UserNotice tone="error" message={localError} onDismiss={() => setLocalError(null)} /></View>
                    )}

                    {!showEmailForm && (
                        <View style={styles.header}>
                            <Text accessibilityRole="header" style={[styles.title, styles.wordmark]} numberOfLines={1}>troBar</Text>
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
                                    accessibilityRole="button"
                                    accessibilityLabel="Continuar amb Google"
                                    style={[styles.button, styles.googleButton]}
                                    onPress={handleGoogleLogin}
                                    disabled={isLoading || authInProgress || resetBusy}
                                    activeOpacity={0.85}
                                >
                                    <AppIcon name="google" size={20} color="#EA4335" style={styles.buttonIcon} />
                                    <Text style={[styles.buttonText, { color: SKETCH_THEME.colors.text }]}>
                                        {isLoading ? 'Carregant…' : 'Continuar amb Google'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Continuar amb Apple"
                                    style={[styles.button, styles.appleButton]}
                                    onPress={handleAppleLogin}
                                    disabled={isLoading || authInProgress || resetBusy}
                                    activeOpacity={0.85}
                                >
                                    <AppIcon name="logo-apple" size={20} color="#FFFFFF" style={styles.buttonIcon} />
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
                                        Continuar amb el meu correu
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
            {!showEmailForm && !verificationSent && (
                <View style={styles.disclaimerFixed}>
                    <View style={styles.disclaimerContainer}>
                        <Text style={styles.disclaimer}>Si és el primer accés, crearem el teu compte. Abans d’utilitzar-lo hauràs de llegir i acceptar els </Text>
                        <TouchableOpacity accessibilityRole="link" onPress={() => navigation.navigate('TermsOfService')}>
                            <Text style={styles.linkText}>Termes de Servei</Text>
                        </TouchableOpacity>
                        <Text style={styles.disclaimer}> i </Text>
                        <TouchableOpacity accessibilityRole="link" onPress={() => navigation.navigate('PrivacyPolicy')}>
                            <Text style={styles.linkText}>Política de Privacitat</Text>
                        </TouchableOpacity>
                        <Text style={styles.disclaimer}>.</Text>
                    </View>
                </View>
            )}
                </View>
            </ScrollView>
            <StatusBar style="light" />

            {/* Overlay de bloqueig durant autenticació externa */}
            {authInProgress && (
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: EDITORIAL.background,
                    justifyContent: 'center', alignItems: 'center', zIndex: 100,
                }}>
                    <LoadingIndicator size={100} />
                    <Text style={{
                        marginTop: 16, fontSize: 16, fontFamily: EDITORIAL.fontRegular,
                        color: EDITORIAL.onBackground, textAlign: 'center',
                    }}>Iniciant sessió...</Text>
                </View>
            )}
        </KeyboardAvoidingView>
        </SafeAreaView>
    );
};



export default LoginModal;
