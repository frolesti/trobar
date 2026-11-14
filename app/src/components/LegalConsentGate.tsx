import React, { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Text from './AppText';
import UserNotice from './UserNotice';
import { AlertBannerHost } from './AlertBanner';
import { useAuth } from '../context/AuthContext';
import { PRIVACY, TERMS } from '../data/legalContent';
import { LegalDocument } from '../screens/Legal/LegalScreen';
import { canAcceptLegalDocuments } from '../utils/legalAcceptance';
import { EDITORIAL } from '../theme/editorialTheme';
import { getUserFriendlyError } from '../utils/errorHandler';

type DocumentKey = 'terms' | 'privacy';
const documents = [{ key: 'terms', label: 'Termes del Servei' }, { key: 'privacy', label: 'Política de Privacitat' }] as const;

function ConsentForm() {
    const { acceptLegalDocuments, logout } = useAuth();
    const [document, setDocument] = useState<DocumentKey | null>(null);
    const [read, setRead] = useState({ terms: false, privacy: false });
    const [accepted, setAccepted] = useState({ terms: false, privacy: false });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const operationPending = useRef(false);
    const canAccept = canAcceptLegalDocuments(read, accepted);

    const complete = async () => {
        if (operationPending.current) return;
        if (!canAccept) {
            setError('Llegeix tots dos documents i confirma’n l’acceptació abans de continuar.');
            return;
        }
        operationPending.current = true;
        setBusy(true);
        setError(null);
        try {
            await acceptLegalDocuments();
        } catch (failure) {
            console.info('[LegalConsent] No s’ha pogut desar l’acceptació', failure);
            setError(getUserFriendlyError(failure, 'No hem pogut desar l’acceptació. Comprova la connexió i torna-ho a provar.'));
        } finally {
            operationPending.current = false;
            setBusy(false);
        }
    };

    if (document) return <LegalDocument
        key={document}
        doc={document === 'terms' ? TERMS : PRIVACY}
        onBack={() => setDocument(null)}
        onReadComplete={() => setRead(previous => ({ ...previous, [document]: true }))}
    />;

    return <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.eyebrow}>Abans de continuar</Text>
            <Text accessibilityRole="header" style={styles.title}>El teu compte, amb tot clar.</Text>
            <Text style={styles.description}>Obre i llegeix fins al final els dos documents. Després, confirma que acceptes els Termes del Servei i que has llegit i acceptes la Política de Privacitat.</Text>
            {documents.map(item => <View key={item.key} style={styles.document}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Llegir ${item.label}`} onPress={() => setDocument(item.key)} disabled={busy} style={styles.readButton}>
                    <Feather name="file-text" size={22} color={EDITORIAL.matchday} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.documentTitle}>{item.label}</Text>
                        <Text style={styles.caption}>{read[item.key] ? 'Lectura completada' : 'Lectura pendent'}</Text>
                    </View>
                    <Text style={styles.readLink}>Llegir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Accepto ${item.label}`}
                    accessibilityState={{ checked: accepted[item.key], disabled: !read[item.key] || busy }}
                    aria-checked={accepted[item.key]}
                    disabled={!read[item.key] || busy}
                    onPress={() => setAccepted(previous => ({ ...previous, [item.key]: !previous[item.key] }))}
                    style={[styles.acceptRow, { opacity: read[item.key] ? 1 : 0.5 }]}
                >
                    <Feather name={accepted[item.key] ? 'check-square' : 'square'} size={22} color={EDITORIAL.matchday} />
                    <Text style={styles.acceptText}>{item.key === 'terms' ? 'He llegit i accepto els Termes del Servei.' : 'He llegit i accepto la Política de Privacitat.'}</Text>
                </TouchableOpacity>
            </View>)}
            {error && <UserNotice message={error} tone="error" />}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Desar l’acceptació i continuar" accessibilityState={{ disabled: !canAccept || busy, busy }} disabled={!canAccept || busy} onPress={complete} style={[styles.continueButton, { opacity: canAccept && !busy ? 1 : 0.5 }]}>
                <Text style={styles.continueText}>{busy ? 'Desant l’acceptació…' : 'Acceptar i continuar'}</Text>
            </TouchableOpacity>
            <Text style={styles.caption}>Guardarem les versions acceptades i la data al teu compte. No activa cap permís de localització ni comunicació comercial.</Text>
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.decline} onPress={async () => {
                if (operationPending.current) return;
                operationPending.current = true;
                setBusy(true);
                setError(null);
                try { await logout(); }
                catch (failure) { console.info('[LegalConsent] No s’ha pogut tancar la sessió', failure); setError(getUserFriendlyError(failure)); }
                finally { operationPending.current = false; setBusy(false); }
            }}>
                <Text style={styles.readLink}>No accepto: tancar sessió</Text>
            </TouchableOpacity>
        </ScrollView>
    </SafeAreaView>;
}

export default function LegalConsentGate() {
    const { user, isLoading, requiresRegistrationConsent } = useAuth();
    if (!user || !requiresRegistrationConsent || isLoading) return null;
    return <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {}}>
        <ConsentForm key={user.id} />
        <AlertBannerHost defaultPosition="bottom" />
    </Modal>;
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: EDITORIAL.background },
    content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, gap: 20 },
    eyebrow: { color: EDITORIAL.matchday, fontFamily: EDITORIAL.fontBold, fontSize: 13 },
    title: { color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: 32, lineHeight: 38 },
    description: { color: EDITORIAL.onBackgroundMuted, fontSize: 16, lineHeight: 24 },
    document: { borderWidth: 1, borderColor: EDITORIAL.borderOnBackground, borderRadius: 16, padding: 14 },
    readButton: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
    documentTitle: { color: EDITORIAL.onBackground, fontFamily: EDITORIAL.fontBold, fontSize: 16 },
    caption: { color: EDITORIAL.onBackgroundMuted, fontSize: 13, lineHeight: 19 },
    readLink: { color: EDITORIAL.matchday, fontFamily: EDITORIAL.fontBold, fontSize: 14, textDecorationLine: 'underline' },
    acceptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, marginTop: 10 },
    acceptText: { flex: 1, color: EDITORIAL.onBackground, fontSize: 14, lineHeight: 20 },
    continueButton: { minHeight: 52, borderRadius: 12, backgroundColor: EDITORIAL.matchday, justifyContent: 'center', alignItems: 'center', padding: 12 },
    continueText: { color: EDITORIAL.granaDeep, fontFamily: EDITORIAL.fontBold, fontSize: 16 },
    decline: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
