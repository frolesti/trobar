import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
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
                    <Feather name="arrow-left" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Termes del Servei</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.lastUpdated}>Última actualització: 22 de març de 2026</Text>

                <Section title="1. Introducció">
                    Benvingut a troBar! Aquests Termes del Servei regeixen l'ús de la nostra aplicació mòbil i pàgina web per localitzar bars i establiments que emeten esdeveniments esportius. En utilitzar "troBar", acceptes aquestes condicions íntegrament.
                </Section>

                <Section title="2. Acceptació dels Termes">
                    En accedir o utilitzar l'aplicació, confirmes que has llegit, entès i acceptat aquests Termes. Si no estàs d'acord amb alguna part, no has d'utilitzar el servei. Si utilitzes troBar en nom d'una organització, declares que tens l'autoritat per vincular-la a aquests Termes.
                </Section>

                <Section title="3. Edat Mínima">
                    Has de tenir almenys 16 anys per utilitzar troBar. Si ets menor d'edat segons la legislació del teu país, necessites el consentiment del teu pare, mare o tutor legal.
                </Section>

                <Section title="4. Ús de l'Aplicació">
                    "troBar" és una eina que permet als usuaris trobar locals on veure esports. Acceptes fer servir aquesta informació exclusivament per a ús personal i no comercial. No està permès:
                    {'\n'}• Extreure dades de manera automatitzada (scraping).
                    {'\n'}• Utilitzar l'aplicació per a finalitats il·lícites.
                    {'\n'}• Interferir en el funcionament del servei o intentar accedir-hi de forma no autoritzada.
                    {'\n'}• Utilitzar contingut de troBar per entrenar models d'intel·ligència artificial o aprenentatge automàtic.
                </Section>
                
                <Section title="5. Comptes d'Usuari">
                    Per accedir a determinades funcionalitats cal crear un compte. Ets responsable de mantenir la confidencialitat de les teves credencials i de tota l'activitat que es produeixi al teu compte. No pots transferir ni cedir el teu compte a tercers.
                </Section>

                <Section title="6. Comptes de Negoci">
                    Els propietaris de bars poden registrar el seu establiment a troBar. En fer-ho, accepten mantenir la informació del local actualitzada i proporcionar dades veraces. troBar es reserva el dret de suspendre comptes amb informació fraudulenta o múltiples queixes.
                </Section>

                <Section title="7. Subscripcions i Pagaments">
                    Els bars registrats poden subscriure's al pla Premium per obtenir funcionalitats avançades. La subscripció es renova automàticament segons la periodicitat escollida.
                    {'\n\n'}• Els pagaments es processen de forma segura a través de Stripe.
                    {'\n'}• Pots cancel·lar la subscripció en qualsevol moment des de la secció "Configuració".
                    {'\n'}• No s'ofereixen reemborsaments per períodes ja consumits.
                </Section>

                <Section title="8. Contingut Generat per l'Usuari">
                    Els usuaris poden deixar ressenyes o suggerir canvis en la informació dels bars. En fer-ho, ens atorgues una llicència no exclusiva, gratuïta i mundial per utilitzar, reproduir i mostrar aquest contingut dins del servei. Et compromets a proporcionar informació veraç i respectuosa. Ens reservem el dret d'eliminar qualsevol contingut ofensiu o inadequat.
                </Section>

                <Section title="9. Precisió de la Informació">
                    Tot i que ens esforcem per mantenir la informació actualitzada, "troBar" depèn de dades de tercers i dels propis establiments. No garantim que un bar concret emeti un partit específic en tot moment. Recomanem sempre confirmar amb l'establiment.
                </Section>

                <Section title="10. Propietat Intel·lectual">
                    Tots els drets sobre el disseny, codi, marca i contingut original de l'aplicació són propietat exclusiva de l'equip de "troBar". Els logotips dels equips i competicions pertanyen als seus respectius propietaris i s'utilitzen únicament amb finalitats informatives. No t'és permès copiar, modificar, distribuir ni crear obres derivades del nostre contingut sense autorització prèvia.
                </Section>

                <Section title="11. Sense Garanties">
                    El servei es proporciona "tal qual" i "segons disponibilitat". No garantim que el servei sigui ininterromput, segur o lliure d'errors. No oferim cap garantia, expressa o implícita, respecte a la precisió, fiabilitat o adequació del servei per a cap finalitat particular.
                </Section>

                <Section title="12. Limitació de Responsabilitat">
                    "troBar" no es fa responsable dels canvis d'última hora en la programació dels bars ni de la qualitat del servei ofert pels establiments. En cap cas serem responsables de danys indirectes, incidentals, especials o conseqüents derivats de l'ús o la impossibilitat d'ús del servei.
                </Section>

                <Section title="13. Indemnització">
                    Acceptes indemnitzar i mantenir indemne l'equip de "troBar" davant de qualsevol reclamació, dany o despesa derivada del teu ús indegut del servei o de la violació d'aquests Termes.
                </Section>

                <Section title="14. Suspensió i Terminació">
                    Ens reservem el dret de suspendre o cancel·lar el teu compte si detectem un ús inadequat, fraudulent o contrari a aquests Termes, sense necessitat de preavís. Tu pots deixar d'utilitzar el servei i eliminar el teu compte en qualsevol moment.
                </Section>

                <Section title="15. Modificació dels Termes">
                    Podem actualitzar aquests Termes periòdicament. Si els canvis són significatius, t'informarem a través de l'aplicació o per correu electrònic. Si continues utilitzant el servei després dels canvis, s'entendrà que els acceptes.
                </Section>

                <Section title="16. Llei Aplicable i Jurisdicció">
                    Aquests Termes es regeixen per la legislació vigent a Espanya. Per a qualsevol controvèrsia, les parts se sotmeten als jutjats i tribunals de Barcelona, renunciant a qualsevol altre fur que els pogués correspondre.
                </Section>

                <Section title="17. Disposicions Generals">
                    Si alguna clàusula d'aquests Termes resultés invàlida, la resta continuarà vigent. El fet que no exercim algun dret no implica que hi renunciem. Aquests Termes constitueixen l'acord complet entre tu i troBar en relació amb l'ús del servei. No existeix cap relació d'associació, agència ni representació entre tu i troBar.
                </Section>

                <Section title="18. Contacte">
                    Per a qualsevol dubte o suggeriment, pots contactar-nos a suport@trobar-app.cat.
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
