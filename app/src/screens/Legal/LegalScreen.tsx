import React, { useRef } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Linking } from 'react-native';
import Text from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EDITORIAL, ED_TYPE } from '../../theme/editorialTheme';
import AppIcon from '../../components/AppIcon';
import IconCredits from '../../components/IconCredits';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { webScreenContainer, webScreenScroll } from '../../utils/webScreenStyles';
import { CREATOR_URL, LegalDoc, TERMS } from '../../data/legalContent';
import { showAlert } from '../../components/AlertBanner';
import { useScreenLoading } from '../../context/SplashContext';

interface LegalScreenProps {
    doc: LegalDoc;
}

/**
 * Renderer compartit entre PrivacyPolicy.tsx i TermsOfService.tsx.
 * Llegeix la dada estructurada de app/src/data/legalContent.ts.
 */
export const LegalScreen: React.FC<LegalScreenProps> = ({ doc }) => {
    const navigation = useNavigation();
    return <LegalDocument doc={doc} onBack={() => navigation.goBack()} />;
};

export const LegalDocument = ({ doc, onBack, onReadComplete }: LegalScreenProps & { onBack: () => void; onReadComplete?: () => void }) => {
    useScreenLoading('LegalDocument', false);
    const viewportHeight = useRef(0);
    const contentHeight = useRef(0);
    const scrollOffset = useRef(0);
    const read = useRef(false);
    const checkRead = () => {
        if (!read.current && viewportHeight.current > 0 && contentHeight.current > 0 &&
            scrollOffset.current + viewportHeight.current >= contentHeight.current - 24) {
            read.current = true;
            onReadComplete?.();
        }
    };
    // Detecta emails al text i els converteix en enllaços tappables
    const renderText = (text: string) => {
        const splitter = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;
        const isEmail = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/;
        const parts = text.split(splitter);
        return parts.map((part, i) =>
            isEmail.test(part) ? (
                <Text key={i} style={[styles.inlineText, styles.link]} onPress={() => Linking.openURL(`mailto:${part}`)}>
                    {part}
                </Text>
            ) : (
                <Text key={i} style={styles.inlineText}>{part}</Text>
            )
        );
    };

    return (
        <SafeAreaView style={[styles.container, webScreenContainer]} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tornar enrere" onPress={onBack} style={styles.backButton}>
                    <AppIcon name="arrow-left" size={20} color={EDITORIAL.onBackground} />
                </TouchableOpacity>
                <Text style={styles.eyebrow}>Legal</Text>
            </View>
            <ScrollView
                testID="legal-document-scroll"
                contentContainerStyle={styles.content}
                style={webScreenScroll}
                scrollEventThrottle={32}
                onLayout={event => { viewportHeight.current = event.nativeEvent.layout.height; checkRead(); }}
                onContentSizeChange={(_width, height) => { contentHeight.current = height; checkRead(); }}
                onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; checkRead(); }}
            >
                <Text style={styles.title}>
                    {doc.title} {doc.titleAccent}
                </Text>
                <Text style={styles.lastUpdated}>Última actualització — {doc.lastUpdated}</Text>

                {doc.sections.map((section, i) => (
                    <View key={i} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        {section.blocks.map((block, j) => {
                            if (block.kind === 'p') {
                                return (
                                    <Text key={j} style={styles.sectionText}>
                                        {renderText(block.text)}
                                    </Text>
                                );
                            }
                            return (
                                <View key={j} style={styles.list}>
                                    {block.items.map((item, k) => (
                                        <View key={k} style={styles.listItem}>
                                            <Text style={styles.bullet}>•</Text>
                                            <Text style={[styles.sectionText, { flex: 1 }]}>
                                                {renderText(item)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            );
                        })}
                    </View>
                ))}

                {doc === TERMS && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Crèdits</Text>
                        <IconCredits style={{ color: EDITORIAL.onBackgroundMuted }} />
                    </View>
                )}
                <View style={styles.footer}>
                    <Text style={styles.sectionText}>fet per </Text>
                    <TouchableOpacity accessibilityRole="link" accessibilityLabel="Visitar el web de frolesti" onPress={() => {
                        Linking.openURL(CREATOR_URL).catch(error => {
                            console.info('[Legal] No s’ha pogut obrir el web de frolesti', error);
                            showAlert({ tone: 'error', message: 'No hem pogut obrir el web de frolesti. Torna-ho a provar.' });
                        });
                    }}>
                        <Text style={[styles.sectionText, styles.link]}>frolesti</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <StatusBar style="light" />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: EDITORIAL.background },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 14,
        backgroundColor: EDITORIAL.background,
    },
    backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    eyebrow: { fontFamily: EDITORIAL.fontBold, fontSize: 18, color: EDITORIAL.onBackground },
    content: {
        paddingHorizontal: 28, paddingTop: 32, paddingBottom: 32,
        maxWidth: 720, width: '100%', alignSelf: 'center',
    },
    title: { fontFamily: EDITORIAL.fontBold, color: EDITORIAL.onBackground, fontSize: 28, lineHeight: 34, marginBottom: 12 },
    lastUpdated: {
        ...ED_TYPE.caption, color: EDITORIAL.onBackgroundMuted, marginBottom: 32,
        letterSpacing: 0,
    },
    section: { marginBottom: 28 },
    sectionTitle: { ...ED_TYPE.h3, color: EDITORIAL.onBackground, marginBottom: 12 },
    sectionText: { ...ED_TYPE.body, color: EDITORIAL.onBackgroundMuted, marginBottom: 12 },
    inlineText: { ...ED_TYPE.body, color: EDITORIAL.onBackgroundMuted },
    list: { marginTop: 4, marginBottom: 4 },
    listItem: { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },
    bullet: { ...ED_TYPE.body, color: EDITORIAL.onBackground, marginRight: 10, marginTop: 0 },
    link: { color: EDITORIAL.onBackground, textDecorationLine: 'underline' },
    footer: { flexDirection: 'row', justifyContent: 'center', paddingTop: 24, borderTopWidth: 1, borderTopColor: EDITORIAL.borderOnBackground },
});
