/**
 * Font única i canònica del contingut legal de troBar.
 * Consumit per:
 *   - Mòbil: app/src/screens/Legal/{PrivacyPolicy,TermsOfService}.tsx
 *   - Web  : web-app/components/LegalModal.tsx
 *           web-app/pages/{politica-privacitat,termes-condicions}.tsx
 *
 * Si cal modificar el text legal, fes-ho AQUÍ i només aquí.
 */

export type LegalBlock =
    | { kind: 'p'; text: string }
    | { kind: 'ul'; items: string[] };

export interface LegalSection {
    title: string;
    blocks: LegalBlock[];
}

export interface LegalDoc {
    title: string;
    titleAccent: string;  // paraula que es destaca en cursiva grana
    lastUpdated: string;
    sections: LegalSection[];
    contactEmail: string;
}

const p = (text: string): LegalBlock => ({ kind: 'p', text });
const ul = (items: string[]): LegalBlock => ({ kind: 'ul', items });

export const PRIVACY: LegalDoc = {
    title: 'Política de',
    titleAccent: 'Privacitat',
    lastUpdated: '22 de març de 2026',
    contactEmail: 'privacitat@trobar-app.cat',
    sections: [
        { title: '1. Introducció', blocks: [
            p('A "troBar", valorem la teva privacitat. Aquesta Política explica com recollim, utilitzem i protegim les teves dades personals quan utilitzes la nostra aplicació mòbil i pàgina web.')
        ]},
        { title: '2. Dades que Recollim', blocks: [
            ul([
                'Ubicació: utilitzem el GPS del teu dispositiu per mostrar-te els bars més propers.',
                'Perfil d\'Usuari: si inicies sessió, guardem el teu nom, correu electrònic i preferències.',
                'Activitat: estadístiques d\'ús anònimes per millorar l\'experiència.',
                'Dades de negoci: si registres un bar, guardem el nom del local, NIF, adreça, telèfon, email i dades de pagament.',
                'Dades del dispositiu: informació bàsica com el sistema operatiu i la versió de l\'aplicació, per garantir la compatibilitat.',
            ])
        ]},
        { title: '3. Base Legal del Tractament', blocks: [
            p('Tractem les teves dades personals en base a:'),
            ul([
                'El teu consentiment (per exemple, en activar la localització o crear un compte).',
                'L\'execució d\'un contracte (quan et registres i acceptes els Termes del Servei).',
                'El nostre interès legítim (per millorar el servei i garantir la seva seguretat).',
            ])
        ]},
        { title: '4. Com Utilitzem les Dades', blocks: [
            ul([
                'Mostrar-te resultats rellevants segons la teva posició i preferències.',
                'Enviar-te notificacions sobre partits (si ho has activat).',
                'Gestionar el perfil i la subscripció del teu establiment.',
                'Processar subscripcions i pagaments dels comptes de negoci.',
                'Millorar les funcionalitats de l\'aplicació i corregir errors.',
            ])
        ]},
        { title: '5. Compartició de Dades', blocks: [
            p('No venem ni compartim les teves dades personals amb tercers per a fins publicitaris. Podem compartir dades amb:'),
            ul([
                'Proveïdors de serveis (Stripe per a pagaments, Firebase per a autenticació) que tracten les dades en nom nostre.',
                'Dades agregades i anònimes amb socis per a anàlisi de mercat.',
                'Autoritats competents si ho requereix la llei.',
            ])
        ]},
        { title: '6. Retenció de Dades', blocks: [
            p('Conservem les teves dades mentre mantinguis el compte actiu o sigui necessari per oferir-te el servei. Si elimines el teu compte, suprimirem les teves dades personals en un termini raonable, excepte aquelles que estiguem obligats a conservar per raons legals.')
        ]},
        { title: '7. Transferències Internacionals', blocks: [
            p('Alguns dels nostres proveïdors de serveis poden estar ubicats fora de l\'Espai Econòmic Europeu. En aquests casos, ens assegurem que existeixin garanties adequades per protegir les teves dades, com ara clàusules contractuals estàndard.')
        ]},
        { title: '8. Els teus Drets', blocks: [
            p('D\'acord amb la normativa de protecció de dades, tens dret a:'),
            ul([
                'Accedir a les teves dades personals.',
                'Rectificar dades inexactes o incompletes.',
                'Sol·licitar la supressió de les teves dades.',
                'Oposar-te al tractament de les teves dades.',
                'Sol·licitar la portabilitat de les teves dades en un format estructurat.',
                'Retirar el teu consentiment en qualsevol moment.',
            ]),
            p('Pots eliminar el teu compte directament des de l\'aplicació ("Perfil" → "Eliminar Compte"). Per exercir qualsevol d\'aquests drets, contacta amb nosaltres a privacitat@trobar-app.cat.')
        ]},
        { title: '9. Menors', blocks: [
            p('troBar no està dirigida a menors de 16 anys. No recollim conscientment dades de menors d\'aquesta edat. Si descobrim que hem recopilat dades d\'un menor sense el consentiment adequat, les suprimirem el més aviat possible.')
        ]},
        { title: '10. Seguretat', blocks: [
            p('Implementem mesures tècniques i organitzatives per protegir la teva informació contra accessos no autoritzats, pèrdua o alteració. Totes les comunicacions estan xifrades mitjançant TLS. No obstant això, cap sistema és completament segur, per la qual cosa no podem garantir una seguretat absoluta.')
        ]},
        { title: '11. Cookies', blocks: [
            p('La nostra pàgina web utilitza cookies essencials per al funcionament del servei. No utilitzem cookies de seguiment de tercers.')
        ]},
        { title: '12. Canvis en Aquesta Política', blocks: [
            p('Podem actualitzar aquesta Política periòdicament. Si els canvis són significatius, t\'informarem a través de l\'aplicació o per correu electrònic. La data de l\'última actualització apareixerà sempre al principi del document.')
        ]},
        { title: '13. Contacte', blocks: [
            p('Per a qualsevol qüestió relacionada amb la privacitat, pots escriure a privacitat@trobar-app.cat.')
        ]},
    ],
};

