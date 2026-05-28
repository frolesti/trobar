import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EDITORIAL, ED_TYPE } from '../../theme/editorialTheme';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { webScreenContainer, webScreenScroll } from '../../utils/webScreenStyles';
import { LegalDoc } from '../../data/legalContent';

interface LegalScreenProps {
    doc: LegalDoc;
}

/**
 * Renderer compartit entre PrivacyPolicy.tsx i TermsOfService.tsx.
 * Llegeix la dada estructurada de app/src/data/legalContent.ts.
 */
export const LegalScreen: React.FC<LegalScreenProps> = ({ doc }) => {
    const navigation = useNavigation();

    // Detecta emails al text i els converteix en enllaços tappables
    const renderText = (text: string) => {
        const splitter = /([\w.+-]+@[\w-]+\.[\w.-]+)/g;
        const isEmail = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;
        const parts = text.split(splitter);
        return parts.map((part, i) =>
            isEmail.test(part) ? (
                <Text key={i} style={styles.link} onPress={() => Linking.openURL(`mailto:${part}`)}>
                    {part}
                </Text>
            ) : (
                <Text key={i}>{part}</Text>
            )
        );
    };

    return (
        <SafeAreaView style={[styles.container, webScreenContainer]} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={20} color={EDITORIAL.ink} />
                </TouchableOpacity>
                <Text style={styles.eyebrow}>Legal</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content} style={webScreenScroll}>
                <Text style={styles.title}>
                    {doc.title} <Text style={styles.titleItalic}>{doc.titleAccent}</Text>
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

                <View style={{ height: 40 }} />
            </ScrollView>
            <StatusBar style="dark" />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: EDITORIAL.paper },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: EDITORIAL.hairline,
        backgroundColor: EDITORIAL.paper,
    },
    backButton: { padding: 6, marginRight: 14 },
    eyebrow: { ...ED_TYPE.eyebrow },
    content: {
        paddingHorizontal: 28, paddingTop: 32, paddingBottom: 32,
        maxWidth: 720, width: '100%', alignSelf: 'center',
    },
    title: { ...ED_TYPE.display, fontSize: 36, lineHeight: 42, marginBottom: 8 },
    titleItalic: { ...ED_TYPE.italic, color: EDITORIAL.grana },
    lastUpdated: {
        ...ED_TYPE.caption, marginBottom: 32,
        letterSpacing: 1, textTransform: 'uppercase',
    },
    section: { marginBottom: 28 },
    sectionTitle: { ...ED_TYPE.h3, marginBottom: 10 },
    sectionText: { ...ED_TYPE.body, color: EDITORIAL.inkMuted, marginBottom: 8 },
    list: { marginTop: 4, marginBottom: 4 },
    listItem: { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },
    bullet: { ...ED_TYPE.body, color: EDITORIAL.grana, marginRight: 10, marginTop: 0 },
    link: { color: EDITORIAL.grana, textDecorationLine: 'underline' },
});
