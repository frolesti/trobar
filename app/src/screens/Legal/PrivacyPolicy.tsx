import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Linking, Platform } from 'react-native';
import { SKETCH_THEME, sketchFontFamily } from '../../theme/sketchTheme';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

export const PrivacyPolicy = () => {
    const navigation = useNavigation();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={SKETCH_THEME.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Política de Privacitat</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.lastUpdated}>Última actualització: {new Date().toLocaleDateString('ca-ES')}</Text>

                <Section title="1. Introducció">
                    A "troBar", valorem la teva privacitat. Aquesta Política explica com recollim, utilitzem i protegim les teves dades personals quan utilitzes la nostra aplicació.
                </Section>
                
                <Section title="2. Dades que Recollim">
                    Per oferir-te el millor servei, recollim les dades següents:
                    {'\n'}• Ubicació: Utilitzem el GPS del teu dispositiu per mostrar-te els bars més propers.
                    {'\n'}• Perfil d'Usuari: Si inicies sessió, guardem el teu nom, correu electrònic i preferències (equips, esports).
                    {'\n'}• Activitat: Estadístiques d'ús anònimes per millorar l'experiència (barres visitades, cerques).
                </Section>

                <Section title="3. Com Utilitzem les Dades">
                    Utilitzem la informació exclusivament per a:
                    {'\n'}• Mostrar-te resultats rellevants segons la teva posició i preferències.
                    {'\n'}• Enviar-te notificacions sobre partits dels teus equips preferits (si ho has activat).
                    {'\n'}• Millorar les funcionalitats de l'aplicació i corregir errors.
                </Section>

                <Section title="4. Compartició de Dades">
                    No venem ni compartim les teves dades personals amb tercers per a fins publicitaris. Podem compartir dades agregades i anònimes amb socis per a anàlisi de mercat.
                </Section>
                
                <Section title="5. Els teus Drets (GDPR/Llei de Protecció de Dades)">
                    Tens dret a accedir, rectificar i suprimir les teves dades en qualsevol moment. Pots eliminar el teu compte directament des de l'aplicació ("Perfil" {'->'} "Eliminar Compte"). Si tens dubtes, contacta amb nosaltres a suport@trobar-app.cat.
                </Section>

                <Section title="6. Seguretat">
                    Implementem mesures tècniques i organitzatives per protegir la teva informació contra accessos no autoritzats, pèrdua o alteració.
                </Section>
                
                <Section title="7. Contacte">
                   Per a qualsevol qüestió relacionada amb la privacitat, pots escriure a privacitat@trobar-app.cat.
                </Section>

                <View style={{ height: 40 }} />
            </ScrollView>
             <StatusBar style="dark" />
        </View>
    );
};

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionText}>{children}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: SKETCH_THEME.colors.bg,
        paddingTop: Platform.OS === 'android' ? 40 : 60,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
     backButton: {
        padding: 5,
        marginRight: 15,
    },
    headerTitle: {
        fontFamily: sketchFontFamily(),
        fontSize: 20,
        color: SKETCH_THEME.colors.text,
    },
    content: {
        padding: 20,
    },
    lastUpdated: {
        fontFamily: sketchFontFamily(),
        fontSize: 12,
        color: '#666',
        marginBottom: 20,
        fontStyle: 'italic',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontFamily: sketchFontFamily(),
        fontSize: 16,
        color: SKETCH_THEME.colors.primary,
        marginBottom: 8,
    },
    sectionText: {
        fontFamily: sketchFontFamily(),
        fontSize: 14,
        color: SKETCH_THEME.colors.text,
        lineHeight: 22,
    },
});