export const TERMS: LegalDoc = {
    title: 'Termes del',
    titleAccent: 'Servei',
    lastUpdated: '22 de març de 2026',
    contactEmail: 'suport@trobar-app.cat',
    sections: [
        { title: '1. Introducció', blocks: [
            p('Benvingut a troBar! Aquests Termes del Servei regeixen l\'ús de la nostra aplicació mòbil i pàgina web per localitzar bars i establiments que emeten esdeveniments esportius. En utilitzar "troBar", acceptes aquestes condicions íntegrament.')
        ]},
        { title: '2. Acceptació dels Termes', blocks: [
            p('En accedir o utilitzar l\'aplicació, confirmes que has llegit, entès i acceptat aquests Termes. Si no estàs d\'acord amb alguna part, no has d\'utilitzar el servei. Si utilitzes troBar en nom d\'una organització, declares que tens l\'autoritat per vincular-la a aquests Termes.')
        ]},
        { title: '3. Edat Mínima', blocks: [
            p('Has de tenir almenys 16 anys per utilitzar troBar. Si ets menor d\'edat segons la legislació del teu país, necessites el consentiment del teu pare, mare o tutor legal.')
        ]},
        { title: '4. Ús de l\'Aplicació', blocks: [
            p('"troBar" és una eina que permet als usuaris trobar locals on veure esports. Acceptes fer servir aquesta informació exclusivament per a ús personal i no comercial. No està permès:'),
            ul([
                'Extreure dades de manera automatitzada (scraping).',
                'Utilitzar l\'aplicació per a finalitats il·lícites.',
                'Interferir en el funcionament del servei o intentar accedir-hi de forma no autoritzada.',
                'Utilitzar contingut de troBar per entrenar models d\'intel·ligència artificial o aprenentatge automàtic.',
            ])
        ]},
        { title: '5. Comptes d\'Usuari', blocks: [
            p('Per accedir a determinades funcionalitats cal crear un compte. Ets responsable de mantenir la confidencialitat de les teves credencials i de tota l\'activitat que es produeixi al teu compte. No pots transferir ni cedir el teu compte a tercers.')
        ]},
        { title: '6. Comptes de Negoci', blocks: [
            p('Els propietaris de bars poden registrar el seu establiment a troBar. En fer-ho, accepten mantenir la informació del local actualitzada (horaris, partits, ofertes) i proporcionar dades veraces. troBar es reserva el dret de suspendre comptes amb informació fraudulenta o múltiples queixes.')
        ]},
        { title: '7. Subscripcions i Pagaments', blocks: [
            ul([
                'Els plans de pagament es renoven automàticament segons la periodicitat escollida.',
                'Pots cancel·lar la subscripció en qualsevol moment des de la secció "Configuració".',
                'Els pagaments es processen de forma segura a través de Stripe.',
                'No s\'ofereixen reemborsaments per períodes ja consumits.',
            ])
        ]},
        { title: '8. Contingut Generat per l\'Usuari', blocks: [
            p('Els usuaris poden deixar ressenyes o suggerir canvis. En fer-ho, ens atorgues una llicència no exclusiva, gratuïta i mundial per utilitzar, reproduir i mostrar aquest contingut dins del servei. Et compromets a proporcionar informació veraç i respectuosa. Ens reservem el dret d\'eliminar qualsevol contingut ofensiu o inadequat.')
        ]},
        { title: '9. Precisió de la Informació', blocks: [
            p('Tot i que ens esforcem per mantenir la informació actualitzada, "troBar" depèn de dades de tercers i dels propis establiments. No garantim que un bar concret emeti un partit específic en tot moment. Recomanem sempre confirmar amb l\'establiment.')
        ]},
        { title: '10. Propietat Intel·lectual', blocks: [
            p('Tots els drets sobre el disseny, codi, marca i contingut original de l\'aplicació són propietat exclusiva de l\'equip de "troBar". Els logotips dels equips i competicions pertanyen als seus respectius propietaris i s\'utilitzen únicament amb finalitats informatives. No t\'és permès copiar, modificar, distribuir ni crear obres derivades del nostre contingut sense autorització prèvia.')
        ]},
        { title: '11. Sense Garanties', blocks: [
            p('El servei es proporciona "tal qual" i "segons disponibilitat". No garantim que el servei sigui ininterromput, segur o lliure d\'errors. No oferim cap garantia, expressa o implícita, respecte a la precisió, fiabilitat o adequació del servei per a cap finalitat particular.')
        ]},
        { title: '12. Limitació de Responsabilitat', blocks: [
            p('"troBar" no es fa responsable dels canvis d\'última hora en la programació dels bars ni de la qualitat del servei ofert pels establiments. En cap cas serem responsables de danys indirectes, incidentals, especials o conseqüents derivats de l\'ús o la impossibilitat d\'ús del servei.')
        ]},
        { title: '13. Indemnització', blocks: [
            p('Acceptes indemnitzar i mantenir indemne l\'equip de "troBar" davant de qualsevol reclamació, dany o despesa derivada del teu ús indegut del servei o de la violació d\'aquests Termes.')
        ]},
        { title: '14. Suspensió i Terminació', blocks: [
            p('Ens reservem el dret de suspendre o cancel·lar el teu compte si detectem un ús inadequat, fraudulent o contrari a aquests Termes, sense necessitat de preavís. Tu pots deixar d\'utilitzar el servei i eliminar el teu compte en qualsevol moment.')
        ]},
        { title: '15. Modificació dels Termes', blocks: [
            p('Podem actualitzar aquests Termes periòdicament. Si els canvis són significatius, t\'informarem a través de l\'aplicació o per correu electrònic. Si continues utilitzant el servei després dels canvis, s\'entendrà que els acceptes.')
        ]},
        { title: '16. Llei Aplicable i Jurisdicció', blocks: [
            p('Aquests Termes es regeixen per la legislació vigent a Espanya. Per a qualsevol controvèrsia, les parts se sotmeten als jutjats i tribunals de Barcelona, renunciant a qualsevol altre fur que els pogués correspondre.')
        ]},
        { title: '17. Disposicions Generals', blocks: [
            p('Si alguna clàusula d\'aquests Termes resultés invàlida, la resta continuarà vigent. El fet que no exercim algun dret no implica que hi renunciem. Aquests Termes constitueixen l\'acord complet entre tu i troBar en relació amb l\'ús del servei. No existeix cap relació d\'associació, agència ni representació entre tu i troBar.')
        ]},
        { title: '18. Contacte', blocks: [
            p('Per a qualsevol dubte, pots contactar-nos a suport@trobar-app.cat.')
        ]},
    ],
};
