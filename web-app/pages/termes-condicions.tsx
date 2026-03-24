import Head from 'next/head'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function TermesCondicions() {
  return (
    <>
      <Head>
        <title>troBar — Termes i Condicions</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />

      <main className="page-container" style={{maxWidth: 800, margin: '0 auto', padding: '140px 24px 60px'}}>
        <div style={{background: '#fff', borderRadius: 20, padding: '48px 40px', boxShadow: '0 12px 40px rgba(0,0,0,0.15)'}}>
        <h1 style={{fontSize: 36, fontWeight: 800, color: 'var(--text)', marginBottom: 8}}>Termes i Condicions</h1>
        <p style={{color: 'var(--muted)', marginBottom: 40, fontSize: 14}}>Última actualització: 22 de març de 2026</p>

        <Section title="1. Introducció">
          Benvingut a troBar! Aquests Termes del Servei regeixen l&apos;ús de la nostra aplicació mòbil i pàgina web per localitzar bars i establiments que emeten esdeveniments esportius. En utilitzar &ldquo;troBar&rdquo;, acceptes aquestes condicions íntegrament.
        </Section>

        <Section title="2. Acceptació dels Termes">
          En accedir o utilitzar l&apos;aplicació, confirmes que has llegit, entès i acceptat aquests Termes. Si no estàs d&apos;acord amb alguna part, no has d&apos;utilitzar el servei. Si utilitzes troBar en nom d&apos;una organització, declares que tens l&apos;autoritat per vincular-la a aquests Termes.
        </Section>

        <Section title="3. Edat Mínima">
          Has de tenir almenys 16 anys per utilitzar troBar. Si ets menor d&apos;edat segons la legislació del teu país, necessites el consentiment del teu pare, mare o tutor legal.
        </Section>

        <Section title="4. Ús de l'Aplicació">
          &ldquo;troBar&rdquo; és una eina que permet als usuaris trobar locals on veure esports. Acceptes fer servir aquesta informació exclusivament per a ús personal i no comercial. No està permès:
          <ul>
            <li>Extreure dades de manera automatitzada (scraping).</li>
            <li>Utilitzar l&apos;aplicació per a finalitats il·lícites.</li>
            <li>Interferir en el funcionament del servei o intentar accedir-hi de forma no autoritzada.</li>
            <li>Utilitzar contingut de troBar per entrenar models d&apos;intel·ligència artificial o aprenentatge automàtic.</li>
          </ul>
        </Section>

        <Section title="5. Comptes d'Usuari">
          Per accedir a determinades funcionalitats cal crear un compte. Ets responsable de mantenir la confidencialitat de les teves credencials i de tota l&apos;activitat que es produeixi al teu compte. No pots transferir ni cedir el teu compte a tercers.
        </Section>

        <Section title="6. Comptes de Negoci">
          Els propietaris de bars poden registrar el seu establiment a troBar. En fer-ho, accepten mantenir la informació del local actualitzada (horaris, partits, ofertes) i proporcionar dades veraces. troBar es reserva el dret de suspendre comptes amb informació fraudulenta o múltiples queixes.
        </Section>

        <Section title="7. Subscripcions i Pagaments">
          <ul>
            <li>Els plans de pagament es renoven automàticament segons la periodicitat escollida.</li>
            <li>Pots cancel·lar la subscripció en qualsevol moment des de la secció &ldquo;Configuració&rdquo;.</li>
            <li>Els pagaments es processen de forma segura a través de Stripe.</li>
            <li>No s&apos;ofereixen reemborsaments per períodes ja consumits.</li>
          </ul>
        </Section>

        <Section title="8. Contingut Generat per l'Usuari">
          Els usuaris poden deixar ressenyes o suggerir canvis. En fer-ho, ens atorgues una llicència no exclusiva, gratuïta i mundial per utilitzar, reproduir i mostrar aquest contingut dins del servei. Et compromets a proporcionar informació veraç i respectuosa. Ens reservem el dret d&apos;eliminar qualsevol contingut ofensiu o inadequat.
        </Section>

        <Section title="9. Precisió de la Informació">
          Tot i que ens esforcem per mantenir la informació actualitzada, &ldquo;troBar&rdquo; depèn de dades de tercers i dels propis establiments. No garantim que un bar concret emeti un partit específic en tot moment. Recomanem sempre confirmar amb l&apos;establiment.
        </Section>

        <Section title="10. Propietat Intel·lectual">
          Tots els drets sobre el disseny, codi, marca i contingut original de l&apos;aplicació són propietat exclusiva de l&apos;equip de &ldquo;troBar&rdquo;. Els logotips dels equips i competicions pertanyen als seus respectius propietaris i s&apos;utilitzen únicament amb finalitats informatives. No t&apos;és permès copiar, modificar, distribuir ni crear obres derivades del nostre contingut sense autorització prèvia.
        </Section>

        <Section title="11. Sense Garanties">
          El servei es proporciona &ldquo;tal qual&rdquo; i &ldquo;segons disponibilitat&rdquo;. No garantim que el servei sigui ininterromput, segur o lliure d&apos;errors. No oferim cap garantia, expressa o implícita, respecte a la precisió, fiabilitat o adequació del servei per a cap finalitat particular.
        </Section>

        <Section title="12. Limitació de Responsabilitat">
          &ldquo;troBar&rdquo; no es fa responsable dels canvis d&apos;última hora en la programació dels bars ni de la qualitat del servei ofert pels establiments. En cap cas serem responsables de danys indirectes, incidentals, especials o conseqüents derivats de l&apos;ús o la impossibilitat d&apos;ús del servei.
        </Section>

        <Section title="13. Indemnització">
          Acceptes indemnitzar i mantenir indemne l&apos;equip de &ldquo;troBar&rdquo; davant de qualsevol reclamació, dany o despesa derivada del teu ús indegut del servei o de la violació d&apos;aquests Termes.
        </Section>

        <Section title="14. Suspensió i Terminació">
          Ens reservem el dret de suspendre o cancel·lar el teu compte si detectem un ús inadequat, fraudulent o contrari a aquests Termes, sense necessitat de preavís. Tu pots deixar d&apos;utilitzar el servei i eliminar el teu compte en qualsevol moment.
        </Section>

        <Section title="15. Modificació dels Termes">
          Podem actualitzar aquests Termes periòdicament. Si els canvis són significatius, t&apos;informarem a través de l&apos;aplicació o per correu electrònic. Si continues utilitzant el servei després dels canvis, s&apos;entendrà que els acceptes.
        </Section>

        <Section title="16. Llei Aplicable i Jurisdicció">
          Aquests Termes es regeixen per la legislació vigent a Espanya. Per a qualsevol controvèrsia, les parts se sotmeten als jutjats i tribunals de Barcelona, renunciant a qualsevol altre fur que els pogués correspondre.
        </Section>

        <Section title="17. Disposicions Generals">
          Si alguna clàusula d&apos;aquests Termes resultés invàlida, la resta continuarà vigent. El fet que no exercim algun dret no implica que hi renunciem. Aquests Termes constitueixen l&apos;acord complet entre tu i troBar en relació amb l&apos;ús del servei. No existeix cap relació d&apos;associació, agència ni representació entre tu i troBar.
        </Section>

        <Section title="18. Contacte">
          Per a qualsevol dubte, pots contactar-nos a <a href="mailto:suport@trobar-app.cat">suport@trobar-app.cat</a>.
        </Section>
        </div>
      </main>

      <Footer />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{marginBottom: 32}}>
      <h2 style={{fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 12}}>{title}</h2>
      <div style={{color: 'var(--muted)', lineHeight: 1.7, fontSize: 16}}>{children}</div>
    </div>
  )
}
