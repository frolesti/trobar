import Head from 'next/head'
import Header from '../components/Header'
import Footer from '../components/Footer'

export default function PoliticaPrivacitat() {
  return (
    <>
      <Head>
        <title>troBar — Política de Privacitat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />

      <main className="page-container" style={{maxWidth: 800, margin: '0 auto', padding: '140px 24px 60px'}}>
        <div style={{background: '#fff', borderRadius: 20, padding: '48px 40px', boxShadow: '0 12px 40px rgba(0,0,0,0.15)'}}>
        <h1 style={{fontSize: 36, fontWeight: 800, color: 'var(--text)', marginBottom: 8}}>Política de Privacitat</h1>
        <p style={{color: 'var(--muted)', marginBottom: 40, fontSize: 14}}>Última actualització: 22 de març de 2026</p>

        <Section title="1. Introducció">
          A &ldquo;troBar&rdquo;, valorem la teva privacitat. Aquesta Política explica com recollim, utilitzem i protegim les teves dades personals quan utilitzes la nostra aplicació i pàgina web.
        </Section>

        <Section title="2. Dades que Recollim">
          <ul>
            <li><strong>Ubicació:</strong> Utilitzem el GPS del teu dispositiu per mostrar-te els bars més propers.</li>
            <li><strong>Perfil d&apos;Usuari:</strong> Si inicies sessió, guardem el teu nom, correu electrònic i preferències.</li>
            <li><strong>Activitat:</strong> Estadístiques d&apos;ús anònimes per millorar l&apos;experiència.</li>
            <li><strong>Dades de negoci:</strong> Si registres un bar, guardem el nom del local, NIF, adreça, telèfon, email i dades de pagament.</li>
            <li><strong>Dades del Dispositiu:</strong> Informació bàsica del dispositiu com el sistema operatiu i la versió de l&apos;aplicació, per garantir la compatibilitat.</li>
          </ul>
        </Section>

        <Section title="3. Base Legal del Tractament">
          Tractem les teves dades personals en base a:
          <ul>
            <li>El teu consentiment (per exemple, en activar la localització o crear un compte).</li>
            <li>L&apos;execució d&apos;un contracte (quan et registres i acceptes els Termes del Servei).</li>
            <li>El nostre interès legítim (per millorar el servei i garantir la seva seguretat).</li>
          </ul>
        </Section>

        <Section title="4. Com Utilitzem les Dades">
          <ul>
            <li>Mostrar-te resultats rellevants segons la teva posició i preferències.</li>
            <li>Enviar-te notificacions sobre partits (si ho has activat).</li>
            <li>Gestionar el perfil i la subscripció del teu establiment.</li>
            <li>Processar subscripcions i pagaments dels comptes de negoci.</li>
            <li>Millorar les funcionalitats de l&apos;aplicació i corregir errors.</li>
          </ul>
        </Section>

        <Section title="5. Compartició de Dades">
          No venem ni compartim les teves dades personals amb tercers per a fins publicitaris. Podem compartir dades amb:
          <ul>
            <li>Proveïdors de serveis (Stripe per a pagaments, Firebase per a autenticació) que tracten les dades en nom nostre.</li>
            <li>Dades agregades i anònimes amb socis per a anàlisi de mercat.</li>
            <li>Autoritats competents si ho requereix la llei.</li>
          </ul>
        </Section>

        <Section title="6. Retenció de Dades">
          Conservem les teves dades mentre mantinguis el compte actiu o sigui necessari per oferir-te el servei. Si elimines el teu compte, suprimirem les teves dades personals en un termini raonable, excepte aquelles que estiguem obligats a conservar per raons legals.
        </Section>

        <Section title="7. Transferències Internacionals">
          Alguns dels nostres proveïdors de serveis poden estar ubicats fora de l&apos;Espai Econòmic Europeu. En aquests casos, ens assegurem que existeixin garanties adequades per protegir les teves dades, com ara clàusules contractuals estàndard.
        </Section>

        <Section title="8. Els teus Drets">
          D&apos;acord amb la normativa de protecció de dades, tens dret a:
          <ul>
            <li>Accedir a les teves dades personals.</li>
            <li>Rectificar dades inexactes o incompletes.</li>
            <li>Sol·licitar la supressió de les teves dades.</li>
            <li>Oposar-te al tractament de les teves dades.</li>
            <li>Sol·licitar la portabilitat de les teves dades en un format estructurat.</li>
            <li>Retirar el teu consentiment en qualsevol moment.</li>
          </ul>
          Pots eliminar el teu compte directament des de l&apos;aplicació (&ldquo;Perfil&rdquo; → &ldquo;Eliminar Compte&rdquo;). Per exercir qualsevol d&apos;aquests drets, contacta amb nosaltres a <a href="mailto:privacitat@trobar-app.cat">privacitat@trobar-app.cat</a>.
        </Section>

        <Section title="9. Menors">
          troBar no està dirigida a menors de 16 anys. No recollim consciemment dades de menors d&apos;aquesta edat. Si descobrim que hem recopilat dades d&apos;un menor sense el consentiment adequat, les suprimirem el més aviat possible.
        </Section>

        <Section title="10. Seguretat">
          Implementem mesures tècniques i organitzatives per protegir la teva informació contra accessos no autoritzats, pèrdua o alteració. Totes les comunicacions estan xifrades mitjançant TLS. No obstant això, cap sistema és completament segur, per la qual cosa no podem garantir una seguretat absoluta.
        </Section>

        <Section title="11. Cookies">
          La nostra pàgina web utilitza cookies essencials per al funcionament del servei. No utilitzem cookies de seguiment de tercers.
        </Section>

        <Section title="12. Canvis en Aquesta Política">
          Podem actualitzar aquesta Política periòdicament. Si els canvis són significatius, t&apos;informarem a través de l&apos;aplicació o per correu electrònic. La data de l&apos;última actualització apareixerà sempre al principi del document.
        </Section>

        <Section title="13. Contacte">
          Per a qualsevol qüestió relacionada amb la privacitat, pots escriure a <a href="mailto:privacitat@trobar-app.cat">privacitat@trobar-app.cat</a>.
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
