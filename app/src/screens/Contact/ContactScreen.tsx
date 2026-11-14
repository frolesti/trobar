import React, { useRef, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import Text from '../../components/AppText';
import AppIcon from '../../components/AppIcon';
import UserNotice from '../../components/UserNotice';
import { EDITORIAL } from '../../theme/editorialTheme';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ContactKind, submitContact } from '../../services/contactService';
import { getUserFriendlyError } from '../../utils/errorHandler';

const KINDS: { value: ContactKind; label: string }[] = [
    { value: 'issue', label: 'Incidència' }, { value: 'improvement', label: 'Millora' }, { value: 'other', label: 'Altres' },
];

export default function ContactScreen() {
    const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Contact'>>();
    const { user } = useAuth();
    const [kind, setKind] = useState<ContactKind>('issue');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [consent, setConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [receipt, setReceipt] = useState('');
    const requestId = useRef<string | null>(null);
    const pending = useRef(false);
    const changed = () => { requestId.current = null; setError(''); };
    const send = async () => {
        if (pending.current) return;
        if (!user) { setError('Inicia sessió per enviar una consulta.'); return; }
        if (subject.trim().length < 3 || subject.trim().length > 120 || message.trim().length < 20 || message.trim().length > 5000) {
            setError('Escriu un assumpte de 3 a 120 caràcters i un missatge de 20 a 5.000 caràcters.');
            return;
        }
        if (!consent) { setError('Cal acceptar el tractament de la consulta.'); return; }
        pending.current = true;
        setBusy(true);
        setError('');
        try {
            requestId.current ??= randomUUID();
            const id = await submitContact({
                requestId: requestId.current, kind, subject: subject.trim(), message: message.trim(), consent,
                platform: Platform.OS, appVersion: Constants.expoConfig?.version || 'unknown',
            });
            setReceipt(id);
        } catch (failure) {
            console.info('[Contact] Error enviant la consulta', failure);
            setError(getUserFriendlyError(failure, "No s'ha pogut enviar la consulta. El text es conserva perquè puguis tornar-ho a provar."));
        } finally { pending.current = false; setBusy(false); }
    };
    return (
        <SafeAreaView style={styles.page}>
            <StatusBar style="light" />
            <View style={styles.header}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tornar enrere" disabled={busy} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Map')} style={styles.back}>
                    <AppIcon name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <Text accessibilityRole="header" style={styles.title}>Contacte</Text>
                <View style={styles.back} />
            </View>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
                    <View style={styles.body}>
                        <Text style={styles.heading}>Ens ajudes a millorar troBar?</Text>
                        <Text style={styles.description}>Explica'ns una incidència o proposa una millora de la beta. La consulta arriba directament a la bústia privada de l'equip.</Text>
                        {receipt ? (
                            <View accessibilityLiveRegion="polite" style={styles.confirmation}>
                                <Text style={styles.title}>Consulta enviada</Text>
                                <Text style={styles.description}>Hem rebut el teu missatge. Guarda aquesta referència: {receipt}</Text>
                                <Text style={styles.description}>Farem servir el correu del teu compte per respondre't.</Text>
                            </View>
                        ) : !user ? (
                            <TouchableOpacity style={styles.submit} accessibilityRole="button" onPress={() => navigation.navigate('Login')}>
                                <Text style={styles.submitText}>Inicia sessió per contactar</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <Text style={styles.label}>Tipus de consulta</Text>
                                <View accessibilityRole="radiogroup" accessibilityLabel="Tipus de consulta" style={styles.options}>
                                    {KINDS.map(option => <TouchableOpacity key={option.value} accessibilityRole="radio" accessibilityState={{ checked: kind === option.value, disabled: busy }} disabled={busy} onPress={() => { changed(); setKind(option.value); }} style={[styles.option, kind === option.value && styles.selected]}>
                                        <Text style={{ color: kind === option.value ? EDITORIAL.granaDeep : '#FFFFFF' }}>{option.label}</Text>
                                    </TouchableOpacity>)}
                                </View>
                                <Text style={styles.label}>Assumpte</Text>
                                <TextInput accessibilityLabel="Assumpte" value={subject} editable={!busy} maxLength={120} onChangeText={value => { changed(); setSubject(value); }} style={styles.input} placeholder="Què ens vols explicar?" placeholderTextColor={EDITORIAL.onBackgroundMuted} selectionColor={EDITORIAL.matchday} />
                                <Text style={styles.label}>Missatge</Text>
                                <TextInput accessibilityLabel="Missatge" value={message} editable={!busy} multiline maxLength={5000} onChangeText={value => { changed(); setMessage(value); }} style={[styles.input, styles.message]} placeholder="Explica què ha passat, com ho podem reproduir o què milloraries. No hi incloguis contrasenyes ni dades sensibles." placeholderTextColor={EDITORIAL.onBackgroundMuted} selectionColor={EDITORIAL.matchday} textAlignVertical="top" />
                                <Text style={styles.description}>{message.length} / 5.000 · mínim 20 caràcters</Text>
                                <Text style={styles.description}>{user.email ? `Correu del compte per poder respondre: ${user.email}` : 'La consulta quedarà vinculada al teu compte.'}</Text>
                                <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: consent, disabled: busy }} disabled={busy} onPress={() => { changed(); setConsent(value => !value); }} style={styles.consent}>
                                    <View style={[styles.checkbox, consent && styles.selected]}>{consent && <AppIcon name="check" size={18} color={EDITORIAL.granaDeep} />}</View>
                                    <Text style={[styles.description, { flex: 1 }]}>Accepto que l'equip tracti les dades d'aquesta consulta per gestionar-la.</Text>
                                </TouchableOpacity>
                                <TouchableOpacity accessibilityRole="link" disabled={busy} onPress={() => navigation.navigate('PrivacyPolicy')} style={{ minHeight: 44, justifyContent: 'center' }}>
                                    <Text style={styles.link}>Política de privacitat</Text>
                                </TouchableOpacity>
                                {!!error && <UserNotice tone="error" message={error} />}
                                <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={send} style={[styles.submit, busy && { opacity: 0.6 }]}>
                                    {busy ? <ActivityIndicator color={EDITORIAL.granaDeep} /> : <Text style={styles.submitText}>Enviar consulta</Text>}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: EDITORIAL.granaDeep },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { color: '#FFFFFF', fontFamily: EDITORIAL.fontBold, fontSize: 18 },
    heading: { color: '#FFFFFF', fontFamily: EDITORIAL.fontBold, fontSize: 24, lineHeight: 30, marginBottom: 8 },
    content: { padding: 24, paddingBottom: 32 },
    body: { width: '100%', maxWidth: 520, alignSelf: 'center' },
    description: { color: EDITORIAL.onBackgroundMuted, fontSize: 14, lineHeight: 20 },
    label: { color: '#FFFFFF', fontFamily: EDITORIAL.fontBold, marginTop: 20, marginBottom: 8 },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    option: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: EDITORIAL.borderOnBackground },
    selected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
    input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: EDITORIAL.borderOnBackground, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', color: '#FFFFFF', fontFamily: EDITORIAL.fontRegular, fontSize: 16 },
    message: { minHeight: 160, marginBottom: 8 },
    consent: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, marginTop: 16 },
    checkbox: { width: 24, height: 24, borderWidth: 1, borderRadius: 4, borderColor: EDITORIAL.borderOnBackground, alignItems: 'center', justifyContent: 'center' },
    link: { color: '#FFFFFF', textDecorationLine: 'underline' },
    error: { color: '#FFD2D9', marginVertical: 12, lineHeight: 20 },
    submit: { minHeight: 48, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    submitText: { color: EDITORIAL.granaDeep, fontFamily: EDITORIAL.fontBold, fontSize: 16 },
    confirmation: { marginTop: 24, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: EDITORIAL.borderOnBackground, gap: 12 },
});
