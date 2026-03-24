import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
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
                    <Feather name="arrow-left" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Política de Privacitat</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.lastUpdated}>Última actualització: 22 de març de 2026</Text>

                <Section title="1. Introducció">
                    A "troBar", valorem la teva privacitat. Aquesta Política explica com recollim, utilitzem i protegim les teves dades personals quan utilitzes la nostra aplicació mòbil i pàgina web.
                </Section>
                
                <Section title="2. Dades que Recollim">
                    Per oferir-te el millor servei, recollim les dades següents:
                    {'\n'}• Ubicació: Utilitzem el GPS del teu dispositiu per mostrar-te els bars més propers.
                    {'\n'}• Perfil d'Usuari: Si inicies sessió, guardem el teu nom, correu electrònic i preferències (equips, esports).
                    {'\n'}• Activitat: Estadístiques d'ús anònimes per millorar l'experiència (barres visitades, cerques).
                    {'\n'}• Dades del Dispositiu: Informació bàsica del dispositiu com el sistema operatiu i la versió de l'aplicació, per garantir la compatibilitat.
                </Section>

                <Section title="3. Base Legal del Tractament">
                    Tractem les teves dades personals en base a:
                    {'\n'}• El teu consentiment (per exemple, en activar la localització o crear un compte).
                    {'\n'}• L'execució d'un contracte (quan et registres i acceptes els Termes del Servei).
                    {'\n'}• El nostre interès legítim (per millorar el servei i garantir la seva seguretat).
                </Section>

                <Section title="4. Com Utilitzem les Dades">
                    Utilitzem la informació exclusivament per a:
                    {'\n'}• Mostrar-te resultats rellevants segons la teva posició i preferències.
                    {'\n'}• Enviar-te notificacions sobre partits dels teus equips preferits (si ho has activat).
                    {'\n'}• Millorar les funcionalitats de l'aplicació i corregir errors.
                    {'\n'}• Processar subscripcions i pagaments dels comptes de negoci.
                </Section>

                <Section title="5. Compartició de Dades">
                    No venem ni compartim les teves dades personals amb tercers per a fins publicitaris. Podem compartir dades amb:
                    {'\n'}• Proveïdors de serveis (Stripe per a pagaments, Firebase per a autenticació) que tracten les dades en nom nostre.
                    {'\n'}• Dades agregades i anònimes amb socis per a anàlisi de mercat.
                    {'\n'}• Autoritats competents si ho requereix la llei.
                </Section>

                <Section title="6. Retenció de Dades">
                    Conservem les teves dades mentre mantinguis el compte actiu o sigui necessari per oferir-te el servei. Si elimines el teu compte, suprimirem les teves dades personals en un termini raonable, excepte aquelles que estiguem obligats a conservar per raons legals.
                </Section>

                <Section title="7. Transferències Internacionals">
                    Alguns dels nostres proveïdors de serveis poden estar ubicats fora de l'Espai Econòmic Europeu. En aquests casos, ens assegurem que existeixin garanties adequades per protegir les teves dades, com ara clàusules contractuals estàndard.
                </Section>
                
                <Section title="8. Els teus Drets">
                    D'acord amb la normativa de protecció de dades, tens dret a:
                    {'\n'}• Accedir a les teves dades personals.
                    {'\n'}• Rectificar dades inexactes o incompletes.
                    {'\n'}• Sol·licitar la supressió de les teves dades.
                    {'\n'}• Oposar-te al tractament de les teves dades.
                    {'\n'}• Sol·licitar la portabilitat de les teves dades en un format estructurat.
                    {'\n'}• Retirar el teu consentiment en qualsevol moment.
                    {'\n\n'}Pots eliminar el teu compte directament des de l'aplicació ("Perfil" {'→'} "Eliminar Compte"). Per exercir qualsevol d'aquests drets, contacta amb nosaltres a privacitat@trobar-app.cat.
                </Section>

                <Section title="9. Menors">
                    troBar no està dirigida a menors de 16 anys. No recollim consciemment dades de menors d'aquesta edat. Si descobrim que hem recopilat dades d'un menor sense el consentiment adequat, les suprimirem el més aviat possible.
                </Section>

                <Section title="10. Seguretat">
                    Implementem mesures tècniques i organitzatives per protegir la teva informació contra accessos no autoritzats, pèrdua o alteració. No obstant això, cap sistema de transmissió o emmagatzematge és completament segur, per la qual cosa no podem garantir una seguretat absoluta.
                </Section>

                <Section title="11. Canvis en Aquesta Política">
                    Podem actualitzar aquesta Política periòdicament. Si els canvis són significatius, t'informarem a través de l'aplicació o per correu electrònic. La data de l'última actualització apareixerà sempre al principi del document.
                </Section>
                
                <Section title="12. Contacte">
                   Per a qualsevol qüestió relacionada amb la privacitat, pots escriure a privacitat@trobar-app.cat.
                </Section>

                <View style={{ height: 40 }} />
            </ScrollView>
             <StatusBar style="light" />
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
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
     backButton: {
        padding: 5,
        marginRight: 15,
    },
    headerTitle: {
        fontFamily: sketchFontFamily(),
        fontSize: 20,
        color: 'white',
    },
    content: {
        padding: 20,
    },
    lastUpdated: {
        fontFamily: sketchFontFamily(),
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 20,
        fontStyle: 'italic',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontFamily: sketchFontFamily(),
        fontSize: 16,
        color: '#ffd700',
        marginBottom: 8,
    },
    sectionText: {
        fontFamily: sketchFontFamily(),
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 22,
    },
});
