import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Linking, Platform } from 'react-native';
import { SKETCH_THEME, sketchFontFamily } from '../../theme/sketchTheme';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

export const TermsOfService = () => {
    const navigation = useNavigation();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={SKETCH_THEME.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Termes del Servei</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.lastUpdated}>Última actualització: {new Date().toLocaleDateString('ca-ES')}</Text>

                <Section title="1. Introducció">
                    Benvingut a troBar! Aquests Termes del Servei regeixen l'ús de la nostra aplicació mòbil per localitzar bars i establiments que emeten esdeveniments esportius. En utilitzar "troBar", acceptes aquestes condicions íntegrament.
                </Section>

                <Section title="2. Ús de l'Aplicació">
                    "troBar" és una eina que permet als usuaris trobar locals on veure esports. Acceptes fer servir aquesta informació exclusivament per a ús personal i no comercial. No està permès extreure dades de manera automatitzada (scraping) ni utilitzar l'aplicació per a finalitats il·lícites.
                </Section>
                
                <Section title="3. Contingut Generat per l'Usuari">
                    Els usuaris poden deixar ressenyes o suggerir canvis en la informació dels bars. En fer-ho, ens atorgues una llicència no exclusiva per utilitzar aquest contingut. Et compromets a proporcionar informació veraç i respectuosa. Ens reservem el dret d'eliminar qualsevol contingut ofensiu o inadequat.
                </Section>

                <Section title="4. Precisió de la Informació">
                    Tot i que ens esforcem per mantenir la informació actualitzada, "troBar" depèn de dades de tercers (Google Maps, usuaris). No garantim al 100% que un bar concret emeti un partit específic en tot moment. Recomanem sempre confirmar amb l'establiment.
                </Section>

                <Section title="5. Propietat Intel·lectual">
                    Tots els drets sobre el disseny, codi i contingut original de l'aplicació són propietat de l'equip de "troBar". Els logotips dels equips i competicions pertanyen als seus respectius propietaris i s'utilitzen únicament amb finalitats informatives.
                </Section>

                <Section title="6. Limitació de Responsabilitat">
                    "troBar" no es fa responsable dels canvis d'última hora en la programació dels bars ni de la qualitat del servei ofert pels establiments llistats a l'aplicació.
                </Section>

                <Section title="7. Contacte">
                    Per a qualsevol dubte o suggeriment, pots contactar-nos a suport@trobar-app.cat.
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
